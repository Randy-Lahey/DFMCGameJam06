// DAEMONWARE audio -- all sounds synthesized with the Web Audio API.
// No samples, no dependencies. Exposes window.DW_SFX:
//   DW_SFX.play(name)   fire one of the named sounds (no-op if muted/unavailable)
//   DW_SFX.toggle()     flip mute; returns the new muted state
//   DW_SFX.muted        current mute state (read-only intent)
//
// Browsers refuse to start an AudioContext before a user gesture, so the
// context is created lazily inside play() and resumed on every call; the
// first sounds simply arrive once the player has tapped or pressed a key.
// In headless environments (node/jsdom tests) AudioContext does not exist
// and every call degrades to a silent no-op.
(function () {
  "use strict";
  let ctx = null;
  const SFX = { muted: false };

  function ac() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  // One oscillator note. f0->f1 over dur seconds, gain envelope with a fast
  // attack and exponential-ish decay. All the named sounds are built from
  // these plus the noise burst below.
  function tone(o) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (o.at || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1 || o.f0), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol || 0.12, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  }

  // Short white-noise burst through a bandpass -- the impact thud.
  function noise(o) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (o.at || 0);
    const n = Math.floor(c.sampleRate * o.dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = o.q || 1;
    bp.frequency.setValueAtTime(o.freq || 400, t0);
    if (o.f1) bp.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const g = c.createGain(); g.gain.value = o.vol || 0.25;
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(t0);
  }

  // A hair of random detune keeps multi-hit sweeps from phasing into one
  // flat click.
  const jit = f => f * (1 + (Math.random() - 0.5) * 0.06);

  const SOUNDS = {
    // corridor step: quiet, short tick
    step()        { tone({ type: "triangle", f0: jit(660), f1: 440, dur: 0.045, vol: 0.05 }); },
    // combat start: rising static surge -- a noise swell whose bandpass
    // sweeps up through the spectrum over a low drone attack. The foe
    // resolves out of the static; so does the fight.
    combatStart() { noise({ dur: 0.55, freq: 90, f1: 2400, q: 1.6, vol: 0.20 });
                    noise({ dur: 0.40, freq: 60, f1: 300,  q: 0.8, vol: 0.12, at: 0.05 });
                    tone({ type: "sawtooth", f0: 65, f1: 62, dur: 0.50, vol: 0.09 }); },
    // player-controlled unit turn: single blip
    turn()        { tone({ type: "square", f0: 880, f1: 880, dur: 0.07, vol: 0.06 }); },
    // attack landed: noise thud + pitch snap
    hit()         { noise({ dur: 0.09, freq: jit(420), q: 1.2, vol: 0.22 });
                    tone({ type: "square", f0: jit(220), f1: 90, dur: 0.08, vol: 0.08 }); },
    // unit death: downward bend
    death()       { tone({ type: "sawtooth", f0: 330, f1: 55, dur: 0.45, vol: 0.12 }); },
    // chamber purged: machine spin-down -- two detuned descending saws
    // (their beating supplies the tremolo wobble) tailed by two quiet
    // relay-click ticks. A daemon process terminating cleanly.
    victory()     { tone({ type: "sawtooth", f0: 330, f1: 82, dur: 0.80, vol: 0.10 });
                    tone({ type: "sawtooth", f0: 336, f1: 86, dur: 0.80, vol: 0.07 });
                    noise({ dur: 0.03, freq: 2200, q: 4, vol: 0.10, at: 0.82 });
                    noise({ dur: 0.03, freq: 1800, q: 4, vol: 0.08, at: 0.94 }); },
  };

  SFX.play = function (name) {
    if (SFX.muted) return;
    const fn = SOUNDS[name]; if (!fn) return;
    const c = ac(); if (!c) return;
    if (c.state === "suspended") c.resume();
    try { fn(); } catch (e) { /* never let audio break the game */ }
  };
  SFX.toggle = function () { SFX.muted = !SFX.muted; return SFX.muted; };

  window.DW_SFX = SFX;
})();
