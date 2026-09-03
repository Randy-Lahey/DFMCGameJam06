// THE NIGREDO FACE -- the Cube's first face, four tiles. Run state lives in
// game.js (state.face): which ids are cleared today, which affix label each
// tile wears, whether the Archon is down. This file is the fixed shape.
//
// Three ordinary tiles open from the first day; THRONVS (the Archon) unseals
// only once all three are cleared. `floor` names the window global that
// holds the tile's hand-carved floor (data/vestibvlvm.js and friends).
//
// Affixes are DISPLAY-ONLY labels for now, one per tile, no two the same
// (four tiles, five names). Mechanics behind the names are a later order.

(function () {
  window.FACE_NIGREDO = {
    name: 'NIGREDO',
    affixPool: ['SIGILLVM FRACTVM', 'MADIDVM', 'FLVXVS QLIPHOTH', 'NIMIETAS', 'TENEBRAE'],
    tiles: [
      { id: 'VESTIBVLVM',     floor: 'FLOOR_VESTIBVLVM',     archon: false },
      { id: 'CINEREVM',       floor: 'FLOOR_CINEREVM',       archon: false },
      { id: 'PVTREFACTORIVM', floor: 'FLOOR_PVTREFACTORIVM', archon: false },
      { id: 'THRONVS',        floor: 'FLOOR_THRONVS',        archon: true  },
    ],
  };
})();
