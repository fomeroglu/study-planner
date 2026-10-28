# Answer key

Reference values for docs/methods.md section 12. tests/engine.test.js checks
every row.

**Status.** CONFIRMED values have been checked in R (by calculation or,
for McNemar, by simulation) or by hand against a published source.
PROVISIONAL values were computed by Claude and have not yet been
confirmed in R. **The tool must not be described as validated while any
value below is PROVISIONAL.**

**R confirmation.** R 4.6.1, pwr 1.3-0, 2026-10-28: two runs of
`validation/reference.R`, one with pwr's default tolerance and one with
the current script (tol = 1e-10). Rows 3 to 9, 13, 14, 14b, 16a, and 16b
were confirmed by these runs. Rows 1, 2, 11, and 12 were already
CONFIRMED and also matched. Rows 7b, 14, and 16b match only in the precise
run; at the default tolerance they differ in the fourth decimal place
(11.9778, 19.66695, 10.86235).

**Simulation confirmation (rows 10 and 15).** R 4.6.1, base R only,
2026-10-28: `validation/mcnemar-simulation.R`, 10,000 simulated studies
at each planned n, cells drawn with rmultinom, analysed with
mcnemar.test(correct = FALSE), significance at p < 0.05, set.seed(1)
once before both rows. Power: row 10 (n = 84) 0.8104, row 15
(n = 124) 0.8089. Simulation noise is about ±0.008, so both reach the
0.80 target. The confirmation is for McNemar's test without continuity
correction, the planned analysis (methods.md §4). Rows 10 and 15 report
Connor's formula; reference.R confirms its arithmetic (83.9405 and
123.1976).

Tolerance (methods.md §12): exact match on the rounded-up n. McNemar rows
are checked by simulation instead: power at the planned n must reach the
target within simulation noise. Unrounded values are tested to 4 decimal
places.

| # | Case | Reference | Expected | Unrounded | Status |
|---|---|---|---|---|---|
| 1 | Paired, dz = 0.5, power 0.80, alpha 0.05 | pwr.t.test | 34 | 33.3671 | CONFIRMED |
| 2 | Independent, d = 0.5, power 0.80, alpha 0.05 | pwr.t.test | 64 per condition | 63.7656 | CONFIRMED |
| 3 | Paired, dz = Φ⁻¹(0.8) ≈ 0.8416, alpha 0.05 | pwr.t.test | 14 | 13.1301 | CONFIRMED |
| 4 | Same, alpha 0.025 | pwr.t.test | 17 | 16.0373 | CONFIRMED |
| 5a | Same, alpha 0.0167 (literal) | pwr.t.test | 18 | 17.7282 | CONFIRMED |
| 5b | Same, alpha 0.05/3 | pwr.t.test | 18 | 17.7366 | CONFIRMED |
| 6 | Variability from your estimate: Δ = 10, k = 8 | Hand calculation | σ_diff = 11.88 s | 11.8818 | CONFIRMED |
| 7a | Confidence report: n = 12, σ_diff = 11.88, Δ = 10, alpha 0.025: power | pwr.t.test | 0.63 | 0.6323 | CONFIRMED |
| 7b | Same: detectable difference at power 0.80 | pwr.t.test | 12.0 s | 11.9776 | CONFIRMED |
| 7c | Same: 95% precision half-width | qt() by hand | ± 7.5 s | 7.5482 | CONFIRMED |
| 7d | Same, rank-based (Task time): power at effective n = 12 × 3/π | pwr.t.test | 0.60 | 0.6036 | CONFIRMED |
| 7e | Same, rank-based: detectable difference at power 0.80 | pwr.t.test | 12.3 s | 12.3455 | CONFIRMED |
| 8 | Rank adjustment and Latin square: 18 ÷ (3/π), 3 conditions | Hand calculation | 19, rounded to 24 | 18.8496 | CONFIRMED |
| 9 | Two proportions, 0.60 vs. 0.80, alpha 0.05, power 0.80 | pwr.2p.test | 81 per condition | 80.2991 | CONFIRMED |
| 10 | McNemar, 0.60 vs. 0.80, default ψ = 0.44 | Simulation in R | 84 | 83.9405 | CONFIRMED |
| 11 | Problem discovery, p = 0.31, P = 0.85 | Hand calculation | 6 | 5.1127 | CONFIRMED |
| 12 | Problem discovery, p = 0.10, P = 0.80 | Hand calculation | 16 | 15.2755 | CONFIRMED |
| 13 | Running example, protected LSD (alpha 0.05): task time 14 ÷ (3/π), 6 orders | Hand calculation | 15, rounded to 18 | 14.6608 | CONFIRMED |
| 14 | Running example, protected LSD: NASA-TLX, paired dz = 10/15, alpha 0.05 | pwr.t.test | 20, rounded to 24 | 19.6669 | CONFIRMED |
| 14b | Running example, protected LSD: NASA-TLX, SD 15 at Low consistency (σ_diff = 15 × √1.4), alpha 0.05 | pwr.t.test | 27, rounded to 30 | 26.7083 | CONFIRMED |
| 15 | Running example, protected LSD: McNemar, 0.70 vs. 0.85, default ψ = 0.36, alpha 0.05 | Simulation in R | 124, rounded to 126 | 123.1976 | CONFIRMED |
| 16a | Running example confidence report: n = 12, rank-based (effective n = 12 × 3/π), alpha 0.05: power | pwr.t.test | 0.73 | 0.7327 | CONFIRMED |
| 16b | Same: detectable difference at power 0.80 | pwr.t.test | 10.9 s | 10.8621 | CONFIRMED |

