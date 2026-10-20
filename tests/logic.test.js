// Tests for logic.js: form state to engine calls, engine results to display
// text. Run with `node --test` from the repo root.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const L = require(path.join(__dirname, '..', 'logic.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

// A two-condition within study with one measure, ready to fill in.
function simpleForm(type, inputs, extra) {
  const form = L.newForm();
  form.design = 'within';
  const f = form.factors[0];
  f.name = 'Design';
  f.levels[0].name = 'Current';
  f.levels[1].name = 'New';
  const m = form.measures[0];
  m.name = 'Score';
  m.unit = 'points';
  m.type = type;
  Object.assign(L.inputsFor(m, 'all'), inputs);
  if (extra) extra(form, m);
  return form;
}

// A 2 × 2 study (Design × Posture) with the first n candidate comparisons of each kind.
function twoFactorForm() {
  const form = L.newForm();
  form.design = 'within';
  form.factors[0].name = 'Design';
  form.factors[0].levels[0].name = 'Current';
  form.factors[0].levels[1].name = 'A';
  const posture = L.newFactor();
  posture.name = 'Posture';
  posture.levels[0].name = 'Seated';
  posture.levels[1].name = 'Standing';
  form.factors.push(posture);
  const m = form.measures[0];
  m.name = 'Time';
  m.unit = 's';
  m.type = 'time';
  return form;
}

const issueAt = (issues, target) => issues.find((i) => i.target === target);

// ---------------------------------------------------------------------------
// Parsing and formatting
// ---------------------------------------------------------------------------

test('parseNumber: empty, invalid, decimal point or comma, negative', () => {
  assert.deepEqual(L.parseNumber(''), { empty: true });
  assert.deepEqual(L.parseNumber('   '), { empty: true });
  assert.deepEqual(L.parseNumber('abc'), { invalid: true });
  assert.deepEqual(L.parseNumber('1.2.3'), { invalid: true });
  assert.deepEqual(L.parseNumber('12'), { value: 12 });
  assert.deepEqual(L.parseNumber('0.80'), { value: 0.8 });
  assert.deepEqual(L.parseNumber('.5'), { value: 0.5 });
  assert.deepEqual(L.parseNumber('7,5'), { value: 7.5 });
  assert.deepEqual(L.parseNumber('-3'), { value: -3 });
});

test('formatting: significant figures, percentages, units and phrases', () => {
  assert.equal(L.fmtSig(12.3455, 2), '12');
  assert.equal(L.fmtSig(7.549, 2), '7.5');
  assert.equal(L.fmtSig(11.8818, 3), '11.9');
  assert.equal(L.fmtSig(0.025, 3), '0.025');
  assert.equal(L.fmtSig(0.05 / 3, 3), '0.0167');
  assert.equal(L.fmtSig(150.3, 2), '150');
  assert.equal(L.fmtSig(NaN, 2), '–');
  assert.equal(L.fmtPercent(0.6036), '60%');
  assert.equal(L.fmtPercent(0.9974), 'over 99%');
  assert.equal(L.fmtPercent(0.994), '99%');
  assert.equal(L.fmtPercent(0.004), 'under 1%');
  assert.equal(L.fmtFraction(0.9), '0.90');
  assert.equal(L.fmtFraction(0.975), '0.975');
  assert.equal(L.fmtUnits(12.3, 'seconds'), '12 s');
  assert.equal(L.fmtUnits(250, 'milliseconds'), '250 ms');
  assert.equal(L.fmtUnits(15, 'points'), '15 points');
  assert.equal(L.fmtUnits(3, ''), '3');
  assert.equal(L.targetPhrase(10, 'seconds'), 'your 10-second target');
  assert.equal(L.targetPhrase(2, 'minutes'), 'your 2-minute target');
  assert.equal(L.targetPhrase(10, 'points'), 'your target of 10 points');
});

// ---------------------------------------------------------------------------
// Form → study
// ---------------------------------------------------------------------------

test('buildStudy: one variable, every pair, and the inputs it passes on', () => {
  const form = simpleForm('rating', { variability: 'sd', delta: '5', sd: '10', consistency: 'high' });
  form.factors[0].levels.push(L.newLevel('Other'));
  const b = L.buildStudy(form);
  assert.deepEqual(b.issues, []);
  assert.deepEqual(b.study.comparisons, { scheme: 'all-pairs' });
  assert.equal(b.study.adjust, undefined); // the engine picks the procedure (methods.md §1.3)
  assert.equal(L.runPlan(form).plan.procedure, 'protected-lsd');
  assert.deepEqual(b.study.factors, [{ name: 'Design', levels: ['Current', 'New', 'Other'] }]);
  // Past data: consistency is always Medium in this version (methods.md §3.1).
  assert.deepEqual(b.study.measures[0].effect, { mode: 'units', delta: 5, sd: 10, consistency: 'medium' });
  assert.equal(b.study.alpha, 0.05);
  assert.equal(b.study.power, 0.8);
});

