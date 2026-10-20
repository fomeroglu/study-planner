# Study Planner

A free, browser-based tool that helps human factors and UX researchers plan
two kinds of studies:

- **Compare designs**: compare two or more designs on measured outcomes
  such as task time, success, workload, and ratings.
- **Find problems**: plan how many participants a usability test needs to
  uncover problems in an early design.

It is built for applied work: small samples, plain-language inputs, results
in your measure's own units, and honest uncertainty.

## Use it

Once GitHub Pages is enabled, the tool runs at
https://fomeroglu.github.io/study-planner/.

To run it locally, open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8765
```

then go to http://localhost:8765.

## Privacy

Everything runs in your browser. Nothing you enter is uploaded, and there is
no analytics or tracking. The only network requests are for the IBM Plex
web fonts. The only thing saved in the browser is your light or dark theme
choice.

## What it does

- Independent variables and conditions, within or between subjects. With one
  variable, every pair of conditions is compared, always adjusted
  (Bonferroni). With two or more, you choose specific combinations and main
  effects.
- Measures: time, count, success / failure, rating scales (with NASA-TLX,
  SUS and SEQ presets) and other numeric measures, each with a planned test.
- The difference that matters, in your units or as "how many of 10
  participants should do better", with your own estimate of variability if
  you have no data.
- A plan: the recommended number of participants, underpowered secondary
  measures, your analysis plan, a confidence report for the number you can
  recruit (with power curves and precision), a counterbalancing order plan,
  and reporting guidance.
- Every step from inputs to result is shown, with values from your own
  estimates labeled as such.

## Limitations

- Within-subjects plans assume you can match each participant's values
  across conditions.
- Mixed designs, interaction comparisons and dropout adjustment are not
  part of this version.

## How it calculates

[docs/methods.md](docs/methods.md) defines every calculation, with sources.
The code implements that document. Reference values and their validation
status are in [validation/](validation/).

## Project structure

| Path | Contents |
|---|---|
| `index.html`, `styles.css`, `app.js` | The interface |
| `logic.js` | Form state to engine calls, and engine results to display text |
| `engine.js` | All statistical calculations (no interface code) |
| `tests/` | Automated tests (Node's built-in test runner) |
| `docs/methods.md` | Methods and sources |
| `docs/manual-test.md` | Click-through checklist for the browser |
| `validation/` | Answer key and reference R script |
| `design/` | Design reference screens |

No build step and no dependencies.

## Tests

With Node.js 20 or later, from the repository root:

```bash
node --test
```

## License

[MIT](LICENSE)
