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
- [ ] Step 1: name the variable "Keyboard design"; conditions Current,
      Prototype A, then "+ Add condition" and Prototype B. Choose "All
      conditions", "Each condition vs. a baseline" (baseline Current), and
      "Pick a winner". The button reads "Adjusted: alpha 0.025 per
      comparison". Sidebar: Within subjects, 3, "2 vs. baseline".
- [ ] Step 2: measure 1 "Task time", unit "seconds", type Time. Add the
      NASA-TLX preset. Add a measure "Task success", type Success / failure.
      Sidebar: "3 (primary: Task time)".
- [ ] Step 3, Task time: 10 seconds, estimate, 8 of 10. The question reads
      "At a 10-second difference, how many of 10 participants would be
      faster on the new design?" Variability shows "≈ 12 s", "Your
      estimate, not measured." Sidebar shows 18.
- [ ] NASA-TLX: 10, "I know the standard deviation", 15, Medium. Task
      success: 70 and 85. Sidebar: 18, 24, 150.
- [ ] Plan: 18 participants, driven by Task time, "Within · 3 conditions",
      "0.80 · 0.025". Table: 18 covered, 24 and 150 underpowered (amber, with
      the words "underpowered"). Two warnings: "NASA-TLX is underpowered at
      18: 65% chance of detecting your target. It would need 24. Report it as
      supporting evidence." and the same for Task success with 11% and 150.
- [ ] Move the slider to 12: tiles show 12 s, ± 7.5 s, 60%. The shaded
      area is labeled "60% caught" and "40% missed". The precision bar shows
      2.5 s, 10 s, 17.5 s.
- [ ] Drag the slider: tiles, curves and precision bar all update while
      dragging.
- [ ] "How these numbers were reached": Task time open, others closed.
      The rank step reads "17 ÷ 0.955 (3/π) = 17.8, rounded up: 18".
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

- [ ] "Light theme" in the header switches every screen to the light
      palette (Plan screen should match design/screens/4-plan-light.html).
- [ ] Reload the page: the light theme stays. Switch back: dark stays after
      reload.
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
      after you stop typing ("Participants needed: 18").

## 5. Disabled options (visible, not selectable)

Add a second independent variable (Posture: Seated, Standing) and choose
"All conditions".

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

On step 1, click "Next" with everything empty:

- [ ] "Name this condition." under each empty condition; "Choose what each
      participant experiences."; "Choose which comparisons matter." Focus
      goes to the first empty condition.
- [ ] Two conditions both named "Current": "Condition names must be unique
      within Keyboard design."
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
