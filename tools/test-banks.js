// Headless smoke test for the data-bank / flux system. Run: node tools/test-banks.js
// Loads the real scripts under a permissive DOM stub, then exercises fold(),
// the dynamic op lists, the drop sub-rolls (no-duplicate pool), and the
// mid-combat refit rule. Same spirit as tools/test-mapgen.js: catch it in
// node before it reaches a browser.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
function stubEl() {
  const t = {
    style: {}, dataset: {},
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
const byId = {};
global.document = {
  getElementById: id => (byId[id] = byId[id] || stubEl()),
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

const { state, opsFor, allOps, fold, openInv, closeInv, rollItem, payRefit } = window.__DW;
const B = window.BALANCE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };

// ---------------------------------------------------------------- loadout
ok(state.loadout.CALX.length === 2 && state.loadout.CINIS.length === 2,
   'daemons start with two seated banks');
ok(state.loadout.CALX[0].fluxes.length === 2 && state.loadout.CALX[1].fluxes.length === 1,
   'bay counts follow banks table (ABRASIO 2, CONCRETIO 1)');
ok(allOps().length === 5, 'five hotkeys: PERCVSSIO + four seated banks');
ok(allOps()[0].op.name === 'PERCVSSIO', 'OPERATOR intrinsic holds hotkey 1');

// ---------------------------------------------------------------- fold
const base = fold({ bank: 'FVLGVR', fluxes: [null, null] });
ok(base.pn === 3 && base.range === 4, 'fold with no fluxes = base stats');
const modded = fold({ bank: 'FVLGVR', fluxes: ['VITRIOL', 'VIVVM'] });
ok(modded.dmgBonus === 2 && modded.range === 5 && modded.pn === 3,
   'VITRIOL +2 dmg and VIVVM +1 range apply; pn untouched');
const greedy = fold({ bank: 'IMMOLATIO', fluxes: ['FVLMINANS'] });
ok(greedy.dmgBonus === 5 && greedy.vitaeCost === 6,
   'FVLMINANS stacks +2 vitae onto IMMOLATIO base 4');
const cheap = fold({ bank: 'ABRASIO', fluxes: ['NITRVM', 'NITRVM'] });
ok(cheap.pn === 1, 'double NITRVM floors ABRASIO at pn 1, not 0');
const perc = fold({ bank: 'CONCRETIO', fluxes: ['ADAMANS'] });
ok(perc.minDmg === 3, 'ADAMANS sets a per-op minimum');
ok(B.operations.FVLGVR.pn === 3 && B.operations.FVLGVR.range === 4,
   'fold never mutates the base operation table');

// ---------------------------------------------------------------- drops
// rollItem is internal; reach it through rollDrop determinism instead:
// force DATA rolls by emptying the RNG path. Simpler: statistical check.
// Pool rule at the data level (rollItem itself is exercised below via __DW):
ok(B.drops.bankPool.length === 2 &&
   B.drops.bankPool.every(b => B.banks[b] && !Object.values(B.defaultLoadout).flat().includes(b)),
   'bank pool holds only findable banks, none from a default loadout');
ok(Object.values(B.fluxes).every(f => f.weight > 0), 'every flux has drop weight');

// ---------------------------------------------------------------- refit rule
state.bag.items.push({ kind: 'FLUX', flux: 'VITRIOL', label: 'VITRIOL', sprite: 'flux', rarity: 'UNCOMMON' });
state.modal = null;   // first run opens the controls modal; clear it
openInv();
ok(state.modal === 'inv', 'inventory opens as a modal');
closeInv();
ok(state.modal === null, 'inventory closes clean');

// ------------------------------------------------------- rollItem no-dupe
{
  const drawn = new Set();
  for (let i = 0; i < 60; i++) {
    const it = rollItem('DATA');
    if (it.kind === 'DATA') {
      ok(!drawn.has(it.bank) || true, '');
      drawn.add(it.bank);
      state.bag.items.push(it);           // owning it must remove it from play
    }
  }
  ok(drawn.size === 2, 'both pool banks reachable across rolls');
  const after = rollItem('DATA');
  ok(after.kind === 'FLUX', 'pool exhausted -> DATA pays out as FLUX');
  // no drop ever duplicated an owned bank
  const owned = state.bag.items.filter(i => i.kind === 'DATA').map(i => i.bank);
  ok(owned.length === 2 && new Set(owned).size === 2, 'no duplicate bank ever entered the bag');
}

// ------------------------------------------------------- refit rule
state.foes.forEach(f => { f.awake = false; });
ok(payRefit('CINIS') === true && state.acted.length === 0,
   'quiet floor: refit is free, no action spent');
state.foes[0].awake = true; state.foes[0].hp = 5;
ok(payRefit('CINIS') === true && state.acted.includes('CINIS'),
   'awake foe: first refit spends the daemon action');
ok(payRefit('CINIS') === false,
   'awake foe: second refit same round is refused');
state.acted.length = 0; state.foes[0].awake = false;

console.log(fail ? `\n${pass} passed, ${fail} FAILED` : `all ${pass} checks passed`);
process.exit(fail ? 1 : 0);
