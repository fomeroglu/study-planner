// Tests for engine.js. Run with `node --test` from the repo root.
// Answer-key cases mirror validation/answer-key.md.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'engine.js'));

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg || ''} expected ${expected} ± ${tol}, got ${actual}`);
const throwsEngine = (fn, pattern) =>
  assert.throws(fn, (err) => err instanceof E.EngineError && (!pattern || pattern.test(err.message)));

const DZ_K8 = E.normalQuantile(0.8); // Φ⁻¹(0.8) ≈ 0.8416

// ---------------------------------------------------------------------------
// Answer key (validation/answer-key.md)
// ---------------------------------------------------------------------------

test('answer key: paired, dz = 0.5, power 0.80 gives 34 (CONFIRMED)', () => {
  const r = E.nPairedT(0.5, 0.05, 0.8);
  assert.equal(r.n, 34);
  near(r.exact, 33.3671, 5e-5, 'pwr reports 33.36713');
});

test('answer key: independent, d = 0.5, power 0.80 gives 64 per condition (CONFIRMED)', () => {
  const r = E.nIndependentT(0.5, 0.05, 0.8);
  assert.equal(r.n, 64);
  near(r.exact, 63.7656, 5e-5, 'pwr reports 63.76561');
});

test('answer key: paired, dz = Φ⁻¹(0.8), alpha 0.05 gives 14', () => {
  const r = E.nPairedT(DZ_K8, 0.05, 0.8);
  assert.equal(r.n, 14);
  near(r.exact, 13.1301, 5e-5);
});

test('answer key: same, alpha 0.025 gives 17 (near a rounding boundary)', () => {
  const r = E.nPairedT(DZ_K8, 0.025, 0.8);
  assert.equal(r.n, 17);
  near(r.exact, 16.0373, 5e-5);
});

test('answer key: same, alpha 0.0167 gives 18 (literal and 0.05/3)', () => {
  const literal = E.nPairedT(DZ_K8, 0.0167, 0.8);
  assert.equal(literal.n, 18);
  near(literal.exact, 17.7282, 5e-5);
  const third = E.nPairedT(DZ_K8, 0.05 / 3, 0.8);
  assert.equal(third.n, 18);
  near(third.exact, 17.7366, 5e-5);
});

test('answer key: variability from your estimate, Δ = 10, k = 8 gives σ_diff = 11.88', () => {
  near(E.sdDiffFromK(10, 8), 11.8818, 5e-5);
});

test('answer key: confidence report, n = 12, σ_diff = 11.88, alpha 0.025', () => {
  const sd = 11.88;
  const r = E.confidenceT({ design: 'within', n: 12, alpha: 0.025, power: 0.8, effectSize: 10 / sd, sd });
  near(r.power, 0.63, 0.005, 'power');
  near(r.power, 0.6323, 5e-5, 'power to 4 places');
  near(r.detectable.units, 12.0, 0.05, 'detectable difference');
  near(r.detectable.units, 11.9776, 5e-4, 'detectable to 4 significant places');
  near(r.precision.halfWidth, 7.5, 0.05, 'precision');
  near(r.precision.halfWidth, 7.5482, 5e-5, 'precision to 4 places');
});

test('answer key: rank adjustment and Latin square, 18 ÷ 0.955, 3 conditions gives 19, then 24', () => {
  assert.equal(E.rankAdjust(18), 19);
  assert.equal(E.orderCount(3), 6);
  assert.equal(E.roundToOrders(19, 6), 24);
});

test('answer key: two proportions 0.60 vs 0.80 gives 81 per condition', () => {
  const r = E.nTwoProportions(0.6, 0.8, 0.05, 0.8);
  assert.equal(r.n, 81);
  near(r.exact, 80.2993, 5e-5);
  near(Math.abs(r.h), 0.4421, 5e-5);
});

test('answer key: McNemar 0.60 vs 0.80, default ψ gives 84 (±2)', () => {
  const r = E.nMcNemar(0.6, 0.8, 0.05, 0.8);
  near(r.psi, 0.44, 1e-12);
  assert.ok(Math.abs(r.n - 84) <= 2, `got ${r.n}`);
  assert.equal(r.n, 84);
  near(r.exact, 83.9405, 5e-5);
});

test('answer key: problem discovery p = 0.31, P = 0.85 gives 6 (CONFIRMED)', () => {
  const r = E.nProblemDiscovery(0.31, 0.85);
  assert.equal(r.n, 6);
  near(r.exact, 5.1127, 5e-5);
});

test('answer key: problem discovery p = 0.10, P = 0.80 gives 16 (CONFIRMED)', () => {
  const r = E.nProblemDiscovery(0.1, 0.8);
  assert.equal(r.n, 16);
  near(r.exact, 15.2755, 5e-5);
});

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

test('normal CDF and quantile match R', () => {
  near(E.normalCdf(1.96), 0.9750021048517795, 1e-15);
  near(E.normalCdf(-3), 0.0013498980316300946, 1e-17);
  near(E.normalCdf(0), 0.5, 0);
  near(E.normalCdf(-8) / 6.22096057427178e-16, 1, 1e-12);
  near(E.normalQuantile(0.975), 1.959963984540054, 1e-14);
  near(E.normalQuantile(0.8), 0.8416212335729143, 1e-14);
  near(E.normalQuantile(0.025), -1.959963984540054, 1e-14);
  for (const p of [1e-10, 0.001, 0.2, 0.5, 0.7, 0.999]) near(E.normalCdf(E.normalQuantile(p)) / p, 1, 1e-12);
});

test('t CDF and quantile match R', () => {
  near(E.tCdf(2, 5), 0.9490302605850709, 1e-13);
  near(E.tCdf(-2, 5), 1 - 0.9490302605850709, 1e-13);
  near(E.tQuantile(0.975, 11), 2.200985160082949, 1e-10);
  near(E.tQuantile(0.975, 1), 12.70620473617471, 1e-9);
  near(E.tQuantile(0.025, 30), -2.042272456301238, 1e-10);
  near(E.tQuantile(0.5, 7), 0, 0);
});

test('noncentral t with ncp = 0 equals the central t', () => {
  for (const [t, df] of [[1.3, 4], [-0.7, 12], [2.5, 33.5]]) {
    near(E.noncentralTCdf(t, df, 0), E.tCdf(t, df), 1e-15);
  }
});

test('noncentral t agrees with direct numerical integration of its definition', () => {
  // Reference values computed by integrating Φ(t·√(v/df) − δ) over the χ²_df
  // density (Simpson's rule, 20,000 panels): independent of AS 243.
  const cases = [
    [1.5, 10, 1, 0.669516848215],
    [-1, 8, 2, 0.001939037952],
    [2.2, 33, 2.9, 0.244449203948],
    [2.59, 11, 2.92, 0.365293249252],
    [3, 15.5, 3.4, 0.34537369807],
    [2, 126, 2.83, 0.203993111386],
  ];
  for (const [t, df, ncp, expected] of cases) near(E.noncentralTCdf(t, df, ncp), expected, 1e-11);
});

test('noncentral t CDF is monotone in t and decreasing in ncp', () => {
  let prev = 0;
  for (let t = -4; t <= 8; t += 0.5) {
    const v = E.noncentralTCdf(t, 9, 2);
    assert.ok(v >= prev);
    prev = v;
  }
  assert.ok(E.noncentralTCdf(2, 9, 1) > E.noncentralTCdf(2, 9, 2));
});

// ---------------------------------------------------------------------------
// Sample size, power, monotonicity
// ---------------------------------------------------------------------------

test('power rises with n (paired, independent, two proportions, McNemar)', () => {
  const series = [
    (n) => E.powerPairedT(n, 0.5, 0.05),
    (n) => E.powerIndependentT(n, 0.5, 0.05),
    (n) => E.powerTwoProportions(n, 0.6, 0.8, 0.05),
    (n) => E.powerMcNemar(n, 0.6, 0.8, 0.05),
  ];
  for (const f of series) {
    let prev = 0;
    for (const n of [5, 10, 20, 40, 80, 160]) {
      const p = f(n);
      assert.ok(p > prev, `power ${p} at n = ${n} should exceed ${prev}`);
      prev = p;
    }
  }
});

test('power at the solved n meets the target; one fewer participant does not', () => {
  const r = E.nPairedT(0.5, 0.05, 0.8);
  assert.ok(E.powerPairedT(r.n, 0.5, 0.05) >= 0.8);
  assert.ok(E.powerPairedT(r.n - 1, 0.5, 0.05) < 0.8);
  near(E.powerPairedT(r.exact, 0.5, 0.05), 0.8, 1e-9);
});

test('detectable difference falls with n (paired, independent, rank, binary)', () => {
  const ns = [8, 12, 20, 40];
  const check = (f) => {
    let prev = Infinity;
    for (const n of ns) {
      const v = f(n);
      assert.ok(v < prev, `detectable ${v} at n = ${n} should be below ${prev}`);
      prev = v;
    }
  };
  check((n) => E.confidenceT({ design: 'within', n, alpha: 0.05, effectSize: 0.5, sd: 10 }).detectable.units);
  check((n) => E.confidenceT({ design: 'between', n, alpha: 0.05, effectSize: 0.5, sd: 10 }).detectable.units);
  check((n) => E.confidenceT({ design: 'within', n, alpha: 0.05, rank: true, effectSize: 0.5, sd: 10 }).detectable.units);
  check((n) => E.confidenceBinary({ design: 'between', n: n * 5, p1: 0.6, p2: 0.8, alpha: 0.05 }).detectable.percentagePoints);
  check((n) => E.confidenceBinary({ design: 'within', n: n * 5, p1: 0.6, p2: 0.8, alpha: 0.05 }).detectable.percentagePoints);
});

test('rank-based confidence report uses effective n × 3/π for power', () => {
  const r = E.confidenceT({ design: 'within', n: 20, alpha: 0.05, rank: true, effectSize: 0.6, sd: 5 });
  near(r.effectiveN, 20 * E.RANK_EFFICIENCY, 1e-12);
  near(r.power, E.powerPairedT(20 * E.RANK_EFFICIENCY, 0.6, 0.05), 1e-15);
  near(r.precision.halfWidth, E.tQuantile(0.975, 19) * 5 / Math.sqrt(20), 1e-12);
});

test('binary confidence report: detectable p₂ reaches the target power exactly', () => {
  const b = E.confidenceBinary({ design: 'between', n: 81, p1: 0.6, p2: 0.8, alpha: 0.05 });
  assert.ok(b.power >= 0.8);
  near(E.powerTwoProportions(81, 0.6, b.detectable.p2, 0.05), 0.8, 1e-9);
  assert.ok(b.detectable.p2 > 0.6 && b.detectable.p2 < 0.8);
  near(b.precision.halfWidth, 1.959963984540054 * Math.sqrt((0.24 + 0.16) / 81), 1e-12);
  const w = E.confidenceBinary({ design: 'within', n: 84, p1: 0.6, p2: 0.8, alpha: 0.05 });
  near(w.precision.halfWidth, 1.959963984540054 * Math.sqrt((0.44 - 0.04) / 84), 1e-12);
  // Lower direction: p₂ below p₁.
  const down = E.confidenceBinary({ design: 'between', n: 81, p1: 0.8, p2: 0.6, alpha: 0.05 });
  assert.ok(down.detectable.p2 < 0.8);
});

test('two-proportion power at the closed-form n matches the target (pwr.2p.test form)', () => {
  const r = E.nTwoProportions(0.6, 0.8, 0.05, 0.8);
  // The closed form ignores the far rejection region, which adds about 1e-6.
  near(E.powerTwoProportions(r.exact, 0.6, 0.8, 0.05), 0.8, 1e-5);
});

test('McNemar with an entered ψ', () => {
  const r = E.nMcNemar(0.6, 0.8, 0.05, 0.8, 0.3);
  assert.equal(r.psi, 0.3);
  const lower = E.nMcNemar(0.6, 0.8, 0.05, 0.8, 0.25);
  assert.ok(lower.n < r.n, 'smaller discordance needs fewer participants');
});

test('rank adjustment uses the exact 3/π', () => {
  assert.equal(E.RANK_EFFICIENCY, 3 / Math.PI);
  assert.equal(E.rankAdjust(191), 201); // 191 ÷ 0.955 would be exactly 200
  assert.equal(E.rankAdjust(34), 36);
});

// ---------------------------------------------------------------------------
// Comparisons, variability, effect size
// ---------------------------------------------------------------------------

test('comparison counts and alpha per comparison (every pair, always adjusted)', () => {
  assert.equal(E.countComparisons(2), 1);
  assert.equal(E.countComparisons(3, 'all-pairs'), 3);
  assert.equal(E.countComparisons(4, 'all-pairs'), 6);
  assert.equal(E.countComparisons(6, 'all-pairs'), 15);
  assert.equal(E.alphaPerComparison(0.05, 1), 0.05);
  assert.equal(E.alphaPerComparison(0.05, 2), 0.025);
  assert.equal(E.alphaPerComparison(0.05, 3), 0.05 / 3);
  throwsEngine(() => E.countComparisons(3, 'omnibus'));
  throwsEngine(() => E.countComparisons(1, 'all-pairs'));
  // Each vs. a baseline is planned for a later version (methods.md §13).
  throwsEngine(() => E.countComparisons(3, 'baseline'), /later version/);
});

test('cells are every combination of levels', () => {
  const cells = E.buildCells([{ name: 'Design', levels: ['A', 'B', 'C'] }, { name: 'Posture', levels: ['Seated', 'Standing'] }]);
  assert.equal(cells.length, 6);
  assert.deepEqual(cells[1], ['A', 'Standing']);
  assert.equal(E.cellsPerLevel([{ name: 'Design', levels: ['A', 'B', 'C'] }, { name: 'Posture', levels: ['Seated', 'Standing'] }], 'Design'), 2);
});

test('consistency maps to ρ and defaults to Low', () => {
  assert.equal(E.rhoFromConsistency('low'), 0.3);
  assert.equal(E.rhoFromConsistency('medium'), 0.5);
  assert.equal(E.rhoFromConsistency('high'), 0.7);
  assert.equal(E.rhoFromConsistency(), 0.3);
  throwsEngine(() => E.rhoFromConsistency('not sure'));
  near(E.sdDiffFromSd(10, 0.5), 10, 1e-12);
  near(E.sdDiffFromSd(10, 0.3), 10 * Math.sqrt(1.4), 1e-12);
});

test('k of 10 conversions, within and between, and their inverses', () => {
  near(E.dzFromK(8), DZ_K8, 1e-15);
  near(E.dFromK(8), Math.SQRT2 * DZ_K8, 1e-15);
  near(E.sdFromK(10, 8), 10 / (Math.SQRT2 * DZ_K8), 1e-12);
  // Between: d = Δ / σ must equal dFromK.
  near(10 / E.sdFromK(10, 7), E.dFromK(7), 1e-12);
  for (const k of [6, 7, 8, 9]) {
    near(E.kFromDz(E.dzFromK(k)), k, 1e-12);
    near(E.kFromD(E.dFromK(k)), k, 1e-12);
  }
});

test('in participants mode, detectable difference is reported as k of 10', () => {
  const r = E.confidenceT({ design: 'within', n: 12, alpha: 0.025, effectSize: E.dzFromK(8) });
  near(r.detectable.kOf10, E.kFromDz(r.detectable.effectSize), 1e-12);
  assert.ok(r.detectable.kOf10 > 8 && r.detectable.kOf10 < 10);
  assert.equal(r.detectable.units, null);
  assert.equal(r.precision, null);
});

// ---------------------------------------------------------------------------
// Counterbalancing
// ---------------------------------------------------------------------------

test('Williams squares: each condition once per position, carryover balanced', () => {
  for (let k = 2; k <= 7; k++) {
    const rows = E.williamsSquare(k);
    const expectedRows = k % 2 === 0 ? k : 2 * k;
    assert.equal(rows.length, expectedRows, `k = ${k}`);
    assert.equal(E.orderCount(k), expectedRows);
    for (const row of rows) assert.deepEqual([...row].sort((a, b) => a - b), [...Array(k).keys()]);
    for (let pos = 0; pos < k; pos++) {
      const counts = Array(k).fill(0);
      rows.forEach((row) => counts[row[pos]]++);
      assert.ok(counts.every((c) => c === expectedRows / k), `k = ${k}, position ${pos}`);
    }
    const pairs = new Map();
    rows.forEach((row) => {
      for (let i = 0; i + 1 < k; i++) {
        const key = `${row[i]}>${row[i + 1]}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    });
    assert.equal(pairs.size, k * (k - 1), `k = ${k}: every ordered pair appears`);
    const times = expectedRows / k;
    for (const v of pairs.values()) assert.equal(v, times, `k = ${k}: each ordered pair ${times} time(s)`);
  }
});