test('buildStudy: one variable needs no comparison choices; alpha follows the number of conditions', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  assert.equal(issueAt(L.buildStudy(form).issues, 'comparisons'), undefined);
  assert.equal(L.runPlan(form).plan.alphaPerComparison, 0.05);
  form.factors[0].levels.push(L.newLevel('Third'));
  const plan = L.runPlan(form).plan;
  assert.equal(plan.m, 3);
  assert.equal(plan.alphaPerComparison, 0.05); // protected LSD
  form.factors[0].levels.push(L.newLevel('Fourth'));
  assert.equal(L.runPlan(form).plan.alphaPerComparison, 0.05 / 6); // Bonferroni
});

test('buildStudy: between subjects, always-paired within, presets and participants mode', () => {
  const between = simpleForm('time', { delta: '10', k: '8' }, (f) => { f.design = 'between'; });
  assert.equal(L.runPlan(between).plan.measures[0].method, 'Mann–Whitney');

  // Within subjects is always paired: the linking question is a later-version item.
  const within = simpleForm('rating', { variability: 'sd', delta: '5', sd: '10' }, (f, m) => { m.linked = false; });
  const u = L.buildStudy(within);
  assert.equal(u.study.measures[0].linked, true);
  assert.equal(u.study.measures[0].effect.consistency, 'medium');
  assert.equal(L.runPlan(within).plan.measures[0].method, 'Paired t-test');

  const preset = L.presetMeasure('seq');
  assert.deepEqual([preset.name, preset.type, preset.unit, preset.scaleMin, preset.scaleMax], ['SEQ', 'rating', 'points', '1', '7']);

  const participants = simpleForm('numeric', { mode: 'participants', k: '8' });
  assert.deepEqual(L.buildStudy(participants).study.measures[0].effect, { mode: 'participants', k: 8 });
});

test('buildStudy: success / failure rates are percentages; the default discordance is always used', () => {
  const form = simpleForm('binary', { p1: '60', p2: '80', psi: '30' });
  // Any old discordance value is ignored: the engine uses its default (methods.md §3.2).
  assert.deepEqual(L.buildStudy(form).study.measures[0].effect, { p1: 0.6, p2: 0.8 });
  const plan = L.runPlan(form).plan;
  assert.equal(plan.measures[0].comparisons[0].effect.psiEntered, false);
  const trail = L.planView(plan, form).trails[0];
  assert.equal(trail.groups.find((g) => g.title === 'Assumption').lines.map(L.plainText).join(' '),
    "Assumes a participant's success on one condition is unrelated to the other, the cautious default.");
  assert.ok(!trail.groups.find((g) => g.title === 'Your inputs').lines.map(L.plainText).join(' ').includes('discordance'));
  form.design = 'between';
  assert.deepEqual(L.buildStudy(form).study.measures[0].effect, { p1: 0.6, p2: 0.8 });
  const bad = simpleForm('binary', { p1: '150', p2: '80' });
  const i = issueAt(L.buildStudy(bad).issues, L.ids.input(bad.measures[0].id, 'all', 'p1'));
  assert.equal(i.message, 'Enter a percentage between 0 and 100.');
});

test('buildStudy: two variables give one input set per selected comparison', () => {
  const form = twoFactorForm();
  const c = L.candidateComparisons(form);
  // Main effects: one pair per variable. Specific combinations: 4 cells give 6 pairs.
  assert.equal(c.main.length, 2);
  assert.equal(c.cell.length, 6);
  assert.equal(c.main[0].label, 'A vs. Current, averaged across Posture');
  const seated = c.cell.find((x) => x.label === 'A × Seated vs. Current × Seated');
  assert.ok(seated);
  form.comparisons.selected = [c.main[0].key, seated.key];
  const m = form.measures[0];
  Object.assign(L.inputsFor(m, c.main[0].key), { delta: '5', variability: 'sd', sd: '10' });
  Object.assign(L.inputsFor(m, seated.key), { mode: 'participants', k: '8' });
  const b = L.buildStudy(form);
  assert.deepEqual(b.issues, []);
  assert.deepEqual(b.study.comparisons.list, [
    { id: 'A vs. Current, averaged across Posture', type: 'main', factor: 'Design', a: 'A', b: 'Current' },
    { id: 'A × Seated vs. Current × Seated', type: 'cell', a: ['A', 'Seated'], b: ['Current', 'Seated'] },
  ]);
  assert.deepEqual(Object.keys(b.study.measures[0].effect.byComparison), ['A vs. Current, averaged across Posture', 'A × Seated vs. Current × Seated']);
  const plan = L.runPlan(form).plan;
  assert.equal(plan.k, 4);
  assert.equal(plan.m, 2);
});

test('defaults are generic: unnamed variable and measure, conditions A, B, C ...', () => {
  const form = L.newForm();
  assert.equal(form.factors[0].name, '');
  assert.deepEqual(form.factors[0].levels.map((l) => l.name), ['Condition A', 'Condition B']);
  form.factors[0].levels.push(L.nextLevel(form.factors[0]));
  assert.equal(form.factors[0].levels[2].name, 'Condition C');
  assert.equal(form.measures[0].name, '');
  assert.equal(L.conditionName(25), 'Condition Z');
  assert.equal(L.conditionName(26), 'Condition 27');
  assert.equal(L.newFactor().levels[1].name, 'Condition B');
  assert.equal(L.plainText(L.step1View(form).conditionsNote).startsWith('With 3 conditions'), true);
  // Presets still fill their own names.
  assert.equal(L.presetMeasure('nasa-tlx').name, 'NASA-TLX');
});

