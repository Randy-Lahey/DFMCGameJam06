// FLOOR 01 — hand-authored. 135 tiles. Re-carved as rooms + corridors.
// Coordinates are [col, row], origin top-left.
//
// SHAPE RULE (locked this pass): rooms are never joined by a shared edge.
// Every connection is a 1-tile-wide corridor running along the X axis,
// between 2 and 5 tiles long. There are no Y-axis corridors — north/south
// travel happens inside the SPINE room, which every corridor hangs off.
// tools/test-shape.js enforces the rule; it fails the build if a corridor
// is the wrong width, wrong length, or runs vertically.
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18
//   0    . . # # # # # . . . . . . . . # # # ^ .
//   1    . . # # S # # . . . . . . . . # T # # .
//   2    . . # # # # # = = # # # = = = # # # # .
//   3    . . . . . . . . . # # # . . . # # # # .
//   4    . # # # # # . . . # T # . . . . . . . .
//   5    . # S # # # = = = # # # . . . # # # # S
//   6    . # # # # # . . . # # # . . . # # # #
//   7    . . . . . . . . . # # # = x = # # # T #
//   8    # # # # . . . . . # # # . . . # # # # C
//   9    # # # # . . . . . # T # . . . . . . . .
//  10    # # # # . . . . . # # # . . . . . . . .
//  11    # # # # = = = = = # # # . . . . . . . .
//  12    @ @ @ # . . . . . # # # . . . . . . . .
//
//   @ party start   ^ stairs   C cache   x hidden spikes   T/S foes
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms: ENTRY (0-3, 8-12) - WEST (1-5, 4-6) - NORTHWEST (2-6, 0-2)
//          SPINE (9-11, 2-12) - EAST/cache (15-19, 5-8) - NORTHEAST/stairs (15-18, 0-3)
//   Corridor lengths, west to east: 5, 3, 2, 3, 3.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR01 = {
    cols: 20,
    rows: 13,

    tiles: [
      // NORTHWEST room (2-6, 0-2)
      [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
      [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
      [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
      // corridor NORTHWEST -> SPINE, row 2, length 2
      [7, 2], [8, 2],
      // NORTHEAST room (15-18, 0-3) — holds the stairs
      [15, 0], [16, 0], [17, 0], [18, 0],
      [15, 1], [16, 1], [17, 1], [18, 1],
      [15, 2], [16, 2], [17, 2], [18, 2],
      [15, 3], [16, 3], [17, 3], [18, 3],
      // corridor SPINE -> NORTHEAST, row 2, length 3
      [12, 2], [13, 2], [14, 2],
      // WEST room (1-5, 4-6)
      [1, 4], [2, 4], [3, 4], [4, 4], [5, 4],
      [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
      [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
      // corridor WEST -> SPINE, row 5, length 3
      [6, 5], [7, 5], [8, 5],
      // SPINE room (9-11, 2-12) — the trunk; all north/south travel
      [9, 2], [10, 2], [11, 2],
      [9, 3], [10, 3], [11, 3],
      [9, 4], [10, 4], [11, 4],
      [9, 5], [10, 5], [11, 5],
      [9, 6], [10, 6], [11, 6],
      [9, 7], [10, 7], [11, 7],
      [9, 8], [10, 8], [11, 8],
      [9, 9], [10, 9], [11, 9],
      [9, 10], [10, 10], [11, 10],
      [9, 11], [10, 11], [11, 11],
      [9, 12], [10, 12], [11, 12],
      // EAST room (15-19, 5-8) — holds the cache
      [15, 5], [16, 5], [17, 5], [18, 5], [19, 5],
      [15, 6], [16, 6], [17, 6], [18, 6], [19, 6],
      [15, 7], [16, 7], [17, 7], [18, 7], [19, 7],
      [15, 8], [16, 8], [17, 8], [18, 8], [19, 8],
      // corridor SPINE -> EAST, row 7, length 3 — the trapped approach
      [12, 7], [13, 7], [14, 7],
      // ENTRY room (0-3, 8-12)
      [0, 8], [1, 8], [2, 8], [3, 8],
      [0, 9], [1, 9], [2, 9], [3, 9],
      [0, 10], [1, 10], [2, 10], [3, 10],
      [0, 11], [1, 11], [2, 11], [3, 11],
      [0, 12], [1, 12], [2, 12], [3, 12],
      // corridor ENTRY -> SPINE, row 11, length 5 — the long walk in
      [4, 11], [5, 11], [6, 11], [7, 11], [8, 11],
    ],

    props: [
      { kind: 'stairs', c: 18, r: 0, hidden: false, label: 'DESCENT' },
      { kind: 'chest',  c: 19, r: 8, hidden: false, label: 'CACHE' },
      // On the cache corridor, not the mandatory path: the loot approach
      // is the thing that costs you, and the corridor gives no room to dodge.
      { kind: 'spikes', c: 13, r: 7, hidden: true,  label: 'SPIKE ARRAY' },
    ],

    // Party spawns, in command order, along the bottom-left corner of the
    // ENTRY room. The tail sits in the literal corner (0,12) and the OPERATOR
    // takes the point tile east of it, facing the way out, so the formation
    // reads leader-first from the very first frame and the floor unrolls
    // ahead of you rather than behind.
    spawns: [
      { c: 2, r: 12 },
      { c: 1, r: 12 },
      { c: 0, r: 12 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'TESTA',   c: 18, r: 7 },  // EAST room, guarding the cache
      { kind: 'SILIQVA', c: 19, r: 5 },  // EAST room, far corner
      { kind: 'TESTA',   c: 10, r: 9 },  // SPINE, south — meets you at the door
      { kind: 'TESTA',   c: 10, r: 4 },  // SPINE, north — blocks the stairs run
      { kind: 'SILIQVA', c: 2,  r: 5 },  // WEST room
      { kind: 'SILIQVA', c: 4,  r: 1 },  // NORTHWEST room
      { kind: 'TESTA',   c: 16, r: 1 },  // NORTHEAST room, on the stairs
    ],
  };
})();
