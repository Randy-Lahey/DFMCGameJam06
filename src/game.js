// game.js — turn loop, actors, AI, rendering. Depends on mapgen.js.
const { WALL, ROOM, CORRIDOR, STAIRS, generateMap } = window.MAPGEN;
const B = window.BALANCE;   // every number in this file comes from data/balance.js

const TILE = B.render.tileSize;
const AGGRO = B.ai.aggroRange;      // foes wake within this chebyshev distance, if in LOS
const FOE_COUNT = B.spawns.foeCount;
const FOE_DELAY = B.render.foeDelayMs;

const DIRS = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];

let state = null;

// ---- world helpers ---------------------------------------------------------
const inBounds = (x,y) => x>=0 && y>=0 && x<state.map.w && y<state.map.h;
const tileAt = (x,y) => state.map.tiles[y*state.map.w + x];
const isWall = (x,y) => !inBounds(x,y) || tileAt(x,y) === WALL;
const actorAt = (x,y) => state.actors.find(a => a.hp>0 && a.x===x && a.y===y);
const cheb = (a,b) => Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y));

function los(a, b) {
  let x0=a.x, y0=a.y;
  const dx=Math.abs(b.x-x0), dy=Math.abs(b.y-y0);
  const sx = x0<b.x?1:-1, sy = y0<b.y?1:-1;
  let err = dx-dy;
  while (x0!==b.x || y0!==b.y) {
    const e2 = 2*err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }
    if (x0===b.x && y0===b.y) return true;
    if (isWall(x0,y0)) return false;
  }
  return true;
}

// ---- setup -----------------------------------------------------------------
function freeTilesNear(x, y, n) {
  const out = [], seen = new Set([`${x},${y}`]), q = [[x,y]];
  while (q.length && out.length < n) {
    const [cx,cy] = q.shift();
    for (const [dx,dy] of DIRS) {
      const nx=cx+dx, ny=cy+dy, k=`${nx},${ny}`;
      if (seen.has(k) || isWall(nx,ny)) continue;
      seen.add(k); out.push({x:nx,y:ny}); q.push([nx,ny]);
      if (out.length >= n) break;
    }
  }
  return out;
}

// Build an actor from its balance.js entry. Nothing else may invent stats.
function spawnFrom(kind, extra) {
  const s = B.actors[kind];
  return Object.assign({ name:s.name, glyph:s.glyph, color:s.color,
                         hp:s.hp, maxHp:s.hp, atk:s.atk, def:s.def, awake:false }, extra);
}

function newGame(seed) {
  const map = generateMap(seed, B.map);
  state = { map, seed, actors: [], queue: [], round: 1, log: [], over: null, busy: false };

  state.actors.push(spawnFrom('hero', { id:'p', team:'party', x:map.spawn.x, y:map.spawn.y }));

  const spots = freeTilesNear(map.spawn.x, map.spawn.y, B.spawns.partyKinds.length);
  B.spawns.partyKinds.forEach((kind, i) => {
    const s = spots[i]; if (!s) return;
    state.actors.push(spawnFrom(kind, { id:'d'+i, team:'party', x:s.x, y:s.y }));
  });

  // foes: random room tiles, never the spawn room, never on top of each other
  const rng = window.MAPGEN.mulberry32(seed ^ 0x9e37);
  const candidates = [];
  for (const r of map.rooms) {
    if (r === map.spawnRoom) continue;
    for (let y=r.y; y<r.y+r.h; y++) for (let x=r.x; x<r.x+r.w; x++)
      if (tileAt(x,y) === ROOM) candidates.push({x,y});
  }
  for (let i=0; i<FOE_COUNT && candidates.length; i++) {
    const s = candidates.splice(Math.floor(rng()*candidates.length), 1)[0];
    if (actorAt(s.x,s.y)) { i--; continue; }
    const f = spawnFrom(B.spawns.foeKind, { id:'f'+i, team:'foe', x:s.x, y:s.y });
    f.name += ' ' + (i+1);
    state.actors.push(f);
  }

  say(`Floor 1 — seed ${seed}. Reach the stairs.`);
  newRound();
  drawStatic();
  pump();
}

// ---- turn scheduler --------------------------------------------------------
// One flat queue per round. Party members are first in `actors`, so they act
// first, in order, each resolving immediately. Swapping this for an energy /
// speed system later means replacing newRound() + advance() and nothing else.
function newRound() {
  state.queue = state.actors.filter(a => a.hp > 0).map(a => a.id);
}
const current = () => state.actors.find(a => a.id === state.queue[0]);

