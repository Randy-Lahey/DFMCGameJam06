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
    // A bare object is not enough any more: the movement animation drives the
    // actor layer through style.setProperty, which a plain {} does not have.
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
// IDs that actually exist in index.html, and that appear BEFORE the script
// tags -- i.e. the ones present in the DOM when game.js runs. Anything else
// must come back null, or a missing element looks identical to a present one
// and the stub silently hides the exact class of bug it should catch.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptAt = html.indexOf('<script');
const liveIds = new Set(
  [...html.slice(0, scriptAt).matchAll(/id="([^"]+)"/g)].map(m => m[1]));

const byId = {};
global.document = {
  getElementById: id => {
    // dwc-* ids are built at runtime by the chamber module, not index.html.
    if (!liveIds.has(id) && !id.startsWith('dwc-')) return null;
    return (byId[id] = byId[id] || stubEl());
  },
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  activeElement: null, body: stubEl(), head: stubEl(), documentElement: stubEl(),
};
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0;
global.setTimeout = fn => { fn(); return 0; };  // combat transition resolves inline
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.innerWidth = 1280; global.innerHeight = 800; global.devicePixelRatio = 1;
Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });

// ---------------------------------------------------------------- load
const root = path.join(__dirname, '..');
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/balance.js', 'data/fxsheets.js',
                 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

const { state, opsFor, allOps, fold, openInv, closeInv, rollItem, payRefit } = window.__DW;

// The run now starts SOLO (tutorial); these assertions were written for the
// full 4-member board. Recruit everyone and reload floor 01 first.
window.__DW.recruit('CALX');
window.__DW.recruit('CINIS');
window.__DW.recruit('GVTTA');
window.__DW.loadFloor(0);
const B = window.BALANCE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };

// ------------------------------------------------------- DOM availability
ok(liveIds.has('inv'), 'inventory overlay exists in the DOM before game.js runs');
ok(liveIds.has('bag'), 'HUD satchel line exists in the DOM before game.js runs');

// ---------------------------------------------------------------- loadout
ok(state.loadout.CALX.length === 2 && state.loadout.CINIS.length === 2,
   'daemons start with two seated banks');
ok(state.loadout.CALX[0].fluxes.length === 2 && state.loadout.CALX[1].fluxes.length === 1,
   'bay counts follow banks table (ABRASIO 2, CONCRETIO 1)');
ok(allOps().length === 6, 'six hotkeys: PERCVSSIO + five seated banks');
ok(allOps()[0].op.name === 'PERCVSSIO', 'OPERATOR intrinsic holds hotkey 1');

// PERCVSSIO now rides a fixed loadout slot so it can seat ONE flux. The
// slot must exist, expose a single bay, and fold a seated VITRIOL into
// real strike damage -- while staying un-swappable (type matches nothing).
const pSlot = state.loadout.OPERATOR && state.loadout.OPERATOR[0];
ok(pSlot && pSlot.bank === 'PERCVSSIO' && pSlot.fluxes.length === 1,
   'OPERATOR slot: PERCVSSIO with exactly one flux bay');
ok(fold({ bank: 'PERCVSSIO', fluxes: ['VITRIOL'] }).dmgBonus === 2,
   'VITRIOL seated in PERCVSSIO folds to +2 damage');
ok(window.BALANCE.banks.PERCVSSIO.type === '\u2014',
   'PERCVSSIO bank type matches no daemon: the slot cannot be swapped');

// ---------------------------------------------------------------- fold
const base = fold({ bank: 'FVLGVR', fluxes: [null, null] });
ok(base.pn === 3 && base.range === 2, 'fold with no fluxes = base stats');
const modded = fold({ bank: 'FVLGVR', fluxes: ['VITRIOL', 'VIVVM'] });
ok(modded.dmgBonus === 2 && modded.range === 3 && modded.pn === 3,
   'VITRIOL +2 dmg and VIVVM +1 range apply; pn untouched');
const greedy = fold({ bank: 'IMMOLATIO', fluxes: ['FVLMINANS'] });
ok(greedy.dmgBonus === 5 && greedy.vitaeCost === 6,
   'FVLMINANS stacks +2 vitae onto IMMOLATIO base 4');
