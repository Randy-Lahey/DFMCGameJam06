# Dev log

Newest first. One entry per session. Keep entries short — what changed, what it cost, what's next.

---

## 2026-08-10 — Vertical slice playable

**Built:** seeded rooms-and-corridors generator, per-member turn scheduler, 8-dir movement
with no corner-cutting, bump-attack, foe wander/chase AI, stairs win + hero-death lose,
SVG programmer-art renderer with HUD and log.

**Verified:**

- `node tools/test-mapgen.js` — 500/500 floors fully connected, stairs always reachable
- Browser: combat, floor-clear, and game-over all confirmed; no console errors

**Restructured** into one repo: game at root (so GitHub Pages serves it directly), design
docs in `/docs`, numbers in `/data/balance.js` as the single source of truth for both.

**Bug worth remembering:** two classic `<script>` files both declaring top-level `const WALL`
collided — top-level `const` in a classic script goes into the *shared* global lexical scope,
not the script's own. Fixed by wrapping `mapgen.js` in an IIFE. Will bite again on the next
file added unless each one is wrapped the same way.

**Open questions for playtest:**

- Do three units per round feel like agency or like admin?
- Does `extraLoops: 2` produce enough loops to stop backtracking feeling bad?
- Is `aggroRange: 8` too generous — does a room ever feel like a stealth choice?

**Next:** shape pass on `data/balance.js`, then one tile-targeted ability.
