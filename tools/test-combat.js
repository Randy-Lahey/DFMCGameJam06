// Round-order test: PMD attack-on-arrival. Run: node tools/test-combat.js
//
// The round resolves: party steps (at input) -> foe steps -> party attacks ->
// foe strike DECISION RE-MADE on the finished board. The two properties that
// pins down, each asserted here from both sides:
//   1. A foe that closes to contact this round STRIKES this round -- no free
//      turn spent standing politely adjacent. (The bug this file exists for.)
//   2. A foe the party kills in the attack phase deals nothing -- winning
//      initiative is the reward for burst, exactly as in the genre.
// Plus: the indicator built before the round must agree with what resolves --
// a step that will land in contact previews as a strike, a plain step does
// not -- because the whole point of the one-brain refactor was that the
// telegraph and the resolution cannot drift apart.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
// Same Proxy stub as tools/test-party.js. Duplicated, not shared: each test
// file stays runnable as `node tools/<file>` with zero imports to break.
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

// setTimeout drives the phase queue; make phases run synchronously so a
// resolveRound() call returns with the round fully settled.
global.setTimeout = fn => { fn(); return 0; };
global.clearTimeout = () => {};

// ---------------------------------------------------------------- load
const root = path.join(__dirname, '..');
for (const f of ['data/floor01.js', 'data/balance.js', 'data/fxsheets.js',
                 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

const { state, resolveRound, lead } = window.__DW;
const B = window.BALANCE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };

state.modal = null;
const M = state.circle.members;
const L = lead();
const hpAll = () => M.reduce((s, m) => s + m.hp, 0);

// One foe on the board, fangs out; the rest gone. def 0 so any atk lands.
const foe = state.foes[0];
state.foes.forEach(f => { f.hp = 0; });
const arm = (c, r) => Object.assign(foe, {
  hp: foe.vitae, c, r, awake: true, ai: 'flank', atk: Math.max(foe.atk, 3) });
M.forEach(m => { m.hp = m.vitae; m.def = 99; });   // park the daemons out of reach
L.def = 0;
// Isolate the leader: daemons stay put, so plant the foe off their side.

// ------------------------------------------------- 1. adjacent foe strikes
arm(L.c, L.r - 1);
let before = hpAll();
resolveRound({ kind: 'hold' });
ok(hpAll() < before, 'adjacent foe strikes a holding party');

// ---------------------------------------- 2. attack-on-arrival (the fix)
// Foe two tiles out: its frozen intent is a STEP. It must close AND strike
// inside this one round -- the re-decision on the finished board.
arm(L.c, L.r - 2);
before = hpAll();
resolveRound({ kind: 'hold' });
ok(Math.abs(foe.c - L.c) + Math.abs(foe.r - L.r) === 1,
   'foe two tiles out closes to contact in one round');
ok(hpAll() < before, 'foe that closed to contact strikes the SAME round');

// ------------------------------------------------- 3. kills cancel strikes
// Same setup, but the party's queued attack drops the foe in the attack
// phase, which runs before the strike decision: no damage comes back.
arm(L.c, L.r - 1);
foe.hp = 1;
const opName = Object.keys(B.operations).find(n =>
  B.operations[n].targets === 'foe' && !B.operations[n].vitaeCost);
const op = { name: opName, ...B.operations[opName], dmg: 99, pn: 0 };
state.queued = [{ member: L, op, targetId: foe.id }];
before = hpAll();
resolveRound(null);
ok(foe.hp <= 0, 'queued attack kills the foe in the attack phase');
ok(hpAll() === before, 'a foe killed before the strike phase deals NOTHING');

// ------------------------------------------------- 4. dead stay dead
before = hpAll();
resolveRound({ kind: 'hold' });
ok(hpAll() === before, 'a dead foe stays silent on later rounds');

// ------------------------------------------------- 5. preview agrees
// The indicator's brain call, pre-round, must label a landing step as a
// strike and a distant step as movement -- no drift from what resolves.
const { previewIntent } = window.__DW;
if (!previewIntent) {
  console.log('(previewIntent not exported; skipping indicator assertions)');
} else {
  arm(L.c, L.r - 2);
  let it = previewIntent(foe, new Set());
  ok(it && it.kind === 'step' && it.strikes === true,
     'a step landing in contact previews as CLOSING TO STRIKE');
  ok(it.targets && it.targets.includes(L), 'the strike preview rings the tile it lands beside');
  arm(L.c, L.r - 6);
  it = previewIntent(foe, new Set());
  ok(it && it.kind === 'step' && !it.strikes,
     'a step that cannot reach contact previews as plain movement');
}

console.log(`test-combat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
