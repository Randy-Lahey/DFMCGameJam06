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

console.log(fail ? '\n' + fail + ' FAILED (' + pass + ' passed)' : '\nall ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
