// node tools/test-mapgen.js
// Asserts every generated floor is fully connected, then prints one as ASCII.
// This is the fast loop for tuning dungeon shape — no browser needed.
const { generateMap, reachable, WALL } = require('../src/mapgen.js');
const BALANCE = require('../data/balance.js');
const cfg = BALANCE.map;

const SEEDS = 500;
let fails = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const map = generateMap(seed, cfg);
  const floorTiles = map.tiles.reduce((n, t) => n + (t !== WALL ? 1 : 0), 0);
  const { count, seen } = reachable(map);
  const stairsOk = seen[map.stairs.y * map.w + map.stairs.x] === 1;
  if (count !== floorTiles || !stairsOk) {
    fails++;
    if (fails <= 5) console.log(`seed ${seed}: ${count}/${floorTiles} reachable, stairsOk=${stairsOk}`);
  }
}
console.log(fails === 0
  ? `PASS — ${SEEDS}/${SEEDS} floors fully connected, stairs always reachable`
  : `FAIL — ${fails}/${SEEDS} floors had unreachable tiles`);

const seed = parseInt(process.argv[2], 10) || 7;
const m = generateMap(seed, cfg);
const ch = ['#', '.', ' ', '>'];
let out = '';
for (let y = 0; y < m.h; y++) {
  let line = '';
  for (let x = 0; x < m.w; x++) {
    if (x === m.spawn.x && y === m.spawn.y) line += '@';
    else line += ch[m.tiles[y * m.w + x]];
  }
  out += line + '\n';
}
console.log(`\nseed ${seed}  ${m.w}x${m.h}  (# wall, . corridor, blank room, > stairs, @ spawn)`);
console.log('pass a seed as an argument: node tools/test-mapgen.js 42\n');
console.log(out);
process.exit(fails === 0 ? 0 : 1);