test('buildStudy: missing names, types and inputs are reported, not guessed', () => {
  const form = L.newForm();
  form.factors[0].levels[0].name = '';
  const b = L.buildStudy(form);
  assert.equal(b.study, null);
  const targets = b.issues.map((i) => i.target);
  assert.ok(targets.includes('design'));
  assert.ok(targets.includes(L.ids.level(form.factors[0].levels[0].id)));
  assert.ok(!targets.includes(L.ids.level(form.factors[0].levels[1].id)));
  assert.ok(targets.includes(L.ids.measureName(form.measures[0].id)));
  assert.ok(targets.includes(L.ids.measureType(form.measures[0].id)));
  assert.ok(b.issues.every((i) => i.kind === 'missing'));

  // Question 1 is optional; question 2 is required.
  const empty = simpleForm('time', { delta: '', k: '' });
  const e = L.buildStudy(empty).issues;
  assert.equal(issueAt(e, L.ids.input(empty.measures[0].id, 'all', 'delta')), undefined);
  assert.equal(issueAt(e, L.ids.input(empty.measures[0].id, 'all', 'k')).kind, 'missing');
  // With past data, the difference and the SD are both required.
  const past = simpleForm('time', { variability: 'sd', delta: '', sd: '' });
  const pe = L.buildStudy(past).issues;
  assert.equal(issueAt(pe, L.ids.input(past.measures[0].id, 'all', 'delta')).message, 'Enter the smallest difference that would matter to use your past data.');
  assert.equal(issueAt(pe, L.ids.input(past.measures[0].id, 'all', 'sd')).message, 'Enter the standard deviation from your past data.');
  assert.equal(issueAt(pe, L.ids.input(past.measures[0].id, 'all', 'k')), undefined);

  const typo = simpleForm('time', { delta: 'ten', k: '8' });
  assert.equal(issueAt(L.buildStudy(typo).issues, L.ids.input(typo.measures[0].id, 'all', 'delta')).message, 'Enter a number.');

  const twin = simpleForm('time', { delta: '10', k: '8' }, (f) => {
    const m2 = L.newMeasure(false);
    m2.name = 'score';
    m2.type = 'time';
    f.measures.push(m2);
  });
  assert.equal(issueAt(L.buildStudy(twin).issues, L.ids.measureName(twin.measures[1].id)).message, 'Each measure needs its own name.');
});

// ---------------------------------------------------------------------------
// Engine errors placed by field and measure (single plan() call)
// ---------------------------------------------------------------------------

test('runPlan: each engine error lands on the input that caused it, with the engine message', () => {
  const cases = [
    ['k out of range', simpleForm('time', { delta: '10', k: '5' }), 'k', /6 to 9/],
    ['zero difference', simpleForm('time', { delta: '0', k: '8' }), 'delta', /must not be zero|greater than 0/],
    ['negative SD', simpleForm('rating', { variability: 'sd', delta: '5', sd: '-2' }), 'sd', /Standard deviation must be greater than 0/],
    ['equal rates', simpleForm('binary', { p1: '60', p2: '60' }), 'p2', /must differ/],
    ['participants k', simpleForm('numeric', { k: '9.5' }), 'k', /whole number/],
  ];
  cases.forEach(([name, form, field, pattern]) => {
    const r = L.runPlan(form);
    assert.equal(r.plan, null, name);
    assert.equal(r.error.target, L.ids.input(form.measures[0].id, 'all', field), name);
    assert.equal(r.error.step, 3, name);
    assert.equal(r.error.measureId, form.measures[0].id, name);
    assert.match(r.error.message, pattern, name);
  });
});

test('one flow: the answers pick the mode (methods.md §3.1)', () => {
  // Both answers: in units, variability from the estimate.
  assert.deepEqual(L.buildStudy(simpleForm('time', { delta: '10', k: '8' })).study.measures[0].effect, { mode: 'units', delta: 10, k: 8 });
  // Question 1 empty: in participants.
  assert.deepEqual(L.buildStudy(simpleForm('time', { delta: '', k: '8' })).study.measures[0].effect, { mode: 'participants', k: 8 });
  // Past data replaces question 2: in units with the SD, consistency Medium.
  assert.deepEqual(L.buildStudy(simpleForm('time', { variability: 'sd', delta: '10', sd: '12', k: '8' })).study.measures[0].effect,
    { mode: 'units', delta: 10, sd: 12, consistency: 'medium' });
  // Between subjects: no consistency.
  const between = simpleForm('time', { variability: 'sd', delta: '10', sd: '12' }, (f) => { f.design = 'between'; });
  assert.deepEqual(L.buildStudy(between).study.measures[0].effect, { mode: 'units', delta: 10, sd: 12 });
  // The trail states the consistency assumption instead of an entered value.
  const form = simpleForm('rating', { variability: 'sd', delta: '10', sd: '15' });
  const trail = L.planView(L.runPlan(form).plan, form).trails[0];
  const assumption = trail.groups.find((g) => g.title === 'Assumption').lines.map(L.plainText).join(' ');
  assert.equal(assumption, 'Assumed: moderate consistency across conditions (correlation ρ = 0.5), the common default. If people are less consistent, your study may need more participants.');
  const inputs = trail.groups.find((g) => g.title === 'Your inputs').lines.map(L.plainText).join(' ');
  assert.ok(!/consistency/.test(inputs));
});

