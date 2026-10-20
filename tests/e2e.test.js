// End-to-end tests of the running example (design/README.md), from form
// state to display text, through logic.js and engine.js. Run with `node --test`.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const L = require(path.join(__dirname, '..', 'logic.js'));

// The running example as a user would fill in the form: three keyboard designs,
// within subjects; one variable, so every pair is compared (3 comparisons),
// always adjusted (methods.md §1.2, §1.3); task time primary (10 s, 8 of 10
// faster); NASA-TLX (10 points, SD 15, medium consistency); task success (70%
// vs. 85%).
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
  Object.assign(L.inputsFor(time, 'all'), { mode: 'units', variability: 'estimate', delta: '10', k: '8' });

  const tlx = L.presetMeasure('nasa-tlx');
  Object.assign(L.inputsFor(tlx, 'all'), { mode: 'units', variability: 'sd', delta: '10', sd: '15', consistency: 'medium' });
  form.measures.push(tlx);

  const success = L.newMeasure(false);
  success.name = 'Task success';
  success.type = 'binary';
  Object.assign(L.inputsFor(success, 'all'), { p1: '70', p2: '85' });
  form.measures.push(success);
  return form;
}

test('running example: every pair, adjusted, recommends 24, driven by task time', () => {
  const form = runningExampleForm();
  const r = L.runPlan(form);
  assert.equal(r.error, null);
  assert.deepEqual(r.issues, []);
  assert.equal(r.plan.m, 3);
  assert.equal(r.plan.adjust, true);
  const view = L.planView(r.plan, form);
  assert.equal(view.participants, 24);
  assert.equal(view.drivenBy, 'Task time');
  assert.equal(view.design, 'Within · 3 conditions');
  assert.equal(view.powerAlpha, '0.80 · 0.0167');
  assert.equal(view.announce, 'Participants needed: 24');
  assert.equal(L.step1View(form).conditionsNote,
    'With 3 conditions, every pair is compared (3 comparisons), using a stricter test for each so the overall chance of a false result stays at 5%.');
});

test('running example: per-measure table and underpowered warnings', () => {
  const form = runningExampleForm();
  const view = L.planView(L.runPlan(form).plan, form);
  const row = (name) => view.rows.find((x) => x.name === name);
  assert.deepEqual([row('Task time').needed, row('Task time').status, row('Task time').method], [24, 'covered', 'Wilcoxon signed-rank']);
  assert.deepEqual([row('NASA-TLX').needed, row('NASA-TLX').status, row('NASA-TLX').method], [30, 'underpowered', 'Paired t-test']);
  assert.deepEqual([row('Task success').needed, row('Task success').status, row('Task success').method], [168, 'underpowered', 'McNemar']);
  assert.equal(row('Task time').why, 'Times usually skew right; +5% applied (conservative)');
  assert.equal(row('NASA-TLX').why, 'Composite rating, usually near-normal');
  assert.equal(row('Task success').why, 'Same participants, yes/no outcome');
  assert.deepEqual(view.warnings, [
    'NASA-TLX is underpowered at 24: 75% chance of detecting your target. It would need 30. Report it as supporting evidence.',
    'Task success is underpowered at 24: 11% chance of detecting your target. It would need 168. Report it as supporting evidence.',
  ]);
  assert.equal(view.coverAll, 'To cover every measure: 168 participants (Task success).');
});

test('running example: trail for task time', () => {
  const form = runningExampleForm();
  const view = L.planView(L.runPlan(form).plan, form);
  const trail = view.trails[0];
  assert.equal(trail.name, 'Task time');
  assert.equal(trail.open, true);
  const group = (title) => trail.groups.find((g) => g.title === title).lines.join(' ');
  assert.match(group('Your inputs'), /The same inputs apply to each of the 3 comparisons\./);
  assert.match(group('Your inputs'), /Smallest difference that matters \(Δ\): 10 seconds \(entered\)\./);
  assert.match(group('Your inputs'), /how many of 10 participants would do better: 8 \(your estimate\)\./);
  assert.match(group('Variability'), /11\.9 seconds \(your estimate\)/);
  assert.match(group('Effect size'), /0\.842 \(your estimate\)/);
  assert.match(group('Alpha'), /0\.05 ÷ 3 comparisons \(Bonferroni\): 0\.0167\./);
  // Answer-key rows 5b and 8: 17.7366 → 18, then 18 ÷ 0.955 = 18.85 → 19, then 24.
  assert.match(group('Sample size'), /Paired t-test: n = 17\.7366, rounded up: 18\./);
  assert.match(group('Sample size'), /18 ÷ 0\.955 \(3\/π\) = 18\.85, rounded up: 19\./);
  assert.match(group('Order plan'), /19 rounded up to a multiple of 6 orders \(balanced Latin square\): 24\./);
  assert.match(group('Order plan'), /24 fits 6 orders: 4 participants each\./);
  assert.ok(view.trails.slice(1).every((t) => !t.open));
});

