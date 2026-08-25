// The sacrifice script (cfg.archon fights). Run: node tools/test-sacrifice.js
//
// R1 honest fight, R2 the Archon resolves (SPD 99) and one-shots the daemon,
// R3 the Hermit's bequest ends the fight in FLEE. The fight can be neither
// won (pack wipe is swallowed) nor lost (OPERATOR clamped at 1, Archon
// untouchable), and finish() reboots the fled party at full VITAE.
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

let ended = null;
window.DW_COMBAT.start({
  archon: true, sacrifice: true, guests: ['hermit'],
  party: [{ id: 'op', frac: 1 }, { id: 'calx', frac: 1 }],
  foes: [{ tpl: 't', frac: 1 }],
  onEnd: r => { ended = r; },
});
const T = window.__DWC_TEST;   // seam is built inside initLogic on first start
const s = T.state;
const byId = id => s.units.find(u => u.id === id);

// seat everyone by hand (place-phase UI is not under test) and begin
let px = 0;
for (const u of s.units) { if (u.x < 0) { u.x = px; u.y = px; px++; } }
s.phase = 'battle'; s.round = 1;
T.newRound();

console.log('-- R1: honest fight, no archon yet');
ok(!byId('archon'), 'R1 fields no Archon');
// drive R1: skip every player turn; AI turns run synchronously
let guard = 20;
while (s.round === 1 && s.phase === 'battle' && guard--) T.endTurn();

console.log('-- R2: the Archon resolves and severs the daemon');
ok(s.round === 2, 'round advanced to 2');
const A = byId('archon');
ok(A && A.scripted === true && A.speed === 99, 'Archon spawned as scripted SPD-99 unit');
// its turn (first in order) already ran synchronously via startTurn->aiTurn
const calx = byId('calx');
ok(calx && calx.alive === false && calx.vitae === 0, 'CALX severed in one stroke');
ok(byId('op').alive, 'OPERATOR still standing');

console.log('-- invariants: cannot win, cannot lose');
ok(T.hitUnit(byId('op'), { mult: 99, flat: 999, minDmg: 999 }, A) === undefined
   && A.vitae === A.maxVitae, 'Archon takes NO PVRCHASE');
const op = byId('op');
T.hitUnit(A, { mult: 99, flat: 999, minDmg: 999 }, op);
ok(op.alive && op.vitae === 1, 'OPERATOR clamped at 1, never terminated');
s.units.filter(u => u.side === 'foe' && !u.scripted).forEach(u => { u.alive = false; u.vitae = 0; });
ok(T.checkOver() === false && s.phase === 'battle', 'pack wipe does not win the scripted fight');

console.log('-- R3: the bequest ends it in FLEE');
guard = 20;
while (s.round === 2 && s.phase === 'battle' && guard--) T.endTurn();
ok(s.beatDone === true, 'R3 plays the bequest');
ok(s.phase === 'over', 'fight ends by script, not by kill count');

console.log('-- finish: full reboot for everyone who fled');
T.finish(true);
ok(ended && ended.won === true, 'FLEE resolves through the win handoff');
ok(ended.party.every(p => p.frac === 1), 'party writes back at FULL VITAE (severing was narrative)');
ok(calx.alive === true && calx.vitae === calx.maxVitae, 'CALX reboots whole');

console.log(fail ? `\n${fail} FAILURE(S)` : `\ntest-sacrifice: ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