test('n is rounded up to fit the orders', () => {
  assert.equal(E.roundToOrders(19, 2), 20);
  assert.equal(E.roundToOrders(20, 4), 20);
  assert.equal(E.roundToOrders(21, 10), 30);
});

// ---------------------------------------------------------------------------
// Problem discovery
// ---------------------------------------------------------------------------

test('problem discovery: chance of seeing and smallest frequency seen', () => {
  near(E.chanceOfSeeing(0.31, 5), 1 - Math.pow(0.69, 5), 1e-15);
  near(E.chanceOfSeeing(0.31, 6), 0.8921, 5e-5);
  const p = E.smallestFrequencySeen(16, 0.8);
  near(E.chanceOfSeeing(p, 16), 0.8, 1e-12);
  assert.ok(E.smallestFrequencySeen(20, 0.8) < E.smallestFrequencySeen(10, 0.8));
});

// ---------------------------------------------------------------------------
// Bounded scales
// ---------------------------------------------------------------------------

test('Bhatia–Davis bound', () => {
  near(E.maxSdOnScale(5, 1, 7), Math.sqrt(8), 1e-12);
  near(E.checkBoundedSd(1.5, 5, 1, 7), Math.sqrt(8), 1e-12);
  throwsEngine(() => E.checkBoundedSd(3, 5, 1, 7), /at most 2.83/);
  throwsEngine(() => E.checkBoundedSd(25, 95, 0, 100)); // bound √(5 × 95) ≈ 21.8
  throwsEngine(() => E.maxSdOnScale(8, 1, 7));
});

