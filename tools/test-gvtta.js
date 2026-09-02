// GVTTA in the chamber. Run: node tools/test-gvtta.js
//
// The quicksilver daemon's two banks exercise two new engine seams:
//   PERMVTO  -> kind:"swap": trade places with a commanded ally (never a foe,
//               never a guest, never self), 4 pneuma, CD 3.
//   IMPVLSVS -> strike with push:1: shove the target one tile along the
//               attack vector; a blocked shove (wall, edge, or unit) stuns
//               the target -- and a blocking UNIT is stunned too. A stunned
//               unit's next turn is skipped entirely (0 cycles, no casts).
// Plus roster wiring: GVTTA enters via cfg.party as id "gvtta" with the
// balance.js statline, and is the fastest unit on the board.
'use strict';
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------- DOM stub
function stubEl() {
  const t = {
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    dataset: {}, textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  };
  return new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector') return () => stubEl();
      if (k === 'addEventListener' || k === 'removeEventListener' ||
          k === 'setAttribute' || k === 'removeAttribute' ||
          k === 'focus' || k === 'blur' || k === 'remove') return () => {};
      if (k === 'appendChild' || k === 'removeChild' || k === 'insertBefore' ||
          k === 'closest' || k === 'cloneNode' || k === 'createElementNS' ||
          k === 'createElement') return () => stubEl();
      if (k === 'getBoundingClientRect') return () => ({ width: 800, height: 600, left: 0, top: 0 });
      if (k === 'getBBox') return () => ({ x: 0, y: 0, width: 10, height: 10 });
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'children' || k === 'childNodes') return [];
      return stubEl();
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}
const elCache = {};
global.document = new Proxy({}, {
  get(o, k) {
    if (k === 'getElementById') return id => (elCache[id] = elCache[id] || stubEl());
    if (k === 'createElementNS' || k === 'createElement') return () => stubEl();
    if (k === 'body' || k === 'documentElement' || k === 'head') return stubEl();
    if (k === 'querySelector') return () => stubEl();
    if (k === 'querySelectorAll') return () => [];
    if (k === 'addEventListener' || k === 'removeEventListener') return () => {};
    return stubEl();
  },
});
global.window = global;
global.addEventListener = () => {};
global.requestAnimationFrame = () => 0;
global.setTimeout = fn => { fn(); return 0; };   // whole script runs synchronously
global.clearTimeout = () => {};
global.innerWidth = 1280; global.innerHeight = 800;

new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'icons.js'), 'utf8'))();
new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'combat.js'), 'utf8'))();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('FAIL: ' + m); } };

// One quiet fight: OPERATOR + GVTTA vs one TESTA. AI turns fire synchronously
// through the stubbed setTimeout, so we seat everyone and drive by hand.
window.DW_COMBAT.start({
  party: [{ id: 'op', frac: 1 }, { id: 'gvtta', frac: 1 }],
  foes: [{ tpl: 't', frac: 1 }],
  onEnd() {},
});
const T = window.__DWC_TEST;
const s = T.state;
const byId = id => s.units.find(u => u.id === id);
const g = byId('gvtta'), op = byId('op'), foe = byId('e1');

console.log('-- roster: GVTTA crosses the seam with the balance.js statline');
ok(!!g, 'gvtta fields via cfg.party');
ok(g.maxVitae === 16 && g.atk === 5 && g.def === 0 && g.maxPneuma === 12,
   'statline matches balance.js (16/5/0, 12 pneuma)');
ok(g.speed === 15, 'GVTTA is speed 15');
ok(s.units.every(u => u === g || u.speed < g.speed), 'fastest unit on the board');
ok(g.banks[0] === 'IMPVLSVS' && g.banks[1] === 'PERMVTO', 'IMPVLSVS is hotkey 1, PERMVTO hotkey 2');

const PERM = T.bankFor(g, 'PERMVTO'), IMP = T.bankFor(g, 'IMPVLSVS');
ok(PERM.kind === 'swap' && PERM.cost === 4 && PERM.cd === 3 && PERM.max === 5 && PERM.los === false,
   'PERMVTO: swap, 4 pneuma, CD 3, range 1-5, no LoS');
ok(IMP.kind === 'strike' && IMP.push === 1 && IMP.cost === 3 && IMP.cd === 2,
   'IMPVLSVS: strike, push 1, 3 pneuma, CD 2');

// hand-seat: op (0,0), gvtta (0,3), foe (5,5) -- clear lanes, no obstacles
op.x = 0; op.y = 0; g.x = 0; g.y = 3; foe.x = 5; foe.y = 5;
s.toPlace.length = 0; s.phase = 'battle'; s.round = 1;
g.pneuma = g.maxPneuma; g.cds = {}; g.cast = {};

console.log('-- PERMVTO: swap trades places, pays 4, arms CD 3');
T.castAt(g, PERM, op.x, op.y);
ok(g.x === 0 && g.y === 0 && op.x === 0 && op.y === 3, 'positions exchanged');
ok(g.pneuma === g.maxPneuma - 4, 'cost 4 paid');
ok(g.cds.PERMVTO === 3, 'cooldown armed at 3');

