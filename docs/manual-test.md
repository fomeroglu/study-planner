# Manual test checklist

A short click-through for the browser. Serve the folder (for example
`python -m http.server 8765` in the repo root) and open
http://localhost:8765. Opening index.html straight from disk also works in
most browsers.

Tick each box. Anything that fails: note the screen, what you did, and what
you saw.

## 1. Running example (dark theme)

- [ ] Start: two cards, "Compare designs" and "Find problems". The header
      shows only "Study Planner" and the round theme button (no privacy
      line; that lives in the README).
- [ ] Footer on every screen, below a thin line, in small grey text: left,
      "Study Planner" (bold) and "Version 1.0 · How it calculates ·
      Source on GitHub"; right, "Designed and built by Fatih Omeroglu"
      and "fbomeroglu.com · GitHub · LinkedIn". Each link opens in a new
      tab: How it calculates (docs/methods.md on GitHub), Source on GitHub
      (the repository), fbomeroglu.com, GitHub (github.com/fomeroglu),
      LinkedIn (linkedin.com/in/fomeroglu). A screen reader announces
      "(opens in a new tab)" and skips the dots.
- [ ] Below 640 px wide, the footer's two columns stack, both left-aligned.
- [ ] The footer's left column lines up with "Study Planner" in the header,
      and its right column with the theme button, at any width.
- [ ] Sticky footer: on a tall window (or zoomed out), the Start screen and
      Find problems with empty inputs leave the footer at the very bottom
      of the window, not floating mid-page. On a short window, the footer
      follows the content and appears only after scrolling.
- [ ] Start has no "Methods and validation" line under the cards; the
      footer's "How it calculates" link replaces it.
- [ ] Step 1 starts generic: the variable name is empty with the hint
      "e.g., Interface design"; the conditions read "Condition A" and
      "Condition B"; "+ Add condition" adds "Condition C". No wording
      mentions keyboards, prototypes or a "Current" condition.
- [ ] Step 1 is one card: the variable, its conditions, "+ Add independent
      variable", then "Each participant experiences". There are no
      comparison questions.