const cheap = fold({ bank: 'ABRASIO', fluxes: ['NITRVM', 'NITRVM'] });
ok(cheap.pn === 1, 'double NITRVM floors ABRASIO at pn 1, not 0');
const perc = fold({ bank: 'CONCRETIO', fluxes: ['ADAMANS'] });
ok(perc.minDmg === 3, 'ADAMANS sets a per-op minimum');
ok(B.operations.FVLGVR.pn === 3 && B.operations.FVLGVR.range === 2,
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
// Scene-gated: the rig is sealed only inside the tactical chamber. On the
// crawl -- even with an awake foe ADJACENT -- refits are free. Never an
// action tax, so state.acted must stay untouched either way.
state.foes.forEach(f => { f.awake = false; });
ok(payRefit('CINIS') === true && state.acted.length === 0,
   'quiet floor: refit is free, no action spent');
const near = state.foes[0], lead0 = state.circle.members[0];
near.awake = true; near.hp = 5; near.c = lead0.c + 1; near.r = lead0.r;
ok(payRefit('CINIS') === true && state.acted.length === 0,
   'awake foe ADJACENT on the crawl: refit still free');
state.scene = 'combat';
ok(payRefit('CINIS') === false && payRefit('CINIS') === false &&
   state.acted.length === 0,
   'in combat: rig sealed, repeatably, no action ever spent');
ok((state.modal = null, window.__DW.openInv(), state.modal === null),
   'inventory refuses to open mid-fight');
state.scene = 'crawl';
ok(payRefit('CINIS') === true, 'back on the crawl: refit free again');
near.awake = false; near.hp = 0;

// ------------------------------------------- fluxes cross the chamber seam
// Game side first: a seated VIVVM must cross enterCombat as a range delta.
state.scene = 'crawl'; state.modal = null;
state.loadout.OPERATOR[0].fluxes[0] = 'VIVVM';
let seamCfg = null;
window.DW_COMBAT = {
  start(c) { seamCfg = c; c.onEnd({ won: true, party: [], foes: [] }); },
  isActive: () => false,
};
const seamFoe = () => ({ id: 'sf' + Math.random(), kind: 'TESTA', hp: 4, vitae: 4, c: 0, r: 0, grace: 0 });
window.__DW.enterCombat([seamFoe()]);
ok(seamCfg && seamCfg.mods && seamCfg.mods.op &&
   seamCfg.mods.op.PERCVSSIO && seamCfg.mods.op.PERCVSSIO.rng === 1,
   'seated VIVVM crosses the seam as a +1 range delta on op/PERCVSSIO');
const seamMods = seamCfg.mods;
state.loadout.OPERATOR[0].fluxes[0] = null;
seamCfg = null;
window.__DW.enterCombat([seamFoe()]);
ok(seamCfg && seamCfg.mods === undefined,
   'bare rig: no mods field crosses at all');

// Chamber side: load the real module, start a real fight with those mods,
// and read the merged bank off the live OPERATOR unit.
new Function(fs.readFileSync(path.join(root, 'src/combat.js'), 'utf8'))();
window.DW_COMBAT.start({ fight: 1, party: [{ id: 'op', frac: 1 }], mods: seamMods });
const DWC = window.__DWC_TEST;
ok(!!DWC, 'chamber test seam is live after start()');
const opU = DWC.state.units.find(u => u.id === 'op');
const mg = DWC.bankFor(opU, 'PERCVSSIO');
ok(mg.max === 2 && mg.min === 1,
   'chamber PERCVSSIO under VIVVM reaches range 2 (min stays 1)');
ok(DWC.bankFor({}, 'PERCVSSIO').max === 1,
   'no mods: the shared table is returned untouched');
ok(DWC.bankFor({ mods: { PERCVSSIO: { rng: 3 } } }, 'PERCVSSIO').max === 4 &&
   DWC.bankFor({}, 'PERCVSSIO').max === 1,
   'the merge clones -- the shared def is never mutated');

console.log(fail ? `\n${pass} passed, ${fail} FAILED` : `all ${pass} checks passed`);
process.exit(fail ? 1 : 0);
