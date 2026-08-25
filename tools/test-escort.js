// Hermit escort + floor-2 pack size test. Run: node tools/test-escort.js
//
// From the bargain (chooseStarter) to the sacrifice, THE HERMIT enters every
// chamber as a guest. And on floor 2+, every crawl fight fields 2-3 foes:
// the honest pack is padded with srcId-less reinforcements (write-back
// ignores them) and capped at 3.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
// Same Proxy stub as tools/test-cube.js: ids that exist in index.html
// markup answer; everything else is null, as in the real page.
function stubEl() {
  const t = {
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  };
  return new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector') return () => stubEl();
      if (k === 'addEventListener' || k === 'removeEventListener' ||
          k === 'setAttribute' || k === 'removeAttribute' ||
          k === 'focus' || k === 'blur' || k === 'remove' || k === 'scrollTo') return () => {};
      if (k === 'appendChild' || k === 'removeChild' || k === 'insertBefore' ||
          k === 'closest' || k === 'cloneNode') return () => stubEl();
      if (k === 'getBoundingClientRect') return () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 });
      if (k === 'getBBox') return () => ({ x: 0, y: 0, width: 10, height: 10 });
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'children' || k === 'childNodes') return [];
      return stubEl();
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptAt = html.indexOf('<script');
const liveIds = new Set(
  [...html.slice(0, scriptAt).matchAll(/id="([^"]+)"/g)].map(m => m[1]));

const byId = {};
global.document = {
  getElementById: id => {
    if (!liveIds.has(id)) return null;
    return (byId[id] = byId[id] || stubEl());
  },
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  activeElement: null, body: stubEl(), documentElement: stubEl(),
};
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0;
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.innerWidth = 1280; global.innerHeight = 800; global.devicePixelRatio = 1;
Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
global.setTimeout = fn => { fn(); return 0; };  // transition resolves inline
global.clearTimeout = () => {};

// ---------------------------------------------------------------- load
const root = path.join(__dirname, '..');
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/balance.js', 'data/fxsheets.js',
                 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg);
  if (!cond) failed++;
}

const T = window.__DW;
const s = T.state;
s.modal = null; // boot opens the controls overlay; clear it as a player would

// Fake combat module: records cfg, instantly reports a won fight.
let lastCfg = null;
window.DW_COMBAT = {
  start(c) { lastCfg = c; c.onEnd({ won: true, party: [{ id: 'op', frac: 1 }], foes: [] }); },
  isActive() { return false; },
};

// Mock crawl foes (the fields enterCombat reads: hp, vitae, kind, id).
let nextId = 900;
const mkFoe = kind => ({ id: 'f' + (nextId++), kind, hp: 4, vitae: 4, c: 0, r: 0, grace: 0 });

// ============================================================ before bargain
console.log('-- before the bargain: no escort');
{
  s.floor = 0;
  T.enterCombat([mkFoe('TESTA')]);
  ok(lastCfg.guests === undefined, 'no guests before hermitMet');
  ok(lastCfg.foes.length === 1, 'floor 1 pack is not padded');
}

// ============================================================ the bargain
console.log('-- chooseStarter flips the escort on');
{
  s.modal = 'hermit';
  T.chooseStarter('CALX');
  ok(s.hermitMet === true, 'bargain sets hermitMet');
  ok(s.escort && typeof s.escort.c === 'number' && typeof s.escort.r === 'number',
     'bargain spawns the crawl escort body');
  T.enterCombat([mkFoe('SILIQVA')]);
  ok(Array.isArray(lastCfg.guests) && lastCfg.guests[0] === 'hermit',
     'hermit escorts the next fight');
}

