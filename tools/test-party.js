// Headless smoke test for the leader+trail party model. Run: node tools/test-party.js
// Same DOM-stub pattern as tools/test-banks.js: load the real scripts in node,
// then exercise spawn placement, the trail cascade, leader/follower swap,
// nearest-member foe targeting, and per-caster operation range.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
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

// ---------------------------------------------------------------- load
const root = path.join(__dirname, '..');
for (const f of ['data/floor01.js', 'data/balance.js', 'data/fxsheets.js',
                 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

const { state, moveInput, lead, memberAt, foeTarget, validTargets } = window.__DW;
const F = window.FLOOR01, B = window.BALANCE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };
const M = state.circle.members;
const pos = m => m.c + ',' + m.r;

// Keep foes quiet for movement assertions and clear the intro modal, which
// otherwise blocks all input in headless mode.
state.modal = null;
state.foes.forEach(f => { f.awake = false; });

// ------------------------------------------------------------- spawn
ok(M.length === 3, 'three members');
ok(M.every((m, i) => m.c === F.spawns[i].c && m.r === F.spawns[i].r),
   'members spawn on their own tiles in command order');
ok(new Set(M.map(pos)).size === 3, 'no two members share a tile at spawn');
ok(lead() === M[0], 'OPERATOR leads');
ok(state.circle.c === undefined && state.circle.r === undefined,
   'circle.c/r is gone -- stale reads cannot silently succeed');

// ------------------------------------------------------------- trail
// Coordinates are DERIVED from F.spawns, never hardcoded: re-carving the floor
// must not fail this file. The only geometric assumption is stated as an
// assertion below, so a bad spawn pocket reports itself instead of cascading.
const S = F.spawns;
const floorAt = (c, r) => F.tiles.some(t => t[0] === c && t[1] === r);
ok(floorAt(S[0].c, S[0].r - 1) && floorAt(S[0].c, S[0].r - 2),
   'spawn has two free tiles north to walk into');

// The OPERATOR spawns on point with both daemons behind, so the first move
// is a clean cascade, not a swap: each member takes the tile the one ahead
// just vacated.
let was = M.map(pos);
moveInput(0, -1);
ok(pos(M[0]) === `${S[0].c},${S[0].r - 1}`, 'leader stepped onto free floor');
ok(pos(M[1]) === was[0], 'follower 1 took the vacated tile');
ok(pos(M[2]) === was[1], 'follower 2 took follower 1\'s vacated tile');
ok(new Set(M.map(pos)).size === 3, 'trail never stacks members');
// One more step: the chain snakes cleanly along.
was = M.map(pos);
moveInput(0, -1);
ok(pos(M[0]) === `${S[0].c},${S[0].r - 2}` && pos(M[1]) === was[0] && pos(M[2]) === was[1],
   'chain snakes tile-by-tile behind the leader');

// ------------------------------------------------------------- swap
// Stepping back INTO a follower trades tiles -- and only those two.
was = M.map(pos);
moveInput(0, 1);
ok(pos(M[0]) === was[1] && pos(M[1]) === was[0], 'stepping into a follower swaps');
ok(pos(M[2]) === was[2], 'the other follower does not move on a swap');
ok(new Set(M.map(pos)).size === 3, 'swap never stacks members');
moveInput(0, -1);   // swap back: leader on point again for the sections below
ok(pos(M[0]) === was[0] && pos(M[1]) === was[1], 'swapping back restores the chain');

// ------------------------------------------------------------- targeting
// Plant a foe next to CINIS's tile: it must hunt CINIS, not the leader.
const foe = state.foes[0];
const cin = M[2];
foe.c = cin.c + 1; foe.r = cin.r;
ok(foeTarget(foe) === cin, 'foes hunt the nearest living member');
cin.hp = 1;
ok(foeTarget(foe) === cin, 'nearest rule holds while CINIS is closest');
cin.hp = cin.vitae;

// dead members drop out of targeting and memberAt
cin.hp = 0;
ok(foeTarget(foe) !== cin, 'dead members are not hunted');
ok(!memberAt(cin.c, cin.r), 'dead members do not block tiles');
cin.hp = cin.vitae;

// ------------------------------------------------------------- range
// Range is per caster: a foe on real floor at exactly the leader's range,
// and further than that from a trailing member, must split validTargets.
const opName = Object.keys(B.operations).find(n => B.operations[n].targets === 'foe');
const op = { name: opName, ...B.operations[opName] };
state.foes.forEach(f => { f.hp = 0; });                  // clear the board
foe.hp = 1; foe.awake = true;                            // awake => visible
const L = lead(), far = M[2];
const cheb = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const spot = F.tiles
  .map(([c, r]) => ({ c, r }))
  .filter(t => cheb(t, L) === op.range && !memberAt(t.c, t.r))
  .sort((a, b) => cheb(b, far) - cheb(a, far))[0];
ok(!!spot, 'floor offers a tile at exactly the leader\'s range');
if (spot) {
  foe.c = spot.c; foe.r = spot.r;
  ok(validTargets(op, L).includes(foe), 'in range of the caster on point');
  if (cheb(foe, far) > op.range)
    ok(!validTargets(op, far).includes(foe), 'out of range of the trailing caster');
  else
    ok(true, '(geometry: trailing member also in range; skip)');
}

// ------------------------------------------------------------- action pool
// The circle shares combat.actionsPerRound actions per round: with three
// standing and two spent, the third can no longer act; refunding one (undo
// pops state.acted) reopens the gate.
const { canAct, actionsLeft } = window.__DW;
state.foes.forEach(f => { f.hp = 0; });
M.forEach(m => { m.hp = m.vitae; });
state.acted = [];
ok(actionsLeft() === B.combat.actionsPerRound,
   'fresh round: full shared pool');
ok(M.every(m => canAct(m)), 'everyone may act while the pool is open');
state.acted = [M[0].name, M[1].name];
ok(actionsLeft() === 0, 'two spent: pool empty');
ok(!canAct(M[2]), 'third member locked out by the SHARED pool, not by acting');
state.acted = [M[0].name];
ok(actionsLeft() === 1 && canAct(M[2]),
   'refunding an action reopens the gate');
ok(!canAct(M[0]), 'a spent member stays spent while the pool is open');
state.acted = [];

console.log(`test-party: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
