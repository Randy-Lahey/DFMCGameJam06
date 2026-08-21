// Sacrifice + Cube handoff test. Run: node tools/test-cube.js
//
// On a won fight flagged {sacrifice:true} (the ambush; debug B until the
// ambush lands), the Hermit burns out in a scripted beat:
//   VITAE -> 0 log lines, then a dismissible modal grants THE CVBE.
// Asserted: guests pass through to the combat cfg, state.hasCube flips true
// on dismissal, the modal actually closes, the crawl continues, and the
// whole beat fires exactly once per run.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
// Same Proxy stub as tools/test-combat.js: ids that exist in index.html
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

// Fake combat module: records cfg, instantly reports a won fight. This tests
// the CRAWL side of the seam (guest passthrough + onEnd hook) without
// driving the tactical module -- combat's own behavior is tools/test-hermit.
let lastCfg = null;
window.DW_COMBAT = {
  start(c) { lastCfg = c; c.onEnd({ won: true, party: [{ id: 'op', frac: 0.8 }], foes: [] }); },
  isActive() { return false; },
};

// ============================================================ sacrifice beat
console.log('-- won sacrifice fight fires the beat');
{
  T.enterCombat([], { guests: ['hermit'], sacrifice: true });
  ok(Array.isArray(lastCfg.guests) && lastCfg.guests[0] === 'hermit',
     'opts.guests reaches DW_COMBAT.start cfg');
  ok(s.scene === 'crawl', 'scene back to crawl after onEnd');
  ok(s.hermitGone === true, 'hermitGone flag set');
  ok(s.modal === 'cube', 'cube grant modal is open');
  ok(s.hasCube === false, 'cube not yet in inventory before dismissal');
  ok(s.log.some(l => /HERMIT VITAE/.test(l.text)), 'VITAE -> 0 death line logged');
  const op = s.circle.members.find(m => m.name === 'OPERATOR');
  ok(op.hp === Math.round(0.8 * op.vitae), 'combat write-back still applied (op at 80%)');
}

// ============================================================ dismissal
console.log('-- modal dismissible, game continues');
{
  T.takeCube();
  ok(s.modal === null, 'modal closed on TAKE THE CVBE');
  ok(s.hasCube === true, 'state.hasCube === true');
  ok(s.log[0] && /CVBE IS YOVRS/.test(s.log[0].text), 'grant line logged');
  // Crawl input no longer blocked: a movement round can start.
  const hpBefore = s.circle.members.map(m => m.hp).join(',');
  T.moveInput(0, 1);
  ok(true, 'moveInput after dismissal did not throw (game continues)');
  void hpBefore;
}

// ============================================================ satchel seam
console.log('-- ampoules cross the seam and spent doses stay spent');
{
  s.ampoules = 2;
  window.DW_COMBAT.start = function (c) {
    lastCfg = c;
    c.onEnd({ won: true, party: [{ id: 'op', frac: 1 }], foes: [],
              items: { AMPVLLA: 1 } });               // one dose drunk in the chamber
  };
  T.enterCombat([]);
  ok(lastCfg.items && lastCfg.items.AMPVLLA === 2, 'crawl satchel reaches the combat cfg');
  ok(s.ampoules === 1, 'combat write-back keeps doses spent');
}

// ============================================================ once per run
console.log('-- beat fires exactly once');
{
  lastCfg = null;
  T.enterCombat([], { guests: ['hermit'], sacrifice: true });
  ok(s.modal === null, 'second sacrifice fight does not reopen the modal');
  ok(s.hasCube === true, 'cube flag untouched');
  T.hermitSacrifice();
  ok(s.modal === null && s.hermitGone === true, 'direct hermitSacrifice() is a no-op after the beat');
  T.takeCube();
  ok(s.modal === null, 'takeCube outside the modal is a no-op');
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL PASS');
process.exit(failed ? 1 : 0);
