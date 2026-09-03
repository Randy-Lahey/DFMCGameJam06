// Camera-on-descent regression. Run: node tools/test-camera.js
//
// The floor-02 letterbox bug: loadFloor assigned `cam` without writing the
// stage's viewBox, and updateCamera's change-detection then saw 'no change'
// and never applied a frame -- the old floor's viewBox survived the descent.
// This asserts the viewBox attribute is actually rewritten for the new
// floor's geometry, sized by the fitted camera, not the stale one.
'use strict';
const fs = require('fs');
const path = require('path');

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
const liveIds = new Set([...html.slice(0, scriptAt).matchAll(/id="([^"]+)"/g)].map(m => m[1]));

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
global.setTimeout = fn => { fn(); return 0; };
global.clearTimeout = () => {};
global.performance = { now: () => 0 };
global.cancelAnimationFrame = () => {};

// Recording stage: capture every viewBox write. Must exist BEFORE game.js
// captures the element.
const viewBoxes = [];
const stage = document.getElementById('stage');
stage.setAttribute = (k, v) => { if (k === 'viewBox') viewBoxes.push(v); };

const root = path.join(__dirname, '..');
for (const f of ['data/floor01.js', 'data/floor02.js', 'data/face.js', 'data/town.js', 'data/balance.js', 'data/fxsheets.js',
                 'src/sprites.js', 'src/game.js']) {
  new Function(fs.readFileSync(path.join(root, f), 'utf8'))();
}

let failed = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg);
  if (!cond) failed++;
};

const T = window.__DW;
const F1 = window.FLOOR01, F2 = window.FLOOR02;

// Boot frames floor 1.
ok(viewBoxes.length > 0, 'boot writes a viewBox at all');
const bootVB = viewBoxes[viewBoxes.length - 1];

// Descend. loadFloor must rewrite the frame for the NEW geometry.
viewBoxes.length = 0;
T.loadFloor(F2);
ok(viewBoxes.length > 0, 'descent rewrites the stage viewBox');
const [x, y, w, h] = (viewBoxes[viewBoxes.length - 1] || '0 0 0 0').split(' ').map(Number);
// 800x600 box, 44px min tiles -> fits 18x13 tiles: floor 2 (17x12) fits whole.
const TL = 64; // tile size in SVG units; game.js const T
ok(w === F2.cols * TL && h === F2.rows * TL,
   `final frame spans floor 2 (${w}x${h}, want ${F2.cols * TL}x${F2.rows * TL})`);
ok(viewBoxes[viewBoxes.length - 1] !== bootVB, 'floor 2 frame differs from the floor 1 frame');
// Party anchor inside the frame: spawn must be visible, not letterboxed out.
const L = T.lead();
const px = (L.c + .5) * TL, py = (L.r + .5) * TL;
ok(px >= x && px <= x + w && py >= y && py <= y + h,
   'the party anchor sits inside the applied frame');

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL PASS');
process.exit(failed ? 1 : 0);