// ---------------------------------------------------------------------------
// Invalid inputs
// ---------------------------------------------------------------------------

test('k must be a whole number from 6 to 9', () => {
  for (const k of [5, 10, 6.5, 0]) {
    throwsEngine(() => E.dzFromK(k), /6 to 9/);
    throwsEngine(() => E.sdDiffFromK(10, k), /6 to 9/);
    throwsEngine(() => E.sdFromK(10, k), /6 to 9/);
    throwsEngine(() => E.dFromK(k), /6 to 9/);
  }
});

test('rates must be strictly between 0 and 1', () => {
  for (const [p1, p2] of [[0, 0.5], [0.5, 1], [-0.1, 0.5], [0.5, 1.2]]) {
    throwsEngine(() => E.nTwoProportions(p1, p2, 0.05, 0.8), /between 0 and 1/);
    throwsEngine(() => E.nMcNemar(p1, p2, 0.05, 0.8), /between 0 and 1/);
  }
  throwsEngine(() => E.nProblemDiscovery(1, 0.8));
  throwsEngine(() => E.nProblemDiscovery(0.3, 0));
  throwsEngine(() => E.nPairedT(0.5, 1.2, 0.8));
});

test('discordance must fit the success rates', () => {
  throwsEngine(() => E.nMcNemar(0.6, 0.8, 0.05, 0.8, 0.15), /discordance/);
  throwsEngine(() => E.nMcNemar(0.6, 0.8, 0.05, 0.8, 0.65), /at most 0.6/);
});

