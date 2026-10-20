# Reference values for validation/answer-key.md.
# Run in R with the pwr package installed: install.packages("pwr")
# tol = 1e-10 makes uniroot precise enough to compare unrounded n to 4
# decimal places (pwr's default tolerance is only about 1e-4).

library(pwr)
tol <- 1e-10
dz8 <- qnorm(0.8)

cat("1  paired dz = 0.5:          ",
    pwr.t.test(d = 0.5, sig.level = 0.05, power = 0.8, type = "paired", tol = tol)$n, "\n")
cat("2  independent d = 0.5:      ",
    pwr.t.test(d = 0.5, sig.level = 0.05, power = 0.8, type = "two.sample", tol = tol)$n, "\n")
for (a in c(0.05, 0.025, 0.0167, 0.05 / 3)) {
  cat("3-5 paired dz = qnorm(0.8), alpha", format(a, digits = 6), ": ",
      pwr.t.test(d = dz8, sig.level = a, power = 0.8, type = "paired", tol = tol)$n, "\n")
}
cat("6  sigma_diff (delta 10, k 8):", 10 / dz8, "\n")

sd <- 11.88
cat("7a power at n = 12:          ",
    pwr.t.test(n = 12, d = 10 / sd, sig.level = 0.025, type = "paired")$power, "\n")
cat("7b detectable (units):       ",
    pwr.t.test(n = 12, power = 0.8, sig.level = 0.025, type = "paired", tol = tol)$d * sd, "\n")
cat("7c precision half-width:     ", qt(0.975, 11) * sd / sqrt(12), "\n")
# 7d, 7e: Task time is rank-based, so power and detectable difference use
# the effective n = 12 x 3/pi (methods.md section 7).
n_eff <- 12 * 3 / pi
cat("7d rank power, n_eff:        ",
    pwr.t.test(n = n_eff, d = dz8, sig.level = 0.025, type = "paired")$power, "\n")
cat("7e rank detectable (units):  ",
    pwr.t.test(n = n_eff, power = 0.8, sig.level = 0.025, type = "paired", tol = tol)$d * 10 / dz8, "\n")

cat("8  18 / (3/pi):              ", 18 / (3 / pi), "-> ceiling", ceiling(18 / (3 / pi)), "\n")

cat("9  two proportions:          ",
    pwr.2p.test(h = ES.h(0.8, 0.6), sig.level = 0.05, power = 0.8, tol = tol)$n, "\n")

# 10: Connor (1987) by formula. Confirm the n separately in G*Power.
p1 <- 0.6; p2 <- 0.8; psi <- p1 * (1 - p2) + p2 * (1 - p1); delta <- p2 - p1
n_mc <- (qnorm(0.975) * sqrt(psi) + qnorm(0.8) * sqrt(psi - delta^2))^2 / delta^2
cat("10 McNemar (Connor):         ", n_mc, "\n")

cat("11 problem discovery .31/.85:", log(1 - 0.85) / log(1 - 0.31), "\n")
cat("12 problem discovery .10/.80:", log(1 - 0.80) / log(1 - 0.10), "\n")

# 13 to 16: the running example under Fisher's protected LSD, alpha 0.05 per pair.
cat("13 task time 14 / (3/pi):    ", 14 / (3 / pi), "-> ceiling", ceiling(14 / (3 / pi)),
    "-> 6 orders", 6 * ceiling(ceiling(14 / (3 / pi)) / 6), "\n")
cat("14 NASA-TLX dz = 10/15:      ",
    pwr.t.test(d = 10 / 15, sig.level = 0.05, power = 0.8, type = "paired", tol = tol)$n, "\n")
cat("14b NASA-TLX, Low (rho 0.3):",
    pwr.t.test(d = 10 / (15 * sqrt(2 * (1 - 0.3))), sig.level = 0.05, power = 0.8, type = "paired", tol = tol)$n, "\n")
p1 <- 0.70; p2 <- 0.85; psi <- p1 * (1 - p2) + p2 * (1 - p1); delta <- p2 - p1
n_lsd <- (qnorm(0.975) * sqrt(psi) + qnorm(0.8) * sqrt(psi - delta^2))^2 / delta^2
cat("15 McNemar .70/.85 (Connor): ", n_lsd, "\n")
cat("16a rank power n_eff, a=.05: ",
    pwr.t.test(n = 12 * 3 / pi, d = dz8, sig.level = 0.05, type = "paired")$power, "\n")
cat("16b rank detectable (units): ",
    pwr.t.test(n = 12 * 3 / pi, power = 0.8, sig.level = 0.05, type = "paired", tol = tol)$d * 10 / dz8, "\n")
