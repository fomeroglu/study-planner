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
# 0.8104 and 0.8089). The section for the corrected and exact tests
# resets the seed before each run.
#
# A second check at the end computes the same power exactly, with no
# simulation noise, by summing over every possible outcome. It also
# prints the n the exact conditional test would need (91 and 132).

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

# Second check: exact power, no simulation noise. Rather than drawing
# studies, sum over every possible outcome. The number of discordant
# pairs d is binomial (n, psi), where psi is the chance of a discordant
# pair; given d, the "A only" count b is binomial (d, p_A_only / psi).
# Power is the total probability of the outcomes the test rejects.
exact_power <- function(n, cells, rejects) {
  psi <- cells[2] + cells[3]
  share <- cells[2] / psi
  total <- 0
  for (d in 1:n) {   # d = 0 never rejects
    b <- 0:d
    total <- total + dbinom(d, n, psi) * sum(dbinom(b, d, share)[rejects(b, d)])
  }
  total
}
uncorrected_rejects <- function(b, d) pchisq((2 * b - d)^2 / d, 1, lower.tail = FALSE) < 0.05
exact_rejects <- function(b, d) sapply(b, function(x) binom.test(x, d)$p.value) < 0.05

cat("\nExact power at the planned n\n")
cat(sprintf("uncorrected row 10, n = 84: %.4f   row 15, n = 124: %.4f\n",
            exact_power(84, row10, uncorrected_rejects), exact_power(124, row15, uncorrected_rejects)))
cat(sprintf("exact       row 10, n = 84: %.4f   row 15, n = 124: %.4f\n",
            exact_power(84, row10, exact_rejects), exact_power(124, row15, exact_rejects)))

# The n the exact conditional test would need: the first n, counting up
# from the planned n, at which its power reaches 0.80. This is the n to
# expect from a tool that plans for the exact test.
first_n <- function(n, cells) {
  while (exact_power(n, cells, exact_rejects) < 0.8) n <- n + 1
  n
}
cat("Exact test reaches 0.80 at: row 10, n =", first_n(84, row10),
    "  row 15, n =", first_n(124, row15), "\n")