function advance() {
  state.queue.shift();
  pump();
}

function pump() {
  if (state.over) { draw(); return; }
  while (state.queue.length && !current()) state.queue.shift(); // drop the dead
  if (!state.queue.length) { state.round++; newRound(); }
  const a = current();
  draw();
  if (a.team === 'foe') {
    state.busy = true;
    setTimeout(() => { foeTurn(a); state.busy = false; advance(); }, FOE_DELAY);
  }
}

// ---- actions ---------------------------------------------------------------
// Returns true if the actor spent its turn.
function act(a, dx, dy) {
  if (dx === 0 && dy === 0) { say(`${a.name} waits.`); return true; }
  const nx = a.x+dx, ny = a.y+dy;
  if (isWall(nx,ny)) return false;
  const other = actorAt(nx,ny);
  if (other) {
    if (other.team === a.team) return false;   // no swapping in the slice
    attack(a, other);
    return true;
  }
  // no cutting a wall corner diagonally (PMD rule)
  if (dx && dy && (isWall(a.x+dx, a.y) || isWall(a.x, a.y+dy))) return false;
  a.x = nx; a.y = ny;
  if (a.id === 'p' && tileAt(nx,ny) === STAIRS) {
    state.over = 'win';
    say('You reach the stairs. Floor clear.');
  }
  return true;
}

function attack(a, b) {
  const v = B.combat.damageVariance;
  const dmg = Math.max(B.combat.minDamage,
                       a.atk - b.def + Math.floor(Math.random()*(2*v+1)) - v);
  b.hp -= dmg;
  say(`${a.name} hits ${b.name} for ${dmg}.`);
  if (b.hp <= 0) {
    b.hp = 0;
    say(`${b.name} is defeated.`);
    if (b.id === 'p') { state.over = 'lose'; say('The Hero has fallen.'); }
  }
  if (b.team === 'foe') b.awake = true;
  if (state.actors.every(x => x.team !== 'foe' || x.hp <= 0)) say('All foes down.');
}

// ---- foe AI ----------------------------------------------------------------
function foeTurn(f) {
  const party = state.actors.filter(a => a.team === 'party' && a.hp > 0);
  if (!party.length) return;
  let target = party[0];
  for (const p of party) if (cheb(f,p) < cheb(f,target)) target = p;

  if (!f.awake && cheb(f,target) <= AGGRO && los(f,target)) {
    f.awake = true;
    say(`${f.name} notices you.`);
  }

  if (f.awake) {
    if (cheb(f,target) === 1) { attack(f, target); return; }
    const ranked = DIRS.slice().sort((A,B) =>
      cheb({x:f.x+A[0],y:f.y+A[1]}, target) - cheb({x:f.x+B[0],y:f.y+B[1]}, target));
    for (const [dx,dy] of ranked) if (act(f,dx,dy)) return;
    act(f,0,0);
  } else {
    if (Math.random() < B.ai.wanderWaitChance) { act(f,0,0); return; }
    const d = DIRS[Math.floor(Math.random()*DIRS.length)];
    if (!act(f,d[0],d[1])) act(f,0,0);
  }
}

// ---- render ----------------------------------------------------------------
const svg = () => document.getElementById('stage');
const el = (tag, attrs) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

const TILE_FILL = { [WALL]:'#15151c', [CORRIDOR]:'#2f313d', [ROOM]:'#3d4052', [STAIRS]:'#c9a227' };

function drawStatic() {
  const s = svg(), m = state.map;
  s.setAttribute('viewBox', `0 0 ${m.w*TILE} ${m.h*TILE}`);
  s.setAttribute('width', m.w*TILE); s.setAttribute('height', m.h*TILE);
  s.innerHTML = '';
  const g = el('g', {});
  for (let y=0; y<m.h; y++) for (let x=0; x<m.w; x++) {
    const t = m.tiles[y*m.w+x];
    g.appendChild(el('rect', { x:x*TILE, y:y*TILE, width:TILE, height:TILE,
      fill: TILE_FILL[t], stroke:'#0d0d12', 'stroke-width':0.5 }));
  }
  s.appendChild(g);
  s.appendChild(el('g', { id:'fx' }));
  s.appendChild(el('g', { id:'actors' }));
}

