# Manual test checklist

A short click-through for the browser. Serve the folder (for example
`python -m http.server 8765` in the repo root) and open
http://localhost:8765. Opening index.html straight from disk also works in
most browsers.

Tick each box. Anything that fails: note the screen, what you did, and what
you saw.

## 1. Running example (dark theme)

- [ ] Start: two cards, "Compare designs" and "Find problems". The header
      says "Runs in your browser. Nothing is uploaded."
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
      "≈ 12 s", "Your estimate, not measured." and "Results will be in
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
      note "We assume people aren't especially consistent across
      conditions, the cautious choice. If they are, your study may need
      fewer participants than shown." Enter 15. Variability of the
      differences shows "≈ 18 points". Closing the section brings
      question 2 back. Leave it open.
- [ ] Task success: 70 and 85. Sidebar: 18, 30, 126. Before a measure is
      filled in, its row reads "not filled in yet".
- [ ] Plan: 18 participants, driven by Task time, "Within · 3 conditions",
      Power · alpha "0.80 · 0.05" (the 0.05 has the three-condition
      tooltip). Table: 18 covered, 30 and 126 underpowered (amber, with the
      words "underpowered"). Two warnings: "NASA-TLX is underpowered at 18:
      62% chance of detecting your target. It would need 30. Report it as
      supporting evidence." and the same for Task success with 18% and 126.
- [ ] "How these numbers were reached", NASA-TLX: "Assumption" includes
      "Assumed: participants aren't especially consistent across conditions
      (consistency Low, ρ = 0.3), the cautious choice…"; sample size "n =
      26.7083, rounded up: 27", order plan "…: 30".
- [ ] "Your analysis plan" lists two steps for each measure:
      Task time, "Step 1: Friedman test at 0.05." then "Step 2: if it's
      significant, Wilcoxon signed-rank for each pair at 0.05 (Fisher's
      protected LSD)."; NASA-TLX, repeated-measures ANOVA then paired
      t-test; Task success, Cochran's Q test then McNemar. The 0.05 in each
      step 2 has the tooltip. With two conditions there is a single step.
      Above the steps (within subjects only): "If participants give several
      values per condition, average them first; the sample size counts
      people, not trials."
- [ ] Move the slider to 12: tiles show 11 s, ± 7.5 s, 73%. The shaded
      area is labeled "73% caught" and "27% missed". The precision bar shows
      2.5 s, 10 s, 17.5 s.
- [ ] Drag the slider: tiles, curves and precision bar all update while
      dragging.
- [ ] "How these numbers were reached": Task time open, others closed.
      Alpha reads "Alpha per comparison = 0.05, after a significant overall
      test (Fisher's protected LSD, three conditions): 0.05" (tooltip on the
      last 0.05). An "Assumption" line reads "Planned assuming the overall
      test is significant; the true chance of finding a winner is slightly
      lower. A simulation check is planned for version 1.1." Sample size
      reads "n = 13.1301, rounded up: 14" and "14 ÷ 0.955 (3/π) = 14.66,
      rounded up: 15", and the order plan "18 fits 6 orders: 3 participants
      each."
- [ ] Order plan: 6 orders (A B C, B C A, C A B, C B A, A C B, B A C), key
      A = Current, B = Prototype A, C = Prototype B.
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

- [ ] In the dark theme the header button reads "Switch to light mode".
      Clicking it switches every screen to the light palette (Plan screen
      should match design/screens/4-plan-light.html), and the button then
      reads "Switch to dark mode".
- [ ] Reload the page: the light theme stays. Switch back: dark stays after
      reload, and the button label matches.
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
- [ ] Discordance 5 with rates 70 and 85: "...must be at least the
      difference in success rates (0.15)."
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
