/*
 * Study planner interface logic.
 *
 * Plain functions with no DOM access: they turn form state into engine calls
 * and engine results into display text. All numbers come from engine.js; this
 * file only parses inputs, picks engine functions, and formats what they
 * return. Works as a browser script (exposes globalThis.StudyLogic) and as a
 * Node module.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.StudyLogic = factory(root.StudyEngine);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Fixed text (design/README.md)
  // ---------------------------------------------------------------------------

  const TEXT = {
    interactionDisabled: 'Interaction comparisons come in a later version.',
    mainEffectBinaryDisabled: 'For success/failure measures, only comparisons between specific conditions are supported in this version.',
  };

  const TYPE_LABELS = {
    time: 'Time',
    binary: 'Success / failure',
    count: 'Count',
    rating: 'Rating scale',
    numeric: 'Other numeric',
  };
  const TYPE_ORDER = ['time', 'binary', 'count', 'rating', 'numeric'];
  const TYPE_HELP = {
    time: 'Time: usually right-skewed, so the plan uses a rank-based test.',
    binary: 'Success / failure: each participant succeeds or fails, so the plan compares success rates.',
    count: 'Count: usually right-skewed, so the plan uses a rank-based test.',
    rating: 'Rating scale: the plan uses a t-test.',
    numeric: 'Other numeric: the plan uses a t-test.',
  };

  // Presets (methods.md §2). Scale and type come from the engine.
  const PRESET_DISPLAY = {
    'nasa-tlx': { name: 'NASA-TLX', unit: 'points', note: 'Rating scale, 0 to 100 (raw TLX)' },
    sus: { name: 'SUS', unit: 'points', note: 'Rating scale, 0 to 100' },
    seq: { name: 'SEQ', unit: 'points', note: 'Rating scale, 1 to 7' },
  };

  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------

  let nextId = 1;
  // Short unique ids for form items.
  function uid(prefix) {
    nextId += 1;
    return `${prefix}${nextId}`;
  }

  // One empty set of inputs for a measure and comparison.
  function emptyInputs() {
    return {
      mode: 'units', variability: 'estimate', delta: '', k: '', sd: '', consistency: 'low',
      sdDiff: '', mean: '', p1: '', p2: '', psi: '',
    };
  }

  function newLevel(name) {
    return { id: uid('l'), name: name || '' };
  }

  // Default name for the condition at a position: "Condition A", "Condition B", ...
  // Past Z it falls back to numbers ("Condition 27").
  function conditionName(index) {
    return `Condition ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;
  }

  // A new independent variable: unnamed, with two conditions the user can rename.
  function newFactor() {
    return { id: uid('f'), name: '', levels: [newLevel(conditionName(0)), newLevel(conditionName(1))] };
  }

  // The next condition for a variable, continuing the letters.
  function nextLevel(factor) {
    return newLevel(conditionName(factor.levels.length));
  }

  function newMeasure(primary) {
    return {
      id: uid('m'), name: '', unit: '', type: null, primary: !!primary, linked: true,
      preset: null, scaleMin: '', scaleMax: '', inputs: {},
    };
  }

  // A preset measure (methods.md §2 presets).
  function presetMeasure(key) {
    const p = E.PRESETS[key];
    const d = PRESET_DISPLAY[key];
    const m = newMeasure(false);
    m.name = d.name;
    m.unit = d.unit;
    m.type = p.type;
    m.preset = key;
    m.scaleMin = String(p.min);
    m.scaleMax = String(p.max);
    return m;
  }

  function newForm() {
    return {
      design: null,
      factors: [newFactor()],
      comparisons: { selected: [] },
      alpha: '0.05',
      power: '0.80',
      measures: [newMeasure(true)],
    };
  }

  function newFindForm() {
    return { p: '', P: '', participants: null };
  }

  // Inputs for one measure and comparison key, created on first use.
  function inputsFor(measure, key) {
    if (!measure.inputs[key]) measure.inputs[key] = emptyInputs();
    return measure.inputs[key];
  }

  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------

  // Parse a typed number. Accepts a comma as the decimal mark.
  // Returns { empty } or { value } or { invalid }.
  function parseNumber(text) {
    const s = String(text === undefined || text === null ? '' : text).trim();
    if (s === '') return { empty: true };
    const normalized = /^-?\d+,\d+$/.test(s) ? s.replace(',', '.') : s;
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return { invalid: true };
    return { value: Number(normalized) };
  }

  // Field ids shared by logic and the interface (also used as DOM ids).
  const ids = {
    design: () => 'design',
    factors: () => 'factors',
    factorName: (f) => `factor-${f}-name`,
    factorLevels: (f) => `factor-${f}-levels`,
    level: (l) => `level-${l}`,
    comparisons: () => 'comparisons',
    measures: () => 'measures',
    measureName: (m) => `measure-${m}-name`,
    measureType: (m) => `measure-${m}-type`,
    measureScale: (m) => `measure-${m}-scale`,
    measureInputs: (m) => `measure-${m}-inputs`,
    input: (m, k, field) => `input-${m}-${k}-${field}`,
    alpha: () => 'alpha',
    power: () => 'power',
    participants: () => 'participants',
    findP: () => 'find-p',
    findBigP: () => 'find-P',
  };

  // ---------------------------------------------------------------------------
  // Study structure: conditions and comparisons (methods.md §1)
  // ---------------------------------------------------------------------------

  const trimmed = (s) => String(s || '').trim();

  // Engine-shaped factors from the form. Unnamed single factors get a name.
  function engineFactors(form) {
    return form.factors.map((f, i) => ({
      name: trimmed(f.name) || (form.factors.length === 1 ? 'Conditions' : `Independent variable ${i + 1}`),
      levels: f.levels.map((l) => trimmed(l.name)),
    }));
  }

  // Number of conditions (every combination of levels), from the engine.
  function conditionCount(form) {
    const shapes = form.factors.map((f) => ({ name: f.id, levels: f.levels.map((l) => l.id) }));
    try {
      return E.buildCells(shapes).length;
    } catch (err) {
      return null;
    }
  }

  // Candidate comparisons for two or more independent variables (methods.md §1.5).
  // Each has a form key, an engine id (readable, used in the trail) and its parts.
  function candidateComparisons(form) {
    if (form.factors.length < 2) return { main: [], cell: [] };
    const factors = engineFactors(form);
    const main = [];
    form.factors.forEach((f, fi) => {
      const others = factors.filter((x, i) => i !== fi).map((x) => x.name).join(' and ');
      for (let i = 0; i < f.levels.length; i++) {
        for (let j = i + 1; j < f.levels.length; j++) {
          const a = factors[fi].levels[j];
          const b = factors[fi].levels[i];
          main.push({
            key: `main:${f.id}:${f.levels[j].id}:${f.levels[i].id}`,
            type: 'main',
            factor: factors[fi].name,
            factorId: f.id,
            a, b, others,
            label: `${a || '?'} vs. ${b || '?'}, averaged across ${others}`,
          });
        }
      }
    });
    const idCells = E.buildCells(form.factors.map((f) => ({ name: f.id, levels: f.levels.map((l) => l.id) })));
    const nameOf = (cellIds) => cellIds.map((lid) => {
      for (const f of form.factors) {
        const l = f.levels.find((x) => x.id === lid);
        if (l) return trimmed(l.name) || '?';
      }
      return '?';
    });
    const cell = [];
    for (let i = 0; i < idCells.length; i++) {
      for (let j = i + 1; j < idCells.length; j++) {
        const a = nameOf(idCells[j]);
        const b = nameOf(idCells[i]);
        const shared = a.filter((x, n) => x === b[n]);
        cell.push({
          key: `cell:${idCells[j].join('.')}:${idCells[i].join('.')}`,
          type: 'cell', a, b, shared,
          label: `${a.join(' × ')} vs. ${b.join(' × ')}`,
        });
      }
    }
    return { main, cell };
  }

  // Selected comparisons in engine form, with the form key for each id.
  function selectedComparisons(form) {
    const c = candidateComparisons(form);
    const all = c.main.concat(c.cell);
    return form.comparisons.selected
      .map((key) => all.find((x) => x.key === key))
      .filter(Boolean);
  }

  // Number of comparisons (methods.md §1.2): every pair for one variable,
  // the selected ones for two or more.
  function comparisonCount(form) {
    if (form.factors.length >= 2) return form.comparisons.selected.length || null;
    try {
      return E.countComparisons(form.factors[0].levels.length, 'all-pairs');
    } catch (err) {
      return null;
    }
  }

  function anyBinary(form) {
    return form.measures.some((m) => m.type === 'binary');
  }

  function anyMainSelected(form) {
    return form.factors.length >= 2 && form.comparisons.selected.some((k) => k.startsWith('main:'));
  }

  // Disabled options and their explanations (design/README.md).
  function mainEffectsDisabled(form) {
    return anyBinary(form) ? TEXT.mainEffectBinaryDisabled : null;
  }

  function binaryTypeDisabled(form) {
    return anyMainSelected(form) ? TEXT.mainEffectBinaryDisabled : null;
  }

  // Keys of the input sets a measure needs: one shared set for one variable,
  // one per selected comparison for two or more (methods.md §1.5).
  function inputKeys(form) {
    if (form.factors.length < 2) return ['all'];
    return form.comparisons.selected.slice();
  }

  // ---------------------------------------------------------------------------
  // Form → study (the object plan() takes)
  // ---------------------------------------------------------------------------

  // Issue: { step, target, message, kind: 'missing' | 'invalid' | 'engine', measureId?, key? }
  function issue(step, target, message, kind, extra) {
    return Object.assign({ step, target, message, kind }, extra);
  }

  // Step 1 issues and the study's structure.
  function studyStructure(form) {
    // Checked in the order the page shows them, so focus goes to the first problem.
    const issues = [];
    const factorNames = new Set();
    form.factors.forEach((f) => {
      const name = trimmed(f.name);
      if (form.factors.length > 1) {
        if (!name) issues.push(issue(1, ids.factorName(f.id), 'Name this independent variable.', 'missing'));
        else if (factorNames.has(name.toLowerCase())) {
          issues.push(issue(1, ids.factorName(f.id), 'Each independent variable needs its own name.', 'invalid'));
        }
        factorNames.add(name.toLowerCase());
      }
      f.levels.forEach((l) => {
        if (!trimmed(l.name)) issues.push(issue(1, ids.level(l.id), 'Name this condition.', 'missing'));
      });
    });
    // Duplicate or missing conditions: the engine's own check (methods.md §1.1).
    if (!issues.some((i) => i.target.startsWith('level-') || i.target.startsWith('factor-'))) {
      try {
        E.buildCells(engineFactors(form));
      } catch (err) {
        if (!(err instanceof E.EngineError)) throw err;
        issues.push(placeError(err, form, {}));
      }
    }
    if (!form.design) issues.push(issue(1, ids.design(), 'Choose what each participant experiences.', 'missing'));
    let comparisons = null;
    const byId = {};
    if (form.factors.length < 2) {
      // One variable: every pair is compared (methods.md §1.2).
      comparisons = { scheme: 'all-pairs' };
    } else {
      const chosen = selectedComparisons(form);
      if (chosen.length === 0) {
        issues.push(issue(1, ids.comparisons(), 'Choose at least one comparison.', 'missing'));
      } else {
        const used = new Set();
        const list = chosen.map((c) => {
          let id = c.label;
          for (let n = 2; used.has(id); n++) id = `${c.label} (${n})`;
          used.add(id);
          byId[id] = c.key;
          return c.type === 'main'
            ? { id, type: 'main', factor: c.factor, a: c.a, b: c.b }
            : { id, type: 'cell', a: c.a, b: c.b };
        });
        comparisons = { list };
      }
    }
    return { issues, comparisons, comparisonKeyById: byId };
  }

  // Step 2 issues for one measure.
  function measureSetupIssues(form, measure) {
    const issues = [];
    const name = trimmed(measure.name);
    if (!name) issues.push(issue(2, ids.measureName(measure.id), 'Name this measure.', 'missing', { measureId: measure.id }));
    else if (form.measures.some((x) => x !== measure && trimmed(x.name).toLowerCase() === name.toLowerCase())) {
      issues.push(issue(2, ids.measureName(measure.id), 'Each measure needs its own name.', 'invalid', { measureId: measure.id }));
    }
    if (!measure.type) issues.push(issue(2, ids.measureType(measure.id), 'Choose a result type.', 'missing', { measureId: measure.id }));
    if (measure.type === 'rating') {
      const lo = parseNumber(measure.scaleMin);
      const hi = parseNumber(measure.scaleMax);
      if (lo.invalid || hi.invalid) {
        issues.push(issue(2, ids.measureScale(measure.id), 'Enter the scale ends as numbers.', 'invalid', { measureId: measure.id }));
      } else if (lo.empty !== hi.empty) {
        issues.push(issue(2, ids.measureScale(measure.id), 'Enter both ends of the scale, or leave both blank.', 'missing', { measureId: measure.id }));
      }
    }
    return issues;
  }

  // Parse one number field; push an issue if it is required and empty or not a number.
  function numberField(issues, raw, target, opts) {
    const r = parseNumber(raw);
    const extra = { measureId: opts.measureId, key: opts.key };
    if (r.empty) {
      if (opts.required) issues.push(issue(3, target, opts.missing || 'Enter a value.', 'missing', extra));
      return undefined;
    }
    if (r.invalid) {
      issues.push(issue(3, target, 'Enter a number.', 'invalid', extra));
      return undefined;
    }
    if (opts.percent) {
      if (!(r.value > 0 && r.value < 100)) {
        issues.push(issue(3, target, 'Enter a percentage between 0 and 100.', 'invalid', extra));
        return undefined;
      }
      return r.value / 100;
    }
    return r.value;
  }

  // Step 3: engine input for one measure and comparison key (methods.md §3).
  function effectInput(form, measure, key, issues) {
    const inp = inputsFor(measure, key);
    const t = (field) => ids.input(measure.id, key, field);
    const o = (required, extra) => Object.assign({ measureId: measure.id, key, required }, extra);
    if (measure.type === 'binary') {
      const p1 = numberField(issues, inp.p1, t('p1'), o(true, { percent: true, missing: 'Enter the expected success rate.' }));
      const p2 = numberField(issues, inp.p2, t('p2'), o(true, { percent: true, missing: 'Enter the expected success rate.' }));
      const psi = form.design === 'within' && measure.linked
        ? numberField(issues, inp.psi, t('psi'), o(false, { percent: true }))
        : undefined;
      const out = { p1, p2 };
      if (psi !== undefined) out.psi = psi;
      return out;
    }
    if (inp.mode === 'participants') {
      return { mode: 'participants', k: numberField(issues, inp.k, t('k'), o(true, { missing: 'Enter a number from 6 to 9.' })) };
    }
    const out = { mode: 'units' };
    out.delta = numberField(issues, inp.delta, t('delta'), o(true, { missing: 'Enter the smallest difference that would matter.' }));
    const paired = form.design === 'within' && measure.linked;
    if (inp.variability === 'estimate') {
      out.k = numberField(issues, inp.k, t('k'), o(true, { missing: 'Enter a number from 6 to 9.' }));
    } else if (inp.variability === 'sdDiff' && paired) {
      out.sdDiff = numberField(issues, inp.sdDiff, t('sdDiff'), o(true, { missing: 'Enter the standard deviation of the differences.' }));
    } else {
      out.sd = numberField(issues, inp.sd, t('sd'), o(true, { missing: 'Enter the standard deviation.' }));
      if (paired) out.consistency = inp.consistency || 'low';
      if (scaleOf(measure)) {
        const mean = numberField(issues, inp.mean, t('mean'), o(false));
        if (mean !== undefined) out.mean = mean;
      }
    }
    return out;
  }

  // Scale for a rating measure, when both ends are given.
  function scaleOf(measure) {
    if (measure.type !== 'rating') return null;
    const lo = parseNumber(measure.scaleMin);
    const hi = parseNumber(measure.scaleMax);
    if (lo.value === undefined || hi.value === undefined) return null;
    return { min: lo.value, max: hi.value };
  }

  /**
   * Build the study object for plan() from the form.
   * opts.onlyComplete: leave out measures with missing or invalid inputs
   * (the live check while the form is being filled in). If the primary is
   * among those left out, the first complete measure stands in as primary so
   * the others can still be checked; standIn is then true.
   * Returns { study, issues, complete: {id: bool}, comparisonKeyById, standIn }.
   * study is null when step 1, step 2 or the study-level inputs still have
   * issues, when (by default) any measure is incomplete, or (onlyComplete)
   * when no measure is complete.
   */
  function buildStudy(form, opts) {
    const onlyComplete = !!(opts && opts.onlyComplete);
    const structure = studyStructure(form);
    const issues = structure.issues.slice();
    const complete = {};
    const engineMeasures = [];
    const keys = inputKeys(form);
    const measureIssues = [];

    form.measures.forEach((measure) => {
      const own = measureSetupIssues(form, measure);
      if (own.length === 0 && structure.comparisons) {
        const effects = {};
        keys.forEach((key) => {
          effects[key] = effectInput(form, measure, key, own);
        });
        const e = {
          name: trimmed(measure.name),
          type: measure.type,
          unit: trimmed(measure.unit),
          primary: measure.primary,
          linked: measure.linked,
        };
        const scale = scaleOf(measure);
        if (scale) e.scale = scale;
        if (keys.length === 1 && keys[0] === 'all') e.effect = effects.all;
        else {
          const byComparison = {};
          Object.keys(structure.comparisonKeyById).forEach((id) => {
            byComparison[id] = effects[structure.comparisonKeyById[id]];
          });
          e.effect = { byComparison };
        }
        if (own.length === 0) engineMeasures.push(e);
      }
      complete[measure.id] = own.length === 0 && !!structure.comparisons;
      measureIssues.push(...own);
    });
    issues.push(...measureIssues);

    const alpha = parseNumber(form.alpha);
    const power = parseNumber(form.power);
    if (alpha.empty) issues.push(issue(3, ids.alpha(), 'Enter the false-alarm risk (alpha), for example 0.05.', 'missing'));
    else if (alpha.invalid) issues.push(issue(3, ids.alpha(), 'Enter a number.', 'invalid'));
    if (power.empty) issues.push(issue(3, ids.power(), 'Enter the power, for example 0.80.', 'missing'));
    else if (power.invalid) issues.push(issue(3, ids.power(), 'Enter a number.', 'invalid'));
    const studyLevelOk = structure.issues.length === 0 && alpha.value !== undefined && power.value !== undefined;

    const primary = form.measures.find((m) => m.primary);
    let study = null;
    let standIn = false;
    const allComplete = form.measures.every((m) => complete[m.id]);
    if (studyLevelOk && (onlyComplete ? engineMeasures.length > 0 : allComplete)) {
      let measures = engineMeasures;
      if (onlyComplete && !(primary && complete[primary.id])) {
        standIn = true;
        measures = engineMeasures.map((x, i) => Object.assign({}, x, { primary: i === 0 }));
      }
      study = {
        design: form.design,
        factors: engineFactors(form),
        comparisons: structure.comparisons,
        alpha: alpha.value,
        power: power.value,
        measures,
      };
    }
    return { study, issues, complete, comparisonKeyById: structure.comparisonKeyById, standIn };
  }

  // ---------------------------------------------------------------------------
  // Engine errors → the input that caused them
  // ---------------------------------------------------------------------------

  const INPUT_FIELDS = ['delta', 'k', 'sd', 'sdDiff', 'mean', 'consistency', 'p1', 'p2', 'psi', 'mode', 'effect'];

  /**
   * Place an EngineError next to the input that caused it, by its field,
   * measure, comparison and factor. Returns an issue.
   */
  function placeError(err, form, comparisonKeyById) {
    const measure = err.measure ? form.measures.find((m) => trimmed(m.name) === err.measure) : null;
    const extra = measure ? { measureId: measure.id } : {};
    const keyOf = () => {
      if (form.factors.length < 2) return 'all';
      return (err.comparison && comparisonKeyById && comparisonKeyById[err.comparison]) || form.comparisons.selected[0];
    };
    const kind = 'engine';
    const f = err.field;
    if (f === 'levels' || f === 'factors') {
      const names = engineFactors(form).map((x) => x.name);
      const idx = names.indexOf(err.factor);
      const target = idx >= 0 ? ids.factorLevels(form.factors[idx].id) : ids.factors();
      return issue(1, target, err.message, kind);
    }
    if (f === 'design') return issue(1, ids.design(), err.message, kind);
    if (f === 'comparisons' && !measure) return issue(1, ids.comparisons(), err.message, kind);
    if (f === 'measures' || f === 'primary') return issue(2, ids.measures(), err.message, kind);
    if (f === 'type' && measure) return issue(2, ids.measureType(measure.id), err.message, kind, extra);
    if (f === 'scale' && measure) return issue(2, ids.measureScale(measure.id), err.message, kind, extra);
    if (f === 'alpha') return issue(3, ids.alpha(), err.message, kind);
    if (f === 'power') return issue(3, ids.power(), err.message, kind);
    if (f === 'participants') return issue(4, ids.participants(), err.message, kind, extra);
    if (measure && INPUT_FIELDS.includes(f)) {
      const key = keyOf();
      const inp = inputsFor(measure, key);
      // σ_diff is entered directly only in that mode; otherwise the SD field caused it.
      const field = f === 'effect' ? (measure.type === 'binary' ? 'p1' : 'delta')
        : f === 'mode' ? 'delta'
          : f === 'consistency' && inp.variability !== 'sd' ? 'sd' : f;
      return issue(3, ids.input(measure.id, key, field), err.message, kind, Object.assign({ key }, extra));
    }
    if (measure) return issue(3, ids.measureInputs(measure.id), err.message, kind, extra);
    return issue(3, 'general', err.message, kind);
  }

  /**
   * One plan() call for the whole study. Returns { plan, issues, error }.
   * plan is null until every input is complete and the engine accepts it.
   */
  function runPlan(form) {
    const built = buildStudy(form);
    if (!built.study) return { plan: null, issues: built.issues, error: null };
    try {
      return { plan: E.plan(built.study), issues: built.issues, error: null };
    } catch (err) {
      if (!(err instanceof E.EngineError)) throw err;
      const placed = placeError(err, form, built.comparisonKeyById);
      return { plan: null, issues: built.issues.concat([placed]), error: placed };
    }
  }

  /**
   * Live state while the form is filled in, with one plan() call: the whole
   * study once every measure is complete, otherwise the complete measures.
   * Returns { plan (whole study, or null), partial (the plan that ran, or
   * null), standIn, issues, error }. issues includes any placed engine error.
   */
  function liveStatus(form) {
    const full = buildStudy(form);
    const built = full.study ? full : buildStudy(form, { onlyComplete: true });
    const out = { plan: null, partial: null, standIn: !!built.standIn, issues: full.issues, error: null, complete: full.complete };
    if (!built.study) return out;
    try {
      const plan = E.plan(built.study);
      out.partial = plan;
      if (full.study) out.plan = plan;
    } catch (err) {
      if (!(err instanceof E.EngineError)) throw err;
      out.error = placeError(err, form, built.comparisonKeyById);
      out.issues = full.issues.concat([out.error]);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Number formatting (display only)
  // ---------------------------------------------------------------------------

  // x to sig significant figures, without exponent notation.
  function fmtSig(x, sig) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '–';
    if (x === 0) return '0';
    const v = Number(x.toPrecision(sig));
    return String(v);
  }

  // Probability as a whole percentage, "over 99%" and "under 1%" at the extremes.
  function fmtPercent(p) {
    if (p === null || p === undefined || !Number.isFinite(p)) return '–';
    if (p >= 0.995) return 'over 99%';
    if (p < 0.005) return 'under 1%';
    return `${Math.round(p * 100)}%`;
  }

  // Fraction for formulas: at least 2 decimals, up to 4 ("0.90", "0.975").
  function fmtFraction(x) {
    const s = x.toFixed(4).replace(/0+$/, '');
    const dec = s.split('.')[1] || '';
    return dec.length >= 2 ? s : x.toFixed(2);
  }

  const SHORT_UNITS = {
    second: 's', seconds: 's', sec: 's', secs: 's', s: 's',
    millisecond: 'ms', milliseconds: 'ms', ms: 'ms',
    minute: 'min', minutes: 'min', min: 'min', mins: 'min',
    hour: 'h', hours: 'h', h: 'h',
  };
  const TIME_SINGULAR = {
    second: 'second', seconds: 'second', sec: 'second', secs: 'second', s: 'second',
    millisecond: 'millisecond', milliseconds: 'millisecond', ms: 'millisecond',
    minute: 'minute', minutes: 'minute', min: 'minute', mins: 'minute',
    hour: 'hour', hours: 'hour', h: 'hour',
  };

  function shortUnit(unit) {
    const u = trimmed(unit);
    return SHORT_UNITS[u.toLowerCase()] || u;
  }

  // "12 s", "± 7.5 s", "15 points": value with the short unit.
  function fmtUnits(x, unit, sig) {
    const n = fmtSig(x, sig || 2);
    const u = shortUnit(unit);
    return u ? `${n} ${u}` : n;
  }

  // "10-second" for time units; null otherwise.
  function timeAdjective(x, unit) {
    const s = TIME_SINGULAR[trimmed(unit).toLowerCase()];
    return s ? `${fmtSig(x, 3)}-${s}` : null;
  }

  // "your 10-second target" / "your target of 10 points".
  function targetPhrase(x, unit) {
    const adj = timeAdjective(x, unit);
    if (adj) return `your ${adj} target`;
    const u = trimmed(unit);
    return u ? `your target of ${fmtSig(x, 3)} ${u}` : `your target of ${fmtSig(x, 3)}`;
  }

  // x with as many decimals as the reference text has ("± 7.5" → 2.45 becomes "2.5").
  function fmtLike(x, refText) {
    const dec = (String(refText).split('.')[1] || '').length;
    return String(Number(x.toFixed(dec)));
  }

  function fmtAlpha(a) {
    return fmtSig(a, 3);
  }

  function fmtPower(p) {
    return p.toFixed(2);
  }

  function numberWord(n) {
    return n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
  }

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------------------------------------------------------------------
  // Rich text: arrays of strings and alpha tokens { alpha, tip }. The interface
  // renders a token as a focusable value with a tooltip (on hover and on focus).
  // ---------------------------------------------------------------------------

  /**
   * The per-comparison alpha as display text, with its explanation (methods.md
   * §1.3). Returns a token { alpha, tip } for protected LSD and Bonferroni-Holm,
   * or plain text for a single comparison.
   */
  function alphaToken(procedure, alpha, alphaEach, k, m, factorCount) {
    const each = fmtAlpha(alphaEach);
    if (procedure === 'protected-lsd') {
      return {
        alpha: each,
        tip: `With exactly three conditions, the overall test protects the comparisons, so each uses the usual ${fmtAlpha(alpha)} (Fisher's protected LSD).`,
      };
    }
    if (procedure === 'bonferroni-holm') {
      const lead = factorCount === 1 ? `${k} conditions = ${m} pairs.` : `${m} comparisons.`;
      return {
        alpha: each,
        tip: `${lead} ${fmtAlpha(alpha)} ÷ ${m} = ${each} per comparison, so the overall chance of a false result stays at ${fmtPercent(alpha)}. ` +
          `At analysis, the Holm adjustment is less strict: only the first comparison faces ${each}.`,
      };
    }
    return each;
  }

  // Rich text to plain text (tests, aria labels, the live region).
  function plainText(parts) {
    if (typeof parts === 'string') return parts;
    if (!Array.isArray(parts)) return parts.alpha;
    return parts.map(plainText).join('');
  }

  // Procedure and alpha token for the form as it stands (before a plan exists).
  function formComparisons(form) {
    const k = conditionCount(form);
    const m = comparisonCount(form);
    if (!k || !m) return null;
    let alpha = parseNumber(form.alpha).value;
    if (!(alpha > 0 && alpha < 1)) alpha = 0.05; // shown with the default until alpha is fixed
    const mc = E.multipleComparisons(alpha, k, m, form.factors.length);
    return Object.assign({ k, m, alpha, token: alphaToken(mc.procedure, alpha, mc.alphaPerComparison, k, m, form.factors.length) }, mc);
  }

  // Alpha token for a plan() result.
  function planAlphaToken(plan) {
    return alphaToken(plan.procedure, plan.alpha, plan.alphaPerComparison, plan.k, plan.m, plan.factorCount);
  }

  // ---------------------------------------------------------------------------
  // Step 1 view: option text
  // ---------------------------------------------------------------------------

  // Which comparisons are made and how false results are controlled
  // (methods.md §1.2, §1.3). Rich text, updated as conditions change.
  function step1View(form) {
    const k = conditionCount(form);
    const m = comparisonCount(form);
    const mc = formComparisons(form);
    let conditionsNote = null;
    let comparisonLine = null;
    if (form.factors.length < 2) {
      // One variable: no note at two conditions.
      if (mc && mc.procedure === 'protected-lsd') {
        conditionsNote = [`With 3 conditions, every pair is compared. Run the overall test first; if it's significant, compare each pair at the usual `,
          mc.token, " (Fisher's protected LSD)."];
      } else if (mc && mc.procedure === 'bonferroni-holm') {
        conditionsNote = [`With ${k} conditions, every pair is compared (${m} comparisons). Fisher's protected LSD only keeps false results at ${fmtPercent(mc.alpha)} ` +
          'with up to three conditions, so each comparison now uses a stricter test (alpha ', mc.token, ' for planning, Holm adjustment at analysis).'];
      }
    } else if (!m) {
      comparisonLine = 'No comparisons selected yet.';
    } else if (m === 1) {
      comparisonLine = '1 comparison selected.';
    } else {
      comparisonLine = [`${m} comparisons selected. Each uses a stricter test (alpha `, mc.token,
        ` for planning, Holm adjustment at analysis), so the overall chance of a false result stays at ${fmtPercent(mc.alpha)}.`];
    }
    const candidates = candidateComparisons(form);
    return {
      conditions: k,
      single: form.factors.length < 2,
      conditionsNote,
      comparisonLine,
      candidates,
      mainDisabled: mainEffectsDisabled(form),
      interactionDisabled: TEXT.interactionDisabled,
      comparisonCount: m,
    };
  }

  // ---------------------------------------------------------------------------
  // Sidebar: "Your plan so far" (one plan() call on the complete measures)
  // ---------------------------------------------------------------------------

  function sidebarSummary(form, step, live) {
    const status = live || liveStatus(form);
    const k = conditionCount(form);
    const m = comparisonCount(form);
    const primary = form.measures.find((x) => x.primary);
    const named = form.measures.filter((x) => trimmed(x.name));
    const rows = [
      { label: 'Design', value: form.design === 'within' ? 'Within subjects' : form.design === 'between' ? 'Between subjects' : 'Not set' },
      { label: 'Conditions', value: k === null ? 'Not set' : String(k) },
      {
        label: 'Comparisons',
        value: m === null ? 'Not set'
          : form.factors.length >= 2 ? `${m} selected`
            : m === 1 ? '1' : `${m} (every pair)`,
      },
      {
        label: 'Measures',
        value: named.length === 0 ? 'Not set'
          : `${named.length}${primary && trimmed(primary.name) ? ` (primary: ${trimmed(primary.name)})` : ''}`,
      },
    ];

    const plan = status.partial;
    const failed = !!status.error;
    const measures = form.measures.map((fm) => {
      const r = plan && plan.measures.find((x) => x.name === trimmed(fm.name));
      const errored = failed && status.error.measureId === fm.id;
      return {
        id: fm.id,
        name: trimmed(fm.name) || 'Unnamed measure',
        primary: fm.primary,
        value: r ? String(r.total)
          : errored || (failed && !status.error.measureId) ? 'fix the input'
            : failed && status.complete && status.complete[fm.id] ? '–' : 'not filled in yet',
        ready: !!r,
      };
    });
    const ready = plan && !status.standIn;
    let note;
    const primaryName = primary && trimmed(primary.name) ? primary.name.trim() : 'your primary measure';
    if (ready) note = `Set by ${plan.primary}, your primary measure. Updates as you type.`;
    else if (failed) note = 'Fix the highlighted input to see it.';
    else if (plan && status.standIn) note = `Fill in ${primaryName} (primary) in step 3 to see it.`;
    else note = 'Calculated in step 3, once you describe the difference that matters.';
    return {
      participants: ready ? String(plan.recommendedN) : '–',
      recommendedN: ready ? plan.recommendedN : null,
      note,
      rows,
      measures,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 3 wording (methods.md §1.5, §3)
  // ---------------------------------------------------------------------------

  // The comparison a set of inputs describes, for wording.
  function comparisonFor(form, key) {
    if (key === 'all') return null;
    const c = candidateComparisons(form);
    return c.main.concat(c.cell).find((x) => x.key === key) || null;
  }

  // The condition that should do better, as questions name it. With one
  // variable every pair is compared, so it is "the better condition".
  function newConditionName(form, comp) {
    if (comp) return comp.type === 'main' ? comp.a : comp.a.join(' × ');
    return 'the better condition';
  }

  function inputText(form, measure, key) {
    const inp = inputsFor(measure, key);
    const comp = comparisonFor(form, key);
    const unit = trimmed(measure.unit);
    const isTime = measure.type === 'time';
    const paired = form.design === 'within' && measure.linked;
    const better = isTime ? 'be faster' : 'do better';
    const newName = newConditionName(form, comp);
    const d = parseNumber(inp.delta).value;
    const deltaShown = d !== undefined && d !== 0 ? Math.abs(d) : null;
    let diffPhrase = 'At that difference';
    if (deltaShown !== null) {
      const adj = timeAdjective(deltaShown, unit);
      diffPhrase = adj ? `At a ${adj} difference` : `At a difference of ${fmtSig(deltaShown, 3)}${unit ? ` ${unit}` : ''}`;
    }

    let heading = null;
    let deltaLabel = 'Smallest difference that would matter';
    let deltaHint = '(minimum meaningful difference)';
    if (comp && comp.type === 'main') {
      heading = `${comp.a} vs. ${comp.b}, averaged across ${comp.others}`;
      deltaLabel = `Averaged across all levels of ${comp.others}, what's the smallest difference that would matter between ${comp.a} and ${comp.b}?`;
      deltaHint = '(minimum meaningful difference for this main effect)';
    } else if (comp) {
      heading = comp.label;
      const differing = comp.a.map((x, i) => (x === comp.b[i] ? null : [x, comp.b[i]])).filter(Boolean);
      const left = differing.map((x) => x[0]).join(' × ');
      const right = differing.map((x) => x[1]).join(' × ');
      deltaLabel = comp.shared.length
        ? `For ${comp.shared.join(' × ')}, what's the smallest difference that would matter between ${left} and ${right}?`
        : `Between ${comp.a.join(' × ')} and ${comp.b.join(' × ')}, what's the smallest difference that would matter?`;
      deltaHint = '(minimum meaningful difference for this comparison)';
    }

    const kQuestion = paired
      ? `${diffPhrase}, how many of 10 participants would ${better} on ${newName}?`
      : `${diffPhrase}, pick one participant from each condition at random. Out of 10 such pairs, how often would the one on ${newName} ${better}?`;
    const participantsQuestion = paired
      ? `How many of 10 participants should do better on ${newName}?`
      : `Pick one participant from each condition at random. Out of 10 such pairs, how often should the one on ${newName} do better?`;

    let p1Label = 'Expected success rate on the condition you expect to do worse';
    let p2Label = 'Expected success rate on the condition you expect to do better';
    if (comp) {
      const b = comp.type === 'main' ? comp.b : comp.b.join(' × ');
      p1Label = `Expected success rate on ${b}`;
      p2Label = `Expected success rate on ${newName}`;
    } else if (form.factors[0].levels.length === 2) {
      const names = form.factors[0].levels.map((l, i) => trimmed(l.name) || `Condition ${i + 1}`);
      p1Label = `Expected success rate on ${names[0]}`;
      p2Label = `Expected success rate on ${names[1]}`;
    }
    const scale = scaleOf(measure);
    return {
      heading,
      modeUnits: unit ? `In ${unit}` : 'In units',
      modeUnitsHint: 'You have a target in units: cost, a requirement, a benchmark.',
      modeParticipants: 'In participants',
      modeParticipantsHint: isTime ? 'No past data. "8 of 10 people should be faster."' : 'No past data. "8 of 10 people should do better."',
      deltaLabel,
      deltaHint,
      unit,
      kQuestion,
      participantsQuestion,
      sdLabel: 'How much do values vary between participants? (standard deviation)',
      consistencyLabel: 'How consistent are participants across conditions? (correlation)',
      sdDiffToggle: 'I know the standard deviation of the differences instead',
      sdDiffLabel: 'How much do the differences between conditions vary? (standard deviation of the differences)',
      meanLabel: 'What average do you expect? (mean, optional)',
      meanHint: scale ? `Used to check that the standard deviation is possible on a ${scale.min} to ${scale.max} scale.` : '',
      p1Label,
      p2Label,
      psiLabel: 'Share of participants who succeed in one condition and fail in the other (discordance, optional)',
      psiHint: psiHint(inp),
      paired,
      scale,
    };
  }

  // "Leave blank ... (default 36%)" for the discordance field.
  function psiHint(inp) {
    const base = 'Leave blank to assume outcomes are unrelated, the cautious default.';
    const p1 = parseNumber(inp.p1).value;
    const p2 = parseNumber(inp.p2).value;
    if (!(p1 > 0 && p1 < 100 && p2 > 0 && p2 < 100)) return base;
    return `${base} With these rates the default is ${fmtSig(100 * E.defaultDiscordance(p1 / 100, p2 / 100), 3)}%.`;
  }

  // Live variability readout under the inputs (values from the engine).
  function variabilityReadout(form, measure, key) {
    const inp = inputsFor(measure, key);
    if (measure.type === 'binary' || inp.mode !== 'units') return null;
    const paired = form.design === 'within' && measure.linked;
    const d = parseNumber(inp.delta).value;
    try {
      if (inp.variability === 'estimate') {
        const k = parseNumber(inp.k).value;
        if (d === undefined || k === undefined) return null;
        const sd = paired ? E.sdDiffFromK(d, k) : E.sdFromK(d, k);
        return { value: `≈ ${fmtUnits(sd, measure.unit)}`, label: 'Variability', note: 'Your estimate, not measured.' };
      }
      if (inp.variability === 'sd' && paired) {
        const sd = parseNumber(inp.sd).value;
        if (sd === undefined) return null;
        const sdDiff = E.sdDiffFromSd(sd, E.rhoFromConsistency(inp.consistency || 'low'));
        return {
          value: `≈ ${fmtUnits(sdDiff, measure.unit)}`,
          label: 'Variability of the differences',
          note: 'Calculated from the standard deviation you entered.',
        };
      }
    } catch (err) {
      if (!(err instanceof E.EngineError)) throw err;
    }
    return null;
  }

  // Summary line in the Advanced section (step 3), as rich text.
  function advancedSummary(form) {
    const a = parseNumber(form.alpha).value;
    const p = parseNumber(form.power).value;
    const out = [];
    const sep = () => { if (out.length) out.push(' · '); };
    if (p > 0 && p < 1) out.push(`Power ${fmtPower(p)}`);
    if (a > 0 && a < 1) {
      sep();
      const mc = formComparisons(form);
      if (mc && mc.procedure === 'protected-lsd') {
        out.push(`alpha ${fmtAlpha(a)}, then each pair at `, mc.token, " after a significant overall test (Fisher's protected LSD)");
      } else if (mc && mc.procedure === 'bonferroni-holm') {
        out.push(`alpha ${fmtAlpha(a)}, adjusted to `, mc.token, ` for ${mc.m} comparisons (Holm at analysis)`);
      } else {
        out.push(`alpha ${fmtAlpha(a)}`);
      }
    }
    if (form.measures.some((x) => x.type === 'time' || x.type === 'count')) {
      sep();
      out.push('+5% for rank-based test (conservative)');
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Plan screen (methods.md §5, §6, §8, §10)
  // ---------------------------------------------------------------------------

  // Short "Why" line for the per-measure table, in the mockup's wording.
  function whyLine(m, fm, plan) {
    const unlinkedWithin = plan.design === 'within' && !m.paired;
    if (m.type === 'time') return `Times usually skew right; +5% applied (conservative)${unlinkedWithin ? '; values not linked to a participant' : ''}`;
    if (m.type === 'count') return `Counts usually skew right; +5% applied (conservative)${unlinkedWithin ? '; values not linked to a participant' : ''}`;
    if (m.type === 'binary') {
      if (m.paired) return 'Same participants, yes/no outcome';
      return unlinkedWithin ? 'Values not linked to a participant, yes/no outcome' : 'Separate groups, yes/no outcome';
    }
    let line;
    if (m.type === 'rating') {
      line = fm && (fm.preset === 'nasa-tlx' || fm.preset === 'sus')
        ? 'Composite rating, usually near-normal'
        : 'Rating, analysed as roughly normal';
    } else {
      line = 'Numeric values, analysed as roughly normal';
    }
    return unlinkedWithin ? `${line}; values not linked to a participant` : line;
  }

  const TRAIL_GROUPS = [
    { title: 'Your inputs', steps: ['inputs'] },
    { title: 'Variability', steps: ['variability'] },
    { title: 'Effect size', steps: ['effect size'] },
    { title: 'Alpha', steps: ['alpha'] },
    { title: 'Assumption', steps: ['assumption'] },
    { title: 'Sample size', steps: ['sample size', 'rank adjustment', 'main-effect split'] },
    { title: 'Order plan', steps: ['counterbalancing'] },
    { title: 'Total', steps: ['total'] },
  ];

  // One engine trail step as a sentence (methods.md §8). The alpha step is rich
  // text, with the per-comparison alpha as a tooltip token.
  function stepSentence(s, token) {
    const source = s.source === 'entered' ? ' (entered)' : s.source === 'your estimate' ? ' (your estimate)' : '';
    if (/^The same inputs apply/.test(s.label)) return `${s.label}.`;
    if (s.value === undefined) return s.label;
    if (s.step === 'alpha' && token) return [`${s.label}: `, token, '.'];
    let value;
    if (Array.isArray(s.value)) value = s.value.map((v) => fmtPercent(v)).join(' and ');
    else if (typeof s.value === 'string') value = capitalize(s.value) + (s.detail ? ` (${s.detail})` : '');
    else if (Number.isInteger(s.value)) value = String(s.value);
    else value = fmtSig(s.value, 3);
    if (s.unit && typeof s.value === 'number') value += ` ${s.unit}`;
    const detail = s.detail && typeof s.value !== 'string' ? ` ${s.detail}.` : '';
    return `${s.label}: ${value}${source}.${detail}`;
  }

  function trailFor(m, plan) {
    const token = planAlphaToken(plan);
    const groups = [{ title: 'Planned method', lines: [`${m.method}. ${m.reason}`] }];
    TRAIL_GROUPS.forEach((g) => {
      const lines = m.steps.filter((s) => g.steps.includes(s.step)).map((s) => stepSentence(s, token));
      if (g.title === 'Order plan' && m.primary && plan.participantsPerOrder !== null) {
        lines.push(`${m.total} fits ${plan.orders} orders: ${plan.participantsPerOrder} participant${plan.participantsPerOrder === 1 ? '' : 's'} each.`);
      }
      if (lines.length) groups.push({ title: g.title, lines });
    });
    return { name: m.name, primary: m.primary, open: m.primary, groups };
  }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function orderPlan(plan) {
    if (plan.design !== 'within') {
      const primary = plan.measures.find((x) => x.primary);
      return {
        within: false,
        text: `Random assignment to ${numberWord(plan.k)} equal groups: ${primary.perCell} participants per condition.`,
        orders: [],
        key: plan.conditions.map((c) => c),
      };
    }
    const rows = E.williamsSquare(plan.k);
    const each = plan.participantsPerOrder;
    return {
      within: true,
      text: plan.k === 2
        ? `Two orders, ${each} participant${each === 1 ? '' : 's'} each.`
        : `Balanced Latin square: ${plan.orders} orders, ${each} participant${each === 1 ? '' : 's'} each.`,
      orders: rows.map((r, i) => ({ number: i + 1, sequence: r.map((c) => LETTERS[c] || String(c + 1)).join(' ') })),
      key: plan.conditions.map((c, i) => `${LETTERS[i] || i + 1} = ${c}`),
    };
  }

  // A test name inside a sentence: lowercase unless it is named after a person.
  function midSentence(name) {
    return /^(Wilcoxon|Mann|McNemar|Friedman|Kruskal|Cochran)/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
  }

  // "Your analysis plan": the steps of the planned analysis for each measure,
  // from plan().measures[].analysis (methods.md §1.4). Steps are rich text.
  function analysisPlan(plan) {
    const token = planAlphaToken(plan);
    return plan.measures.map((m) => {
      const a = m.analysis;
      let steps;
      if (a.procedure === 'single') {
        steps = [`${a.pairwise} comparing ${plan.conditions[0]} and ${plan.conditions[1]}, at alpha ${fmtAlpha(a.alphaPerComparison)}.`];
      } else if (a.procedure === 'protected-lsd') {
        steps = [
          `Step 1: ${a.omnibus} at ${fmtAlpha(plan.alpha)}.`,
          [`Step 2: if it's significant, ${midSentence(a.pairwise)} for each pair at `, token, " (Fisher's protected LSD)."],
        ];
      } else {
        // Analysed with Holm; sized at the stricter Bonferroni level (methods.md §1.4).
        const holm = (what) => [`${a.pairwise} for ${what}, with the Holm adjustment (${a.comparisons} comparisons). ` +
          'The sample size is planned with the stricter Bonferroni level, alpha ', token, ", so it's covered either way."];
        steps = a.omnibus
          ? [`Step 1: ${a.omnibus} across all ${plan.k} conditions, to see whether they differ at all.`, ['Step 2: '].concat(holm('each pair'))]
          : [holm('each selected comparison')];
      }
      return { name: m.name, primary: m.primary, steps };
    });
  }

  // Reporting guidance (methods.md §10) for the measures and conditions present.
  function reportingGuidance(plan) {
    const out = [];
    plan.measures.forEach((m) => {
      if (m.type === 'time') {
        out.push({ lead: m.name, text: 'to describe the typical participant, report the geometric mean. To estimate total time or labor cost, report the arithmetic mean.' });
      } else if (m.type === 'count') {
        out.push({ lead: m.name, text: 'the geometric mean can\'t be used when any value is zero.' });
      } else if (m.type === 'binary') {
        out.push({ lead: m.name, text: 'report success rates and differences in percentage points.' });
      }
    });
    const winner = 'Declare a winner only when the top conditions differ significantly from each other; otherwise report a tie.';
    const omnibus = plan.design === 'within' ? 'overall test (repeated-measures ANOVA, Friedman or Cochran\'s Q)' : 'overall test (one-way ANOVA, Kruskal–Wallis or chi-square)';
    if (plan.procedure === 'protected-lsd') {
      out.push({
        lead: 'Three conditions',
        text: `report the ${omnibus}. If it is significant, report the pairwise comparisons at alpha ${fmtAlpha(plan.alpha)} (Fisher's protected LSD); if not, report that no difference was found. ${winner}`,
      });
    } else if (plan.procedure === 'bonferroni-holm' && plan.measures[0].analysis.omnibus) {
      out.push({
        lead: `${capitalize(numberWord(plan.k))} conditions`,
        text: `report the ${omnibus}, then the Holm-adjusted pairwise comparisons. ${winner}`,
      });
    } else if (plan.procedure === 'bonferroni-holm') {
      out.push({ lead: 'Selected comparisons', text: `report each with the Holm adjustment across the ${plan.m} comparisons. ${winner}` });
    }
    out.push({ lead: 'Every difference', text: 'report it in its own units with its confidence interval, not only a p-value.' });
    return out;
  }

  function planView(plan, form) {
    const formMeasure = (name) => form.measures.find((x) => trimmed(x.name) === name);
    const rows = plan.measures.map((m) => ({
      name: m.name,
      primary: m.primary,
      needed: m.total,
      covered: m.total <= plan.recommendedN,
      status: m.total <= plan.recommendedN ? 'covered' : 'underpowered',
      method: m.method,
      why: whyLine(m, formMeasure(m.name), plan),
    }));
    const warnings = plan.underpowered.map((u) =>
      `${u.name} is underpowered at ${plan.recommendedN}: ${fmtPercent(u.powerAtRecommended)} chance of detecting your target. ` +
      `It would need ${u.needs}. Report it as supporting evidence.`);
    return {
      participants: plan.recommendedN,
      drivenBy: plan.primary,
      design: `${plan.design === 'within' ? 'Within' : 'Between'} · ${plan.k} conditions`,
      powerAlpha: [`${fmtPower(plan.power)} · `, planAlphaToken(plan)],
      rows,
      warnings,
      coverAll: plan.underpowered.length
        ? `To cover every measure: ${plan.nCoverAll} participants (${plan.driving}).`
        : null,
      trails: plan.measures
        .slice()
        .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
        .map((m) => trailFor(m, plan)),
      orderPlan: orderPlan(plan),
      analysis: analysisPlan(plan),
      guidance: reportingGuidance(plan),
      announce: `Participants needed: ${plan.recommendedN}`,
    };
  }

  // Slider range for "Participants you can recruit" (Plan screen).
  function sliderRange(plan) {
    const max = Math.max(60, 2 * plan.recommendedN);
    if (plan.design === 'between') return { min: 2 * plan.k, max: max - (max % plan.k), step: plan.k, value: plan.recommendedN };
    return { min: 4, max, step: 1, value: plan.recommendedN };
  }

  // ---------------------------------------------------------------------------
  // Confidence report (methods.md §7, §7.1)
  // ---------------------------------------------------------------------------

  // Engine report and curve for the primary at n participants. Errors are placed.
  function confidence(plan, participants, form) {
    try {
      const report = E.confidenceReport(plan, participants);
      return { report, curve: E.powerCurve(report), error: null };
    } catch (err) {
      if (!(err instanceof E.EngineError)) throw err;
      return { report: null, curve: null, error: placeError(err, form, {}) };
    }
  }

  function tickLabel(kind, value, unit) {
    if (kind === 'units') return fmtUnits(value, unit, 3);
    if (kind === 'percentage points') return `${fmtSig(value, 3)} points`;
    return `${fmtSig(value, 2)} of 10`;
  }

  function confidenceView(report, curve) {
    const unit = report.unit;
    const name = report.measure;
    const tiles = [];
    let targetLabel;
    let axisTitle;
    let centerWords;
    let note = null;
    let precision = null;
    if (report.mode === 'units') {
      const target = report.target.units;
      tiles.push({
        value: report.detectable.units === null ? 'Not reachable' : fmtUnits(report.detectable.units, unit),
        label: 'Smallest difference this study detects reliably',
      });
      tiles.push({ value: `± ${fmtUnits(report.precision.halfWidth, unit)}`, label: 'How precisely it estimates the difference' });
      tiles.push({ value: fmtPercent(report.power), label: `Chance of detecting ${targetPhrase(target, unit)}` });
      targetLabel = `If the ${fmtUnits(target, unit, 3)} difference is real`;
      axisTitle = `${name} difference your study finds`;
      centerWords = [`0${unit ? ` ${unit}` : ''}`, `${fmtSig(target, 3)}${unit ? ` ${unit}` : ''}`];
      note = `Based on variability of about ${fmtUnits(report.sd, unit)} (${report.estimate ? 'your estimate' : 'entered'}).`;
      const hw = fmtSig(report.precision.halfWidth, 2);
      const end = (x) => (shortUnit(unit) ? `${fmtLike(x, hw)} ${shortUnit(unit)}` : fmtLike(x, hw));
      precision = {
        low: end(report.precision.low),
        mid: fmtUnits(target, unit, 3),
        high: end(report.precision.high),
        lowX: report.precision.low,
        midX: target,
        highX: report.precision.high,
        label: `Expected result of ${fmtSig(target, 3)}${unit ? ` ${unit}` : ''} with a range from ${fmtLike(report.precision.low, hw)} to ${fmtLike(report.precision.high, hw)}${unit ? ` ${unit}` : ''}`,
      };
    } else if (report.mode === 'participants') {
      const k = report.target.kOf10;
      tiles.push({
        value: report.detectable.kOf10 === null ? 'Not reachable' : `${fmtSig(report.detectable.kOf10, 2)} of 10`,
        label: report.detectable.kOf10 === null
          ? 'Smallest effect this study detects reliably'
          : `Smallest effect this study detects reliably: at least ${fmtSig(report.detectable.kOf10, 2)} of 10 participants do better`,
      });
      tiles.push({ value: fmtPercent(report.power), label: `Chance of detecting ${fmtSig(k, 2)} of 10 doing better` });
      targetLabel = `If ${fmtSig(k, 2)} of 10 really do better`;
      axisTitle = 'Result your study finds: how many of 10 participants do better';
      centerWords = ['5 of 10', `${fmtSig(k, 2)} of 10`];
      note = 'Precision is not reported in participants mode, since there are no units.';
    } else {
      const pp = report.target.percentagePoints;
      tiles.push({
        value: report.detectable === null ? 'Not reachable' : `${fmtSig(report.detectable.percentagePoints, 2)} points`,
        label: report.detectable === null
          ? 'No success rate up to 100% is detected reliably at this sample'
          : 'Smallest difference in success rate this study detects reliably (percentage points)',
      });
      tiles.push({ value: `± ${fmtSig(report.precision.halfWidth, 2)} points`, label: 'How precisely it estimates the difference in success rate' });
      tiles.push({ value: fmtPercent(report.power), label: `Chance of detecting your ${fmtSig(pp, 3)}-point difference` });
      targetLabel = `If the ${fmtSig(pp, 3)}-point difference is real`;
      axisTitle = `${name}: difference in success rate your study finds (percentage points)`;
      centerWords = ['0 points', `${fmtSig(pp, 3)} points`];
      const hwp = fmtSig(report.precision.halfWidth, 2);
      precision = {
        low: `${fmtLike(report.precision.low, hwp)} points`,
        mid: `${fmtSig(pp, 3)} points`,
        high: `${fmtLike(report.precision.high, hwp)} points`,
        lowX: report.precision.low,
        midX: pp,
        highX: report.precision.high,
        label: `Expected result of ${fmtSig(pp, 3)} percentage points with a range from ${fmtLike(report.precision.low, hwp)} to ${fmtLike(report.precision.high, hwp)}`,
      };
    }
    const caught = fmtPercent(curve.shadedShare);
    const missed = fmtPercent(curve.unshadedShare);
    return {
      tiles,
      note,
      precision,
      curve: {
        noneLabel: 'If there\'s no real difference',
        targetLabel,
        barLabel: 'Significance bar',
        caught: `${caught} caught`,
        missed: `${missed} missed`,
        axisTitle,
        ticks: curve.axis.ticks.map((t) => ({ x: t.x, label: tickLabel(curve.axis.kind, t.value, unit) })),
        ariaLabel: `Two bell curves of possible study results: one centered on ${centerWords[0]} if there is no real difference, ` +
          `one centered on ${centerWords[1]} if the difference is real. ${caught} of the second curve clears the significance bar.`,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Find problems (methods.md §9)
  // ---------------------------------------------------------------------------

  const COMMON_P = 0.31;

  function findView(find) {
    const issues = [];
    const read = (raw, target, missing) => {
      const r = parseNumber(raw);
      if (r.empty) {
        issues.push({ target, message: missing, kind: 'missing' });
        return undefined;
      }
      if (r.invalid) {
        issues.push({ target, message: 'Enter a number.', kind: 'invalid' });
        return undefined;
      }
      if (!(r.value > 0 && r.value < 100)) {
        issues.push({ target, message: 'Enter a percentage between 0 and 100.', kind: 'invalid' });
        return undefined;
      }
      return r.value;
    };
    const pPct = read(find.p, ids.findP(), 'Enter the smallest problem frequency you care about.');
    const bigPct = read(find.P, ids.findBigP(), 'Enter how sure you want to be.');
    if (pPct === undefined || bigPct === undefined) return { ready: false, issues };

    const p = pPct / 100;
    const P = bigPct / 100;
    let calc;
    try {
      calc = E.nProblemDiscovery(p, P);
    } catch (err) {
      if (!(err instanceof E.EngineError)) throw err;
      issues.push({ target: err.field === 'P' ? ids.findBigP() : ids.findP(), message: err.message, kind: 'engine' });
      return { ready: false, issues };
    }
    const n = calc.n;
    const sliderMax = Math.max(40, n);
    const chosen = find.participants === null || find.participants === undefined
      ? n : Math.min(Math.max(find.participants, 3), sliderMax);
    const pText = `${fmtSig(pPct, 3)}%`;
    const bigPText = `${fmtSig(bigPct, 3)}%`;
    const sameAsCommon = Math.abs(p - COMMON_P) < 1e-12;

    const rowNs = Array.from(new Set([5, 10, n])).sort((a, b) => a - b);
    const columns = [`Affects ${pText} of users`].concat(sameAsCommon ? [] : ['Affects 31% of users']);
    const rows = rowNs.map((rn) => ({
      label: rn === n ? `${rn} (your plan)` : String(rn),
      plan: rn === n,
      values: [fmtPercent(E.chanceOfSeeing(p, rn))].concat(sameAsCommon ? [] : [fmtPercent(E.chanceOfSeeing(COMMON_P, rn))]),
    }));

    const axisMax = Math.max(30, Math.ceil(Math.max(n, chosen) / 10) * 10);
    const points = [];
    for (let i = 0; i <= axisMax; i++) {
      points.push({ n: i, chosen: E.chanceOfSeeing(p, i), common: E.chanceOfSeeing(COMMON_P, i) });
    }
    const atChosen = E.chanceOfSeeing(p, chosen);
    const atPlan = E.chanceOfSeeing(p, n);
    const smallest = E.smallestFrequencySeen(chosen, P);
    const ticks = [];
    for (let t = 0; t <= axisMax; t += 10) ticks.push(t);

    return {
      ready: true,
      issues,
      n,
      p,
      P,
      slider: { min: 3, max: sliderMax, value: chosen },
      result: {
        n: String(n),
        text: `participants for an ${bigPText} chance of seeing any problem that affects at least ${pText} of users.`,
      },
      table: { columns, rows },
      curve: {
        axisMax,
        points,
        ticks,
        targetLine: P,
        targetLabel: bigPText,
        chosen,
        planN: n,
        chosenY: atChosen,
        planY: atPlan,
        showCommon: !sameAsCommon,
        chosenLabel: `${chosen} participant${chosen === 1 ? '' : 's'}: ${fmtPercent(atChosen)}`,
        planLabel: `${n}: your plan, ${fmtPercent(atPlan)}`,
        chosenCurveLabel: `Affects ${pText} of users`,
        commonCurveLabel: 'Affects 31% of users',
        ariaLabel: `Rising curves showing the chance of seeing a problem at least once as participants are added: ` +
          `problems affecting ${pText} of users reach ${fmtPercent(atPlan)} at ${n} participants` +
          `${sameAsCommon ? '' : ', and problems affecting 31% of users rise faster'}. ` +
          `At ${chosen} participants the chance is ${fmtPercent(atChosen)}.`,
      },
      sentence: {
        participants: `${chosen} participant${chosen === 1 ? '' : 's'}`,
        chance: bigPText,
        frequency: `about ${fmtPercent(smallest)} of users or more`,
      },
      trail: [
        { lead: 'Your inputs.', text: `A problem that affects ${pText} of users; you want an ${bigPText} chance of seeing it at least once.` },
        { lead: 'One participant misses it', text: `${fmtPercent(calc.missOne)} of the time, so all n participants miss it with probability ${fmtFraction(calc.missOne)}`, sup: 'n', after: '.' },
        { lead: 'Seeing it at least once', text: `= 1 − ${fmtFraction(calc.missOne)}`, sup: 'n', after: `. Set that to at least ${fmtFraction(P)}.` },
        { lead: 'Solve for n.', text: `n = ln(${fmtFraction(calc.missAll)}) ÷ ln(${fmtFraction(calc.missOne)}) = ${fmtSig(calc.exact, 3)}, rounded up to ${n}.` },
      ],
      announce: `Participants needed: ${n}`,
    };
  }

  return {
    TEXT,
    TYPE_LABELS,
    TYPE_ORDER,
    TYPE_HELP,
    PRESET_DISPLAY,
    ids,
    uid,
    newForm,
    newFindForm,
    newFactor,
    newLevel,
    nextLevel,
    conditionName,
    newMeasure,
    presetMeasure,
    inputsFor,
    inputKeys,
    parseNumber,
    conditionCount,
    candidateComparisons,
    comparisonCount,
    mainEffectsDisabled,
    binaryTypeDisabled,
    buildStudy,
    placeError,
    runPlan,
    liveStatus,
    alphaToken,
    plainText,
    fmtSig,
    fmtPercent,
    fmtFraction,
    fmtUnits,
    shortUnit,
    targetPhrase,
    step1View,
    sidebarSummary,
    inputText,
    variabilityReadout,
    advancedSummary,
    planView,
    sliderRange,
    confidence,
    confidenceView,
    findView,
  };
});
