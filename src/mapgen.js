// mapgen.js — pure map generation. No DOM. Runs in browser and in node.
// This is the file you'll poke at most while dialling in dungeon SHAPE.

(function () {

const WALL = 0, CORRIDOR = 1, ROOM = 2, STAIRS = 3;

// The dungeon is a lattice of cells; each cell may hold one rectangular room.
// Rooms are joined by L-shaped corridors along a random spanning tree of cells,
// plus a few extra edges so the floor isn't a pure tree.
//
// There are NO default numbers in this file on purpose. Every knob comes from
// data/balance.js so there is exactly one place to tune shape.
// See https://randy-lahey.github.io/jam06/#numbers.

// ---- seeded rng ------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMap(seed, cfg) {
  if (!cfg) throw new Error('generateMap(seed, cfg): pass BALANCE.map from data/balance.js');
  const rng = mulberry32(seed);
  const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive

  const w = cfg.cols * cfg.cellW;
  const h = cfg.rows * cfg.cellH;
  const tiles = new Uint8Array(w * h); // all WALL

  const at = (x, y) => tiles[y * w + x];
  const set = (x, y, t) => { tiles[y * w + x] = t; };

  // ---- 1. place a room inside each cell ------------------------------------
  const cells = []; // cells[cy][cx] = {cx,cy,room|null}
  for (let cy = 0; cy < cfg.rows; cy++) {
    cells.push([]);
    for (let cx = 0; cx < cfg.cols; cx++) {
      const x0 = cx * cfg.cellW, y0 = cy * cfg.cellH;
      let room = null;
      if (rng() < cfg.roomChance) {
        const rw = ri(cfg.roomMinW, Math.min(cfg.roomMaxW, cfg.cellW - 4));
        const rh = ri(cfg.roomMinH, Math.min(cfg.roomMaxH, cfg.cellH - 4));
        const rx = ri(x0 + 2, x0 + cfg.cellW - 2 - rw);
        const ry = ri(y0 + 2, y0 + cfg.cellH - 2 - rh);
        room = { x: rx, y: ry, w: rw, h: rh, cx, cy };
        for (let y = ry; y < ry + rh; y++)
          for (let x = rx; x < rx + rw; x++) set(x, y, ROOM);
      }
      cells[cy].push({ cx, cy, room });
    }
  }

  // A cell with no room still needs a point for corridors to meet at.
  const anchor = (c) => c.room
    ? { x: c.room.x + ((c.room.w / 2) | 0), y: c.room.y + ((c.room.h / 2) | 0) }
    : { x: c.cx * cfg.cellW + ((cfg.cellW / 2) | 0), y: c.cy * cfg.cellH + ((cfg.cellH / 2) | 0) };

  // ---- 2. pick corridor edges: random spanning tree over cells + extras -----
  const key = (c) => c.cy * cfg.cols + c.cx;
  const seen = new Set([key(cells[0][0])]);
  const frontier = [cells[0][0]];
  const edges = [];
  while (frontier.length) {
    const c = frontier[ri(0, frontier.length - 1)];
    const nbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => cells[c.cy + dy] && cells[c.cy + dy][c.cx + dx])
      .filter(n => n && !seen.has(key(n)));
    if (!nbrs.length) { frontier.splice(frontier.indexOf(c), 1); continue; }
    const n = nbrs[ri(0, nbrs.length - 1)];
    seen.add(key(n));
    edges.push([c, n]);
    frontier.push(n);
  }
  for (let i = 0; i < cfg.extraLoops; i++) {
    const c = cells[ri(0, cfg.rows - 1)][ri(0, cfg.cols - 1)];
    const dirs = [[1, 0], [0, 1]];
    const [dx, dy] = dirs[ri(0, 1)];
    const n = cells[c.cy + dy] && cells[c.cy + dy][c.cx + dx];
    if (n) edges.push([c, n]);
  }

  // ---- 3. carve the corridors ----------------------------------------------
  const carve = (x, y) => { if (at(x, y) === WALL) set(x, y, CORRIDOR); };
  const carveH = (y, xa, xb) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) carve(x, y); };
  const carveV = (x, ya, yb) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) carve(x, y); };

  for (const [a, b] of edges) {
    const A = anchor(a), B = anchor(b);
    if (a.cy === b.cy) {           // horizontal neighbours: H, V, H
      const midX = ((A.x + B.x) / 2) | 0;
      carveH(A.y, A.x, midX);
      carveV(midX, A.y, B.y);
      carveH(B.y, midX, B.x);
    } else {                       // vertical neighbours: V, H, V
      const midY = ((A.y + B.y) / 2) | 0;
      carveV(A.x, A.y, midY);
      carveH(midY, A.x, B.x);
      carveV(B.x, midY, B.y);
    }
  }

  // ---- 4. spawn + stairs, as far apart as the cell lattice allows -----------
  const rooms = [];
  for (const row of cells) for (const c of row) if (c.room) rooms.push(c.room);
  const spawnRoom = rooms[ri(0, rooms.length - 1)];
  let stairsRoom = spawnRoom, best = -1;
  for (const r of rooms) {
    const d = Math.abs(r.cx - spawnRoom.cx) + Math.abs(r.cy - spawnRoom.cy);
    if (d > best) { best = d; stairsRoom = r; }
  }
  const centre = (r) => ({ x: r.x + ((r.w / 2) | 0), y: r.y + ((r.h / 2) | 0) });
  const spawn = centre(spawnRoom);
  const stairs = centre(stairsRoom);
  set(stairs.x, stairs.y, STAIRS);

  return { w, h, tiles, rooms, spawn, stairs, spawnRoom, stairsRoom, seed, cfg };
}

// Flood fill from spawn. Used by the smoke test and by nothing else.
function reachable(map) {
  const { w, h, tiles } = map;
  const seenT = new Uint8Array(w * h);
  const stack = [map.spawn.y * w + map.spawn.x];
  seenT[stack[0]] = 1;
  let n = 0;
  while (stack.length) {
    const i = stack.pop(); n++;
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seenT[j] || tiles[j] === WALL) continue;
      seenT[j] = 1; stack.push(j);
    }
  }
  return { count: n, seen: seenT };
}

const MAPGEN = { WALL, CORRIDOR, ROOM, STAIRS, generateMap, reachable, mulberry32 };
if (typeof module !== 'undefined' && module.exports) module.exports = MAPGEN;
if (typeof window !== 'undefined') window.MAPGEN = MAPGEN;

})();