console.log('-- PERMVTO: tileClick rejects foes, self, and guests');
// make gvtta the current unit so tileClick routes through her
s.order = [g, op, foe]; s.turn = 0; s.busy = false;
g.cds = {}; g.cast = {}; g.pneuma = g.maxPneuma;
s.sel = 'PERMVTO';
const before = { gx: g.x, gy: g.y, fx: foe.x, fy: foe.y };
g.x = 4; g.y = 5; // adjacent to foe so range is not the reason it fails
T.tileClick(foe.x, foe.y);
ok(g.x === 4 && g.y === 5 && foe.x === before.fx && foe.y === before.fy,
   'swap onto a foe does nothing');
ok(s.sel === 'PERMVTO', 'selection survives the rejected click');
T.tileClick(g.x, g.y);
ok(g.x === 4 && g.y === 5, 'swap onto self does nothing');
s.sel = null;

console.log('-- PERMVTO: guests ARE swappable (the Hermit rides along)');
const asGuest = s.units.find(u => u.id === 'op'); // borrow: mark op guest briefly
asGuest.guest = true;
const gpos = { x: g.x, y: g.y }, hpos = { x: asGuest.x, y: asGuest.y };
T.castAt(g, T.bankFor(g, 'PERMVTO'), asGuest.x, asGuest.y);
ok(g.x === hpos.x && g.y === hpos.y && asGuest.x === gpos.x && asGuest.y === gpos.y,
   'swap with a guest-flagged ally trades places');
asGuest.guest = false;
g.cds = {}; g.cast = {}; g.pneuma = g.maxPneuma;

console.log('-- IMPVLSVS: clean shove moves the target one tile');
g.x = 4; g.y = 5; foe.x = 5; foe.y = 5; // attack vector +x; (6,5) is free
g.pneuma = g.maxPneuma; g.cds = {}; g.cast = {};
const hpBefore = foe.vitae;
T.castAt(g, IMP, foe.x, foe.y);
ok(foe.vitae < hpBefore, 'damage landed');
ok(foe.x === 6 && foe.y === 5, 'target pushed +1 along the attack vector');
ok(!foe.stun, 'clean shove does not stun');
ok(g.cds.IMPVLSVS === 2, 'IMPVLSVS cooldown armed at 2');

console.log('-- IMPVLSVS: shove into the board edge stuns the target');
g.x = 1; g.y = 0; foe.x = 0; foe.y = 0; foe.stun = 0; foe.vitae = foe.maxVitae;
g.pneuma = g.maxPneuma; g.cds = {}; g.cast = {};
T.castAt(g, IMP, foe.x, foe.y); // vector -x; (-1,0) is off-board
ok(foe.x === 0 && foe.y === 0, 'blocked target does not move');
ok(foe.stun === 1, 'blocked shove stuns the target');

console.log('-- IMPVLSVS: shove into a unit stuns both');
// second fight to get two foes on the board
window.DW_COMBAT.start({
  party: [{ id: 'op', frac: 1 }, { id: 'gvtta', frac: 1 }],
  foes: [{ tpl: 't', frac: 1 }, { tpl: 't', frac: 1 }],
  onEnd() {},
});
const s2 = T.state;
const by2 = id => s2.units.find(u => u.id === id);
const g2 = by2('gvtta'), t1 = by2('e1'), t2 = by2('e2'), op2 = by2('op');
op2.x = 0; op2.y = 0; g2.x = 3; g2.y = 3; t1.x = 4; t1.y = 3; t2.x = 5; t2.y = 3;
s2.toPlace.length = 0; s2.phase = 'battle'; s2.round = 1;
g2.pneuma = g2.maxPneuma; g2.cds = {}; g2.cast = {};
const IMP2 = T.bankFor(g2, 'IMPVLSVS');
T.castAt(g2, IMP2, t1.x, t1.y); // vector +x; (5,3) is occupied by t2
ok(t1.x === 4 && t1.y === 3, 'blocked target holds its tile');
ok(t1.stun === 1 && t2.stun === 1, 'target AND blocking unit stunned');

console.log('-- stun: the stunned unit\'s turn is skipped entirely');
// force t1 to be current; its turn should burn without an AI act
s2.order = s2.units.filter(u => u.alive).sort((a, b) => b.speed - a.speed);
const t1idx = s2.order.indexOf(t1);
s2.turn = t1idx; s2.aiActs = [];
const opHp = op2.vitae, gHp = g2.vitae;
// startTurn is not on the seam; endTurn from the previous slot reaches it.
// Simpler: rewind one slot and let endTurn advance into t1.
if (t1idx === 0) { s2.turn = s2.order.length - 1; s2.round--; } else { s2.turn = t1idx - 1; }
// avoid the previous unit acting: mark it done by calling endTurn directly
T.endTurn();
ok(t1.stun === 0, 'stun ticked down on the skipped turn');
ok((s2.aiActs || []).every(a => a.id !== 'e1'), 'stunned foe took no AI action');
ok(op2.vitae === opHp && g2.vitae === gHp, 'no damage dealt during the skipped turn');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