test('equal rates or zero difference are rejected', () => {
  throwsEngine(() => E.nTwoProportions(0.6, 0.6, 0.05, 0.8));
  throwsEngine(() => E.nPairedT(0, 0.05, 0.8));
});

// ---------------------------------------------------------------------------
// plan()
// ---------------------------------------------------------------------------

const threeDesigns = { name: 'Design', levels: ['Current', 'A', 'B'] };

test('plan: 3 conditions within, task time, alpha 0.0167 trail gives 18, 19, then 24', () => {
  // Every pair of 3 conditions: m = 3, alpha 0.05/3. dz = Φ⁻¹(0.8) gives n = 18.
  const r = E.plan({
    design: 'within',
    factors: [threeDesigns],
    comparisons: { scheme: 'all-pairs' },
    adjust: true,
    measures: [{ name: 'Task time', type: 'time', unit: 's', primary: true, effect: { mode: 'units', delta: 10, k: 8 } }],
  });
  assert.equal(r.m, 3);
  near(r.alphaPerComparison, 0.05 / 3, 1e-15);
  const m = r.measures[0];
  assert.equal(m.method, 'Wilcoxon signed-rank');
  const byStep = (s) => m.steps.filter((x) => x.step === s);
  assert.equal(byStep('sample size')[0].value, 18);
  assert.equal(byStep('rank adjustment')[0].value, 19);
  assert.match(byStep('rank adjustment')[0].label, /÷ 0\.955 \(3\/π\)/);
  assert.equal(byStep('counterbalancing')[0].value, 24);
  assert.equal(m.total, 24);
  assert.equal(r.recommendedN, 24);
  assert.equal(r.orders, 6);
  // Values from k of 10 are labeled as the user's estimate.
  assert.ok(m.steps.some((s) => s.step === 'variability' && s.source === 'your estimate'));
  assert.ok(m.usesEstimate);
  // Shared inputs are worked through once.
  assert.equal(byStep('sample size').length, 1);
  assert.equal(m.comparisons.length, 3);
});

test('plan: comparisons are always adjusted; one comparison keeps the full alpha', () => {
  const study = (levels, extra) => Object.assign({
    design: 'within',
    factors: [{ name: 'Design', levels }],
    comparisons: { scheme: 'all-pairs' },
    measures: [{ name: 'Rating', type: 'rating', primary: true, effect: { mode: 'units', delta: 5, sdDiff: 10 } }],
  }, extra);
  const one = E.plan(study(['Current', 'A']));
  assert.equal(one.m, 1);
  assert.equal(one.adjust, true);
  assert.equal(one.alphaPerComparison, 0.05);
  assert.equal(one.measures[0].n, 34);
  assert.equal(one.measures[0].total, 34); // already even
  assert.match(one.measures[0].steps.find((x) => x.step === 'alpha').label, /\(one comparison\)/);
  // No adjust flag needed: three conditions split alpha three ways.
  const three = E.plan(study(['Current', 'A', 'B']));
  assert.equal(three.m, 3);
  assert.equal(three.alphaPerComparison, 0.05 / 3);
  // Unadjusted and baseline-only comparisons are planned for a later version (methods.md §13).
  throwsWhere(() => E.plan(study(['Current', 'A', 'B'], { adjust: false })), { field: 'comparisons' });
  throwsWhere(() => E.plan(study(['Current', 'A', 'B'], { comparisons: { scheme: 'baseline' } })), { field: 'comparisons' });
});

test('plan: consistency defaults to Low (ρ = 0.3)', () => {
  const base = (consistency) => E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }],
    comparisons: { scheme: 'all-pairs' },
    measures: [{ name: 'Score', type: 'numeric', primary: true, effect: { mode: 'units', delta: 5, sd: 10, consistency } }],
  }).measures[0];
  const def = base(undefined);
  const low = base('low');
  const high = base('high');
  assert.equal(def.n, low.n);
  assert.ok(high.n < low.n);
  assert.ok(def.steps.some((s) => s.value === 'low'));
});

test('plan: two factors within, main effect and specific combination', () => {
  const r = E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }, { name: 'Posture', levels: ['Seated', 'Standing'] }],
    comparisons: {
      list: [
        { id: 'design', type: 'main', factor: 'Design', a: 'A', b: 'Current' },
        { id: 'seated', type: 'cell', a: ['A', 'Seated'], b: ['Current', 'Seated'] },
      ],
    },
    adjust: true,
    measures: [{
      name: 'Time', type: 'time', unit: 's', primary: true,
      effect: { byComparison: { design: { mode: 'units', delta: 5, sdDiff: 10 }, seated: { mode: 'participants', k: 8 } } },
    }],
  });
  assert.equal(r.k, 4);
  assert.equal(r.m, 2);
  assert.equal(r.orders, 4);
  const m = r.measures[0];
  const expectedMain = E.rankAdjust(E.nPairedT(0.5, 0.025, 0.8).n);
  assert.equal(m.comparisons.find((c) => c.comparison.id === 'design').n, expectedMain);
  assert.equal(m.n, expectedMain);
  assert.equal(m.total, E.roundToOrders(expectedMain, 4));
});

test('plan: two factors between, main effect divides the group across cells', () => {
  const r = E.plan({
    design: 'between',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }, { name: 'Posture', levels: ['Seated', 'Standing', 'Walking'] }],
    comparisons: { list: [{ id: 'design', type: 'main', factor: 'Design', a: 'A', b: 'Current' }] },
    measures: [{ name: 'Rating', type: 'rating', primary: true, effect: { mode: 'units', delta: 5, sd: 10 } }],
  });
  const m = r.measures[0];
  // Group n 64 at d = 0.5, split across 3 cells per level: ceil(64 / 3) = 22.
  assert.equal(m.comparisons[0].groupN, 64);
  assert.equal(m.perCell, 22);
  assert.equal(m.total, 22 * 6);
  assert.ok(m.steps.some((s) => s.step === 'main-effect split' && s.value === 22));
});