test('step 2: a preset fills the measure being edited', () => {
  const m = L.newMeasure(true);
  m.name = 'Workload';
  L.setType(m, 'time');
  L.applyPreset(m, 'nasa-tlx');
  // The preset sets its result type and scale range too.
  assert.deepEqual([m.name, m.unit, m.type, m.preset, m.scaleMin, m.scaleMax, m.primary],
    ['NASA-TLX', 'points', 'rating', 'nasa-tlx', '0', '100', true]);
});

test('step 2: switching the result type empties the measure', () => {
  // Choosing the first type keeps the name typed so far.
  const m = L.newMeasure(true);
  m.name = 'Task time';
  L.setType(m, 'time');
  assert.deepEqual([m.name, m.type], ['Task time', 'time']);
  L.setUnit(m, 'seconds');
  // Switching types empties the name and unit.
  L.setType(m, 'count');
  assert.deepEqual([m.name, m.unit, m.type], ['', '', 'count']);
  // A preset measure also loses its scale range and badge.
  const p = L.presetMeasure('sus');
  L.setType(p, 'rating'); // same type: nothing changes
  assert.equal(p.preset, 'sus');
  L.setType(p, 'time');
  assert.deepEqual([p.name, p.unit, p.type, p.preset, p.scaleMin, p.scaleMax], ['', '', 'time', null, '', '']);
});

test('step 2: the empty unit field shows the type\'s typical unit as placeholder text', () => {
  assert.deepEqual(L.UNIT_PLACEHOLDERS, { time: 'e.g., seconds', count: 'e.g., errors', rating: 'e.g., points', numeric: 'e.g., mm' });
  assert.equal(L.UNIT_PLACEHOLDERS.binary, undefined); // no unit field
  const m = L.newMeasure(true);
  L.setType(m, 'time');
  assert.equal(m.unit, ''); // a placeholder, not a value
});

test('runPlan: study-level errors land on alpha, power and the conditions', () => {
  const a = simpleForm('time', { delta: '10', k: '8' });
  a.alpha = '5';
  assert.equal(L.runPlan(a).error.target, 'alpha');
  const p = simpleForm('time', { delta: '10', k: '8' });
  p.power = '80';
  assert.equal(L.runPlan(p).error.target, 'power');
  const dup = simpleForm('time', { delta: '10', k: '8' });
  dup.factors[0].levels[1].name = 'Current';
  // Caught on step 1 by the engine's own check, before the plan runs.
  const d = L.runPlan(dup).issues.find((i) => i.kind === 'engine');
  assert.equal(d.target, L.ids.factorLevels(dup.factors[0].id));
  assert.equal(d.step, 1);
  assert.match(d.message, /unique/);
});

test('runPlan: an error in one comparison of a two-variable study lands on that comparison', () => {
  const form = twoFactorForm();
  const c = L.candidateComparisons(form);
  form.comparisons.selected = [c.main[0].key, c.cell[0].key];
  const m = form.measures[0];
  Object.assign(L.inputsFor(m, c.main[0].key), { mode: 'participants', k: '8' });
  Object.assign(L.inputsFor(m, c.cell[0].key), { delta: '5', k: '4' });
  const r = L.runPlan(form);
  assert.equal(r.error.target, L.ids.input(m.id, c.cell[0].key, 'k'));
  assert.equal(r.error.key, c.cell[0].key);
});

test('liveStatus: one plan() call; errors in other measures show before the primary is complete', () => {
  const form = simpleForm('time', { delta: '', k: '' }, (f) => {
    const m2 = L.newMeasure(false);
    m2.name = 'Rating';
    m2.type = 'rating';
    Object.assign(L.inputsFor(m2, 'all'), { mode: 'participants', k: '5' });
    f.measures.push(m2);
  });
  const live = L.liveStatus(form);
  assert.equal(live.plan, null);
  assert.equal(live.standIn, true);
  assert.equal(live.error.target, L.ids.input(form.measures[1].id, 'all', 'k'));
  // A complete measure blocked by another's error shows a dash, not "needs input".
  form.measures[0].inputs.all.delta = '10';
  form.measures[0].inputs.all.k = '8';
  assert.deepEqual(L.sidebarSummary(form, 3).measures.map((m) => m.value), ['–', 'fix the input']);
  form.measures[0].inputs.all.delta = '';
  form.measures[0].inputs.all.k = '';
  form.measures[1].inputs.all.k = '8';
  const ok = L.liveStatus(form);
  assert.equal(ok.error, null);
  const side = L.sidebarSummary(form, 3, ok);
  assert.equal(side.participants, '–');
  assert.equal(side.note, 'Fill in Score (primary) in step 3 to see it.');
  assert.deepEqual(side.measures.map((m) => m.value), ['not filled in yet', String(ok.partial.measures[0].total)]);
  // Complete: the whole study, the same single call.
  Object.assign(form.measures[0].inputs.all, { delta: '10', k: '8' });
  const full = L.liveStatus(form);
  assert.ok(full.plan);
  assert.equal(full.plan, full.partial);
});

