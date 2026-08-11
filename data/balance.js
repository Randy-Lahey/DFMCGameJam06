// data/balance.js — THE NUMBERS BIBLE. Single source of truth.
//
// The game reads this at runtime. The docs site (docs/numbers.html) renders it
// live. Change a number here and both update. Nothing is duplicated anywhere —
// if you find yourself typing a number into src/*.js, it belongs in here instead.
//
// Plain .js rather than .json so it works when you open index.html straight off
// disk (file:// blocks fetch). It is still just data.

(function () {

const BALANCE = {

  // ---- dungeon shape ------------------------------------------------------
  // Lattice of cells; each cell may hold one room; rooms joined by L-corridors
  // along a random spanning tree, plus `extraLoops` extra edges.
  map: {
    cols: 3,          // cells across
    rows: 3,          // cells down
    cellW: 14,        // tiles per cell, horizontally
    cellH: 9,         // tiles per cell, vertically
    roomMinW: 4,
    roomMaxW: 9,
    roomMinH: 3,
    roomMaxH: 5,
    roomChance: 1.0,  // <1.0 leaves some cells as bare corridor junctions
    extraLoops: 2,    // corridor edges beyond the spanning tree. 0 = no loops.
  },

  // ---- actors -------------------------------------------------------------
  actors: {
    hero:        { name: 'Hero',         glyph: '@', color: '#4ea3ff', hp: 20, atk: 6, def: 2 },
    daemonAlpha: { name: 'Daemon Alpha', glyph: 'α', color: '#6fd68b', hp: 14, atk: 5, def: 1 },
    daemonBeta:  { name: 'Daemon Beta',  glyph: 'β', color: '#c08cf0', hp: 14, atk: 5, def: 1 },
    rat:         { name: 'Rat',          glyph: 'r', color: '#e2604f', hp:  8, atk: 4, def: 1 },
  },

  // ---- combat -------------------------------------------------------------
  combat: {
    minDamage: 1,        // a hit always does at least this
    damageVariance: 1,   // damage = atk - def, then ± this
  },

  // ---- ai -----------------------------------------------------------------
  ai: {
    aggroRange: 8,        // chebyshev tiles; foe must also have line of sight
    wanderWaitChance: 0.6 // chance an unaware foe stands still instead of stepping
  },

  // ---- spawning -----------------------------------------------------------
  spawns: {
    foeKind: 'rat',
    foeCount: 5,
    partyKinds: ['daemonAlpha', 'daemonBeta'], // the Hero is always first
  },

  // ---- presentation (not balance, but it's a knob) ------------------------
  render: {
    tileSize: 18,   // px per tile
    foeDelayMs: 90, // pause between foe actions so you can read the turn
  },
};

// One-line rationale per knob. The docs site shows these next to the values.
// If a number has no note, that's a sign nobody knows why it's that number.
const NOTES = {
  'map.cols': 'Floor is cols x rows rooms. 3x3 = ~9 rooms, a 2-4 minute floor.',
  'map.rows': 'Raise for longer floors. Cost is wall-clock playtime per run.',
  'map.cellW': 'Must exceed roomMaxW + 4 or rooms get clamped.',
  'map.cellH': 'Must exceed roomMaxH + 4 or rooms get clamped.',
  'map.roomChance': 'Below 1.0 gives PMD-style bare junctions. 1.0 = every cell is a room.',
  'map.extraLoops': 'Loops stop the floor being a dead-end tree. 0 makes backtracking punishing.',
  'actors.hero.hp': 'Survives 10 rat hits (rat atk 4 - hero def 2 = 2 dmg). Generous on purpose while there are no abilities or healing; tighten once there are.',
  'actors.rat.hp': 'Dies in 2 Hero hits (6-1=5 dmg). Keeps trash fast.',
  'combat.damageVariance': 'Small. Enough to stop damage feeling like arithmetic, not enough to swing a fight.',
  'ai.aggroRange': 'Roughly one room-width, so a room reads as one encounter.',
  'ai.wanderWaitChance': 'High so unaware foes drift slowly and stay findable.',
  'spawns.foeCount': 'Across ~8 non-spawn rooms, so most rooms are empty and encounters feel placed.',
};

BALANCE.NOTES = NOTES;

if (typeof module !== 'undefined' && module.exports) module.exports = BALANCE;
if (typeof window !== 'undefined') window.BALANCE = BALANCE;

})();
