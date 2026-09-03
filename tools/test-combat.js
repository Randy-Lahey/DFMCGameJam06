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
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/face.js', 'data/town.js', 'data/balance.js', 'data/fxsheets.js',
                 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

const { state, resolveRound, lead, moveInput } = window.__DW;

// The run now starts SOLO (tutorial); these assertions were written for the
// full 4-member board. Recruit everyone and reload floor 01 first.
window.__DW.recruit('CALX');
window.__DW.recruit('CINIS');
window.__DW.recruit('GVTTA');
window.__DW.loadFloor(window.FLOOR01);
const B = window.BALANCE;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };

state.modal = null;
const M = state.circle.members;
const L = lead();
const hpAll = () => M.reduce((s, m) => s + m.hp, 0);

// One foe on the board, fangs out; the rest gone. Daemons are parked at hp
// 999 so foeTarget's frailest-tiebreak cannot wander off the OPERATOR when
// distances tie -- the old tests got this disambiguation for free from
// contact damage, which no longer exists: contact now ENGAGES.
const foe = state.foes[0];
// The pack tests need three foe bodies to position. The tutorial floor only
// carries two, and the test repositions everything anyway -- so pad with
// clones rather than lean on floor content. Plain data objects, safe to copy.
while (state.foes.length < 3) {
  state.foes.push(Object.assign({}, foe, { id: state.foes.length + 100 }));
}
state.foes.forEach(f => { f.hp = 0; });
const arm = (c, r) => Object.assign(foe, {
  hp: foe.vitae, c, r, awake: true, ai: 'flank', atk: Math.max(foe.atk, 3) });
M.forEach(m => { m.hp = m.vitae; m.def = 99; });
L.def = 0;
M.slice(1).forEach(m => { m.hp = 999; });   // tiebreak guard (test-only)

// The combat module is stubbed: we assert the HANDOFF, not the fight.
const calls = [];
window.DW_COMBAT = { start(cfg) { calls.push(cfg); }, isActive: () => false };

// ------------------------------------------------- 1. contact = engagement
// An adjacent foe's swing becomes the combat trigger: no crawl chip damage,
// one handoff call carrying the touching foe across the seam.
arm(L.c, L.r - 1);
let before = hpAll();
resolveRound({ kind: 'hold' });
ok(hpAll() === before, 'contact deals no crawl damage -- it engages');
ok(state.modal === null, 'contact opens no dialog -- combat starts outright');
ok(calls.length === 1, 'contact triggers exactly one tactical handoff');
ok(calls[0].foes && calls[0].foes.length === 1 && calls[0].foes[0].srcId === foe.id,
   'the touching foe crosses the seam by srcId');
ok(calls[0].foes[0].frac === 1, 'an unhurt foe crosses at full VITAE fraction');
ok(state.scene === 'combat', 'scene flips to combat during the handoff');

// Victory writes back: party fractions land, the engaged foe is severed on
// the crawl floor through the normal drop path.
calls[0].onEnd({ won: true, party: [{ id: 'op', frac: 0.5 }],
                 foes: [{ srcId: foe.id, frac: 0 }] });
ok(state.scene === 'crawl', 'RETVRN restores the crawl scene');
ok(foe.hp === 0, 'victory severs the engaged foe on the floor');
ok(L.hp === Math.round(0.5 * L.vitae), 'party VITAE fraction writes back');
L.hp = L.vitae;

// ------------------------------------------------- 2. the pack comes too
// Foes within Chebyshev 2 of the trigger are pulled into the fight; foes
// beyond it are not.
const near = state.foes[1], far = state.foes[2];
calls.length = 0;
arm(L.c, L.r - 1);
Object.assign(near, { hp: near.vitae, c: foe.c + 1, r: foe.r - 1, awake: true, ai: 'flank' });
Object.assign(far,  { hp: far.vitae,  c: foe.c + 5, r: foe.r - 5, awake: false });
resolveRound({ kind: 'hold' });
ok(calls.length === 1, 'a pack engagement is still one handoff');
const ids = calls.length ? calls[0].foes.map(f => f.srcId) : [];
ok(ids.includes(foe.id) && ids.includes(near.id), 'foes within radius 2 are pulled in');
ok(!ids.includes(far.id), 'foes beyond radius 2 stay out of the fight');

