// NIGREDO face loop test. Run: node tools/test-face.js
//
// The face is four tiles: three open from the first day, the Archon's
// THRONVS sealed until all three are cleared. Asserted here: the unlock
// rule, the affix reroll (four distinct labels from the pool), and -- as
// the later commits land -- the town/face-modal handoff, extract, the
// third-clear heal, the Archon seal, and the wipe loop.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
// Same Proxy stub as tools/test-cube.js: ids that exist in index.html
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
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/face.js', 'data/balance.js',
                 'data/fxsheets.js', 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg);
  if (!cond) failed++;
}

const T = window.__DW;
const s = T.state;
const FACE = window.FACE_NIGREDO;
s.modal = null; // boot opens the controls overlay; clear it as a player would

// ============================================================ unlock rule
console.log('-- unlock rule');
{
  ok(s.tile === null, 'the run starts off the face (tile null)');
  ok(Array.isArray(s.face.cleared) && s.face.cleared.length === 0 &&
     s.face.sealed === false, 'face state starts empty and unsealed');
  const plain = FACE.tiles.filter(t => !t.archon).map(t => t.id);
  ok(plain.length === 3 && plain.every(T.tileUnlocked), 'three ordinary tiles open from the start');
  ok(T.tileUnlocked('THRONVS') === false, 'THRONVS sealed with nothing cleared');
  s.face.cleared = plain.slice(0, 2);
  ok(T.tileUnlocked('THRONVS') === false, 'THRONVS still sealed with two cleared');
  s.face.cleared = plain.slice();
  ok(T.tileUnlocked('THRONVS') === true, 'THRONVS opens once all three are cleared');
  ok(T.tileUnlocked('NOWHERE') === false, 'an unknown id is never unlocked');
  s.face.cleared = [];
}

// ============================================================ affix reroll
console.log('-- rerollAffixes: four distinct labels from the pool');
{
  for (let i = 0; i < 50; i++) {
    T.rerollAffixes();
    const labels = FACE.tiles.map(t => s.face.affix[t.id]);
    const inPool = labels.every(l => FACE.affixPool.includes(l));
    const distinct = new Set(labels).size === 4;
    if (!inPool || !distinct || labels.length !== 4) {
      ok(false, `reroll ${i}: ${labels.join(' / ')}`); break;
    }
    if (i === 49) ok(true, '50 rerolls: every tile labelled, all from the pool, no two alike');
  }
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL PASS');
process.exit(failed ? 1 : 0);
