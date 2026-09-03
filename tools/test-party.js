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
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/face.js', 'data/town.js', 'data/balance.js',
                 'data/fxsheets.js', 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

const { state, moveInput, lead, memberAt, foeTarget, validTargets, stepsMax, applyOp,
        allOps, answerExit, loadFloor, recruit, chooseStarter } = window.__DW;
const F = window.FLOOR01, F2 = window.FLOOR02, B = window.BALANCE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };
const pos = m => m.c + ',' + m.r;

// Keep foes quiet for movement assertions and clear the intro modal, which
// otherwise blocks all input in headless mode.
state.modal = null;
state.foes.forEach(f => { f.awake = false; });

// ------------------------------------------------------------- solo start
ok(state.circle.members.length === 1 && state.roster.length === 1,
   'the run starts solo: OPERATOR only');
ok(lead().name === 'OPERATOR' &&
   lead().c === F.spawns[0].c && lead().r === F.spawns[0].r,
   'solo OPERATOR stands on spawn 0');
ok(allOps().length === 1 && allOps()[0].op.name === 'PERCVSSIO',
   'solo op set is PERCVSSIO alone -- no bank ops before a daemon joins');

// ------------------------------------------------------------- hermit flow
// Clear the floor, take the stairs: the solo descent drops straight through
// now -- the Hermit is an NPC standing in FLOOR 02's ENTRY room. Bumping
// him opens the bargain; the choice recruits IN PLACE (no floor change).
state.foes.forEach(f => { f.hp = 0; });
state.modal = 'exit';
answerExit(true);
ok(state.modal === null && window.__DW.F === F2, 'solo descent drops straight to floor 02, no gate');
ok(state.circle.members.length === 1, 'still solo on arrival: the bargain is in the room, not the stairs');

// Walk the bump: teleport the leader next to the Hermit and step into him.
const H = F2.props.find(p => p.kind === 'hermit');
ok(!!H, 'floor 02 carries the Hermit prop');
lead().c = H.c; lead().r = H.r - 1;
moveInput(0, 1);
ok(state.modal === 'hermit', 'bumping the Hermit opens the bargain');
ok(lead().c === H.c && lead().r === H.r - 1, 'the bump does not enter his tile');
chooseStarter('CALX');
ok(state.modal === null && window.__DW.F === F2, 'the choice closes the modal and stays on floor 02');
ok(state.roster.join(',') === 'OPERATOR,CALX', 'CALX joins the roster behind the OPERATOR');
ok(state.circle.members.length === 2, 'CALX takes a body next to the circle');
moveInput(0, 1);
ok(state.modal === null && lead().c === H.c && lead().r === H.r,
   'the Hermit is gone after the bargain: his tile opens and the way east is clear');

// Reset to spawns so the seating assertion below keeps its meaning.
loadFloor(F2);
ok(state.circle.members.length === 2 &&
   state.circle.members.every((m, i) => m.c === F2.spawns[i].c && m.r === F2.spawns[i].r),
   'both members seat on FLOOR 02 spawns in command order');
ok(state.foes.length === F2.foes.length && state.foes.every(f => f.hp > 0 && !f.awake),
   'floor 02 foes stand fresh and asleep');
ok(state.seen.size > 0 && state.seen.size < F2.tiles.length &&
   state.drops.length === 0 && state.wards.length === 0,
   'fog resets to fresh spawn sight on descent (not empty, not the old floor)');

// ------------------------------------------------------------- full roster
// Recruit the rest and reload floor 01: every legacy assertion below runs
// against the same 4-member board it was written for.
recruit('CINIS');
recruit('GVTTA');
loadFloor(F);
state.modal = null;
state.foes.forEach(f => { f.awake = false; });
const M = state.circle.members;

// ------------------------------------------------------------- spawn
const N = Object.keys(B.party).length;
ok(M.length === N && N === 4, 'four members after recruits (OPERATOR + three daemons)');
ok(M.every((m, i) => m.c === F.spawns[i].c && m.r === F.spawns[i].r),
   'members spawn on their own tiles in command order');
ok(new Set(M.map(pos)).size === N, 'no two members share a tile at spawn');
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
ok(pos(M[3]) === was[2], 'follower 3 took follower 2\'s vacated tile');
ok(new Set(M.map(pos)).size === N, 'trail never stacks members');
// One more step: the chain snakes cleanly along.
was = M.map(pos);
moveInput(0, -1);
ok(pos(M[0]) === `${S[0].c},${S[0].r - 2}` && pos(M[1]) === was[0]
   && pos(M[2]) === was[1] && pos(M[3]) === was[2],
   'chain snakes tile-by-tile behind the leader');

