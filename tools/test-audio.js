// Audio/SFX test. Run: node tools/test-audio.js
//
// Asserted:
//   1. Headless safety: with no AudioContext, DW_SFX exists and every call
//      (play/toggle) is a silent no-op that never throws.
//   2. With a fake AudioContext: play() builds nodes, muted play() builds
//      nothing, a suspended context is resume()d, unknown names are ignored.
//   3. Combat wiring (spy DW_SFX): hitUnit -> "hit"; a killing blow adds
//      "death"; fightWon -> "victory"; startTurn blips "turn" for a
//      player-controlled unit and NOT for an ai/guest unit.
//   4. Crawl wiring + build: game.js contains the step / combatStart / M-key
//      hooks; build-standalone.py inlines src/audio.js; index.html loads it
//      before combat.js.
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- DOM stub
// Same Proxy stub as tools/test-hermit.js.
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
const byId = {};
global.document = {
  getElementById: id => (byId[id] = byId[id] || stubEl()),
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  activeElement: null, body: stubEl(), documentElement: stubEl(),
  head: stubEl(),
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

const root = path.join(__dirname, '..');
const src = f => fs.readFileSync(path.join(root, f), 'utf8');
const load = f => new Function(src(f))();

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg);
  if (!cond) failed++;
}

// ============================================== 1. headless: no AudioContext
console.log('-- headless safety (no AudioContext)');
{
  load('src/audio.js');
  ok(!!window.DW_SFX, 'DW_SFX exists');
  let threw = false;
  try {
    window.DW_SFX.play('hit');
    window.DW_SFX.play('nonsense');
    window.DW_SFX.play();
  } catch (e) { threw = true; }
  ok(!threw, 'play() never throws without AudioContext');
  ok(window.DW_SFX.muted === false, 'starts unmuted');
  ok(window.DW_SFX.toggle() === true, 'toggle() -> muted true');
  ok(window.DW_SFX.toggle() === false, 'toggle() -> muted false');
}

// ============================================== 2. fake AudioContext
console.log('-- fake AudioContext behavior');
{
  let made = 0, resumed = 0;
  function FakeNode() {
    return {
      connect() {}, start() { made++; }, stop() {},
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      type: '', Q: { value: 0 }, buffer: null,
    };
  }
  global.AudioContext = function () {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'suspended';
    this.destination = {};
    this.resume = () => { resumed++; this.state = 'running'; };
    this.createOscillator = FakeNode;
    this.createGain = FakeNode;
    this.createBufferSource = FakeNode;
    this.createBiquadFilter = FakeNode;
    this.createBuffer = () => ({ getChannelData: () => new Float32Array(64) });
  };
  load('src/audio.js');            // reload: picks up AudioContext
  window.DW_SFX.play('hit');
  ok(made > 0, 'play("hit") schedules audio nodes');
  ok(resumed === 1, 'suspended context is resume()d on play');
  const before = made;
  window.DW_SFX.play('bogus');
  ok(made === before, 'unknown sound name schedules nothing');
  window.DW_SFX.toggle();          // mute
  window.DW_SFX.play('victory');
  ok(made === before, 'muted play() schedules nothing');
  window.DW_SFX.toggle();          // unmute
  for (const n of ['step', 'combatStart', 'turn', 'death', 'victory']) {
    const b = made; window.DW_SFX.play(n);
    ok(made > b, 'sound "' + n + '" is defined and schedules nodes');
  }
}

