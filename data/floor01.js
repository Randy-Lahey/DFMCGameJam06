// FLOOR 01 — hand-authored. 76 tiles. Re-carved as a 3-room tutorial strip.
// Coordinates are [col, row], origin top-left.
//
// SHAPE RULE (locked): rooms are never joined by a shared edge. Every
// connection is a 1-tile-wide corridor running along the X axis, between
// 2 and 5 tiles long. tools/test-shape.js enforces the rule.
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18
//   0    # # # # # . . . # # #  # # . . . # # # ^
//   1    # # # # # . . . # # #  # # . . . # # # #
//   2    # # # # # = = = # # T  # C = = = # S # #
//   3    # # # # # . . . # # #  # # . . . # # # #
//   4    # # # @ . . . . # # #  # # . . . # # # #
//
//   @ OPERATOR spawn   ^ stairs   C cache   T/S foes
//   = corridor tile (drawn identically in game; marked here for review)
//
//   Rooms, the tutorial in order west to east:
//     ENTRY (0-4, 0-4)  — empty. Learn to move; the corridor is the only way on.
//     MID   (8-12, 0-4) — one TESTA at the center line, then the cache behind it.
//     EAST  (16-19, 0-4) — one SILIQVA between the door and the DESCENT.
//   Corridor lengths, west to east: 3, 3.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR01 = {
    name: 'FLOOR 01',
    cols: 20,
    rows: 5,

    tiles: [
      // ENTRY room (0-4, 0-4) — movement tutorial, deliberately empty
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
      [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
      // corridor ENTRY -> MID, row 2, length 3
      [5, 2], [6, 2], [7, 2],
      // MID room (8-12, 0-4) — first blood, then the cache
      [8, 0], [9, 0], [10, 0], [11, 0], [12, 0],
      [8, 1], [9, 1], [10, 1], [11, 1], [12, 1],
      [8, 2], [9, 2], [10, 2], [11, 2], [12, 2],
      [8, 3], [9, 3], [10, 3], [11, 3], [12, 3],
      [8, 4], [9, 4], [10, 4], [11, 4], [12, 4],
      // corridor MID -> EAST, row 2, length 3
      [13, 2], [14, 2], [15, 2],
      // EAST room (16-19, 0-4) — SILIQVA guards the DESCENT
      [16, 0], [17, 0], [18, 0], [19, 0],
      [16, 1], [17, 1], [18, 1], [19, 1],
      [16, 2], [17, 2], [18, 2], [19, 2],
      [16, 3], [17, 3], [18, 3], [19, 3],
      [16, 4], [17, 4], [18, 4], [19, 4],
    ],

    props: [
      { kind: 'stairs', c: 19, r: 0, hidden: false, label: 'DESCENT' },
      // Behind the TESTA on the room's center line: the fight happens on the
      // way to the loot, in that order, without a single branching choice.
      { kind: 'chest',  c: 12, r: 2, hidden: false, label: 'CACHE' },
    ],

    // Party spawns, in command order, along the bottom edge of the ENTRY
    // room. Leader-first facing the way out. Solo tutorial uses only the
    // first tile; the chain stays for post-Hermit floors and debug rosters.
    spawns: [
      { c: 3, r: 4 },
      { c: 2, r: 4 },
      { c: 1, r: 4 },
      { c: 0, r: 4 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    // One foe per teaching beat, never two at once.
    foes: [
      { kind: 'TESTA',   c: 10, r: 2 },  // MID room — PERCVSSIO lesson, guards the cache line
      { kind: 'SILIQVA', c: 17, r: 2 },  // EAST room — last fight before the DESCENT
    ],
  };
})();
