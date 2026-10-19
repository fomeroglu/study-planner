# Study planner: instructions for Claude

A free, browser-based tool that helps human factors and UX researchers
plan comparison studies and problem-discovery studies: how many
participants, which analysis to plan for, and what a given sample size
can support. Built for applied HF work: small samples, plain-language
inputs, honest uncertainty.

## Source of truth

- docs/methods.md defines every calculation. Code implements methods.md;
  never the other way around.
- Never change, add, or "improve" a formula without updating methods.md
  first and rerunning all tests. If methods.md looks wrong or
  incomplete, stop and say so instead of guessing.
- validation/answer-key.md holds the reference values. Values marked
  PROVISIONAL were computed by Claude and are not yet confirmed in R or
  G*Power. Never describe the tool as validated while any value is
  provisional.

## Structure

- index.html: the interface
- engine.js: all statistical calculations, no interface code
- tests/: automated tests for engine.js (Node's built-in test runner)
- docs/methods.md: methods and sources
- validation/: answer key and reference scripts

## How to work

- Use plan mode for anything beyond a small edit. Present the plan and
  wait for approval.
- Build and test the engine before any interface work.
- Every engine function gets tests, including the answer-key cases.
- Run the tests after every change. Report results honestly, including
  failures.
- Ask before adding any dependency.

## Hard constraints

- Static site only, served from GitHub Pages. No server, no build step
  required to run it.
- No data leaves the browser. No analytics, no tracking, no network
  requests with user input.
- No network calls at runtime except optional web fonts.

## Interface language

- Plain-language question first, technical term in parentheses beside
  it, e.g. "How much do times vary between participants? (standard
  deviation)".
- Values from the user's own estimate are labeled "your estimate";
  values from data are labeled "measured".
- Report results in the measure's own units wherever possible.
- Sentence case everywhere. No em dashes in any user-facing text.
- Never use Cohen's small, medium, and large labels.

## Design

- Visual direction: "Lab instrument." Dark theme by default, with a
  light theme toggle that swaps the same color roles.
- Light palette: the "Light" column of the role table in
  design/README.md (background #F3F5F4, accent #0F766E, and so on).
  That table is the source for both themes' colors.
- Dark palette: background #0E1214, surface #161C1F, decorative lines
  #2A3337, text #E3E8E6, secondary text #9AA6A3, accent #4FD1C5,
  selected background #173B38, warning #F2B84B, warning background
  #2E2615, form-control borders #6E7D80.
- Typography: IBM Plex Sans; IBM Plex Mono for numbers.
- The final screens live in design/; match them.

## Accessibility

- WCAG 2.1 AA in both themes: text at least 4.5:1; form-control
  borders, focus indicators, and meaningful graphics at least 3:1.
- Every control usable by keyboard, with a visible focus outline.
- Never use color alone to carry meaning; pair it with text or shape.
- Responsive down to tablet width.

## Out of scope for version 1

Check mode (data upload), mixed designs, dropout adjustment,
participant-pool feasibility, shareable links, log-scale planning,
simulation checks of the plan. Don't build these, even partially.