test('placeError: unknown fields fall back to the measure or the step', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  const m = form.measures[0];
  const onMeasure = L.placeError(new E.EngineError('Odd.', { measure: 'Score', field: 'comparisons' }), form, {});
  assert.equal(onMeasure.target, L.ids.measureInputs(m.id));
  const general = L.placeError(new E.EngineError('Odd.'), form, {});
  assert.equal(general.target, 'general');
});

test('confidence: an n the engine rejects is placed on the slider', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  const plan = L.runPlan(form).plan;
  const c = L.confidence(plan, 1, form);
  assert.equal(c.report, null);
  assert.equal(c.error.target, 'participants');
});

// ---------------------------------------------------------------------------
// Disabled options (design/README.md)
// ---------------------------------------------------------------------------

test('disabled options use the exact explanation text', () => {
  assert.equal(L.TEXT.interactionDisabled, 'Interaction comparisons come in a later version.');
  assert.equal(L.TEXT.mainEffectBinaryDisabled,
    'For success/failure measures, only comparisons between specific conditions are supported in this version.');
  const form = twoFactorForm();
  assert.equal(L.mainEffectsDisabled(form), null);
  assert.equal(L.binaryTypeDisabled(form), null);
  const c = L.candidateComparisons(form);
  form.comparisons.selected = [c.main[0].key];
  assert.equal(L.binaryTypeDisabled(form), L.TEXT.mainEffectBinaryDisabled);
  form.comparisons.selected = [c.cell[0].key];
  assert.equal(L.binaryTypeDisabled(form), null);
  form.measures[0].type = 'binary';
  assert.equal(L.mainEffectsDisabled(form), L.TEXT.mainEffectBinaryDisabled);
  assert.equal(L.step1View(form).interactionDisabled, L.TEXT.interactionDisabled);
});

// ---------------------------------------------------------------------------
// Step text and sidebar
// ---------------------------------------------------------------------------

test('step 1 note: none for two conditions, protected LSD at three, Bonferroni-Holm at four or more', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  assert.equal(L.step1View(form).conditionsNote, null); // two conditions: no note
  form.factors[0].levels.push(L.newLevel('Other'));
  const three = L.step1View(form).conditionsNote;
  assert.equal(L.plainText(three),
    "With 3 conditions, every pair is compared. Run the overall test first; if it's significant, compare each pair at the usual 0.05 (Fisher's protected LSD).");
  const lsdToken = three.find((p) => typeof p === 'object');
  assert.equal(lsdToken.alpha, '0.05');
  assert.equal(lsdToken.tip, "With exactly three conditions, the overall test protects the comparisons, so each uses the usual 0.05 (Fisher's protected LSD).");

  form.factors[0].levels.push(L.newLevel('Fourth'));
  const four = L.step1View(form).conditionsNote;
  assert.equal(L.plainText(four),
    "With 4 conditions, every pair is compared (6 comparisons). Fisher's protected LSD only keeps false results at 5% with up to three conditions, so each comparison now uses a stricter test (alpha 0.00833 for planning, Holm adjustment at analysis).");
  assert.equal(four.find((p) => typeof p === 'object').tip,
    '4 conditions = 6 pairs. 0.05 ÷ 6 = 0.00833 per comparison, so the overall chance of a false result stays at 5%. At analysis, the Holm adjustment is less strict: only the first comparison faces 0.00833.');
  // Back to three: the note follows the conditions live.
  form.factors[0].levels.pop();
  assert.match(L.plainText(L.step1View(form).conditionsNote), /Fisher's protected LSD\)\.$/);

  const two = twoFactorForm();
  assert.equal(L.step1View(two).comparisonLine, 'No comparisons selected yet.');
  const c = L.candidateComparisons(two);
  two.comparisons.selected = [c.main[0].key];
  assert.equal(L.step1View(two).comparisonLine, '1 comparison selected.');
  two.comparisons.selected = [c.main[0].key, c.cell[0].key];
  const line = L.step1View(two).comparisonLine;
  assert.equal(L.plainText(line),
    '2 comparisons selected. Each uses a stricter test (alpha 0.025 for planning, Holm adjustment at analysis), so the overall chance of a false result stays at 5%.');
  assert.match(line.find((p) => typeof p === 'object').tip, /^2 comparisons\. 0\.05 ÷ 2 = 0\.025 per comparison/);
  // There is no adjustment question to answer.
  assert.equal(L.buildStudy(two).issues.some((i) => i.target === 'adjust'), false);
});

