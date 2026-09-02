// Amperage strain test. Run: node tools/test-strain.js
//
// The ruled loop: a bank casting while seated draw exceeds its amp rating
// accrues strain = overdraw PER CAST; the cast that reaches burnAt (10)
// still resolves, THEN the bank burns offline for the rest of the fight.
// Asserted here end-to-end through the crawl seam shape (cfg.mods carrying
// amps + draw) into bankFor, castAt, canCast, and whyNot.
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

new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'combat.js'), 'utf8'))();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('FAIL: ' + m); } };

// Solo OPERATOR vs one TESTA. mods mimic the crawl seam: PERCVSSIO (3A)
// carrying a 4A load -- the FVLMINANS-in-a-COMMON-bank envelope.
window.DW_COMBAT.start({
  party: [{ id: 'op', frac: 1 }],
  foes: [{ tpl: 't', frac: 1 }],
  mods: { op: { PERCVSSIO: { amps: 3, draw: 4 } } },
  onEnd() {},
});
const T = window.__DWC_TEST;
const s = T.state;
const op = s.units.find(u => u.id === 'op');
const foe = s.units.find(u => u.id === 'e1');

console.log('-- seam: amps/draw ride cfg.mods onto the fought bank');
const BK = T.bankFor(op, 'PERCVSSIO');
ok(BK.amps === 3 && BK.draw === 4, 'bankFor merges amps 3 / draw 4 from mods');

// hand-seat adjacent; foe made unkillable so the volley runs its course
op.x = 0; op.y = 0; foe.x = 1; foe.y = 0;
s.toPlace.length = 0; s.phase = 'battle'; s.round = 1;
foe.def = 99; foe.maxVitae = 999; foe.vitae = 999;

console.log('-- strain: +1 per overdrawn cast, no burn below 10');
for (let i = 0; i < 9; i++) { op.pneuma = 10; op.cast = {}; T.castAt(op, BK, 1, 0); }
ok(op.strain.PERCVSSIO === 9, 'nine overdrawn casts = strain 9 (overdraw 1 each)');
ok(!op.burnt.PERCVSSIO, 'no burn below the threshold');
ok(T.canCast(Object.assign(op, { pneuma: 10, cast: {} }), 'PERCVSSIO'),
   'the bank still casts at strain 9');

console.log('-- burn: the 10th cast resolves, THEN the bank goes offline');
const hpBefore = foe.vitae;
op.pneuma = 10; op.cast = {};
T.castAt(op, BK, 1, 0);
ok(foe.vitae < hpBefore, 'the cast that reaches 10 still lands its damage');
ok(op.strain.PERCVSSIO === 10 && op.burnt.PERCVSSIO === 1, 'strain 10 -> bank BVRNT');
op.pneuma = 10; op.cast = {};
ok(!T.canCast(op, 'PERCVSSIO'), 'a burnt bank cannot cast for the rest of the fight');
ok(/BVRNT/.test(T.whyNot(op, 'PERCVSSIO') || ''), 'whyNot names the burn, not a generic off state');

console.log('-- sealed: a bank without a rating never strains (crawl/debug path)');
const raw = { name: 'PERCVSSIO', kind: 'strike', cost: 4, mult: 1, min: 1, max: 1, repeat: true };
op.strain = {}; op.burnt = {}; op.pneuma = 10; op.cast = {};
T.castAt(op, raw, 1, 0);
ok(!op.strain.PERCVSSIO, 'no amps on the bank -> no strain machinery');

console.log(`test-strain: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
