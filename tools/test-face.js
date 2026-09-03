// NIGREDO face loop test. Run: node tools/test-face.js
//
// The face is four tiles: three open from the first day, the Archon's
// THRONVS sealed until all three are cleared. Asserted here: the unlock
// rule, the affix reroll (four distinct labels from the pool), and -- as
// the later commits land -- the town/face-modal handoff, extract, the
// third-clear heal, the Archon seal, and the wipe loop.
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
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/face.js', 'data/town.js',
                 'data/vestibvlvm.js', 'data/cinerevm.js', 'data/pvtrefactorivm.js', 'data/thronvs.js',
                 'data/balance.js', 'data/fxsheets.js', 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg);
  if (!cond) failed++;
}

const T = window.__DW;
const s = T.state;
const FACE = window.FACE_NIGREDO;
s.modal = null; // boot opens the controls overlay; clear it as a player would

// ============================================================ unlock rule
console.log('-- unlock rule');
{
  ok(s.tile === null, 'the run starts off the face (tile null)');
  ok(Array.isArray(s.face.cleared) && s.face.cleared.length === 0 &&
     s.face.sealed === false, 'face state starts empty and unsealed');
  const plain = FACE.tiles.filter(t => !t.archon).map(t => t.id);
  ok(plain.length === 3 && plain.every(T.tileUnlocked), 'three ordinary tiles open from the start');
  ok(T.tileUnlocked('THRONVS') === false, 'THRONVS sealed with nothing cleared');
  s.face.cleared = plain.slice(0, 2);
  ok(T.tileUnlocked('THRONVS') === false, 'THRONVS still sealed with two cleared');
  s.face.cleared = plain.slice();
  ok(T.tileUnlocked('THRONVS') === true, 'THRONVS opens once all three are cleared');
  ok(T.tileUnlocked('NOWHERE') === false, 'an unknown id is never unlocked');
  s.face.cleared = [];
}

// ============================================================ affix reroll
console.log('-- rerollAffixes: four distinct labels from the pool');
{
  for (let i = 0; i < 50; i++) {
    T.rerollAffixes();
    const labels = FACE.tiles.map(t => s.face.affix[t.id]);
    const inPool = labels.every(l => FACE.affixPool.includes(l));
    const distinct = new Set(labels).size === 4;
    if (!inPool || !distinct || labels.length !== 4) {
      ok(false, `reroll ${i}: ${labels.join(' / ')}`); break;
    }
    if (i === 49) ok(true, '50 rerolls: every tile labelled, all from the pool, no two alike');
  }
}

// ============================================================ town + face
console.log('-- THE REFVGE, THE CVBE, the face modal');
{
  T.loadTown();
  ok(T.F.name === 'THE REFVGE' && s.tile === null, 'loadTown lands in THE REFVGE with tile null');
  ok(T.F.foes.length === 0 && s.foes.length === 0, 'town has no foes');
  const cube = T.F.props.find(p => p.kind === 'cube');
  ok(!!cube && cube.label === 'THE CVBE', 'town has THE CVBE');
  // Stand beside the cube and step into it: bump-to-talk.
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dc, dr]) => ({ c: cube.c + dc, r: cube.r + dr }))
    .find(t => T.F.tiles.some(([c, r]) => c === t.c && r === t.r));
  const L = T.lead();
  L.c = nb.c; L.r = nb.r; s.stepsUsed = 0; s.mode = 'move'; s.modal = null;
  T.moveInput(cube.c - nb.c, cube.r - nb.r);
  ok(s.modal === 'face', 'bumping THE CVBE opens the face');
  ok(L.c === nb.c && L.r === nb.r && s.stepsUsed === 0,
     'the bump enters no tile and spends no step');
  T.closeFace();
  ok(s.modal === null, 'closeFace (ESC) shuts the face');
  const it = T.interactable();
  ok(it && it.prop.kind === 'cube' && /ENTER THE CVBE/.test(it.text),
     'the E tag offers THE CVBE from beside it');
  T.openAct();
  ok(s.modal === 'face', 'E opens the face from beside the cube');
  T.chooseTile('THRONVS');
  ok(s.modal === 'face' && s.tile === null && T.F.name === 'THE REFVGE',
     'selecting sealed THRONVS with <3 cleared is a no-op');
  const before = JSON.stringify(s.face.affix);
  T.chooseTile('VESTIBVLVM');
  ok(s.modal === null && s.tile === 'VESTIBVLVM' && T.F === window.FLOOR_VESTIBVLVM,
     'selecting VESTIBVLVM loads its floor and sets state.tile');
  ok(JSON.stringify(s.face.affix) === before, 'entering a tile does not reroll the affixes');
  ok(s.foes.length === T.F.foes.length && s.foes.every(f => f.hp > 0), 'tile foes stand fresh');
  T.loadTown();
  ok(s.tile === null && T.F.name === 'THE REFVGE', 'loadTown from a tile returns home');
  ok(JSON.stringify(s.face.affix) === before, 'a return to town keeps the day\'s affixes');
}