test('sidebar: notes and rows before inputs are complete', () => {
  const form = L.newForm();
  const s1 = L.sidebarSummary(form, 1);
  assert.equal(s1.participants, '–');
  assert.equal(s1.note, 'Calculated in step 3, once you describe the difference that matters.');
  assert.deepEqual(s1.rows.map((r) => r.value), ['Not set', '2', '1', 'Not set']);
  const s2 = L.sidebarSummary(simpleForm('time', { delta: '', k: '' }), 2);
  assert.equal(s2.note, 'Calculated in step 3, once you describe the difference that matters.');
  assert.deepEqual(s2.rows.map((r) => r.value), ['Within subjects', '2', '1', '1 (primary: Score)']);
  const bad = L.sidebarSummary(simpleForm('time', { delta: '10', k: '5' }), 3);
  assert.equal(bad.participants, '–');
  assert.equal(bad.note, 'Fix the highlighted input to see it.');
  assert.equal(bad.measures[0].value, 'fix the input');
});

test('step 3 wording follows the design and the comparison', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  form.factors[0].name = 'Keyboard design';
  form.measures[0].unit = 'seconds';
  form.measures[0].name = 'Task time';
  const t = L.inputText(form, form.measures[0], 'all');
  assert.equal(t.measureHeading, 'Task time (Measure 1 of 1)');
  assert.equal(t.deltaLabel, 'Smallest difference that would matter');
  assert.equal(t.deltaHint, "Optional. Leave empty if you don't have a target in seconds.");
  assert.equal(t.kQuestion, 'Out of 10 participants, how many should do better on the better condition?');
  assert.equal(t.kRange, '(6 to 9)');
  assert.deepEqual(t.kTip, {
    alpha: 'Why 6 to 9?',
    tip: '5 of 10 means no improvement: half would do better by chance. 10 of 10 means everyone improves by the same amount, which never happens in real data. So the tool accepts 6 to 9.',
  });
  assert.equal(t.kContext, 'Answer for a 10-second difference.');
  assert.equal(t.resultsIn, 'Results will be in seconds.');
  assert.equal(t.pastDataToggle, 'I have data from a past study');
  assert.equal(t.sdLabel, 'Standard deviation of Task time in your past data');
  assert.equal(t.consistencyNote, 'We assume moderate consistency across conditions (correlation 0.5), the common default. If people are less consistent, your study may need more participants.');
  form.measures[0].inputs.all.delta = '';
  const noTarget = L.inputText(form, form.measures[0], 'all');
  assert.equal(noTarget.kContext, null);
  assert.equal(noTarget.resultsIn, 'Results will be in participants (how many of 10 do better).');
  form.measures[0].inputs.all.variability = 'sd';
  assert.equal(L.inputText(form, form.measures[0], 'all').deltaHint, 'Needed to use your past data, in seconds.');
  form.design = 'between';
  const between = L.inputText(form, form.measures[0], 'all');
  assert.equal(between.kQuestion, 'How clear should the difference be?');
  assert.deepEqual(between.kSentence, {
    before: 'If you compared one random person from each condition, the person on the better condition should do better',
    after: 'out of 10 times.',
  });
  assert.equal(between.kTip.alpha, 'Why 6 to 9?');
  assert.equal(t.kSentence, null); // within subjects: a plain question
  assert.equal(L.inputText(form, form.measures[0], 'all').consistencyNote, null);
  // Success / failure: one question with both rates in one line.
  const rates = L.inputText(simpleForm('binary', { p1: '', p2: '' }), simpleForm('binary', {}).measures[0], 'all');
  assert.equal(rates.rateTitle, 'What improvement in success rate would matter?');
  assert.equal([rates.rateFrom, '[p1]', rates.rateMiddle, '[p2]', rates.rateTo].join(' '),
    'From [p1] % of participants succeeding to [p2] %');
  assert.equal(rates.rateHelp, 'For example, if 70% succeed with the weakest design, the best design should reach at least 85% to be worth choosing.');
  assert.equal(rates.p1Label, 'Success rate on the weaker condition, percent');
  assert.equal(rates.p2Label, 'Success rate on the better condition, percent');
  assert.equal(rates.psiLabel, undefined);

  const two = twoFactorForm();
  const c = L.candidateComparisons(two);
  const seated = c.cell.find((x) => x.label === 'A × Seated vs. Current × Seated');
  assert.equal(L.inputText(two, two.measures[0], seated.key).deltaLabel,
    'For Seated, what\'s the smallest difference that would matter between A and Current?');
  assert.equal(L.inputText(two, two.measures[0], c.main[0].key).deltaLabel,
    'Averaged across all levels of Posture, what\'s the smallest difference that would matter between A and Current?');
});