test('plan: between, two proportions sized per condition', () => {
  const r = E.plan({
    design: 'between',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }],
    comparisons: { scheme: 'all-pairs' },
    measures: [{ name: 'Success', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }],
  });
  assert.equal(r.measures[0].method, 'Two-proportion test');
  assert.equal(r.measures[0].perCell, 81);
  assert.equal(r.measures[0].total, 162);
});

test('plan: within, success/failure uses McNemar and counterbalancing', () => {
  const r = E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }],
    comparisons: { scheme: 'all-pairs' },
    measures: [{ name: 'Success', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }],
  });
  assert.equal(r.measures[0].method, 'McNemar');
  assert.equal(r.measures[0].n, 84);
  assert.equal(r.measures[0].total, 84);
});

test('plan: unlinked measure in a within study is treated as independent', () => {
  const r = E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }],
    comparisons: { scheme: 'all-pairs' },
    measures: [{ name: 'Rating', type: 'rating', primary: true, linked: false, effect: { mode: 'units', delta: 5, sd: 10 } }],
  });
  assert.equal(r.measures[0].method, 'Independent t-test');
  assert.equal(r.measures[0].n, 64);
});

test('plan: primary sets the recommended n; secondaries flagged as underpowered', () => {
  const r = E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }],
    comparisons: { scheme: 'all-pairs' },
    measures: [
      { name: 'Time', type: 'time', unit: 's', primary: true, effect: { mode: 'participants', k: 8 } },
      { name: 'Success', type: 'binary', effect: { p1: 0.6, p2: 0.8 } },
      { name: 'Easy', type: 'rating', effect: { mode: 'participants', k: 9 } },
    ],
  });
  assert.equal(r.primary, 'Time');
  assert.equal(r.driving, 'Success');
  assert.equal(r.nCoverAll, 84);
  assert.ok(r.recommendedN < 84);
  assert.equal(r.underpowered.length, 1);
  assert.equal(r.underpowered[0].name, 'Success');
  near(r.underpowered[0].powerAtRecommended, E.powerMcNemar(r.recommendedN, 0.6, 0.8, 0.05), 1e-15);
  assert.ok(r.underpowered[0].powerAtRecommended < 0.8);
});

test('plan: interaction comparisons are not available in this version', () => {
  throwsEngine(() => E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }, { name: 'Posture', levels: ['Seated', 'Standing'] }],
    comparisons: { list: [{ id: 'x', type: 'interaction' }] },
    measures: [{ name: 'Time', type: 'time', primary: true, effect: { mode: 'participants', k: 8 } }],
  }), /later version/);
});

test('plan: main effects are not available for success/failure measures', () => {
  throwsEngine(() => E.plan({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }, { name: 'Posture', levels: ['Seated', 'Standing'] }],
    comparisons: { list: [{ id: 'd', type: 'main', factor: 'Design', a: 'A', b: 'Current' }] },
    measures: [{ name: 'Success', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }],
  }), /only comparisons between specific conditions/);
});

test('plan: rejects an SD above the scale bound, a missing primary, and Cohen\'s d mode', () => {
  const study = (measures) => ({
    design: 'within',
    factors: [{ name: 'Design', levels: ['Current', 'A'] }],
    comparisons: { scheme: 'all-pairs' },
    measures,
  });
  throwsEngine(() => E.plan(study([{ name: 'SEQ', type: 'rating', primary: true, scale: { min: 1, max: 7 }, effect: { mode: 'units', delta: 1, sd: 3, mean: 6 } }])), /at most/);
  throwsEngine(() => E.plan(study([{ name: 'SEQ', type: 'rating', effect: { mode: 'participants', k: 8 } }])), /primary/);
  throwsEngine(() => E.plan(study([{ name: 'SEQ', type: 'rating', primary: true, effect: { mode: 'cohen', d: 0.5 } }])));
  throwsEngine(() => E.plan(study([{ name: 'SEQ', type: 'rating', primary: true, effect: { mode: 'participants', k: 10 } }])), /6 to 9/);
});

// ---------------------------------------------------------------------------
// Error fields (EngineError.field, measure, comparison, factor)
// ---------------------------------------------------------------------------

// Assert fn throws an EngineError carrying the given properties.
const throwsWhere = (fn, where) =>
  assert.throws(fn, (err) => {
    assert.ok(err instanceof E.EngineError, `expected EngineError, got ${err}`);
    Object.keys(where).forEach((key) => assert.equal(err[key], where[key], `${key} of "${err.message}"`));
    return true;
  });

const oneFactor = { name: 'Design', levels: ['Current', 'A'] };
const studyWith = (measures, extra) => Object.assign({
  design: 'within',
  factors: [oneFactor],
  comparisons: { scheme: 'all-pairs' },
  measures,
}, extra);
const timeWith = (effect) => [{ name: 'Time', type: 'time', unit: 's', primary: true, effect }];

test('errors: every input the form can reach names its field and measure', () => {
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'units', delta: 10, k: 5 }))), { field: 'k', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'participants', k: 10 }))), { field: 'k', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'units', delta: 0, k: 8 }))), { field: 'delta', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'units', delta: 10, sd: 0 }))), { field: 'sd', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'units', delta: 10 }))), { field: 'sd', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'units', delta: 10, sdDiff: -1 }))), { field: 'sdDiff', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'units', delta: 10, sd: 5, consistency: 'very' }))), { field: 'consistency' });
  throwsWhere(() => E.plan(studyWith(timeWith({ mode: 'cohen', d: 0.5 }))), { field: 'mode', measure: 'Time' });
  throwsWhere(() => E.plan(studyWith(timeWith(undefined))), { field: 'effect', measure: 'Time' });

  const seq = (effect) => [{ name: 'SEQ', type: 'rating', primary: true, scale: { min: 1, max: 7 }, effect }];
  throwsWhere(() => E.plan(studyWith(seq({ mode: 'units', delta: 1, sd: 3, mean: 6 }))), { field: 'sd', measure: 'SEQ' });
  throwsWhere(() => E.plan(studyWith(seq({ mode: 'units', delta: 1, sd: 1, mean: 9 }))), { field: 'mean', measure: 'SEQ' });

  const success = (effect) => [{ name: 'Success', type: 'binary', primary: true, effect }];
  throwsWhere(() => E.plan(studyWith(success({ p1: 1.2, p2: 0.8 }))), { field: 'p1', measure: 'Success' });
  throwsWhere(() => E.plan(studyWith(success({ p1: 0.6, p2: 0 }))), { field: 'p2', measure: 'Success' });
  throwsWhere(() => E.plan(studyWith(success({ p1: 0.6, p2: 0.6 }))), { field: 'p2', measure: 'Success' });
  throwsWhere(() => E.plan(studyWith(success({ p1: 0.6, p2: 0.8, psi: 0.1 }))), { field: 'psi', measure: 'Success' });
  throwsWhere(() => E.plan(studyWith(success({ p1: 0.6, p2: 0.8, psi: 0.7 }))), { field: 'psi', measure: 'Success' });
  throwsWhere(() => E.plan(Object.assign(studyWith(success({ p1: 0.6, p2: 0.6 })), { design: 'between' })),
    { field: 'p2', measure: 'Success' });
});