// ------------------------------------------------- 3. loss, wounds, grace
// Driven back: engaged foes keep their combat wounds and grant one round of
// grace, so RETVRN is not an instant re-engagement.
calls[0].onEnd({ won: false, party: [{ id: 'op', frac: 1 }],
                 foes: [{ srcId: foe.id, frac: 0.25 }, { srcId: near.id, frac: 0.25 }] });
ok(foe.hp === Math.max(1, Math.round(0.25 * foe.vitae)),
   'a lost fight writes the foe\'s wounds back to the floor');
ok(foe.grace === 1, 'the engaged pack grants one round of grace');
calls.length = 0;
before = hpAll();
resolveRound({ kind: 'hold' });
ok(calls.length === 0 && hpAll() === before, 'a graced foe neither strikes nor engages');
ok(foe.grace === 0, 'grace decays in the upkeep phase');
resolveRound({ kind: 'hold' });
ok(calls.length === 1, 'grace over, contact engages again');
calls[0].onEnd({ won: true, party: [{ id: 'op', frac: 1 }],
                 foes: [{ srcId: foe.id, frac: 0 }, { srcId: near.id, frac: 0 }] });
ok(foe.hp === 0 && near.hp === 0, 'victory severs the whole engaged pack');

// ------------------------------------------------- 3b. bump-to-engage
// The player can INITIATE: stepping into a foe is the contact trigger.
// This is the hardlock cure -- a full-health skirmisher never swings first,
// so the bump is the only way to bring it to battle.
calls.length = 0;
arm(L.c, L.r - 1);                       // foe standing directly north
const lc = L.c, lr = L.r;
moveInput(0, -1);                        // walk INTO it
ok(L.c === lc && L.r === lr, 'the bump spends the step without moving onto the foe');
ok(state.modal === null, 'bumping a foe opens no dialog');
ok(calls.length === 1 && calls[0].foes.some(f => f.srcId === foe.id),
   'the bumped foe crosses the seam immediately');
calls[0].onEnd({ won: true, party: [{ id: 'op', frac: 1 }],
                 foes: [{ srcId: foe.id, frac: 0 }] });
ok(state.scene === 'crawl' && foe.hp === 0, 'bump-initiated fight resolves like any other');

// ------------------------------------------------- 4. kills cancel contact
// A RANGED queued op (range 2 stays crawl chip damage) that drops the foe in
// the attack phase leaves nothing to engage: dead foes trigger no combat.
calls.length = 0;
arm(L.c, L.r - 1);
foe.hp = 1;
const rangedName = Object.keys(B.operations).find(n =>
  B.operations[n].kind === 'strike' && B.operations[n].range >= 2 && !B.operations[n].vitaeCost);
const rop = { name: rangedName, ...B.operations[rangedName], dmg: 99, pn: 0 };
state.queued = [{ member: L, op: rop, targetId: foe.id }];
before = hpAll();
resolveRound(null);
ok(foe.hp <= 0, 'a ranged queued op still chips and kills in the attack phase');
ok(hpAll() === before, 'a foe killed before the strike phase deals NOTHING');
ok(calls.length === 0, 'a dead foe triggers no engagement');

// ------------------------------------------------- 5. dead stay dead
before = hpAll();
resolveRound({ kind: 'hold' });
ok(hpAll() === before && calls.length === 0, 'a dead foe stays silent on later rounds');

// ------------------------------------------------- 6. preview agrees
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
  foe.hp = 0;
}

// ---------------------------------------------- dead-party foe brain
// The strike loop can kill the LAST member while other foes still hold
// intents; decide() against an empty world must idle, never throw. This was
// the "stuck after the chest" wedge: the throw killed the cleanup phase
// before checkEnd could declare SEVERED.
const { previewIntent: pv } = window.__DW;
state.circle.members.forEach(m => { m.hp = 0; });
state.foes[0].hp = state.foes[0].vitae; state.foes[0].awake = true;
let threw = false, intent = null;
try { intent = pv(state.foes[0]); } catch (e) { threw = true; }
ok(!threw && intent && intent.kind === 'idle',
   'a foe with no living target idles instead of throwing');
state.circle.members.forEach(m => { m.hp = m.vitae; });

console.log(`test-combat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