test('step 3 readouts: variability from the engine, labeled your estimate or calculated', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  form.measures[0].unit = 'seconds';
  const est = L.variabilityReadout(form, form.measures[0], 'all');
  assert.equal(L.plainText(est.value), '≈ 12 s');
  assert.equal(est.value[0].tip, 'From your two answers: if the average difference is 10 seconds and 8 of 10 participants do better, ' +
    'the other 2 must do worse, which happens when individual differences vary by about 12 seconds (standard deviation). ' +
    'This is an estimate based on your answers, not a measurement.');
  form.design = 'between';
  assert.match(L.variabilityReadout(form, form.measures[0], 'all').value[0].tip,
    /^From your two answers: if the average difference is 10 seconds and the better condition wins 8 of 10 random pairs of participants, it loses the other 2, which happens when values vary by about 8\.4 seconds between participants/);
  form.design = 'within';
  assert.equal(est.note, 'Your estimate, not measured.');
  // Past data: σ_diff from the SD at Medium consistency, 15 × √(2 × 0.5) = 15.
  const sd = simpleForm('rating', { variability: 'sd', delta: '10', sd: '15' });
  assert.equal(L.variabilityReadout(sd, sd.measures[0], 'all').value, '≈ 15 points');
  // No target: no variability readout.
  const noTarget = simpleForm('time', { delta: '', k: '8' });
  assert.equal(L.variabilityReadout(noTarget, noTarget.measures[0], 'all'), null);
  const badK = simpleForm('time', { delta: '10', k: '5' });
  assert.equal(L.variabilityReadout(badK, badK.measures[0], 'all'), null);
  const adv = simpleForm('time', { delta: '10', k: '8' });
  assert.equal(L.plainText(L.advancedSummary(adv)), 'Power 0.80 · alpha 0.05 · +5% for rank-based test (conservative)');
  adv.factors[0].levels.push(L.newLevel('Other'));
  assert.equal(L.plainText(L.advancedSummary(adv)),
    "Power 0.80 · alpha 0.05, then each pair at 0.05 after a significant overall test (Fisher's protected LSD) · +5% for rank-based test (conservative)");
  adv.factors[0].levels.push(L.newLevel('Fourth'));
  assert.equal(L.plainText(L.advancedSummary(adv)),
    'Power 0.80 · alpha 0.05, adjusted to 0.00833 for 6 comparisons (Holm at analysis) · +5% for rank-based test (conservative)');
});

// ---------------------------------------------------------------------------
// Plan and confidence views beyond the running example
// ---------------------------------------------------------------------------

test('plan view: between subjects shows equal groups, not orders', () => {
  const form = simpleForm('time', { delta: '10', k: '8' }, (f) => { f.design = 'between'; });
  const plan = L.runPlan(form).plan;
  const view = L.planView(plan, form);
  assert.equal(view.orderPlan.within, false);
  assert.match(view.orderPlan.text, /^Random assignment to two equal groups: \d+ participants per condition\.$/);
  const range = L.sliderRange(plan);
  assert.equal(range.min, 4);
  assert.equal(range.step, 2);
});

test('confidence view: participants mode reports k of 10 and no precision', () => {
  const form = simpleForm('numeric', { mode: 'participants', k: '8' });
  const plan = L.runPlan(form).plan;
  const c = L.confidence(plan, 12, form);
  const v = L.confidenceView(c.report, c.curve);
  assert.equal(v.tiles.length, 2);
  assert.match(v.tiles[0].label, /^Smallest effect this study detects reliably: at least \d\.\d of 10 participants do better$/);
  assert.equal(v.tiles[1].label, 'Chance of detecting 8 of 10 doing better');
  assert.equal(v.precision, null);
  assert.equal(v.curve.axisTitle, 'Result your study finds: how many of 10 participants do better');
  assert.ok(v.curve.ticks.every((t) => / of 10$/.test(t.label)));
});

test('confidence view: success / failure in percentage points, with an unreachable detectable difference', () => {
  const form = simpleForm('binary', { p1: '70', p2: '85' });
  const plan = L.runPlan(form).plan;
  const low = L.confidenceView(...Object.values(L.confidence(plan, 12, form)).slice(0, 2));
  assert.equal(low.tiles[0].value, 'Not reachable');
  assert.equal(low.tiles[2].label, 'Chance of detecting your 15-point difference');
  const high = L.confidence(plan, 200, form);
  const v = L.confidenceView(high.report, high.curve);
  assert.match(v.tiles[0].value, /^\d+(\.\d)? points$/);
  assert.match(v.tiles[1].value, /^± \d+(\.\d)? points$/);
});

// ---------------------------------------------------------------------------
// Find problems
// ---------------------------------------------------------------------------

test('find problems: input checks in percent', () => {
  assert.equal(L.findView({ p: '', P: '80' }).issues[0].kind, 'missing');
  assert.equal(L.findView({ p: '150', P: '80' }).issues[0].message, 'Enter a percentage between 0 and 100.');
  assert.equal(L.findView({ p: '10', P: 'lots' }).issues[0].message, 'Enter a number.');
  assert.equal(L.findView({ p: '10', P: 'lots' }).issues[0].target, 'find-P');
});

test('find problems: one column when the frequency is 31%, and the axis grows with n', () => {
  const v = L.findView({ p: '31', P: '85' });
  assert.equal(v.n, 6);
  assert.deepEqual(v.table.columns, ['Affects 31% of users']);
  assert.equal(v.curve.showCommon, false);
  const rare = L.findView({ p: '2', P: '80' });
  assert.equal(rare.n, 80);
  assert.equal(rare.curve.axisMax, 80);
  assert.equal(rare.slider.max, 80);
});