test('errors: study-level inputs name their field', () => {
  const ok = timeWith({ mode: 'participants', k: 8 });
  throwsWhere(() => E.plan(studyWith(ok, { alpha: 1.5 })), { field: 'alpha' });
  throwsWhere(() => E.plan(studyWith(ok, { power: 0 })), { field: 'power' });
  throwsWhere(() => E.plan(studyWith(ok, { design: 'mixed' })), { field: 'design' });
  throwsWhere(() => E.plan(studyWith(ok, { factors: [{ name: 'Design', levels: ['A', 'A'] }] })), { field: 'levels', factor: 'Design' });
  throwsWhere(() => E.plan(studyWith(ok, { factors: [{ name: 'Design', levels: ['A'] }] })), { field: 'levels', factor: 'Design' });
  throwsWhere(() => E.plan(studyWith(ok, { factors: [] })), { field: 'factors' });
  throwsWhere(() => E.plan(studyWith(ok, { comparisons: undefined })), { field: 'comparisons' });
  throwsWhere(() => E.plan(studyWith([])), { field: 'measures' });
  throwsWhere(() => E.plan(studyWith([{ name: 'Time', type: 'time', effect: { mode: 'participants', k: 8 } }])), { field: 'primary' });
  throwsWhere(() => E.plan(studyWith([{ name: 'Odd', type: 'shape', primary: true, effect: {} }])), { field: 'type', measure: 'Odd' });
});

test('errors: comparisons name the comparison, and per-comparison inputs say which one', () => {
  const twoFactors = [oneFactor, { name: 'Posture', levels: ['Seated', 'Standing'] }];
  throwsWhere(() => E.plan({
    design: 'within',
    factors: twoFactors,
    comparisons: { list: [{ id: 'x', type: 'interaction' }] },
    measures: timeWith({ mode: 'participants', k: 8 }),
  }), { field: 'comparisons', comparison: 'x' });
  throwsWhere(() => E.plan({
    design: 'within',
    factors: twoFactors,
    comparisons: { list: [{ id: 'design', type: 'main', factor: 'Design', a: 'A', b: 'Current' }] },
    measures: [{ name: 'Success', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }],
  }), { field: 'comparisons', measure: 'Success', comparison: 'design', factor: 'Design' });
  throwsWhere(() => E.plan({
    design: 'within',
    factors: twoFactors,
    comparisons: {
      list: [
        { id: 'design', type: 'main', factor: 'Design', a: 'A', b: 'Current' },
        { id: 'seated', type: 'cell', a: ['A', 'Seated'], b: ['Current', 'Seated'] },
      ],
    },
    measures: [{
      name: 'Time', type: 'time', primary: true,
      effect: { byComparison: { design: { mode: 'participants', k: 8 }, seated: { mode: 'units', delta: 5, k: 4 } } },
    }],
  }), { field: 'k', measure: 'Time', comparison: 'seated' });
});

test('errors: problem discovery and helpers name their field', () => {
  throwsWhere(() => E.nProblemDiscovery(0, 0.8), { field: 'p' });
  throwsWhere(() => E.nProblemDiscovery(0.1, 1), { field: 'P' });
  throwsWhere(() => E.smallestFrequencySeen(0, 0.8), { field: 'participants' });
  throwsWhere(() => E.sdDiffFromK(10, 5), { field: 'k' });
  throwsWhere(() => E.checkBoundedSd(4, 4, 1, 7), { field: 'sd' });
  // Errors made directly keep null for anything not given.
  const plain = new E.EngineError('x');
  assert.equal(plain.field, null);
  assert.equal(plain.measure, null);
});

// ---------------------------------------------------------------------------
// plan() and nProblemDiscovery() output additions
// ---------------------------------------------------------------------------

// The running example (design/README.md): three keyboard designs, within
// subjects, every pair compared (3 comparisons), always adjusted.
const runningExample = () => E.plan({
  design: 'within',
  factors: [{ name: 'Keyboard design', levels: ['Current', 'Prototype A', 'Prototype B'] }],
  comparisons: { scheme: 'all-pairs' },
  measures: [
    { name: 'Task time', type: 'time', unit: 'seconds', primary: true, effect: { mode: 'units', delta: 10, k: 8 } },
    { name: 'NASA-TLX', type: 'rating', unit: 'points', scale: { min: 0, max: 100 }, effect: { mode: 'units', delta: 10, sd: 15, consistency: 'medium' } },
    { name: 'Task success', type: 'binary', effect: { p1: 0.7, p2: 0.85 } },
  ],
});

test('plan: participants per order, and whether ψ was entered', () => {
  const r = runningExample();
  // Answer-key rows 5b and 8: 18, then 19, then 24 for 6 orders.
  assert.equal(r.recommendedN, 24);
  assert.equal(r.orders, 6);
  assert.equal(r.participantsPerOrder, 4);
  assert.equal(r.measures[2].comparisons[0].effect.psiEntered, false);
  const entered = E.plan(studyWith([{ name: 'Success', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8, psi: 0.3 } }]));
  assert.equal(entered.measures[0].comparisons[0].effect.psiEntered, true);
  const between = E.plan(studyWith(timeWith({ mode: 'participants', k: 8 }), { design: 'between' }));
  assert.equal(between.participantsPerOrder, null);
});