// ------------------------------------------------------------- swap
// Stepping back INTO a follower trades tiles -- and only those two.
was = M.map(pos);
moveInput(0, 1);
ok(pos(M[0]) === was[1] && pos(M[1]) === was[0], 'stepping into a follower swaps');
ok(pos(M[2]) === was[2], 'the other follower does not move on a swap');
ok(new Set(M.map(pos)).size === N, 'swap never stacks members');
moveInput(0, -1);   // swap back: leader on point again for the sections below
ok(pos(M[0]) === was[0] && pos(M[1]) === was[1], 'swapping back restores the chain');

// ------------------------------------------------------------- gvtta
// The quicksilver aura: +1 step while GVTTA stands, gone when it falls.
const gv = M.find(m => m.name === 'GVTTA');
ok(gv && gv.type === 'MERCVRIVS', 'GVTTA is seated in the party as MERCVRIVS');
ok(stepsMax() === B.combat.stepsPerRound + 1, 'aura grants +1 step while GVTTA stands');
const gvHp = gv.hp; gv.hp = 0;
ok(stepsMax() === B.combat.stepsPerRound, 'aura dies with GVTTA');
gv.hp = gvHp;

// PERMVTO: cast from the trail it trades tile AND chain slot with the point,
// so the chain keeps the same tiles and only the two identities exchange.
const permvto = { name: 'PERMVTO', ...B.operations.PERMVTO, fluxes: [] };
let tiles = M.map(pos);
const oldLead = lead();
applyOp({ member: gv, op: permvto });
ok(lead() === gv, 'PERMVTO from the trail puts GVTTA on point');
ok(M.map(pos).join('|') === tiles.join('|'),
   'swap preserves the chain tiles exactly (identities exchange, tiles do not)');
ok(new Set(M.map(pos)).size === N, 'PERMVTO never stacks members');
// Cast again from point: quicksilver runs to where it isn't -- the rear.
applyOp({ member: gv, op: permvto });
ok(lead() === oldLead, 'PERMVTO from point trades with the rear, restoring the old leader');
ok(M[M.length - 1] === gv, 'GVTTA now holds the rear slot');
ok(M.map(pos).join('|') === tiles.join('|'), 'chain tiles still unchanged after the return swap');
state.cd = {};                                 // clear PERMVTO cooldown for later sections

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

// ------------------------------------------------- aim forgiveness
// A tap one tile off a valid target still fires (thumbs, gliding sprites);
// a tap between TWO valid targets stays ambiguous and refuses.
const { chooseOp, clickTile, allOps: ops2, recomputeFOV } = window.__DW;
state.foes.forEach(f => { f.hp = 0; });
M.forEach(m => { m.hp = m.vitae; });
state.acted = []; state.queued = []; state.mode = 'move'; state.cd = {};
const cinis = M.find(m => m.name === 'CINIS');
// Foes must stand on REAL floor to be in sight; derive adjacent walkable
// tiles from F.tiles instead of assuming cinis+1 is not a wall.
const ring = F.tiles.map(([c, r]) => ({ c, r }))
  .filter(t => Math.max(Math.abs(t.c - cinis.c), Math.abs(t.r - cinis.r)) === 1
            && !memberAt(t.c, t.r));
ok(ring.length >= 2, 'geometry: two free floor tiles ring CINIS');
const fA = state.foes[0];
fA.hp = fA.vitae; fA.awake = true; fA.c = ring[0].c; fA.r = ring[0].r;
recomputeFOV();   // headless never draws; sight must be recomputed by hand
chooseOp(ops2().findIndex(e => e.op.name === 'IMMOLATIO'));
ok(!!state.pending, 'IMMOLATIO aims with a valid adjacent target');
// Tap one tile past the foe: off-target, no other foe near.
clickTile(fA.c * 2 - cinis.c, fA.r * 2 - cinis.r);
ok(state.queued.length === 1 && state.queued[0].targetId === fA.id,
   'near-miss one tile off a lone valid target snaps to it');
state.queued = []; state.acted = [];
const fB = state.foes[1];
fB.hp = fB.vitae; fB.awake = true; fB.c = ring[1].c; fB.r = ring[1].r;
recomputeFOV();
chooseOp(ops2().findIndex(e => e.op.name === 'IMMOLATIO'));
clickTile(cinis.c, cinis.r);   // CINIS's own tile: cheb 1 from BOTH foes
ok(state.queued.length === 0 && !!state.pending,
   'a miss ringed by TWO valid targets stays ambiguous: no guess, keep aiming');
state.pending = null; state.aiming = null; state.queued = []; state.acted = [];
state.foes.forEach(f => { f.hp = 0; });

console.log(`test-party: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
