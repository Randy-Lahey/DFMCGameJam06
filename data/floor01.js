// FLOOR 01 — hand-authored. 93 tiles. Re-carved at 2x resolution (was 10x6 / 21).
// Coordinates are [col, row], origin top-left.
//
//        0 1 2 3 4 5 6 7 8 9 10  12  14  16  18
//   0    . ^ # . . . . . . . . . . . . . . . . .
//   1    . # # . . . . . . . . . . . . . . . . .
//   2    . . # . . . . . . . . . . . # # # # # C
//   3    x # # # # # . . . . . . . . # T # # T #
//   4    # # # # S # # # # # # # # # # # # # # #
//   5    # # # # # # # # # # # T # # # # # # # #
//   6    S # # # # # . . # # . . . . # S # # # #
//   7    . . . . . . . . # # . . . . # # # # # #
//   8    . . . . . . . . # # . . . . . . . . . .
//   9    . . . . . . . . # # . . . . . . . . . .
//  10    . . . . . . . . # # . . . . . . . . . .
//  11    . . . . . . . . @ # . . . . . . . . . .
//
//   @ party start   ^ stairs   C cache   x hidden spikes   T/S foes
//
//   Shape notes: rows 4-5 are the 2-wide highway. The stairs approach
//   narrows to 1 tile at (2,2) — the only narrow corridor, on purpose.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR01 = {
    cols: 20,
    rows: 12,

    tiles: [
      [1, 0], [2, 0],                                           // stairs alcove
      [1, 1], [2, 1],
      [2, 2],                                                   // the neck: 1-wide
      [14, 2], [15, 2], [16, 2], [17, 2], [18, 2], [19, 2],     // right chamber, top
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],           // left chamber, top
      [14, 3], [15, 3], [16, 3], [17, 3], [18, 3], [19, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4],           // highway, north lane
      [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4],
      [14, 4], [15, 4], [16, 4], [17, 4], [18, 4], [19, 4],
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],           // highway, south lane
      [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [13, 5],
      [14, 5], [15, 5], [16, 5], [17, 5], [18, 5], [19, 5],
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],           // left chamber, floor
      [8, 6], [9, 6],
      [14, 6], [15, 6], [16, 6], [17, 6], [18, 6], [19, 6],     // right chamber, floor
      [8, 7], [9, 7],
      [14, 7], [15, 7], [16, 7], [17, 7], [18, 7], [19, 7],
      [8, 8], [9, 8],                                           // entry corridor, 2-wide
      [8, 9], [9, 9],
      [8, 10], [9, 10],
      [8, 11], [9, 11],
    ],

    props: [
      { kind: 'stairs', c: 1, r: 0, hidden: false, label: 'DESCENT' },
      { kind: 'chest',  c: 19, r: 2, hidden: false, label: 'CACHE' },
      { kind: 'spikes', c: 0, r: 3, hidden: true,  label: 'SPIKE ARRAY' },
    ],

    // Party spawns, in command order.
    spawns: [
      { c: 8, r: 11 },
      { c: 9, r: 11 },
      { c: 8, r: 10 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'TESTA',   c: 18, r: 3 },  // right chamber, guarding the cache
      { kind: 'TESTA',   c: 14, r: 4 },  // right chamber mouth
      { kind: 'SILIQVA', c: 15, r: 6 },  // right chamber, deep
      { kind: 'TESTA',   c: 11, r: 5 },  // highway patrol, east
      { kind: 'TESTA',   c: 2, r: 3 },   // left chamber, blocks the neck
      { kind: 'SILIQVA', c: 0, r: 6 },   // left chamber, far corner
      { kind: 'SILIQVA', c: 4, r: 4 },   // left chamber, mid floor
    ],
  };
})();
