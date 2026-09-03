// THRONVS -- hand-authored. 40 tiles. The Archon's chamber: one solid room,
// no corridors, no exit. The fight is the only way off this floor.
//
// SHAPE RULE: a one-room floor must be a solid rectangle (tools/test-shape.js
// checks cols x rows === tile count). node tools/test-shape.js data/thronvs.js
//
//        0 1 2 3 4 5 6 7
//   0    . . . . . . . .
//   1    . . . . . . . .
//   2    @ @ . A . . . .
//   3    @ . . . . . . .
//   4    @ . . . . . . .
//
//   @ party start   A ARCHON
//
//   Room: THRONE (0-7, 0-4). The Archon stands two tiles east of the
//   leader on the center line -- in reach on the first command.
//
// To reshape the floor, edit `tiles` only. Nothing else reads geometry.

(function () {
  window.FLOOR_THRONVS = {
    name: 'THRONVS',
    cols: 8,
    rows: 5,

    tiles: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0],
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
      [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    ],

    // No cache, no stairs. Nothing here but the throne and what sits on it.
    props: [],

    // Party spawns, in command order. Leader on the center line facing the
    // Archon; the tail curls down the west wall behind him.
    spawns: [
      { c: 1, r: 2 },
      { c: 0, r: 2 },
      { c: 0, r: 3 },
      { c: 0, r: 4 },
    ],

    // Foe placements. `kind` keys into BALANCE.foes.
    foes: [
      { kind: 'ARCHON', c: 3, r: 2 },  // two tiles east of the leader, same row
    ],
  };
})();
