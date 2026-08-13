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

  // Intrinsic operations only (ops with a `by` field, i.e. the OPERATOR's
  // bare-hands PERCVSSIO). Everything else is a seated DATA BANK: the bank IS
  // the operation, and a daemon runs whatever archives its two slots hold.
  const INTRINSIC = {};
  for (const [name, op] of Object.entries(B.operations)) {
    if (op.by) (INTRINSIC[op.by] = INTRINSIC[op.by] || []).push({ name, ...op });
  }

  // fold(): resolve one seated bank -> a usable operation. Base stats come
  // from B.operations; every seated flux applies its one modifier. This is
  // the seam the full socket system (series/parallel, strain) replaces later.
  function fold(slot) {
    const base = B.operations[slot.bank];
    const op = { name: slot.bank, ...base, fluxes: slot.fluxes.slice() };
    for (const fid of slot.fluxes) {
      if (!fid) continue;
      const f = B.fluxes[fid];
      if (f.dmgBonus)   op.dmgBonus = (op.dmgBonus || 0) + f.dmgBonus;
      if (f.rangeDelta) op.range += f.rangeDelta;
      if (f.pnDelta && op.pn > 0) op.pn = Math.max(1, op.pn + f.pnDelta);
      if (f.minDmg)     op.minDmg = Math.max(op.minDmg || 0, f.minDmg);
      if (f.vitaeCost)  op.vitaeCost = (op.vitaeCost || 0) + f.vitaeCost;
    }
    return op;
  }

  // Ops for one member, hotkey order: intrinsics first, then seated banks.
  function memberOps(name) {
    const slots = (state.loadout[name] || []);
    return [...(INTRINSIC[name] || []), ...slots.map(fold)];
  }
  // Flat list in party order -> hotkeys 1..5. Rebuilt on every read because
  // the loadout can change mid-run; this list is tiny.
  function allOps() {
    const out = [];
    Object.keys(B.party).forEach(who =>
      memberOps(who).forEach(op => out.push({ owner: who, op })));
    return out;
  }

  // -------------------------------------------------------------- state

  const state = {
    turn: 1,
    // Two bank slots per daemon, seeded from the default loadout. Each slot:
    // { bank, fluxes: [fluxId|null per bay] }. The OPERATOR has no slots.
    loadout: Object.fromEntries(Object.entries(B.defaultLoadout).map(
      ([who, banks]) => [who, banks.map(b =>
        ({ bank: b, fluxes: Array(B.banks[b].bays).fill(null) }))])),
    over: null,                    // null | 'SEVERED' | 'CLEARED' | 'WIN'
    modal: null,                   // null | 'exit' | 'controls' | 'inv'
    mode: 'move',                  // 'move' | 'act'
    sel: null,                     // member whose op menu is open (nameplate tap)
    acted: [],                     // member names done this act round (any order)
    aiming: null,                  // member name currently picking a target
    pending: null,                 // { op, member } while aiming
    hover: null,                   // { c, r } under the cursor
    staged: null,                  // { dc, dr } step awaiting CONFIRM (touch only)
    stepsUsed: 0,                  // tiles walked this round, of combat.stepsPerRound
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
  // `sheet` keys into window.FXSHEETS (data/fxsheets.js): an 8-frame sprite
  // strip that REPLACES the particles+ring when present. `scale` is the
  // rendered size in tiles. If fxsheets.js is missing the particle values
  // below still work, so the game never depends on the art loading.
  const FX = {
    strike: { cls: 'p-bone',  n: 8,  spread: 22, dur: .45, sheet: 'strike', scale: 1.7 },
    sweep:  { cls: 'p-bone',  n: 12, spread: 38, dur: .55, ring: 'var(--bone)', sheet: 'sweep', scale: 3.0 },
    hex:    { cls: 'p-shell', n: 9,  spread: 18, dur: .70, sheet: 'hex',   scale: 1.8 },
    bolt:   { cls: 'p-gold',  n: 10, spread: 26, dur: .50, sheet: 'bolt',  scale: 1.9 },
    burn:   { cls: 'p-blood', n: 16, spread: 32, dur: .60, ring: 'var(--gold)', sheet: 'burn', scale: 2.4 },
    // paying VITAE is a cost, not an impact: no ring, or IMMOLATIO draws two
    selfburn: { cls: 'p-blood', n: 10, spread: 20, dur: .50, sheet: 'selfburn', scale: 1.6 },
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

  // A refusal the player must actually see. log() alone is not enough: the
  // record panel is hidden below 900px, so on a phone a rejected tap produced
  // no output at all. Looked up lazily because this runs before the DOM refs.
  let toastTimer = 0;
  function warn(text, tone) {
    log(text, tone);
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('open'), 2000);
  }

  // -------------------------------------------------------------- combat

  function roll(atk, def, minDmg) {
    const v = B.combat.variance;
    const jitter = Math.floor(Math.random() * (v * 2 + 1)) - v;
    return Math.max(minDmg || B.combat.minDamage, Math.round(atk - def) + jitter);
  }

  // Banks the run already owns, anywhere: seated in a loadout slot or
  // sitting in the bag. Pool banks that appear here never drop again.
  function ownedBanks() {
    const owned = new Set();
    Object.values(state.loadout).forEach(slots =>
      slots.forEach(sl => owned.add(sl.bank)));
    state.bag.items.forEach(i => { if (i.bank) owned.add(i.bank); });
    return owned;
  }

  // Resolve a top-table kind into a concrete item. FLUX rolls one of the five
  // fluxes by weight; DATA rolls the remaining bank pool (no duplicates) and
  // degrades to FLUX once the pool is exhausted.
  function rollItem(kind) {
    if (kind === 'DATA') {
      const owned = ownedBanks();
      const pool = B.drops.bankPool.filter(b => !owned.has(b));
      if (pool.length) {
        const bank = pool[Math.floor(Math.random() * pool.length)];
        return { kind: 'DATA', bank, label: bank, sprite: 'databank', rarity: 'RARE' };
      }
      kind = 'FLUX';                       // pool empty: rare pays out as flux
    }
    const entries = Object.entries(B.fluxes);
    const total = entries.reduce((t, [, f]) => t + f.weight, 0);
    let n = Math.random() * total;
    const [flux] = entries.find(([, f]) => (n -= f.weight) < 0) || entries[0];
    return { kind: 'FLUX', flux, label: flux, sprite: 'flux', rarity: 'UNCOMMON' };
  }

  // Exactly one drop per severed enemy, rolled off the weighted table.
  function rollDrop(foe) {
    const table = B.drops.table;
    const total = table.reduce((s, e) => s + e.weight, 0);
    let n = Math.random() * total;
    const pick = table.find(e => (n -= e.weight) < 0) || table[0];
    const d = pick.kind === 'ARGENT'
      ? { id: dropSeq++, ...pick, c: foe.c, r: foe.r }
      : { id: dropSeq++, ...rollItem(pick.kind), c: foe.c, r: foe.r };
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
        state.bag.items.push({ kind: d.kind, label: d.label, flux: d.flux,
                               bank: d.bank, sprite: d.sprite, rarity: d.rarity });
        log(`COLLECTED ${d.label}.`, 'good');
        float(d.c, d.r, d.label, cls, d.rarity);
      }
    });
  }

  function strikeFoe(member, op, foe) {
    const dmg = roll(member.atk * (op.mult || 1) + (op.dmgBonus || 0), foe.def, op.minDmg);
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

  function foeIntent(foe, claimed) {
    if (foe.hp <= 0) return null;
    const target = state.circle;
    if (!foe.awake && cheb(foe, target) <= foe.aggro) {
      foe.awake = true;
      log(`${foe.kind} WAKES.`, 'bad');
    }
    if (!foe.awake) return { kind: 'idle' };
    if (foe.ai === 'skirmish') return skirmishIntent(foe, claimed);
    // flank (default): claim a free tile beside the circle and path to it.
    // `chase: true` marks pursuit -- resolveRound grants chasers a second
    // step while they are still more than 2 tiles out.
    if (adjacent(foe, target)) return { kind: 'attack' };
    return { kind: 'step', chase: true, ...stepToward(foe, claimTile(foe, claimed), true) };
  }

  // FLANK: each pursuer claims its own free orthogonal tile beside the circle,
  // so foes envelop instead of queueing behind one another. `claimed` is a
  // per-round Set so no two foes chase the same tile.
  function claimTile(foe, claimed) {
    const opts = [[0, -1], [-1, 0], [0, 1], [1, 0]]
      .map(([dc, dr]) => ({ c: state.circle.c + dc, r: state.circle.r + dr }))
      .filter(t => walkable.has(key(t.c, t.r)) && !claimed.has(key(t.c, t.r)))
      .filter(t => { const o = foeAt(t.c, t.r); return !o || o === foe; })
      .sort((a, b) => cheb(foe, a) - cheb(foe, b));
    if (!opts.length) return state.circle;
    claimed.add(key(opts[0].c, opts[0].r));
    return opts[0];
  }

  // SKIRMISH: hangs back until the circle is pinned by another foe, commits
  // then; withdraws when badly hurt; fights only when cornered.
  function skirmishIntent(foe, claimed) {
    const t = state.circle;
    if (foe.hp < foe.vitae * 0.5) {
      const away = stepAway(foe);
      if (away) return { kind: 'step', ...away };
      return adjacent(foe, t) ? { kind: 'attack' } : { kind: 'idle' };
    }
    const pinned = state.foes.some(o =>
      o !== foe && o.hp > 0 && o.awake && adjacent(o, t));
    if (pinned) {
      if (adjacent(foe, t)) return { kind: 'attack' };
      return { kind: 'step', chase: true, ...stepToward(foe, claimTile(foe, claimed), true) };
    }
    if (cheb(foe, t) < 3) {
      const away = stepAway(foe);
      if (away) return { kind: 'step', ...away };
      if (adjacent(foe, t)) return { kind: 'attack' };   // cornered
    }
    return { kind: 'idle' };
  }

  // Step that opens distance from the circle. Null when boxed in.
  function stepAway(foe) {
    const t = state.circle;
    const opts = [[0, -1], [-1, 0], [0, 1], [1, 0]]
      .map(([dc, dr]) => ({ dc, dr, c: foe.c + dc, r: foe.r + dr }))
      .filter(o => walkable.has(key(o.c, o.r)) && !foeAt(o.c, o.r)
                && !(o.c === t.c && o.r === t.r)
                && cheb(o, t) > cheb(foe, t))
      .sort((a, b) => cheb(b, t) - cheb(a, t));
    return opts.length ? { dc: opts[0].dc, dr: opts[0].dr } : null;
  }

  // Display only. foeIntent() wakes foes and writes to the log, so it must never
  // be called from the render path. This reads the same rules with no side
  // effects, and only for foes that are already awake — waking one is still a
  // surprise. Gated by BALANCE.ui.showFoeIntent.
  function previewIntent(foe) {
    if (foe.hp <= 0 || !foe.awake) return null;
    if (adjacent(foe, state.circle)) return { kind: 'attack' };
    return { kind: 'step', ...stepToward(foe, state.circle) };
  }

  function stepToward(foe, t, enterOk) {
    const dc = Math.sign(t.c - foe.c), dr = Math.sign(t.r - foe.r);
    const tries = Math.abs(t.c - foe.c) >= Math.abs(t.r - foe.r)
      ? [[dc, 0], [0, dr]] : [[0, dr], [dc, 0]];
    for (const [mc, mr] of tries) {
      if (!mc && !mr) continue;
      const nc = foe.c + mc, nr = foe.r + mr;
      if (!walkable.has(key(nc, nr))) continue;
      if (!enterOk && nc === t.c && nr === t.r) continue;
      if (nc === state.circle.c && nr === state.circle.r) continue;
      if (foeAt(nc, nr)) continue;
      return { dc: mc, dr: mr };
    }
    return { dc: 0, dr: 0 };
  }

  // ---------------------------------------------------------- operations

  const opsFor = m => memberOps(m.name);
  const cdLeft = op => state.cd[op.name] || 0;
  // An op with a legal cost but nothing in reach is a different failure from
  // one you cannot pay for, and the player needs to be able to tell them apart.
  const noTarget = op => op.targets !== 'circle' && validTargets(op).length === 0;
  const usable = (m, op) => affordable(m, op) && !noTarget(op);
  // Nobody left who can do anything -> the only way out of the round is SPACE.
  const isStuck = () => state.mode === 'act' && !state.pending &&
    pendingMembers().every(m => opsFor(m).every(op => !usable(m, op)));
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
    if (op.kind === 'splash') {
      const hit = [foe, ...liveFoes().filter(f => f !== foe && cheb(f, foe) <= 1)];
      log(`${op.name} BVRSTS OVER ${hit.length} ${hit.length > 1 ? 'ENEMIES' : 'ENEMY'}.`);
      hit.forEach(f => strikeFoe(member, op, f));
    }
    if (op.kind === 'hex') {
      foe.atk = Math.max(1, foe.atk - op.atk);
      burst(foe.c, foe.r, op.fx || 'hex');
      log(`${op.name} FIXES ${foe.kind} \u2014 ATK NOW ${foe.atk}.`, 'good');
    }
  }

  // ------------------------------------------------------------- rounds

  // --- round phasing --------------------------------------------------------
  // A round used to mutate everything — party step, every foe step, every
  // attack, all damage — and hand a single finished state to draw(). That reads
  // as a teleport, not as events. Phases run one step apart so each beat is
  // visible. Input never waits on them: any input flushes the rest instantly,
  // so mashing a direction walks at full speed with no animation at all.
  let phaseQueue = [], phaseTimer = null;

  const animating = () => phaseTimer !== null;

  function runPhases(list) {
    settle();
    phaseQueue = list.filter(Boolean);
    nextPhase();
  }

  function nextPhase() {
    phaseTimer = null;
    if (!phaseQueue.length) return;
    phaseQueue.shift()();
    draw();
    if (phaseQueue.length) phaseTimer = setTimeout(nextPhase, STEP_MS);
  }

  // Run everything still owed, right now. Callers draw afterwards.
  function settle() {
    if (phaseTimer !== null) { clearTimeout(phaseTimer); phaseTimer = null; }
    while (phaseQueue.length) phaseQueue.shift()();
  }

  function resolveRound(move) {
    const claimed = new Set();
    const foeIntents = state.foes.map(f => ({ foe: f, intent: foeIntent(f, claimed) }));
    const foesStep = foeIntents.some(x => x.intent && x.intent.kind === 'step' && x.foe.hp > 0);
    const partyActs = state.queued.length > 0;

    runPhases([
      // --- MOVEMENT ------------------------------------------------------
      // Steps are applied the moment they are input (moveInput), so foes read
      // the circle's final position -- there is no whiff window to dodge into,
      // which is coherent now that intents are no longer telegraphed.
      move && (() => {
        if (move.kind === 'hold') log('THE CIRCLE HOLDS.');
      }),

      foesStep && (() => {
        for (const { foe, intent } of foeIntents) {
          if (!intent || intent.kind !== 'step' || foe.hp <= 0) continue;
          const nc = foe.c + intent.dc, nr = foe.r + intent.dr;
          if (nc === state.circle.c && nr === state.circle.r) continue;
          if (foeAt(nc, nr)) continue;
          foe.c = nc; foe.r = nr;
        }
        // Chasers still more than 2 tiles out take a second step: closing
        // speed 2 matches the circle's stepsPerRound, so pursuit cannot be
        // kited forever. Skirmish retreats stay speed 1 -- catchable.
        for (const { foe, intent } of foeIntents) {
          if (!intent || !intent.chase || foe.hp <= 0) continue;
          if (cheb(foe, state.circle) <= 2) continue;
          const s = stepToward(foe, state.circle);
          foe.c += s.dc; foe.r += s.dr;
        }
      }),

      // --- ATTACK --------------------------------------------------------
      partyActs && (() => {
        state.queued.forEach(applyOp);
        state.queued = [];
      }),

      // --- FOE ATTACKS + UPKEEP ------------------------------------------
      // Always last, always present: the round's bookkeeping lives here and
      // must run even when nothing above did.
      () => {
        state.queued = [];
        for (const { foe, intent } of foeIntents) {
          if (!intent || intent.kind !== 'attack' || foe.hp <= 0) continue;
          if (!adjacent(foe, state.circle)) { log(`${foe.kind} STRIKES EMPTY AIR.`); continue; }
          strikeCircle(foe);
        }

        living().forEach(m => { m.pn = Math.min(m.pneuma, m.pn + B.combat.pneumaRegen); });
        state.wards.forEach(w => { w.left--; });
        state.wards.filter(w => w.left <= 0).forEach(w => log(`${w.name} DECAYS.`));
        state.wards = state.wards.filter(w => w.left > 0);
        for (const k in state.cd) if (state.cd[k] > 0) state.cd[k]--;
        state.turn++; state.stepsUsed = 0;
        state.mode = 'move'; state.acted = []; state.pending = null; state.aiming = null;
        state.sel = null; state.staged = null; state.hover = null;
        view.free = false;                       // snap the camera back to the party
        checkEnd();
      },
    ]);
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

  // Naming a key to a player who has no keyboard is worse than saying nothing.
  const isCoarse = () => window.matchMedia('(pointer:coarse)').matches;
  const actHint = () => isCoarse() ? 'TAP THE TAG ABOVE THE CIRCLE' : 'PRESS E';

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
    const pick = rollItem((pool.find(e => (n -= e.weight) < 0) || pool[0]).kind);
    state.bag.items.push({ kind: pick.kind, label: pick.label, flux: pick.flux,
                           bank: pick.bank, sprite: pick.sprite, rarity: pick.rarity });

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
    if (p.kind === 'chest' && !p.opened) log('A ' + p.label + ' SITS HERE. ' + actHint() + '.', 'good');
    if (p.kind === 'stairs') {
      const left = liveFoes().length;
      if (left) log('THE ' + p.label + ' IS SEALED. ' + left + ' STILL STAND.', 'bad');
      else log('THE ' + p.label + ' OPENS BELOW. ' + actHint() + '.', 'good');
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
    state.hover = null;              // mouseleave is not reliable on touch
    const next = pendingMembers()[0];
    state.sel = next ? next.name : null;
  }

  // Take back the last queued operation. Nothing has been spent yet — pneuma,
  // vitae and cooldowns are all charged by applyOp during resolveRound, not at
  // queue time — so this is a clean pop, not a refund. Unwinding the whole
  // queue is what lets a player who has started an act round change their mind
  // and move instead.
  function undoQueued() {
    const last = state.queued.pop();
    if (!last) return;
    state.acted = state.acted.filter(n => n !== last.member.name);
    state.sel = last.member.name;
    state.pending = null;
    state.aiming = null;
    log(`${last.member.name} TAKES BACK ${last.op.name}.`);
  }

  // hotkey 0..4 across the flat ALL_OPS list
  function chooseOp(slot) {
    if (blocked()) return;
    const entry = allOps()[slot];
    if (!entry) return;
    const m = byName(entry.owner);
    if (!m || !canAct(m)) return;
    const op = entry.op;
    if (state.mode === 'move') state.mode = 'act';
    state.sel = m.name;
    if (!affordable(m, op)) { warn(`${m.name} CANNOT PAY FOR ${op.name}.`); return; }

    if (op.targets === 'circle') { commitMember(m, op); return; }
    if (!validTargets(op).length) { warn(`${op.name} HAS NO TARGET IN RANGE.`); return; }
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
      if (!foe) { warn('TAP AN ENEMY INSIDE THE WASH, OR CANCEL.'); return; }
      if (cheb(foe, state.circle) > state.pending.op.range) {
        warn(foe.kind + ' IS OUT OF RANGE.');
        return;
      }
      commitMember(state.pending.member, state.pending.op, foe.id);
      return;
    }
    if (state.mode === 'act') return;

    const dc = c - state.circle.c, dr = r - state.circle.r;

    // The token's own tile used to hold the ground. It is the largest, most
    // salient object on the board, so "tap the thing I care about" spent the
    // round standing still and taking a free hit. HOLD is a labelled button now.
    if (dc === 0 && dr === 0) { state.staged = null; return; }

    if (Math.abs(dc) + Math.abs(dr) !== 1) {
      // Diagonal and distant taps were silent, which reads as a dropped input.
      state.staged = null;
      if (walkable.has(key(c, r))) warn('THE CIRCLE STEPS ONE TILE, NOT DIAGONALLY.');
      return;
    }

    // A mouse steps on click, as it always has. A finger stages the step and
    // confirms it, because on touch a stray tap is both likely and irreversible:
    // foe intents lock BEFORE movement, so a wasted round hands every awake foe
    // a free approach and every adjacent foe a hit the right step would whiff.
    if (!isCoarse()) { moveInput(dc, dr); return; }
    if (state.staged && state.staged.dc === dc && state.staged.dr === dr) {
      commitStaged();
      return;
    }
    stageStep(dc, dr);
  }

  function stageStep(dc, dr) {
    const nc = state.circle.c + dc, nr = state.circle.r + dr;
    if (foeAt(nc, nr)) { warn('AN ENEMY BLOCKS THE WAY.'); return; }
    if (!walkable.has(key(nc, nr))) { warn('THE FLOOR ENDS THERE.'); return; }
    state.staged = { dc, dr };
  }

  function commitStaged() {
    if (!state.staged) return;
    const { dc, dr } = state.staged;
    state.staged = null;
    moveInput(dc, dr);
  }

  // The CANCEL button unwinds one layer per tap: aiming, then a staged step,
  // then queued operations one at a time, then the act round itself. ESC keeps
  // its own ladder (cancel below) because that is the established desktop feel.
  function backOut() {
    if (state.pending) { state.pending = null; state.aiming = null; state.hover = null; return; }
    if (state.staged) { state.staged = null; return; }
    if (state.queued.length) { undoQueued(); return; }
    state.sel = null;
    if (state.mode === 'act') { state.mode = 'move'; state.acted = []; }
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
    if (state.pending) { state.pending = null; state.aiming = null; state.hover = null; return; }
    if (state.staged) { state.staged = null; return; }
    if (state.sel) { state.sel = null; return; }
    if (state.queued.length) { undoQueued(); return; }
    if (state.mode === 'act') { state.mode = 'move'; state.acted = []; }
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
      resolveRound({ kind: state.stepsUsed ? 'moved' : 'hold' });
    }
  }

  // WASD is movement only. Walking into an enemy is simply blocked.
  function moveInput(dc, dr) {
    if (blocked() || state.mode === 'act') return;
    const nc = state.circle.c + dc, nr = state.circle.r + dr;
    if (foeAt(nc, nr)) { warn('AN ENEMY BLOCKS THE WAY.'); return; }
    if (!walkable.has(key(nc, nr))) { warn('THE FLOOR ENDS THERE.'); return; }
    // The step lands NOW -- hazards and drops fire per tile -- and the round
    // resolves only when the step allowance is spent. With one step banked
    // the player may still open the act menu: move-then-act.
    state.circle.c = nc; state.circle.r = nr;
    state.stepsUsed++;
    onEnter();
    collectDrops();
    if (living().length === 0) { resolveRound(null); return; }
    if (state.stepsUsed >= B.combat.stepsPerRound) resolveRound({ kind: 'moved' });
  }

  // ------------------------------------------------------------- render

  const stage = document.getElementById('stage');

  // Three fixed children of #stage. board and overlay are rebuilt via
  // innerHTML each draw; #actors holds persistent nodes so the CSS
  // transition on .actor can tween tile-to-tile moves (same trick as the
  // roster cards — innerHTML rebuilds kill transitions).
  const bgG      = document.getElementById('bg');
  const boardG   = document.getElementById('board');
  const actorsG  = document.getElementById('actors');
  const overlayG = document.getElementById('overlay');

  const actorNodes = {};                       // key -> persistent <g.actor>
  function actorNode(key, onTop) {
    let el = actorNodes[key];
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.setAttribute('class', 'actor');
      // Party is created first and kept last so it always draws above foes.
      if (onTop || !actorNodes.party) actorsG.appendChild(el);
      else actorsG.insertBefore(el, actorNodes.party);
      actorNodes[key] = el;
    }
    return el;
  }
  // Writing innerHTML recreates the base64 <image> sprite inside, which can
  // flash while the parent is mid-transition. The content only changes when
  // HP or sprite state changes, so skip the write when the string is identical.
  function setActorContent(el, html) {
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
  }
  const placeActor = (el, c, r) => {
    el.style.transform = `translate(${c * T}px,${r * T}px)`;
  };

  // Camera. Guarantees tiles render at >= MIN_TILE_PX on screen so they are
  // tappable. When the whole floor fits at that size (desktop), the camera
  // shows everything and never moves. When it doesn't (phones), the viewBox
  // crops to what fits, centred on the circle, clamped to the floor edges.
  // `cam` is read back by tileFromEvent, so pointer math always matches.
  //
  // 44 is the accessibility floor, and adjacent tiles are contiguous with no
  // gutter — a thumb 3mm off centre steps the wrong way. On a 375px phone it
  // also wastes ~240px of letterbox. Coarse pointers get 64, which yields
  // ~70px tiles through the same clamping.
  const MIN_TILE_PX = window.matchMedia('(pointer:coarse)').matches ? 64 : 44;
  let cam = { x: 0, y: 0, w: F.cols * T, h: F.rows * T };

  // Free look. The camera always cropped the floor on a phone and only ever
  // followed the party, so enemy position — the input to the round's central
  // decision — could simply be off screen with no way to look. Two fingers
  // pan and pinch; committing anything recentres.
  const view = { zoom: 1, ox: 0, oy: 0, free: false };

  // Step duration. MUST match the #actors .actor transition in index.html,
  // both in milliseconds and in curve (linear). The camera recentres on the
  // circle, so if it snaps while the token tweens, the token slides backwards
  // across the screen and then catches up — worse than no tween at all.
  // One step's worth of time and shape, shared by three things that must agree:
  // the token's CSS transition, the camera lerp, and the gap between round
  // phases. Published as CSS vars so index.html cannot drift from this file.
  // Discrete grid steps read better arriving than travelling, hence ease-out.
  const STEP_MS = 140;
  const CURVE = [.22, .61, .36, 1];
  let camTween = null;
  actorsG.style.setProperty('--step', STEP_MS + 'ms');
  actorsG.style.setProperty('--ease', `cubic-bezier(${CURVE.join(',')})`);

  // Same cubic-bezier the CSS transition uses, solved for y at a given x.
  // Bisection, because exactness matters less than the two curves matching.
  function ease(t) {
    const [x1, y1, x2, y2] = CURVE;
    const at = (a, b, u) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 20; i++) {
      const x = at(x1, x2, u);
      if (Math.abs(x - t) < 1e-4) break;
      if (x < t) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return at(y1, y2, u);
  }

  function applyCam(c) {
    cam = c;
    stage.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
  }

  function updateCamera(snap) {
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;                    // pre-layout: keep full floor
    const px = MIN_TILE_PX * view.zoom;
    const fitC = Math.max(3, Math.floor(box.width / px));
    const fitR = Math.max(3, Math.floor(box.height / px));
    const w = Math.min(F.cols, fitC) * T;
    const h = Math.min(F.rows, fitR) * T;
    const cx = view.free ? view.ox : (state.circle.c + .5) * T;
    const cy = view.free ? view.oy : (state.circle.r + .5) * T;
    const x = Math.max(0, Math.min(cx - w / 2, F.cols * T - w));
    const y = Math.max(0, Math.min(cy - h / 2, F.rows * T - h));

    if (camTween) { cancelAnimationFrame(camTween); camTween = null; }

    // Snap, never tween: first paint, resize/zoom (w or h changed), and
    // free-look panning, which must track the finger with no lag.
    if (snap || view.free || w !== cam.w || h !== cam.h) { applyCam({ x, y, w, h }); return; }
    if (x === cam.x && y === cam.y) return;

    const fx = cam.x, fy = cam.y, t0 = performance.now();
    const step = now => {
      const k = ease(Math.min(1, (now - t0) / STEP_MS));
      applyCam({ x: fx + (x - fx) * k, y: fy + (y - fy) * k, w, h });
      // Edge markers are positioned against cam, so they must repaint with it.
      overlayG.innerHTML = edgeLayer();
      camTween = (now - t0) < STEP_MS ? requestAnimationFrame(step) : null;
    };
    camTween = requestAnimationFrame(step);
  }
  updateCamera(true);
  bgG.innerHTML = backdrop();     // depends only on floor dimensions: never changes

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

  // Persistent actor nodes: inner content (sprite, bars, rings) is rebuilt
  // each draw in LOCAL coordinates; only the outer transform carries the
  // tile position, so the CSS transition tweens every step.
  function syncActors() {
    const seen = new Set();

    for (const f of liveFoes()) {
      const key = 'foe' + f.id;
      seen.add(key);
      const pct = f.hp / f.vitae;
      const alert = f.awake
        ? `<polygon points="${plate(0, 0, 2)}" fill="none" stroke="var(--blood)"
                    stroke-width="1.4" opacity=".7"/>` : '';
      const bar = `<rect x="14" y="6" width="36" height="3.5"
                         fill="var(--void)" stroke="var(--blood)" stroke-width=".6" opacity=".8"/>
                   <rect x="14" y="6" width="${36 * pct}" height="3.5"
                         fill="var(--blood)"/>`;
      const el = actorNode(key);
      setActorContent(el, alert + S[f.sprite]() + bar);
      placeActor(el, f.c, f.r);
    }

    seen.add('party');
    const p = actorNode('party', true);
    setActorContent(p, `<polygon points="${plate(0, 0, 1)}" fill="none"
                            stroke="var(--gold)" stroke-width="2.4"/>`
                + S.party() + vitaePips(0, 0));
    placeActor(p, state.circle.c, state.circle.r);

    for (const k in actorNodes)
      if (!seen.has(k)) { actorNodes[k].remove(); delete actorNodes[k]; }
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

  // The four legal steps, outlined. Nothing on the board used to say which
  // tiles were the move buttons, so a diagonal tap did nothing with no feedback.
  function moveLayer() {
    if (state.mode !== 'move' || state.pending || finished() || !isCoarse()) return '';
    return [[0, -1], [-1, 0], [0, 1], [1, 0]].map(([dc, dr]) => {
      const c = state.circle.c + dc, r = state.circle.r + dr;
      if (!walkable.has(key(c, r)) || foeAt(c, r)) return '';
      if (state.staged && state.staged.dc === dc && state.staged.dr === dr) return '';
      return `<polygon points="${plate(c, r, 9)}" fill="none" stroke="var(--cyan)"
                       stroke-width="1.2" opacity=".35"/>`;
    }).join('');
  }

  // What each awake foe has already committed to this round. The turn model's
  // whole point is that intents lock before movement, so stepping out of reach
  // makes an attack whiff — a player who cannot see the intent cannot make
  // that read, and on touch the commit is a single irreversible tap.
  function intentLayer() {
    if (!B.ui || !B.ui.showFoeIntent || finished()) return '';
    let g = '', struck = false;
    for (const f of liveFoes()) {
      const it = previewIntent(f);
      if (!it) continue;
      if (it.kind === 'attack') {
        if (struck) continue;
        struck = true;
        g += `<polygon points="${plate(state.circle.c, state.circle.r, 5)}" fill="none"
                       stroke="var(--blood)" stroke-width="1.6" stroke-dasharray="4 4"
                       opacity=".75"/>`;
        continue;
      }
      if (!it.dc && !it.dr) continue;
      g += `<polygon points="${plate(f.c + it.dc, f.r + it.dr, 20)}"
                     fill="var(--blood)" opacity=".3"/>`;
    }
    return g;
  }

  // Awake foes the camera has cropped away, pinned to the edge they sit beyond.
  function edgeLayer() {
    const x1 = cam.x + cam.w, y1 = cam.y + cam.h;
    return liveFoes().filter(f => f.awake).map(f => {
      const fx = f.c * T + T / 2, fy = f.r * T + T / 2;
      if (fx > cam.x && fx < x1 && fy > cam.y && fy < y1) return '';
      const px = Math.max(cam.x + 13, Math.min(fx, x1 - 13));
      const py = Math.max(cam.y + 13, Math.min(fy, y1 - 13));
      return `<circle cx="${px}" cy="${py}" r="5.5" fill="var(--blood)" opacity=".85"/>
              <circle cx="${px}" cy="${py}" r="11" fill="none" stroke="var(--blood)"
                      stroke-width="1" opacity=".45"/>`;
    }).join('');
  }

  // Where a staged step would land, before it is paid for.
  function stagedLayer() {
    if (!state.staged) return '';
    const c = state.circle.c + state.staged.dc, r = state.circle.r + state.staged.dr;
    return `<polygon points="${plate(c, r, 3)}" fill="var(--gold)" opacity=".14"/>
            <polygon points="${plate(c, r, 1)}" fill="none" stroke="var(--gold)"
                     stroke-width="2" stroke-dasharray="6 4" opacity=".9"/>
            <g transform="translate(${c * T},${r * T})" opacity=".38">${S.party()}</g>`;
  }

  // ---- roster is built ONCE, then mutated ---------------------------------
  // Rebuilding innerHTML each frame replaces the nodes, which kills every CSS
  // transition. Persistent nodes are what make the drawers slide and the bars
  // fill smoothly.

  const rosterEl = document.getElementById('roster');
  const cards = {};

  function buildRoster() {
    rosterEl.innerHTML = state.circle.members.map(m => {
      return `<div class="unit" data-member="${m.name}" style="--tint:var(--${m.tint})"
                   role="button" tabindex="0" aria-label="${m.name}, ${m.role}">
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
      if (blocked() || !tapOk()) return;
      const card = e.target.closest('.unit');
      if (!card) return;
      const m = byName(card.dataset.member);
      if (!m || !canAct(m)) return;
      if (state.mode === 'move') state.mode = 'act';
      state.pending = null; state.aiming = null;
      state.sel = state.sel === m.name ? null : m.name;   // tap again closes
      draw();
    });
    rosterEl.addEventListener('keydown', activateOnKey);
  }

  // role="button" on a div is a promise that the keyboard can activate it.
  // stopPropagation keeps the window-level handler from also firing, which
  // would double-dispatch SPACE into passOrHold.
  function activateOnKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const btn = e.target.closest('[role="button"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    btn.click();
  }

  function syncRoster() {
    state.circle.members.forEach(m => {
      const c = cards[m.name];
      c.el.setAttribute('aria-pressed', String(state.sel === m.name));
      c.el.setAttribute('aria-disabled', String(!canAct(m)));
      c.el.classList.toggle('sel', state.sel === m.name);
      c.el.classList.toggle('acting', state.aiming === m.name);
      c.el.classList.toggle('done', state.mode === 'act' && hasActed(m));
      c.el.classList.toggle('severed', m.hp <= 0);

      c.vitae.style.width  = Math.max(0, m.hp / m.vitae) * 100 + '%';
      c.pneuma.style.width = Math.max(0, m.pn / m.pneuma) * 100 + '%';
      c.mv.textContent = m.hp <= 0 ? 'SEVERED' : 'V ' + m.hp + '/' + m.vitae;
      c.mp.textContent = m.hp <= 0 ? '\u2014' : 'P ' + m.pn + '/' + m.pneuma;

    });
  }

  // ---- floating operations fan, anchored over the selected nameplate -----
  // Built once so its CSS transitions survive; positioned in viewport pixels.

  const viewportEl = document.getElementById('viewport');
  const actionbarEl = document.getElementById('actionbar');
  const fanEl = document.getElementById('fan');
  const hintEl = document.getElementById('hint');
  const groups = {};

  // Chips are rebuilt whenever the loadout changes: a seated bank IS the
  // operation, so the fan must always mirror state.loadout, not a load-time
  // snapshot. Listeners stay on fanEl (delegated), so rebuilding is safe.
  function renderFanChips() {
    const flat = allOps();
    fanEl.innerHTML = state.circle.members.map(m => {
      const chips = memberOps(m.name).map(op => {
        const slot = flat.findIndex(e => e.owner === m.name && e.op.name === op.name);
        const seated = (op.fluxes || []).filter(Boolean);
        const fluxTag = seated.length
          ? `<span class="cflux">\u2b21 ${seated.join(' \u00b7 ')}</span>` : '';
        return `<div class="chip" data-slot="${slot}" data-op="${op.name}"
                     role="button" tabindex="0" aria-label="${op.name}. ${op.note}">
                  <span class="hk">${slot + 1}</span>
                  <span class="cn">${op.name}</span>
                  <span class="cc"></span>
                  <span class="cnote">${op.note}</span>${fluxTag}
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
  }

  function buildFan() {
    renderFanChips();

    fanEl.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      e.stopPropagation();
      if (!tapOk()) return;
      chooseOp(+chip.dataset.slot);
      draw();
    });
    fanEl.addEventListener('keydown', activateOnKey);
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

      // Sprite strip takes over the whole burst when its art is available.
      const art = b.sheet && window.FXSHEETS && window.FXSHEETS[b.sheet];
      if (art) {
        const px = Math.round(pos.size * (b.scale || 1.7));
        const el = document.createElement('div');
        el.className = 'fxsheet';
        el.style.left = cx + 'px'; el.style.top = cy + 'px';
        el.style.width = px + 'px'; el.style.height = px + 'px';
        el.style.backgroundImage = 'url(' + art + ')';
        el.style.setProperty('--dur', b.dur + 's');
        el.addEventListener('animationend', () => el.remove());
        floatsEl.appendChild(el);
        return;                                  // art replaces particles+ring
      }

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

  // A tag over the token when there is something here to act on.
  function syncHint() {
    // This tag renders on the tile NORTH of the token, so it is only ever worth
    // the occlusion when it is the sole route to an interaction. It used to
    // also carry the armed operation while aiming, which laid a full-width bar
    // across the row the player was aiming into and hid the reachable tiles.
    // That readout moved to #armed in the action bar; this stays click-through
    // chrome for caches and stairs, and closes entirely during aim.
    const it = state.pending ? null : interactable();
    hintEl.classList.toggle('open', !!it);
    hintEl.classList.toggle('aim', false);
    hintEl.classList.toggle('locked', !!(it && it.locked));
    // Only interactive when there is actually something here to open. Any other
    // state must stay click-through, or the tag blocks the tile behind it.
    hintEl.classList.toggle('actionable', !!it && !it.locked);
    if (!it) return;
    hintEl.innerHTML = it.locked ? it.text : `<span class="k">E</span> ${it.text}`;
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
        const locked = !usable(m, op) || !canAct(m);
        chip.setAttribute('aria-disabled', String(locked));
        chip.classList.toggle('locked', locked);
        chip.classList.toggle('untargetable', blind && affordable(m, op));
        chip.classList.toggle('aiming', !!state.pending && state.pending.op.name === op.name);
      });
    });

    // Anchor above the selected member's nameplate, clamped to the viewport.
    const card = cards[state.sel].el.getBoundingClientRect();
    const vp = viewportEl.getBoundingClientRect();

    // Keep clear of the action bar along the bottom of the map. COMMIT is
    // visible during act rounds now, so anchoring straight to the nameplate
    // would put the fan underneath it. Measured rather than a constant, so it
    // survives the bar changing height. The 12 covers the fan's tether.
    const barTop = actionbarEl.getBoundingClientRect().top - vp.top;

    // A landscape phone's map area is shorter than a five-chip group, so there
    // is no position that fits. Cap the group to the band above the bar and let
    // it scroll: covering COMMIT would be worse than scrolling for a chip.
    // 36 = the fan's own padding and border, plus the 9px tether. Set before
    // measuring, so the height read below is the capped one.
    fanEl.style.setProperty('--fan-max', Math.max(60, barTop - 36) + 'px');

    const w = fanEl.offsetWidth, h = fanEl.offsetHeight;
    const cardCx = card.left + card.width / 2 - vp.left;
    const cx = Math.min(Math.max(cardCx, w / 2 + 6),
                        Math.max(w / 2 + 6, vp.width - w / 2 - 6));
    // `top` is the fan's BOTTOM edge — it is drawn with translateY(-100%). The
    // lower clamp keeps it off the header.
    const top = Math.max(h + 6, Math.min(card.top - vp.top - 8, barTop - 12));
    fanEl.style.left = cx + 'px';
    fanEl.style.top = top + 'px';
    // The tether is pinned at left:50% of the fan, but the fan is clamped and
    // the nameplate is not, so for the outer members it pointed at nothing.
    fanEl.style.setProperty('--tether', (cardCx - cx) + 'px');
  }

  const modalEl = document.getElementById('modal');
  const winEl = document.getElementById('win');
  const ctlEl = document.getElementById('controls');
  const helpEl = document.getElementById('help');
  const satchelEl = document.getElementById('satchel');

  // "Goes away forever" is a stored fact, not a session flag. Wrapped because
  // localStorage throws outright in some privacy modes and on some file://
  // origins, and the controls screen is not worth taking the boot down with it.
  const SEEN_KEY = 'dw:controls-seen:v1';
  function seenControls() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markControlsSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode */ }
  }

  function openControls() {
    // Never displace a live exit prompt or the win screen.
    if (state.modal || finished()) return;
    state.modal = 'controls';
  }
  function closeControls() {
    if (state.modal !== 'controls') return;
    state.modal = null;
    markControlsSeen();
  }

  helpEl.addEventListener('click', () => {
    if (!tapOk()) return;
    openControls(); draw();
  });
  document.getElementById('ctl-close').addEventListener('click', () => {
    if (!tapOk()) return;
    closeControls(); draw();
  });

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

    const ctlOpen = state.modal === 'controls';
    ctlEl.classList.toggle('open', ctlOpen);
    // First sight of the game gets BEGIN; every later visit is a reference
    // lookup and CLOSE is the honest label for it.
    document.getElementById('ctl-close').textContent =
      seenControls() ? 'CLOSE' : 'BEGIN';
    helpEl.classList.toggle('hide', !!state.modal || finished());
    // Same rule as the ? handle: a live-looking button behind an overlay, or
    // after the run is decided, reads as a broken one.
    satchelEl.classList.toggle('hide', !!state.modal || finished());
    satchelEl.querySelector('.dot').hidden = !state.bag.items.length;

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
    boardG.innerHTML = floorLayer() + propLayer() + aimLayer()
                     + moveLayer() + intentLayer() + dropLayer() + stagedLayer();
    syncActors();
    overlayG.innerHTML = edgeLayer();
    stage.style.cursor = state.pending ? 'crosshair' : 'default';
    document.getElementById('turn-value').textContent = String(state.turn).padStart(3, '0');

    syncRoster();
    syncFan();
    syncConfirm();
    syncCancel();
    syncArmed();
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
      prompt.textContent = state.pending.member.name + (isCoarse()
        ? ' \u2014 TAP AN ENEMY IN THE WASH \u00b7 CANCEL BACKS OUT'
        : ' \u2014 CLICK AN ENEMY \u00b7 ENTER HITS THE NEAREST \u00b7 ESC CANCELS');
    else if (isStuck())
      prompt.textContent = 'NO OPERATION AVAILABLE \u2014 COMMIT THE ROUND';
    else if (state.mode === 'act')
      prompt.textContent = isCoarse()
        ? 'TAP A NAMEPLATE \u2014 COMMIT ENDS THE ROUND'
        : 'TAP A NAMEPLATE OR 1-5 \u2014 COMMIT ENDS THE ROUND';
    else if (state.staged)
      prompt.textContent = 'CONFIRM THE STEP, OR TAP ANOTHER TILE';
    else if (!canStep())
      prompt.textContent = isCoarse()
        ? 'SURROUNDED \u2014 HOLD GROUND, OR TAP A NAMEPLATE TO ACT'
        : 'SURROUNDED \u2014 SPACE HOLDS, TAP A NAMEPLATE TO ACT';
    else if (state.stepsUsed > 0)
      prompt.textContent = isCoarse()
        ? 'ONE STEP LEFT \u2014 TAP A TILE OR A NAMEPLATE \u00b7 HOLD ENDS'
        : 'ONE STEP LEFT \u2014 WASD, E ACTS, SPACE HOLDS';
    else prompt.textContent = isCoarse()
      ? 'TAP A TILE TO STEP \u2014 TAP A NAMEPLATE TO ACT'
      : 'WASD OR TAP MOVES \u2014 TAP A NAMEPLATE OR E TO ACT';
    prompt.className = 'prompt'
      + (state.pending ? ' hot' : '')
      + ((isStuck() || (state.mode === 'move' && !canStep() && !state.over)) ? ' warn' : '');

    document.getElementById('log').innerHTML =
      state.log.map(l => `<div class="line ${l.tone}">${l.text}</div>`).join('');
  }

  // -------------------------------------------------------------- input

  // One clock shared by EVERY pointer entry point. Same-element double-fire and
  // cross-element fall-through (a control drops pointer-events while it is still
  // fading, so the second tap lands on the map) are the same bug, and a shared
  // clock is what fixes both. Keyboard paths are deliberately not gated.
  let lastTap = 0;
  function tapOk() {
    if (animating()) settle();       // as does a tap; every pointer path runs this
    const t = Date.now();
    if (t - lastTap < 200) return false;
    lastTap = t;
    return true;
  }

  const MOVES = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] };

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (animating()) settle();       // a keypress finishes the round in flight

    // A focused button owns ENTER and SPACE. Without this the window handler
    // preventDefaults them and the button's own activation never runs.
    const focused = document.activeElement;
    if (focused && focused.tagName === 'BUTTON' && (k === ' ' || k === 'enter')) return;

    if (state.modal === 'controls') {
      e.preventDefault();
      if (k === 'escape' || k === 'enter' || k === ' ' || k === '?') closeControls();
      draw();
      return;
    }
    if (state.modal === 'exit') {
      e.preventDefault();
      if (k === 'y' || k === 'enter') answerExit(true);
      if (k === 'n' || k === 'escape') answerExit(false);
      draw();
      return;
    }
    if (state.modal === 'inv') {
      e.preventDefault();
      if (k === 'escape' || k === 'i') closeInv();
      draw();
      return;
    }
    // The satchel opens from anywhere outside a modal, including the win
    // screen: reading your haul after the descent is half the reward.
    if (k === 'i') { e.preventDefault(); openInv(); draw(); return; }
    if (finished()) return;

    // ? is a reference lookup, so it stays available mid-round.
    if (k === '?') { e.preventDefault(); openControls(); draw(); return; }

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
    // A long press already answered this gesture; the browser still sends the
    // click, and letting it through would consume a round.
    if (longPressed) { longPressed = false; return; }
    if (!tapOk()) return;
    hideInspect();
    const t = tileFromEvent(e);
    clickTile(t.c, t.r); draw();
  });

  // ---- long press to inspect ---------------------------------------------
  // The only safe, non-committal gesture on the board. Without it, the way to
  // find out about a tile is to tap it, and tapping spends the round.

  const inspectEl = document.getElementById('inspect');
  let pressTimer = 0, pressAt = null, longPressed = false;

  function endPress() { clearTimeout(pressTimer); pressTimer = 0; pressAt = null; }
  function hideInspect() { inspectEl.classList.remove('open'); }

  function showInspect(c, r) {
    const foe = foeAt(c, r);
    const prop = propAt(c, r);
    let html;
    if (foe) {
      const it = previewIntent(foe);
      html = `<b>${foe.kind}</b><span>${foe.type}</span>
              <span>VITAE ${foe.hp}/${foe.vitae}</span>
              <span>ATK ${foe.atk} · DEF ${foe.def}</span>
              <span class="${foe.awake ? 'bad' : ''}">${
                !foe.awake ? 'DORMANT'
                : it && it.kind === 'attack' ? 'WILL STRIKE THE CIRCLE'
                : 'CLOSING IN'}</span>`;
    } else if (c === state.circle.c && r === state.circle.r) {
      html = '<b>THE CIRCLE</b>' + state.circle.members.map(m =>
        `<span>${m.name} — V ${m.hp}/${m.vitae} · P ${m.pn}/${m.pneuma}</span>`).join('');
    } else if (prop && (!prop.hidden || state.revealed.has(key(c, r)))) {
      html = `<b>${prop.label}</b><span>${prop.kind.toUpperCase()}</span>`;
    } else if (walkable.has(key(c, r))) {
      html = `<b>FLOOR ${c},${r}</b><span>NOTHING HERE</span>`;
    } else {
      return;
    }
    inspectEl.innerHTML = html;
    inspectEl.classList.add('open');
  }

  stage.addEventListener('pointerdown', e => {
    endPress();
    pressAt = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => {
      pressTimer = 0;
      longPressed = true;
      const t = tileFromEvent(e);
      showInspect(t.c, t.r);
    }, 450);
  });
  stage.addEventListener('pointerup', endPress);
  stage.addEventListener('pointercancel', endPress);
  stage.addEventListener('pointermove', e => {
    if (!pressTimer || !pressAt) return;
    if (Math.abs(e.clientX - pressAt.x) > 10 || Math.abs(e.clientY - pressAt.y) > 10) endPress();
  });
  inspectEl.addEventListener('click', hideInspect);

  // ---- two-finger pan and pinch -------------------------------------------
  // Two fingers rather than one, so this never competes with a tap-to-step.

  let pinch = null;
  stage.addEventListener('touchstart', e => {
    if (e.touches.length !== 2) return;
    endPress();
    const [a, b] = e.touches;
    pinch = {
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      mx: (a.clientX + b.clientX) / 2,
      my: (a.clientY + b.clientY) / 2,
      zoom: view.zoom,
    };
    if (!view.free) {
      view.free = true;
      view.ox = (state.circle.c + .5) * T;
      view.oy = (state.circle.r + .5) * T;
    }
  }, { passive: true });

  stage.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    const [a, b] = e.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
    const box = stage.getBoundingClientRect();
    const scale = Math.min(box.width / cam.w, box.height / cam.h);
    view.ox -= (mx - pinch.mx) / scale;
    view.oy -= (my - pinch.my) / scale;
    view.zoom = Math.max(0.55, Math.min(2.2, pinch.zoom * (dist / pinch.dist)));
    pinch.mx = mx; pinch.my = my;
    draw();
  }, { passive: true });

  stage.addEventListener('touchend', () => { pinch = null; }, { passive: true });

  // The primary action button. It used to hide whenever a member was selected \u2014
  // but selecting a member is HOW you open the fan, so COMMIT vanished exactly
  // when the prompt was telling the player to press it. It is now visible in
  // move rounds too, because holding the ground is a real play and used to be
  // reachable only by tapping your own token (or SPACE).
  const confirmEl = document.getElementById('confirm');
  function syncConfirm() {
    const show = !finished() && !state.modal && !state.pending;
    confirmEl.classList.toggle('open', show);
    if (!show) return;

    if (state.mode === 'act') {
      const idle = pendingMembers().length, stuck = isStuck();
      confirmEl.classList.toggle('ready', idle === 0 || stuck);
      confirmEl.textContent =
        stuck ? 'NOTHING TO DO \u2014 COMMIT ROUND'
        : idle ? 'COMMIT ROUND \u00b7 ' + idle + ' LEFT'
        : 'COMMIT ROUND';
      return;
    }
    confirmEl.classList.toggle('ready', !!state.staged);
    confirmEl.textContent = state.staged ? 'CONFIRM STEP' : 'HOLD GROUND';
  }
  confirmEl.addEventListener('click', () => {
    if (!tapOk()) return;
    if (state.staged) commitStaged(); else passOrHold();
    draw();
  });

  // What is armed, shown in the action bar rather than over the board. The fan
  // is collapsed and #confirm is hidden while pending, so without this the only
  // on-screen trace of the chosen operation is the HUD prompt line.
  const armedEl = document.getElementById('armed');
  function syncArmed() {
    const aim = !finished() && !state.modal && state.pending;
    armedEl.classList.toggle('open', !!aim);
    if (!aim) return;
    armedEl.innerHTML =
      `<span class="k">\u2316</span>${aim.member.name} \u00b7 ${aim.op.name}`;
  }

  // One tap out of aiming, out of a staged step, out of the act round.
  const cancelEl = document.getElementById('cancel');
  function syncCancel() {
    // Queued operations no longer suppress this. They cost nothing until
    // COMMIT, so being unable to take one back was a trap: pick an operation
    // by mistake and the act round was the only way out, with no way to
    // change your mind and move instead.
    const show = !finished() && !state.modal &&
      (!!state.pending || !!state.staged || state.mode === 'act');
    cancelEl.classList.toggle('open', show);
    if (!show) return;
    cancelEl.classList.toggle('hot', !!state.pending);
    cancelEl.textContent =
      state.pending ? '\u00d7 CANCEL'
      : state.staged ? '\u00d7 CLEAR'
      : state.queued.length ? '\u00d7 UNDO'
      : '\u00d7 BACK';
  }
  cancelEl.addEventListener('click', () => {
    if (!tapOk()) return;
    backOut(); draw();
  });

  // On touch, the "OPEN" tag over the token is the button for chests and
  // stairs (the roster no longer routes to openAct).
  hintEl.addEventListener('click', () => {
    if (!tapOk()) return;
    const it = interactable();
    if (state.pending || !it || it.locked) return;
    openAct(); draw();
  });

  // Headless test surface. Not used by the game itself.

  // ---------------------------------------------------------- inventory
  const invEl = document.getElementById('inv');

  const aggroLive = () => liveFoes().some(f => f.awake && f.hp > 0);

  // Mid-combat refits are not free: with any foe awake, touching a daemon's
  // loadout spends that daemon's action for the round and takes back any
  // operation it had queued. With the floor quiet, the workbench is open.
  function payRefit(who) {
    if (!aggroLive()) return true;
    if (state.acted.includes(who)) {
      log(who + ' HAS ALREADY ACTED \u2014 REFIT NEXT ROVND.', 'bad');
      return false;
    }
    state.queued = state.queued.filter(q => q.member.name !== who);
    state.acted.push(who);
    log(who + ' SPENDS THE ROVND REFITTING.');
    return true;
  }

  function openInv() {
    if (state.modal) return;
    state.modal = 'inv'; state.invSel = null;
    renderInv();
    invEl.classList.add('show');
  }
  function closeInv() {
    state.modal = null; state.invSel = null;
    invEl.classList.remove('show');
  }

  const TYPE_TINT = { SAL: '#E7E2D2', SVLPHVR: '#E3B347' };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  // Faint occult linework behind the whole panel. Drawn once by invShell(),
  // never re-rendered, so selecting an item can't make it flicker.
  const INV_BG = `<svg viewBox="0 0 1200 860" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" fill="none" stroke="#E3B347" stroke-width="1">
    <g opacity=".85">
      <circle cx="150" cy="120" r="88"/><circle cx="150" cy="120" r="72"/>
      <path d="M150 52 L209 154 H91 Z"/><path d="M150 188 L209 86 H91 Z"/>
      <circle cx="150" cy="120" r="34"/>
      <path d="M40 40 h60 M40 40 v60 M1160 40 h-60 M1160 40 v60"/>
      <circle cx="430" cy="150" r="46"/><path d="M430 112 L462 168 H398 Z"/>
      <circle cx="430" cy="150" r="14"/>
      <circle cx="990" cy="470" r="60"/><circle cx="990" cy="470" r="40"/>
      <path d="M950 470 h80 M990 430 v80"/>
      <circle cx="230" cy="620" r="54"/><path d="M230 566 L277 647 H183 Z"/>
      <circle cx="640" cy="800" r="38"/><circle cx="640" cy="800" r="22"/>
      <path d="M300 300 h140 M300 300 v-30 M440 300 v30"/>
      <path d="M760 640 h160 M760 640 v34 M920 640 v-34"/>
      <circle cx="70" cy="430" r="26"/><circle cx="1130" cy="720" r="30"/>
      <path d="M1090 180 l40 40 l-40 40 l-40 -40 z"/>
      <path d="M520 560 l34 34 l-34 34 l-34 -34 z"/>
    </g>
    <g stroke="#8B5BF2" opacity=".75">
      <circle cx="1010" cy="140" r="78"/><circle cx="1010" cy="140" r="60"/>
      <path d="M1010 80 L1062 170 H958 Z"/><path d="M1010 200 L1062 110 H958 Z"/>
      <circle cx="1010" cy="80" r="9"/><circle cx="1010" cy="200" r="9"/>
      <circle cx="958" cy="110" r="9"/><circle cx="1062" cy="110" r="9"/>
      <circle cx="958" cy="170" r="9"/><circle cx="1062" cy="170" r="9"/>
      <circle cx="1010" cy="140" r="9"/>
    </g>
    <g stroke="#46F0DC" opacity=".5">
      <path d="M540 60 h120 v40 M540 60 v40"/>
      <circle cx="180" cy="340" r="18"/><circle cx="820" cy="240" r="14"/>
      <path d="M60 760 h120 M120 700 v120"/>
    </g>
  </svg>`;

  function bankGlyph(id) {
    const bk = B.banks[id];
    const c = TYPE_TINT[bk.type] || '#46F0DC';
    const tabs = Array.from({ length: bk.bays }, (_, i) =>
      `<rect x="${20 + i * 9 - (bk.bays - 1) * 4.5}" y="39" width="6" height="4"
             fill="none" stroke="${c}" stroke-width="1.4"/>`).join('');
    return `<svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="22" r="15" fill="none" stroke="${c}" stroke-width="1.6"/>
      <path d="M24 7 v30 M9 22 h30" stroke="${c}" stroke-width="1.3"/>
      <circle cx="24" cy="22" r="4.5" fill="none" stroke="${c}" stroke-width="1.3"/>
      ${tabs}</svg>`;
  }

  // One distinct sigil per flux. Falls back to a plain ring for anything new.
  const FLUX_ART = {
    VITRIOL:   '<circle cx="24" cy="24" r="13" stroke-width="2.4"/>',
    VIVVM:     '<circle cx="24" cy="24" r="8" stroke-width="2"/>' +
               '<path d="M24 6 v6 M24 36 v6 M6 24 h6 M36 24 h6 M11 11 l4 4 M33 33 l4 4 M37 11 l-4 4 M15 33 l-4 4" stroke-width="1.8"/>',
    NITRVM:    '<path d="M24 8 L39 36 H9 Z" stroke-width="2.2"/>',
    ADAMANS:   '<circle cx="24" cy="22" r="12" stroke-width="2"/>' +
               '<path d="M12 22 h24 M15 34 h18" stroke-width="1.8"/>',
    FVLMINANS: '<circle cx="24" cy="24" r="8" stroke-width="2.2"/>' +
               '<path d="M24 10 v-5 M24 38 v5 M10 24 h-5 M38 24 h5 M13 13 l-4 -4 M35 35 l4 4 M35 13 l4 -4 M13 35 l-4 4" stroke-width="2"/>' +
               '<path d="M24 19 v10 M19 24 h10" stroke-width="1.8"/>',
  };
  function fluxGlyph(id) {
    const c = id === 'FVLMINANS' ? '#D6402A' : '#46F0DC';
    const art = FLUX_ART[id] || '<circle cx="24" cy="24" r="12" stroke-width="2.2"/>';
    return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none"
      stroke="${c}" stroke-linecap="round">${art}</svg>`;
  }
  function argentGlyph() {
    return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none"
      stroke="#E3B347" stroke-width="1.8">
      <path d="M24 6 L36 20 L28 42 H20 L12 20 Z"/><path d="M12 20 h24 M24 6 v36"/></svg>`;
  }

  // Display rarity is derived from drop weight, not stored on the item: the
  // drop table tags every FLUX the same, which makes for a flat-looking grid.
  function rarityOf(it) {
    if (it.kind === 'DATA') return 'UNCOMMON';
    const w = (B.fluxes[it.flux] || {}).weight || 0;
    return w >= 18 ? 'COMMON' : w >= 12 ? 'UNCOMMON' : 'RARE';
  }

  const KIND_LABEL = (op) =>
    op.kind === 'sweep'  ? 'MELEE SWEEP'
  : op.kind === 'hex'    ? 'HEX \u00b7 PERMANENT'
  : op.kind === 'ward'   ? 'WARD \u00b7 CIRCLE'
  : op.kind === 'splash' ? 'SPLASH BOLT'
  : op.range > 1         ? 'RANGED STRIKE' : 'MELEE STRIKE';

  const delta = (n) => n > 0 ? `  (+${n})` : n < 0 ? `  (${n})` : '';
  const row = (k, v, dim) => `<div><dt>${k}</dt><dd${dim ? ' class="dim"' : ''}>${v}</dd></div>`;

  // Three spec-plate columns for one bank, seated or loose. LOAD and STRAIN
  // are reserved for the socket system and read as sealed until it lands.
  function bankSpec(bank, fluxes, seated) {
    const base = B.operations[bank];
    const op = fold({ bank, fluxes: fluxes || [] });
    const dmg = op.mult
      ? `ATK \u00d7${op.mult}${op.dmgBonus ? ' +' + op.dmgBonus : ''}`
      : op.def ? `DEF +${op.def}` : '\u2014';
    const seatedTxt = (fluxes || []).filter(Boolean).join(' \u00b7 ') || '\u2014';
    return [
      row('KIND', KIND_LABEL(op)) +
      row('RANGE', op.range + delta(op.range - base.range)) +
      row('PNEVMA', op.pn + delta(op.pn - base.pn)) +
      row('DAMAGE', dmg),
      row('BAYS', ROMAN[B.banks[bank].bays - 1]) +
      row('WIRING', 'PARALLEL') +
      row('SEATED', seatedTxt) +
      row('COOLDOWN', op.cd ? op.cd + ' TVRNS' : '\u2014'),
      row('LOAD', '\u2014', 1) +
      row('STRAIN', '\u2014  (SEALED)', 1) +
      row('PLVG', seated ? 'HEX \u00b7 MATED' : 'HEX \u00b7 OPEN') +
      row('SELF COST', op.vitaeCost ? op.vitaeCost + ' VITAE' : '\u2014'),
    ];
  }
  function fluxSpec(id) {
    const f = B.fluxes[id];
    const eff = [f.dmgBonus && `+${f.dmgBonus} DAMAGE`, f.rangeDelta && `+${f.rangeDelta} RANGE`,
                 f.pnDelta && `${f.pnDelta} PNEVMA`, f.minDmg && `MIN DMG ${f.minDmg}`,
                 f.vitaeCost && `+${f.vitaeCost} VITAE COST`].filter(Boolean);
    return [
      row('KIND', 'FLVX CELL') + row('EFFECT', eff[0] || '\u2014') +
      row('RIDER', eff[1] || '\u2014') + row('DRAW WEIGHT', f.weight),
      row('SEATS IN', 'ANY BAY') + row('WIRING', 'PARALLEL') +
      row('TYPE LOCK', 'NONE') + row('RARITY', rarityOf({ kind: 'FLUX', flux: id })),
      row('LOAD', '\u2014', 1) + row('STRAIN', '\u2014  (SEALED)', 1) +
      row('PLVG', 'CONTACT \u00b7 OPEN') + row('STACKS', 'ONE PER BAY'),
    ];
  }

  function invShell() {
    invEl.innerHTML = `<div class="invbox" role="dialog" aria-label="INVENTORY">
        <div class="invbg">${INV_BG}</div><div class="invmain"></div></div>`;
    return invEl.querySelector('.invmain');
  }

  function renderInv() {
    const main = invEl.querySelector('.invmain') || invShell();
    const sel = state.invSel != null ? state.bag.items[state.invSel] : null;

    // ------------------------------------------------------------- rig
    const panels = ['CALX', 'CINIS'].map(who => {
      const ptype = B.party[who].type;
      const m = state.circle.members.find(x => x.name === who) || {};
      const banks = state.loadout[who].map((sl, si) => {
        const elig = sel && sel.kind === 'DATA' && B.banks[sel.bank].type === ptype;
        // One flux of a kind per bank: a bay only lights if this bank isn't
        // already running that flux. Duplicates across different banks stay
        // legal — stacking the same rider inside one bank is what's out.
        const dup = sel && sel.kind === 'FLUX' && sl.fluxes.includes(sel.flux);
        const bays = sl.fluxes.map((f, fi) => f
          ? `<div class="ibay seated${f === 'FVLMINANS' ? ' blood' : ''}"
                  data-who="${who}" data-slot="${si}" data-bay="${fi}"
                  role="button" tabindex="0" aria-label="VNSEAT ${f}"
                  >${fluxGlyph(f)}${f}<span class="ipull">\u00d7</span></div>`
          : `<div class="ibay empty${sel && sel.kind === 'FLUX' && !dup ? ' elig' : ''}"
                  data-who="${who}" data-slot="${si}" data-bay="${fi}">\u2014 BAY \u2014</div>`).join('');
        const lamps = sl.fluxes.map(f =>
          `<span class="ilamp${f ? (f === 'FVLMINANS' ? ' blood' : '') : ' off'}"></span>
           <span class="iline"></span>`).join('');
        return `<div class="isockwrap">
            <div class="iroman">${ROMAN[si]}</div>
            <div class="isock${elig ? ' elig' : ''}" data-who="${who}" data-slot="${si}">
              <div class="isock-body">
                <div class="iname"><b class="t-${ptype.toLowerCase()}">${sl.bank}</b>
                  <small>${ptype} \u00b7 BANK</small></div>
                <div class="ibays">${bays}</div>
              </div>
              <div class="irail"><span class="iline"></span>${lamps}<span class="itip">\u25bc</span></div>
            </div>
            <div class="iplug"></div>
          </div>`;
      }).join('');
      return `<div class="ipanel${ptype === 'SVLPHVR' ? ' gold' : ''}">
          <div class="ipanel-h"><span>${who}</span><em>${ptype}</em></div>
          <div class="ipanel-s">VITAE <b>${m.hp}</b>/${m.vitae} &nbsp; PNEVMA <b>${m.pn}</b>/${m.pneuma}</div>
          <div class="ibanks">${banks}</div>
        </div>`;
    }).join('');

    // ------------------------------------------------------ spec plate
    let title = '\u2014', sub = 'NO SVBJECT', cols = [ '', '', '' ];
    if (sel && sel.kind === 'DATA') {
      title = sel.bank; sub = B.banks[sel.bank].type + ' \u00b7 DATA BANK \u00b7 LOOSE';
      cols = bankSpec(sel.bank, [], false);
    } else if (sel && sel.kind === 'FLUX') {
      title = sel.flux; sub = 'FLVX CELL \u00b7 LOOSE';
      cols = fluxSpec(sel.flux);
    } else {
      const who = 'CALX', sl = state.loadout[who][0];
      title = sl.bank; sub = B.banks[sl.bank].type + ' \u00b7 SEATED \u00b7 ' + who;
      cols = bankSpec(sl.bank, sl.fluxes, true);
    }

    let insp = 'SELECT AN ITEM \u2014 ELIGIBLE SOCKETS AND BAYS SIGNAL.'
             + ' CLICK A SEATED FLVX TO PVLL IT BACK.';
    if (sel && sel.kind === 'DATA') {
      insp = `<b>${sel.bank}</b> \u00b7 ${B.operations[sel.bank].note} \u00b7 CLICK A GLOWING SOCKET TO SWAP.`;
    } else if (sel && sel.kind === 'FLUX') {
      insp = `<b>${sel.flux}</b> \u00b7 ${B.fluxes[sel.flux].note}` +
             ` CLICK A GLOWING BAY TO SEAT \u00b7 ONE PER BANK.`;
    }
    const cost = aggroLive()
      ? 'FOES AWAKE \u2014 A REFIT SPENDS THAT DAEMON\u2019S ACTION THIS ROVND'
      : 'FLOOR QVIET \u2014 REFITS ARE FREE';

    // --------------------------------------------------------- satchel
    // Identical items collapse into one card; data-i points at the first of
    // the stack, so seating still splices exactly one entry out of the bag.
    const stacks = [];
    state.bag.items.forEach((it, i) => {
      const key = it.kind + ':' + (it.bank || it.flux);
      const s = stacks.find(x => x.key === key);
      if (s) s.n++; else stacks.push({ key, i, it, n: 1 });
    });
    const cells = stacks.map(s => {
      const it = s.it, name = it.bank || it.flux, rar = rarityOf(it);
      const g = it.kind === 'DATA' ? bankGlyph(it.bank) : fluxGlyph(it.flux);
      return `<div class="icell r-${rar.toLowerCase()}${state.invSel === s.i ? ' selct' : ''}"
                   data-i="${s.i}" role="button" tabindex="0" aria-label="${name} ${rar}">
                <div class="inm2">${name}</div>${g}<div class="irar">${rar}</div>
                ${s.n > 1 ? `<span class="iqty">\u00d7${s.n}</span>` : ''}</div>`;
    });
    if (state.bag.argent) cells.push(`<div class="icell argent" aria-label="ARGENT">
        <div class="inm2">VNASSAYED<br>ARGENT</div>${argentGlyph()}
        <div class="irar">CVRRENCY</div><span class="iqty">\u00d7${state.bag.argent}</span></div>`);
    const rows = Math.min(4, Math.max(2, Math.ceil(cells.length / 8)));
    while (cells.length < rows * 8)
      cells.push('<div class="icell vacant"><div class="inm2"></div><div class="inm2">VACANT</div></div>');

    main.innerHTML = `
      <div class="inv-h"><span>INVENTARIVM // VESSEL\u00b7CONFIGVRATION</span>
        <button id="inv-close" aria-label="CLOSE INVENTORY">\u00d7 [I]</button></div>

      <div class="iapexwrap"><div class="iapex">
        <div class="iapex-h">OPERATOR \u25c7</div>
        <div class="icards">
          <div class="icard"><b>PERCVSSIO</b><small>INTRINSIC\u00b7STRIKE</small>
            <svg viewBox="0 0 60 48" fill="none" stroke="var(--bone)" stroke-width="1.6"
              aria-hidden="true"><path d="M18 30 v-9 a4 4 0 0 1 8 0 v-3 a4 4 0 0 1 8 0 v3
              a4 4 0 0 1 8 0 v11 a9 9 0 0 1 -9 9 h-8 a7 7 0 0 1 -7 -7 z"/>
              <path d="M8 12 l6 4 M52 12 l-6 4 M30 6 v6" stroke-width="1.2"/></svg></div>
          <div class="icard sealed"><b>ATTVNED\u00b7SLOT</b>
            <svg viewBox="0 0 60 48" fill="none" stroke="var(--shell-txt)" stroke-width="1.6"
              stroke-dasharray="4 3" aria-hidden="true">
              <path d="M18 8 h24 l10 16 l-10 16 h-24 l-10 -16 z"/></svg>
            <small>SEALED</small></div>
        </div></div></div>

      <div class="itrace"><svg viewBox="0 0 1000 34" preserveAspectRatio="none" aria-hidden="true">
        <path d="M362 0 V13 H150 V34"/><path d="M638 0 V13 H850 V34"/>
        <rect x="358" y="9" width="8" height="8"/><rect x="146" y="9" width="8" height="8"/>
        <rect x="634" y="9" width="8" height="8"/><rect x="846" y="9" width="8" height="8"/>
      </svg></div>

      <div class="irig">${panels}</div>

      <div class="ispec">
        <div class="iinsp">${insp}</div>
        <div class="icost">${cost}</div>
        <div class="ispec-b">
          <div class="ispec-t">${title}<small>${sub}</small></div>
          <dl>${cols[0]}</dl><dl>${cols[1]}</dl><dl>${cols[2]}</dl>
        </div>
      </div>

      <div class="isat">
        <div class="isat-h">SATCHEL <span>[ ${state.bag.items.length} / 32 ]</span></div>
        <div class="igrid">${cells.join('')}</div>
      </div>

      <div class="ifoot">
        <span class="fl">${cost}</span>
        <span class="fr"><span><kbd>TAP</kbd>SELECT \u00b7 SEAT</span>
          <span><kbd>TAP</kbd>SEATED FLVX \u00b7 VNSEAT</span>
          <span><kbd>[I]</kbd>CLOSE</span><span><kbd>[ESC]</kbd>CLOSE</span></span>
      </div>`;
  }


  invEl.addEventListener('click', e => {
    if (e.target.closest('#inv-close')) { closeInv(); draw(); return; }
    const cell = e.target.closest('.icell[data-i]');
    if (cell) {
      const i = +cell.dataset.i;
      state.invSel = state.invSel === i ? null : i;
      renderInv(); return;
    }
    // Pulling a flux needs no selection, so this sits above the guard below.
    // It costs a refit like any other loadout change: mid-combat, stripping a
    // rider is as expensive as fitting one.
    const pull = e.target.closest('.ibay.seated');
    if (pull) {
      const who = pull.dataset.who;
      if (!payRefit(who)) { renderInv(); draw(); return; }
      const sl = state.loadout[who][+pull.dataset.slot];
      const fi = +pull.dataset.bay, flux = sl.fluxes[fi];
      sl.fluxes[fi] = null;
      state.bag.items.push({ kind: 'FLUX', label: 'FLUX CELL', flux,
                             sprite: 'flux', rarity: 'UNCOMMON' });
      state.invSel = null;
      log(flux + ' VNSEATED.', 'good');
      renderFanChips(); renderInv(); draw(); return;
    }

    const sel = state.invSel != null ? state.bag.items[state.invSel] : null;
    if (!sel) return;

    const bay = e.target.closest('.ibay.empty.elig');
    if (bay && sel.kind === 'FLUX') {
      const who = bay.dataset.who;
      if (!payRefit(who)) { renderInv(); draw(); return; }
      state.loadout[who][+bay.dataset.slot].fluxes[+bay.dataset.bay] = sel.flux;
      state.bag.items.splice(state.invSel, 1); state.invSel = null;
      log(sel.flux + ' SEATED.', 'good');
      renderFanChips(); renderInv(); draw(); return;
    }
    const sock = e.target.closest('.isock.elig');
    if (sock && sel.kind === 'DATA') {
      const who = sock.dataset.who;
      if (!payRefit(who)) { renderInv(); draw(); return; }
      const sl = state.loadout[who][+sock.dataset.slot];
      // Ride-along (sheet 24): fluxes travel with their bank, both ways.
      const old = { kind: 'DATA', bank: sl.bank, label: sl.bank, sprite: 'databank',
                    rarity: 'RARE', fluxes: sl.fluxes.slice() };
      sl.bank = sel.bank;
      sl.fluxes = (sel.fluxes || Array(B.banks[sel.bank].bays).fill(null)).slice();
      state.bag.items[state.invSel] = old; state.invSel = null;
      log(old.bank + ' VNSEATED \u2014 ' + sl.bank + ' SEATED.', 'good');
      renderFanChips(); renderInv(); draw(); return;
    }
  });

  // Two ways in. The HUD line is the desktop-native one — it sits right next
  // to the counts it opens — but it is a 10px readout in a corner, so touch
  // gets the viewport handle beside the ? button instead.
  const openSatchel = () => { if (state.modal || finished()) return; openInv(); draw(); };
  document.getElementById('bag').addEventListener('click', openSatchel);
  satchelEl.addEventListener('click', openSatchel);

  window.__DW = { state, chooseOp, clickTile, confirmTarget, cancel, passOrHold,
                  moveInput, openAct, draw, opsFor, allOps, fold, openInv, closeInv, rollItem, payRefit, fanEl, interactable, answerExit, floatsEl };

  buildRoster();
  buildFan();

  // draw() rebuilds the whole SVG through innerHTML, and iOS fires resize
  // repeatedly through a URL-bar animation, so coalesce to a frame.
  // orientationchange gets a delay of its own: iOS can fire resize before
  // layout settles, and updateCamera / tilePos / syncFan all read
  // getBoundingClientRect, so an early read anchors everything to the old
  // geometry until the next draw.
  const redraw = () => requestAnimationFrame(draw);
  window.addEventListener('resize', redraw);
  window.addEventListener('orientationchange', () => setTimeout(redraw, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', redraw);
  log(`FLOOR 01 COMPILED. ${F.tiles.length} CELLS, ${F.foes.length} ENEMIES.`);
  // Set before the first draw so the overlay is up on the first painted frame,
  // rather than flashing the board and then covering it.
  if (!seenControls()) state.modal = 'controls';
  draw();
})();