test('problem discovery also returns the trail terms', () => {
  const r = E.nProblemDiscovery(0.1, 0.8);
  assert.equal(r.n, 16);
  near(r.missOne, 0.9, 1e-15);
  near(r.missAll, 0.2, 1e-15);
});

// ---------------------------------------------------------------------------
// confidenceReport() (methods.md §7)
// ---------------------------------------------------------------------------

test('answer key: rank-based confidence report, n = 12, alpha 0.025 (rows 7d, 7e)', () => {
  const r = E.confidenceT({ design: 'within', n: 12, alpha: 0.025, power: 0.8, rank: true, effectSize: DZ_K8, sd: 10 / DZ_K8 });
  near(r.power, 0.6036, 5e-5);
  near(r.detectable.units, 12.3455, 5e-4);
});

test('confidence report: running example at 12 participants (rank-based task time)', () => {
  const p = runningExample();
  const r = E.confidenceReport(p, 12);
  assert.equal(r.measure, 'Task time');
  assert.equal(r.mode, 'units');
  assert.equal(r.n, 12);
  assert.equal(r.rank, true);
  assert.equal(r.estimate, true);
  near(r.effectiveN, 12 * 3 / Math.PI, 1e-12);
  // Alpha 0.05 / 3 per comparison.
  near(r.power, 0.5261, 5e-5);
  near(r.detectable.units, 13.2136, 5e-4);
  // 7.5494 with the exact σ_diff = 11.8818 (answer-key row 7c uses 11.88 and gives 7.5482).
  near(r.precision.halfWidth, 7.5494, 5e-4);
  near(r.precision.low, 10 - r.precision.halfWidth, 1e-12);
  near(r.precision.high, 10 + r.precision.halfWidth, 1e-12);
  assert.equal(r.target.units, 10);
  // Same as calling confidenceT directly with the plan's values.
  const direct = E.confidenceT({ design: 'within', n: 12, alpha: 0.05 / 3, power: 0.8, rank: true, effectSize: DZ_K8, sd: 10 / DZ_K8 });
  near(r.power, direct.power, 1e-15);
  near(r.detectable.units, direct.detectable.units, 1e-12);
});

test('confidence report: secondary measures by name', () => {
  const p = runningExample();
  const tlx = E.confidenceReport(p, p.recommendedN, 'NASA-TLX');
  near(tlx.power, p.underpowered.find((u) => u.name === 'NASA-TLX').powerAtRecommended, 1e-12);
  const success = E.confidenceReport(p, p.recommendedN, 'Task success');
  assert.equal(success.mode, 'binary');
  near(success.power, p.underpowered.find((u) => u.name === 'Task success').powerAtRecommended, 1e-12);
  near(success.target.percentagePoints, 15, 1e-9);
  throwsWhere(() => E.confidenceReport(p, 18, 'Nope'), { field: 'measures' });
  throwsWhere(() => E.confidenceReport(p, 1), { field: 'participants', measure: 'Task time' });
  throwsWhere(() => E.confidenceReport(p, 12.5), { field: 'participants', measure: 'Task time' });
});

test('confidence report: total participants convert to the test n', () => {
  // Between, two conditions: n per condition = floor(total / 2).
  const between = E.plan({
    design: 'between',
    factors: [oneFactor],
    comparisons: { scheme: 'all-pairs' },
    measures: [{ name: 'Rating', type: 'rating', primary: true, effect: { mode: 'units', delta: 5, sd: 10 } }],
  });
  const b = E.confidenceReport(between, 51);
  assert.equal(b.n, 25);
  assert.equal(b.testDesign, 'between');
  near(b.power, E.powerIndependentT(25, 0.5, 0.05), 1e-15);

  // Between, main effect across 3 cells per level: per cell × 3.
  const main = E.plan({
    design: 'between',
    factors: [oneFactor, { name: 'Posture', levels: ['Seated', 'Standing', 'Walking'] }],
    comparisons: { list: [{ id: 'design', type: 'main', factor: 'Design', a: 'A', b: 'Current' }] },
    measures: [{ name: 'Rating', type: 'rating', primary: true, effect: { mode: 'units', delta: 5, sd: 10 } }],
  });
  const m = E.confidenceReport(main, 60);
  assert.equal(m.n, 30);
  near(m.power, E.powerIndependentT(30, 0.5, 0.05), 1e-15);

  // Within, values not linked to a participant: independent test with n = participants.
  const unlinked = E.plan(studyWith([{ name: 'Rating', type: 'rating', primary: true, linked: false, effect: { mode: 'units', delta: 5, sd: 10 } }]));
  const u = E.confidenceReport(unlinked, 40);
  assert.equal(u.n, 40);
  assert.equal(u.testDesign, 'between');
  near(u.power, E.powerIndependentT(40, 0.5, 0.05), 1e-15);
});

const round4 = (x) => Math.round(x * 1e4) / 1e4;

test('confidence report: default ψ is recalculated, entered ψ is held fixed', () => {
  const def = E.confidenceReport(E.plan(studyWith([{ name: 'S', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }])), 84);
  const directDef = E.confidenceBinary({ design: 'within', n: 84, p1: 0.6, p2: 0.8, alpha: 0.05 });
  near(def.detectable.percentagePoints, directDef.detectable.percentagePoints, 1e-12);
  near(def.psi, 0.44, 1e-12);
  const fixed = E.confidenceReport(E.plan(studyWith([{ name: 'S', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8, psi: 0.3 } }])), 84);
  const directFixed = E.confidenceBinary({ design: 'within', n: 84, p1: 0.6, p2: 0.8, alpha: 0.05, psi: 0.3 });
  near(fixed.detectable.percentagePoints, directFixed.detectable.percentagePoints, 1e-12);
  assert.notEqual(round4(fixed.detectable.percentagePoints), round4(def.detectable.percentagePoints));
});

test('confidence report: in participants mode, results are in k of 10 and precision is not reported', () => {
  const r = E.confidenceReport(E.plan(studyWith(timeWith({ mode: 'participants', k: 8 }))), 12);
  assert.equal(r.mode, 'participants');
  assert.equal(r.precision, null);
  near(r.target.kOf10, 8, 1e-12);
  assert.ok(r.detectable.kOf10 > 8);
});

// ---------------------------------------------------------------------------
// powerCurve() (methods.md §7.1)
// ---------------------------------------------------------------------------