## Notes

- Rows 1 and 2: the unrounded values match pwr's documented output
  (33.36713 and 63.76561). They match only when power counts both
  rejection regions (methods.md §4). stats::power.t.test with its default
  `strict = FALSE` counts one region and gives 33.3672 and 63.7658. The
  rounded n is the same.
- Rows 3 to 5: dz is the exact Φ⁻¹(0.8) = 0.841621..., not 0.842. Row 4
  sits 0.037 above the boundary at 16. With dz = 0.842 it would still
  round to 17.
- The running example (three keyboard designs, one variable) compares
  every pair with Fisher's protected LSD (methods.md §1.3): each pair is
  planned at alpha 0.05. Its task-time recommendation follows row 3 and
  row 13: n = 13.1301 → 14, 14 ÷ 0.955 = 14.66 → 15, rounded up to 18 for
  6 orders. The interface's end-to-end test (tests/e2e.test.js) expects
  18. Rows 13 to 16 hold the running example's values under this rule.
- The plan assumes the overall test is significant; the true chance of
  finding a winner is slightly lower (methods.md §1.3). Rows 13 to 16
  check the planning arithmetic only, not that assumption. A simulation
  check is planned for version 1.1.
- Rows 5b and 8 (alpha 0.05/3, 18 → 19 → 24) are the earlier Bonferroni
  version of the running example. They remain valid reference cases for
  the engine's arithmetic. Rows 7a to 7e (alpha 0.025) likewise come from
  an earlier version (each design vs. Current, 2 comparisons).
- Rows 14 and 14b: the interface now always uses Medium consistency
  (ρ = 0.5, G*Power's default) for an SD from past data (methods.md
  §3.1). With SD 15, σ_diff = 15 × √(2 × 0.5) = 15, so dz = 10/15 and the
  running example's NASA-TLX follows row 14 (20, rounded to 24). Row 14b
  (Low consistency, 27 rounded to 30) remains a valid case for the
  engine.
- Rows 10 and 15: the corrected and exact McNemar tests fall short of
  0.80 at the planned n (same script, set.seed(1) before each run):
  continuity-corrected 0.7575 and 0.7644, exact conditional 0.7591 and
  0.7709. That is why the planned analysis is the uncorrected test
  (methods.md §4).
- Row 9: n is solved from the two-region power, as pwr.2p.test does
  (methods.md section 4). Both R runs give 80.2991. The earlier key value,
  80.2993, came from the one-region closed form 2·((z₁₋α/₂ + z₁₋β)/h)²,
  which the engine used before; the rounded n (81) is the same.
- Rows 7d and 7e: Task time is rank-based, so power and detectable
  difference use the effective n 12 × 3/π ≈ 11.46 (methods.md section 7).
  Precision (7c) uses the actual n, so it is unchanged.
- Row 10: the value comes from Connor's (1987) normal approximation.
- Rows 3 to 10 were cross-checked during development:
  - Noncentral t probabilities: the engine's AS 243 values agreed to
    about 1e-13 with direct numerical integration of the noncentral t
    definition.
  - Rows 1 and 2: matched pwr's documented values.

  These checks are not confirmation in R or G*Power.

## Rechecking the values

- Run `validation/reference.R` in R with the pwr package installed, and
  `validation/mcnemar-simulation.R` in base R.
- Compare each printed value with this table. A new row starts as
  PROVISIONAL and becomes CONFIRMED only where it matches.
- Optional extra check for rows 10 and 15 in G*Power: Exact,
  Proportions: Inequality, two dependent groups (McNemar). Use odds ratio
  0.32/0.12 and proportion of discordant pairs 0.44 for row 10, and odds
  ratio 0.255/0.105 and proportion of discordant pairs 0.36 for row 15.
  Check which version of the test G*Power computes before comparing. If
  it is the exact conditional test, expect a larger n than 84 and 124,
  since that test is more conservative (methods.md §4).
