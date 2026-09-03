// Headless guard for the combat chamber's UI foundation. Run: node tools/test-ui.js
//
// This test exists because of a bug the whole suite was blind to. The old
// DWC_CSS was built by prefixing "#dwc-root " onto every line of a stylesheet
// -- including the lines inside @keyframes. That produced an invalid keyframe
// selector, a dangling brace, and a stray "{" that swallowed the whole of
// DWC_SAY_CSS through CSS error recovery. Four rules were dead in the browser
// and every test stayed green, because the DOM stubs never parse CSS at all.
//
// So: parse the sheet as text and assert its shape. Source checks, no DOM.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = f => fs.readFileSync(path.join(root, f), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } };

const combat = src('src/combat.js');

// ------------------------------------------------------------ the stylesheet
console.log('-- DWC_CSS integrity');

const m = combat.match(/const DWC_CSS = `([\s\S]*?)\n`;/);
ok(!!m, 'DWC_CSS is a single template literal');
const css = m ? m[1] : '';

ok(css.length > 4000, 'DWC_CSS is the full sheet, not a stub');
ok(!css.includes('`'), 'sheet contains no backtick (would close the literal)');
ok(!css.includes('${'), 'sheet contains no dollar-brace (would interpolate)');

// The original failure mode, stated directly.
ok(!/#dwc-root\s*\}/.test(css), 'no "#dwc-root }" -- the mangled dangling brace is gone');
ok(!/@keyframes[^{]*\{[^}]*#dwc-root/.test(css),
   'no "#dwc-root" prefix leaked inside an @keyframes block');

let depth = 0, minDepth = 0;
for (const ch of css) {
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth < minDepth) minDepth = depth; }
}
ok(depth === 0, 'braces balance to zero (sheet does not end mid-rule)');
ok(minDepth === 0, 'never closes more braces than it opens');