// ============================================================ extract
// Enter a tile from town, kill everything, walk to the EXTRACT, answer yes.
const enter = id => { T.openFace(); T.chooseTile(id); s.modal = null; };
const killAll = () => { s.foes.forEach(f => { f.hp = 0; }); };
const standOn = p => { const L = T.lead(); L.c = p.c; L.r = p.r; s.mode = 'move'; s.stepsUsed = 0; };
console.log('-- extract: cleared tile banked, no heal, back to town');
{
  T.recruit('CALX');
  enter('VESTIBVLVM');
  const ext = T.F.props.find(p => p.kind === 'stairs');
  ok(ext && ext.label === 'EXTRACT', 'the tile carries an EXTRACT prop');
  standOn(ext);
  let it = T.interactable();
  ok(it && it.locked && /EXTRACT SEALED/.test(it.text), 'EXTRACT is sealed while foes stand (the Cube is no key here)');
  // Wound the party so a heal would show, then clear the tile.
  const op = T.lead(), calx = s.circle.members.find(m => m.name === 'CALX');
  op.hp = 9; calx.hp = 11;
  killAll();
  T.resolveRound(null);
  ok(s.over === 'CLEARED', 'all foes dead -> tile CLEARED (not terminal)');
  ok(s.log[0] && /EXTRACT VNSEALS/.test(s.log[0].text), 'the cleared line names the EXTRACT');
  it = T.interactable();
  ok(it && !it.locked && /EXTRACT TO THE REFVGE/.test(it.text), 'EXTRACT unseals once the tile is clear');
  T.openAct();
  ok(s.modal === 'exit', 'E on the EXTRACT opens the exit dialog');
  T.answerExit(false);
  ok(s.modal === null && s.tile === 'VESTIBVLVM' && T.F.name === 'VESTIBVLVM',
     'NO keeps the circle on the tile (free to loot)');
  s.modal = 'exit';
  T.answerExit(true);
  ok(s.face.cleared.join() === 'VESTIBVLVM', 'YES banks the tile as cleared');
  ok(T.F.name === 'THE REFVGE' && s.tile === null, 'extract returns to THE REFVGE');
  const op2 = T.lead(), calx2 = s.circle.members.find(m => m.name === 'CALX');
  ok(op2.hp === 9 && calx2.hp === 11, 'no heal on extract: VITAE carried as-is');
  ok(s.log.some(l => /VESTIBVLVM EXTRACTED/.test(l.text)), 'EXTRACTED line logged');
  T.openFace();
  ok(s.modal === 'face', 'the face reopens in town');
  T.chooseTile('VESTIBVLVM');
  ok(s.modal === 'face' && T.F.name === 'THE REFVGE', 'a CLEARED tile is inert');
  T.closeFace();
}

console.log('-- third clear: the Cube opens, full heal, THRONVS unseals');
{
  enter('CINEREVM');
  ok(s.tile === 'CINEREVM' && T.F.name === 'CINEREVM', 'second tile loads');
  killAll(); T.resolveRound(null);
  T.extract();
  ok(s.face.cleared.length === 2 && T.F.name === 'THE REFVGE', 'two cleared, home again');
  ok(T.tileUnlocked('THRONVS') === false, 'THRONVS still sealed at two');
  ok(T.lead().hp === 9, 'still no heal at two');
  enter('PVTREFACTORIVM');
  // Sever CALX on the way: the third clear must revive him at full.
  const calx = s.circle.members.find(m => m.name === 'CALX');
  calx.hp = 0;
  killAll(); T.resolveRound(null);
  T.extract();
  ok(s.face.cleared.length === 3, 'three cleared');
  ok(s.circle.members.every(m => m.hp === m.vitae), 'every member at max VITAE, severed revived');
  ok(s.log.some(l => /THE CVBE OPENS\. VITAE RESTORED\. THRONVS VNSEALS\./.test(l.text)),
     'the Cube-opens line logged');
  ok(T.tileUnlocked('THRONVS') === true, 'THRONVS unsealed');
  T.extract();
  ok(s.face.cleared.length === 3, 'extract off the face is a no-op (tile null)');
}

