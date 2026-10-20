// End-to-end tests of the running example (design/README.md), from form
// state to display text, through logic.js and engine.js. Run with `node --test`.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const L = require(path.join(__dirname, '..', 'logic.js'));

// The running example as a user would fill in the form: three keyboard designs,
// within subjects; one variable with exactly three conditions, so every pair is
// compared with Fisher's protected LSD at alpha 0.05 (methods.md §1.2, §1.3); task time primary (10 s, 8 of 10
// faster); NASA-TLX (10 points, SD 15 from past data, Low consistency, the
// only setting in this version); task success (70% vs. 85%).
function runningExampleForm() {
  const form = L.newForm();
  form.design = 'within';
  const f = form.factors[0];
  f.name = 'Keyboard design';
  f.levels[0].name = 'Current';
  f.levels[1].name = 'Prototype A';
  f.levels.push(L.newLevel('Prototype B'));

  const time = form.measures[0];
  time.name = 'Task time';
  time.unit = 'seconds';
  time.type = 'time';
  Object.assign(L.inputsFor(time, 'all'), { delta: '10', k: '8' });

  const tlx = L.presetMeasure('nasa-tlx');
  Object.assign(L.inputsFor(tlx, 'all'), { variability: 'sd', delta: '10', sd: '15' });
  form.measures.push(tlx);

  const success = L.newMeasure(false);
  success.name = 'Task success';
  success.type = 'binary';
  Object.assign(L.inputsFor(success, 'all'), { p1: '70', p2: '85' });
  form.measures.push(success);
  return form;
}

const LSD_TIP = "With exactly three conditions, the overall test protects the comparisons, so each uses the usual 0.05 (Fisher's protected LSD).";
const tokenOf = (parts) => parts.find((p) => typeof p === 'object');

test('running example: protected LSD, recommends 18, driven by task time', () => {
  const form = runningExampleForm();
  const r = L.runPlan(form);
  assert.equal(r.error, null);
  assert.deepEqual(r.issues, []);
  assert.equal(r.plan.m, 3);
  assert.equal(r.plan.procedure, 'protected-lsd');
  const view = L.planView(r.plan, form);
  assert.equal(view.participants, 18);
  assert.equal(view.drivenBy, 'Task time');
  assert.equal(view.design, 'Within · 3 conditions');
  // Readout alpha is 0.05, with its tooltip.
  assert.equal(L.plainText(view.powerAlpha), '0.80 · 0.05');
  assert.deepEqual(tokenOf(view.powerAlpha), { alpha: '0.05', tip: LSD_TIP });
  assert.equal(view.announce, 'Participants needed: 18');
  const note = L.step1View(form).conditionsNote;
  assert.equal(L.plainText(note),
    "With 3 conditions, every pair is compared. Run the overall test first; if it's significant, compare each pair at the usual 0.05 (Fisher's protected LSD).");
  assert.equal(tokenOf(note).tip, LSD_TIP);
});

test('running example: per-measure table and underpowered warnings', () => {
  const form = runningExampleForm();
  const view = L.planView(L.runPlan(form).plan, form);
  const row = (name) => view.rows.find((x) => x.name === name);
  assert.deepEqual([row('Task time').needed, row('Task time').status, row('Task time').method], [18, 'covered', 'Wilcoxon signed-rank']);
  assert.deepEqual([row('NASA-TLX').needed, row('NASA-TLX').status, row('NASA-TLX').method], [30, 'underpowered', 'Paired t-test']);
  assert.deepEqual([row('Task success').needed, row('Task success').status, row('Task success').method], [126, 'underpowered', 'McNemar']);
  assert.equal(row('Task time').why, 'Times usually skew right; +5% applied (conservative)');
  assert.equal(row('NASA-TLX').why, 'Composite rating, usually near-normal');
  assert.equal(row('Task success').why, 'Same participants, yes/no outcome');
  assert.deepEqual(view.warnings, [
    'NASA-TLX is underpowered at 18: 62% chance of detecting your target. It would need 30. Report it as supporting evidence.',
    'Task success is underpowered at 18: 18% chance of detecting your target. It would need 126. Report it as supporting evidence.',
  ]);
  assert.equal(view.coverAll, 'To cover every measure: 126 participants (Task success).');
});

