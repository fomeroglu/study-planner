# Does Connor's formula give the right sample size for McNemar's test?
# Checks answer-key rows 10 and 15 (validation/answer-key.md) by
# simulation, in base R only (no packages needed).
#
# Method. Each simulated study draws n participants. Each participant
# succeeds or fails in condition A and in condition B, with chances set
# by the four cells of the paired table (rmultinom). McNemar's test is
# run on the resulting 2 x 2 table, and the study "finds the difference"
# if p < 0.05. The share of 10,000 studies that find it is the test's
# power at that n.
#
# The cells use the planner's default discordance (methods.md section
# 3.2): success in A and in B are assumed unrelated, so for success
# rates p1 (A) and p2 (B) the cells are p1 p2, p1 (1 - p2),
# (1 - p1) p2, and (1 - p1)(1 - p2).
#
# The planned analysis is McNemar's test without continuity correction
# (methods.md section 4). R's mcnemar.test corrects by default, so
# correct = FALSE is required.
#
# How to read the results. Each printed value is the simulated power.
# With 10,000 studies, simulation noise is about +/- 0.008 (two
# standard errors at power 0.80). The planned n is confirmed when the
# uncorrected test's power is at least 0.80 within that noise.
#
# Run the whole script in order: set.seed(1) is set once for the first
# two checks, as in the run recorded in the answer key (R 4.6.1:
# 0.8104 and 0.8089). The last section, for the corrected and exact
# tests, resets the seed before each run.

set.seed(1)   # makes the random results repeatable

uncorrected <- function(table2x2) mcnemar.test(table2x2, correct = FALSE)$p.value

simulate_power <- function(n, cells, reps = 10000, test = uncorrected) {
  # cells: chance of each participant outcome, in this order:
  # success on both, success on A only, success on B only, fail on both
  found <- 0
  for (i in 1:reps) {
    counts <- rmultinom(1, size = n, prob = cells)   # one fake study
    table2x2 <- matrix(counts, nrow = 2, byrow = TRUE)
    p <- test(table2x2)
    if (!is.na(p) && p < 0.05) found <- found + 1
  }
  found / reps   # the share of studies that found the difference
}

row10 <- c(0.48, 0.12, 0.32, 0.08)       # 60% vs 80% success
row15 <- c(0.595, 0.105, 0.255, 0.045)   # 70% vs 85% success

# Row 10: 60% vs 80% success, planned n = 84
cat("Row 10, n = 84, uncorrected: ", simulate_power(84, row10), "\n")

# Row 15: 70% vs 85% success, planned n = 124
cat("Row 15, n = 124, uncorrected:", simulate_power(124, row15), "\n")

# Why the uncorrected test: the continuity-corrected test (R's default)
# and the exact conditional test (binomial test on the discordant pairs)
# are more conservative, so at the same n their power falls short of
# 0.80 (methods.md section 4).
corrected <- function(table2x2) mcnemar.test(table2x2, correct = TRUE)$p.value
exact <- function(table2x2) {
  discordant <- table2x2[1, 2] + table2x2[2, 1]
  if (discordant == 0) NA else binom.test(table2x2[1, 2], discordant)$p.value
}
for (variant in c("corrected", "exact")) {
  test <- get(variant)
  set.seed(1); p10 <- simulate_power(84, row10, test = test)
  set.seed(1); p15 <- simulate_power(124, row15, test = test)
  cat(sprintf("%-9s row 10, n = 84: %.4f   row 15, n = 124: %.4f\n", variant, p10, p15))
}
