# Methods

This document describes every calculation the tool performs: its inputs,
assumptions, and sources. It is the source of truth for the tool's math.
Any change to a formula is made here first, then in the code, then
re-validated (see validation/).

## Conventions

- Defaults: power = 0.80, alpha = 0.05 (two-sided). Both adjustable.
- Sample sizes are always rounded up to the next whole participant.
- Inputs are asked in plain language, with the technical term beside
  each label.
- The tool reports the number of complete participants the analysis
  needs. It does not adjust for dropout.
- Results are reported in the measure's own units wherever possible.

## 1. Study setup

### 1.1 Independent variables and conditions

- One or more independent variables, each with two or more named
  conditions.
- The whole study is either within subjects (each participant
  experiences every condition) or between subjects (each participant
  experiences one). Mixed designs are not supported.
- With two or more independent variables, the conditions are every
  combination of their levels (e.g., 3 designs × 2 postures = 6).

### 1.2 Comparisons

The study is sized for the comparisons the decision rests on, not for
an omnibus test. The goal is to pick a winner.

- One independent variable: every pair of conditions is compared,
  m = k(k − 1)/2 comparisons. With two conditions, that is one
  comparison. The user does not choose the comparisons.
- With two or more independent variables: the user chooses comparisons
  between specific combinations of levels, and main-effect comparisons
  (levels of one variable, averaged across the others). See section
  1.5. Interaction comparisons are planned for a later version
  (section 13).

Comparing each condition with a baseline only is planned for a later
version (section 13).

### 1.3 Adjusting for multiple comparisons

The goal is to pick a winner, so the overall chance of a false result
is kept at alpha. How depends on the number of conditions:

- **Two conditions** (one comparison): one test at alpha.
- **Exactly three conditions, one independent variable:** Fisher's
  protected least significant difference (LSD). At analysis, the
  overall test (section 1.4) is run at alpha; only if it is
  significant, each pair is compared at alpha, unadjusted. With three
  groups this keeps the familywise false-alarm risk at alpha (Hayter,
  1986). For planning, each pairwise comparison is sized at alpha.
  Assumption: planned assuming the overall test is significant; the
  true chance of finding a winner is slightly lower. A simulation check
  is planned for version 1.1 (section 13).
- **Four or more conditions, or two or more independent variables:**
  each comparison is planned at alpha / m (Bonferroni), keeping the
  overall false-alarm risk at alpha. With four or more groups, Fisher's
  protected LSD no longer does this (Hayter, 1986). At analysis, Holm's
  procedure is used: it is never stricter than Bonferroni (only the
  first, smallest p-value is compared with alpha / m), so the planned
  sample covers it.

Treating each comparison as its own question, without adjustment, is
planned for a later version (section 13).

### 1.4 Planned analysis

- Two conditions: one step, the pairwise test for the measure
  (section 2).
