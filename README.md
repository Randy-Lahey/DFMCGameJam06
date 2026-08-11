# DFMC Game Jam 06

A one-floor turn-based dungeon crawl in the shape of Pokémon Mystery Dungeon / Tales of Maj'Eyal.
Plain HTML + SVG + vanilla JS. No engine, no build step, no dependencies.

- **Play:** https://randy-lahey.github.io/DFMCGameJam06/
- **Design docs & numbers bible:** https://randy-lahey.github.io/DFMCGameJam06/docs/

Locally: open `index.html` in a browser. That's it.

## Layout

```
index.html          the game — also the GitHub Pages root, so / is playable
src/mapgen.js       dungeon shape. Pure, no DOM, runs in node.
src/game.js         turn scheduler, actions, AI, SVG rendering, input
data/balance.js     THE NUMBERS BIBLE — single source of truth
docs/               GitHub Pages design site (GDD, live numbers, dev log)
tools/              test + build scripts
```

## The one rule

**Every number lives in `data/balance.js`.** The game reads it at runtime; the docs site
renders it live at `/docs/#numbers`. There is no second copy, so the numbers bible cannot
drift from the build. If you're about to type a number into `src/*.js`, it belongs in
`data/balance.js` instead.

It's a `.js` file rather than `.json` so the game still runs off `file://` — `fetch` is
blocked there, a `<script>` tag isn't.

## Tuning dungeon shape

```
edit data/balance.js  →  node tools/test-mapgen.js  →  read the ASCII floor it prints
```

No browser in that loop. `tools/test-mapgen.js` also asserts 500 floors are fully connected
with reachable stairs, so a bad shape change fails loudly. Pass a seed to look at a specific
floor: `node tools/test-mapgen.js 42`.

When you like it, open the game and hit **Regenerate**. Seeds are stable — the same seed
always gives the same floor, so a layout you liked is reproducible.

## Shipping to itch.io

```bash
bash tools/build-itch.sh
```

Produces `build/dfmc-jam06.zip` containing `index.html`, `src/`, `data/` — upload as an
HTML5 project with "This file will be played in the browser" ticked. The docs and tools are
excluded.

## GitHub Pages setup (one-time, manual)

Settings → Pages → Source: **Deploy from a branch** → Branch: **main**, folder: **/ (root)** → Save.

Root serves the game; `/docs/` serves the design site. `.nojekyll` is committed so GitHub
doesn't run Jekyll over the game files.

## Architecture, briefly

Turn order lives in exactly three functions in `src/game.js` — `newRound()`, `advance()`,
`pump()`. Nothing else knows how turn order is decided, so swapping in a ToME-style
energy/speed system later means replacing those three and nothing more.

All actions go through `act(actor, dx, dy)` returning "did this spend the turn?". Abilities
slot in beside it with the same contract; the input layer never changes.

Rendering is stateless — `draw()` rebuilds the actor layer from `state` each turn.

Full detail in [docs/gdd.md](docs/gdd.md).
