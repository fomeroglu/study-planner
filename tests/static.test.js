// Static checks on the interface files: wording rules (CLAUDE.md), no network
// requests, and WCAG 2.1 AA contrast for both themes. Run with `node --test`.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require(path.join(__dirname, '..', 'logic.js'));

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const UI_FILES = ['index.html', 'app.js', 'logic.js', 'styles.css'];

// Display text from the running example and Find problems, as the screens show it.
function generatedText() {
  const form = L.newForm();
  form.design = 'within';
  const f = form.factors[0];
  f.name = 'Keyboard design';
  f.levels[0].name = 'Current';
  f.levels[1].name = 'Prototype A';
  f.levels.push(L.newLevel('Prototype B'));
  const time = form.measures[0];
  Object.assign(time, { name: 'Task time', unit: 'seconds', type: 'time' });
  Object.assign(L.inputsFor(time, 'all'), { delta: '10', k: '8' });
  const tlx = L.presetMeasure('nasa-tlx');
  Object.assign(L.inputsFor(tlx, 'all'), { variability: 'sd', delta: '10', sd: '15', consistency: 'medium' });
  form.measures.push(tlx);
  const success = L.newMeasure(false);
  Object.assign(success, { name: 'Task success', type: 'binary' });
  Object.assign(L.inputsFor(success, 'all'), { p1: '70', p2: '85' });
  form.measures.push(success);
  const plan = L.runPlan(form).plan;
  const c = L.confidence(plan, 12, form);
  const out = [
    L.planView(plan, form),
    L.confidenceView(c.report, c.curve),
    L.sidebarSummary(form, 3),
    L.step1View(form),
    L.inputText(form, time, 'all'),
    L.inputText(form, success, 'all'),
    L.findView({ p: '10', P: '80', participants: 8 }),
    L.TEXT,
    L.TYPE_HELP,
  ];
  return JSON.stringify(out);
}

test('no em dashes in any user-facing text', () => {
  UI_FILES.forEach((f) => assert.ok(!read(f).includes('—'), `em dash in ${f}`));
  assert.ok(!generatedText().includes('—'), 'em dash in generated display text');
});

test('no wording that assumes a particular study (keyboards, prototypes, a "Current" condition)', () => {
  ['index.html', 'app.js', 'logic.js'].forEach((f) =>
    assert.ok(!/\b(Current|Keyboard|keyboard|Prototype|prototype)\b/.test(read(f)), `study-specific wording in ${f}`));
});

test('no Cohen\'s small, medium or large labels', () => {
  const pattern = /\b(small|medium|large)\s+(effect|effects|effect size)\b/i;
  UI_FILES.concat(['engine.js']).forEach((f) => assert.ok(!pattern.test(read(f)), `Cohen's size label in ${f}`));
  assert.ok(!pattern.test(generatedText()));
});

