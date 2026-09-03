// THE NUMBERS BIBLE. Single source of truth. The game loads this at runtime.
// Never copy these values anywhere else — change them here and only here.
//
// Damage model (deliberately trivial for the slice):
//     dmg = max(minDamage, atk - def + rand(-variance, +variance))
//
// Derived, at current values (lethality pass: foes fall in 1-3, fell in 3-9):
//     OPERATOR -> TESTA    5 +/-1   => 2 hits to sever
//     OPERATOR -> SILIQVA  7 +/-1   => 1 hit
//     CALX     -> TESTA    1 (min)  => 4-5 hits (CALX wards, others sever)
//     CALX     -> SILIQVA  3 +/-1   => 2 hits
//     CINIS    -> TESTA    4 +/-1   => 2 hits
//     TESTA    -> OPERATOR 5 +/-1   => 5 hits
//     TESTA    -> CALX     3 +/-1   => 9 hits   (CALX is still the wall)
//     TESTA    -> CINIS    6 +/-1   => 3 hits   (CINIS is glass)
//     SILIQVA  -> OPERATOR 6 +/-1   => 4 hits
//     SILIQVA  -> CINIS    7 +/-1   => 3 hits
//     GVTTA    -> TESTA    3 +/-1   => 2 hits
//     GVTTA    -> SILIQVA  5 +/-1   => 1 hit
//     TESTA    -> GVTTA    7 +/-1   => 3 hits   (GVTTA is the ghost: def 0)
//     SILIQVA  -> GVTTA    8 +/-1   => 2 hits

