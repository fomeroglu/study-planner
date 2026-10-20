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
      is compared (3 comparisons), using a stricter test for each so the
      overall chance of a false result stays at 5%." Remove it again: the
      note goes away.
- [ ] Name the variable "Keyboard design" and rename the conditions to
      Current, Prototype A and Prototype B (or keep A, B, C). Choose "All
      conditions". Sidebar: Within subjects, 3, "3 (every pair)".
- [ ] Step 2: the measure name is empty with the hint "e.g., Task time".
      Name measure 1 "Task time", unit "seconds", type Time. Add the
      NASA-TLX preset (it fills its own name). Add a measure "Task success", type Success / failure.
      Sidebar: "3 (primary: Task time)".
- [ ] Step 3, Task time: 10 seconds, estimate, 8 of 10. The question reads
      "At a 10-second difference, how many of 10 participants would be
      faster on the better condition?" Variability shows "≈ 12 s", "Your
      estimate, not measured." Sidebar shows 24.
- [ ] NASA-TLX: 10, "I know the standard deviation", 15, Medium. Task
      success: 70 and 85. Sidebar: 24, 30, 168.
- [ ] Plan: 24 participants, driven by Task time, "Within · 3 conditions",
      "0.80 · 0.0167". Table: 24 covered, 30 and 168 underpowered (amber, with
      the words "underpowered"). Two warnings: "NASA-TLX is underpowered at
      24: 75% chance of detecting your target. It would need 30. Report it as
      supporting evidence." and the same for Task success with 11% and 168.
- [ ] Move the slider to 12: tiles show 13 s, ± 7.5 s, 53%. The shaded
      area is labeled "53% caught" and "47% missed". The precision bar shows
      2.5 s, 10 s, 17.5 s.
- [ ] Drag the slider: tiles, curves and precision bar all update while
      dragging.
- [ ] "How these numbers were reached": Task time open, others closed.
      Alpha reads "0.05 ÷ 3 comparisons (Bonferroni): 0.0167". The rank step
      reads "18 ÷ 0.955 (3/π) = 18.85, rounded up: 19", and the order plan
      "24 fits 6 orders: 4 participants each."
- [ ] Order plan: 6 orders (A B C, B C A, C A B, C B A, A C B, B A C), key
      A = Current, B = Prototype A, C = Prototype B.

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
      outline, and the order follows the page.
- [ ] Option buttons toggle with Enter and Space.
- [ ] Step 3 tabs: Left and Right arrows move between measures; Home and
      End go to the first and last.
- [ ] "Advanced" sections open and close with Enter.
- [ ] The participants sliders move with the arrow keys.
- [ ] After "Next" or a step link, focus lands on the page heading.
- [ ] "How we got this number →" moves focus to "How these numbers were
      reached".
- [ ] With a screen reader on: the participant count is announced once
      after you stop typing ("Participants needed: 24").

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
- [ ] 5 of 10: "How many of 10 participants would do better" must be a
      whole number from 6 to 9, not 5.
- [ ] Standard deviation -2: "Standard deviation must be greater than 0."
- [ ] SEQ preset, SD 3 and expected average 6: "On a 1 to 7 scale with an
      average of 6, the standard deviation can be at most 2.24. 3 is not
      possible."
- [ ] Success rate 150 (interface): "Enter a percentage between 0 and 100."
- [ ] Rates 70 and 70: "The two success rates must differ."
- [ ] Discordance 5 with rates 70 and 85: "...must be at least the
      difference in success rates (0.15)."
- [ ] Alpha 5 (Advanced): "Alpha must be between 0 and 1, not 5."
- [ ] While any error shows, the sidebar reads "–" and "Check the
      highlighted input", and step 4 cannot be opened.

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