test('no network requests at runtime except the IBM Plex fonts', () => {
  ['app.js', 'logic.js', 'engine.js'].forEach((f) => {
    const src = read(f);
    [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /\bimport\s*\(/, /new\s+Image\s*\(/, /\.src\s*=/]
      .forEach((p) => assert.ok(!p.test(src), `${p} in ${f}`));
    // Only links the user opens (methods page, footer), never requested by the page.
    const allowed = [
      'https://github.com/fomeroglu/study-planner/blob/main/docs/methods.md',
      'https://github.com/fomeroglu/study-planner',
      'https://fbomeroglu.com',
      'https://github.com/fomeroglu',
      'https://linkedin.com/in/fomeroglu/',
    ];
    (src.match(/https?:\/\/[^\s'"`)]+/g) || []).forEach((url) =>
      assert.ok(allowed.includes(url), `unexpected URL ${url} in ${f}`));
  });
  const html = read('index.html');
  (html.match(/https?:\/\/[^\s'"`)]+/g) || []).forEach((url) =>
    assert.ok(/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(url), `unexpected URL ${url} in index.html`));
  (html.match(/<script[^>]*src="([^"]+)"/g) || []).forEach((tag) =>
    assert.ok(!/src="https?:/.test(tag), `remote script ${tag}`));
  const css = read('styles.css');
  assert.ok(!/@import|url\(\s*['"]?https?:/.test(css), 'remote resource in styles.css');
});

test('the only thing stored in the browser is the theme', () => {
  const app = read('app.js');
  const html = read('index.html');
  const uses = (app.match(/localStorage\.\w+\(([^)]*)\)/g) || []).concat(html.match(/localStorage\.\w+\(([^)]*)\)/g) || []);
  assert.ok(uses.length > 0);
  uses.forEach((u) => assert.match(u, /THEME_KEY|'study-planner-theme'/));
  ['sessionStorage', 'indexedDB', 'document.cookie'].forEach((s) => assert.ok(!app.includes(s), s));
});

// ---------------------------------------------------------------------------
// WCAG 2.1 AA contrast from the styles.css tokens (both themes)
// ---------------------------------------------------------------------------

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}

function themes() {
  const css = read('styles.css');
  const dark = tokens(css.match(/:root\s*\{([^}]*)\}/)[1]);
  const light = Object.assign({}, dark, tokens(css.match(/:root\[data-theme="light"\]\s*\{([^}]*)\}/)[1]));
  return { dark, light };
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('theme tokens match the role table in design/README.md', () => {
  const { dark, light } = themes();
  assert.deepEqual(
    ['bg', 'surface', 'line', 'text', 'text-2', 'accent', 'selected', 'warn', 'warn-bg', 'control'].map((k) => dark[k]),
    ['#0E1214', '#161C1F', '#2A3337', '#E3E8E6', '#9AA6A3', '#4FD1C5', '#173B38', '#F2B84B', '#2E2615', '#6E7D80']);
  assert.deepEqual(
    ['bg', 'surface', 'line', 'text', 'text-2', 'accent', 'selected', 'warn', 'warn-bg', 'control'].map((k) => light[k]),
    ['#F3F5F4', '#FFFFFF', '#DCE2E0', '#14191B', '#4F5B5E', '#0F766E', '#E2F3F0', '#8A5300', '#FBF1DC', '#7A8A8C']);
  assert.equal(dark['on-accent'], '#0E1214');
  assert.equal(light['on-accent'], '#FFFFFF');
});

test('text contrast is at least 4.5:1 in both themes', () => {
  // [foreground, background] pairs the interface uses for text.
  const pairs = [
    ['text', 'bg'], ['text', 'surface'], ['text', 'selected'], ['text', 'warn-bg'],
    ['text-2', 'bg'], ['text-2', 'surface'], ['text-2', 'selected'],
    ['accent', 'bg'], ['accent', 'surface'],
    ['warn', 'bg'], ['warn', 'surface'],
    ['on-accent', 'accent'],
  ];
  Object.entries(themes()).forEach(([name, t]) => pairs.forEach(([fg, bg]) => {
    const r = ratio(t[fg], t[bg]);
    assert.ok(r >= 4.5, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1`);
  }));
});

test('form-control borders, focus outline and meaningful graphics are at least 3:1', () => {
  const pairs = [
    ['control', 'bg'], ['control', 'surface'], // form-control borders, dashed curve
    ['accent', 'bg'], ['accent', 'surface'], // focus outline, selected border, curves
    ['text', 'surface'], // significance bar and slider line
    ['warn', 'surface'], ['warn', 'bg'], // invalid-field border, warning edge
    ['warn', 'warn-bg'],
  ];
  Object.entries(themes()).forEach(([name, t]) => pairs.forEach(([fg, bg]) => {
    const r = ratio(t[fg], t[bg]);
    assert.ok(r >= 3, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1`);
  }));
});

test('never described as validated while any answer-key value is provisional', () => {
  if (!read('validation/answer-key.md').includes('| PROVISIONAL |')) return;
  // CLAUDE.md: never describe the tool as validated while any value is provisional.
  ['app.js', 'logic.js', 'index.html', 'README.md'].forEach((f) =>
    assert.ok(!/\b(is|fully) validated\b/i.test(read(f)), `"validated" claim in ${f}`));
});

test('limitations: within-subjects plans assume matched values (methods.md §14, README)', () => {
  const sentence = /Within-subjects plans assume you can match each\s+participant's values\s+across conditions\./;
  assert.match(read('docs/methods.md'), sentence);
  assert.match(read('README.md'), sentence);
});

test('later versions list simulation-based planning for repeated trials (methods.md §13)', () => {
  assert.match(read('docs/methods.md'), /repeated trials per participant \(mixed-effects\s+models\), using simulation/);
});

test('design/README.md describes the current running example', () => {
  const readme = read('design/README.md');
  assert.ok(!/each vs\. Current, adjusted/.test(readme));
  assert.match(readme, /Fisher's protected LSD/);
  assert.match(readme, /recommends 18\s+participants/);
});

test('header: no privacy line; the theme toggle is an icon button with a label and tooltip', () => {
  const app = read('app.js');
  assert.ok(!app.includes('Runs in your browser'), 'the privacy statement belongs in the README only');
  assert.match(read('README.md'), /## Privacy/);
  assert.ok(app.includes('class="theme-toggle" data-action="theme" aria-label="${label}" title="${label}">${light ? ICON_SUN : ICON_MOON}</button>'));
  assert.ok(app.includes("'Switch to dark mode' : 'Switch to light mode'"));
  const css = read('styles.css');
  assert.match(css, /\.theme-toggle \{[^}]*width: 40px;[^}]*height: 40px;[^}]*border-radius: 50%;[^}]*color: var\(--text-2\);/);
});

test('footer: links open in a new tab with rel="noopener" and a screen-reader note; dots are hidden', () => {
  const app = read('app.js');
  assert.ok(app.includes('target="_blank" rel="noopener"'));
  assert.ok(app.includes('<span class="sr-only"> (opens in a new tab)</span>'));
  assert.ok(app.includes('class="footer-dot" aria-hidden="true">·</span>'));
  ['How it calculates', 'Source on GitHub', 'fbomeroglu.com', "'GitHub'", "'LinkedIn'", 'Designed and built by',
    'Fatih Omeroglu', 'Version ${VERSION}'].forEach((text) => assert.ok(app.includes(text), text));
  assert.ok(app.includes('t.innerHTML = header() + screenHtml() + footer();'));
});