(function () {
  window.BALANCE = {

    combat: {
      variance: 1,      // +/- this much on every damage roll
      stepsPerRound: 2, // tiles the circle may walk before foes respond
      // Operations the WHOLE CIRCLE may queue per round, shared across
      // members. Three stand, two act: who sits out is the decision. In-combat
      // refits spend from this same pool. Movement is NOT in the pool. Set to
      // 3 to restore one-act-per-member.
      actionsPerRound: 2,
      minDamage: 1,     // a hit always does something
    },

    // Readability toggles. Not cosmetic — these change what the player knows
    // when they commit, which changes how hard the floor plays.
    ui: {
      // showFoeIntent retired: foe telegraphs (rings + destination plates)
      // went out with the rest of the crawl-combat furniture — contact
      // commits to the chamber, so the dodge-read they enabled is gone.

      // Fog of war. Sight spreads by BFS through floor tiles (8-way), so it
      // cannot cross a void — corridors stay blind corners. Terrain you have
      // seen persists at `memory` opacity. AWAKE foes ignore fog: they have
      // engaged the circle and are hunting it, so intents, edge markers and
      // targeting keep working; fog hides dormant foes and unexplored floor.
      fog: { on: true, sight: 4, memory: 0.3 },
    },

    // Party. Order here is display order in the CIRCLE panel and left-to-right
    // order of the VITAE pips above the token. `tint` is a CSS var name.
    party: {
      OPERATOR: { vitae: 24, atk: 7, def: 2, type: '\u2014',  role: 'ARCANVM', tint: 'cyan' },
      CALX:     { vitae: 26, atk: 3, def: 4, type: 'SAL',     role: 'WARD',    tint: 'bone' },
      CINIS:    { vitae: 18, atk: 6, def: 1, type: 'SVLPHVR', role: 'BVRN',    tint: 'gold' },
      // The third of the tria prima: quicksilver, the volatile. Paper-thin,
      // but while GVTTA stands the whole circle walks one extra tile a round
      // (aura.steps is summed over LIVING members by stepsMax() in game.js).
      // Interim: spawns as a 4th follower until the starter-choice system
      // prunes the party to OPERATOR + one daemon.
      GVTTA:    { vitae: 16, atk: 5, def: 0, type: 'MERCVRIVS', role: 'FVGA', tint: 'shell-txt',
                  aura: { steps: 1 } },
    },

    // Drops. FLAT TABLE for the whole NIGREDO face: every tile rolls the
    // same odds. JAM RULING -- per-tile weighting is deferred post-jam.
    // Hybrid model: every severed enemy pays ARGENT, then ONE item roll at
    // `itemChance`, weighted off `items`. REAGENT enters the item table only
    // once tile affixes exist (until then it has nothing to act on).
    // Chamber kills -- including srcId-less reinforcements: the player
    // fought three bodies, three bodies pay -- are rolled at fight end and
    // presented on the victory screen (cfg.rollLoot seam). Rare crawl
    // chip-kills still pay as floor drops through the same rolls.
    drops: {
      argentMin: 4,
      argentMax: 12,
      itemChance: 0.5,
      items: [
        { kind: 'FLUX', label: 'FLUX CELL', sprite: 'flux',     weight: 60 },
        { kind: 'DATA', label: 'DATA BANK', sprite: 'databank', weight: 30 },
      ],
      // DATA BANK sub-roll pool. Found banks leave the pool permanently
      // (no duplicate drops); once empty, a DATA roll pays out as FLUX.
      bankPool: ['LORICA', 'VAPOR'],
    },

    // Opening a cache costs a turn and always pays: argent plus one guaranteed
    // item, rolled off the drops.items weights.
    cache: {
      argentMin: 10,
      argentMax: 22,
    },

    // Foes. `aggro` is Chebyshev distance at which they wake and pursue.
    // Operation ranges were divided by 4 so reach sits inside what the circle
    // can actually see (fog.sight 4). Aggro is now rescaled to match: TESTA
    // wakes at sight+1, SILIQVA one further out (it hangs back anyway, so a
    // whiff of ambush survives). Lethality pass: shallow foe VITAE, hard foe
    // ATK -- fights are short and every swing matters, both directions.
    // `ai` picks the movement brain in game.js:
    //   flank    -> pursuers each claim their own free tile beside the circle,
    //               enveloping it; they take 2 steps while more than 2 away
    //   skirmish -> hangs back ~3 tiles, commits when another foe pins the
    //               circle, withdraws below half VITAE, fights when cornered
    foes: {
      TESTA:   { vitae: 6, atk: 7, def: 2, aggro: 5, ai: 'flank',    type: 'QLIPHOTH', sprite: 'testa' },
      SILIQVA: { vitae: 4, atk: 8, def: 0, aggro: 6, ai: 'skirmish', type: 'QLIPHOTH', sprite: 'siliqva' },
      // THE ARCHON OF NIGREDO, THRONVS only. Placeholder: the chamber fights
      // it with the sacrifice-fight template (combat.js FOE_TPL.a: 40 VITAE,
      // ATK 9, DEF 3). Crawl VITAE is that on the crawl's ~1/3 scale, same
      // as TESTA 20 -> 6. Ward asymmetry is a later order.
      ARCHON:  { vitae: 12, atk: 9, def: 3, aggro: 6, ai: 'flank',    type: 'ARCHON',   sprite: 'archon' },
    },

    // OPERATIONS.
    //   targets 'foe'      -> pick a living foe within `range` of the circle
    //   targets 'adjacent' -> no aiming; hits every foe within `range`
    //   targets 'circle'   -> no target, applies to the whole party
    //   mult             -> damage multiplier on the caster's ATK
    //   vitaeCost        -> Svlphvr pays itself for power
    //   fx               -> cosmetic only; keys into the FX table in game.js
    //   hitFx            -> cosmetic; per-target burst when `fx` marks the
    //                       origin instead of the impact (sweeps)
    //   duration         -> rounds a ward stays up; omit for permanent
    //   cd               -> rounds before the op can be cast again
    // `note` is shown on the chip itself: keep it under ~40 characters.
    // Order within a member is hotkey order (1, 2).
    operations: {
      PERCVSSIO: {
        by: 'OPERATOR', kind: 'strike', targets: 'foe', range: 1,
        pn: 0, mult: 1, fx: 'strike',
        note: 'Melee. One enemy, adjacent.',
      },
      ABRASIO: {
        kind: 'sweep', targets: 'adjacent', range: 1,
        pn: 3, mult: 1.3, fx: 'sweep', hitFx: 'strike',
        note: 'Melee sweep. Every enemy touching you.',
      },
      CONCRETIO: {
        kind: 'hex', targets: 'foe', range: 2,
        pn: 4, atk: 2, cd: 4, fx: 'hex',
        note: 'Weakens one enemy. Permanent.',
      },
      FVLGVR: {
        kind: 'strike', targets: 'foe', range: 2,
        pn: 3, mult: 1, fx: 'bolt',
        note: 'Ranged strike. Two tiles.',
      },
      IMMOLATIO: {
        kind: 'strike', targets: 'foe', range: 1,
        pn: 2, mult: 2.2, vitaeCost: 4, fx: 'burn',
        note: 'Heavy hit, adjacent. Burns the caster.',
      },
      PERMVTO: {
        kind: 'swap', targets: 'circle', range: 0,
        pn: 4, cd: 3, fx: 'hex',
        note: 'Trade places with an ally.',
      },
      IMPVLSVS: {
        kind: 'strike', targets: 'foe', range: 1,
        pn: 3, mult: 1, cd: 2, fx: 'strike',
        note: 'Melee shove. Knockback 1; blocked = stun.',
      },
      // Findable banks. Not in any default loadout; they enter play only as
      // DATA BANK drops, rolled off drops.bankPool (no duplicates, ever).
      LORICA: {
        kind: 'ward', targets: 'circle', range: 0,
        pn: 4, def: 2, duration: 3, cd: 5, fx: 'hex',
        note: 'All members +2 DEF for 3 turns.',
      },
      VAPOR: {
        kind: 'splash', targets: 'foe', range: 2,
        pn: 3, mult: 0.8, fx: 'bolt', hitFx: 'strike',
        note: 'Bolt at 2. Also hits foes beside the target.',
      },
    },

    // ------------------------------------------------------------- power
    // Amperage. Every bank has a rating (`amps` below); seated fluxes pull
    // their `draw` per cast. Casting while total draw exceeds amps accrues
    // STRAIN equal to the overdraw, PER CAST -- an overdrawn bank left
    // untouched never strains; greed is only taxed when used. At burnAt the
    // cast still resolves, THEN the bank burns offline for the rest of the
    // fight. Strain clears at fight end. Combat-chamber only: crawl casts
    // never strain. Loadout banks all sit in the COMMON band on purpose --
    // every 2-bay bank carries two 2A workhorse fluxes exactly, and
    // FVLMINANS (4A) overdraws almost anything COMMON. That is the envelope
    // to push. ampBands are the DATA BANK drop bands, rolled 60/30/10
    // COMMON/MAGIC/RARE (guaranteed RARE off the THRONVS Archon): RULED but
    // not wired -- waits on the loot-table task, where a dropped bank rolls
    // a band, then amps within it, stored on the item instance.
    ampBands: { COMMON: [3, 4], MAGIC: [5, 6], RARE: [7, 8] },
    strain: { burnAt: 10 },

    // ------------------------------------------------------------- banks
    // A DATA BANK *is* an operation: the archive that carries it. Daemons run
    // whatever banks are seated in their two slots; the OPERATOR's PERCVSSIO
    // is intrinsic (bare hands, not an archive): it never drops, never
    // unseats, and lives in no satchel. Its entry below exists ONLY so the
    // rig knows it seats one FLUX -- type '\u2014' matches no daemon, so no
    // bank can ever swap into the OPERATOR's fixed slot.
    // `type` locks a bank to daemons of that alchemical type. `bays` is how
    // many FLUX cartridges it seats: workhorse ops get 2, spike ops get 1.
    banks: {
      PERCVSSIO: { type: '\u2014',  bays: 1, amps: 3, intrinsic: true },
      ABRASIO:   { type: 'SAL',     bays: 2, amps: 4 },
      CONCRETIO: { type: 'SAL',     bays: 1, amps: 3 },
      FVLGVR:    { type: 'SVLPHVR', bays: 2, amps: 4 },
      IMMOLATIO: { type: 'SVLPHVR', bays: 1, amps: 3 },
      LORICA:    { type: 'SAL',     bays: 1, amps: 3 },
      PERMVTO:   { type: 'MERCVRIVS', bays: 1, amps: 3 },
      IMPVLSVS:  { type: 'MERCVRIVS', bays: 2, amps: 4 },
      VAPOR:     { type: 'SVLPHVR', bays: 2, amps: 4 },
    },
    defaultLoadout: {
      OPERATOR: ['PERCVSSIO'],
      CALX:  ['ABRASIO', 'CONCRETIO'],
      CINIS: ['FVLGVR', 'IMMOLATIO'],
      GVTTA: ['IMPVLSVS', 'PERMVTO'],
    },

    // ------------------------------------------------------------- fluxes
    // A FLUX seats into a bank bay and modifies that operation only.
    // Effects are resolved by fold() in src/game.js. `weight` drives the
    // FLUX CELL drop sub-roll. `draw` is the amps a cell pulls per cast
    // (see the power note above banks). FVLMINANS is deliberately greedy:
    // power the body pays for -- and the coil pays for: 4A overdraws any
    // stock 3A bank, strain burns it out after ~10 forced casts.
    fluxes: {
      VITRIOL:   { weight: 30, draw: 2, dmgBonus: 2,               note: '+2 damage.' },
      NITRVM:    { weight: 22, draw: 1, pnDelta: -1,               note: '\u22121 PNEUMA cost. Floor 1.' },
      VIVVM:     { weight: 20, draw: 2, rangeDelta: 1,             note: '+1 range.' },
      ADAMANS:   { weight: 18, draw: 2, minDmg: 3,                 note: 'Minimum damage 3.' },
      FVLMINANS: { weight: 10, draw: 4, dmgBonus: 5, vitaeCost: 2, note: '+5 damage. \u22122 VITAE per cast.' },
    },
  };
})();