test('analysis plan: one step for two conditions, protected LSD at three, Holm at four or more, selected comparisons for two variables', () => {
  const two = simpleForm('time', { delta: '10', k: '8' });
  const a2 = L.planView(L.runPlan(two).plan, two).analysis[0];
  assert.deepEqual(a2.steps.map(L.plainText), ['Wilcoxon signed-rank comparing Current and New, at alpha 0.05.']);

  const three = simpleForm('binary', { p1: '70', p2: '85' });
  three.factors[0].levels.push(L.newLevel('Other'));
  const a3 = L.planView(L.runPlan(three).plan, three).analysis[0];
  assert.deepEqual(a3.steps.map(L.plainText), [
    "Step 1: Cochran's Q test at 0.05.",
    "Step 2: if it's significant, McNemar for each pair at 0.05 (Fisher's protected LSD).",
  ]);
  // Test names that are not named after a person are lowercase mid-sentence.
  const rating = simpleForm('rating', { variability: 'sd', delta: '5', sd: '10' });
  rating.factors[0].levels.push(L.newLevel('Other'));
  assert.equal(L.plainText(L.planView(L.runPlan(rating).plan, rating).analysis[0].steps[1]),
    "Step 2: if it's significant, paired t-test for each pair at 0.05 (Fisher's protected LSD).");

  const four = simpleForm('binary', { p1: '70', p2: '85' });
  four.factors[0].levels.push(L.newLevel('Other'), L.newLevel('Fourth'));
  const a4 = L.planView(L.runPlan(four).plan, four).analysis[0];
  assert.deepEqual(a4.steps.map(L.plainText), [
    "Step 1: Cochran's Q test across all 4 conditions, to see whether they differ at all.",
    "Step 2: McNemar for each pair, with the Holm adjustment (6 comparisons). The sample size is planned with the stricter Bonferroni level, alpha 0.00833, so it's covered either way.",
  ]);

  const factorial = twoFactorForm();
  const c = L.candidateComparisons(factorial);
  factorial.comparisons.selected = [c.main[0].key, c.cell[0].key];
  c.main.slice(0, 1).concat(c.cell.slice(0, 1)).forEach((x) => Object.assign(L.inputsFor(factorial.measures[0], x.key), { mode: 'participants', k: '8' }));
  const af = L.planView(L.runPlan(factorial).plan, factorial).analysis[0];
  assert.equal(af.steps.length, 1);
  assert.equal(L.plainText(af.steps[0]), "Wilcoxon signed-rank for each selected comparison, with the Holm adjustment (2 comparisons). The sample size is planned with the stricter Bonferroni level, alpha 0.025, so it's covered either way.");
});

test('your measures: every measure at the target says so; a higher target moves the line', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  const view = L.planView(L.runPlan(form).plan, form);
  assert.equal(view.coverAll, 'Every measure reaches 80% at ' + view.participants + ' participants.');
  form.power = '0.9';
  const high = L.planView(L.runPlan(form).plan, form);
  assert.equal(high.targetPower, 0.9);
  assert.match(high.barsHeader, /\(line = 90%\)$/);
});

test('rounding note: none between subjects without a rank-based test', () => {
  const form = simpleForm('rating', { variability: 'sd', delta: '5', sd: '10' }, (f) => { f.design = 'between'; });
  const plan = L.runPlan(form).plan;
  assert.equal(L.roundingNote(plan, L.confidence(plan, plan.recommendedN, form).report), null);
});

test('success-rate engine errors are shown in percent, matching the inputs', () => {
  const form = simpleForm('binary', { p1: '60', p2: '80' });
  const m = form.measures[0];
  const placed = (fn) => {
    try {
      fn();
    } catch (err) {
      err.measure = m.name;
      return L.placeError(err, form, {});
    }
    throw new Error('expected an EngineError');
  };
  // Real engine messages, unchanged in the engine, converted for display.
  const range = placed(() => E.cohensH(1.5, 0.8));
  assert.equal(range.message, 'Success rate 1 must be between 0% and 100%, not 150%.');
  assert.equal(range.target, L.ids.input(m.id, 'all', 'p1'));
  const small = placed(() => E.nMcNemar(0.6, 0.8, 0.05, 0.8, 0.1));
  assert.equal(small.message, 'The share who differ between conditions (discordance) must be at least the difference in success rates (20%).');
  const large = placed(() => E.nMcNemar(0.6, 0.8, 0.05, 0.8, 0.7));
  assert.equal(large.message, 'With success rates of 60% and 80%, the share who differ between conditions (discordance) can be at most 60%.');
  assert.equal(placed(() => E.nTwoProportions(0.85, 0.85, 0.05, 0.8)).message, 'The two success rates must differ.');
  // Other fields keep the engine's message as it is.
  const k = L.runPlan(simpleForm('time', { delta: '10', k: '5' })).error;
  assert.match(k.message, /from 6 to 9, not 5\.$/);
  assert.equal(L.ratesInPercent('With success rates of 0.15 and 0.85'), 'With success rates of 15% and 85%');
});