function draw() {
  const fx = document.getElementById('fx');
  const ac = document.getElementById('actors');
  if (!fx || !ac) return;
  fx.innerHTML = ''; ac.innerHTML = '';

  const a = state.over ? null : current();
  if (a && a.team === 'party') {
    fx.appendChild(el('rect', { x:a.x*TILE-2, y:a.y*TILE-2, width:TILE+4, height:TILE+4,
      fill:'none', stroke:'#ffd75e', 'stroke-width':2, rx:3 }));
    for (const [dx,dy] of DIRS) {
      const nx=a.x+dx, ny=a.y+dy;
      if (isWall(nx,ny) || actorAt(nx,ny)) continue;
      if (dx && dy && (isWall(a.x+dx,a.y) || isWall(a.x,a.y+dy))) continue;
      fx.appendChild(el('circle', { cx:nx*TILE+TILE/2, cy:ny*TILE+TILE/2, r:2.5,
        fill:'#ffd75e', opacity:0.5 }));
    }
  }

  for (const act_ of state.actors) {
    if (act_.hp <= 0) continue;
    ac.appendChild(el('rect', { x:act_.x*TILE+2, y:act_.y*TILE+2, width:TILE-4, height:TILE-4,
      fill:act_.color, rx:3 }));
    const t = el('text', { x:act_.x*TILE+TILE/2, y:act_.y*TILE+TILE/2+4,
      'text-anchor':'middle', 'font-size':11, 'font-family':'monospace',
      fill:'#101018', 'font-weight':'bold' });
    t.textContent = act_.glyph;
    ac.appendChild(t);
    const frac = act_.hp/act_.maxHp;
    ac.appendChild(el('rect', { x:act_.x*TILE+2, y:act_.y*TILE+TILE-3, width:(TILE-4)*frac,
      height:2, fill: act_.team==='party' ? '#7fe08a' : '#ff8b7a' }));
  }
  drawHud();
}

function drawHud() {
  const a = state.over ? null : current();
  document.getElementById('round').textContent = `Round ${state.round}`;
  document.getElementById('turn').textContent = state.over
    ? (state.over === 'win' ? 'FLOOR CLEAR' : 'GAME OVER')
    : `${a.name}'s turn`;
  document.getElementById('turn').style.color = state.over
    ? (state.over === 'win' ? '#ffd75e' : '#e2604f') : '#e8e8ef';

  document.getElementById('party').innerHTML = state.actors
    .filter(x => x.team === 'party')
    .map(x => {
      const on = !state.over && a && a.id === x.id;
      const w = Math.round(100 * Math.max(0,x.hp)/x.maxHp);
      return `<div class="row ${on?'active':''} ${x.hp<=0?'dead':''}">
        <span class="glyph" style="background:${x.color}">${x.glyph}</span>
        <span class="nm">${x.name}</span>
        <span class="bar"><i style="width:${w}%"></i></span>
        <span class="hp">${Math.max(0,x.hp)}/${x.maxHp}</span></div>`;
    }).join('');

  document.getElementById('foes').textContent =
    `Foes left: ${state.actors.filter(x => x.team==='foe' && x.hp>0).length}`;
  document.getElementById('log').innerHTML = state.log.slice(-9).map(l => `<div>${l}</div>`).join('');
}

function say(msg) { state.log.push(msg); }

// ---- input -----------------------------------------------------------------
const KEYS = {
  ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0],
  w:[0,-1], s:[0,1], a:[-1,0], d:[1,0],
  q:[-1,-1], e:[1,-1], z:[-1,1], c:[1,1],
  '8':[0,-1],'2':[0,1],'4':[-1,0],'6':[1,0],'7':[-1,-1],'9':[1,-1],'1':[-1,1],'3':[1,1],
  '5':[0,0], ' ':[0,0], '.':[0,0],
};

function playerInput(dx, dy) {
  if (state.over || state.busy) return;
  const a = current();
  if (!a || a.team !== 'party') return;
  if (act(a, dx, dy)) advance(); else draw();
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    playerInput(k[0], k[1]);
  });
  svg().addEventListener('click', (e) => {
    if (state.over || state.busy) return;
    const a = current();
    if (!a || a.team !== 'party') return;
    const r = svg().getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / state.map.w));
    const y = Math.floor((e.clientY - r.top) / (r.height / state.map.h));
    const dx = x - a.x, dy = y - a.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { say('Too far — one tile at a time.'); draw(); return; }
    playerInput(dx, dy);
  });
  document.getElementById('regen').addEventListener('click', () => {
    const v = parseInt(document.getElementById('seed').value, 10);
    newGame(Number.isFinite(v) ? v : 1);
  });
  document.getElementById('reroll').addEventListener('click', () => {
    const v = Math.floor(Math.random()*100000);
    document.getElementById('seed').value = v;
    newGame(v);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  bindInput();
  newGame(parseInt(document.getElementById('seed').value, 10) || 7);
});
