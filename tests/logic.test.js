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

test('buildStudy: one variable, every pair, always adjusted, and the inputs it passes on', () => {
  const form = simpleForm('rating', { mode: 'units', variability: 'sd', delta: '5', sd: '10', consistency: 'high' });
  form.factors[0].levels.push(L.newLevel('Other'));
  const b = L.buildStudy(form);
  assert.deepEqual(b.issues, []);
  assert.deepEqual(b.study.comparisons, { scheme: 'all-pairs' });
  assert.equal(b.study.adjust, undefined); // the engine always adjusts (methods.md §1.3)
  assert.equal(L.runPlan(form).plan.alphaPerComparison, 0.05 / 3);
  assert.deepEqual(b.study.factors, [{ name: 'Design', levels: ['Current', 'New', 'Other'] }]);
  assert.deepEqual(b.study.measures[0].effect, { mode: 'units', delta: 5, sd: 10, consistency: 'high' });
  assert.equal(b.study.alpha, 0.05);
  assert.equal(b.study.power, 0.8);
});

test('buildStudy: one variable needs no comparison choices; alpha is split across every pair', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  assert.equal(issueAt(L.buildStudy(form).issues, 'comparisons'), undefined);
  assert.equal(L.runPlan(form).plan.alphaPerComparison, 0.05);
  form.factors[0].levels.push(L.newLevel('Third'));
  const plan = L.runPlan(form).plan;
  assert.equal(plan.m, 3);
  assert.equal(plan.alphaPerComparison, 0.05 / 3);
});

test('buildStudy: between subjects, unlinked measures, presets and participants mode', () => {
  const between = simpleForm('time', { delta: '10', k: '8' }, (f) => { f.design = 'between'; });
  assert.equal(L.runPlan(between).plan.measures[0].method, 'Mann–Whitney');

  const unlinked = simpleForm('rating', { variability: 'sd', delta: '5', sd: '10' }, (f, m) => { m.linked = false; });
  const u = L.buildStudy(unlinked);
  assert.equal(u.study.measures[0].linked, false);
  assert.equal(u.study.measures[0].effect.consistency, undefined); // not paired: no consistency
  assert.equal(L.runPlan(unlinked).plan.measures[0].method, 'Independent t-test');

  const preset = L.presetMeasure('seq');
  assert.deepEqual([preset.name, preset.type, preset.unit, preset.scaleMin, preset.scaleMax], ['SEQ', 'rating', 'points', '1', '7']);

  const participants = simpleForm('numeric', { mode: 'participants', k: '8' });
  assert.deepEqual(L.buildStudy(participants).study.measures[0].effect, { mode: 'participants', k: 8 });
});