test('running example: trail for task time, with the protected LSD assumption', () => {
  const form = runningExampleForm();
  const view = L.planView(L.runPlan(form).plan, form);
  const trail = view.trails[0];
  assert.equal(trail.name, 'Task time');
  assert.equal(trail.open, true);
  const group = (title) => trail.groups.find((g) => g.title === title).lines.map(L.plainText).join(' ');
  assert.match(group('Your inputs'), /The same inputs apply to each of the 3 comparisons\./);
  assert.match(group('Your inputs'), /Smallest difference that matters \(Δ\): 10 seconds \(entered\)\./);
  assert.match(group('Your inputs'), /how many of 10 participants would do better: 8 \(your estimate\)\./);
  assert.match(group('Variability'), /11\.9 seconds \(your estimate\)/);
  assert.match(group('Effect size'), /0\.842 \(your estimate\)/);
  assert.equal(group('Alpha'), "Alpha per comparison = 0.05, after a significant overall test (Fisher's protected LSD, three conditions): 0.05.");
  const alphaLine = trail.groups.find((g) => g.title === 'Alpha').lines[0];
  assert.deepEqual(tokenOf(alphaLine), { alpha: '0.05', tip: LSD_TIP });
  assert.equal(group('Assumption'),
    'Planned assuming the overall test is significant; the true chance of finding a winner is slightly lower. A simulation check is planned for version 1.1.');
  // Answer-key row 3 at alpha 0.05: 13.1301 → 14, then 14 ÷ 0.955 = 14.66 → 15, then 18.
  assert.match(group('Sample size'), /Paired t-test: n = 13\.1301, rounded up: 14\./);
  assert.match(group('Sample size'), /14 ÷ 0\.955 \(3\/π\) = 14\.66, rounded up: 15\./);
  assert.match(group('Order plan'), /15 rounded up to a multiple of 6 orders \(balanced Latin square\): 18\./);
  assert.match(group('Order plan'), /18 fits 6 orders: 3 participants each\./);
  assert.ok(view.trails.slice(1).every((t) => !t.open));
});

test('running example: 6 Latin square orders with the condition key', () => {
  const form = runningExampleForm();
  const view = L.planView(L.runPlan(form).plan, form);
  assert.equal(view.orderPlan.text, 'Balanced Latin square: 6 orders, 3 participants each.');
  assert.deepEqual(view.orderPlan.orders.map((o) => o.sequence), ['A B C', 'B C A', 'C A B', 'C B A', 'A C B', 'B A C']);
  assert.deepEqual(view.orderPlan.key, ['A = Current', 'B = Prototype A', 'C = Prototype B']);
});

test('running example: confidence report at 12 participants', () => {
  // Protected LSD: alpha 0.05 per comparison. Task time is rank-based, so power
  // and detectable difference use n × 3/π (methods.md §7): 73% and 10.9 s.
  // Precision uses the actual n: ± 7.5 s.
  const form = runningExampleForm();
  const plan = L.runPlan(form).plan;
  const c = L.confidence(plan, 12, form);
  assert.equal(c.error, null);
  const view = L.confidenceView(c.report, c.curve);
  assert.deepEqual(view.tiles.map((t) => t.value), ['11 s', '± 7.5 s', '73%']);
  assert.equal(view.tiles[2].label, 'Chance of detecting your 10-second target');
  assert.equal(view.curve.caught, '73% caught');
  assert.equal(view.curve.missed, '27% missed');
  assert.equal(view.curve.targetLabel, 'If the 10 s difference is real');
  assert.equal(view.curve.axisTitle, 'Task time difference your study finds');
  assert.equal(view.note, 'Based on variability of about 12 s (your estimate).');
  assert.deepEqual([view.precision.low, view.precision.mid, view.precision.high], ['2.5 s', '10 s', '17.5 s']);
  assert.equal(view.precision.label, 'Expected result of 10 seconds with a range from 2.5 to 17.5 seconds');
  // The slider starts at the recommended n.
  assert.deepEqual(L.sliderRange(plan), { min: 4, max: 60, step: 1, value: 18 });
});

