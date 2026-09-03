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
    // Melee strike, range 1: hammer -- thick shaft from the left driven into a big
    // solid block flush with the right edge, two spark ticks behind the contact.
    // Distinguished by mass and contact: the only strike glyph that "touches".
    percvssio: S(
      '<path d="M2.5 12h12" stroke-width="2.2"/>' +
      '<path d="M14.5 5h7.5v14h-7.5z"' + FILL + "/>" +
      '<path d="M9.5 6.5l2.5 2.5M9.5 17.5l2.5-2.5" stroke-width="2.2"/>'
    ),
    // Sweep around self, range 0: filled core with 8 radiating spokes -- a burst
    // ring, no arrowheads, no direction. Reads "everything adjacent to me".
    abrasio: S(
      '<circle cx="12" cy="12" r="2.6"' + FILL + "/>" +
      '<path d="M12 2v4.5M22 12h-4.5M12 22v-4.5M2 12h4.5" stroke-width="2.2"/>' +
      '<path d="M4.9 4.9l3.2 3.2M19.1 4.9l-3.2 3.2M19.1 19.1l-3.2-3.2M4.9 19.1l3.2-3.2" stroke-width="2.2"/>'
    ),
    // Hex/bind, ranged with no line of sight: sigil -- hexagon cell, filled inner
    // diamond, two horizontal shackle bars crossing right through it. Reads "bound".
    concretio: S(
      '<path d="M12 2.2l7.8 4.9v9.8L12 21.8l-7.8-4.9V7.1z"/>' +
      '<path d="M12 7.5l3.8 4.5-3.8 4.5-3.8-4.5z"' + FILL + "/>" +
      '<path d="M2.5 9.5h19M2.5 14.5h19" stroke-width="2.2"/>'
    ),
    // Ranged bolt, range 4-6: long thin zigzag lightning from the top-left corner
    // to a target ring (with filled centre) in the bottom-right. Reads "far".
    fvlgvr: S(
      '<path d="M2.5 2.5L8 4 7 11 14 10 15.5 15.5" stroke-width="2.2"/>' +
      '<circle cx="18.6" cy="18.6" r="3"/>' +
      '<circle cx="18.6" cy="18.6" r="1.2"' + FILL + "/>"
    ),
    // AoE flame with self-cost: filled teardrop flame with a hollow inner notch,
    // plus a small ring at the bottom-left base = "costs me". A solid mass, so it
    // cannot be confused with fvlgvr's thin line.
    immolatio: S(
      '<path fill-rule="evenodd" d="M13.5 2.5C13.5 7 18.8 9 18.8 14A6.3 6.3 0 0 1 6.2 14C6.2 10.8 8.8 9.4 9.2 7.2C10.4 9.6 12 9.4 12 7.8C13.5 8.8 13.5 4.5 13.5 2.5zM12.5 12C12.5 14 15 14.6 15 16.5A2.5 2.5 0 0 1 10 16.5C10 14.6 12.5 14 12.5 12z"' + FILL + "/>" +
      '<circle cx="4.3" cy="19.7" r="1.9"/>'
    ),
    // Swap places: two stacked counter-running horizontal arrows with filled
    // heads -- top runs right, bottom runs left. Clearly two-way.
    permvto: S(
      '<path d="M3 8h11M21 16H10" stroke-width="2.2"/>' +
      '<path d="M13.5 4l7.5 4-7.5 4zM10.5 12L3 16l7.5 4z"' + FILL + "/>"
    ),
    // Knockback shove, range 1: fat arrow with a filled head pushing a solid disc
    // (the body) against a vertical wall line on the right edge. Reads "push".
    impvlsvs: S(
      '<path d="M21 4v16" stroke-width="2.2"/>' +
      '<path d="M2.5 12h6" stroke-width="2.2"/>' +
      '<path d="M8 8.2l4.4 3.8-4.4 3.8zM11.9 12a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0z"' + FILL + "/>"
    ),
    // Foe bite, range 1: two opposing jaw arcs with four filled fangs closing on
    // a small central dot. Reads "mouth"; the only glyph with curved jaws.
    morsvs: S(
      '<path d="M3 6.5C7.5 10.5 16.5 10.5 21 6.5M3 17.5C7.5 13.5 16.5 13.5 21 17.5" stroke-width="2.2"/>' +
      '<path d="M5.4 8.1l2.1 4.7 2.5-3.5zM14 9.3l2.5 3.5 2.1-4.7zM5.4 15.9l2.1-4.7 2.5 3.5zM14 14.7l2.5-3.5 2.1 4.7zM10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0z"' + FILL + "/>"
    ),
    // Foe thrown dart, range 2-4: straight diagonal shaft with a solid triangular
    // head at the top-right and a motion arc trailing behind the tail. Straight,
    // not zigzag, so it never reads as fvlgvr.
    iacvlvm: S(
      '<path d="M7 17L16.5 7.5" stroke-width="2.2"/>' +
      '<path d="M21.5 2.5L19.7 8.5 15.5 4.3z"' + FILL + "/>" +
      '<path d="M2.5 13A8.5 8.5 0 0 0 11 21.5"/>'
    ),
    // Healing vial: combat.js VIAL_SVG geometry, rescaled 12x16 -> 24x24 box
    // (x1.4, centred) and recoloured to currentColor so it tints with the button.
    // The only upright bottle silhouette; unchanged, it already reads at 20px.
    ampvlla: S(
      '<path d="M9.2 2.2h5.6v2.3H9.2z"' + FILL + "/>" +
      '<path d="M10 5.5h4v3.7l3.6 7.8v3.6L16.1 21.8H8.1L6.4 20.7v-3.6l3.6-7.8z"/>' +
      '<path d="M7.8 16.8h8.4v3.2l-1.1 1.3H8.9l-1.1-1.3z"' + FILL + "/>"
    ),
    // END TVRN plaque: hourglass rune -- filled top bulb (sand) over an open
    // outline bottom bulb, meeting at a waist, capped by two bold horizontal bars.
    endtvrn: S(
      '<path d="M4.5 3h15M4.5 21h15" stroke-width="2.2"/>' +
      '<path d="M5 5h14l-7 7.4z"' + FILL + "/>" +
      '<path d="M5.2 19.5L12 12.4l6.8 7.1" stroke-width="2.2"/>'
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
