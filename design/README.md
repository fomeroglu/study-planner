# Study Planner: design reference

These files show what the interface should look like. They are static
mockups, not code to copy: build the real interface from scratch in
index.html, matching them. When a mockup and docs/methods.md disagree on
behavior or numbers, methods.md wins.

Open any file in screens/ in a browser to see it. The numbers shown are
the running example as first drawn: three keyboard designs (Current,
Prototype A, Prototype B), within subjects, each vs. Current, adjusted,
with task time as the primary measure. The tool has since changed the
comparison rule (every pair; Fisher's protected LSD with three
conditions, methods.md §1.3), so the running example now recommends 18
participants; tests/e2e.test.js holds the current values. Where a
mockup and the built interface differ in layout, the notes below
describe the built interface.

## Screens

| File | Screen |
|---|---|
| 0-start.html | Start: choose "Compare designs" or "Find problems" |
| 1-conditions.html | Step 1: independent variables, conditions, design, comparisons, adjustment |
| 2-measures.html | Step 2: measures (name, result type, unit, primary, one value per condition) |
| 3-inputs.html | Step 3: describing the improvement, per measure |
| 4-plan.html | Step 4: the plan (dark theme) |
| 4-plan-light.html | Step 4: the plan (light theme) |
| b-find-problems.html | Find problems: problem discovery |

## Visual direction: "Lab instrument"

Dark theme is the default. Provide a light theme toggle that swaps the
same color roles. Only the Plan screen is drawn in light; every other
screen uses the same role mapping.

| Role | Dark (default) | Light |
|---|---|---|
| Page background | #0E1214 | #F3F5F4 |
| Cards | #161C1F | #FFFFFF |
| Decorative lines | #2A3337 | #DCE2E0 |
| Text | #E3E8E6 | #14191B |
| Secondary text | #9AA6A3 | #4F5B5E |
| Accent | #4FD1C5 | #0F766E |
| Selected background | #173B38 | #E2F3F0 |
| Warning | #F2B84B | #8A5300 |
| Warning background | #2E2615 | #FBF1DC |
| Form-control borders | #6E7D80 | #7A8A8C |

- Primary buttons: accent background with page-background text (dark
  theme), or accent background with white text (light theme).
- Typography: IBM Plex Sans; IBM Plex Mono for all numbers.
- Small section labels: uppercase, letter-spaced, secondary text color.
- Every pair above has been checked against WCAG 2.1 AA.

## Recurring patterns

- **Step navigation** in the header: completed steps are links with a
  check mark; the current step is filled.
- **Option buttons** (design, result type, comparisons): real buttons
  with aria-pressed. Selected = 2px accent border and selected
  background. Unselected = 1px form-control border.
- **"Your plan so far"** sidebar on steps 1 to 3: the participant count
  updates live as inputs change ("–" until it can be calculated).
- **Warnings**: warning background, 3px warning-color left border, and
  plain text. Never color alone.
- **Labels for values**: "your estimate" for values derived from
  "k of 10" answers; "entered" for typed values.
- **Plain question first, technical term beside it**, e.g. "How much do
  values vary between participants? (standard deviation)".

## Plan screen details

Sections, in order (the built interface differs from 4-plan.html here):

1. Recommendation readout: participants, driven by, design, power and
   alpha. The per-comparison alpha has a tooltip.
2. Your measures: one row per measure with its name (★ for the
   primary), the n it needs (monospace), a horizontal bar of its chance
   of detecting its target at the recommended n with a thin marker at
   the target power (80% by default), and the percentage as text. Bar
   and text use the accent color at or above the target and the warning
   color below it, so the meaning never rests on color alone. Below the
   list: "To cover every measure: [n] participants. Report measures
   below the line as supporting evidence." This replaces the mockup's
   per-measure table and warning boxes; the method and reason are in
   the trail and the analysis plan.
3. How these numbers were reached: the step-by-step trail from plan(),
   one expandable section per measure, primary open by default.
4. Confidence report: a participants slider (n you can recruit), three
   stat tiles (detectable difference, ± precision, chance of detecting
   the target), a note when the plan's rounding lets it detect slightly
   less than the target, the two-curve power visual, and the precision
   bar. All update live as the slider moves. The displayed numbers
   always come from engine.js, never from the drawing.
5. Running the study: the order plan (Latin square orders, with the
   condition letter key), or equal groups between subjects.
6. Analyzing the results: the analysis plan, then reporting guidance.

## Behavior not drawn in the mockups

Build these from methods.md; they follow the same patterns.

- **"In participants" mode** (step 3): one input, "How many of 10
  participants should do better on the new condition?" (6 to 9). The
  confidence report states the detectable difference in the same
  terms, e.g. "at least 8.4 of 10 participants do better".
- **"I know the standard deviation"** (step 3): the SD input, plus
  "How consistent are participants across conditions? (correlation)"
  with Low, Medium, High. Low is the default, labeled "cautious".
- **Two or more independent variables** (step 1): conditions are every
  combination of levels. Comparisons can include specific combinations
  and main effects ("averaged across the other variable"). Step 3
  inputs are worded to match each comparison type.
- **Disabled options**, visible but not selectable, each with this
  explanation:
  - Interaction comparisons: "Interaction comparisons come in a later
    version."
  - Main effects on a success/failure measure: "For success/failure
    measures, only comparisons between specific conditions are
    supported in this version."
- **Success/failure inputs** (step 3): expected success rate per
  condition, in percent.
- **Find problems curve**: the black line follows the participants
  slider.

## Not in version 1

Do not build: Cohen's d input, the pretend-study simulator, showing
three consistency scenarios at once, interaction comparisons, the
ceiling/floor warning, check mode, dropout, shareable links.