- Exactly three conditions, one independent variable: two steps
  (Fisher's protected LSD, section 1.3).
  1. The overall test across all conditions, at alpha.
  2. If it is significant, the pairwise test for each pair, at alpha.
- Four or more conditions, one independent variable: two steps.
  1. The overall test across all conditions.
  2. The pairwise test for every pair, with the Holm adjustment across
     the m comparisons.
- Two or more independent variables: the selected comparisons
  (section 1.5), each with the pairwise test, with the Holm adjustment
  across the m comparisons. A factorial omnibus analysis is not planned
  in this version.
- The sample size is based on the pairwise comparisons, planned at the
  per-comparison alpha from section 1.3: alpha for two or three
  conditions, alpha / m (Bonferroni) otherwise. Holm is never stricter
  than Bonferroni, so the planned sample covers the Holm analysis.

| Result type | Step 1, within subjects | Step 1, between subjects | Step 2, within subjects | Step 2, between subjects |
|---|---|---|---|---|
| Time, Count | Friedman test | Kruskal–Wallis test | Wilcoxon signed-rank | Mann–Whitney |
| Rating scale, Other numeric | Repeated-measures ANOVA | One-way ANOVA | Paired t-test | Independent t-test |
| Success / failure | Cochran's Q test | Chi-square test of independence | McNemar | Two-proportion test |

A measure whose values can't be linked to a participant uses the
between-subjects columns (section 2).

### 1.5 Comparisons with two or more independent variables

**Within subjects.** Every comparison is reduced to one contrast score
per participant, then sized as a paired (one-sample) t-test on that
score, as in section 4:

- Specific combination: one cell minus another
  (e.g., A seated − Current seated).
- Main effect: one level of a variable minus another, each averaged
  over all levels of the other variables
  (e.g., A averaged over postures − Current averaged over postures).

Inputs describe the comparison itself, worded to match it, using the
options in section 3.1: the smallest difference that matters for that
comparison, and its variability (SD of the contrast score) or the
user's estimate ("at that difference, how many of 10 participants
would show it?"). Examples:
- "When seated, what's the smallest difference that would matter?"
- "Averaged across postures, what's the smallest difference that would
  matter?"
Because inputs describe the contrast score directly, no correlations
between cells are needed.

**Between subjects.**
- Specific combination: independent t-test between two cells, n per
  cell (section 4).
- Main effect: independent t-test between two levels of one variable,
  each group pooling every cell at that level. The group n from
  section 4 is divided across those cells: n per cell = group n ÷
  (number of cells per level), rounded up.

**Measure types.** Main effects apply to time, count, rating scale, and
other numeric measures. Success / failure measures support comparisons
between specific combinations only.

**All designs.** m in section 1.3 counts every comparison the user
selects, of any type. Counterbalancing (section 6) is unchanged: the
Latin square covers every combination of levels.

## 2. Measures

Each measure has a name, a result type, and a unit. One measure is
marked primary.

| Result type | Within subjects | Between subjects |
|---|---|---|
| Time | Wilcoxon signed-rank | Mann–Whitney |
| Count | Wilcoxon signed-rank | Mann–Whitney |
| Success / failure | McNemar | Two-proportion test |
| Rating scale | Paired t-test | Independent t-test |
| Other numeric | Paired t-test | Independent t-test |

Each measure also records whether each participant gives one value per
condition. Several trials per participant are averaged into one value
per condition. If values can't be linked to a participant, the measure
is treated as an independent comparison. In a within-subjects study,
such a measure is analysed as independent groups (independent t-test,
Mann–Whitney, or two-proportion test), but the number of participants
is the per-condition n, not n × the number of conditions, since every
participant still experiences every condition. That n is then rounded
up for counterbalancing (section 6).

Presets: NASA-TLX (rating scale, 0 to 100, raw TLX), SUS (rating scale,
0 to 100), SEQ (rating scale, 1 to 7).

### 2.1 Rank-based tests (Time, Count)

- Sized with the corresponding t-test (section 4), then divided by the
  asymptotic relative efficiency 3/π ≈ 0.955 (about +5%) (Hodges &
  Lehmann, 1956). The exact value 3/π is used in every calculation;
  the trail displays it as "÷ 0.955 (3/π)".
- Order of rounding: the t-test n is rounded up first, then divided by
  3/π, then rounded up again (e.g., 18 ÷ 0.955 = 18.85, so 19).
- This is a conservative upper bound. The 0.955 figure applies under
  normality; for right-skewed data such as task times, rank-based tests
  are usually more efficient than the t-test, so the true requirement
  is often lower.
- Rank-based tests are sensitive to differences in spread as well as
  location (Fagerland, 2012).

### 2.2 Bounded scales

- For a scale with minimum a and maximum b, the SD cannot exceed
  √((b − mean)(mean − a)) (Bhatia & Davis, 2000). The tool rejects an
  entered SD above this bound.
- A ceiling or floor flag is planned for a later version (section 13).

## 3. Describing the improvement

### 3.1 Continuous measures

The interface asks the same questions for every continuous measure and
picks the mode from the answers:

1. "Smallest difference that would matter" (Δ), in the measure's own
   unit. Optional.
2. "Out of 10 participants, how many should do better on the better
   condition?" (k, from 6 to 9). Between subjects, it is asked as pairs
   of participants, one from each condition (see below). 5 of 10 means
   no improvement; 10 of 10 would mean everyone improves by the same
   amount, which never happens in real data.

With both answers: in units, with variability from the estimate. With
question 1 left empty: in participants. With data from a past study,
the SD replaces question 2: in units, with the SD known, and question 1
is then required.

**In units.** Inputs: smallest difference that matters (Δ), and
variability. Variability is given one of two ways:

- Known (data from a past study): the SD between participants (σ).
  Within subjects, how consistent participants are across conditions
  (consistency) sets a correlation ρ: Low 0.3, Medium 0.5, or High 0.7.
  Then σ_diff = σ·√(2(1 − ρ)). In version 1 the interface always uses
  Medium (ρ = 0.5), the common default and G*Power's default for
  repeated measures, and states this assumption in the trail (section
  8). If people are less consistent, σ_diff is larger and the study
  needs more participants; Low (ρ = 0.3) is the cautious choice. Choosing the consistency,
  and entering σ_diff directly, are supported by the engine and planned
  for the interface in version 1.1 (section 13).
- Your estimate: k from question 2, read as "at a difference of Δ, how
  many of 10 participants would do better on the better condition?"
  (k, from 6 to 9).
  - Within: σ_diff = Δ / Φ⁻¹(k/10)
  - Between: σ = Δ / (√2 · Φ⁻¹(k/10)), where k/10 is read as the chance
    that a randomly chosen participant on the new condition outperforms
    a randomly chosen one on the current condition
  - Φ⁻¹ is the inverse of the standard normal distribution. Assumes
    roughly bell-shaped differences. Values derived from "k of 10"
    answers are labeled "your estimate" wherever they appear; typed
    values are labeled "entered".

**In participants** (question 1 left empty). Input: k of 10 participants should do better.
- Within: dz = Φ⁻¹(k/10)
- Between: d = √2 · Φ⁻¹(k/10)
- This is the common language effect size (probability of
  superiority). The normal-based conversion is compared during
  validation with Noether's (1987) method, which works from this
  probability directly.

These are the two input modes in version 1. Entering Cohen's d directly
is planned for a later version (section 13).

In version 1 the interface does not ask for an expected average, so the
bounded-scale check in section 2.2 is not applied to entered SDs. The
engine still supports it.

### 3.2 Success / failure

Inputs: expected success rate in each condition. Within subjects, also
the expected discordance ψ: the share of participants who succeed in
one condition and fail in the other. Default: ψ = p₁(1 − p₂) + p₂(1 − p₁),
assuming outcomes are unrelated. This is conservative compared with the
positive relationship typical within subjects, which lowers ψ. It is
not the largest possible ψ: negatively related outcomes give a larger
one (for 0.60 vs. 0.80, ψ can reach 0.60, against 0.44 when unrelated).
An entered ψ must be at least |p₂ − p₁|, and no more than
min(p₁, 1 − p₂) + min(p₂, 1 − p₁), the largest share the two rates allow.

## 4. Sample size

**Paired t-test.** dz = Δ / σ_diff. Solved with the noncentral t
distribution: df = n − 1, noncentrality = dz·√n.

**Independent t-test.** d = Δ / σ. Solved with the noncentral t
distribution: df = 2(n − 1), noncentrality = d·√(n/2), n per condition.
Total = n × number of conditions.

**Power, t-tests.** Two-sided power counts both rejection regions, as
the pwr package does: P(T′ > t_c) + P(T′ < −t_c), where t_c = t(1 − α/2,
df) and T′ is noncentral t. n is solved as a continuous value, then
rounded up.

**Two-proportion test.** Cohen's h = 2·arcsin(√p₁) − 2·arcsin(√p₂)
(Cohen, 1988). n per condition = 2·((z₁₋α/₂ + z₁₋β) / h)², as in
pwr.2p.test. The factor 2 is there because the difference of two
arcsine-transformed proportions, each from n participants, has variance
2/n.

**McNemar's test.** With δ = p₂ − p₁ (Connor, 1987):
n = [z₁₋α/₂·√ψ + z₁₋β·√(ψ − δ²)]² / δ².
A normal approximation; its accuracy at small n is checked against
exact results during validation.

The noncentral t distribution is computed with Lenth's (1989)
Algorithm AS 243, the method underlying R's pt() function, so results
match R's pwr package.

## 5. Multiple measures

- Each measure is sized separately.
- The recommended n is the primary measure's n.
- The tool shows which secondary measures are underpowered at that n,
  and the n that would cover all measures.
- Secondary measures are not alpha-adjusted; they are reported as
  supporting evidence.

## 6. Counterbalancing (within subjects)

- Two conditions: two orders. n is rounded up to an even number.
- Three or more conditions: balanced Latin square (Williams, 1949);
  k orders when k is even, 2k when k is odd. n is rounded up to a
  multiple of the number of orders.
- With two or more independent variables, the square covers every
  combination of levels.
- Between subjects: equal group sizes with random assignment.

## 7. Confidence report

For the number of participants the user can actually recruit (n):

- **Power at the target:** the chance of detecting the smallest
  difference that matters, from the noncentral t distribution.
- **Detectable difference:** the smallest difference detected with the
  chosen power, solved numerically and shown in the measure's units.
- **Precision:** the expected half-width of the 95% confidence interval
  for the difference: t(0.975, df) × SE, where SE = σ_diff / √n
  (within) or σ·√(2/n) (between). Binary measures use the normal
  approximation (below). Intervals are not adjusted for multiple
  comparisons (open decision, to be reviewed).

Power and detectable difference use the per-comparison alpha (section
1.3). By measure:

- **Rank-based measures (Time, Count):** power and detectable
  difference use the t-test at an effective n of n × 3/π. Precision uses
  the t formula above at the actual n.
- **Two proportions:** power = Φ(|h|·√(n/2) − z₁₋α/₂) +
  Φ(−|h|·√(n/2) − z₁₋α/₂), as in pwr.2p.test. Precision =
  z₀.₉₇₅·√(p₁(1 − p₁)/n + p₂(1 − p₂)/n).
- **McNemar:** power = Φ((|δ|·√n − z₁₋α/₂·√ψ) / √(ψ − δ²)), Connor's
  formula solved for power. Precision = z₀.₉₇₅·√((ψ − δ²)/n).
- **Detectable difference, success / failure:** p₁ is held fixed and the
  smallest p₂ (in the direction the user entered) that reaches the
  chosen power is solved numerically. Reported in percentage points. The
  default ψ is recalculated at each p₂; an entered ψ is held fixed.
- **"In participants" mode:** the detectable difference is converted
  back to the user's terms, e.g. "at least 8.4 of 10 participants do
  better": 10·Φ(dz) within subjects, 10·Φ(d/√2) between. Precision is
  not reported, since there are no units.

### 7.1 Visuals

**Power curves.** Two curves of the possible study results: one if there
is no real difference, one if the target difference is real. Both come
from the same distributions as the power number above, so the shaded
share of the second curve equals the reported power. Redrawn as n
changes.

- *t-based measures:* the test statistic under no difference (central
  t) and under the target (noncentral t, ncp as in section 4), each
  multiplied by SE to put it in the measure's units. SE = σ_diff / √n
  (paired test) or σ·√(2/n) (independent test, n per condition).
  Rank-based measures use the effective n (n × 3/π) for df, ncp and SE,
  as for power. Densities are numerical derivatives of the section 4
  CDFs. The significance bar is at t_c·SE. The shaded share is the
  target curve's area beyond ±t_c·SE (both rejection regions; the
  region below −t_c·SE is normally too small to see).