// Trapezoid area of the target curve beyond the significance bar(s), with
// linear interpolation at each bar.
function areaBeyond(curve) {
  const pts = curve.points;
  const at = (x) => {
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i].x) {
        const t = (x - pts[i - 1].x) / (pts[i].x - pts[i - 1].x);
        return pts[i - 1].target + t * (pts[i].target - pts[i - 1].target);
      }
    }
    return pts[pts.length - 1].target;
  };
  const integrate = (lo, hi) => {
    if (!(hi > lo)) return 0;
    const xs = [lo].concat(pts.map((p) => p.x).filter((x) => x > lo && x < hi), [hi]);
    let a = 0;
    for (let i = 1; i < xs.length; i++) a += ((xs[i] - xs[i - 1]) * (at(xs[i]) + at(xs[i - 1]))) / 2;
    return a;
  };
  const xMin = pts[0].x;
  const xMax = pts[pts.length - 1].x;
  return integrate(curve.critical, xMax) + (curve.lowerCritical === null ? 0 : integrate(xMin, curve.lowerCritical));
}
const totalArea = (curve, key) => {
  let a = 0;
  for (let i = 1; i < curve.points.length; i++) {
    a += ((curve.points[i].x - curve.points[i - 1].x) * (curve.points[i][key] + curve.points[i - 1][key])) / 2;
  }
  return a;
};

const curveCases = () => {
  const between = (measures) => E.plan({ design: 'between', factors: [oneFactor], comparisons: { scheme: 'all-pairs' }, measures });
  return [
    ['t paired', E.confidenceReport(E.plan(studyWith([{ name: 'R', type: 'rating', unit: 'points', primary: true, effect: { mode: 'units', delta: 5, sdDiff: 10 } }])), 20)],
    ['t independent', E.confidenceReport(between([{ name: 'R', type: 'rating', unit: 'points', primary: true, effect: { mode: 'units', delta: 5, sd: 10 } }]), 80)],
    ['rank (running example)', E.confidenceReport(runningExample(), 12)],
    ['rank between', E.confidenceReport(between([{ name: 'T', type: 'time', unit: 's', primary: true, effect: { mode: 'units', delta: 10, sd: 20 } }]), 60)],
    ['McNemar', E.confidenceReport(runningExample(), 60, 'Task success')],
    ['two proportions', E.confidenceReport(between([{ name: 'S', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }]), 120)],
    ['two proportions, downward', E.confidenceReport(between([{ name: 'S', type: 'binary', primary: true, effect: { p1: 0.8, p2: 0.6 } }]), 120)],
    ['participants within', E.confidenceReport(E.plan(studyWith(timeWith({ mode: 'participants', k: 8 }))), 12)],
    ['participants between', E.confidenceReport(between([{ name: 'R', type: 'rating', primary: true, effect: { mode: 'participants', k: 7 } }]), 60)],
  ];
};

test('power curve: the shaded share equals the reported power (CDFs and sampled points)', () => {
  curveCases().forEach(([name, report]) => {
    const c = E.powerCurve(report);
    near(c.shadedShare, report.power, 1e-9, `${name}: shaded share from the CDFs`);
    near(c.unshadedShare, 1 - report.power, 1e-9, `${name}: unshaded share`);
    near(areaBeyond(c), report.power, 0.005, `${name}: integrated sampled points`);
  });
});

test('power curve: densities are non-negative and each curve has area about 1', () => {
  curveCases().forEach(([name, report]) => {
    const c = E.powerCurve(report);
    assert.ok(c.points.length > 100, name);
    assert.ok(c.points.every((p) => p.none >= 0 && p.target >= 0), `${name}: non-negative`);
    near(totalArea(c, 'none'), 1, 0.01, `${name}: no-difference curve area`);
    near(totalArea(c, 'target'), 1, 0.01, `${name}: target curve area`);
    assert.ok(c.critical > 0 && c.critical < c.xMax, `${name}: bar inside the axis`);
    assert.ok(c.yMax >= Math.max(...c.points.map((p) => p.target)), name);
    assert.equal(c.centers.none, 0);
  });
});

test('power curve: units, ticks and centers', () => {
  const c = E.powerCurve(E.confidenceReport(runningExample(), 12));
  assert.equal(c.axis.kind, 'units');
  near(c.centers.target, 10, 1e-9); // the target difference, in seconds
  assert.ok(c.axis.ticks.some((t) => t.value === 0 && t.x === 0));
  assert.ok(c.axis.ticks.every((t) => t.x === t.value));

  const mc = E.powerCurve(E.confidenceReport(runningExample(), 60, 'Task success'));
  assert.equal(mc.axis.kind, 'percentage points');
  near(mc.centers.target, 0.15, 1e-12);
  assert.ok(mc.axis.ticks.every((t) => Math.abs(t.value - 100 * t.x) < 1e-9));
});

test('power curve: two-proportion ticks convert back to percentage points with p₁ fixed', () => {
  const p = E.plan({ design: 'between', factors: [oneFactor], comparisons: { scheme: 'all-pairs' }, measures: [{ name: 'S', type: 'binary', primary: true, effect: { p1: 0.6, p2: 0.8 } }] });
  const c = E.powerCurve(E.confidenceReport(p, 120));
  assert.ok(c.axis.ticks.length >= 3);
  const a1 = Math.asin(Math.sqrt(0.6));
  c.axis.ticks.forEach((t) => {
    const p2 = Math.pow(Math.sin(a1 + t.x / 2), 2); // methods.md §7.1
    near(100 * (p2 - 0.6), t.value, 1e-9);
  });
  near(c.centers.target, Math.abs(E.cohensH(0.6, 0.8)), 1e-15);
});

test('power curve: in participants mode, ticks are labeled as k of 10', () => {
  const w = E.powerCurve(E.confidenceReport(E.plan(studyWith(timeWith({ mode: 'participants', k: 8 }))), 12));
  assert.equal(w.axis.kind, 'participants');
  assert.ok(w.axis.ticks.length >= 3);
  w.axis.ticks.forEach((t) => near(10 * E.normalCdf(t.x), t.value, 1e-9));
  const between = E.plan({ design: 'between', factors: [oneFactor], comparisons: { scheme: 'all-pairs' }, measures: [{ name: 'R', type: 'rating', primary: true, effect: { mode: 'participants', k: 7 } }] });
  const b = E.powerCurve(E.confidenceReport(between, 60));
  b.axis.ticks.forEach((t) => near(10 * E.normalCdf(t.x / Math.SQRT2), t.value, 1e-9));
});