- [ ] With two conditions there is no note. Add a third condition: a small
      grey note appears under the conditions, "With 3 conditions, every pair
      is compared. Run the overall test first; if it's significant, compare
      each pair at the usual 0.05 (Fisher's protected LSD)."
- [ ] Add a fourth: the note changes to "With 4 conditions, every pair is
      compared (6 comparisons). Fisher's protected LSD only keeps false
      results at 5% with up to three conditions, so each comparison now uses
      a stricter test (alpha 0.00833 for planning, Holm adjustment at
      analysis)." Remove it again: the three-condition note returns.
      Remove another: the note goes away.
- [ ] Alpha tooltips: in the note, the dotted-underlined alpha (0.05 or
      0.00833) shows a tooltip on hover and when reached with Tab. Three
      conditions: "With exactly three conditions, the overall test protects
      the comparisons, so each uses the usual 0.05 (Fisher's protected
      LSD)." Four: "4 conditions = 6 pairs. 0.05 ÷ 6 = 0.00833 per
      comparison, so the overall chance of a false result stays at 5%. At
      analysis, the Holm adjustment is less strict: only the first
      comparison faces 0.00833." Escape hides the tooltip; the pointer can
      move onto it without it closing.
- [ ] Name the variable "Keyboard design" and rename the conditions to
      Current, Prototype A and Prototype B (or keep A, B, C). Choose "All
      conditions". Sidebar: Within subjects, 3, "3 (every pair)".
- [ ] Step 2: the measure name is empty with the hint "e.g., Task time".
      There is no "Does each participant give one value per condition?"
      question. Name measure 1 "Task time" and choose Time: the name stays,
      and the empty unit field shows "e.g., seconds".
- [ ] Switching the result type empties the name and unit. The unit
      field's placeholder follows the type: Count "e.g., errors", Rating
      scale "e.g., points", Other numeric "e.g., mm"; Success / failure
      hides the unit field. Switch back to Time and enter "Task time" and
      "seconds".
- [ ] Each open card has "Fill from preset: NASA-TLX · SUS · SEQ" next to
      the Name field, and there are no presets below the cards.
- [ ] "+ Add measure", then "NASA-TLX" in that card: it fills this measure
      (name, Rating scale, unit "points", scale 0 to 100, Preset badge when
      collapsed) and does not add another one.
- [ ] On that measure, choose a different result type (for example Time):
      the name, unit, scale range and Preset badge clear. Apply NASA-TLX
      again to restore it.
- [ ] "+ Add measure" again: name it "Task success", type Success /
      failure. Sidebar: "3 (primary: Task time)".
- [ ] Every measure card, open or collapsed, has a "Remove" button; with a
      single measure left, it disappears. "Start over" asks for
      confirmation, then clears the plan and returns to Start.
- [ ] Step 3: large tabs for the three measures; the panel heading reads
      "Task time (Measure 1 of 3)". There are no "In seconds / In
      participants" buttons.
- [ ] Task time: question 1, "Smallest difference that would matter",
      reads "Optional. Leave empty if you don't have a target in seconds."
      Enter 10. Question 2, "Out of 10 participants, how many should do
      better on the better condition?", shows "(6 to 9)", "Why 6 to 9?"
      (tooltip on hover and focus: "5 of 10 means no improvement…") and
      "Answer for a 10-second difference." Enter 8. Variability shows
      "≈ 12 s" (dotted underline; its tooltip on hover and focus reads
      "From your two answers: if the average difference is 10 seconds and
      8 of 10 participants do better, the other 2 must do worse, which
      happens when individual differences vary by about 12 seconds
      (standard deviation)…"), "Your estimate, not measured." and "Results will be in
      seconds." Sidebar shows 18 and "Set by Task time, your primary
      measure. Updates as you type."
- [ ] Clear question 1: the line changes to "Results will be in
      participants (how many of 10 do better)." and the variability
      readout disappears; the plan still works. Put 10 back.
- [ ] The Advanced summary reads "alpha 0.05, then each pair at 0.05 after
      a significant overall test (Fisher's protected LSD)", with the
      tooltip on the second 0.05.
- [ ] NASA-TLX: enter 10 for question 1, then open "I have data from a
      past study": question 2 disappears, and the section shows only
      "Standard deviation of NASA-TLX in your past data" (points) and the
      note "We assume moderate consistency across conditions (correlation
      0.5), the common default. If people are less consistent, your study
      may need more participants." Enter 15. Variability of the
      differences shows "≈ 15 points". Closing the section brings
      question 2 back. Leave it open.
- [ ] Task success: one question, "What improvement in success rate would
      matter?", with the helper "For example, if 70% succeed with the
      weakest design, the best design should reach at least 85% to be
      worth choosing." and the line "From [ ]% of participants succeeding
      to [ ]%". No "Advanced: share who succeed…" section. Enter 70 and 85.
      Sidebar: 18, 24, 126. Before a measure is
      filled in, its row reads "not filled in yet".
- [ ] Plan screen sections, in order: Recommended sample; Your measures;
      How these numbers were reached; Confidence report; Running the study;
      Analyzing the results.
- [ ] Recommended sample: 18 participants, driven by Task time, "Within ·
      3 conditions", Power · alpha "0.80 · 0.05" (the 0.05 has the
      three-condition tooltip).
- [ ] Your measures: columns Measure, Needs, "Chance of detecting your
      target at 18 (line = 80%)" and the percentage. Rows: ★ Task time,
      needs 18, teal bar past the line, "91%"; NASA-TLX, needs 24, amber
      bar short of the line, "76%"; Task success, needs 126, amber bar,
      "18%". Each percentage matches its bar's color. Below: "To cover
      every measure: 126 participants. Report measures below the line as
      supporting evidence." No method or reason columns, no warning boxes.
- [ ] With a screen reader, each bar reads like "NASA-TLX: 76% chance at
      18 participants; target 80%."
- [ ] "How these numbers were reached" comes right after Your measures:
      Task time open, others closed. Alpha reads "Alpha per comparison =
      0.05, after a significant overall test (Fisher's protected LSD, three
      conditions): 0.05" (tooltip on the last 0.05). An "Assumption" line
      reads "Planned assuming the overall test is significant; the true
      chance of finding a winner is slightly lower. A simulation check is
      planned for version 1.1." Sample size reads "n = 13.1301, rounded up:
      14" and "14 ÷ 0.955 (3/π) = 14.66, rounded up: 15", and the order
      plan "18 fits 6 orders: 3 participants each."
- [ ] NASA-TLX's trail: variability "σ_diff = σ × √(2(1 − 0.5)): 15
      points"; "Assumption" includes "Assumed: moderate consistency across
      conditions (correlation ρ = 0.5), the common default. If people are
      less consistent, your study may need more participants."; sample
      size "n = 19.6669, rounded up: 20", order plan "…: 24".
- [ ] Task success's trail: "Assumption" includes "Assumes a
      participant's success on one condition is unrelated to the other,
      the cautious default." and "Your inputs" no longer lists the
      discordance.
- [ ] Confidence report at 18 (the default): under the tiles, "Your plan
      rounds up to 18 for the rank-based adjustment and counterbalancing,
      so it can detect differences slightly smaller than your 10-second
      target." The note stays at 15 to 18 and disappears at 14 (the
      minimum) and below, and above 18.
