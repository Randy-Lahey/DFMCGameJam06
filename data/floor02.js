// FLOOR 02 -- hand-authored. 87 tiles. The party tutorial: the circle is
// two strong now, and the floor asks for it -- foes sit where a lone
// OPERATOR would be pinned, but a daemon on point (or a well-timed swap)
// opens every fight.
//
// SHAPE RULE (same as floor 01): rooms never share an edge; every
// connection is a 1-tile-wide corridor running along the X axis, 2-5 tiles
// long. North/south travel happens inside the SPINE. tools/test-shape.js
// enforces this: node tools/test-shape.js data/floor02.js
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16
//   0    . . . . . . . . . . . . . S # # #
//   1    . . . . . . . # # # . . . # # ^ #
//   2    . . . . . . . # S # = = = # # # #
//   3    . . . . . . . # # # . . . # # # #
//   4    . . . . . . . # # # . . . . . . .
//   5    . . . . . . . # # # . . . . . . .
//   6    . . . . . . . # T # . . . . . . .
//   7    # # # # . . . # # # . . . . . . .
//   8    # # # H = = = # # # . . . # # # #
//   9    # # # # . . . # # # = = = # T # #
//  10    @ @ @ @ . . . # # # . . . # . C #
//  11    . . . . . . . . . . . . . # # # #
//
//   @ party start   ^ stairs   C cache   T/S foes   H hermit
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms: ENTRY (0-3, 7-10) - SPINE (7-9, 1-10)
//          NORTHEAST/stairs (13-16, 0-3) - SOUTHEAST/cache (13-16, 8-11)
//   Corridor lengths, west to east: 3, 3, 3.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR02 = {
    name: 'FLOOR 02',
    cols: 17,
    rows: 12,

    tiles: [
      [13,0], [14,0], [15,0], [16,0],
      [7,1], [8,1], [9,1], [13,1], [14,1], [15,1], [16,1],
      [7,2], [8,2], [9,2], [10,2], [11,2], [12,2], [13,2], [14,2], [15,2], [16,2],
      [7,3], [8,3], [9,3], [13,3], [14,3], [15,3], [16,3],
      [7,4], [8,4], [9,4],
      [7,5], [8,5], [9,5],
      [7,6], [8,6], [9,6],
      [0,7], [1,7], [2,7], [3,7], [7,7], [8,7], [9,7],
      [0,8], [1,8], [2,8], [3,8], [4,8], [5,8], [6,8], [7,8], [8,8], [9,8], [13,8], [14,8], [15,8], [16,8],
      [0,9], [1,9], [2,9], [3,9], [7,9], [8,9], [9,9], [10,9], [11,9], [12,9], [13,9], [14,9], [15,9], [16,9],
      [0,10], [1,10], [2,10], [3,10], [7,10], [8,10], [9,10], [13,10], [14,10], [15,10], [16,10],
      [13,11], [14,11], [15,11], [16,11],
    ],

    props: [
      // THE HERMIT gates the corridor mouth: the only way east runs
      // through him, so the bargain cannot be walked past. He blocks his
      // tile until the choice is made, then steps into the static.
      { kind: 'hermit', c: 3, r: 8, hidden: false, label: 'THE HERMIT' },
      { kind: 'stairs', c: 15, r: 1,  hidden: false, label: 'DESCENT' },
      // First healing of the run: two doses ride in this cache. The pickup
      // also teaches the rule (one use each, satchel holds 3) -- see
      // openCache in game.js.
      { kind: 'chest',  c: 15, r: 10, hidden: false, label: 'CACHE', ampoules: 2 },
      // Inside the cache room (see floor 01's note): bites once on the way
      // in, routable-around once revealed. Never on a 1-wide corridor.
    ],

    // Party spawns, in command order, west wall of the ENTRY room. Four
    // tiles so any roster size seats cleanly; the jam flow arrives here
    // with two (OPERATOR + the Hermit's starter).
    // Bottom-LEFT corner of the ENTRY room: leader in the corner itself,
    // tail trailing east. The Hermit gates the corridor mouth up at (3,8),
    // so the first walk crosses the room -> bump -> bargain -> east.
    spawns: [
      { c: 0, r: 10 },
      { c: 1, r: 10 },
      { c: 2, r: 10 },
      { c: 3, r: 10 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'SILIQVA', c: 8,  r: 2 },  // SPINE north, on the stairs run
      { kind: 'TESTA',   c: 8,  r: 6 },  // SPINE mid -- meets you at the door
      { kind: 'SILIQVA', c: 13, r: 0 },  // NORTHEAST room, stairs guard
      { kind: 'TESTA',   c: 14, r: 9 },  // SOUTHEAST room, guarding the cache
    ],
  };
})();