// ============================================================ crawl trail
console.log('-- crawl: escort takes the tail-vacated tile, ghost rules');
{
  // Straight artificial corridor: leader at (5,5), tail CALX at (4,5),
  // escort at (3,5). One step east cascades every segment one tile.
  const [op, calx] = s.circle.members;
  op.c = 5; op.r = 5; calx.c = 4; calx.r = 5;
  s.escort = { c: 3, r: 5 };
  s.stepsUsed = 0; s.mode = 'move'; s.modal = null;
  const walk = ['3,5', '4,5', '5,5', '6,5'];
  // moveInput consults module-scope walkable, rebuilt only by loadFloor --
  // so teach FLOOR01 the corridor tiles, reload, and restage.
  const F = window.FLOOR01;
  const added = [];
  walk.forEach(k => {
    const [c, r] = k.split(',').map(Number);
    if (!F.tiles.some(t => t[0] === c && t[1] === r)) { F.tiles.push([c, r]); added.push([c, r]); }
  });
  T.loadFloor(0);                         // rebuild walkable from patched tiles
  s.escort = { c: 3, r: 5 };              // loadFloor cleared it — restage
  const [op2, calx2] = s.circle.members;  // loadFloor rebuilt members
  op2.c = 5; op2.r = 5; calx2.c = 4; calx2.r = 5;
  s.modal = null; s.foes.forEach(f => { f.awake = false; f.c = 0; f.r = 0; });
  T.moveInput(1, 0);
  ok(op2.c === 6 && op2.r === 5, 'leader steps east');
  ok(calx2.c === 5 && calx2.r === 5, 'tail cascades into the leader tile');
  ok(s.escort.c === 4 && s.escort.r === 5, 'escort cascades into the tail tile');
  added.forEach(([c, r]) => {
    const i = F.tiles.findIndex(t => t[0] === c && t[1] === r);
    if (i >= 0) F.tiles.splice(i, 1);
  });
  T.loadFloor(0);
  ok(s.escort === null, 'loadFloor clears the escort');
  s.hermitMet = true;                     // loadFloor left flags alone; keep run state
}

// ============================================================ explicit wins
console.log('-- explicit opts.guests is left untouched');
{
  T.enterCombat([mkFoe('TESTA')], { guests: [] });
  ok(Array.isArray(lastCfg.guests) && lastCfg.guests.length === 0,
     'explicit empty guests not overridden');
}

// ============================================================ floor 2 pack
console.log('-- floor 2: packs padded to 2-3, honest foes keep srcId');
{
  s.floor = 1;
  const sizes = new Set();
  for (let i = 0; i < 40; i++) {
    const real = mkFoe('TESTA');
    T.enterCombat([real]);
    sizes.add(lastCfg.foes.length);
    if (i === 0) {
      ok(lastCfg.foes[0].srcId === real.id, 'engaged foe keeps its srcId');
      ok(lastCfg.foes.slice(1).every(f => f.srcId === undefined),
         'reinforcements carry no srcId');
      ok(lastCfg.foes.slice(1).every(f => (f.tpl === 't' || f.tpl === 's') && f.frac === 1),
         'reinforcements are full-VITAE TESTA/SILIQVA templates');
    }
  }
  ok([...sizes].every(n => n >= 2 && n <= 3), 'every pack lands in [2,3]');
  ok(sizes.has(2) && sizes.has(3), 'both 2-packs and 3-packs occur over 40 rolls');
}

// ============================================================ cap at 3
console.log('-- oversized packs are capped at 3');
{
  const four = [mkFoe('TESTA'), mkFoe('TESTA'), mkFoe('SILIQVA'), mkFoe('SILIQVA')];
  T.enterCombat(four);
  ok(lastCfg.foes.length === 3, '4 engaged -> 3 enter the chamber');
  ok(lastCfg.foes.every(f => f.srcId !== undefined), 'all three are honest pack foes');
}

