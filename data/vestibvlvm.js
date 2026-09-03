// VESTIBVLVM -- hand-authored. 80 tiles. The antechamber: one wide hall
// with a locked-away cache off its north-east corner and the extract down
// a long south-east passage. The hall is big enough to route around the
// first fight; the closet is not.
//
// SHAPE RULE (same as floor 01): rooms never share an edge; every
// connection is a 1-tile-wide corridor running along the X axis, 2-5 tiles
// long. tools/test-shape.js enforces this:
//   node tools/test-shape.js data/vestibvlvm.js
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18  20
//   0    . . . . # # . . . . . . . . = = . C # # # #
//   1    @ @ @ @ = = . . . . . . . . # # S . # # # #
//   2    . . . . # # . . . T . . . . # # # # # # # #
//   3    # # # # # # . . . . . . . . # # # # . . . .
//   4    # # # # # # . . . . . . S . = = = = . T . .
//   5    # # # # # # # # # # # # # # # # # # . . . .
//   6    # # # # # # # # # # # # # # # # # # . . . ^
//
//   @ party start   ^ stairs   C cache   T/S foes
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms: ENTRY (0-3, 0-2) - HALL (6-13, 0-4)
//          CLOSET/cache (16-17, 0-1) - EXTRACT (18-21, 3-6)
//   Corridor lengths: ENTRY->HALL 2, HALL->CLOSET 2, HALL->EXTRACT 4.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR_VESTIBVLVM = {
    name: 'VESTIBVLVM',
    cols: 22,
    rows: 7,

    tiles: [
      // ENTRY (0-3, 0-2)
      [0, 0], [1, 0], [2, 0], [3, 0],
      [0, 1], [1, 1], [2, 1], [3, 1],
      [0, 2], [1, 2], [2, 2], [3, 2],
      // corridor ENTRY -> HALL, row 1, length 2
      [4, 1], [5, 1],
      // HALL (6-13, 0-4) -- the wide room; every fight here can be flanked
      [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0],
      [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1],
      [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2],
      [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3],
      [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4],
      // corridor HALL -> CLOSET, row 0, length 2
      [14, 0], [15, 0],
      // CLOSET (16-17, 0-1) -- the cache, and its keeper
      [16, 0], [17, 0],
      [16, 1], [17, 1],
      // corridor HALL -> EXTRACT, row 4, length 4
      [14, 4], [15, 4], [16, 4], [17, 4],
      // EXTRACT (18-21, 3-6)
      [18, 3], [19, 3], [20, 3], [21, 3],
      [18, 4], [19, 4], [20, 4], [21, 4],
      [18, 5], [19, 5], [20, 5], [21, 5],
      [18, 6], [19, 6], [20, 6], [21, 6],
    ],

    props: [
      { kind: 'stairs', c: 21, r: 6, hidden: false, label: 'EXTRACT' },
      // Dead-end closet off the hall: the loot is a detour, and the SILIQVA
      // on the tile beside it cannot be routed around in a 2x2 room.
      { kind: 'chest',  c: 17, r: 0, hidden: false, label: 'CACHE', ampoules: 0 },
    ],

    // Party spawns, in command order, on the ENTRY's corridor line.
    // Leader first, facing the way out.
    spawns: [
      { c: 3, r: 1 },
      { c: 2, r: 1 },
      { c: 1, r: 1 },
      { c: 0, r: 1 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'TESTA',   c: 9,  r: 2 },  // HALL center -- the first fight, wide open, flankable
      { kind: 'SILIQVA', c: 12, r: 4 },  // HALL south-east, one step off the EXTRACT corridor mouth
      { kind: 'SILIQVA', c: 16, r: 1 },  // CLOSET -- guards the cache in a room with no room
      { kind: 'TESTA',   c: 19, r: 4 },  // EXTRACT room, meets you at the corridor's end
    ],
  };
})();