test('running example: sidebar during step 3 with only task time filled in', () => {
  const form = runningExampleForm();
  form.measures[1].inputs.all.sd = '';
  form.measures[2].inputs.all.p2 = '';
  const s = L.sidebarSummary(form, 3);
  assert.equal(s.participants, '18');
  assert.equal(s.note, 'Set by Task time, your primary measure. Updates as you type.');
  assert.deepEqual(s.measures.map((m) => m.value), ['18', 'not filled in yet', 'not filled in yet']);
  assert.deepEqual(L.sidebarSummary(form, 1).rows.map((r) => r.value), ['Within subjects', '3', '3 (every pair)', '3 (primary: Task time)']);
  // The full plan waits for every measure.
  assert.equal(L.runPlan(form).plan, null);
});

test('running example: reporting guidance', () => {
  const form = runningExampleForm();
  const g = L.planView(L.runPlan(form).plan, form).guidance;
  assert.equal(g[0].lead, 'Task time');
  assert.match(g[0].text, /geometric mean/);
  assert.ok(g.some((x) => x.lead === 'Three conditions' && /If it is significant, report the pairwise comparisons at alpha 0\.05 \(Fisher's protected LSD\)/.test(x.text)));
  assert.ok(g.some((x) => x.lead === 'Task success' && /percentage points/.test(x.text)));
});

test('find problems: 10% and 80% gives 16', () => {
  const v = L.findView({ p: '10', P: '80', participants: null });
  assert.equal(v.ready, true);
  assert.equal(v.n, 16);
  assert.equal(v.result.n, '16');
  assert.equal(v.result.text, 'participants for an 80% chance of seeing any problem that affects at least 10% of users.');
  assert.deepEqual(v.table.columns, ['Affects 10% of users', 'Affects 31% of users']);
  assert.deepEqual(v.table.rows.map((r) => [r.label, ...r.values]), [
    ['5', '41%', '84%'],
    ['10', '65%', '98%'],
    ['16 (your plan)', '81%', 'over 99%'],
  ]);
  assert.equal(v.slider.value, 16);
  assert.equal(v.trail[3].text, 'n = ln(0.20) ÷ ln(0.90) = 15.3, rounded up to 16.');
});

test('find problems: the slider at 8 participants', () => {
  const v = L.findView({ p: '10', P: '80', participants: 8 });
  assert.equal(v.sentence.participants, '8 participants');
  assert.equal(v.sentence.frequency, 'about 18% of users or more');
  assert.equal(v.curve.chosenLabel, '8 participants: 57%');
  assert.equal(v.curve.planLabel, '16: your plan, 81%');
});

test('running example: your analysis plan lists two steps for each measure (protected LSD)', () => {
  const form = runningExampleForm();
  const a = L.planView(L.runPlan(form).plan, form).analysis;
  const step2 = (test) => `Step 2: if it's significant, ${test} for each pair at 0.05 (Fisher's protected LSD).`;
  assert.deepEqual(a.map((m) => [m.name, ...m.steps.map(L.plainText)]), [
    ['Task time', 'Step 1: Friedman test at 0.05.', step2('Wilcoxon signed-rank')],
    ['NASA-TLX', 'Step 1: Repeated-measures ANOVA at 0.05.', step2('paired t-test')],
    ['Task success', "Step 1: Cochran's Q test at 0.05.", step2('McNemar')],
  ]);
  // The per-comparison alpha in step 2 carries the tooltip.
  assert.deepEqual(tokenOf(a[0].steps[1]), { alpha: '0.05', tip: LSD_TIP });
});

test('running example: NASA-TLX from past data states the consistency assumption', () => {
  const form = runningExampleForm();
  const trail = L.planView(L.runPlan(form).plan, form).trails.find((t) => t.name === 'NASA-TLX');
  const group = (title) => trail.groups.find((g) => g.title === title).lines.map(L.plainText).join(' ');
  assert.match(group('Variability'), /σ_diff = σ × √\(2\(1 − 0\.3\)\): 17\.7 points\./);
  assert.match(group('Assumption'), /consistency Low, ρ = 0\.3/);
  assert.match(group('Sample size'), /n = 26\.7083, rounded up: 27\./);
  assert.match(group('Order plan'), /27 rounded up to a multiple of 6 orders \(balanced Latin square\): 30\./);
});

test('running example: the analysis plan asks to average repeated values (within subjects)', () => {
  const form = runningExampleForm();
  assert.equal(L.planView(L.runPlan(form).plan, form).analysisNote,
    'If participants give several values per condition, average them first; the sample size counts people, not trials.');
  form.design = 'between';
  assert.equal(L.planView(L.runPlan(form).plan, form).analysisNote, null);
});
