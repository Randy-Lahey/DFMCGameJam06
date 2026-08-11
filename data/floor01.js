// FLOOR 01 — hand-authored. 21 tiles.
// Coordinates are [col, row], origin top-left.
//
//        0   1   2   3   4   5   6   7   8   9
//   0    .   ^   .   .   .   .   .   .   .   .
//   1    #   #   #   .   .   .   .   .   .   .
//   2    #   #   #   .   .   .   .   .   #   C
//   3    x   #   #   #   J   #   #   #   #   #
//   4    .   .   .   .   #   .   .   .   .   .
//   5    .   .   .   .   @   .   .   .   .   .
//
//   @ party start   J junction   ^ stairs   C chest   x hidden spikes
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR01 = {
    cols: 10,
    rows: 6,

    tiles: [
      [1, 0],                                                   // stairs alcove
      [0, 1], [1, 1], [2, 1],                                   // left chamber, top row
      [0, 2], [1, 2], [2, 2],                                   // left chamber, mid row
      [0, 3], [1, 3], [2, 3], [3, 3],                           // left chamber floor + corridor
      [4, 3],                                                   // junction
      [5, 3], [6, 3], [7, 3],                                   // right corridor
      [8, 3], [9, 3], [8, 2], [9, 2],                           // right chamber (2x2)
      [4, 4], [4, 5],                                           // entry corridor
    ],

    props: [
      { kind: 'stairs', c: 1, r: 0, hidden: false, label: 'DESCENT' },
      { kind: 'chest',  c: 9, r: 2, hidden: false, label: 'CACHE' },
      { kind: 'spikes', c: 0, r: 3, hidden: true,  label: 'SPIKE ARRAY' },
    ],

    // Party spawns, in command order.
    spawns: [
      { c: 4, r: 5 },
      { c: 4, r: 4 },
      { c: 4, r: 3 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'TESTA',   c: 8, r: 2 },   // right chamber, guarding the cache
      { kind: 'SILIQVA', c: 9, r: 3 },   // right chamber
      { kind: 'TESTA',   c: 6, r: 3 },   // corridor patrol
      { kind: 'SILIQVA', c: 0, r: 1 },   // left chamber, far corner
      { kind: 'TESTA',   c: 2, r: 1 },   // left chamber, blocks the stairs run
    ],
  };
})();
