"use strict";
// Icon registry. Loads before combat.js via a plain <script>; no modules, no
// build, no fetch -- everything is inline so it works from file://.
//
// THE WHOLE API is assignment. To add or replace an icon:
//   window.DW_ICONS.foo = '<svg viewBox="0 0 24 24" ...>...</svg>';   // vector
//   window.DW_ICONS.foo = { png:"data:image/png;base64,...", w:24, h:24 }; // raster
// The raster shape mirrors src/sprites.js ({href,w,h} is accepted too), so
// finished PNG art drops in later with zero layout change: iconHTML keeps
// emitting a size-x-size box either way.
//
// Vector icons must paint with currentColor and carry no fixed width/height --
// iconHTML injects those per call so one glyph serves the 16px list rows and
// the 24px action bar, and so a disabled/hot/selected button just changes
// `color` and the icon follows.

(function () {
  // Shared root attrs live on each stored icon rather than being injected, so a
  // third-party <svg> pasted into the registry keeps its own presentation.
  const S = (d) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const FILL = ' fill="currentColor" stroke="none"'; // the one filled accent per glyph

  const ICONS = {
    // Melee strike, one adjacent foe: shaft -> struck point -> shock chevron.
    percvssio: S(
      '<path d="M2.2 12h4.6"/>' +
      '<path d="M11 8.4l3.6 3.6-3.6 3.6-3.6-3.6z"' + FILL + "/>" +
      '<path d="M17 6.2l5 5.8-5 5.8"/>'
    ),
    // Melee sweep: broken ring around a core, cardinal ticks = everything touching you.
    abrasio: S(
      '<circle cx="12" cy="12" r="2.4"' + FILL + "/>" +
      '<path d="M12 5a7 7 0 0 1 7 7M12 19a7 7 0 0 1-7-7"/>' +
      '<path d="M12 2.2v2.2M21.8 12h-2.2M12 21.8v-2.2M2.2 12h2.2"/>'
    ),
    // Hex/debuff: binding sigil -- hex cell, clamped core, reads through walls.
    concretio: S(
      '<path d="M12 2.4l8.3 4.8v9.6L12 21.6l-8.3-4.8V7.2z"/>' +
      '<path d="M12 8l3.4 4-3.4 4-3.4-4z"' + FILL + "/>" +
      '<path d="M6.2 9.6v4.8M17.8 9.6v4.8"/>'
    ),
    // Sniper bolt: a single hard zigzag lance, legible down to 12px.
    fvlgvr: S('<path d="M13.8 2.2L5.4 13.2h5.2l-1.4 8.6L18.6 10.8h-5.2z"/>'),
    // Cross-shaped AoE: four arms off a burning core, sparks in the quadrants.
    immolatio: S(
      '<path d="M12 2.4v6.2M12 15.4v6.2M2.4 12h6.2M15.4 12h6.2"/>' +
      '<path d="M12 9l3 3-3 3-3-3z"' + FILL + "/>" +
      '<path d="M6.6 6.6l2.2 2.2M17.4 6.6L15.2 8.8M17.4 17.4L15.2 15.2M6.6 17.4l2.2-2.2"/>'
    ),
    // Swap places: two counter-running arrows, no overlap so it stays clean at 16px.
    permvto: S(
      '<path d="M4.2 8.5h12M13 5l3.5 3.5L13 12"/>' +
      '<path d="M19.8 15.5h-12M11 12l-3.5 3.5L11 19"/>'
    ),
    // Shove: arrow driving a body into a wall plate.
    impvlsvs: S(
      '<path d="M20.6 4.5v15"/>' +
      '<path d="M2.4 12h8.6M8.6 9l3 3-3 3"/>' +
      '<path d="M14.4 8.4h4v7.2h-4z"' + FILL + "/>"
    ),
    // Foe melee: opposed jaws, one fang solid so the bite reads instantly.
    morsvs: S(
      '<path d="M3.5 6.5c4.5 3.6 12.5 3.6 17 0"/>' +
      '<path d="M3.5 17.5c4.5-3.6 12.5-3.6 17 0"/>' +
      '<path d="M7.6 8.9l2.2 4.2 2.2-4.2z"' + FILL + "/>" +
      '<path d="M14.6 15.1l1.9-3.7 1.9 3.7"/>'
    ),
    // Foe ranged: dart in flight -- solid head, fletching bars for the vector.
    iacvlvm: S(
      '<path d="M5.5 18.5L17 7"/>' +
      '<path d="M20.5 3.5l-1.9 5.1-3.2-3.2z"' + FILL + "/>" +
      '<path d="M3.4 16l3.2 3.2M6.2 13.2l3.2 3.2"/>'
    ),
    // Healing vial: combat.js VIAL_SVG geometry, rescaled 12x16 -> 24x24 box
    // (x1.4, centred) and recoloured to currentColor so it tints with the button.
    ampvlla: S(
      '<path d="M9.2 2.2h5.6v2.3H9.2z"' + FILL + "/>" +
      '<path d="M10 5.5h4v3.7l3.6 7.8v3.6L16.1 21.8H8.1L6.4 20.7v-3.6l3.6-7.8z"/>' +
      '<path d="M7.8 16.8h8.4v3.2l-1.1 1.3H8.9l-1.1-1.3z"' + FILL + "/>"
    )
  };

  // Slicing off the "<svg" prefix once per icon keeps the hot redraw path to
  // pure concatenation. Keyed on the source string so a live re-assignment
  // (see the header note) invalidates itself.
  const tails = Object.create(null);
  function tailOf(id, src) {
    const c = tails[id];
    if (c !== undefined && c.src === src) return c.tail;
    const i = src.indexOf("<svg");
    const t = i < 0 ? null : src.slice(i + 4);
    tails[id] = { src: src, tail: t };
    return t;
  }

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  // BANKS keys are upper-case, registry ids are lower -- resolve both rather
  // than making every call site remember which.
  function lookup(id) {
    if (id == null) return null;
    let e = ICONS[id];
    if (e === undefined) e = ICONS[String(id).toLowerCase()];
    return e === undefined ? null : e;
  }

  // Returns an inert HTML string: no ids, no handlers, pointer-events off so a
  // click always lands on the enclosing <button>. Safe to innerHTML in a redraw.
  function iconHTML(id, opts) {
    const o = opts || {};
    const size = o.size > 0 ? o.size : 24;
    const cls = "dwi dwi-" + (id == null ? "none" : String(id).toLowerCase()) +
      (o.cls ? " " + o.cls : "");
    // Decorative by default (the button carries the name); an explicit label
    // promotes the glyph to a standalone image for screen readers.
    const a11y = o.label
      ? ' role="img" aria-label="' + esc(o.label) + '"'
      : ' aria-hidden="true"';
    const e = lookup(id);

    if (typeof e === "string") {
      const t = tailOf(String(id).toLowerCase(), e);
      if (t !== null) {
        return '<svg width="' + size + '" height="' + size + '" class="' + cls + '"' +
          a11y + ' focusable="false" style="pointer-events:none"' + t;
      }
    } else if (e && (e.png || e.href)) {
      const w = e.w > 0 ? e.w : 24, h = e.h > 0 ? e.h : 24;
      return '<img src="' + (e.png || e.href) + '" width="' + Math.round(size * w / h) +
        '" height="' + size + '" alt="" class="' + cls + '"' +
        ' draggable="false" style="pointer-events:none">';
    }

    // Never throw, never return empty: an unregistered id still occupies its
    // slot so the button geometry does not jump when art lands later.
    const src = id != null ? String(id) : (o.label ? String(o.label) : "?");
    const ch = esc((src.charAt(0) || "?").toUpperCase());
    return '<span class="' + cls + ' dwi-glyph"' + a11y + ' style="display:inline-block;' +
      "width:" + size + "px;height:" + size + "px;line-height:" + size + "px;" +
      "text-align:center;font-family:monospace;font-size:" + Math.round(size * 0.62) +
      'px;pointer-events:none">' + ch + "</span>";
  }

  // The .dwi / .dwi-glyph rules live in combat.js's DWC_CSS, with every other
  // chamber style -- one stylesheet, one place to look. iconHTML inlines the
  // inertness it cannot live without, so it still renders correctly anywhere.
  window.DW_ICONS = ICONS;
  window.iconHTML = iconHTML;
})();
