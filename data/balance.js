// THE NUMBERS BIBLE. Single source of truth. The game loads this at runtime.
// Never copy these values anywhere else — change them here and only here.
//
// Damage model (deliberately trivial for the slice):
//     dmg = max(minDamage, atk - def + rand(-variance, +variance))
//
// Derived, at current values:
//     CALX     -> TESTA    2 +/-1   => 7 hits   (ABRASIO, but hits up to 8)
//     CALX     -> SILIQVA  4 +/-1   => 3 hits
//     SPIKES   -> OPERATOR 7   CALX 8   CINIS 5   (30% of max, each entry)
//     OPERATOR -> TESTA    5 +/-1   =>  3 hits to sever
//     OPERATOR -> SILIQVA  7 +/-1   =>  2 hits to sever
//     TESTA    -> OPERATOR 2 +/-1   => 12 hits
//     TESTA    -> CALX     1 (min)  => 26 hits   (CALX is the wall)
//     SILIQVA  -> CINIS    5 +/-1   =>  4 hits   (CINIS is glass)

(function () {
  window.BALANCE = {

    combat: {
      variance: 1,      // +/- this much on every damage roll
      minDamage: 1,     // a hit always does something
      pneumaRegen: 1,   // per living member, per round, move or act
    },

    // Readability toggles. Not cosmetic — these change what the player knows
    // when they commit, which changes how hard the floor plays.
    ui: {
      // Draw what each AWAKE foe has committed to this round: a chevron on the
      // tile it will step to, a ring on the circle if it will attack. Sleeping
      // foes stay hidden, so waking one is still a surprise.
      //
      // The turn model's whole point is that intents lock BEFORE movement, so
      // stepping out of reach makes an attack whiff — a player who cannot see
      // the intent cannot make that read. Set false to restore blind commits.
      showFoeIntent: true,
    },

    // Party. Order here is display order in the CIRCLE panel and left-to-right
    // order of the VITAE pips above the token. `tint` is a CSS var name.
    party: {
      OPERATOR: { vitae: 24, pneuma: 10, atk: 7, def: 2, type: '\u2014',  role: 'ARCANVM', tint: 'cyan' },
      CALX:     { vitae: 26, pneuma: 14, atk: 3, def: 4, type: 'SAL',     role: 'WARD',    tint: 'bone' },
      CINIS:    { vitae: 18, pneuma: 10, atk: 6, def: 1, type: 'SVLPHVR', role: 'BVRN',    tint: 'gold' },
    },

    // Drops. Exactly one per severed enemy, rolled off this weighted table.
    // ARGENT is the currency and stacks as a number; FLUX and DATA are discrete
    // items so the inventory grid has something to lay out. `rarity` is shown
    // on the pickup floater and, later, in the inventory.
    drops: {
      table: [
        { kind: 'ARGENT', label: 'ARGENT',    sprite: 'argent',   weight: 72, rarity: 'COMMON' },
        { kind: 'FLUX',   label: 'FLUX CELL', sprite: 'flux',     weight: 20, rarity: 'UNCOMMON' },
        { kind: 'DATA',   label: 'DATA BANK', sprite: 'databank', weight:  8, rarity: 'RARE' },
      ],
      argentMin: 4,
      argentMax: 12,
    },

    // Opening a cache costs a turn and always pays: argent plus one guaranteed
    // non-argent item, rolled off the drop table's FLUX/DATA weights.
    cache: {
      argentMin: 10,
      argentMax: 22,
    },

    // Floor hazards. `pct` is a fraction of each member's MAX vitae, so a
    // spike array hurts the whole circle proportionally rather than flat.
    // Fires every time the tile is entered, not just on the reveal.
    hazards: {
      spikes: { pct: 0.30 },
    },

    // Foes. `aggro` is Chebyshev distance at which they wake and pursue.
    foes: {
      TESTA:   { vitae: 14, atk: 4, def: 2, aggro: 5, type: 'QLIPHOTH', sprite: 'testa' },
      SILIQVA: { vitae: 10, atk: 6, def: 0, aggro: 6, type: 'QLIPHOTH', sprite: 'siliqva' },
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
        by: 'CALX', kind: 'sweep', targets: 'adjacent', range: 1,
        pn: 3, mult: 1.3, fx: 'sweep', hitFx: 'strike',
        note: 'Melee sweep. Every enemy touching you.',
      },
      CONCRETIO: {
        by: 'CALX', kind: 'hex', targets: 'foe', range: 3,
        pn: 4, atk: 2, cd: 4, fx: 'hex',
        note: 'Weakens one enemy. Permanent.',
      },
      FVLGVR: {
        by: 'CINIS', kind: 'strike', targets: 'foe', range: 4,
        pn: 3, mult: 1, fx: 'bolt',
        note: 'Ranged strike. Four tiles.',
      },
      IMMOLATIO: {
        by: 'CINIS', kind: 'strike', targets: 'foe', range: 2,
        pn: 2, mult: 2.2, vitaeCost: 4, fx: 'burn',
        note: 'Heavy hit at two tiles. Burns CINIS.',
      },
    },
  };
})();
