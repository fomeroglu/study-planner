# Answer key

Reference values for docs/methods.md section 12. tests/engine.test.js checks
every row.

**Status.** CONFIRMED values have been checked in R (pwr) or by hand
against a published source. PROVISIONAL values were computed by Claude and
have not yet been confirmed in R or G*Power. **The tool must not be
described as validated while any value below is PROVISIONAL.**

Tolerance (methods.md §12): exact match on the rounded-up n, except McNemar
(±2). Unrounded values are tested to 4 decimal places.

| # | Case | Reference | Expected | Unrounded | Status |
|---|---|---|---|---|---|
| 1 | Paired, dz = 0.5, power 0.80, alpha 0.05 | pwr.t.test | 34 | 33.3671 | CONFIRMED |
| 2 | Independent, d = 0.5, power 0.80, alpha 0.05 | pwr.t.test | 64 per condition | 63.7656 | CONFIRMED |
| 3 | Paired, dz = Φ⁻¹(0.8) ≈ 0.8416, alpha 0.05 | pwr.t.test | 14 | 13.1301 | PROVISIONAL |
| 4 | Same, alpha 0.025 | pwr.t.test | 17 | 16.0373 | PROVISIONAL |
| 5a | Same, alpha 0.0167 (literal) | pwr.t.test | 18 | 17.7282 | PROVISIONAL |
| 5b | Same, alpha 0.05/3 | pwr.t.test | 18 | 17.7366 | PROVISIONAL |
| 6 | Variability from your estimate: Δ = 10, k = 8 | Hand calculation | σ_diff = 11.88 s | 11.8818 | PROVISIONAL |
| 7a | Confidence report: n = 12, σ_diff = 11.88, Δ = 10, alpha 0.025: power | pwr.t.test | 0.63 | 0.6323 | PROVISIONAL |
| 7b | Same: detectable difference at power 0.80 | pwr.t.test | 12.0 s | 11.9776 | PROVISIONAL |
| 7c | Same: 95% precision half-width | qt() by hand | ± 7.5 s | 7.5482 | PROVISIONAL |
| 7d | Same, rank-based (Task time): power at effective n = 12 × 3/π | pwr.t.test | 0.60 | 0.6036 | PROVISIONAL |
| 7e | Same, rank-based: detectable difference at power 0.80 | pwr.t.test | 12.3 s | 12.3455 | PROVISIONAL |
| 8 | Rank adjustment and Latin square: 18 ÷ (3/π), 3 conditions | Hand calculation | 19, rounded to 24 | 18.8496 | PROVISIONAL |
| 9 | Two proportions, 0.60 vs. 0.80, alpha 0.05, power 0.80 | pwr.2p.test | 81 per condition | 80.2993 | PROVISIONAL |
| 10 | McNemar, 0.60 vs. 0.80, default ψ = 0.44 | G*Power | 84 (±2) | 83.9405 | PROVISIONAL |
| 11 | Problem discovery, p = 0.31, P = 0.85 | Hand calculation | 6 | 5.1127 | CONFIRMED |
| 12 | Problem discovery, p = 0.10, P = 0.80 | Hand calculation | 16 | 15.2755 | CONFIRMED |

## Notes

- Rows 1 and 2: the unrounded values match pwr's documented output
  (33.36713 and 63.76561). They match only when power counts both
  rejection regions (methods.md §4). stats::power.t.test with its default
  `strict = FALSE` counts one region and gives 33.3672 and 63.7658. The
  rounded n is the same.
- Rows 3 to 5: dz is the exact Φ⁻¹(0.8) = 0.841621..., not 0.842. Row 4
  sits 0.037 above the boundary at 16. With dz = 0.842 it would still
  round to 17.
- The running example (three keyboard designs) compares every pair, always
  adjusted (methods.md §1.2, §1.3): m = 3, alpha 0.05/3 per comparison.
  Its task-time recommendation follows rows 5b and 8: n = 17.7366 → 18,
  18 ÷ 0.955 = 18.85 → 19, rounded up to 24 for 6 orders. The interface's
  end-to-end test (tests/e2e.test.js) expects 24.
- Rows 7a to 7e use alpha 0.025, from an earlier version of the running
  example (each design vs. Current, 2 comparisons). They remain valid
  reference cases for the confidence report but no longer match the
  running example, whose report at 12 participants uses alpha 0.05/3
  (power 0.53, detectable 13.2 s; precision ± 7.5 s is unchanged because
  intervals are not adjusted).
- Rows 7d and 7e: Task time is rank-based, so power and detectable
  difference use the effective n 12 × 3/π ≈ 11.46 (methods.md section 7).
  Precision (7c) uses the actual n, so it is unchanged.
- Row 10: the value comes from Connor's (1987) normal approximation.
  G*Power's McNemar routine uses a different method, so the ±2 tolerance
  applies.
- Rows 3 to 10 were cross-checked during development:
  - Noncentral t probabilities: the engine's AS 243 values agreed to
    about 1e-13 with direct numerical integration of the noncentral t
    definition.
  - Rows 1 and 2: matched pwr's documented values.

  These checks are not confirmation in R or G*Power.

## Confirming the provisional rows

Run `validation/reference.R` in R with the pwr package installed. Then:

- Compare each printed value with this table.
- Change PROVISIONAL to CONFIRMED only where it matches.
- Row 10 also needs G*Power: Exact, Proportions: Inequality, two
  dependent groups (McNemar). Use odds ratio 0.32/0.12 and proportion of
  discordant pairs 0.44.