- [ ] Move the slider to 12: tiles show 11 s, ± 7.5 s, 73%. The shaded
      area is labeled "73% caught" and "27% missed". The precision bar shows
      2.5 s, 10 s, 17.5 s.
- [ ] Drag the slider: tiles, curves and precision bar all update while
      dragging.
- [ ] Running the study: the order plan, 6 orders (A B C, B C A, C A B, C B
      A, A C B, B A C), key A = Current, B = Prototype A, C = Prototype B.
- [ ] Analyzing the results: "Your analysis plan" first, then "Reporting
      guidance". The analysis plan lists two steps for each measure:
      Task time, "Step 1: Friedman test at 0.05." then "Step 2: if it's
      significant, Wilcoxon signed-rank for each pair at 0.05 (Fisher's
      protected LSD)."; NASA-TLX, repeated-measures ANOVA then paired
      t-test; Task success, Cochran's Q test then McNemar. The 0.05 in each
      step 2 has the tooltip. With two conditions there is a single step.
      Above the steps (within subjects only): "If participants give several
      values per condition, average them first; the sample size counts
      people, not trials."
- [ ] Between subjects: go back to step 1, choose "One condition", then
      step 3, Task time. Question 2 is titled "How clear should the
      difference be?" with the sentence "If you compared one random person
      from each condition, the person on the better condition should do
      better [8] out of 10 times." The "Why 6 to 9?" tooltip is still
      there. The Plan screen's analysis plan has no averaging note.
- [ ] With a fourth condition, the Plan screen's alpha is 0.00833 with the
      four-condition tooltip, and the analysis plan reads "Step 2: ... with
      the Holm adjustment (6 comparisons)".

## 2. Find problems

- [ ] Enter 10 and 80: Recruit 16. Table rows 5 / 10 / 16 (your plan) with
      41%, 65%, 81% and 84%, 98%, over 99%.
- [ ] Slider at 8: "With 8 participants, you have an 80% chance of seeing
      problems that affect about 18% of users or more." The vertical line
      moves with the slider; the label reads "8 participants: 57%".
- [ ] "How this number was reached" shows ln(0.20) ÷ ln(0.90) = 15.3,
      rounded up to 16.

## 3. Light theme

- [ ] The theme button is a small round icon in the header's right
      corner, with no visible text. It shows the current mode: a moon in
      the dark theme, a sun in the light theme. Hovering shows "Dark mode.
      Click for light mode." (dark) or "Light mode. Click for dark mode."
      (light), and a screen reader reads the same label.
- [ ] Clicking it switches every screen to the light palette (Plan screen
      should match design/screens/4-plan-light.html), and the icon turns
      into a sun.