- *McNemar:* normal curves centered on 0 with SD √(ψ/n) and on |δ| with
  SD √((ψ − δ²)/n). The bar is at z₁₋α/₂·√(ψ/n). Axis in percentage
  points.
- *Two proportions:* normal curves on the Cohen's h scale, centered on 0
  and |h|, each with SD √(2/n). Bars at ±z₁₋α/₂·√(2/n). Tick labels are
  converted to percentage points with p₁ held fixed:
  p₂ = sin²(arcsin√p₁ ± h/2).
- *"In participants" mode:* drawn as for t-based measures with σ = 1.
  Axis title: "Result your study finds: how many of 10 participants do
  better". A tick at standardized difference x is labeled 10·Φ(x)
  within subjects, 10·Φ(x/√2) between subjects (section 7).

**Precision bar:** the target difference, with low and high ends at ±
the half-width above.

## 8. How these numbers were reached

For every measure, the tool shows each step from inputs to result:
inputs, variability, effect size, alpha and its adjustment, sample
size, the rank-based adjustment, and rounding for counterbalancing.
Values from the user's own estimate are labeled as such.

## 9. Find problems (problem discovery)

- Inputs: smallest problem frequency of interest (p), and the desired
  chance of seeing such a problem at least once (P).
- n = ln(1 − P) / ln(1 − p), rounded up (Virzi, 1992; Nielsen &
  Landauer, 1993; Lewis, 1994).
