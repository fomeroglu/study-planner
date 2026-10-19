/*
 * Study planner calculation engine.
 *
 * Implements docs/methods.md. Every function names the methods.md section it
 * implements. No interface code lives here. Works as a plain browser script
 * (exposes globalThis.StudyEngine) and as a Node module (module.exports).
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = engine;
  } else {
    root.StudyEngine = engine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Errors and small helpers
  // ---------------------------------------------------------------------------

  /** Raised for any input the methods do not allow. Messages are plain language. */
  class EngineError extends Error {
    constructor(message) {
      super(message);
      this.name = 'EngineError';
    }
  }

  // Raise an input error. Used by every section of methods.md.
  function fail(message) {
    throw new EngineError(message);
  }

  // Input checks shared by every section of methods.md.
  function requireNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fail(`${name} must be a number.`);
    }
  }

  // Rates, alpha, power, p and P lie strictly between 0 and 1 (methods.md §3.2, §4, §9).
  function requireOpenUnit(value, name) {
    requireNumber(value, name);
    if (value <= 0 || value >= 1) fail(`${name} must be between 0 and 1, not ${value}.`);
  }

  // SDs, n and df must be positive (methods.md §3.1, §4).
  function requirePositive(value, name) {
    requireNumber(value, name);
    if (value <= 0) fail(`${name} must be greater than 0.`);
  }

  // methods.md Conventions: sample sizes are always rounded up. The small
  // tolerance stops floating-point noise (e.g. 200.00000000000003) from adding
  // a participant.
  function ceilN(x) {
    return Math.ceil(x - 1e-9);
  }

  // Bisection for a monotone function f on [lo, hi]; returns x with f(x) = target.
  // Used to solve n (methods.md §4), t quantiles (§4) and detectable differences (§7).
  function bisect(f, target, lo, hi, tol) {
    let flo = f(lo) - target;
    for (let i = 0; i < 400 && hi - lo > tol; i++) {
      const mid = 0.5 * (lo + hi);
      const fm = f(mid) - target;
      if ((fm < 0) === (flo < 0)) {
        lo = mid;
        flo = fm;
      } else {
        hi = mid;
      }
    }
    return 0.5 * (lo + hi);
  }

  // ---------------------------------------------------------------------------
  // Normal distribution (methods.md §3.1 Φ and Φ⁻¹; §4 z quantiles)
  // ---------------------------------------------------------------------------

  // Standard normal CDF. W. J. Cody (1969), "Rational Chebyshev approximations
  // for the error function", Mathematics of Computation 23, 631-637; the same
  // algorithm and coefficients as R's pnorm (nmath/pnorm.c).
  const PN_A = [2.2352520354606839287, 161.02823106855587881, 1067.6894854603709582,
    18154.981253343561249, 0.065682337918207449113];
  const PN_B = [47.20258190468824187, 976.09855173777669322, 10260.932208618978205,
    45507.789335026729956];
  const PN_C = [0.39894151208813466764, 8.8831497943883759412, 93.506656132177855979,
    597.27027639480026226, 2494.5375852903726711, 6848.1904505362823326,
    11602.651437647350124, 9842.7148383839780218, 1.0765576773720192317e-8];
  const PN_D = [22.266688044328115691, 235.38790178262499861, 1519.377599407554805,
    6485.558298266760755, 18615.571640885098091, 34900.952721145977266,
    38912.003286093271411, 19685.429676859990727];
  const PN_P = [0.21589853405795699, 0.1274011611602473639, 0.022235277870649807,
    0.001421619193227893466, 2.9112874951168792e-5, 0.02307344176494017303];
  const PN_Q = [1.28426009614491121, 0.468238212480865118, 0.0659881378689285515,
    0.00378239633202758244, 7.29751555083966205e-5];
  const SQRT_32 = 5.656854249492380195206754896838;
  const ONE_OVER_SQRT_2PI = 0.398942280401432677939946059934;

  /** Standard normal CDF Φ(x). methods.md §3.1, §4, §7. */
  function normalCdf(x) {
    if (Number.isNaN(x)) return NaN;
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    const y = Math.abs(x);
    if (y <= 0.67448975) {
      let xnum = 0;
      let xden = 0;
      if (y > 1.1102230246251565e-16) {
        const xsq = x * x;
        xnum = PN_A[4] * xsq;
        xden = xsq;
        for (let i = 0; i < 3; i++) {
          xnum = (xnum + PN_A[i]) * xsq;
          xden = (xden + PN_B[i]) * xsq;
        }
      }
      const temp = (x * (xnum + PN_A[3])) / (xden + PN_B[3]);
      return 0.5 + temp;
    }
    let temp;
    if (y <= SQRT_32) {
      let xnum = PN_C[8] * y;
      let xden = y;
      for (let i = 0; i < 7; i++) {
        xnum = (xnum + PN_C[i]) * y;
        xden = (xden + PN_D[i]) * y;
      }
      temp = (xnum + PN_C[7]) / (xden + PN_D[7]);
    } else {
      const xsq = 1 / (x * x);
      let xnum = PN_P[5] * xsq;
      let xden = xsq;
      for (let i = 0; i < 4; i++) {
        xnum = (xnum + PN_P[i]) * xsq;
        xden = (xden + PN_Q[i]) * xsq;
      }
      temp = (xsq * (xnum + PN_P[4])) / (xden + PN_Q[4]);
      temp = (ONE_OVER_SQRT_2PI - temp) / y;
    }
    // Split exp(-y^2/2) to keep precision (Cody's "do_del").
    const xsq = Math.trunc(y * 16) / 16;
    const del = (y - xsq) * (y + xsq);
    const cum = Math.exp(-xsq * xsq * 0.5) * Math.exp(-del * 0.5) * temp;
    return x > 0 ? 1 - cum : cum;
  }

  /**
   * Standard normal quantile Φ⁻¹(p). methods.md §3.1, §4.
   * M. J. Wichura (1988), Algorithm AS 241 (PPND16), Applied Statistics 37,
   * 477-484; the algorithm behind R's qnorm.
   */
  function normalQuantile(p) {
    requireNumber(p, 'Probability');
    if (p <= 0 || p >= 1) {
      if (p === 0) return -Infinity;
      if (p === 1) return Infinity;
      fail(`Probability must be between 0 and 1, not ${p}.`);
    }
    const q = p - 0.5;
    if (Math.abs(q) <= 0.425) {
      const r = 0.180625 - q * q;
      return (q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r +
        67265.770927008700853) * r + 45921.953931549871457) * r +
        13731.693765509461125) * r + 1971.5909503065514427) * r +
        133.14166789178437745) * r + 3.387132872796366608)) /
        (((((((r * 5226.495278852545925 + 28729.085735721942674) * r +
          39307.89580009271061) * r + 21213.794301586595867) * r +
          5394.1960214247511077) * r + 687.1870074920579083) * r +
          42.313330701600911252) * r + 1);
    }
    let r = q < 0 ? p : 1 - p;
    r = Math.sqrt(-Math.log(r));
    let val;
    if (r <= 5) {
      r -= 1.6;
      val = (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r +
        0.24178072517745061177) * r + 1.27045825245236838258) * r +
        3.64784832476320460504) * r + 5.7694972214606914055) * r +
        4.6303378461565452959) * r + 1.42343711074968357734) /
        (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r +
          0.0151986665636164571966) * r + 0.14810397642748007459) * r +
          0.68976733498510000455) * r + 1.6763848301838038494) * r +
          2.05319162663775882187) * r + 1);
    } else {
      r -= 5;
      val = (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r +
        0.0012426609473880784386) * r + 0.026532189526576123093) * r +
        0.29656057182850489123) * r + 1.7848265399172913358) * r +
        5.4637849111641143699) * r + 6.6579046435011037772) /
        (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r +
          1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r +
          0.0148753612908506148525) * r + 0.13692988092273580531) * r +
          0.59983220655588793769) * r + 1);
    }
    return q < 0 ? -val : val;
  }

  // ---------------------------------------------------------------------------
  // Gamma and incomplete beta (support for §4 and §7 t distributions)
  // ---------------------------------------------------------------------------

  // Lanczos approximation as given in W. H. Press, S. A. Teukolsky,
  // W. T. Vetterling & B. P. Flannery (2007), Numerical Recipes, 3rd ed.,
  // section 6.1 (gammln). Relative accuracy about 1e-15.
  const LANCZOS = [57.1562356658629235, -59.5979603554754912, 14.1360979747417471,
    -0.491913816097620199, 0.339946499848118887e-4, 0.465236289270485756e-4,
    -0.983744753048795646e-4, 0.158088703224912494e-3, -0.210264441724104883e-3,
    0.217439618115212643e-3, -0.164318106536763890e-3, 0.844182239838527433e-4,
    -0.261908384015814087e-4, 0.368991826595316234e-5];

  /** log Γ(x) for x > 0. Supports methods.md §4 (t distributions). */
  function logGamma(x) {
    if (!(x > 0)) fail('logGamma needs a positive argument.');
    let y = x;
    let tmp = x + 5.2421875;
    tmp = (x + 0.5) * Math.log(tmp) - tmp;
    let ser = 0.999999999999997092;
    for (let j = 0; j < 14; j++) ser += LANCZOS[j] / ++y;
    return tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  // Continued fraction for the incomplete beta, evaluated with the modified
  // Lentz method: Press et al. (2007), Numerical Recipes, 3rd ed., section 6.4
  // (betacf).
  // Supports methods.md §4 (t distributions).
  function betaContinuedFraction(a, b, x) {
    const FPMIN = 1e-300;
    const EPS = 1e-16;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 10000; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) <= EPS) break;
    }
    return h;
  }

  /**
   * Regularized incomplete beta I_x(a, b). Supports methods.md §4.
   * Press et al. (2007), Numerical Recipes, 3rd ed., section 6.4 (betai),
   * using the symmetry I_x(a,b) = 1 − I_{1−x}(b,a) for fast convergence.
   */
  function incompleteBeta(x, a, b) {
    if (!(a > 0) || !(b > 0)) fail('Incomplete beta needs positive shape values.');
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) +
      a * Math.log(x) + b * Math.log1p(-x);
    const bt = Math.exp(lbt);
    if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a;
    return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
  }

  // ---------------------------------------------------------------------------
  // t distribution (methods.md §4, §7)
  // ---------------------------------------------------------------------------

  /** Central t CDF, P(T ≤ t) with df degrees of freedom. methods.md §4, §7. */
  function tCdf(t, df) {
    requirePositive(df, 'Degrees of freedom');
    if (t === Infinity) return 1;
    if (t === -Infinity) return 0;
    if (t === 0) return 0.5;
    const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
    return t > 0 ? 1 - tail : tail;
  }

  /** t quantile, solved numerically from tCdf. methods.md §4, §7. */
  function tQuantile(p, df) {
    requireOpenUnit(p, 'Probability');
    requirePositive(df, 'Degrees of freedom');
    if (p === 0.5) return 0;
    // Work in the upper half, then reflect.
    const upper = p > 0.5;
    const target = upper ? p : 1 - p;
    let hi = 1;
    while (tCdf(hi, df) < target) hi *= 2;
    const t = bisect((x) => tCdf(x, df), target, 0, hi, 1e-13 * Math.max(1, hi));
    return upper ? t : -t;
  }

  /**
   * Noncentral t CDF, P(T′ ≤ t) with df degrees of freedom and noncentrality
   * ncp. methods.md §4. R. V. Lenth (1989), Algorithm AS 243, Applied
   * Statistics 38, 185-189, with the refinements in R's pnt.c that pt() uses:
   * errmax 1e-12, itrmax 1000, reflection for t < 0, the central t when
   * ncp = 0, and the Abramowitz & Stegun 26.7.10 normal approximation for
   * very large df or ncp.
   */
  function noncentralTCdf(t, df, ncp) {
    requirePositive(df, 'Degrees of freedom');
    requireNumber(ncp, 'Noncentrality');
    if (ncp === 0) return tCdf(t, df);
    if (t === Infinity) return 1;
    if (t === -Infinity) return 0;

    const ITRMAX = 1000;
    const ERRMAX = 1e-12;
    let negdel;
    let tt;
    let del;
    if (t >= 0) {
      negdel = false;
      tt = t;
      del = ncp;
    } else {
      if (ncp > 40) return 0;
      negdel = true;
      tt = -t;
      del = -ncp;
    }

    // 2 * ln 2 * 1021 (DBL_MIN_EXP = -1021): beyond this exp(-del²/2) underflows.
    if (df > 4e5 || del * del > 2 * Math.LN2 * 1021) {
      const s = 1 / (4 * df);
      const z = (tt * (1 - s) - del) / Math.sqrt(1 + tt * tt * 2 * s);
      const lower = normalCdf(z);
      return negdel ? 1 - lower : lower;
    }

    let x = tt * tt;
    let rxb = df / (x + df);
    x = x / (x + df);
    let tnc;
    if (x > 0) {
      const lambda = del * del;
      let p = 0.5 * Math.exp(-0.5 * lambda);
      if (p === 0) return negdel ? 1 : 0;
      let q = Math.sqrt(2 / Math.PI) * p * del;
      let s = 0.5 - p;
      if (s < 1e-7) s = -0.5 * Math.expm1(-0.5 * lambda);
      let a = 0.5;
      const b = 0.5 * df;
      rxb = Math.pow(rxb, b);
      const albeta = 0.5 * Math.log(Math.PI) + logGamma(b) - logGamma(0.5 + b);
      let xodd = incompleteBeta(x, a, b);
      let godd = 2 * rxb * Math.exp(a * Math.log(x) - albeta);
      tnc = b * x;
      let xeven = tnc < Number.EPSILON ? tnc : 1 - rxb;
      let geven = tnc * rxb;
      tnc = p * xodd + q * xeven;
      for (let it = 1; it <= ITRMAX; it++) {
        a += 1;
        xodd -= godd;
        xeven -= geven;
        godd *= (x * (a + b - 1)) / a;
        geven *= (x * (a + b - 0.5)) / (a + 0.5);
        p *= lambda / (2 * it);
        q *= lambda / (2 * it + 1);
        tnc += p * xodd + q * xeven;
        s -= p;
        if (s < -1e-10) break;
        if (s <= 0 && it > 1) break;
        const errbd = 2 * s * (xodd - godd);
        if (Math.abs(errbd) < ERRMAX) break;
      }
    } else {
      tnc = 0;
    }
    tnc += normalCdf(-del);
    tnc = Math.min(tnc, 1);
    return negdel ? 1 - tnc : tnc;
  }

  // ---------------------------------------------------------------------------
  // Sample size and power (methods.md §4, §2.1)
  // ---------------------------------------------------------------------------

  // Alpha and power are probabilities (methods.md Conventions, §4).
  function requireAlphaPower(alpha, power) {
    requireOpenUnit(alpha, 'Alpha');
    if (power !== undefined) requireOpenUnit(power, 'Power');
  }

  // methods.md §4 "Power, t-tests": two-sided power counts both rejection
  // regions, P(T′ > t_c) + P(T′ < −t_c).
  function twoSidedTPower(df, ncp, alpha) {
    const tc = tQuantile(1 - alpha / 2, df);
    const absNcp = Math.abs(ncp);
    return (1 - noncentralTCdf(tc, df, absNcp)) + noncentralTCdf(-tc, df, absNcp);
  }

  /** Power of the paired t-test: df = n − 1, ncp = dz·√n. methods.md §4. */
  function powerPairedT(n, dz, alpha) {
    requireNumber(dz, 'Effect size (dz)');
    requireAlphaPower(alpha);
    if (!(n > 1)) fail('The paired t-test needs at least 2 participants.');
    return twoSidedTPower(n - 1, dz * Math.sqrt(n), alpha);
  }

  /**
   * Power of the independent t-test, n per condition: df = 2(n − 1),
   * ncp = d·√(n/2). methods.md §4.
   */
  function powerIndependentT(n, d, alpha) {
    requireNumber(d, 'Effect size (d)');
    requireAlphaPower(alpha);
    if (!(n > 1)) fail('The independent t-test needs at least 2 participants per condition.');
    return twoSidedTPower(2 * (n - 1), d * Math.sqrt(n / 2), alpha);
  }

  // Solve continuous n where power reaches the target, then round up (methods.md §4).
  function solveN(powerFn, effect, alpha, power, label) {
    requireAlphaPower(alpha, power);
    requireNumber(effect, label);
    if (effect === 0) fail('The difference that matters must not be zero.');
    const f = (n) => powerFn(n, effect, alpha);
    if (f(2) >= power) return { exact: 2, n: 2 };
    let hi = 4;
    while (f(hi) < power) {
      hi *= 2;
      if (hi > 1e7) fail('The difference is too small to detect with any practical sample.');
    }
    const exact = bisect(f, power, 2, hi, 1e-10);
    return { exact, n: ceilN(exact) };
  }

  /** Participants for the paired t-test (continuous and rounded up). methods.md §4. */
  function nPairedT(dz, alpha, power) {
    return solveN(powerPairedT, dz, alpha, power, 'Effect size (dz)');
  }

  /** Participants per condition for the independent t-test. methods.md §4. */
  function nIndependentT(d, alpha, power) {
    return solveN(powerIndependentT, d, alpha, power, 'Effect size (d)');
  }

  /** Cohen's h = 2·arcsin(√p₁) − 2·arcsin(√p₂). methods.md §4. */
  function cohensH(p1, p2) {
    requireOpenUnit(p1, 'Success rate 1');
    requireOpenUnit(p2, 'Success rate 2');
    return 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2));
  }

  /** n per condition = 2·((z₁₋α/₂ + z₁₋β)/h)². methods.md §4. */
  function nTwoProportions(p1, p2, alpha, power) {
    requireAlphaPower(alpha, power);
    const h = cohensH(p1, p2);
    if (h === 0) fail('The two success rates must differ.');
    const z = normalQuantile(1 - alpha / 2) + normalQuantile(power);
    const exact = 2 * (z / h) * (z / h);
    return { h, exact, n: ceilN(exact) };
  }

  /** Power of the two-proportion test at n per condition. methods.md §7. */
  function powerTwoProportions(n, p1, p2, alpha) {
    requireAlphaPower(alpha);
    requirePositive(n, 'Participants');
    const h = Math.abs(cohensH(p1, p2));
    const za = normalQuantile(1 - alpha / 2);
    const shift = h * Math.sqrt(n / 2);
    return normalCdf(shift - za) + normalCdf(-shift - za);
  }

  /** Default discordance ψ = p₁(1 − p₂) + p₂(1 − p₁). methods.md §3.2. */
  function defaultDiscordance(p1, p2) {
    requireOpenUnit(p1, 'Success rate 1');
    requireOpenUnit(p2, 'Success rate 2');
    return p1 * (1 - p2) + p2 * (1 - p1);
  }

  // methods.md §3.2: an entered ψ must be at least |p₂ − p₁|, and no more than
  // the two rates allow.
  function checkDiscordance(p1, p2, psi) {
    requireOpenUnit(psi, 'Share who differ between conditions (discordance)');
    const delta = Math.abs(p2 - p1);
    if (psi < delta - 1e-12) {
      fail(`The share who differ between conditions (discordance) must be at least ` +
        `the difference in success rates (${round(delta, 4)}).`);
    }
    const maxPsi = Math.min(p1, 1 - p2) + Math.min(p2, 1 - p1);
    if (psi > maxPsi + 1e-12) {
      fail(`With success rates of ${p1} and ${p2}, the share who differ between ` +
        `conditions (discordance) can be at most ${round(maxPsi, 4)}.`);
    }
  }

  /**
   * McNemar's test (Connor, 1987): n = [z₁₋α/₂·√ψ + z₁₋β·√(ψ − δ²)]² / δ².
   * psi defaults to defaultDiscordance(p1, p2). methods.md §3.2, §4.
   */
  function nMcNemar(p1, p2, alpha, power, psi) {
    requireAlphaPower(alpha, power);
    requireOpenUnit(p1, 'Success rate 1');
    requireOpenUnit(p2, 'Success rate 2');
    const delta = p2 - p1;
    if (delta === 0) fail('The two success rates must differ.');
    const usedPsi = psi === undefined ? defaultDiscordance(p1, p2) : psi;
    checkDiscordance(p1, p2, usedPsi);
    const za = normalQuantile(1 - alpha / 2);
    const zb = normalQuantile(power);
    const num = za * Math.sqrt(usedPsi) + zb * Math.sqrt(usedPsi - delta * delta);
    const exact = (num * num) / (delta * delta);
    return { psi: usedPsi, delta, exact, n: ceilN(exact) };
  }

  /** Power of McNemar's test at n participants (Connor solved for power). methods.md §7. */
  function powerMcNemar(n, p1, p2, alpha, psi) {
    requireAlphaPower(alpha);
    requirePositive(n, 'Participants');
    const delta = Math.abs(p2 - p1);
    const usedPsi = psi === undefined ? defaultDiscordance(p1, p2) : psi;
    checkDiscordance(p1, p2, usedPsi);
    const za = normalQuantile(1 - alpha / 2);
    return normalCdf((delta * Math.sqrt(n) - za * Math.sqrt(usedPsi)) /
      Math.sqrt(usedPsi - delta * delta));
  }

  /** Asymptotic relative efficiency of rank-based tests, 3/π. methods.md §2.1. */
  const RANK_EFFICIENCY = 3 / Math.PI;

  /** Rank-based adjustment: ceil(n ÷ (3/π)), n already rounded up. methods.md §2.1. */
  function rankAdjust(n) {
    requirePositive(n, 'Participants');
    return ceilN(n / RANK_EFFICIENCY);
  }

  // ---------------------------------------------------------------------------
  // Comparisons and alpha (methods.md §1.1, §1.2, §1.3, §1.5)
  // ---------------------------------------------------------------------------

  /** m for "each vs. baseline" (k − 1) or "every pair" (k(k − 1)/2). methods.md §1.2. */
  function countComparisons(k, scheme) {
    if (!Number.isInteger(k) || k < 2) fail('A study needs at least 2 conditions.');
    if (scheme === 'baseline') return k - 1;
    if (scheme === 'all-pairs') return (k * (k - 1)) / 2;
    fail(`Unknown comparison choice "${scheme}". Use "baseline" or "all-pairs".`);
  }

  /** Alpha per comparison: alpha / m (Bonferroni) when adjusting, else alpha. methods.md §1.3. */
  function alphaPerComparison(alpha, m, adjust) {
    requireOpenUnit(alpha, 'Alpha');
    if (!Number.isInteger(m) || m < 1) fail('There must be at least one comparison.');
    return adjust ? alpha / m : alpha;
  }

  /** Every combination of levels across the factors, in order. methods.md §1.1. */
  function buildCells(factors) {
    if (!Array.isArray(factors) || factors.length === 0) {
      fail('The study needs at least one independent variable.');
    }
    factors.forEach((f) => {
      if (!f || !Array.isArray(f.levels) || f.levels.length < 2) {
        fail(`Each independent variable needs at least 2 conditions (${f && f.name}).`);
      }
      if (new Set(f.levels).size !== f.levels.length) {
        fail(`Condition names must be unique within ${f.name}.`);
      }
    });
    let cells = [[]];
    factors.forEach((f) => {
      const next = [];
      cells.forEach((c) => f.levels.forEach((l) => next.push(c.concat([l]))));
      cells = next;
    });
    return cells;
  }

  /** Cells per level of one factor when the others are pooled. methods.md §1.5. */
  function cellsPerLevel(factors, factorName) {
    const idx = factors.findIndex((f) => f.name === factorName);
    if (idx < 0) fail(`Unknown independent variable "${factorName}".`);
    return factors.reduce((acc, f, i) => (i === idx ? acc : acc * f.levels.length), 1);
  }

  // ---------------------------------------------------------------------------
  // Variability and effect size (methods.md §3.1)
  // ---------------------------------------------------------------------------

  const CONSISTENCY_RHO = { low: 0.3, medium: 0.5, high: 0.7 };

  /** Consistency across conditions → ρ. Default Low (the cautious choice). methods.md §3.1. */
  function rhoFromConsistency(level) {
    const key = level === undefined ? 'low' : level;
    if (!Object.prototype.hasOwnProperty.call(CONSISTENCY_RHO, key)) {
      fail(`Consistency must be "low", "medium", or "high", not "${level}".`);
    }
    return CONSISTENCY_RHO[key];
  }

  /** σ_diff = σ·√(2(1 − ρ)). methods.md §3.1. */
  function sdDiffFromSd(sd, rho) {
    requirePositive(sd, 'Standard deviation');
    requireNumber(rho, 'Correlation');
    if (rho <= -1 || rho >= 1) fail('The correlation must be between -1 and 1.');
    return sd * Math.sqrt(2 * (1 - rho));
  }

  // k of 10 is accepted only as a whole number from 6 to 9 (methods.md §3.1).
  function requireK(k) {
    if (!Number.isInteger(k) || k < 6 || k > 9) {
      fail(`"How many of 10 participants would do better" must be a whole number from 6 to 9, not ${k}.`);
    }
  }

  /** Within: σ_diff = Δ / Φ⁻¹(k/10). methods.md §3.1. */
  function sdDiffFromK(delta, k) {
    requirePositive(Math.abs(delta), 'The difference that matters');
    requireK(k);
    return Math.abs(delta) / normalQuantile(k / 10);
  }

  /** Between: σ = Δ / (√2·Φ⁻¹(k/10)). methods.md §3.1. */
  function sdFromK(delta, k) {
    requirePositive(Math.abs(delta), 'The difference that matters');
    requireK(k);
    return Math.abs(delta) / (Math.SQRT2 * normalQuantile(k / 10));
  }

  /** Within: dz = Φ⁻¹(k/10). methods.md §3.1. */
  function dzFromK(k) {
    requireK(k);
    return normalQuantile(k / 10);
  }

  /** Between: d = √2·Φ⁻¹(k/10). methods.md §3.1. */
  function dFromK(k) {
    requireK(k);
    return Math.SQRT2 * normalQuantile(k / 10);
  }

  /** "k of 10 do better" from dz: 10·Φ(dz). methods.md §7. */
  function kFromDz(dz) {
    return 10 * normalCdf(dz);
  }

  /** "k of 10 do better" from d: 10·Φ(d/√2). methods.md §7. */
  function kFromD(d) {
    return 10 * normalCdf(d / Math.SQRT2);
  }

  // ---------------------------------------------------------------------------
  // Bounded scales (methods.md §2, §2.2)
  // ---------------------------------------------------------------------------

  /** Measure presets. methods.md §2. */
  const PRESETS = {
    'nasa-tlx': { name: 'NASA-TLX (raw)', type: 'rating', min: 0, max: 100 },
    sus: { name: 'SUS', type: 'rating', min: 0, max: 100 },
    seq: { name: 'SEQ', type: 'rating', min: 1, max: 7 },
  };

  /** Largest possible SD on [min, max] at a given mean (Bhatia & Davis, 2000). methods.md §2.2. */
  function maxSdOnScale(mean, min, max) {
    requireNumber(mean, 'Expected average');
    requireNumber(min, 'Scale minimum');
    requireNumber(max, 'Scale maximum');
    if (!(max > min)) fail('The scale maximum must be above the minimum.');
    if (mean < min || mean > max) fail(`The expected average must lie between ${min} and ${max}.`);
    return Math.sqrt((max - mean) * (mean - min));
  }

  /** Reject an SD above the Bhatia–Davis bound. methods.md §2.2. */
  function checkBoundedSd(sd, mean, min, max) {
    requirePositive(sd, 'Standard deviation');
    const bound = maxSdOnScale(mean, min, max);
    if (sd > bound + 1e-12) {
      fail(`On a ${min} to ${max} scale with an average of ${mean}, the standard deviation ` +
        `can be at most ${round(bound, 2)}. ${sd} is not possible.`);
    }
    return bound;
  }

  // ---------------------------------------------------------------------------
  // Confidence report (methods.md §7)
  // ---------------------------------------------------------------------------

  // Detectable difference: effect size where power reaches the target (methods.md §7).
  function solveEffect(powerAt, target, hiStart) {
    let hi = hiStart;
    while (powerAt(hi) < target) {
      hi *= 2;
      if (hi > 1e6) return null;
    }
    return bisect(powerAt, target, 0, hi, 1e-12);
  }

  /**
   * Confidence report for a t-based measure. methods.md §7.
   * opts: { design: 'within' | 'between', n (participants within, per condition
   * between), alpha, power, rank (bool), effectSize (dz or d, the target), and
   * for results in units: delta and sd (σ_diff within, σ between) }.
   * Rank-based measures use effective n = n × 3/π for power and detectable
   * difference, and the actual n for precision.
   */
  function confidenceT(opts) {
    const { design, n, alpha } = opts;
    const target = opts.power === undefined ? 0.8 : opts.power;
    requireAlphaPower(alpha, target);
    if (design !== 'within' && design !== 'between') fail('Design must be "within" or "between".');
    if (!(n >= 2)) fail('The confidence report needs at least 2 participants.');
    const nEff = opts.rank ? n * RANK_EFFICIENCY : n;
    const powerFn = design === 'within' ? powerPairedT : powerIndependentT;
    if (!(nEff > 1)) fail('Too few participants for the rank-based test.');

    const effectSize = opts.effectSize;
    const result = { n, effectiveN: nEff };
    result.power = effectSize === undefined ? null : powerFn(nEff, Math.abs(effectSize), alpha);

    const es = solveEffect((e) => powerFn(nEff, e, alpha), target, 1);
    const hasUnits = opts.sd !== undefined;
    result.detectable = {
      effectSize: es,
      units: hasUnits && es !== null ? es * opts.sd : null,
      kOf10: es === null ? null : design === 'within' ? kFromDz(es) : kFromD(es),
    };

    if (hasUnits) {
      requirePositive(opts.sd, 'Standard deviation');
      const df = design === 'within' ? n - 1 : 2 * (n - 1);
      const se = design === 'within' ? opts.sd / Math.sqrt(n) : opts.sd * Math.sqrt(2 / n);
      result.precision = { halfWidth: tQuantile(0.975, df) * se, se, df };
    } else {
      result.precision = null;
    }
    return result;
  }

  /**
   * Confidence report for a success / failure measure. methods.md §7.
   * opts: { design: 'within' (McNemar) | 'between' (two proportions), n
   * (participants within, per condition between), p1, p2, psi (optional,
   * within only), alpha, power }.
   * Detectable difference: p₁ fixed, smallest p₂ in the entered direction that
   * reaches the chosen power, in percentage points.
   */
  function confidenceBinary(opts) {
    const { design, n, p1, p2, alpha } = opts;
    const target = opts.power === undefined ? 0.8 : opts.power;
    requireAlphaPower(alpha, target);
    requireOpenUnit(p1, 'Success rate 1');
    requireOpenUnit(p2, 'Success rate 2');
    requirePositive(n, 'Participants');
    if (p1 === p2) fail('The two success rates must differ.');
    const dir = p2 > p1 ? 1 : -1;
    const fixedPsi = opts.psi;
    let powerAtP2;
    let halfWidth;
    const z975 = normalQuantile(0.975);
    if (design === 'between') {
      powerAtP2 = (q2) => powerTwoProportions(n, p1, q2, alpha);
      halfWidth = z975 * Math.sqrt((p1 * (1 - p1)) / n + (p2 * (1 - p2)) / n);
    } else if (design === 'within') {
      const psiFor = (q2) => (fixedPsi === undefined ? defaultDiscordance(p1, q2) : fixedPsi);
      powerAtP2 = (q2) => {
        const psi = psiFor(q2);
        const d = Math.abs(q2 - p1);
        if (psi - d * d <= 0 || psi <= d) return 1;
        return normalCdf((d * Math.sqrt(n) - zTwoSided(alpha) * Math.sqrt(psi)) /
          Math.sqrt(psi - d * d));
      };
      const psi = psiFor(p2);
      checkDiscordance(p1, p2, psi);
      const delta = p2 - p1;
      halfWidth = z975 * Math.sqrt((psi - delta * delta) / n);
    } else {
      fail('Design must be "within" or "between".');
    }

    // Search p₂ between p₁ and the end of the scale in the entered direction.
    // With a fixed ψ, |p₂ − p₁| must stay below ψ.
    let limit = dir > 0 ? 1 - 1e-9 : 1e-9;
    if (design === 'within' && fixedPsi !== undefined) {
      limit = dir > 0 ? Math.min(limit, p1 + fixedPsi - 1e-9) : Math.max(limit, p1 - fixedPsi + 1e-9);
    }
    const powerAtDiff = (d) => powerAtP2(p1 + dir * d);
    const maxDiff = Math.abs(limit - p1);
    let detectableP2 = null;
    if (powerAtDiff(maxDiff) >= target) {
      const d = bisect(powerAtDiff, target, 0, maxDiff, 1e-12);
      detectableP2 = p1 + dir * d;
    }

    const power = design === 'between'
      ? powerTwoProportions(n, p1, p2, alpha)
      : powerMcNemar(n, p1, p2, alpha, fixedPsi);
    return {
      n,
      power,
      detectable: detectableP2 === null ? null : {
        p2: detectableP2,
        percentagePoints: 100 * Math.abs(detectableP2 - p1),
      },
      precision: { halfWidth, percentagePoints: 100 * halfWidth },
    };
  }

  // z₁₋α/₂ for the two-sided test (methods.md §4, §7).
  function zTwoSided(alpha) {
    return normalQuantile(1 - alpha / 2);
  }

  // ---------------------------------------------------------------------------
  // Counterbalancing (methods.md §6)
  // ---------------------------------------------------------------------------

  /**
   * Balanced Latin square orders (Williams, 1949) for k conditions, as arrays
   * of condition indices. k orders when k is even, 2k when k is odd (the
   * square plus its mirror image). Two conditions give two orders. methods.md §6.
   */
  function williamsSquare(k) {
    if (!Number.isInteger(k) || k < 2) fail('Counterbalancing needs at least 2 conditions.');
    // First row: 0, 1, k−1, 2, k−2, ...
    const first = [0];
    for (let i = 1, lo = 1, hi = k - 1; i < k; i++) {
      first.push(i % 2 === 1 ? lo++ : hi--);
    }
    const rows = [];
    for (let r = 0; r < k; r++) rows.push(first.map((c) => (c + r) % k));
    if (k % 2 === 1) {
      for (let r = 0; r < k; r++) rows.push(rows[r].slice().reverse());
    }
    return rows;
  }

  /** Number of counterbalancing orders: k (even k) or 2k (odd k). methods.md §6. */
  function orderCount(k) {
    if (!Number.isInteger(k) || k < 2) fail('Counterbalancing needs at least 2 conditions.');
    return k % 2 === 0 ? k : 2 * k;
  }

  /** Round n up to a multiple of the number of orders. methods.md §6. */
  function roundToOrders(n, orders) {
    requirePositive(n, 'Participants');
    if (!Number.isInteger(orders) || orders < 1) fail('The number of orders must be a whole number.');
    return Math.ceil(n / orders) * orders;
  }

  // ---------------------------------------------------------------------------
  // Problem discovery (methods.md §9)
  // ---------------------------------------------------------------------------

  /** n = ln(1 − P) / ln(1 − p), rounded up. methods.md §9. */
  function nProblemDiscovery(p, P) {
    requireOpenUnit(p, 'Problem frequency (p)');
    requireOpenUnit(P, 'Chance of seeing the problem (P)');
    const exact = Math.log1p(-P) / Math.log1p(-p);
    return { exact, n: ceilN(exact) };
  }

  /** Chance of seeing a problem at least once: 1 − (1 − p)ⁿ. methods.md §9. */
  function chanceOfSeeing(p, n) {
    requireOpenUnit(p, 'Problem frequency (p)');
    if (!(n >= 0)) fail('Participants must be zero or more.');
    return -Math.expm1(n * Math.log1p(-p));
  }

  /** Smallest frequency seen with chance P at n: 1 − (1 − P)^(1/n). methods.md §9. */
  function smallestFrequencySeen(n, P) {
    requireOpenUnit(P, 'Chance of seeing the problem (P)');
    if (!(n >= 1)) fail('Participants must be at least 1.');
    return -Math.expm1(Math.log1p(-P) / n);
  }

  // ---------------------------------------------------------------------------
  // plan(): the full study (methods.md §1 to §8)
  // ---------------------------------------------------------------------------

  const MEASURE_TYPES = {
    time: { rank: true, binary: false, label: 'Time' },
    count: { rank: true, binary: false, label: 'Count' },
    binary: { rank: false, binary: true, label: 'Success / failure' },
    rating: { rank: false, binary: false, label: 'Rating scale' },
    numeric: { rank: false, binary: false, label: 'Other numeric' },
  };

  // Rounding for display in the trail (methods.md §8).
  function round(x, digits) {
    const f = Math.pow(10, digits);
    return Math.round(x * f) / f;
  }

  // Method for a measure. methods.md §2 table.
  function chooseMethod(typeKey, paired) {
    const t = MEASURE_TYPES[typeKey];
    if (t.binary) return paired ? 'McNemar' : 'Two-proportion test';
    if (t.rank) return paired ? 'Wilcoxon signed-rank' : 'Mann–Whitney';
    return paired ? 'Paired t-test' : 'Independent t-test';
  }

  // Plain-language reason for the chosen test (methods.md §2, §8).
  function methodReason(typeKey, paired, studyWithin) {
    const t = MEASURE_TYPES[typeKey];
    const who = paired
      ? 'each participant gives one value per condition'
      : studyWithin
        ? 'values cannot be linked to a participant, so conditions are compared as independent groups'
        : 'each participant experiences one condition';
    if (t.binary) {
      return paired
        ? `Success / failure, and ${who}: McNemar's test compares the paired outcomes.`
        : `Success / failure, and ${who}: the two-proportion test compares the success rates.`;
    }
    if (t.rank) {
      const test = paired ? 'Wilcoxon signed-rank' : 'Mann–Whitney';
      const tt = paired ? 'paired' : 'independent';
      return `${t.label} values are often skewed, and ${who}: the ${test} test is sized with ` +
        `the ${tt} t-test, then adjusted for the rank-based test.`;
    }
    return paired
      ? `${t.label}, and ${who}: the paired t-test compares each participant's conditions.`
      : `${t.label}, and ${who}: the independent t-test compares the groups.`;
  }

  // Resolve the comparison list. methods.md §1.2, §1.5.
  function resolveComparisons(study, cells) {
    const spec = study.comparisons;
    if (!spec) fail('Choose which comparisons the decision rests on.');
    const cellKey = (c) => c.join(' × ');
    const findCell = (levels) => {
      if (!Array.isArray(levels) || levels.length !== study.factors.length) {
        fail('A specific combination must name one level of every independent variable.');
      }
      const i = cells.findIndex((c) => c.every((l, j) => l === levels[j]));
      if (i < 0) fail(`Unknown combination "${levels.join(' × ')}".`);
      return cells[i];
    };
    if (spec.scheme) {
      const k = cells.length;
      countComparisons(k, spec.scheme);
      const baseline = spec.baseline ? findCell(spec.baseline) : cells[0];
      const out = [];
      if (spec.scheme === 'baseline') {
        cells.forEach((c) => {
          if (c !== baseline) {
            out.push({ id: `${cellKey(c)} vs ${cellKey(baseline)}`, type: 'cell', a: c, b: baseline });
          }
        });
      } else {
        for (let i = 0; i < k; i++) {
          for (let j = i + 1; j < k; j++) {
            out.push({ id: `${cellKey(cells[j])} vs ${cellKey(cells[i])}`, type: 'cell', a: cells[j], b: cells[i] });
          }
        }
      }
      return out;
    }
    if (!Array.isArray(spec.list) || spec.list.length === 0) {
      fail('Choose at least one comparison.');
    }
    const ids = new Set();
    return spec.list.map((c) => {
      if (!c.id) fail('Each comparison needs an id.');
      if (ids.has(c.id)) fail(`Comparison id "${c.id}" is used twice.`);
      ids.add(c.id);
      if (c.type === 'interaction') {
        fail('Interaction comparisons are planned for a later version. ' +
          'In this version, compare specific combinations or main effects.');
      }
      if (c.type === 'cell') {
        const a = findCell(c.a);
        const b = findCell(c.b);
        if (a === b) fail(`Comparison "${c.id}" compares a combination with itself.`);
        return { id: c.id, type: 'cell', a, b };
      }
      if (c.type === 'main') {
        const f = study.factors.find((x) => x.name === c.factor);
        if (!f) fail(`Unknown independent variable "${c.factor}".`);
        if (!f.levels.includes(c.a) || !f.levels.includes(c.b) || c.a === c.b) {
          fail(`Comparison "${c.id}" must name two different levels of ${c.factor}.`);
        }
        return { id: c.id, type: 'main', factor: c.factor, a: c.a, b: c.b };
      }
      fail(`Unknown comparison type "${c.type}". Use "cell" or "main".`);
    });
  }

  // Inputs for one comparison, shared or per comparison (methods.md §1.5, §3).
  function effectFor(measure, comparison) {
    const e = measure.effect;
    if (!e) fail(`Describe the improvement for ${measure.name}.`);
    if (e.byComparison) {
      const v = e.byComparison[comparison.id];
      if (!v) fail(`Describe the improvement for ${measure.name} in comparison "${comparison.id}".`);
      return v;
    }
    return e;
  }

  // One comparison of one continuous measure: effect size and its trail.
  // methods.md §3.1, §4.
  function continuousEffect(input, paired, measure, steps, label) {
    if (input.mode === 'participants') {
      requireK(input.k);
      const es = paired ? dzFromK(input.k) : dFromK(input.k);
      steps.push({ step: 'inputs', label: `${label}How many of 10 participants should do better`, value: input.k, source: 'your estimate' });
      steps.push({
        step: 'effect size',
        label: paired ? `${label}Effect size (dz) = Φ⁻¹(${input.k}/10)` : `${label}Effect size (d) = √2 × Φ⁻¹(${input.k}/10)`,
        value: es,
        source: 'your estimate',
      });
      return { effectSize: es, delta: null, sd: null, estimate: true };
    }
    if (input.mode !== 'units') fail(`Unknown way of describing the improvement "${input.mode}". Use "units" or "participants".`);
    const delta = input.delta;
    requireNumber(delta, 'The difference that matters');
    if (delta === 0) fail('The difference that matters must not be zero.');
    const absDelta = Math.abs(delta);
    steps.push({ step: 'inputs', label: `${label}Smallest difference that matters (Δ)`, value: absDelta, unit: measure.unit, source: 'entered' });

    let sd;
    let estimate = false;
    if (input.k !== undefined) {
      estimate = true;
      sd = paired ? sdDiffFromK(absDelta, input.k) : sdFromK(absDelta, input.k);
      steps.push({ step: 'inputs', label: `${label}At that difference, how many of 10 participants would do better`, value: input.k, source: 'your estimate' });
      steps.push({
        step: 'variability',
        label: paired ? `${label}σ_diff = Δ ÷ Φ⁻¹(${input.k}/10)` : `${label}σ = Δ ÷ (√2 × Φ⁻¹(${input.k}/10))`,
        value: sd,
        unit: measure.unit,
        source: 'your estimate',
      });
    } else if (paired && input.sdDiff !== undefined) {
      requirePositive(input.sdDiff, 'Variability of the differences (σ_diff)');
      sd = input.sdDiff;
      steps.push({ step: 'variability', label: `${label}Variability of the differences (σ_diff)`, value: sd, unit: measure.unit, source: 'entered' });
    } else if (input.sd !== undefined) {
      requirePositive(input.sd, 'Standard deviation');
      if (measure.scale && input.mean !== undefined) {
        const bound = checkBoundedSd(input.sd, input.mean, measure.scale.min, measure.scale.max);
        steps.push({ step: 'variability', label: `${label}Largest possible SD on this scale at an average of ${input.mean}`, value: bound, unit: measure.unit, source: 'calculated' });
      }
      steps.push({ step: 'inputs', label: `${label}How much values vary between participants (standard deviation)`, value: input.sd, unit: measure.unit, source: 'entered' });
      if (paired) {
        const level = input.consistency === undefined ? 'low' : input.consistency;
        const rho = rhoFromConsistency(level);
        sd = sdDiffFromSd(input.sd, rho);
        steps.push({ step: 'inputs', label: `${label}How consistent participants are across conditions (consistency)`, value: level, detail: `ρ = ${rho}`, source: 'entered' });
        steps.push({ step: 'variability', label: `${label}σ_diff = σ × √(2(1 − ${rho}))`, value: sd, unit: measure.unit, source: 'calculated' });
      } else {
        sd = input.sd;
      }
    } else {
      fail(`Give the variability for ${measure.name}: a standard deviation, or how many of 10 participants would do better.`);
    }
    const es = absDelta / sd;
    steps.push({
      step: 'effect size',
      label: paired ? `${label}Effect size (dz) = Δ ÷ σ_diff` : `${label}Effect size (d) = Δ ÷ σ`,
      value: es,
      source: estimate ? 'your estimate' : 'calculated',
    });
    return { effectSize: es, delta: absDelta, sd, estimate };
  }

  /**
   * Plan a comparison study. methods.md §1 to §8.
   *
   * study = {
   *   design: 'within' | 'between',
   *   factors: [{ name, levels: [...] }],
   *   comparisons: { scheme: 'baseline' | 'all-pairs', baseline?: [levels] }
   *              | { list: [{ id, type: 'cell', a: [levels], b: [levels] }
   *                       | { id, type: 'main', factor, a: level, b: level }] },
   *   adjust: true (pick a winner, Bonferroni) | false,
   *   alpha: 0.05, power: 0.80,
   *   measures: [{ name, type: 'time'|'count'|'binary'|'rating'|'numeric',
   *     unit, primary, linked (default true), scale?: { min, max },
   *     effect: input | { byComparison: { [id]: input } } }]
   * }
   * Continuous input: { mode: 'units', delta, sd?, mean?, consistency?, sdDiff?, k? }
   *                 | { mode: 'participants', k }.
   * Success / failure input: { p1, p2, psi? }.
   */
  function plan(study) {
    if (!study || typeof study !== 'object') fail('Describe the study to plan.');
    const design = study.design;
    if (design !== 'within' && design !== 'between') fail('Design must be "within" or "between".');
    const alpha = study.alpha === undefined ? 0.05 : study.alpha;
    const power = study.power === undefined ? 0.8 : study.power;
    requireAlphaPower(alpha, power);
    const cells = buildCells(study.factors);
    const k = cells.length;
    const comparisons = resolveComparisons(study, cells);
    const m = comparisons.length;
    const adjust = !!study.adjust;
    const alphaEach = alphaPerComparison(alpha, m, adjust);
    const orders = design === 'within' ? orderCount(k) : null;

    if (!Array.isArray(study.measures) || study.measures.length === 0) fail('Add at least one measure.');
    const primaries = study.measures.filter((x) => x.primary);
    if (primaries.length !== 1) fail('Mark exactly one measure as primary.');

    const results = study.measures.map((measure) => {
      if (!MEASURE_TYPES[measure.type]) {
        fail(`Unknown result type "${measure.type}" for ${measure.name}.`);
      }
      const type = MEASURE_TYPES[measure.type];
      const linked = measure.linked !== false;
      const paired = design === 'within' && linked;
      const method = chooseMethod(measure.type, paired);
      const steps = [];
      steps.push({
        step: 'alpha',
        label: adjust
          ? `Alpha per comparison = ${alpha} ÷ ${m} comparisons (Bonferroni)`
          : `Alpha per comparison = ${alpha} (no adjustment; each comparison answers its own question)`,
        value: alphaEach,
        source: 'calculated',
      });

      // With one input shared by every comparison, comparisons of the same
      // kind give the same n, so each kind is worked through once in the trail.
      const shared = !(measure.effect && measure.effect.byComparison);
      const kindKey = (comp) => (comp.type === 'main' ? `main|${comp.factor}` : 'cell');
      const kinds = new Set(comparisons.map(kindKey));
      if (shared && m > 1) {
        steps.push({ step: 'inputs', label: `The same inputs apply to each of the ${m} comparisons`, value: m, source: 'entered' });
      }
      const cache = new Map();
      const perComparison = comparisons.map((comp) => {
        if (comp.type === 'main' && type.binary) {
          fail(`For success / failure measures (${measure.name}), only comparisons between ` +
            'specific conditions are supported. Main effects are not available for this result type.');
        }
        const key = shared ? kindKey(comp) : comp.id;
        if (cache.has(key)) return Object.assign({}, cache.get(key), { comparison: comp });
        let label = '';
        if (!shared && m > 1) label = `${comp.id}: `;
        else if (shared && kinds.size > 1) {
          label = comp.type === 'main' ? `Main effect of ${comp.factor}: ` : 'Specific combinations: ';
        }
        const res = sizeComparison(comp, effectFor(measure, comp), label);
        cache.set(key, res);
        return res;
      });

      // Size one comparison and record its trail (methods.md §2.1, §3, §4, §1.5, §8).
      function sizeComparison(comp, input, label) {
        let testN;
        let calc;
        if (type.binary) {
          requireOpenUnit(input.p1, 'Success rate 1');
          requireOpenUnit(input.p2, 'Success rate 2');
          steps.push({ step: 'inputs', label: `${label}Expected success rates`, value: [input.p1, input.p2], source: 'entered' });
          if (paired) {
            calc = nMcNemar(input.p1, input.p2, alphaEach, power, input.psi);
            steps.push({
              step: 'inputs',
              label: `${label}Share who succeed in one condition and fail in the other (discordance)`,
              value: calc.psi,
              source: input.psi === undefined ? 'calculated' : 'entered',
              detail: input.psi === undefined ? 'Default: outcomes assumed unrelated' : undefined,
            });
            steps.push({ step: 'sample size', label: `${label}McNemar (Connor, 1987): n = ${round(calc.exact, 4)}, rounded up`, value: calc.n, source: 'calculated' });
          } else {
            calc = nTwoProportions(input.p1, input.p2, alphaEach, power);
            steps.push({ step: 'effect size', label: `${label}Cohen's h`, value: Math.abs(calc.h), source: 'calculated' });
            steps.push({ step: 'sample size', label: `${label}Two-proportion test: n per condition = ${round(calc.exact, 4)}, rounded up`, value: calc.n, source: 'calculated' });
          }
          testN = calc.n;
          return { comparison: comp, n: testN, effect: { p1: input.p1, p2: input.p2, psi: calc.psi } };
        }

        const eff = continuousEffect(input, paired, measure, steps, label);
        calc = paired ? nPairedT(eff.effectSize, alphaEach, power) : nIndependentT(eff.effectSize, alphaEach, power);
        steps.push({
          step: 'sample size',
          label: paired
            ? `${label}Paired t-test: n = ${round(calc.exact, 4)}, rounded up`
            : `${label}Independent t-test: n per ${comp.type === 'main' ? 'group' : 'condition'} = ${round(calc.exact, 4)}, rounded up`,
          value: calc.n,
          source: 'calculated',
        });
        let n = calc.n;
        if (type.rank) {
          const adj = rankAdjust(n);
          steps.push({ step: 'rank adjustment', label: `${label}Rank-based adjustment: ${n} ÷ 0.955 (3/π) = ${round(n / RANK_EFFICIENCY, 2)}, rounded up`, value: adj, source: 'calculated' });
          n = adj;
        }
        if (!paired && comp.type === 'main' && design === 'between') {
          const per = cellsPerLevel(study.factors, comp.factor);
          const perCell = ceilN(n / per);
          steps.push({ step: 'main-effect split', label: `${label}n per cell = ${n} ÷ ${per} cells per level, rounded up`, value: perCell, source: 'calculated' });
          return { comparison: comp, n: perCell, groupN: n, cellsPerLevel: per, effect: eff };
        }
        return { comparison: comp, n, effect: eff };
      }

      const top = perComparison.reduce((a, b) => (b.n > a.n ? b : a));
      let perCell = null;
      let total;
      if (design === 'within') {
        // Unlinked measures in a within study are analysed as independent
        // groups, but every participant still takes every condition.
        const n = top.n;
        total = roundToOrders(n, orders);
        steps.push({
          step: 'counterbalancing',
          label: k === 2
            ? `Counterbalancing: ${n} rounded up to an even number (2 orders)`
            : `Counterbalancing: ${n} rounded up to a multiple of ${orders} orders (balanced Latin square)`,
          value: total,
          source: 'calculated',
        });
      } else {
        perCell = top.n;
        total = perCell * k;
        steps.push({ step: 'total', label: `Total = ${perCell} per condition × ${k} conditions`, value: total, source: 'calculated' });
      }

      return {
        name: measure.name,
        type: measure.type,
        unit: measure.unit,
        primary: !!measure.primary,
        method,
        reason: methodReason(measure.type, paired, design === 'within'),
        paired,
        rank: type.rank,
        comparisons: perComparison,
        n: top.n,
        perCell,
        total,
        steps,
        usesEstimate: perComparison.some((c) => c.effect && c.effect.estimate),
      };
    });

    const primary = results.find((r) => r.primary);
    const recommendedN = primary.total;
    const driving = results.reduce((a, b) => (b.total > a.total ? b : a));
    const nCoverAll = driving.total;

    // methods.md §5: secondary measures underpowered at the recommended n.
    const underpowered = results
      .filter((r) => !r.primary && r.total > recommendedN)
      .map((r) => {
        const worst = r.comparisons.reduce((a, b) => (b.n > a.n ? b : a));
        return { name: r.name, needs: r.total, powerAtRecommended: powerForComparison(r, worst, recommendedN) };
      });

    // Power of a secondary measure at the recommended n (methods.md §5, §7).
    function powerForComparison(r, c, totalN) {
      if (design === 'within') {
        if (r.type === 'binary') {
          return r.paired
            ? powerMcNemar(totalN, c.effect.p1, c.effect.p2, alphaEach, c.effect.psi)
            : powerTwoProportions(totalN, c.effect.p1, c.effect.p2, alphaEach);
        }
        const nEff = r.rank ? totalN * RANK_EFFICIENCY : totalN;
        return r.paired
          ? powerPairedT(nEff, c.effect.effectSize, alphaEach)
          : powerIndependentT(nEff, c.effect.effectSize, alphaEach);
      }
      const perCellN = Math.floor(totalN / k);
      if (r.type === 'binary') return powerTwoProportions(perCellN, c.effect.p1, c.effect.p2, alphaEach);
      const groupN = c.cellsPerLevel ? perCellN * c.cellsPerLevel : perCellN;
      const nEff = r.rank ? groupN * RANK_EFFICIENCY : groupN;
      if (!(nEff > 1)) return 0;
      return powerIndependentT(nEff, c.effect.effectSize, alphaEach);
    }

    return {
      design,
      conditions: cells.map((c) => c.join(' × ')),
      k,
      comparisons: comparisons.map((c) => ({ id: c.id, type: c.type })),
      m,
      adjust,
      alpha,
      alphaPerComparison: alphaEach,
      power,
      orders,
      measures: results,
      recommendedN,
      primary: primary.name,
      driving: driving.name,
      nCoverAll,
      underpowered,
    };
  }

  return {
    EngineError,
    // Distributions
    normalCdf,
    normalQuantile,
    logGamma,
    incompleteBeta,
    tCdf,
    tQuantile,
    noncentralTCdf,
    // Sample size and power
    powerPairedT,
    powerIndependentT,
    nPairedT,
    nIndependentT,
    cohensH,
    nTwoProportions,
    powerTwoProportions,
    defaultDiscordance,
    nMcNemar,
    powerMcNemar,
    RANK_EFFICIENCY,
    rankAdjust,
    // Comparisons
    countComparisons,
    alphaPerComparison,
    buildCells,
    cellsPerLevel,
    // Variability and effect
    rhoFromConsistency,
    sdDiffFromSd,
    sdDiffFromK,
    sdFromK,
    dzFromK,
    dFromK,
    kFromDz,
    kFromD,
    // Bounded scales
    PRESETS,
    maxSdOnScale,
    checkBoundedSd,
    // Confidence report
    confidenceT,
    confidenceBinary,
    // Counterbalancing
    williamsSquare,
    orderCount,
    roundToOrders,
    // Problem discovery
    nProblemDiscovery,
    chanceOfSeeing,
    smallestFrequencySeen,
    // Whole plan
    plan,
  };
});
