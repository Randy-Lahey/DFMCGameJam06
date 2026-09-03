// Floor geometry test. Run: node tools/test-shape.js [data/floor02.js ...]
//
// Enforces the locked shape rule for hand-carved floors:
//   corridors are 1 tile WIDE, 2-5 tiles LONG, and run along the X axis.
// Plus the invariants that make a floor playable at all: every tile reachable
// from the party spawn, every prop / foe / spawn standing on real floor.
//
// A "corridor tile" is defined structurally, not by authoring intent: any
// walkable tile that belongs to no fully-walkable 2x2 block. Rooms here are
// all at least 2x2, so every room tile lands inside some block and every
// 1-wide passage falls out as a corridor. That means the test measures what
// the tile list actually IS, not what the header comment claims.
'use strict';
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) files.push('data/floor01.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };

const MIN_LEN = 2, MAX_LEN = 5;

for (const file of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  global.window = global;
  // The floor under test is whatever global THIS file defined. Scanning all
  // of global found the FIRST floor loaded, so a multi-file run tested
  // floor 01 over and over.
  const before = new Set(Object.keys(global));
  new Function(src)();
  const fresh = Object.keys(global).filter(k => !before.has(k)).map(k => global[k]);
  const F = fresh.find(v => v && v.tiles && v.spawns) ||
            Object.values(global).find(v => v && v.tiles && v.spawns);
  const tag = path.basename(file);
  // Two floors are one room by design and have no corridors to measure:
  // THRONVS (the Archon's chamber) and, potentially, any single-room floor.
  // A one-room floor must still be a solid rectangle, so "no corridors"
  // cannot be faked by a blob of tiles.
  const oneRoom = (() => {
    const cs = F.tiles.map(t => t[0]), rs = F.tiles.map(t => t[1]);
    const w = Math.max(...cs) - Math.min(...cs) + 1, h = Math.max(...rs) - Math.min(...rs) + 1;
    return w * h === F.tiles.length;
  })();
  // The Archon's floor is a dead end on purpose: no extract, the fight is the
  // only way off it. THE REFVGE has no foes and no exit either -- the Cube is
  // its door. Every other floor needs an exit the player can reach.
  const archonFloor = F.foes.length > 0 && F.foes.every(f => f.kind === 'ARCHON');
  const wantsExit = F.foes.length > 0 && !archonFloor;

  const key = (c, r) => c + ',' + r;
  const walk = new Set(F.tiles.map(t => key(t[0], t[1])));
  const has = (c, r) => walk.has(key(c, r));

  ok(walk.size === F.tiles.length, `${tag}: no duplicate tiles`);
  ok(F.tiles.every(([c, r]) => c >= 0 && c < F.cols && r >= 0 && r < F.rows),
     `${tag}: every tile inside cols x rows`);

  // ---- corridor extraction: walkable tiles in no 2x2 walkable block
  const inBlock = (c, r) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dc, dr]) =>
    has(c + dc, r + dr) && has(c + dc + 1, r + dr) &&
    has(c + dc, r + dr + 1) && has(c + dc + 1, r + dr + 1));
  const corridor = new Set(F.tiles.filter(([c, r]) => !inBlock(c, r)).map(t => key(t[0], t[1])));

  // ---- group corridor tiles into 4-connected runs
  const seen = new Set(), runs = [];
  for (const k of corridor) {
    if (seen.has(k)) continue;
    const run = [], q = [k];
    seen.add(k);
    while (q.length) {
      const [c, r] = q.pop().split(',').map(Number);
      run.push([c, r]);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = key(c + dc, r + dr);
        if (corridor.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
      }
    }
    runs.push(run);
  }

  ok(runs.length > 0 || oneRoom, `${tag}: floor has corridors at all (or is one solid room)`);
  for (const run of runs) {
    const rows = new Set(run.map(t => t[1])), cols = run.map(t => t[0]);
    const at = `(${Math.min(...cols)}-${Math.max(...cols)}, r${[...rows][0]})`;
    ok(rows.size === 1, `${tag}: corridor ${at} runs along X only (spans ${rows.size} rows)`);
    ok(run.length >= MIN_LEN && run.length <= MAX_LEN,
       `${tag}: corridor ${at} is ${run.length} long, want ${MIN_LEN}-${MAX_LEN}`);
    if (rows.size === 1) {
      const r = [...rows][0], lo = Math.min(...cols), hi = Math.max(...cols);
      ok(hi - lo + 1 === run.length, `${tag}: corridor ${at} is a solid run, no gaps`);
      ok(!has(lo, r - 1) && !has(lo, r + 1) && !has(hi, r - 1) && !has(hi, r + 1),
         `${tag}: corridor ${at} is 1 tile wide at both ends`);
      ok(has(lo - 1, r) && has(hi + 1, r),
         `${tag}: corridor ${at} lands on floor at both ends, no dead end`);
    }
  }

  // ---- connectivity: 4-way, because movement is 4-way
  const start = F.spawns[0];
  const reached = new Set([key(start.c, start.r)]);
  const q = [[start.c, start.r]];
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = key(c + dc, r + dr);
      if (walk.has(n) && !reached.has(n)) { reached.add(n); q.push([c + dc, r + dr]); }
    }
  }
  ok(reached.size === walk.size,
     `${tag}: every tile reachable from spawn (${reached.size}/${walk.size})`);

  // ---- occupants stand on floor
  ok(F.spawns.every(s => has(s.c, s.r)), `${tag}: spawns on floor`);
  ok(F.spawns.every((s, i) => i === 0 ||
      Math.abs(s.c - F.spawns[i - 1].c) + Math.abs(s.r - F.spawns[i - 1].r) === 1),
     `${tag}: spawn chain is contiguous, so the trail forms on frame one`);
  ok(F.props.every(p => has(p.c, p.r)), `${tag}: props on floor`);
  ok(F.foes.every(f => has(f.c, f.r)), `${tag}: foes on floor`);
  const taken = new Set(F.spawns.map(s => key(s.c, s.r)));
  ok(F.foes.every(f => !taken.has(key(f.c, f.r))), `${tag}: no foe standing on a spawn`);
  ok(new Set(F.foes.map(f => key(f.c, f.r))).size === F.foes.length,
     `${tag}: no two foes share a tile`);
  const st = F.props.find(p => p.kind === 'stairs');
  if (wantsExit) ok(!!st, `${tag}: floor has an exit`);

  // ---- the exit is not trivially next to the spawn
  if (st) ok(Math.abs(st.c - start.c) + Math.abs(st.r - start.r) > 10,
     `${tag}: stairs are a journey, not a step`);
}

console.log(`test-shape: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