test('buildStudy: success / failure rates are percentages; ψ only within subjects', () => {
  const form = simpleForm('binary', { p1: '60', p2: '80', psi: '30' });
  assert.deepEqual(L.buildStudy(form).study.measures[0].effect, { p1: 0.6, p2: 0.8, psi: 0.3 });
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
  Object.assign(L.inputsFor(m, c.main[0].key), { delta: '5', variability: 'sdDiff', sdDiff: '10' });
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
  assert.equal(L.step1View(form).conditionsNote.startsWith('With 3 conditions'), true);
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

  const empty = simpleForm('time', { delta: '', k: '' });
  const e = L.buildStudy(empty).issues;
  assert.equal(issueAt(e, L.ids.input(empty.measures[0].id, 'all', 'delta')).kind, 'missing');
  assert.equal(issueAt(e, L.ids.input(empty.measures[0].id, 'all', 'k')).kind, 'missing');

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
    ['σ_diff not positive', simpleForm('rating', { variability: 'sdDiff', delta: '5', sdDiff: '0' }), 'sdDiff', /σ_diff/],
    ['equal rates', simpleForm('binary', { p1: '60', p2: '60' }), 'p2', /must differ/],
    ['ψ too small', simpleForm('binary', { p1: '60', p2: '80', psi: '10' }), 'psi', /discordance/],
    ['ψ too large', simpleForm('binary', { p1: '60', p2: '80', psi: '70' }), 'psi', /at most/],
    ['participants k', simpleForm('numeric', { mode: 'participants', k: '9.5' }), 'k', /whole number/],
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

test('runPlan: scale bound and expected average on a preset', () => {
  const form = simpleForm('time', { delta: '10', k: '8' }, (f, m) => {
    const seq = L.presetMeasure('seq');
    Object.assign(L.inputsFor(seq, 'all'), { variability: 'sd', delta: '1', sd: '3', mean: '6' });
    f.measures.push(seq);
  });
  const seq = form.measures[1];
  const r = L.runPlan(form);
  assert.equal(r.error.target, L.ids.input(seq.id, 'all', 'sd'));
  assert.match(r.error.message, /can be at most 2\.24/);
  seq.inputs.all.mean = '9';
  assert.equal(L.runPlan(form).error.target, L.ids.input(seq.id, 'all', 'mean'));
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
  assert.deepEqual(L.sidebarSummary(form, 3).measures.map((m) => m.value), ['–', 'check input']);
  form.measures[0].inputs.all.delta = '';
  form.measures[0].inputs.all.k = '';
  form.measures[1].inputs.all.k = '8';
  const ok = L.liveStatus(form);
  assert.equal(ok.error, null);
  const side = L.sidebarSummary(form, 3, ok);
  assert.equal(side.participants, '–');
  assert.equal(side.note, 'Needs inputs for the primary measure');
  assert.deepEqual(side.measures.map((m) => m.value), ['needs input', String(ok.partial.measures[0].total)]);
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

test('step 1 note: none for two conditions, every pair at three or more, or the selected ones', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  assert.equal(L.step1View(form).conditionsNote, null); // two conditions: no note
  form.factors[0].levels.push(L.newLevel('Other'));
  const v = L.step1View(form);
  assert.equal(v.conditions, 3);
  assert.equal(v.conditionsNote,
    'With 3 conditions, every pair is compared (3 comparisons), using a stricter test for each so the overall chance of a false result stays at 5%.');
  form.alpha = '0.1';
  assert.match(L.step1View(form).conditionsNote, /stays at 10%\.$/);

  const two = twoFactorForm();
  assert.equal(L.step1View(two).comparisonLine, 'No comparisons selected yet.');
  const c = L.candidateComparisons(two);
  two.comparisons.selected = [c.main[0].key];
  assert.equal(L.step1View(two).comparisonLine, '1 comparison selected.');
  two.comparisons.selected = [c.main[0].key, c.cell[0].key];
  assert.equal(L.step1View(two).comparisonLine,
    '2 comparisons selected, using a stricter test for each so the overall chance of a false result stays at 5%.');
  // Always adjusted: there is no adjustment question to answer.
  assert.equal(L.buildStudy(two).issues.some((i) => i.target === 'adjust'), false);
});

test('sidebar: notes and rows before inputs are complete', () => {
  const form = L.newForm();
  const s1 = L.sidebarSummary(form, 1);
  assert.equal(s1.participants, '–');
  assert.equal(s1.note, 'Updates as you fill in each step');
  assert.deepEqual(s1.rows.map((r) => r.value), ['Not set', '2', '1', 'Not set']);
  const s2 = L.sidebarSummary(simpleForm('time', { delta: '', k: '' }), 2);
  assert.equal(s2.note, 'Needs inputs (step 3)');
  assert.deepEqual(s2.rows.map((r) => r.value), ['Within subjects', '2', '1', '1 (primary: Score)']);
  const bad = L.sidebarSummary(simpleForm('time', { delta: '10', k: '5' }), 3);
  assert.equal(bad.participants, '–');
  assert.equal(bad.note, 'Check the highlighted input');
  assert.equal(bad.measures[0].value, 'check input');
});

test('step 3 wording follows the design and the comparison', () => {
  const form = simpleForm('time', { delta: '10', k: '8' });
  form.factors[0].name = 'Keyboard design';
  form.measures[0].unit = 'seconds';
  const t = L.inputText(form, form.measures[0], 'all');
  assert.equal(t.kQuestion, 'At a 10-second difference, how many of 10 participants would be faster on the better condition?');
  assert.equal(t.modeUnits, 'In seconds');
  assert.equal(t.participantsQuestion, 'How many of 10 participants should do better on the better condition?');
  assert.equal(t.sdLabel, 'How much do values vary between participants? (standard deviation)');
  form.design = 'between';
  assert.equal(L.inputText(form, form.measures[0], 'all').kQuestion,
    'At a 10-second difference, pick one participant from each condition at random. Out of 10 such pairs, how often would the one on the better condition be faster?');
  // Success / failure: two conditions are named; three or more are described.
  const rates = simpleForm('binary', { p1: '', p2: '' });
  assert.equal(L.inputText(rates, rates.measures[0], 'all').p1Label, 'Expected success rate on Current');
  assert.equal(L.inputText(rates, rates.measures[0], 'all').p2Label, 'Expected success rate on New');
  rates.factors[0].levels.push(L.newLevel('Other'));
  assert.equal(L.inputText(rates, rates.measures[0], 'all').p2Label, 'Expected success rate on the condition you expect to do better');

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
  assert.equal(est.value, '≈ 12 s');
  assert.equal(est.note, 'Your estimate, not measured.');
  const sd = simpleForm('rating', { variability: 'sd', delta: '10', sd: '15', consistency: 'medium' });
  assert.equal(L.variabilityReadout(sd, sd.measures[0], 'all').value, '≈ 15 points');
  const badK = simpleForm('time', { delta: '10', k: '5' });
  assert.equal(L.variabilityReadout(badK, badK.measures[0], 'all'), null);
  const adv = simpleForm('time', { delta: '10', k: '8' });
  assert.equal(L.advancedSummary(adv), 'Power 0.80 · alpha 0.05 · +5% for rank-based test (conservative)');
  adv.factors[0].levels.push(L.newLevel('Other'));
  assert.equal(L.advancedSummary(adv), 'Power 0.80 · alpha 0.05, adjusted to 0.0167 for 3 comparisons · +5% for rank-based test (conservative)');
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