console.log('-- THRONVS: the Archon down seals the face');
{
  let lastCfg = null;
  window.DW_COMBAT = {
    start(c) { lastCfg = c; c.onEnd({ won: true, party: c.party.map(p => ({ id: p.id, frac: 0.5 })), foes: [] }); },
    isActive() { return false; },
  };
  enter('THRONVS');
  ok(s.tile === 'THRONVS' && T.F.name === 'THRONVS', 'THRONVS loads once unsealed');
  ok(s.foes.length === 1 && s.foes[0].kind === 'ARCHON', 'one ARCHON foe stands on the tile');
  ok(!T.F.props.some(p => p.kind === 'stairs'), 'no EXTRACT on THRONVS: the fight is the way off');
  // Bump the Archon: contact commits to the chamber, the stub wins it.
  const a = s.foes[0], L = T.lead();
  L.c = a.c - 1; L.r = a.r; s.stepsUsed = 0; s.mode = 'move';
  T.moveInput(1, 0);
  ok(lastCfg && lastCfg.foes.some(f => f.tpl === 'a'), 'the Archon crosses the seam as tpl a');
  ok(lastCfg.archon === undefined, 'a real fight, not the scripted apparition');
  ok(a.hp === 0, 'the chamber win severs the Archon on the crawl');
  ok(s.face.sealed === true && s.over === 'WIN', 'face sealed, run state WIN');
  ok(s.log.some(l => /NIGREDO SEALED/.test(l.text)), 'NIGREDO SEALED logged');
  // RETVRN walks home without a reset.
  T.loadTown();
  ok(T.F.name === 'THE REFVGE' && s.over === null && s.face.sealed === true &&
     s.face.cleared.length === 3, 'RETVRN keeps the sealed face');
}

// ============================================================ wipe
console.log('-- wipe: two cleared, OPERATOR severed, RETVRN resets the day');
{
  const plain = FACE.tiles.filter(t => !t.archon).map(t => t.id);
  s.hasCube = true;                     // a real run reaches town through takeCube()
  s.face.cleared = plain.slice(0, 2); s.face.sealed = false;
  s.bag.argent = 77; s.ampoules = 2;
  s.bag.items.push({ kind: 'FLUX', flux: 'VITRIOL', label: 'VITRIOL', sprite: 'flux', rarity: 'UNCOMMON' });
  const bagN = s.bag.items.length, rig = JSON.stringify(s.loadout);
  enter('PVTREFACTORIVM');
  const before = Object.assign({}, s.face.affix);
  T.lead().hp = 0;
  T.resolveRound(null);
  ok(s.over === 'SEVERED', 'OPERATOR at 0 -> SEVERED');
  T.wipe();
  ok(s.over === null && T.F.name === 'THE REFVGE' && s.tile === null, 'wipe returns to THE REFVGE');
  ok(s.face.cleared.length === 0 && s.face.sealed === false, 'all tile progress reset');
  ok(plain.every(T.tileUnlocked) && !T.tileUnlocked('THRONVS'), 'three OPEN again, THRONVS SEALED again');
  ok(s.circle.members.every(m => m.hp === m.vitae), 'every member back at max VITAE');
  ok(s.bag.argent === 77 && s.ampoules === 2 && s.bag.items.length === bagN &&
     JSON.stringify(s.loadout) === rig, 'ARGENT, ampoules, bag and loadout untouched');
  ok(s.log.some(l => /THE DAY ENDS\. THE FACE TVRNS\. NEW SEALS\./.test(l.text)), 'the day-ends line logged');
  // The reroll is random, so identical labels are possible (1 in 120):
  // reroll until something differs, bounded, and assert the labels can move.
  let differs = FACE.tiles.some(t => s.face.affix[t.id] !== before[t.id]);
  for (let i = 0; i < 40 && !differs; i++) {
    T.rerollAffixes();
    differs = FACE.tiles.some(t => s.face.affix[t.id] !== before[t.id]);
  }
  ok(differs, 'affix labels rerolled (at least one tile differs from before the wipe)');
  ok(new Set(FACE.tiles.map(t => s.face.affix[t.id])).size === 4, 'rerolled labels still distinct');
  // Tutorial wipe (no Cube) keeps today's behaviour: the run ends, no RETVRN.
  s.hasCube = false; s.over = 'SEVERED';
  T.wipe();
  ok(s.over === 'SEVERED', 'wipe is a no-op before the Cube: the tutorial run just ends');
  s.hasCube = true; s.over = null;
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL PASS');
process.exit(failed ? 1 : 0);
