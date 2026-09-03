// PVTREFACTORIVM -- hand-authored. 77 tiles. The rot works: a cramped
// entry, a deep hall that drops south as you cross it, a two-wide
// antechamber that cannot be flanked, then a long passage to the extract.
// The floor keeps stepping down and right; the way back is the way you came.
//
// SHAPE RULE (same as floor 01): rooms never share an edge; every
// connection is a 1-tile-wide corridor running along the X axis, 2-5 tiles
// long. tools/test-shape.js enforces this:
//   node tools/test-shape.js data/pvtrefactorivm.js
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18  20
//   0    @ . . # # # # # # # # # # # # # # # # # # #
//   1    @ @ @ = = = . . . . . # # # # # # # # # # #
//   2    . . . # # # . . S . . # # # # # # # # # # #
//   3    # # # # # # . . . . . # # # # # # # . . . .
//   4    # # # # # # . . . . . # # . . # # # . . . .
//   5    # # # # # # . T . . . = = . S # # # . . . .
//   6    # # # # # # C . . . . # # . . = = = . T . .
//   7    # # # # # # # # # # # # # # # # # # . . . .
//   8    # # # # # # # # # # # # # # # # # # . . . ^
//
//   @ party start   ^ stairs   C cache   T/S foes
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms: ENTRY (0-2, 0-2) - HALL (6-10, 1-6)
//          ANTE (13-14, 4-6) - EXTRACT (18-21, 3-8)
//   Corridor lengths, west to east: 3, 2, 3.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR_PVTREFACTORIVM = {
    name: 'PVTREFACTORIVM',
    cols: 22,
    rows: 9,

    tiles: [
      // ENTRY (0-2, 0-2) -- barely room to turn around
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
      // corridor ENTRY -> HALL, row 1, length 3
      [3, 1], [4, 1], [5, 1],
      // HALL (6-10, 1-6) -- enter at the top, leave at the bottom
      [6, 1], [7, 1], [8, 1], [9, 1], [10, 1],
      [6, 2], [7, 2], [8, 2], [9, 2], [10, 2],
      [6, 3], [7, 3], [8, 3], [9, 3], [10, 3],
      [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
      [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
      [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
      // corridor HALL -> ANTE, row 5, length 2
      [11, 5], [12, 5],
      // ANTE (13-14, 4-6) -- two wide, no way around
      [13, 4], [14, 4],
      [13, 5], [14, 5],
      [13, 6], [14, 6],
      // corridor ANTE -> EXTRACT, row 6, length 3
      [15, 6], [16, 6], [17, 6],
      // EXTRACT (18-21, 3-8)
      [18, 3], [19, 3], [20, 3], [21, 3],
      [18, 4], [19, 4], [20, 4], [21, 4],
      [18, 5], [19, 5], [20, 5], [21, 5],
      [18, 6], [19, 6], [20, 6], [21, 6],
      [18, 7], [19, 7], [20, 7], [21, 7],
      [18, 8], [19, 8], [20, 8], [21, 8],
    ],

    props: [
      { kind: 'stairs', c: 21, r: 8, hidden: false, label: 'EXTRACT' },
      // South-west corner of the HALL, the far side from the way on: a
      // TESTA sits one tile off it, so the loot costs a fight or a dodge.
      { kind: 'chest',  c: 6, r: 6, hidden: false, label: 'CACHE', ampoules: 0 },
    ],

    // Party spawns, in command order, curled into the ENTRY. Leader on the
    // corridor line facing east; the tail wraps up the west wall.
    spawns: [
      { c: 2, r: 1 },
      { c: 1, r: 1 },
      { c: 0, r: 1 },
      { c: 0, r: 0 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'SILIQVA', c: 8,  r: 2 },  // HALL north, one row below the entry line
      { kind: 'TESTA',   c: 7,  r: 5 },  // HALL south-west, beside the cache
      { kind: 'SILIQVA', c: 14, r: 5 },  // ANTE -- between both mouths of a two-wide room
      { kind: 'TESTA',   c: 19, r: 6 },  // EXTRACT room, at the end of the last passage
    ],
  };
})();
