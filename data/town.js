// THE REFVGE -- hand-authored. 72 tiles. The hub between descents: no foes,
// no exit. The Cube in the far room is the door -- walk east to it.
//
// SHAPE RULE (same as floor 01): rooms never share an edge; every
// connection is a 1-tile-wide corridor running along the X axis, 2-5 tiles
// long. tools/test-shape.js enforces this: node tools/test-shape.js data/town.js
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18
//   0    . . . . # # # . . . . . # # # # # # # #
//   1    @ @ @ @ = = = . . . . . # # # . . . . .
//   2    . . . . # # # . . . . . # # # . . . . .
//   3    . . . . # # # . . . . . = = = . . C . .
//   4    # # # # # # # . . . . . # # # . . . . .
//   5    # # # # # # # # # # # # # # # . . . . .
//
//   @ party start   C THE CVBE
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms, west to east: LANDING (0-3, 0-3) - COMMONS (7-11, 0-4)
//                        SHRINE (15-19, 1-5), the Cube on its center line
//   Corridor lengths, west to east: 3, 3. The floor steps south as it goes
//   east, so the Cube is a short walk, never a glance.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR_REFVGE = {
    name: 'THE REFVGE',
    cols: 20,
    rows: 6,

    tiles: [
      // LANDING (0-3, 0-3) -- the party arrives here
      [0, 0], [1, 0], [2, 0], [3, 0],
      [0, 1], [1, 1], [2, 1], [3, 1],
      [0, 2], [1, 2], [2, 2], [3, 2],
      [0, 3], [1, 3], [2, 3], [3, 3],
      // corridor LANDING -> COMMONS, row 1, length 3
      [4, 1], [5, 1], [6, 1],
      // COMMONS (7-11, 0-4)
      [7, 0], [8, 0], [9, 0], [10, 0], [11, 0],
      [7, 1], [8, 1], [9, 1], [10, 1], [11, 1],
      [7, 2], [8, 2], [9, 2], [10, 2], [11, 2],
      [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
      [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
      // corridor COMMONS -> SHRINE, row 3, length 3
      [12, 3], [13, 3], [14, 3],
      // SHRINE (15-19, 1-5) -- the Cube
      [15, 1], [16, 1], [17, 1], [18, 1], [19, 1],
      [15, 2], [16, 2], [17, 2], [18, 2], [19, 2],
      [15, 3], [16, 3], [17, 3], [18, 3], [19, 3],
      [15, 4], [16, 4], [17, 4], [18, 4], [19, 4],
      [15, 5], [16, 5], [17, 5], [18, 5], [19, 5],
    ],

    props: [
      // Center of the SHRINE, two tiles in from the corridor mouth at
      // (15,3): never on a corridor, never on a mouth. 16 tiles from the
      // leader's spawn -- a walk, not a step.
      { kind: 'cube', c: 17, r: 3, hidden: false, label: 'THE CVBE' },
    ],

    // Party spawns, in command order, on the LANDING's corridor line.
    // Leader first, facing the way out.
    spawns: [
      { c: 3, r: 1 },
      { c: 2, r: 1 },
      { c: 1, r: 1 },
      { c: 0, r: 1 },
    ],

    // Nothing lives here. The Refuge is the one floor that never bites.
    foes: [],
  };
})();