// ============================================================ exit ambush
console.log('-- floor 2 exit ambush: forced, flagged, once');
{
  T.loadFloor(1);
  s.modal = null; s.mode = 'move'; s.stepsUsed = 0;
  s.hermitMet = true; s.hermitGone = false; s.ambushDone = false;
  s.foes.forEach(f => { f.awake = false; });
  // Walk the leader onto a stairs-room tile via a legal step: stage him just
  // outside at (12,2) -- corridor into the NORTHEAST room -- then step east.
  const F2 = window.FLOOR02;
  const has = (c, r) => F2.tiles.some(t => t[0] === c && t[1] === r);
  const added = [];
  [[12, 2], [13, 2]].forEach(([c, r]) => {
    if (!has(c, r)) { F2.tiles.push([c, r]); added.push([c, r]); }
  });
  T.loadFloor(1);
  s.modal = null; s.hermitMet = true; s.ambushDone = false;
  s.foes.forEach(f => { f.awake = false; });
  const L = s.circle.members[0];
  s.circle.members.forEach(m => { m.c = 12; m.r = 2; });
  lastCfg = undefined;
  T.moveInput(1, 0);
  ok(s.ambushDone === true, 'entering the stairs room fires the ambush once');
  ok(lastCfg && lastCfg.archon === true, 'combat cfg carries the archon flag');
  ok(Array.isArray(lastCfg.guests) && lastCfg.guests[0] === 'hermit',
     'hermit escorts the ambush');
  ok(lastCfg.foes.length >= 1, 'ambush fields a pack even with the guard down');
  // The stub auto-wins, so the whole handoff resolves right here:
  ok(s.hermitGone === true, 'winning the ambush fires the sacrifice');
  ok(s.escort === null, 'the crawl escort dissolves with him');
  ok(s.modal === 'cube', 'the cube bequest opens on the win');
  s.modal = null;
  // no refire
  lastCfg = undefined;
  s.scene = 'crawl'; s.mode = 'move'; s.stepsUsed = 0; s.modal = null;
  L.c = 12; L.r = 2;
  T.moveInput(1, 0);
  ok(lastCfg === undefined, 'ambush is one-shot: re-entry stays quiet');
  added.forEach(([c, r]) => {
    const i = F2.tiles.findIndex(t => t[0] === c && t[1] === r);
    if (i >= 0) F2.tiles.splice(i, 1);
  });
  T.loadFloor(0);
  s.hermitMet = true;
}

// ============================================================ cube opens the descent
console.log('-- hasCube unseals the stairs');
{
  s.hasCube = true;
  s.modal = 'exit';
  s.floor = 1;
  T.answerExit(true);
  ok(s.over === 'WIN', 'taking the DESCENT with the cube ends the run: escape');
  s.over = null; s.hasCube = false;
}

// ============================================================ after sacrifice
console.log('-- hermitGone ends the escort, and it fires exactly once');
{
  s.escort = { c: 1, r: 1 };
  T.hermitSacrifice();                     // second call: the once-guard holds
  ok(s.escort !== null && s.modal !== 'cube',
     'sacrifice is once-per-run: the guard swallows the second call');
  s.escort = null;
  T.enterCombat([mkFoe('TESTA')]);
  ok(lastCfg.guests === undefined, 'no guests after the sacrifice');
}

// ============================================================ debug seam
console.log('-- empty-foes debug entry is never padded');
{
  s.hermitGone = false;
  T.enterCombat([]);
  ok(lastCfg.foes === undefined, 'debug entry keeps the FIGHTS spec (no synthetic pack)');
}

// ============================================================ ?sacrifice seam
console.log('-- debugSacrifice: CALX aboard, straight into the sacrifice fight');
{
  T.loadFloor(0);
  s.modal = null; s.hermitMet = false; s.hermitGone = false; s.ambushDone = false;
  s.circle.members.length = 1;                       // solo OPERATOR, pre-bargain
  s.roster.length = 0; s.roster.push('OPERATOR');    // forget earlier recruits
  lastCfg = undefined;
  T.debugSacrifice();
  ok(s.circle.members.some(m => m.name === 'CALX'), 'seam recruits CALX');
  ok(s.hermitMet === true, 'seam takes the bargain');
  ok(s.ambushDone === true, 'seam fires the scripted ambush');
  ok(lastCfg && lastCfg.archon === true, 'combat cfg carries the archon flag');
  // sacrifice is not a cfg field: game.js consumes opts.sacrifice in its own
  // win handler -- the hermitGone/cube checks below prove that path.
  ok(Array.isArray(lastCfg.guests) && lastCfg.guests[0] === 'hermit',
     'hermit guests the seam fight');
  // The stub auto-wins, so the whole beat resolves:
  ok(s.hermitGone === true && s.modal === 'cube',
     'winning the seam fight plays sacrifice -> cube');
  s.modal = null;
  // one-shot: a second call must stay quiet
  lastCfg = undefined;
  T.debugSacrifice();
  ok(lastCfg === undefined, 'seam is one-shot per run');
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL PASS');
process.exit(failed ? 1 : 0);