// Offline / file:// safety: the game must run with no network at all.
// Comment prose in the sheet mentions both of these, so check the rules only.
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok(!bare.includes('@import'), 'no @import');
ok(!/url\(\s*['"]?https?:/i.test(bare), 'no network url()');

// dwc-rise lost its "to" frame to the bad prefixing; that is what made damage
// numbers animate opacity 1 -> 1 and never rise.
const rise = css.match(/@keyframes dwc-rise\s*\{([\s\S]*?)\n\}/);
ok(!!rise, '@keyframes dwc-rise exists');
ok(!!rise && /\bto\b\s*\{/.test(rise[1]), 'dwc-rise has a "to" frame');
ok(!!rise && /translateY\(-26px\)/.test(rise[1]), 'dwc-rise still rises 26px');

for (const kf of ['dwc-rise', 'dwc-say', 'dwc-blink']) {
  ok(css.includes('@keyframes ' + kf), '@keyframes ' + kf + ' survives in the sheet');
}
// Global namespace: index.html owns "rise", we own "dwc-rise".
ok(!/@keyframes\s+(?!dwc-)/.test(bare), 'every @keyframes name carries the dwc- prefix');

// ------------------------------------------------- every rule stays in scope
// A rule that escapes #dwc-root styles the crawl. Walk the sheet: descend into
// @media/@supports, skip @keyframes bodies, and check every other selector.
console.log('-- scoping');
{
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const escaped = [];
  const walk = (text) => {
    let i = 0, sel = '';
    while (i < text.length) {
      const ch = text[i];
      if (ch === '{') {
        let d = 1, j = i + 1;
        while (j < text.length && d > 0) {
          if (text[j] === '{') d++;
          else if (text[j] === '}') d--;
          j++;
        }
        const body = text.slice(i + 1, j - 1);
        const prelude = sel.trim();
        if (/^@(media|supports)/.test(prelude)) walk(body);
        else if (prelude[0] !== '@') {
          for (const one of prelude.split(',')) {
            const s = one.trim();
            if (s && !s.startsWith('#dwc-root')) escaped.push(s);
          }
        }
        // @keyframes and other at-rules: body deliberately not walked
        sel = ''; i = j;
      } else { sel += ch; i++; }
    }
  };
  walk(clean);
  ok(escaped.length === 0,
     'every non-at-rule selector is scoped under #dwc-root' +
     (escaped.length ? ' -- escaped: ' + escaped.slice(0, 5).join(' | ') : ''));
}

// ------------------------------------------------------- one style, no leaks
console.log('-- injection & de-collision');
const code = combat.replace(/const DWC_CSS = `[\s\S]*?\n`;/, 'const DWC_CSS = ``;');
ok(!code.includes('DWC_SAY_CSS'), 'DWC_SAY_CSS is gone (folded into the sheet)');
ok(!code.includes('DWC_SPL_CSS'), 'DWC_SPL_CSS is gone (folded into the sheet)');
ok((combat.match(/createElement\("style"\)/g) || []).length === 1,
   'exactly one <style> element is created');

const html = combat.match(/const DWC_HTML = '([\s\S]*?)';/);
ok(!!html, 'DWC_HTML found');
ok(!!html && !html[1].includes('style='),
   'DWC_HTML carries no inline style="" (inline styles beat the stylesheet)');

// index.html styles a bare .chip (21 rules) and .unit (13 rules). Both land
// inside #dwc-root on every property the chamber does not itself declare --
// including a clip-path on the SVG unit group and a reduced-motion
// !important. The chamber must not emit those bare class names.
ok(!/className="chip /.test(combat), 'timeline chips use .dwc-chip, not the crawl-colliding .chip');
ok(!/class:"unit"/.test(combat), 'unit groups use .dwc-unit, not the crawl-colliding .unit');
ok(combat.includes('dwc-chip') && combat.includes('dwc-unit'), 'both namespaced classes are emitted');
{
  const page = src('index.html');
  const style = page.slice(page.indexOf('<style'), page.indexOf('</style>'));
  for (const cls of ['dwc-chip', 'dwc-unit']) {
    ok(!style.includes('.' + cls), 'index.html does not style .' + cls);
  }
}

// ------------------------------------------------------------ icon registry
console.log('-- icon registry');
{
  const sandbox = {};
  new Function('window', src('src/icons.js')).call(sandbox, sandbox);
  const { DW_ICONS, iconHTML } = sandbox;

  ok(!!DW_ICONS && typeof iconHTML === 'function', 'icons.js exports DW_ICONS + iconHTML');
  ok(!('DW_ICONS_CSS' in sandbox), 'icons.js ships no stylesheet of its own');

  // Every icon id named in the ability tables must resolve to real art.
  const ids = [...combat.matchAll(/icon:"([a-z]+)"/g)].map(x => x[1]);
  ok(ids.length >= 10, 'BANKS + ITEMS declare at least 10 icon ids (got ' + ids.length + ')');
  for (const id of ids) ok(!!DW_ICONS[id], 'DW_ICONS has art for "' + id + '"');

  // Every bank and item carries one.
  const banks = combat.slice(combat.indexOf('const BANKS = {'), combat.indexOf('\n};', combat.indexOf('const BANKS = {')));
  const names = [...banks.matchAll(/^\s{2}([A-Z]+):\{/gm)].map(x => x[1]);
  ok(names.length > 0 && names.length === (banks.match(/icon:"/g) || []).length,
     'every BANKS entry has an icon key (' + names.length + ' banks)');
  ok(/ITEMS=\{[^}]*icon:"/.test(combat.replace(/\n/g, '')), 'the satchel item has an icon key');

  // Shape contract: svg entries paint with currentColor at 24x24, so one glyph
  // serves every size and tints with the button's state colour.
  for (const id of Object.keys(DW_ICONS)) {
    const e = DW_ICONS[id];
    if (typeof e !== 'string') continue;
    ok(e.includes('viewBox="0 0 24 24"'), id + ' uses a 24x24 viewBox');
    ok(e.includes('currentColor'), id + ' paints with currentColor');
    ok(!/<svg[^>]*\swidth=/.test(e), id + ' carries no baked-in width (iconHTML injects it)');
  }

  // The three call shapes drawHud will actually use.
  ok(iconHTML('percvssio').startsWith('<svg'), 'known id returns an svg');
  ok(iconHTML('PERCVSSIO').startsWith('<svg'), 'lookup is case-insensitive (BANKS keys are upper)');
  ok(/width="16"/.test(iconHTML('fvlgvr', { size: 16 })), 'size option is applied');
  const missing = iconHTML('no-such-icon-id', { size: 20 });
  ok(missing.length > 0 && missing.includes('N'), 'missing id falls back to a letter glyph, never empty');
  ok(iconHTML(null).length > 0, 'null id does not throw and does not return empty');

  // Raster art must drop in with no layout change -- that is the whole point
  // of the registry accepting a {png,w,h} shape alongside inline SVG.
  DW_ICONS.__probe = { png: 'data:image/png;base64,AA', w: 24, h: 24 };
  const raster = iconHTML('__probe', { size: 32 });
  ok(raster.startsWith('<img') && raster.includes('height="32"'), 'raster entries render as a sized <img>');
  delete DW_ICONS.__probe;

  // It gets injected via innerHTML inside a <button> on a hot redraw path.
  ok(!iconHTML('abrasio').includes('onclick'), 'icon markup carries no event handlers');
  ok(iconHTML('abrasio').includes('pointer-events:none'), 'icon markup is inert to clicks');
}

// ------------------------------------------------------------ build wiring
console.log('-- build wiring');
{
  const b = src('tools/build-standalone.py');
  const i = b.indexOf("'src/icons.js'"), j = b.indexOf("'src/combat.js'");
  ok(i > -1, 'build-standalone.py inlines src/icons.js');
  ok(i > -1 && j > -1 && i < j, 'build inlines icons.js before combat.js');
  // The build's tag regex only matches lowercase alphanumeric filenames.
  ok(/^[a-z0-9]+\.js$/.test('icons.js'), 'icons.js matches the build tag regex');
}

// ------------------------------------------------------------ ability dock
// Round-2 HUD: square icon slots, state as an overlay class, satchel segment.
// Source checks first, then a stubbed-DOM run of drawHud with every state
// forced at once -- the same ten states the Playwright sweep screenshots.
console.log('-- dock');
{
  const hud = html ? html[1] : '';
  for (const id of ['dwc-dock', 'dwc-banks', 'dwc-satchel', 'dwc-gauge-h', 'dwc-gauge-l', 'dwc-gauge-r', 'dwc-endbtn']) {
    ok(hud.includes('id="' + id + '"'), 'DWC_HTML has #' + id);
  }
  ok(hud.includes('class="dwc-sep"'), 'DWC_HTML has the satchel divider');
  ok(/id="dwc-gauge-l" class="dwc-gauge" hidden/.test(hud) && /id="dwc-gauge-r" class="dwc-gauge" hidden/.test(hud),
     'gauge placeholders ship hidden until their own phase');
  ok(!code.includes('op-nm'), 'no .op-nm anywhere: the slot carries no name');
  ok(!bare.includes('.op-nm') && !bare.includes('.op-meta') && !bare.includes('.b-recharge'),
     'old two-row anatomy rules are gone from the sheet');
  for (const st of ['st-burnt', 'st-recharge', 'st-spent', 'st-need', 'st-strain']) {
    ok(bare.includes('.' + st), 'sheet styles .' + st);
  }
  ok(bare.includes('conic-gradient('), 'recharge sweep is a CSS conic-gradient');
  ok(/--slot\s*:\s*48px/.test(bare) && /--slot\s*:\s*56px/.test(bare), 'slot size tokens: 48px phone, 56px desktop');
  ok(/min-width\s*:\s*44px/.test(bare), 'slots never shrink below the 44px tap floor');
  // Offline rule extended: data: URLs are fine, but only inline SVG art.
  const datas = bare.match(/url\(\s*["']?data:[^;,)]*/g) || [];
  ok(datas.length > 0 && datas.every(d => /data:image\/svg\+xml/.test(d)), 'every data: url() in the sheet is inline SVG (' + datas.length + ')');
  ok(/#dwc-root #dwc-hud\{[^}]*position:absolute/.test(bare), '#dwc-hud overlays the board (position:absolute)');
  ok(/#dwc-root #dwc-hud\{[^}]*pointer-events:none/.test(bare), '#dwc-hud fade zone passes taps through to the board');
  ok(!/#dwc-board{[^}]*padding-bottom:var(--dock-h)/.test(bare), 'board is never inset for the dock: the battlefield runs under the fade zone');
  ok(!/#dwc-tl{[^}]*border-bottom/.test(bare) && !/#dwc-hud::before{[^}]*border-top/.test(bare), 'no rule lines above or below the board');
  // Round-2 addendum: no bands above or below the arena, two centred rows, bigger gauges.
  ok(!bare.includes('#dwc-hud::before') && !/#dwc-root #dwc-tl\{[^}]*background/.test(bare), 'no silkscreen band under the hud, no panel band behind the timeline');
  ok(/--gauge\s*:\s*68px/.test(bare) && /--gauge\s*:\s*90px/.test(bare) && /\.dwc-gauge\{[^}]*width:var\(--gauge\)/.test(bare), 'gauge size tokens: 68px phone, 90px desktop');
  ok(/class="dwc-res-l">[^]*?id="dwc-gauge-h"[^]*?id="dwc-gauge-l"[^]*?<\/div>[^]*?id="dwc-gauge-r"[^]*?id="dwc-stat"/.test(hud) && hud.indexOf('id="dwc-dock"') < hud.indexOf('class="dwc-res-l"'),
     'ARPG bar: dock, VITAE-over-MOVEMENT column, MANA, stat line as one wrapping band');
  ok(/#dwc-hud\{[^}]*flex-wrap:wrap/.test(bare) && /@media \(max-width:599px\)\{[^@]*#dwc-dock\{[^}]*flex:0 0 100%/.test(bare), 'portrait phones wrap the dock onto its own line');
  ok(/#dwc-gauge-l\{[^}]*aspect-ratio:56\/20/.test(bare) && code.includes('viewBox="0 0 56 20"'), 'MOVEMENT is a 56x20 pip strip');
  ok(/#dwc-gauge-h\{[^}]*color:var\(--ox-hi\)/.test(bare), 'VITAE coil is oxblood');
  ok(!/id="dwc-dock"[\s\S]*?dwc-gauge[\s\S]*?id="dwc-satchel"/.test(hud), 'gauges are out of the dock row');
  ok(code.includes('PNEUMA, RANGE'), 'slot aria-labels spell PNEUMA as the stat line does');
  ok(/const rangeText=/.test(code), 'rangeText helper exists (numeric range for aria + stat line)');
  ok(!code.includes('hudArmed') && code.includes('class="op-cap"') && bare.includes('.op-cap'), 'bank names are captions under the slots, not a stat-line list');

  // ---- stubbed-DOM run: force all states at once
  const vm = require('vm');
  function el(tag) {
    const t = { tag, attrs: {}, style: {}, children: [], className: '', innerHTML: '', textContent: '', disabled: false,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
    t.style.setProperty = (k, v) => { t.style[k] = String(v); };
    t.style.removeProperty = () => {};
    t.setAttribute = (k, v) => { t.attrs[k] = String(v); };
    t.getAttribute = k => (k in t.attrs ? t.attrs[k] : null);
    t.appendChild = c => { t.children.push(c); return c; };
    t.removeChild = () => {}; t.insertBefore = () => {}; t.remove = () => {};
    t.addEventListener = () => {}; t.removeEventListener = () => {}; t.focus = () => {};
    t.querySelector = () => el('div'); t.querySelectorAll = () => [];
    t.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
    t.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
    t.childNodes = []; t.firstChild = null;
    return t;
  }
  const byId = {};
  const doc = {
    getElementById: id => (byId[id] = byId[id] || el('div')),
    createElement: el, createElementNS: (ns, tag) => el(tag),
    querySelector: () => el('div'), querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    activeElement: null, body: el('body'), documentElement: el('html'), head: el('head'),
  };
  // Timers are parked, not run: flashStat's redraw must not wipe the warn we assert on.
  const timers = [];
  const ctx = { document: doc, console, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, navigator: { maxTouchPoints: 0 },
    addEventListener() {}, removeEventListener() {} };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['data/balance.js', 'src/icons.js', 'src/combat.js']) vm.runInContext(src(f), ctx, { filename: f });
  ctx.DW_COMBAT.start({ fight: 1, party: [{ id: 'op', frac: 1 }], items: { AMPVLLA: 2 } });
  const T = ctx.__DWC_TEST, s = T.state;
  // seat, then start round 1 (OPERATOR acts first on fight 1)
  const free = [];
  for (let x = 0; x < 2; x++) for (let y = 0; y < 12; y++) if (!s.units.some(u => u.alive && u.x === x && u.y === y)) free.push([x, y]);
  while (s.toPlace.length) { const u = s.units.find(v => v.id === s.toPlace.shift()); [u.x, u.y] = free.shift(); }
  s.phase = 'battle'; T.newRound();
  const u = T.cur();
  ok(!!u && u.id === 'op', 'OPERATOR has the first turn in the stub fight');
  const stat = byId['dwc-stat'];
  ok(/^<b>OPERATOR<\/b>$/.test(stat.innerHTML), 'nothing armed: stat line is the name only -- ' + stat.innerHTML);
  ok(/class="op-cap">PERCVSSIO</.test(byId['dwc-banks'].children[0].innerHTML) && /class="op-cap">AMPVLLA VITAE</.test(byId['dwc-satchel'].children[0].innerHTML), 'every slot carries its name as a caption');

  u.banks = ['PERCVSSIO', 'ABRASIO', 'CONCRETIO', 'IMPVLSVS', 'IMMOLATIO', 'IACVLVM'];
  u.burnt = { CONCRETIO: true }; u.cds = { IMPVLSVS: 1 }; u.cast = { ABRASIO: true, 'item:AMPVLLA': true };
  u.pneuma = 4; u.strain = { IACVLVM: 7 };
  s.sel = 'PERCVSSIO';
  byId['dwc-banks'].children.length = 0; byId['dwc-satchel'].children.length = 0;
  T.drawHud();
  const slots = byId['dwc-banks'].children, items = byId['dwc-satchel'].children;
  ok(slots.length === 6, 'one slot per bank (' + slots.length + ')');
  ok(items.length === 1, 'one satchel slot for the ampoule');
  const cls = slots.map(b => b.className);
  const stOf = c => (c.match(/\bst-[a-z]+/g) || []);
  ok(cls.every(c => stOf(c).length <= 1), 'never more than one st-* class on a slot');
  ok(/\bsel\b/.test(cls[0]) && stOf(cls[0]).length === 0, 'armed PERCVSSIO: .sel, no state overlay');
  ok(stOf(cls[1])[0] === 'st-spent', 'ABRASIO cast this turn: st-spent');
  ok(stOf(cls[2])[0] === 'st-burnt', 'CONCRETIO burnt: st-burnt');
  ok(stOf(cls[3])[0] === 'st-recharge' && slots[3].style['--p'] === '0.5', 'IMPVLSVS cd 1 of 2: st-recharge, --p 0.5 (' + slots[3].style['--p'] + ')');
  ok(stOf(cls[4])[0] === 'st-need', 'IMMOLATIO costs 5 with 4 pneuma: st-need');
  ok(stOf(cls[5])[0] === 'st-strain' && slots[5].style['--p'] === '0.7', 'IACVLVM strain 7/10: st-strain, --p 0.7 (' + slots[5].style['--p'] + ')');
  ok(/RECHARGE 1$/.test(slots[3].attrs['aria-label']) && /STRAIN 7 OF 10$/.test(slots[5].attrs['aria-label']),
     'aria-labels carry the state: ' + slots[3].attrs['aria-label'] + ' | ' + slots[5].attrs['aria-label']);
  ok(/^PERCVSSIO, 4 PNEUMA, RANGE 1$/.test(slots[0].attrs['aria-label']), 'ready slot aria: name, cost, numeric range');
  ok(/RANGE 0/.test(slots[1].attrs['aria-label']), 'sweep range reads 0');
  ok(/RANGE 2–4/.test(slots[5].attrs['aria-label']), 'ranged reads min–max');
  ok(slots.every(b => !/op-nm/.test(b.innerHTML)), 'no name span inside any slot');
  ok(slots.every(b => /class="op-key"/.test(b.innerHTML) && /class="op-cost"/.test(b.innerHTML)), 'every slot has a hotkey plaque and a cost');
  ok(/class="op-badge"[^>]*>1</.test(slots[3].innerHTML), 'recharge slot shows the remaining count as its badge');
  ok(/class="op-badge"[^>]*>7</.test(slots[5].innerHTML), 'strain slot shows the strain count as its badge');
  ok(/st-spent/.test(items[0].className) && /class="op-dose"[^>]*>2</.test(items[0].innerHTML), 'spent ampoule: st-spent, dose 2 in the corner');
  ok(/<b>PERCVSSIO<\/b> · <b>4◆<\/b> · <b>1<\/b>/.test(stat.innerHTML), 'armed: stat line reads NAME · COST · RANGE -- ' + stat.innerHTML);
  s.sel = 'item:AMPVLLA'; T.drawHud();
  ok(/AMPVLLA VITAE<\/b> · <b>2◆<\/b> · <b>0–5<\/b>/.test(stat.innerHTML), 'armed item: stat line reads name, cost, range -- ' + stat.innerHTML);
  // Tapping an unavailable slot still answers via flashStat (whyNot).
  s.sel = null; T.drawHud();
  byId['dwc-banks'].children[2].onclick();
  ok(/BVRNT/.test(stat.innerHTML) && /class="warn"/.test(stat.innerHTML), 'tapping the burnt slot flashes whyNot in the stat line');
}

// ------------------------------------------------------------ END TVRN plaque
// Round-2 ruling A: the turn control floats over the board, anchored to
// #dwc-board (20% up, 15% in from the right), clamped clear of the dock.
console.log('-- END TVRN plaque');
{
  const hud = html ? html[1] : '';
  const boardOpen = hud.indexOf('id="dwc-board"'), boardClose = hud.indexOf('</div>', boardOpen);
  const endAt = hud.indexOf('id="dwc-endbtn"');
  ok(endAt > boardOpen && endAt < boardClose, '#dwc-endbtn lives inside #dwc-board, after the svg');
  ok(!/id="dwc-dock"[\s\S]*?id="dwc-endbtn"[\s\S]*?<\/div>\s*<\/div>/.test(hud.slice(hud.indexOf('id="dwc-dock"'))) ||
     hud.indexOf('id="dwc-endbtn"') < hud.indexOf('id="dwc-dock"'), '#dwc-endbtn is no longer in the dock row');
  ok(/id="dwc-endbtn"[^>]*aria-label="END TVRN"/.test(hud), 'plaque carries aria-label END TVRN');
  ok(/class="end-plq"/.test(hud) && /class="end-lbl">END TVRN</.test(hud), 'plaque has the glyph well and the END TVRN label');
  const endRule = bare.match(/#dwc-root #dwc-endbtn\{([^}]*)\}/);
  ok(!!endRule && /position:absolute/.test(endRule[1]) && /right:15%/.test(endRule[1]) && /bottom:20%/.test(endRule[1]),
     'plaque is absolute, right:15%, bottom:20% of the board');
  ok(!!endRule && /touch-action:manipulation/.test(endRule[1]), 'plaque sets touch-action:manipulation');
  ok(!!endRule && /z-index:\s*1[0-9]/.test(endRule[1]), 'plaque stacks above the svg');
  ok(/\.end-plq\{[^}]*clip-path:polygon/.test(bare), 'octagon via clip-path');
  ok(code.includes('function placeEndBtn(') && code.includes('addEventListener("resize",placeEndBtn)'),
     'placeEndBtn clamp exists and re-runs on resize');
  ok(code.includes('window.iconHTML("endtvrn"'), 'plaque glyph is the endtvrn icon from the registry');
  ok(code.includes('document.getElementById("dwc-endbtn").onclick='), 'END TVRN onclick handler still assigned on #dwc-endbtn');
}

// ------------------------------------------------------------ gauges
// Round-2 ruling C: CYCLES pips left, PNEUMA coil right, for the current unit.
console.log('-- gauges');
{
  ok(/const GAUGE_LABEL_L="MOVEMENT", GAUGE_LABEL_R="MANA", GAUGE_LABEL_H="VITAE";/.test(code), 'gauge labels are the three constants (rename = three strings)');
  ok(/const DWC_GAUGES=true;/.test(code), 'gauges are switched on');
  ok(code.includes('function drawGauges('), 'drawGauges exists');
  ok(bare.includes('.dwc-gauge[hidden]') && bare.includes('.dwc-g-pip') && bare.includes('.dwc-g-fill'), 'sheet styles the gauge, its pips and its fill');
  // Stubbed run: 3 of 4 cycles, 7 of 14 pneuma on the current unit.
  const vm = require('vm');
  const byId = {};
  const mk = () => { const t = { attrs: {}, style: {}, children: [], hidden: true, innerHTML: '', className: '',
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
    t.style.setProperty = () => {}; t.setAttribute = (k, v) => { t.attrs[k] = String(v); }; t.getAttribute = k => t.attrs[k] ?? null;
    t.appendChild = c => { t.children.push(c); return c; }; t.removeChild = () => {}; t.remove = () => {}; t.insertBefore = () => {};
    t.addEventListener = () => {}; t.removeEventListener = () => {}; t.focus = () => {};
    t.querySelector = () => mk(); t.querySelectorAll = () => [];
    t.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
    t.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }); t.childNodes = []; return t; };
  const doc = { getElementById: id => (byId[id] = byId[id] || mk()), createElement: mk, createElementNS: () => mk(),
    querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    activeElement: null, body: mk(), documentElement: mk(), head: mk() };
  const ctx = { document: doc, console, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, navigator: { maxTouchPoints: 0 }, addEventListener() {}, removeEventListener() {} };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  for (const f of ['data/balance.js', 'src/icons.js', 'src/combat.js']) vm.runInContext(src(f), ctx, { filename: f });
  ctx.DW_COMBAT.start({ fight: 1, party: [{ id: 'op', frac: 1 }] });
  const T = ctx.__DWC_TEST, s = T.state;
  ok(byId['dwc-gauge-l'].hidden === true && byId['dwc-gauge-r'].hidden === true && byId['dwc-gauge-h'].hidden === true, 'placement: all gauges hidden');
  const free = [];
  for (let x = 0; x < 2; x++) for (let y = 0; y < 12; y++) if (!s.units.some(u => u.alive && u.x === x && u.y === y)) free.push([x, y]);
  while (s.toPlace.length) { const u = s.units.find(v => v.id === s.toPlace.shift()); [u.x, u.y] = free.shift(); }
  s.phase = 'battle'; T.newRound();
  const u = T.cur(); u.maxCycles = 4; u.cycles = 3; u.maxPneuma = 14; u.pneuma = 7; T.drawHud();
  const L = byId['dwc-gauge-l'], R = byId['dwc-gauge-r'], H = byId['dwc-gauge-h'];
  ok(L.hidden === false && R.hidden === false && H.hidden === false, 'battle: all gauges shown');
  ok(H.attrs['aria-label'] === 'VITAE ' + u.vitae + ' of ' + u.maxVitae && H.innerHTML.includes('>' + u.vitae + '/' + u.maxVitae + '<') && /VITAE<\/text>/.test(H.innerHTML), 'vitae gauge aria + numeral: ' + H.attrs['aria-label']);
  ok(L.attrs['aria-label'] === 'MOVEMENT 3 of 4' && L.attrs['role'] === 'img', 'left gauge aria: ' + L.attrs['aria-label']);
  ok(R.attrs['aria-label'] === 'MANA 7 of 14' && R.attrs['role'] === 'img', 'right gauge aria: ' + R.attrs['aria-label']);
  const pips = L.innerHTML.match(/class="dwc-g-pip[^"]*"/g) || [];
  ok(pips.length === 4 && pips.filter(p => /dwc-spent/.test(p)).length === 1 && !/dwc-spent/.test(pips[2]) && /dwc-spent/.test(pips[3]),
     'four pips, exactly the last one spent (' + pips.join(' ') + ')');
  ok(R.innerHTML.includes(">7/14<"), 'coil shows the 7/14 numeral');
  ok(/MOVEMENT/.test(L.innerHTML) && /MANA/.test(R.innerHTML), 'labels rendered from the constants');
  u.pneuma = 0; T.drawHud();
  ok(R.attrs['aria-label'] === 'MANA 0 of 14', 'drains: aria follows the pool (' + R.attrs['aria-label'] + ')');
}

// ------------------------------------------------------------ fixed track (RULED A)
console.log('-- fixed track');
{
  ok(/const BANK_SOCKETS=4;/.test(code), 'bar is 4 bank sockets wide');
  ok(bare.includes('.op.sock{') && /\.op\.sock\{[^}]*pointer-events:none/.test(bare), 'empty sockets are styled and inert');
  ok(code.includes('for(let k=u.banks.length;k<BANK_SOCKETS;k++) banks.appendChild(sockEl());'), 'banks pad to BANK_SOCKETS');
  ok(code.includes('satchel.appendChild(sockEl()); dock.classList.remove("dwc-nosat");'), 'empty satchel shows one socket');
}

console.log(fail ? '\n' + fail + ' FAILED (' + pass + ' passed)' : '\nall ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
