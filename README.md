# DAEMONWARE

Occult sci-fi dungeon crawler. Game jam vertical slice — one floor.

Plain HTML + SVG + vanilla JS. No engine, no build step, no dependencies.

- **Play:** https://randy-lahey.github.io/DFMCGameJam06/
- **Design docs & numbers bible:** https://randy-lahey.github.io/jam06/ (separate site, deliberately not linked from the game)

Locally: open `index.html`, or `daemonware-standalone.html` for a single-file copy.

## Controls

**Keyboard and mouse.** `WASD` move · `E` act, or interact with what you are standing on ·
`1`-`5` operations · click an enemy to fire · `ENTER` hits the nearest ·
`SPACE` commit the round · `ESC` cancel. A click on an adjacent tile steps there immediately.

At the descent prompt, `Y` / `N`.

**Touch.** Tap an adjacent tile to line up a step, then `CONFIRM STEP` — a stray tap costs
nothing until you confirm it. `HOLD GROUND` is the same button when nothing is staged. Tap a
nameplate to open that member's operations; tap a chip, then tap an enemy inside the range wash.
`CANCEL` backs out of anything. The gold tag over the token opens caches and takes the
descent. Long-press any tile to inspect it without spending the round; two fingers pan and pinch
to look around the floor.

The two schemes are deliberately different where the cost of a misinput differs — see the
comment on `clickTile()` in `src/game.js`.

## Turn model

A round is **move or act**, never both. `WASD` steps the whole party one tile. Otherwise each of
the three members picks one operation, in any order. Enemies commit their intent *before* anyone
moves, so stepping out of reach makes their attack whiff.

That cuts both ways: your ranged operations also miss foes that walked out of range.

## Layout

```
index.html                  the game — also the GitHub Pages root, so / is playable
daemonware-standalone.html  same game, all scripts inlined, single file. Generated.
data/balance.js             THE NUMBERS BIBLE — single source of truth
data/floor01.js             hand-authored 21-tile floor, props, enemy spawns
src/game.js                 state, turn resolution, AI, render, input
src/combat.js               the tactical chamber: board, HUD, its own stylesheet
src/icons.js                ability/item icon registry — drop finished art in here
src/sprites.js              every SVG sprite
tools/build-standalone.py   regenerates daemonware-standalone.html
```

## The one rule

**Every number lives in `data/balance.js`.** The game reads it at runtime, and the docs site
loads *this same file* over HTTP and renders it live. There is no second copy, so the numbers
bible cannot drift from the build. If you're about to type a number into `src/*.js`, it belongs
in `data/balance.js` instead.

It's a `.js` file rather than `.json` so the game still runs off `file://` — `fetch` is blocked
there, a `<script>` tag isn't.

## Editing

All tunable values live in `data/balance.js`. The floor layout is `data/floor01.js` — edit the
`tiles` array; nothing else reads geometry.

After changing any source file, regenerate the single-file build:

```bash
python3 tools/build-standalone.py
```

On Windows, run it as `PYTHONUTF8=1 python3 tools/build-standalone.py`. The script uses bare
`read_text()`/`write_text()`, so on a cp1252 locale it reads the UTF-8 em dashes as mojibake and
writes a corrupted file. It also reports a *character* count, not bytes — 75,110 against a
75,134-byte file. Not a discrepancy; multi-byte em dashes.

## Architecture, briefly

`src/game.js` is one IIFE over a single `state` object. The round is resolved in exactly one
place — `resolveRound()` — in fixed phases: foes commit intents off pre-move positions, then
movement, then queued operations and foe attacks, then upkeep. Nothing else advances the turn,
so changing the turn model means changing that one function.

Operations are data, not code. `data/balance.js` declares each one's `kind`, `targets`, `range`
and cost; `applyOp()` dispatches on `kind` (`strike`, `sweep`, `hex`, `ward`). Adding an
operation to an existing kind is a balance edit with no code change.

Rendering is stateless — `draw()` rebuilds the SVG from `state` every frame. The two exceptions
are the roster cards and the operations fan, which are built once and mutated, because replacing
their nodes each frame would kill the CSS transitions.

## GitHub Pages setup (one-time, manual)

Settings → Pages → Source: **Deploy from a branch** → Branch: **main**, folder: **/ (root)** → Save.

Root serves the game at https://randy-lahey.github.io/DFMCGameJam06/. **Do not set the folder to
`/docs`** — there is no `docs/` folder in this repo any more, so that setting would take the game
offline rather than serve anything. `.nojekyll` is committed so GitHub doesn't run Jekyll over the
game files.

`dev` is the working branch, `main` is what Pages publishes. Merge dev → main to ship.

### The one cross-repo dependency

The design docs live in a **separate** repo, `Randy-Lahey/Randy-Lahey.github.io`, published at
https://randy-lahey.github.io/jam06/. That site loads `data/balance.js` straight from this repo's
Pages site:

```html
<script src="https://randy-lahey.github.io/DFMCGameJam06/data/balance.js"></script>
```

Same origin, different repo — so there is still exactly one copy of the numbers bible and it
cannot drift. **Renaming this repo, making it private, or turning Pages off breaks the Numbers
page over there.** If you rename it, update that one `<script src>` in the docs repo.
