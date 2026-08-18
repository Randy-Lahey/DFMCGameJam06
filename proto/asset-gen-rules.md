# DAEMONWARE — GPT Image Gen Rules (iso combat assets)

Copy-paste blocks are marked `>>>`. Follow top to bottom the first time; after that only §2 and §5 matter per asset.

## 1. Lock the camera once, never rephrase it

Every prompt starts with this exact block. Do not paraphrase it per asset — drift in the camera wording is the #1 cause of mismatched sprites.

>>> 2:1 dimetric isometric game sprite, late-90s/early-2000s CRPG style
>>> (Dofus / Fallout / RollerCoaster Tycoon era). Single object, centered,
>>> viewed from the standard isometric game camera (front-left face and
>>> front-right face visible, top visible). Solid #00FF00 background.
>>> Soft contact shadow directly under the object only. No ground tile,
>>> no floor, no environment.

Why 2:1 and not "isometric": true 30° isometric reads wrong next to 2:1 game art. All the era references are 2:1.

## 2. One object per image, always

- Never "a tileset of rocks" or "8 variations." You cannot slice a grid image cleanly — perspective and lighting shift across the sheet.
- Want variations? Run the same prompt 4 times. Cheaper than fixing a sheet.
- Never characters + props in one image.

## 3. Style anchor: the first accepted image rules all others

1. Generate candidates for ONE hero prop (suggest: a hermetic obelisk or PCB-trace standing stone — something that sets tone).
2. Pick the best one. That image is now the **anchor**.
3. Every subsequent generation: attach the anchor as an image input + add to the prompt:

>>> Match the rendering style, palette saturation, edge treatment, and
>>> lighting direction of the attached reference image exactly.

4. If a batch drifts (shinier, more painterly, different light angle), regenerate with the anchor re-attached. Do not hand-fix drift — it compounds.

Light direction: pick one now and put it in the anchor prompt. Suggest **top-left**, the era default. Every asset forever after uses it.

## 4. Palette + era treatment

Add to every prompt:

>>> Muted dark palette, near-black substrate with thin luminous circuit
>>> accents (teal / gold / oxblood). Slightly desaturated, limited color
>>> count, clean pixel-friendly edges. No bloom, no lens effects, no
>>> photorealism, no painterly brushwork.

Post-process for the era look (optional but strong): posterize / quantize to a limited palette (e.g. 32–64 colors) after downscaling. Modern AI gradients scream 2024; quantizing kills that instantly.

## 5. Per-asset pipeline (repeat for every asset)

1. Prompt = camera block (§1) + palette block (§4) + one line describing the object + anchor image attached (§3). Generate at 1024×1024.
2. Strip green: `pip install rembg` then `rembg i in.png out.png` (~seconds per image). Chroma-key green survives rembg better than white/transparent requests, which gpt-image handles inconsistently.
3. Downscale with nearest-neighbor or bicubic-then-quantize:
   - Ground-footprint props: fit the base to a **128×64 diamond**.
   - Tall props (obelisks, pillars, terminals): 128×128 or 128×192 canvas, object's base sitting on the bottom 128×64 diamond.
   - Characters/daemons: 128×128, feet at the diamond center.
4. Name it: `props/obelisk-01.png`, `actors/testa-iso.png`. Kebab-case, no spaces.
5. Drop finished PNGs to me — I base64-embed them per the existing sprite pipeline.

## 6. What NOT to ask GPT image gen for

1. **Animation frames.** It cannot hold a character identical across frames. Animations stay in the fxsheets pipeline (effects) or single static poses (actors) for the jam.
2. **The ground tiles themselves.** Flat diamond floor tiles are cleaner drawn programmatically (SVG) in the Tron style we already have — and they must tile perfectly, which gen art won't.
3. **UI elements.** Timeline strip, AP/CYCLES pips, buttons — all SVG, all mine.
4. **Text or glyphs in-image.** It mangles them; Latin-V lettering doubly so. Add text in SVG on top.
5. **Full scenes.** No "isometric dungeon room." Objects only; I compose the scene.

## 7. First shopping list (5 assets, priority order)

1. Style-anchor prop (obelisk / standing stone) — everything depends on it
2. One blocking obstacle, ~1 tile (broken pillar, slag heap) — LOS testing
3. One tall blocker, 1 tile footprint (monolith) — occlusion/paint-order testing
4. OPERATOR static iso pose
5. TESTA static iso pose

Everything past these 5 waits until the combat loop runs.

## 8. Daemon / character sprites (this perspective)

1. **One facing only: bottom-left.** Prompt: "full-body character facing the
   lower-left, three-quarter isometric view." Engine mirrors for the other
   facing. Never generate both facings — they won't match.
2. **Silhouette over surface detail.** Characters render at 60–100px — half
   the cubes' size. Prompt: "bold readable silhouette, chunky shapes, minimal
   fine detail, one glowing accent color." Accent color = alchemical type.
3. **Scale via canvas %.** Same 1024×1024 canvas always; "character fills 70%
   of frame height" (standard) or 90% (large daemons). Keeps roster scale
   consistent for free.
4. **Grounded stance.** "Standing, weight centered, feet close together,
   small ground contact area." Wide stances hang off the 64px tile diamond.
   No shadow (engine adds it).
5. **Static idle with implied motion** — a lean, hover, or coil. One pose per
   daemon for the jam, no animation frames.

## 9. Arena backdrops

- Keep the arena CENTER low-contrast and quiet; put detail at the rim
  (walls, obelisks, stairs). The game grid floats over the center.
- The painted floor will never align with the game grid — it's texture,
  not tiles. Don't draw a floor grid pattern that begs to align.
- Full scenes are allowed here (exception to §6.5) because nothing is
  sliced out of them.
