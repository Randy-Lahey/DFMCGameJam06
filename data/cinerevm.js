// CINEREVM -- hand-authored. 87 tiles. The ash house: a tall SPINE with the
// party at its foot and three doors off it -- west to the cache, north-east
// to a decoy room, south-east down a long passage to the extract. Every
// fight is inside a room; the corridors only carry you between them.
//
// SHAPE RULE (same as floor 01): rooms never share an edge; every
// connection is a 1-tile-wide corridor running along the X axis, 2-5 tiles
// long. North/south travel happens inside the SPINE. tools/test-shape.js
// enforces this: node tools/test-shape.js data/cinerevm.js
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18
//   0    # # # # # # # . . . . # # # . . . . # #
//   1    # # # # # # # . . . . = = = . S . . # #
//   2    # # # # # # # . . . . # # # . . . . # #
//   3    . . . . # # # . T . . # # # # # # # # #
//   4    . . S . = = = . . . . # # # # # # # # #
//   5    C . . . # # # . . . . # # # # # . . . .
//   6    . . . . # # # . . . . = = = = = . T . .
//   7    # # # # # # # @ @ @ @ # # # # # . . . .
//   8    # # # # # # # # # # # # # # # # . . . ^
//
//   @ party start   ^ stairs   C cache   T/S foes
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms: SPINE (7-10, 0-7) - WEST/cache (0-3, 3-6)
//          NORTHEAST/decoy (14-17, 0-2) - SOUTHEAST/extract (16-19, 5-8)
//   Corridor lengths: WEST 3, NORTHEAST 3, SOUTHEAST 5.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR_CINEREVM = {
    name: 'CINEREVM',
    cols: 20,
    rows: 9,

    tiles: [
      // SPINE (7-10, 0-7) -- the party starts at its foot
      [7, 0], [8, 0], [9, 0], [10, 0],
      [7, 1], [8, 1], [9, 1], [10, 1],
      [7, 2], [8, 2], [9, 2], [10, 2],
      [7, 3], [8, 3], [9, 3], [10, 3],
      [7, 4], [8, 4], [9, 4], [10, 4],
      [7, 5], [8, 5], [9, 5], [10, 5],
      [7, 6], [8, 6], [9, 6], [10, 6],
      [7, 7], [8, 7], [9, 7], [10, 7],
      // WEST room (0-3, 3-6) -- the cache
      [0, 3], [1, 3], [2, 3], [3, 3],
      [0, 4], [1, 4], [2, 4], [3, 4],
      [0, 5], [1, 5], [2, 5], [3, 5],
      [0, 6], [1, 6], [2, 6], [3, 6],
      // corridor WEST -> SPINE, row 4, length 3
      [4, 4], [5, 4], [6, 4],
      // corridor SPINE -> NORTHEAST, row 1, length 3
      [11, 1], [12, 1], [13, 1],
      // NORTHEAST room (14-17, 0-2) -- nothing here but teeth
      [14, 0], [15, 0], [16, 0], [17, 0],
      [14, 1], [15, 1], [16, 1], [17, 1],
      [14, 2], [15, 2], [16, 2], [17, 2],
      // corridor SPINE -> SOUTHEAST, row 6, length 5
      [11, 6], [12, 6], [13, 6], [14, 6], [15, 6],
      // SOUTHEAST room (16-19, 5-8) -- the extract
      [16, 5], [17, 5], [18, 5], [19, 5],
      [16, 6], [17, 6], [18, 6], [19, 6],
      [16, 7], [17, 7], [18, 7], [19, 7],
      [16, 8], [17, 8], [18, 8], [19, 8],
    ],

    props: [
      { kind: 'stairs', c: 19, r: 8, hidden: false, label: 'EXTRACT' },
      // Far west corner, behind the SILIQVA on the room's entry line: the
      // cache is the one thing worth the detour off the spine.
      { kind: 'chest',  c: 0, r: 5, hidden: false, label: 'CACHE', ampoules: 0 },
    ],

    // Party spawns, in command order, along the foot of the SPINE. Leader
    // in the south-west corner; everything on this floor is north or east.
    spawns: [
      { c: 7, r: 7 },
      { c: 8, r: 7 },
      { c: 9, r: 7 },
      { c: 10, r: 7 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'TESTA',   c: 8,  r: 3 },  // SPINE mid -- stands between the party and both east doors
      { kind: 'SILIQVA', c: 2,  r: 4 },  // WEST room, on the line from the door to the cache
      { kind: 'SILIQVA', c: 15, r: 1 },  // NORTHEAST decoy room -- a fight with nothing behind it
      { kind: 'TESTA',   c: 17, r: 6 },  // SOUTHEAST room, guarding the EXTRACT
    ],
  };
})();