test('running example: 6 Latin square orders with the condition key', () => {
  const form = runningExampleForm();
  const view = L.planView(L.runPlan(form).plan, form);
  assert.equal(view.orderPlan.text, 'Balanced Latin square: 6 orders, 4 participants each.');
  assert.deepEqual(view.orderPlan.orders.map((o) => o.sequence), ['A B C', 'B C A', 'C A B', 'C B A', 'A C B', 'B A C']);
  assert.deepEqual(view.orderPlan.key, ['A = Current', 'B = Prototype A', 'C = Prototype B']);
});

test('running example: confidence report at 12 participants', () => {
  // Alpha 0.05 / 3 per comparison. Task time is rank-based, so power and
  // detectable difference use n × 3/π (methods.md §7): 53% and 13.2 s.
  // Precision uses the actual n and the unadjusted 95% interval: ± 7.5 s.
  const form = runningExampleForm();
  const plan = L.runPlan(form).plan;
  const c = L.confidence(plan, 12, form);
  assert.equal(c.error, null);
  const view = L.confidenceView(c.report, c.curve);
  assert.deepEqual(view.tiles.map((t) => t.value), ['13 s', '± 7.5 s', '53%']);
  assert.equal(view.tiles[2].label, 'Chance of detecting your 10-second target');
  assert.equal(view.curve.caught, '53% caught');
  assert.equal(view.curve.missed, '47% missed');
  assert.equal(view.curve.targetLabel, 'If the 10 s difference is real');
  assert.equal(view.curve.axisTitle, 'Task time difference your study finds');
  assert.equal(view.note, 'Based on variability of about 12 s (your estimate).');
  assert.deepEqual([view.precision.low, view.precision.mid, view.precision.high], ['2.5 s', '10 s', '17.5 s']);
  assert.equal(view.precision.label, 'Expected result of 10 seconds with a range from 2.5 to 17.5 seconds');
  // The slider starts at the recommended n.
  assert.deepEqual(L.sliderRange(plan), { min: 4, max: 60, step: 1, value: 24 });
});

test('running example: sidebar during step 3 with only task time filled in', () => {
  const form = runningExampleForm();
  form.measures[1].inputs.all.sd = '';
  form.measures[2].inputs.all.p2 = '';
  const s = L.sidebarSummary(form, 3);
  assert.equal(s.participants, '24');
  assert.equal(s.note, 'Set by Task time, your primary measure. Updates as you type.');
  assert.deepEqual(s.measures.map((m) => m.value), ['24', 'not filled in yet', 'not filled in yet']);
  assert.deepEqual(L.sidebarSummary(form, 1).rows.map((r) => r.value), ['Within subjects', '3', '3 (every pair)', '3 (primary: Task time)']);
  // The full plan waits for every measure.
  assert.equal(L.runPlan(form).plan, null);
});

test('running example: reporting guidance', () => {
  const form = runningExampleForm();
  const g = L.planView(L.runPlan(form).plan, form).guidance;
  assert.equal(g[0].lead, 'Task time');
  assert.match(g[0].text, /geometric mean/);
  assert.ok(g.some((x) => x.lead === 'Three conditions' && /repeated-measures ANOVA or Friedman test/.test(x.text)));
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

test('running example: your analysis plan lists two steps for each measure', () => {
  const form = runningExampleForm();
  const a = L.planView(L.runPlan(form).plan, form).analysis;
  const tail = " for each of the 3 pairs, at alpha 0.0167 each (Bonferroni). Holm's procedure can be used instead and is never less powerful.";
  const across = ' across all 3 conditions, to see whether they differ at all.';
  assert.deepEqual(a.map((m) => [m.name, ...m.steps]), [
    ['Task time', `Friedman test${across}`, `Wilcoxon signed-rank${tail}`],
    ['NASA-TLX', `Repeated-measures ANOVA${across}`, `Paired t-test${tail}`],
    ['Task success', `Cochran's Q test${across}`, `McNemar${tail}`],
  ]);
});
