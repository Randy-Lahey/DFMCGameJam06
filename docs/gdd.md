# GDD — DFMC Game Jam 06

A one-floor turn-based dungeon crawl in the shape of Pokémon Mystery Dungeon / Tales of Maj'Eyal.
Built in plain HTML + SVG + vanilla JS. No engine, no build step.

> **Scope for the jam: one playable dungeon floor.** Everything below that isn't in
> "In the slice" is a later-floor problem. Resist.

## The core loop

```
enter floor → read the room → decide who acts and how → resolve → repeat → reach the stairs
```

The chain we are protecting: **one decision → immediate visible consequence → new information → next decision.**
If any link in that chain gets slow or ambiguous, that's the bug worth fixing, ahead of any content.

## Turn model

Per-member, resolve immediately.

1. Hero acts. It resolves right away — no confirm step, no undo.
2. Daemon Alpha acts.
3. Daemon Beta acts.
4. All foes act.
5. Round ends.

This is **not** PMD's model (leader-only, allies on AI). We control all three. That's a
deliberate bet that issuing three decisions per round is more interesting than one; if
playtesting says otherwise, dropping to leader-only is a small change, because ally AI is
strictly less code than ally control.

An action is: move one tile (8 directions), bump an adjacent foe to attack it, or wait.
Diagonal moves cannot cut a wall corner — PMD's rule, and it matters because it makes
corridors genuinely narrow.

### Why the scheduler is isolated

Turn order lives in exactly three functions in `src/game.js`: `newRound()`, `advance()`,
`pump()`. Nothing else in the codebase knows how turn order is decided.

The likely next step is a ToME-style **energy/speed system**, where a fast foe acts twice per
player turn. That change replaces those three functions and touches nothing else. This is the
main piece of forward planning in the codebase, and the only one.

## Dungeon shape

A lattice of cells; each cell may hold one rectangular room; rooms are connected by L-shaped
corridors along a random spanning tree over the cells, plus a few extra edges so the floor
isn't a pure tree with dead ends.

Connectivity is **guaranteed by construction** and verified by `node tools/test-mapgen.js`,
which generates 500 floors and asserts every walkable tile — and the stairs specifically — is
reachable from the spawn.

Shape is tuned entirely from `map` in `data/balance.js`. See the Numbers page.

**Shape iteration loop:** edit `data/balance.js` → `node tools/test-mapgen.js` → read the
ASCII dump it prints. No browser needed. This is the fast path; use it.

## In the slice

- Rooms + corridors, seeded and regenerable from the UI
- Hero + 2 daemons, all player-controlled
- 8-directional movement, no corner-cutting
- Bump-to-attack, HP, death
- Foes: wander until they see you (range + line of sight), then chase and attack
- Stairs = floor clear. Hero dies = game over.
- Programmer art: coloured rects, glyphs, HP pips

## Deliberately not in the slice

| Cut | Why |
|---|---|
| Field of view / fog | Very PMD, but it changes how dungeon *shape reads*. Adding it before shape is settled means tuning two things at once. |
| Abilities | Next thing to build. Held back so the plain move/attack loop can be judged on its own. |
| Items, status effects | Content, not loop. |
| Party swap / positioning rules | Adds a rule before we know we want it. |
| Save/load, floor 2, meta-progression | Not a one-floor problem. |

## Priority order after the slice

1. **Shape pass.** Tune `map` numbers until floors feel right. Cheapest change, biggest effect.
2. **One ability.** A ranged or AoE attack targeting a tile. This is the first real test of
   whether per-member input feels good. Do it before adding any content.
3. **Ally AI toggle.** Let daemons run themselves so 3-unit control can be A/B'd against
   PMD's leader-only. We built the harder version; downgrading is easy.
4. **FOV / fog.** Only once shape is settled.
5. Items, status effects, floor 2.

## Ship target

itch.io, HTML5 project. Build is `index.html` + `src/` + `data/`, zipped. `tools/build-itch.sh`
does it. No server required — the game runs off `file://`, which is why the numbers bible is
a `.js` file rather than `.json`.