// ============================================== 3. combat wiring (spy)
console.log('-- combat hook wiring');
{
  const calls = [];
  window.DW_SFX = { muted: false, play: n => calls.push(n), toggle() { return false; } };
  load('data/balance.js');
  load('src/combat.js');
  window.DW_COMBAT.start({ fight: 1, guests: ['hermit'] });
  const T = window.__DWC_TEST;
  const s = T.state;
  // seat the party (same helper shape as test-hermit.js)
  const free = [];
  for (let x = 0; x < 2; x++) for (let y = 0; y < 12; y++) {
    if (!s.units.some(u => u.alive && u.x === x && u.y === y)) free.push([x, y]);
  }
  while (s.toPlace.length) {
    const id = s.toPlace.shift();
    const u = s.units.find(v => v.id === id);
    const [x, y] = free.shift();
    u.x = x; u.y = y;
  }
  s.phase = 'battle';

  // 3a. startTurn blip: player unit yes, ai/guest unit no.
  const op = s.units.find(u => u.id === 'op');
  const hermit = s.units.find(u => u.id === 'hermit');
  s.order = [op]; s.turn = 0;
  calls.length = 0;
  T.newRound();                    // rebuilds order; first unit is fastest
  const first = T.cur();
  if (first.side === 'party' && first.control !== 'ai') {
    ok(calls.includes('turn'), 'player-controlled startTurn plays "turn"');
  } else {
    ok(!calls.includes('turn'), 'ai-controlled startTurn stays silent (no "turn")');
  }
  // Force-check the guest side explicitly: neuter damage so his AI turn
  // resolves without kills, then confirm no "turn" blip fired for him.
  // Freeze timers so startTurn(hermit) does NOT chain into aiTurn and on
  // into the NEXT unit's startTurn (whose legit blip would pollute the capture).
  const realTimeout = global.setTimeout;
  global.setTimeout = () => 0;
  calls.length = 0;
  // startTurn is not exported; drive it via endTurn on a 2-slot order.
  s.order = [op, hermit]; s.turn = 0;
  T.endTurn();                     // advances to hermit -> startTurn(hermit)
  ok(!calls.includes('turn'), 'guest (control:"ai") startTurn plays no "turn"');
  global.setTimeout = realTimeout;

  // 3b. hitUnit -> "hit"; killing blow adds "death".
  const foe = s.units.find(u => u.side === 'foe' && u.alive);
  calls.length = 0;
  foe.vitae = 999; foe.def = 0;
  T.hitUnit({ atk: 5 }, { mult: 1, flat: 0 }, foe);
  ok(calls.includes('hit'), 'hitUnit plays "hit"');
  ok(!calls.includes('death'), 'non-lethal hit plays no "death"');
  calls.length = 0;
  foe.vitae = 1;
  T.hitUnit({ atk: 50 }, { mult: 1, flat: 0 }, foe);
  ok(calls.includes('hit') && calls.includes('death'), 'killing blow plays "hit" then "death"');
  ok(!foe.alive, 'target is dead after the killing blow');

  // 3c. purge the pack -> checkOver -> fightWon -> "victory".
  calls.length = 0;
  s.units.filter(u => u.side === 'foe').forEach(u => { u.alive = false; u.vitae = 0; });
  T.checkOver();
  ok(calls.includes('victory'), 'clearing all foes plays "victory"');
}

// ============================================== 4. crawl wiring + build
console.log('-- crawl hooks & build inclusion (source checks)');
{
  const g = src('src/game.js');
  ok(/state\.stepsUsed\+\+;\s*\n\s*if \(window\.DW_SFX\) DW_SFX\.play\('step'\)/.test(g),
     'moveInput plays "step" after a landed step');
  ok(g.includes("DW_SFX.play('combatStart')"), 'enterCombat plays "combatStart"');
  ok(g.includes("k === 'm' && window.DW_SFX"), 'M key toggles mute in the crawl keydown handler');
  const b = src('tools/build-standalone.py');
  ok(b.includes("'src/audio.js'"), 'build-standalone.py inlines src/audio.js');
  const h = src('index.html');
  const iAudio = h.indexOf('src/audio.js'), iCombat = h.indexOf('src/combat.js');
  ok(iAudio > -1 && iCombat > -1 && iAudio < iCombat, 'index.html loads audio.js before combat.js');
}

console.log(failed ? '\n' + failed + ' FAILED' : '\nall checks passed');
process.exit(failed ? 1 : 0);