- Table and curve: chance of seeing a problem, 1 − (1 − p)ⁿ, for the
  chosen p and for p = 0.31, across participants.
- Confidence report: for a fixed n, the smallest frequency seen with
  chance P is p = 1 − (1 − P)^(1/n).
- Assumes every participant is equally likely to hit a given problem.
  Real participants vary, so the model can overstate how many problems
  a sample finds (Caulton, 2001).

## 10. Reporting guidance

- Report every difference in its own units with its confidence
  interval, not only a p-value.
- Time: the geometric mean describes the typical participant
  (Sauro & Lewis, 2010); the arithmetic mean estimates total time or
  labor cost, since it counts every slow task in full.
- Count: the geometric mean can't be used when any value is zero.
- Success / failure: report rates and differences in percentage points.
- Three conditions: report the overall test; if it is significant,
  report the pairwise comparisons at alpha (Fisher's protected LSD). If
  it is not, report that no difference was found.
- Four or more conditions: report the overall test, then the
  Holm-adjusted pairwise comparisons.
- Three or more conditions: declare a winner only when the top
  conditions differ significantly from each other; otherwise report a
  tie.

## 11. Measure library defaults

Default variability is shown only where a published source exists.
Otherwise the tool asks the user. Sources: to be researched.

## 12. Validation

Every calculation is compared against a reference before release.
Tolerance: exact match on the rounded-up n, except McNemar (±2).
Each value's status (confirmed in R or G*Power, or provisional) is
recorded in validation/answer-key.md.

| Case | Reference | Expected |
|---|---|---|
| Paired, dz = 0.5, power 0.80 | pwr.t.test | 34 |
| Independent, d = 0.5, power 0.80 | pwr.t.test | 64 per condition |
| Paired, dz = Φ⁻¹(0.8) ≈ 0.842, alpha 0.05 | pwr.t.test | 14 (confirm) |
| Same, alpha 0.025 | pwr.t.test | 17 (confirm) |
| Same, alpha 0.0167 | pwr.t.test | 18 (confirm) |
| Variability from your estimate: Δ = 10, k = 8 | Hand calculation | σ_diff = 11.88 s |
| Confidence report: n = 12, σ_diff = 11.88, alpha 0.025 | Hand / R | power 0.63; detectable 12.0 s; ± 7.5 s |
| Same, rank-based (effective n = 12 × 3/π) | Hand / R | power 0.60; detectable 12.3 s; ± 7.5 s |
| Rank adjustment and Latin square: 18 ÷ 0.955, 3 conditions | Hand calculation | 19, rounded to 24 |
| Running example, protected LSD (alpha 0.05): task time, 14 ÷ 0.955 | Hand calculation | 15, rounded to 18 |
| Running example, protected LSD: NASA-TLX, dz = 10 / 15, alpha 0.05 | pwr.t.test | 20, rounded to 24 |
| Running example, protected LSD: McNemar, 0.70 vs. 0.85, default ψ, alpha 0.05 | Hand / G*Power | 124, rounded to 126 |
| Running example confidence report: n = 12, rank-based, alpha 0.05 | Hand / R | power 0.73; detectable 10.9 s; ± 7.5 s |
| Two proportions, 0.60 vs. 0.80 | pwr.2p.test | 81 per condition |
| McNemar, 0.60 vs. 0.80, default ψ | G*Power | 84 |
| Problem discovery, p = 0.31, P = 0.85 | Hand calculation | 6 |
| Problem discovery, p = 0.10, P = 0.80 | Hand calculation | 16 |

## 13. Planned for later versions

- 1.1: log-scale planning for time (O'Keeffe, Ambler & Barber, 2017);
  a simulation check of the plan against skewed data.
- Later: check mode (upload data, confirm the method), mixed designs.
- Later: comparing each condition with a baseline only (m = k − 1
  comparisons), for one independent variable.
- Later: unadjusted comparisons, where each comparison answers its own
  question and uses the full alpha. This is a defensible position when
  each comparison stands as a separate claim (Rothman, 1990).
- Later (interface): marking a within-subjects measure whose values
  can't be linked to a participant, which is analysed as independent
  groups (section 2). The engine supports it; the version 1 interface
  treats every within-subjects measure as paired.
- 1.1 (interface): choosing how consistent participants are across
  conditions (Low, Medium, High; version 1 always uses Medium) and
  entering the SD of the differences (σ_diff) directly. The engine
  supports both (section 3.1).
- Later: planning for repeated trials per participant (mixed-effects
  models), using simulation. Version 1 asks for one value per
  participant per condition, averaged over trials.
- Later: simulation-based planning for Fisher's protected LSD, which
  sizes the study for the chance that the overall test and the
  pairwise comparison are both significant (version 1.1).
- Later: interaction comparisons (a difference of differences). These
  are usually smaller than main effects and need many more
  participants; between subjects they need a different calculation.
- Later: Cohen's d as an input mode (entered directly from a prior
  study).
- Later: a simulator that draws simulated studies and shows how often
  the 95% interval contains the true difference.
- Later: showing results for all three consistency levels side by side.
- Later: a ceiling or floor flag on bounded scales, when an expected
  mean sits near either end of the scale. The threshold is to be set
  from a published source.

## 14. Limitations

- Interaction comparisons are planned for a later version (section 13).
- Within-subjects plans assume you can match each participant's values
  across conditions.
- For success / failure measures, only comparisons between specific
  conditions are supported; main effects are not.
- In the interface, these options are shown as disabled with a short
  explanation.

## References

- Bhatia, R., & Davis, C. (2000). A better bound on the variance.
  The American Mathematical Monthly, 107(4), 353–357.
- Caulton, D. A. (2001). Relaxing the homogeneity assumption in
  usability testing. Behaviour & Information Technology, 20(1), 1–7.
- Cohen, J. (1988). Statistical power analysis for the behavioral
  sciences (2nd ed.). Erlbaum.
- Connor, R. J. (1987). Sample size for testing differences in
  proportions for the paired-sample design. Biometrics, 43(1), 207–211.
- Fagerland, M. W. (2012). t-tests, non-parametric tests, and large
  studies: a paradox of statistical practice? BMC Medical Research
  Methodology, 12, 78.
- Hayter, A. J. (1986). The maximum familywise error rate of Fisher's
  least significant difference test. Journal of the American
  Statistical Association, 81(396), 1000–1004.
- Hodges, J. L., & Lehmann, E. L. (1956). The efficiency of some
  nonparametric competitors of the t-test. The Annals of Mathematical
  Statistics, 27(2), 324–335.
- Lenth, R. V. (1989). Algorithm AS 243: Cumulative distribution
  function of the non-central t distribution. Applied Statistics,
  38(1), 185–189.
- Lewis, J. R. (1994). Sample sizes for usability studies: Additional
  considerations. Human Factors, 36(2), 368–378.
- Nielsen, J., & Landauer, T. K. (1993). A mathematical model of the
  finding of usability problems. Proceedings of INTERCHI '93, 206–213.
- Noether, G. E. (1987). Sample size determination for some common
  nonparametric tests. Journal of the American Statistical
  Association, 82(398), 645–647.
- O'Keeffe, A. G., Ambler, G., & Barber, J. A. (2017). Sample size
  calculations based on a difference in medians for positively skewed
  outcomes in health care studies. BMC Medical Research Methodology, 17.
- Rothman, K. J. (1990). No adjustments are needed for multiple
  comparisons. Epidemiology, 1(1), 43–46.
- Sauro, J., & Lewis, J. R. (2010). Average task times in usability
  tests: What to report? Proceedings of CHI 2010.
- Virzi, R. A. (1992). Refining the test phase of usability evaluation:
  How many subjects is enough? Human Factors, 34(4), 457–468.
- Williams, E. J. (1949). Experimental designs balanced for the
  estimation of residual effects of treatments. Australian Journal of
  Scientific Research, 2(3), 149–168.
