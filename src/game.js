// DAEMONWARE — Floor 1 vertical slice.
// Contains: floor render, single-token party, VITAE + PNEUMA, foes + pursuit
//           AI, simultaneous round resolution, five operations, click-to-target,
//           drops + pickup, spike hazard, openable cache, exit dialog + win
//           screen, particle bursts and floating combat text.
// Does NOT contain: an inventory window, anything that SPENDS loot, floor 2.
//
// TURN MODEL — a round is MOVE *or* ACT, never both.
//   MOVE: WASD steps the whole circle one tile. WASD NEVER attacks.
//   ACT:  E opens the fan; 1-5 pick any op from any member who has not
//         yet acted, in any order. SPACE commits the round early.
// Either way the round then resolves in phases:
//   1. every foe commits an intent, read off PRE-MOVE positions
//   2. MOVEMENT phase   — circle steps (move rounds), then foes step
//   3. ATTACK phase     — queued operations fire, then foe attacks
//   4. PNEUMA regen, turn ticks
// Intents lock before movement, so an attack aimed at a tile its target
// vacates whiffs. That cuts both ways: foes miss you, and your ranged
// operations miss foes that walked out of range.

(function () {
  const missing = [];
  if (!window.FLOOR01) missing.push('data/floor01.js');
  if (!window.BALANCE) missing.push('data/balance.js');
  if (!window.SPRITES) missing.push('src/sprites.js');
  if (missing.length) {
    document.getElementById('log').innerHTML =
      `<div class="line bad">SCRIPTS NOT LOADED: ${missing.join(', ')}</div>` +
      `<div class="line bad">index.html must sit beside its data/ and src/ folders.</div>`;
    return;
  }

  const F = window.FLOOR01;
  const B = window.BALANCE;
  const S = window.SPRITES;
  const T = 64, CH = 9;

  const key = (c, r) => c + ',' + r;
  const walkable = new Set(F.tiles.map(t => key(t[0], t[1])));
  const propAt = (c, r) => F.props.find(p => p.c === c && p.r === r);
  const cheb = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
  const adjacent = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1;

  // Operations grouped by owner, in hotkey order.
  const OPS_BY = {};
  for (const [name, op] of Object.entries(B.operations)) {
    (OPS_BY[op.by] = OPS_BY[op.by] || []).push({ name, ...op });
  }
  // Flat list in party order -> hotkeys 1..5. OPERATOR:1, CALX:2-3, CINIS:4-5.
  const ALL_OPS = [];
  Object.keys(B.party).forEach(who =>
    (OPS_BY[who] || []).forEach(op => ALL_OPS.push({ owner: who, op })));

  // -------------------------------------------------------------- state

  const state = {
    turn: 1,
    over: null,                    // null | 'SEVERED' | 'CLEARED' | 'WIN'
    modal: null,                   // null | 'exit'
    mode: 'move',                  // 'move' | 'act'
    sel: null,                     // member whose op menu is open (nameplate tap)
    acted: [],                     // member names done this act round (any order)
    aiming: null,                  // member name currently picking a target
    pending: null,                 // { op, member } while aiming
    hover: null,                   // { c, r } under the cursor
    queued: [],                    // [{ member, op, targetId }] this act round
    wards: [],                     // [{ name, def, left }] active timed wards
    cd: {},                        // { opName: rounds remaining }
    circle: {
      c: F.spawns[0].c, r: F.spawns[0].r,
      members: Object.keys(B.party).map(name => ({
        name, ...B.party[name],
        hp: B.party[name].vitae,
        pn: B.party[name].pneuma,
      })),
    },
    foes: F.foes.map((f, i) => ({
      id: i, kind: f.kind, c: f.c, r: f.r,
      ...B.foes[f.kind],
      hp: B.foes[f.kind].vitae,
      awake: false,
    })),
    floats: [],                    // queued floating text, flushed on draw
    bursts: [],                    // queued particle bursts, flushed on draw
    drops: [],                     // [{ id, kind, label, sprite, c, r, amount }]
    bag: { argent: 0, items: [] },  // items: [{ kind, label, sprite }]
    revealed: new Set(),
    log: [],
  };
  let dropSeq = 0;

  const living = () => state.circle.members.filter(m => m.hp > 0);
  const liveFoes = () => state.foes.filter(f => f.hp > 0);
  const foeAt = (c, r) => state.foes.find(f => f.hp > 0 && f.c === c && f.r === r);
  const foeById = id => state.foes.find(f => f.id === id);
  const operator = () => state.circle.members[0];
  // CLEARED is NOT terminal: the floor is empty but you still have to walk to
  // the stairs. Only these two states actually stop play.
  const finished = () => state.over === 'SEVERED' || state.over === 'WIN';
  const blocked = () => finished() || !!state.modal;
  const byName = n => state.circle.members.find(m => m.name === n);
  const hasActed = m => state.acted.includes(m.name);
  const canAct = m => m.hp > 0 && !hasActed(m);
  const pendingMembers = () => living().filter(m => !hasActed(m));
  const wardBonus = () => state.wards.reduce((s, w) => s + w.def, 0);
  const defOf = m => m.def + wardBonus();

  // Floating text is queued during resolution and flushed to the DOM on draw,
  // so it is positioned against the layout that actually exists.
  function float(c, r, text, cls, sub) {
    state.floats.push({ c, r, text, cls, sub });
  }

  // Cosmetic only. `fx` names on operations key into this table.
  const FX = {
    strike: { cls: 'p-bone',  n: 8,  spread: 22, dur: .45 },
    sweep:  { cls: 'p-bone',  n: 12, spread: 38, dur: .55, ring: 'var(--bone)' },
    hex:    { cls: 'p-shell', n: 9,  spread: 18, dur: .70 },
    bolt:   { cls: 'p-gold',  n: 10, spread: 26, dur: .50 },
    burn:   { cls: 'p-blood', n: 16, spread: 32, dur: .60, ring: 'var(--gold)' },
    // paying VITAE is a cost, not an impact: no ring, or IMMOLATIO draws two
    selfburn: { cls: 'p-blood', n: 10, spread: 20, dur: .50 },
    foe:    { cls: 'p-blood', n: 8,  spread: 22, dur: .45 },
    spike:  { cls: 'p-blood', n: 12, spread: 26, dur: .50 },
    pickup: { cls: 'p-gold',  n: 6,  spread: 16, dur: .50 },
  };

  function burst(c, r, name) {
    const fx = FX[name];
    if (fx) state.bursts.push({ c, r, ...fx });
  }

  function log(text, tone) {
    state.log.unshift({ text, tone: tone || '' });
    if (state.log.length > 60) state.log.pop();
  }

  // -------------------------------------------------------------- combat

  function roll(atk, def) {
    const v = B.combat.variance;
    const jitter = Math.floor(Math.random() * (v * 2 + 1)) - v;
    return Math.max(B.combat.minDamage, Math.round(atk - def) + jitter);
  }

  // Exactly one drop per severed enemy, rolled off the weighted table.
  function rollDrop(foe) {
    const table = B.drops.table;
    const total = table.reduce((s, e) => s + e.weight, 0);
    let n = Math.random() * total;
    const pick = table.find(e => (n -= e.weight) < 0) || table[0];
    const d = { id: dropSeq++, ...pick, c: foe.c, r: foe.r };
    if (d.kind === 'ARGENT') {
      const { argentMin: lo, argentMax: hi } = B.drops;
      d.amount = lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    state.drops.push(d);
    log(`${foe.kind} LEAVES ${d.amount ? d.amount + ' ' : ''}${d.label}.`, 'good');
  }

  function collectDrops() {
    const here = state.drops.filter(d => d.c === state.circle.c && d.r === state.circle.r);
    if (!here.length) return;
    state.drops = state.drops.filter(d => !here.includes(d));
    here.forEach(d => {
      const cls = 'f-' + d.kind.toLowerCase();
      burst(d.c, d.r, 'pickup');
      if (d.kind === 'ARGENT') {
        state.bag.argent += d.amount;
        log(`COLLECTED ${d.amount} ARGENT.`, 'good');
        float(d.c, d.r, '+' + d.amount + ' ARGENT', cls, d.rarity);
      } else {
        state.bag.items.push({ kind: d.kind, label: d.label,
                               sprite: d.sprite, rarity: d.rarity });
        log(`COLLECTED ${d.label}.`, 'good');
        float(d.c, d.r, d.label, cls, d.rarity);
      }
    });
  }

  function strikeFoe(member, op, foe) {
    const dmg = roll(member.atk * (op.mult || 1), foe.def);
    foe.hp -= dmg;
    float(foe.c, foe.r, '-' + dmg, 'f-dmg');
    burst(foe.c, foe.r, op.hitFx || op.fx || 'strike');
    if (foe.hp <= 0) {
      foe.hp = 0;
      log(`${op.name} SEVERS ${foe.kind} [${dmg}].`, 'good');
      float(foe.c, foe.r, 'SEVERED', 'f-sever');
      rollDrop(foe);
    } else {
      log(`${op.name} STRIKES ${foe.kind} [${dmg}] \u2014 ${foe.hp} VITAE.`);
    }
  }

  function strikeCircle(foe) {
    const targets = living();
    if (!targets.length) return;
    const t = targets[Math.floor(Math.random() * targets.length)];
    const dmg = roll(foe.atk, defOf(t));
    t.hp -= dmg;
    float(state.circle.c, state.circle.r, '-' + dmg, 'f-hurt', t.name);
    burst(state.circle.c, state.circle.r, 'foe');
    if (t.hp <= 0) {
      t.hp = 0;
      log(`${foe.kind} SEVERS ${t.name} [${dmg}].`, 'bad');
    } else {
      log(`${foe.kind} STRIKES ${t.name} [${dmg}].`, 'bad');
    }
  }

  // ------------------------------------------------------------- foe AI

  function foeIntent(foe) {
    if (foe.hp <= 0) return null;
    const target = state.circle;
    if (!foe.awake && cheb(foe, target) <= foe.aggro) {
      foe.awake = true;
      log(`${foe.kind} WAKES.`, 'bad');
    }
    if (!foe.awake) return { kind: 'idle' };
    if (adjacent(foe, target)) return { kind: 'attack' };
    return { kind: 'step', ...stepToward(foe, target) };
  }

  function stepToward(foe, t) {
    const dc = Math.sign(t.c - foe.c), dr = Math.sign(t.r - foe.r);
    const tries = Math.abs(t.c - foe.c) >= Math.abs(t.r - foe.r)
      ? [[dc, 0], [0, dr]] : [[0, dr], [dc, 0]];
    for (const [mc, mr] of tries) {
      if (!mc && !mr) continue;
      const nc = foe.c + mc, nr = foe.r + mr;
      if (!walkable.has(key(nc, nr))) continue;
      if (nc === t.c && nr === t.r) continue;
      if (foeAt(nc, nr)) continue;
      return { dc: mc, dr: mr };
    }
    return { dc: 0, dr: 0 };
  }

  // ---------------------------------------------------------- operations

  const opsFor = m => OPS_BY[m.name] || [];
  const cdLeft = op => state.cd[op.name] || 0;
  // An op with a legal cost but nothing in reach is a different failure from
  // one you cannot pay for, and the player needs to be able to tell them apart.
  const noTarget = op => op.targets !== 'circle' && validTargets(op).length === 0;
  const usable = (m, op) => affordable(m, op) && !noTarget(op);
  // Nobody left who can do anything -> the only way out of the round is SPACE.
  const isStuck = () => state.mode === 'act' && !state.pending &&
    pendingMembers().every(m => (OPS_BY[m.name] || []).every(op => !usable(m, op)));
  // Every direction blocked by wall or enemy -> the only way out is SPACE too.
  const canStep = () => [[0,-1],[-1,0],[0,1],[1,0]].some(([dc, dr]) => {
    const c = state.circle.c + dc, r = state.circle.r + dr;
    return walkable.has(key(c, r)) && !foeAt(c, r);
  });
  const affordable = (m, op) =>
    m.pn >= op.pn && (!op.vitaeCost || m.hp > op.vitaeCost) && cdLeft(op) === 0;

  // Foes a given op could legally hit right now.
  function validTargets(op) {
    if (op.targets === 'circle') return [];
    return liveFoes().filter(f => cheb(f, state.circle) <= op.range);
  }

  function applyOp(entry) {
    const { member, op } = entry;
    if (member.hp <= 0) return;
    member.pn -= op.pn;
    if (op.cd) state.cd[op.name] = op.cd;

    if (op.vitaeCost) {
      member.hp -= op.vitaeCost;
      if (member.hp <= 0) {
        member.hp = 0;
        log(`${member.name} BURNS ITSELF OUT CASTING ${op.name}.`, 'bad');
        return;
      }
      log(`${member.name} BURNS ${op.vitaeCost} VITAE.`);
      float(state.circle.c, state.circle.r, '-' + op.vitaeCost, 'f-hurt', member.name);
      burst(state.circle.c, state.circle.r, 'selfburn');
    }

    if (op.kind === 'sweep') {
      const hit = liveFoes().filter(f => cheb(f, state.circle) <= op.range);
      if (!hit.length) { log(`${op.name} SCOURS EMPTY AIR.`); return; }
      burst(state.circle.c, state.circle.r, op.fx);
      log(`${op.name} SCOURS ${hit.length} ${hit.length > 1 ? 'ENEMIES' : 'ENEMY'}.`);
      hit.forEach(f => strikeFoe(member, op, f));
      return;
    }

    if (op.kind === 'ward') {
      state.wards.push({ name: op.name, def: op.def, left: op.duration });
      log(`${op.name} SETS. ALL MEMBERS +${op.def} DEF FOR ${op.duration} TURNS.`, 'good');
      return;
    }

    const foe = foeById(entry.targetId);
    if (!foe || foe.hp <= 0) { log(`${op.name} FINDS NOTHING.`); return; }
    if (cheb(foe, state.circle) > op.range) {
      log(`${op.name} FALLS SHORT \u2014 ${foe.kind} MOVED.`);
      return;
    }

    if (op.kind === 'strike') strikeFoe(member, op, foe);
    if (op.kind === 'hex') {
      foe.atk = Math.max(1, foe.atk - op.atk);
      burst(foe.c, foe.r, op.fx || 'hex');
      log(`${op.name} FIXES ${foe.kind} \u2014 ATK NOW ${foe.atk}.`, 'good');
    }
  }

  // ------------------------------------------------------------- rounds

  function resolveRound(move) {
    const foeIntents = state.foes.map(f => ({ foe: f, intent: foeIntent(f) }));

    // --- MOVEMENT -------------------------------------------------------
    if (move && move.kind === 'step') {
      state.circle.c += move.dc; state.circle.r += move.dr;
      onEnter();
      collectDrops();
    }
    if (move && move.kind === 'hold') log('THE CIRCLE HOLDS.');

    for (const { foe, intent } of foeIntents) {
      if (!intent || intent.kind !== 'step' || foe.hp <= 0) continue;
      const nc = foe.c + intent.dc, nr = foe.r + intent.dr;
      if (nc === state.circle.c && nr === state.circle.r) continue;
      if (foeAt(nc, nr)) continue;
      foe.c = nc; foe.r = nr;
    }

    // --- ATTACK ---------------------------------------------------------
    state.queued.forEach(applyOp);
    state.queued = [];

    for (const { foe, intent } of foeIntents) {
      if (!intent || intent.kind !== 'attack' || foe.hp <= 0) continue;
      if (!adjacent(foe, state.circle)) { log(`${foe.kind} STRIKES EMPTY AIR.`); continue; }
      strikeCircle(foe);
    }

    // --- UPKEEP ---------------------------------------------------------
    living().forEach(m => { m.pn = Math.min(m.pneuma, m.pn + B.combat.pneumaRegen); });
    state.wards.forEach(w => { w.left--; });
    state.wards.filter(w => w.left <= 0).forEach(w => log(`${w.name} DECAYS.`));
    state.wards = state.wards.filter(w => w.left > 0);
    for (const k in state.cd) if (state.cd[k] > 0) state.cd[k]--;
    state.turn++;
    state.mode = 'move'; state.acted = []; state.pending = null; state.aiming = null;
    state.sel = null;
    checkEnd();
  }

  // Leaving is a choice, not a state you fall into: CLEARED means the floor is
  // empty, WIN means you actually took the descent.
  function answerExit(yes) {
    if (state.modal !== 'exit') return;
    state.modal = null;
    if (!yes) { log('THE CIRCLE STEPS BACK FROM THE DESCENT.'); return; }
    state.over = 'WIN';
    log('THE CIRCLE TAKES THE DESCENT. FLOOR 01 IS BEHIND YOU.', 'good');
  }

  function checkEnd() {
    if (operator().hp <= 0) {
      state.over = 'SEVERED';
      log('THE OPERATOR IS SEVERED. THE WORK ENDS.', 'bad');
      return;
    }
    if (!liveFoes().length && !state.over) {
      state.over = 'CLEARED';
      log('FLOOR 01 IS QUIET. ALL ENEMIES SEVERED \u2014 THE DESCENT OPENS.', 'good');
    }
  }

  // Hazards bite on EVERY entry. Revealing one is not the same as disarming it.
  function triggerSpikes(label) {
    const pct = B.hazards.spikes.pct;
    const hit = living().map(m => {
      const dmg = Math.max(1, Math.round(m.vitae * pct));
      m.hp = Math.max(0, m.hp - dmg);
      float(state.circle.c, state.circle.r, '-' + dmg, 'f-hurt', m.name);
      burst(state.circle.c, state.circle.r, 'spike');
      return { m, dmg };
    });
    if (!hit.length) return;
    log(label + ' BITES \u2014 ' + hit.map(x => `${x.m.name} ${x.dmg}`).join(', ') + '.', 'bad');
    hit.filter(x => x.m.hp === 0)
       .forEach(x => log(`${x.m.name} IS SEVERED BY THE ${label}.`, 'bad'));
  }

  // The prop under the circle that E would act on, or null.
  function interactable() {
    if (blocked() || state.mode !== 'move') return null;
    const p = propAt(state.circle.c, state.circle.r);
    if (!p) return null;
    if (p.kind === 'chest' && !p.opened) return { prop: p, text: 'OPEN ' + p.label };
    if (p.kind === 'stairs') {
      const left = liveFoes().length;
      // Sealed is a STATE, not a keybind. E still opens the act round here —
      // stealing that key at the exit while enemies close would be cruel.
      if (left) return { prop: p, locked: true,
                         text: 'DESCENT SEALED \u00b7 ' + left + ' ENEM' + (left > 1 ? 'IES' : 'Y') + ' LEFT' };
      return { prop: p, text: 'LEAVE THE FLOOR' };
    }
    return null;
  }

  // Opening costs a turn: the floor still acts while you are elbow-deep in it.
  function openCache(p) {
    p.opened = true;
    const { argentMin: lo, argentMax: hi } = B.cache;
    const argent = lo + Math.floor(Math.random() * (hi - lo + 1));
    state.bag.argent += argent;

    const pool = B.drops.table.filter(e => e.kind !== 'ARGENT');
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let n = Math.random() * total;
    const pick = pool.find(e => (n -= e.weight) < 0) || pool[0];
    state.bag.items.push({ kind: pick.kind, label: pick.label,
                           sprite: pick.sprite, rarity: pick.rarity });

    float(p.c, p.r, '+' + argent + ' ARGENT', 'f-argent', pick.rarity && 'COMMON');
    float(p.c, p.r, pick.label, 'f-' + pick.kind.toLowerCase(), pick.rarity);
    log(`${p.label} OPENED \u2014 ${argent} ARGENT, ${pick.label}.`, 'good');
    resolveRound(null);
  }

  function onEnter() {
    const p = propAt(state.circle.c, state.circle.r);
    if (!p) return;
    const k = key(p.c, p.r);
    if (p.hidden && !state.revealed.has(k)) {
      state.revealed.add(k);
      log('THE CIRCLE TRIPS A CONCEALED ' + p.label + '.', 'bad');
    }
    if (p.kind === 'spikes') triggerSpikes(p.label);
    if (p.kind === 'chest' && !p.opened) log('A ' + p.label + ' SITS HERE. PRESS E.', 'good');
    if (p.kind === 'stairs') {
      const left = liveFoes().length;
      if (left) log('THE ' + p.label + ' IS SEALED. ' + left + ' STILL STAND.', 'bad');
      else log('THE ' + p.label + ' OPENS BELOW. PRESS E.', 'good');
    }
  }

  // ---------------------------------------------------------- act round
  // Any member who has not acted may act, in any order. The round resolves
  // when every living member has committed or the player commits early.

  // The round no longer auto-resolves when the last member commits: the
  // player reviews and presses COMMIT (button or SPACE). The menu advances
  // to the next member who can still act.
  function commitMember(member, op, targetId) {
    state.queued.push({ member, op, targetId });
    state.acted.push(member.name);
    state.pending = null;
    state.aiming = null;
    const next = pendingMembers()[0];
    state.sel = next ? next.name : null;
  }

  // hotkey 0..4 across the flat ALL_OPS list
  function chooseOp(slot) {
    if (blocked()) return;
    const entry = ALL_OPS[slot];
    if (!entry) return;
    const m = byName(entry.owner);
    if (!m || !canAct(m)) return;
    const op = entry.op;
    if (state.mode === 'move') state.mode = 'act';
    state.sel = m.name;
    if (!affordable(m, op)) { log(`${m.name} CANNOT PAY FOR ${op.name}.`); return; }

    if (op.targets === 'circle') { commitMember(m, op); return; }
    if (!validTargets(op).length) { log(`${op.name} HAS NO TARGET IN RANGE.`); return; }
    if (op.targets === 'adjacent') { commitMember(m, op); return; }   // no aiming
    state.pending = { op, member: m };
    state.aiming = m.name;
  }

  function openAct() {
    if (blocked() || state.mode === 'act') return;
    const it = interactable();
    if (it && !it.locked && it.prop.kind === 'chest') { openCache(it.prop); return; }
    if (it && !it.locked && it.prop.kind === 'stairs') { state.modal = 'exit'; return; }
    state.mode = 'act';
    const first = pendingMembers()[0];
    state.sel = first ? first.name : null;
  }

  // Hotkey picks the operation, one click on an enemy fires it. No confirm.
  function clickTile(c, r) {
    if (state.pending) {
      const foe = foeAt(c, r);
      if (!foe) return;
      if (cheb(foe, state.circle) > state.pending.op.range) return;
      commitMember(state.pending.member, state.pending.op, foe.id);
      return;
    }
    // Touch movement. An orthogonal neighbour steps there (same contract as
    // WASD, via moveInput); the circle's own tile holds the ground (SPACE).
    if (state.mode === 'act') return;
    const dc = c - state.circle.c, dr = r - state.circle.r;
    if (dc === 0 && dr === 0) { passOrHold(); return; }
    if (Math.abs(dc) + Math.abs(dr) === 1) moveInput(dc, dr);
  }

  // Keyboard fallback: ENTER fires at the nearest enemy in range.
  function confirmTarget() {
    if (!state.pending) return;
    const near = validTargets(state.pending.op)
      .slice().sort((a, b) => cheb(a, state.circle) - cheb(b, state.circle))[0];
    if (!near) return;
    commitMember(state.pending.member, state.pending.op, near.id);
  }

  function cancel() {
    if (state.pending) { state.pending = null; state.aiming = null; return; }
    if (state.sel) { state.sel = null; return; }
    if (state.mode === 'act' && !state.queued.length) { state.mode = 'move'; state.acted = []; }
  }

  // SPACE: at rest, hold the ground. Mid act round, commit what is queued and
  // let everyone who has not acted stand down.
  function passOrHold() {
    if (blocked()) return;
    if (state.mode === 'act') {
      const idle = pendingMembers();
      if (idle.length) log(idle.map(m => m.name).join(', ') + ' STANDS DOWN.');
      state.pending = null; state.aiming = null;
      resolveRound(null);
    } else {
      resolveRound({ kind: 'hold' });
    }
  }

  // WASD is movement only. Walking into an enemy is simply blocked.
  function moveInput(dc, dr) {
    if (blocked() || state.mode === 'act') return;
    const nc = state.circle.c + dc, nr = state.circle.r + dr;
    if (foeAt(nc, nr)) { log('AN ENEMY BLOCKS THE WAY.'); return; }
    if (!walkable.has(key(nc, nr))) return;
    resolveRound({ kind: 'step', dc, dr });
  }

  // ------------------------------------------------------------- render

  const stage = document.getElementById('stage');

  // Camera. Guarantees tiles render at >= MIN_TILE_PX on screen so they are
  // tappable. When the whole floor fits at that size (desktop), the camera
  // shows everything and never moves. When it doesn't (phones), the viewBox
  // crops to what fits, centred on the circle, clamped to the floor edges.
  // `cam` is read back by tileFromEvent, so pointer math always matches.
  const MIN_TILE_PX = 44;
  let cam = { x: 0, y: 0, w: F.cols * T, h: F.rows * T };

  function updateCamera() {
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;                    // pre-layout: keep full floor
    const fitC = Math.max(3, Math.floor(box.width / MIN_TILE_PX));
    const fitR = Math.max(3, Math.floor(box.height / MIN_TILE_PX));
    const w = Math.min(F.cols, fitC) * T;
    const h = Math.min(F.rows, fitR) * T;
    const x = Math.max(0, Math.min((state.circle.c + .5) * T - w / 2, F.cols * T - w));
    const y = Math.max(0, Math.min((state.circle.r + .5) * T - h / 2, F.rows * T - h));
    cam = { x, y, w, h };
    stage.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }
  updateCamera();

  function plate(c, r, inset) {
    const x = c * T + inset, y = r * T + inset, s = T - inset * 2;
    return `${x + CH},${y} ${x + s - CH},${y} ${x + s},${y + CH} ${x + s},${y + s - CH} ` +
           `${x + s - CH},${y + s} ${x + CH},${y + s} ${x},${y + s - CH} ${x},${y + CH}`;
  }

  function backdrop() {
    let g = `<rect width="${F.cols * T}" height="${F.rows * T}" fill="var(--void)"/>`;
    for (let x = 0; x <= F.cols * T; x += 32)
      g += `<line x1="${x}" y1="0" x2="${x}" y2="${F.rows * T}" stroke="var(--cyan)" stroke-width=".5" opacity=".05"/>`;
    for (let y = 0; y <= F.rows * T; y += 32)
      g += `<line x1="0" y1="${y}" x2="${F.cols * T}" y2="${y}" stroke="var(--cyan)" stroke-width=".5" opacity=".05"/>`;
    for (let i = 0; i < 70; i++)
      g += `<circle cx="${(i * 97) % (F.cols * T)}" cy="${(i * 61) % (F.rows * T)}" r=".9"
                    fill="var(--bone)" opacity="${0.05 + (i % 5) * 0.03}"/>`;
    return g;
  }

  const floorLayer = () => F.tiles.map(([c, r]) =>
    `<polygon points="${plate(c, r, 3)}" fill="#0A1420" stroke="var(--cyan)" stroke-width="1.1" opacity=".85"/>
     <polygon points="${plate(c, r, 11)}" fill="none" stroke="var(--cyan)" stroke-width=".5" opacity=".16"/>`).join('');

  const propLayer = () => F.props.map(p => {
    if (p.hidden && !state.revealed.has(key(p.c, p.r))) return '';
    let spr = p.kind;
    if (p.kind === 'chest' && p.opened) spr = 'chestOpen';
    if (p.kind === 'stairs' && liveFoes().length) spr = 'stairsSealed';
    return `<g transform="translate(${p.c * T},${p.r * T})">${S[spr]()}</g>`;
  }).join('');

  // Range wash + reticles, drawn under the tokens so sprites stay readable.
  function aimLayer() {
    if (!state.pending) return '';
    const op = state.pending.op;
    let g = '';
    for (const [c, r] of F.tiles) {
      if (cheb({ c, r }, state.circle) > op.range) continue;
      g += `<polygon points="${plate(c, r, 3)}" fill="var(--cyan)" opacity=".10"/>`;
    }
    for (const f of validTargets(op)) {
      const hot = state.hover && state.hover.c === f.c && state.hover.r === f.r;
      g += reticle(f.c, f.r, hot ? 'var(--gold)' : 'var(--cyan)', hot ? 2.6 : 1.4, hot);
    }
    return g;
  }

  function reticle(c, r, stroke, w, locked) {
    const x = c * T, y = r * T, a = 13;
    const corner = (cx, cy, sx, sy) =>
      `<path d="M${cx + sx * a} ${cy} L${cx} ${cy} L${cx} ${cy + sy * a}"
             fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
    return corner(x + 4, y + 4, 1, 1) + corner(x + T - 4, y + 4, -1, 1) +
           corner(x + 4, y + T - 4, 1, -1) + corner(x + T - 4, y + T - 4, -1, -1) +
           (locked ? `<circle cx="${x + T / 2}" cy="${y + T / 2}" r="25" fill="none"
                              stroke="${stroke}" stroke-width="1" opacity=".55"/>` : '');
  }

  // Drops draw at 40% scale about the sprite's optical centre, so they read as
  // pickups on the floor rather than as another actor standing on the tile.
  const DROP_SCALE = 0.4;
  const dropLayer = () => state.drops.map(d =>
    `<g transform="translate(${d.c * T},${d.r * T}) translate(32,34)
                   scale(${DROP_SCALE}) translate(-32,-34)" opacity=".95">${S[d.sprite]()}</g>` +
    `<circle cx="${d.c * T + 32}" cy="${d.r * T + 44}" r="1.3" fill="var(--gold)" opacity=".65"/>`
  ).join('');

  function foeLayer() {
    return liveFoes().map(f => {
      const pct = f.hp / f.vitae;
      const alert = f.awake
        ? `<polygon points="${plate(f.c, f.r, 2)}" fill="none" stroke="var(--blood)"
                    stroke-width="1.4" opacity=".7"/>` : '';
      const bar = `<rect x="${f.c * T + 14}" y="${f.r * T + 6}" width="36" height="3.5"
                         fill="var(--void)" stroke="var(--blood)" stroke-width=".6" opacity=".8"/>
                   <rect x="${f.c * T + 14}" y="${f.r * T + 6}" width="${36 * pct}" height="3.5"
                         fill="var(--blood)"/>`;
      return alert + `<g transform="translate(${f.c * T},${f.r * T})">${S[f.sprite]()}</g>` + bar;
    }).join('');
  }

  function vitaePips(c, r) {
    const BW = 16, GAP = 3, H = 3.4;
    const x0 = c * T + (T - (BW * 3 + GAP * 2)) / 2;
    const y0 = r * T + 2.5;
    return state.circle.members.map((m, i) => {
      const x = x0 + i * (BW + GAP);
      const frame = `<rect x="${x}" y="${y0}" width="${BW}" height="${H}" fill="var(--void)"
                           stroke="var(--${m.tint})" stroke-width=".7"
                           opacity="${m.hp > 0 ? '.9' : '.3'}"/>`;
      if (m.hp <= 0)
        return frame + `<line x1="${x}" y1="${y0 + H / 2}" x2="${x + BW}" y2="${y0 + H / 2}"
                              stroke="var(--blood)" stroke-width="1.5"/>`;
      const w = BW * Math.max(0, m.hp / m.vitae);
      return frame + `<rect x="${x}" y="${y0}" width="${w}" height="${H}" fill="var(--${m.tint})"/>`;
    }).join('');
  }

  function circleLayer() {
    const { c, r } = state.circle;
    return `<polygon points="${plate(c, r, 1)}" fill="none" stroke="var(--gold)" stroke-width="2.4"/>
            <g transform="translate(${c * T},${r * T})">${S.party()}</g>` + vitaePips(c, r);
  }

  // ---- roster is built ONCE, then mutated ---------------------------------
  // Rebuilding innerHTML each frame replaces the nodes, which kills every CSS
  // transition. Persistent nodes are what make the drawers slide and the bars
  // fill smoothly.

  const rosterEl = document.getElementById('roster');
  const cards = {};

  function buildRoster() {
    rosterEl.innerHTML = state.circle.members.map(m => {
      return `<div class="unit" data-member="${m.name}" style="--tint:var(--${m.tint})">
                <div class="unit-head">
                  <span class="unit-name">${m.name}</span>
                  <span class="unit-role">${m.type} \u00b7 ${m.role}</span>
                </div>
                <div class="bars">
                  <div class="vitae"><i></i></div>
                  <div class="pneuma"><i></i></div>
                </div>
                <div class="unit-meta"><span class="mv"></span><span class="mp"></span></div>
              </div>`;
    }).join('');

    state.circle.members.forEach(m => {
      const el = rosterEl.querySelector(`.unit[data-member="${m.name}"]`);
      cards[m.name] = {
        el,
        vitae: el.querySelector('.vitae i'),
        pneuma: el.querySelector('.pneuma i'),
        mv: el.querySelector('.mv'),
        mp: el.querySelector('.mp'),
      };
    });

    rosterEl.addEventListener('click', e => {
      if (blocked()) return;
      const card = e.target.closest('.unit');
      if (!card) return;
      const m = byName(card.dataset.member);
      if (!m || !canAct(m)) return;
      if (state.mode === 'move') state.mode = 'act';
      state.pending = null; state.aiming = null;
      state.sel = state.sel === m.name ? null : m.name;   // tap again closes
      draw();
    });
  }

  function syncRoster() {
    state.circle.members.forEach(m => {
      const c = cards[m.name];
      c.el.classList.toggle('acting', state.aiming === m.name);
      c.el.classList.toggle('done', state.mode === 'act' && hasActed(m));
      c.el.classList.toggle('severed', m.hp <= 0);

      c.vitae.style.width  = Math.max(0, m.hp / m.vitae) * 100 + '%';
      c.pneuma.style.width = Math.max(0, m.pn / m.pneuma) * 100 + '%';
      c.mv.textContent = m.hp <= 0 ? 'SEVERED' : 'V ' + m.hp + '/' + m.vitae;
      c.mp.textContent = m.hp <= 0 ? '\u2014' : 'P ' + m.pn + '/' + m.pneuma;

    });
  }

  // ---- floating operations fan, anchored over the party token ------------
  // Built once so its CSS transitions survive; positioned in viewport pixels
  // by inverting the SVG letterbox transform.

  const viewportEl = document.getElementById('viewport');
  const fanEl = document.getElementById('fan');
  const hintEl = document.getElementById('hint');
  const groups = {};

  function buildFan() {
    fanEl.innerHTML = state.circle.members.map(m => {
      const chips = (OPS_BY[m.name] || []).map(op => {
        const slot = ALL_OPS.findIndex(e => e.op.name === op.name);
        return `<div class="chip" data-slot="${slot}" data-op="${op.name}"
                     title="${op.name} \u2014 ${op.note}">
                  <span class="hk">${slot + 1}</span>
                  <span class="cn">${op.name}</span>
                  <span class="cc"></span>
                  <span class="cnote">${op.note}</span>
                </div>`;
      }).join('');
      return `<div class="grp" data-member="${m.name}" style="--tint:var(--${m.tint})">
                <div class="grp-name">${m.name}<em></em></div>${chips}
              </div>`;
    }).join('');

    state.circle.members.forEach(m => {
      const el = fanEl.querySelector(`.grp[data-member="${m.name}"]`);
      groups[m.name] = { el, tag: el.querySelector('em'), chips: [...el.querySelectorAll('.chip')] };
    });

    fanEl.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      e.stopPropagation();
      chooseOp(+chip.dataset.slot);
      draw();
    });
  }

  // Any tile, in pixels relative to #viewport.
  function tilePos(c, r) {
    const box = stage.getBoundingClientRect();
    const vp = viewportEl.getBoundingClientRect();
    const scale = Math.min(box.width / cam.w, box.height / cam.h);
    const ox = (box.width - cam.w * scale) / 2, oy = (box.height - cam.h * scale) / 2;
    return {
      cx: box.left - vp.left + ox + (c * T + T / 2 - cam.x) * scale,
      top: box.top - vp.top + oy + (r * T - cam.y) * scale,
      size: T * scale,
      vpw: vp.width,
    };
  }
  const tokenRect = () => tilePos(state.circle.c, state.circle.r);

  // Several hits can land on one tile in a round, so stack them by delay.
  const floatsEl = document.getElementById('floaters');
  function flushBursts() {
    if (!state.bursts.length) return;
    state.bursts.forEach(b => {
      const pos = tilePos(b.c, b.r);
      const cx = pos.cx, cy = pos.top + pos.size / 2;
      const k = pos.size / T;                    // scale particles with the map
      if (b.ring) {
        const el = document.createElement('div');
        el.className = 'ring';
        el.style.left = cx + 'px'; el.style.top = cy + 'px';
        el.style.borderColor = b.ring;
        el.style.setProperty('--r', (b.spread * 2.1 * k) + 'px');
        el.addEventListener('animationend', () => el.remove());
        floatsEl.appendChild(el);
      }
      for (let i = 0; i < b.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const dist = b.spread * k * (0.45 + Math.random() * 0.55);
        const el = document.createElement('div');
        el.className = 'p ' + b.cls;
        el.style.left = cx + 'px'; el.style.top = cy + 'px';
        el.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(1) + 'px');
        el.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(1) + 'px');
        el.style.setProperty('--dur', (b.dur * (0.8 + Math.random() * 0.4)).toFixed(2) + 's');
        el.addEventListener('animationend', () => el.remove());
        floatsEl.appendChild(el);
      }
    });
    state.bursts.length = 0;
  }

  function flushFloats() {
    if (!state.floats.length) return;
    const seen = {};
    state.floats.forEach(fl => {
      const k = fl.c + ',' + fl.r;
      const idx = seen[k] = (seen[k] === undefined ? 0 : seen[k] + 1);
      const pos = tilePos(fl.c, fl.r);
      const el = document.createElement('div');
      el.className = 'float ' + fl.cls;
      el.innerHTML = fl.text + (fl.sub ? `<small>${fl.sub}</small>` : '');
      el.style.left = pos.cx + 'px';
      el.style.top = (pos.top + pos.size * 0.34) + 'px';
      el.style.animationDelay = (idx * 95) + 'ms';
      el.addEventListener('animationend', () => el.remove());
      floatsEl.appendChild(el);
    });
    state.floats.length = 0;
  }

  // A small tag over the token when there is something here to press E on.
  function syncHint() {
    // While the fan is collapsed for aiming, this tag is the only thing telling
    // you which operation is armed, so it takes priority over the E prompt.
    const aim = state.pending;
    const it = aim ? null : interactable();
    hintEl.classList.toggle('open', !!(aim || it));
    hintEl.classList.toggle('aim', !!aim);
    hintEl.classList.toggle('locked', !!(it && it.locked));
    if (!aim && !it) return;
    hintEl.innerHTML = aim
      ? `<span class="k">\u2316</span> ${aim.member.name} \u00b7 ${aim.op.name}`
      : it.locked ? it.text
      : `<span class="k">E</span> ${it.text}`;
    const t = tokenRect();
    const w = hintEl.offsetWidth;
    hintEl.style.left = Math.min(Math.max(t.cx, w / 2 + 6),
                                 Math.max(w / 2 + 6, t.vpw - w / 2 - 6)) + 'px';
    hintEl.style.top = (t.top - 10) + 'px';
  }

  function syncFan() {
    const open = state.mode === 'act' && !finished() && !!state.sel;
    fanEl.classList.toggle('open', open);
    fanEl.classList.toggle('aiming', !!state.pending);
    if (!open) return;

    state.circle.members.forEach(m => {
      const g = groups[m.name];
      g.el.style.display = m.name === state.sel ? '' : 'none';
      const done = hasActed(m), dead = m.hp <= 0;
      g.el.classList.toggle('done', done || dead);
      g.el.classList.toggle('acting', state.aiming === m.name);
      g.tag.textContent = dead ? 'SEVERED' : done ? 'DONE' : 'P ' + m.pn;

      g.chips.forEach(chip => {
        const op = { name: chip.dataset.op, ...B.operations[chip.dataset.op] };
        const cd = cdLeft(op), blind = noTarget(op);
        chip.querySelector('.cc').textContent =
          cd > 0 ? 'CD ' + cd
          : blind ? 'NO TARGET'
          : (op.pn ? op.pn + 'P' : '\u2014') + (op.vitaeCost ? ' +' + op.vitaeCost + 'V' : '');
        chip.classList.toggle('locked', !usable(m, op) || !canAct(m));
        chip.classList.toggle('untargetable', blind && affordable(m, op));
        chip.classList.toggle('aiming', !!state.pending && state.pending.op.name === op.name);
      });
    });

    // Anchor above the selected member's nameplate, clamped to the viewport.
    const card = cards[state.sel].el.getBoundingClientRect();
    const vp = viewportEl.getBoundingClientRect();
    const w = fanEl.offsetWidth;
    const cx = Math.min(Math.max(card.left + card.width / 2 - vp.left, w / 2 + 6),
                        Math.max(w / 2 + 6, vp.width - w / 2 - 6));
    fanEl.classList.remove('below');
    fanEl.style.left = cx + 'px';
    fanEl.style.top = (card.top - vp.top - 8) + 'px';
  }

  const modalEl = document.getElementById('modal');
  const winEl = document.getElementById('win');

  modalEl.addEventListener('click', e => {
    const b = e.target.closest('[data-answer]');
    if (!b) return;
    answerExit(b.dataset.answer === 'yes');
    draw();
  });
  document.getElementById('again').addEventListener('click', () => window.location.reload());

  function syncOverlays() {
    modalEl.classList.toggle('open', state.modal === 'exit');
    winEl.classList.toggle('open', state.over === 'WIN');

    if (state.modal === 'exit') {
      const onFloor = state.drops.length;
      document.getElementById('dlg-note').textContent = onFloor
        ? 'THE FLOOR IS QUIET. ' + onFloor + ' DROP' + (onFloor > 1 ? 'S' : '')
          + ' STILL LYING THERE.'
        : 'THE FLOOR IS QUIET. NOTHING LEFT BEHIND.';
    }

    if (state.over === 'WIN') {
      const flux = state.bag.items.filter(i => i.kind === 'FLUX').length;
      const data = state.bag.items.filter(i => i.kind === 'DATA').length;
      const dead = state.foes.filter(f => f.hp <= 0).length;
      document.getElementById('win-stats').innerHTML = [
        ['TURNS', state.turn],
        ['ENEMIES SEVERED', dead + ' / ' + state.foes.length],
        ['ARGENT', state.bag.argent],
        ['FLUX CELLS', flux],
        ['DATA BANKS', data],
        ['CIRCLE INTACT', living().length + ' / 3'],
      ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    }
  }

  function draw() {
    updateCamera();
    stage.innerHTML = backdrop() + floorLayer() + propLayer() + aimLayer()
                    + dropLayer() + foeLayer() + circleLayer();
    stage.style.cursor = state.pending ? 'crosshair' : 'default';
    document.getElementById('turn-value').textContent = String(state.turn).padStart(3, '0');

    syncRoster();
    syncFan();
    syncConfirm();
    syncHint();
    syncOverlays();
    flushBursts();
    flushFloats();

    const fx = document.getElementById('effects');
    fx.style.display = state.wards.length ? 'flex' : 'none';
    fx.innerHTML = state.wards.map(w => `<span class="eff">${w.name} <b>${w.left}T</b></span>`).join('')
      + (state.wards.length ? `<span class="eff dim">DEF +${wardBonus()}</span>` : '');

    const flux = state.bag.items.filter(i => i.kind === 'FLUX').length;
    const data = state.bag.items.filter(i => i.kind === 'DATA').length;
    document.getElementById('bag').innerHTML =
      `<span class="bg a">ARGENT <b>${state.bag.argent}</b></span>` +
      `<span class="bg f">FLUX <b>${flux}</b></span>` +
      `<span class="bg d">DATA <b>${data}</b></span>` +
      (state.drops.length ? `<span class="bg drop">${state.drops.length} ON FLOOR</span>` : '');

    document.getElementById('threat').textContent =
      state.over === 'WIN' ? 'DESCENDED'
      : state.over === 'SEVERED' ? 'RUN ENDED'
      : liveFoes().length + ' / ' + state.foes.length + ' ENEMIES';

    const prompt = document.getElementById('prompt');
    if (state.over === 'WIN') prompt.textContent = 'FLOOR 01 COMPLETE.';
    else if (state.over === 'SEVERED') prompt.textContent = 'THE WORK ENDS.';
    else if (state.over === 'CLEARED') prompt.textContent = 'FLOOR QUIET \u2014 THE DESCENT IS OPEN.';
    else if (state.pending)
      prompt.textContent = state.pending.member.name + ' \u2014 CLICK AN ENEMY \u00b7 '
                         + 'ENTER HITS THE NEAREST \u00b7 ESC CANCELS';
    else if (isStuck())
      prompt.textContent = 'NO OPERATION AVAILABLE \u2014 COMMIT THE ROUND';
    else if (state.mode === 'act')
      prompt.textContent = 'TAP A NAMEPLATE OR 1-5 \u2014 COMMIT ENDS THE ROUND';
    else if (!canStep())
      prompt.textContent = 'SURROUNDED \u2014 SPACE HOLDS, TAP A NAMEPLATE TO ACT';
    else prompt.textContent = 'WASD OR TAP MOVES \u2014 TAP A NAMEPLATE OR E TO ACT';
    prompt.className = 'prompt'
      + (state.pending ? ' hot' : '')
      + ((isStuck() || (state.mode === 'move' && !canStep() && !state.over)) ? ' warn' : '');

    document.getElementById('log').innerHTML =
      state.log.map(l => `<div class="line ${l.tone}">${l.text}</div>`).join('');
  }

  // -------------------------------------------------------------- input

  const MOVES = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] };

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();

    if (state.modal === 'exit') {
      e.preventDefault();
      if (k === 'y' || k === 'enter') answerExit(true);
      if (k === 'n' || k === 'escape') answerExit(false);
      draw();
      return;
    }
    if (finished()) return;

    if (MOVES[k]) { e.preventDefault(); moveInput(...MOVES[k]); draw(); return; }
    if (k === ' ')      { e.preventDefault(); passOrHold(); draw(); return; }
    if (k === 'escape') { e.preventDefault(); cancel(); draw(); return; }
    if (k === 'enter')  { e.preventDefault(); confirmTarget(); draw(); return; }
    if (k === 'e')      { e.preventDefault(); openAct(); draw(); return; }
    if (k >= '1' && k <= '5') { e.preventDefault(); chooseOp(+k - 1); draw(); }
  });

  function tileFromEvent(e) {
    const box = stage.getBoundingClientRect();
    // The viewBox is letterboxed by preserveAspectRatio="xMidYMid meet".
    const scale = Math.min(box.width / cam.w, box.height / cam.h);
    const ox = (box.width - cam.w * scale) / 2, oy = (box.height - cam.h * scale) / 2;
    const x = cam.x + (e.clientX - box.left - ox) / scale;
    const y = cam.y + (e.clientY - box.top - oy) / scale;
    return { c: Math.floor(x / T), r: Math.floor(y / T) };
  }

  stage.addEventListener('mousemove', e => {
    if (!state.pending) return;
    const t = tileFromEvent(e);
    if (!state.hover || state.hover.c !== t.c || state.hover.r !== t.r) {
      state.hover = t; draw();
    }
  });
  stage.addEventListener('mouseleave', () => { if (state.hover) { state.hover = null; draw(); } });
  stage.addEventListener('click', e => {
    const t = tileFromEvent(e);
    clickTile(t.c, t.r); draw();
  });

  const confirmEl = document.getElementById('confirm');
  function syncConfirm() {
    const show = state.mode === 'act' && !finished() && !state.pending && !state.sel;
    confirmEl.classList.toggle('open', show);
    if (!show) return;
    const idle = pendingMembers().length, stuck = isStuck();
    confirmEl.classList.toggle('ready', idle === 0 || stuck);
    confirmEl.textContent =
      stuck ? 'NOTHING TO DO \u2014 COMMIT ROUND'
      : idle ? 'COMMIT ROUND \u00b7 ' + idle + ' LEFT'
      : 'COMMIT ROUND';
  }
  confirmEl.addEventListener('click', () => { passOrHold(); draw(); });

  // On touch, the "E \u2014 OPEN" tag over the token is the button for
  // chests and stairs (the roster no longer routes to openAct).
  hintEl.addEventListener('click', () => {
    if (state.pending) return;
    openAct(); draw();
  });

  // Headless test surface. Not used by the game itself.
  window.__DW = { state, chooseOp, clickTile, confirmTarget, cancel, passOrHold,
                  moveInput, openAct, draw, opsFor, ALL_OPS, fanEl, interactable, answerExit, floatsEl };

  buildRoster();
  buildFan();
  window.addEventListener('resize', () => draw());
  log(`FLOOR 01 COMPILED. ${F.tiles.length} CELLS, ${F.foes.length} ENEMIES.`);
  draw();
})();