- [ ] Reload the page: the light theme stays. Switch back: dark stays after
      reload, and the icon and label match.
- [ ] In both themes the icon is clearly visible against the header, and
      Tab shows the teal focus ring around the button.
- [ ] In both themes, check the warning blocks, the amber "underpowered"
      numbers, error messages and the curves are clearly readable.

## 4. Keyboard only (no mouse)

- [ ] Tab through every screen: each control shows a visible teal focus
      outline, and the order follows the page. Tab also stops on each
      dotted-underlined alpha and shows its tooltip.
- [ ] Option buttons toggle with Enter and Space.
- [ ] Step 3 tabs: Left and Right arrows move between measures; Home and
      End go to the first and last.
- [ ] "Advanced" sections open and close with Enter.
- [ ] The participants sliders move with the arrow keys.
- [ ] After "Next" or a step link, focus lands on the page heading.
- [ ] "How we got this number →" moves focus to "How these numbers were
      reached".
- [ ] With a screen reader on: the participant count is announced once
      after you stop typing ("Participants needed: 18").

## 5. Disabled options (visible, not selectable)

Add a second independent variable (rename it Posture, with conditions
Seated and Standing) and choose "All conditions".

- [ ] Interactions: "Interaction comparisons (a difference of
      differences)" is shown dashed, cannot be selected, and reads
      "Interaction comparisons come in a later version."
- [ ] Select a main effect, go to step 2: "Success / failure" is dashed,
      cannot be selected, and reads "For success/failure measures, only
      comparisons between specific conditions are supported in this
      version."
- [ ] Deselect the main effect, make a measure Success / failure, go back
      to step 1: every main effect is dashed with the same sentence.

## 6. Error messages (each appears under its field)

On step 1, clear "Condition A" and click "Next" without choosing a design:

- [ ] "Name this condition." under the cleared condition and "Choose what
      each participant experiences." Focus goes to the cleared condition.
- [ ] With two variables and no comparison selected: "Choose at least one
      comparison."
- [ ] Two conditions with the same name (rename "Condition B" to
      "Condition A"), variable named "Interface design": "Condition names
      must be unique within Interface design."
- [ ] With two variables, an unnamed variable: "Name this independent
      variable."

On step 2:

- [ ] Empty name: "Name this measure." No type: "Choose a result type."
- [ ] Two measures with the same name: "Each measure needs its own name."
- [ ] Rating scale with only one end filled in: "Enter both ends of the
      scale, or leave both blank."

On step 3 (each message comes from the engine unless marked):

- [ ] Difference "ten" (interface): "Enter a number."
- [ ] Difference 0: "The difference that matters must be greater than 0."
- [ ] Question 2 empty (interface): "Enter a number from 6 to 9."
- [ ] 5 of 10: "How many of 10 participants would do better" must be a
      whole number from 6 to 9, not 5.
- [ ] Past data open with question 1 empty (interface): "Enter the smallest
      difference that would matter to use your past data."
- [ ] Past-data standard deviation -2: "Standard deviation must be greater
      than 0."
- [ ] Success rate 150 (interface): "Enter a percentage between 0 and 100."
- [ ] Rates 70 and 70: "The two success rates must differ."
- [ ] Each rate's message appears under the "From … to …" line.
- [ ] Alpha 5 (Advanced): "Alpha must be between 0 and 1, not 5."
- [ ] While any error shows, the sidebar reads "–" and "Fix the
      highlighted input to see it.", the measure's row reads "fix the
      input", and step 4 cannot be opened.

Find problems:

- [ ] Empty field after editing the other: "Enter the smallest problem
      frequency you care about." / "Enter how sure you want to be."
- [ ] 0 or 100: "Enter a percentage between 0 and 100."

## 7. Tablet width and privacy

- [ ] At 768 px wide, every screen fits without sideways scrolling; the
      sidebar moves below the main column.
- [ ] Developer tools, Network tab: after the page loads, only the IBM Plex
      font files come from outside localhost, and typing or dragging sends
      nothing.
