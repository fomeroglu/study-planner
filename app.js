/*
 * Study planner interface: state, rendering, events, routing and theme.
 * No math here: numbers come from engine.js through logic.js. Drawing only
 * maps engine values to SVG coordinates.
 */
(function () {
  'use strict';

  const L = window.StudyLogic;
  const ids = L.ids;
  const THEME_KEY = 'study-planner-theme';
  const STEP_NAMES = ['Conditions', 'Measures', 'Inputs', 'Plan'];
  const METHODS_URL = 'https://github.com/fomeroglu/study-planner/blob/main/docs/methods.md';

  // ---------------------------------------------------------------------------
  // State (in memory only; nothing is stored except the theme)
  // ---------------------------------------------------------------------------

  function freshState() {
    const form = L.newForm();
    return {
      route: { screen: 'start', step: 1 },
      form,
      find: L.newFindForm(),
      ui: {
        openMeasure: form.measures[0].id,
        tab: form.measures[0].id,
        attempted: { 1: false, 2: false, 3: false },
        findAttempted: false,
        participants: null,
        open: {},
      },
    };
  }

  let state = freshState();
  let live = null;
  let lastAnnounced = null;
  let announceTimer = null;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  // Tooltip ids are numbered afresh on every render, in page order.
  let tipSeq = 0;

  // Rich text from logic.js: strings, arrays, and alpha tokens { alpha, tip }.
  // A token becomes a focusable value whose tooltip shows on hover and on
  // focus, and is linked with aria-describedby. Escape hides it.
  function rich(parts, opts) {
    if (parts === null || parts === undefined) return '';
    if (typeof parts === 'string') return esc(parts);
    if (Array.isArray(parts)) return parts.map((p) => rich(p, opts)).join('');
    tipSeq += 1;
    const id = `tip-${tipSeq}`;
    return `<span class="tip${opts && opts.end ? ' tip-end' : ''}" tabindex="0" aria-describedby="${id}">${esc(parts.alpha)}` +
      `<span class="tip-text" role="tooltip" id="${id}">${esc(parts.tip)}</span></span>`;
  }

  function dataAttrs(data) {
    return Object.keys(data || {}).map((k) => ` data-${k}="${esc(data[k])}"`).join('');
  }

  function trimmed(s) {
    return String(s || '').trim();
  }

  // The issue to show for a target, if any. Missing values show only after
  // the user tried to move on from that step.
  function visibleIssue(target) {
    if (!live) return null;
    return live.issues.find((i) => i.target === target && isVisible(i)) || null;
  }

  function isVisible(i) {
    return i.kind !== 'missing' || state.ui.attempted[i.step];
  }

  function errorEl(target, issue) {
    return issue ? `<p class="error" id="${esc(target)}-error">${esc(issue.message)}</p>` : '';
  }

  function describedBy(list) {
    const v = list.filter(Boolean).join(' ');
    return v ? ` aria-describedby="${esc(v)}"` : '';
  }

  // A text input bound to state. opts: id, bind, data, value, placeholder,
  // cls, inputmode, label (aria-label), hintId.
  function textInput(o) {
    const issue = visibleIssue(o.id);
    return `<input type="text" id="${esc(o.id)}" class="text-input ${o.cls || ''}" data-bind="${esc(o.bind)}"${dataAttrs(o.data)}` +
      ` value="${esc(o.value)}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}` +
      `${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}` +
      ` autocomplete="off" spellcheck="false"${issue ? ' aria-invalid="true"' : ''}` +
      `${describedBy([o.hintId, issue && `${o.id}-error`])}>`;
  }

  // Option button with aria-pressed. opts: id, action, data, pressed, title, sub, disabled (text), cls.
  function optButton(o) {
    const disabledId = o.disabled ? `${o.id}-why` : null;
    return `<button type="button" id="${esc(o.id)}" class="${o.cls || 'opt'}" data-action="${esc(o.action)}"${dataAttrs(o.data)}` +
      ` aria-pressed="${o.pressed ? 'true' : 'false'}"${o.disabled ? ' aria-disabled="true"' : ''}${describedBy([disabledId])}>` +
      (o.sub !== undefined
        ? `<span class="opt-title">${esc(o.title)}</span><span class="opt-sub">${esc(o.sub)}</span>`
        : esc(o.title)) +
      '</button>' +
      (o.disabled ? `<p class="disabled-why" id="${esc(disabledId)}">${esc(o.disabled)}</p>` : '');
  }

  // A group of option buttons that carries an error for the whole group.
  function group(id, labelHtml, inner, cls) {
    const issue = visibleIssue(id);
    return `<div role="group" id="${esc(id)}" class="${cls || ''}" aria-labelledby="${esc(id)}-label"${describedBy([issue && `${id}-error`])}>` +
      `${labelHtml.replace('%ID%', `${esc(id)}-label`)}${inner}${errorEl(id, issue)}</div>`;
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  // The label names the action, so it needs no pressed state.
  function themeToggle() {
    const label = currentTheme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    return `<button type="button" id="theme-toggle" class="theme-toggle" data-action="theme">${label}</button>`;
  }

  function stepComplete(s) {
    if (s === 4) return !!(live && live.plan);
    return !live.issues.some((i) => i.step === s);
  }

  function stepReachable(s) {
    for (let i = 1; i < s; i++) if (!stepComplete(i)) return false;
    return s < 4 || stepComplete(4);
  }

  function header() {
    const r = state.route;
    if (r.screen === 'start') {
      return `<header class="header"><div class="brand">Study Planner</div><div class="header-end">` +
        `<div class="header-note">Runs in your browser. Nothing is uploaded.</div>${themeToggle()}</div></header>`;
    }
    if (r.screen === 'find') {
      return `<header class="header"><a class="brand" href="#/start" id="brand">Study Planner</a><div class="header-end">` +
        `<div class="header-note">Find problems · formative</div>${themeToggle()}</div></header>`;
    }
    const pills = STEP_NAMES.map((name, i) => {
      const s = i + 1;
      const label = `${s} ${name}`;
      if (s === r.step) return `<li><span class="pill current" aria-current="step">${esc(label)}</span></li>`;
      const done = s < 4 && stepComplete(s) && stepReachable(s);
      if (s < r.step || stepReachable(s)) {
        return `<li><a class="pill" id="nav-${s}" href="#/compare/${s}">${esc(label)}${done ? ' ✓<span class="sr-only">, done</span>' : ''}</a></li>`;
      }
      return `<li><span class="pill">${esc(label)}</span></li>`;
    }).join('');
    return `<header class="header"><a class="brand" href="#/start" id="brand">Study Planner</a><div class="header-end">` +
      `<nav class="steps" aria-label="Steps"><ol>${pills}</ol></nav>${themeToggle()}</div></header>`;
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  const ICON_COMPARE = '<svg class="icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="5" y="20" width="10" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="19" y="10" width="10" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="33" y="26" width="10" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  const ICON_FIND = '<svg class="icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="29" y1="29" x2="42" y2="42" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="14" x2="20" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="26.5" r="1.6" fill="currentColor"/></svg>';

  function startScreen() {
    return `<main class="start-main" id="main">` +
      `<div class="intro"><h1 tabindex="-1" id="page-title">Plan a study</h1>` +
      `<p class="lede">Describe your study. The tool works out how many participants you need, which analysis to plan for, and what your sample can support.</p></div>` +
      `<div class="start-cards">` +
      `<a class="start-card" href="#/compare/1" id="start-compare">${ICON_COMPARE}<span class="title">Compare designs</span>` +
      `<span class="desc">Is one design better than another? Task time, success, workload, ratings.</span><span class="kind">Summative</span></a>` +
      `<a class="start-card" href="#/find" id="start-find">${ICON_FIND}<span class="title">Find problems</span>` +
      `<span class="desc">How many participants do you need to uncover usability problems in an early design?</span><span class="kind">Formative</span></a>` +
      `</div>` +
      `<p class="hint">Methods and validation: <a href="${METHODS_URL}" id="methods-link">read how the tool calculates</a></p>` +
      `</main>`;
  }

  // ---------------------------------------------------------------------------
  // Sidebar: "Your plan so far"
  // ---------------------------------------------------------------------------

  function sidebar(step) {
    const s = L.sidebarSummary(state.form, step, live);
    const rows = step >= 3
      ? s.measures.map((m) => `<div><dt>${m.primary ? '★ ' : ''}${esc(m.name)}</dt><dd class="${m.ready ? 'mono' : 'secondary'}">${esc(m.value)}</dd></div>`).join('')
      : s.rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('');
    return `<aside class="aside" aria-labelledby="aside-title"><h2 class="aside-title" id="aside-title">Your plan so far</h2>` +
      `<div><div class="hint">Participants needed</div><div class="big-number">${esc(s.participants)}</div>` +
      `<div class="small-hint">${esc(s.note)}</div></div><dl class="aside-rows">${rows}</dl></aside>`;
  }

  function navRow(backHref, nextHtml) {
    return `<div class="nav-row"><a class="btn" href="${backHref}" id="back">Back</a>${nextHtml}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Step 1: conditions
  // ---------------------------------------------------------------------------

  // One independent variable inside the step 1 card. The comparison note
  // (one variable, three or more conditions) sits under its conditions.
  function factorBlock(f, i, note) {
    const many = state.form.factors.length > 1;
    const levelIssue = visibleIssue(ids.factorLevels(f.id));
    const levels = f.levels.map((l, j) => {
      const issue = visibleIssue(ids.level(l.id));
      return `<div class="level-cell"><div class="level-wrap">${textInput({
        id: ids.level(l.id), bind: 'level', data: { factor: f.id, level: l.id }, value: l.name, placeholder: L.conditionName(j),
        label: `Condition ${j + 1}${many && trimmed(f.name) ? ` of ${trimmed(f.name)}` : ''}`,
      })}${f.levels.length > 2 ? `<button type="button" class="icon-btn" id="remove-level-${l.id}" data-action="remove-level" data-factor="${f.id}" data-level="${l.id}" aria-label="Remove condition ${j + 1}${trimmed(l.name) ? `, ${esc(trimmed(l.name))}` : ''}">×</button>` : ''}</div>` +
        `${errorEl(ids.level(l.id), issue)}</div>`;
    }).join('');
    return `<div class="factor-block" role="group" aria-labelledby="factor-${f.id}-title"><h2 class="sr-only" id="factor-${f.id}-title">Independent variable ${i + 1}</h2>` +
      `<div class="field"><label for="${ids.factorName(f.id)}">Independent variable ${i + 1}</label>${textInput({
        id: ids.factorName(f.id), bind: 'factor-name', data: { factor: f.id }, value: f.name, placeholder: i === 0 ? 'e.g., Interface design' : 'e.g., Posture',
      })}${errorEl(ids.factorName(f.id), visibleIssue(ids.factorName(f.id)))}</div>` +
      `<div role="group" id="${ids.factorLevels(f.id)}" aria-labelledby="${ids.factorLevels(f.id)}-label" class="field"${describedBy([levelIssue && `${ids.factorLevels(f.id)}-error`])}>` +
      `<div id="${ids.factorLevels(f.id)}-label">Conditions</div><div class="level-grid">${levels}` +
      `<button type="button" class="dashed-btn" id="add-level-${f.id}" data-action="add-level" data-factor="${f.id}">+ Add condition</button></div>` +
      `${errorEl(ids.factorLevels(f.id), levelIssue)}</div>` +
      (note !== undefined ? `<p class="soft-note" id="${ids.comparisons()}" aria-live="polite">${rich(note)}</p>` : '') +
      (many ? `<div><button type="button" class="small-btn" id="remove-factor-${f.id}" data-action="remove-factor" data-factor="${f.id}">Remove independent variable ${i + 1}</button></div>` : '') +
      `</div>`;
  }

  function comparisonChips(list, disabledText, kind) {
    return `<div class="chip-row">${list.map((c) => optButton({
      id: `cmp-${c.key}`, action: 'toggle-comparison', data: { key: c.key }, cls: 'chip tall',
      pressed: state.form.comparisons.selected.includes(c.key), title: c.label,
      disabled: kind === 'main' && disabledText && !state.form.comparisons.selected.includes(c.key) ? disabledText : null,
    })).join('')}</div>`;
  }

  function step1() {
    const form = state.form;
    const v = L.step1View(form);
    const designBtns = `<div class="opt-grid">${optButton({ id: 'design-between', action: 'design', data: { value: 'between' }, pressed: form.design === 'between', title: 'One condition', sub: 'Between subjects' })}` +
      `${optButton({ id: 'design-within', action: 'design', data: { value: 'within' }, pressed: form.design === 'within', title: 'All conditions', sub: 'Within subjects' })}</div>`;

    // One variable: every pair, always adjusted (methods.md §1.2, §1.3), noted under
    // the conditions once there are three or more. Two or more: the comparison checklist.
    const comparisons = v.single
      ? ''
      : `<section class="card" aria-labelledby="${ids.comparisons()}-label">${group(ids.comparisons(), '<h2 class="card-title" id="%ID%">Which comparisons matter?</h2>',
        `<p class="hint">${rich(v.comparisonLine)}</p>` +
        `<div class="field"><div class="card-title" style="font-size:16px">Main effects</div><p class="hint">One level against another, averaged across the other variable.</p>` +
        `${comparisonChips(v.candidates.main, v.mainDisabled, 'main')}</div>` +
        `<div class="field"><div class="card-title" style="font-size:16px">Specific combinations</div><p class="hint">One combination of levels against another.</p>${comparisonChips(v.candidates.cell, null, 'cell')}</div>` +
        `<div class="field"><div class="card-title" style="font-size:16px">Interactions</div>${optButton({
          id: 'cmp-interaction', action: 'none', cls: 'chip tall', pressed: false,
          title: 'Interaction comparisons (a difference of differences)', disabled: v.interactionDisabled,
        })}</div>`, 'field')}</section>`;

    return `<div class="page"><main class="main" id="main">` +
      `<div class="intro"><h1 tabindex="-1" id="page-title">What are you comparing?</h1><p>Add what you manipulate (independent variables) and their conditions.</p></div>` +
      `<section class="card step1-card" aria-label="Conditions and design">` +
      form.factors.map((f, i) => factorBlock(f, i, v.single ? v.conditionsNote : undefined)).join('<hr class="divider">') +
      `<button type="button" class="dashed-btn" id="add-factor" data-action="add-factor">+ Add independent variable</button>` +
      `<hr class="divider">` +
      group(ids.design(), '<h2 class="card-title" id="%ID%">Each participant experiences</h2>', designBtns, 'field') +
      `</section>` +
      comparisons +
      generalError() +
      navRow('#/start', '<button type="button" class="btn primary" id="next-1" data-action="next" data-step="1">Next: Measures</button>') +
      `</main>${sidebar(1)}</div>`;
  }

  function generalError() {
    const issue = visibleIssue('general');
    return issue ? `<p class="warning" id="general">${esc(issue.message)}</p>` : '';
  }

  // ---------------------------------------------------------------------------
  // Step 2: measures
  // ---------------------------------------------------------------------------

  function measureSummary(m) {
    const form = state.form;
    const preset = m.preset ? L.PRESET_DISPLAY[m.preset] : null;
    const type = m.type ? (preset ? preset.note : L.TYPE_LABELS[m.type]) : 'No result type yet';
    const per = form.design === 'between' ? 'one value per participant'
      : m.linked ? 'one value per participant per condition' : 'values not linked to a participant';
    return `${type} · ${per}`;
  }

  function measureCard(m, i) {
    const form = state.form;
    const name = trimmed(m.name) || `Measure ${i + 1}`;
    if (state.ui.openMeasure !== m.id) {
      const issues = live.issues.filter((x) => x.measureId === m.id && x.step === 2 && isVisible(x));
      return `<section class="card" style="padding:20px 24px;flex-direction:row;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px" aria-labelledby="mname-${m.id}">` +
        `<div style="display:flex;flex-direction:column;gap:4px"><div style="font-size:17px;font-weight:600" id="mname-${m.id}">${m.primary ? '★ ' : ''}${esc(name)}${m.preset ? '<span class="badge">Preset</span>' : ''}</div>` +
        `<div class="hint">${esc(measureSummary(m))}</div>${issues.length ? `<p class="error">${esc(issues[0].message)}</p>` : ''}</div>` +
        `<div class="chip-row"><button type="button" class="small-btn" id="edit-${m.id}" data-action="edit-measure" data-measure="${m.id}" aria-label="Edit ${esc(name)}">Edit</button>` +
        (form.measures.length > 1 ? `<button type="button" class="small-btn" id="remove-measure-${m.id}" data-action="remove-measure" data-measure="${m.id}" aria-label="Remove ${esc(name)}">Remove</button>` : '') +
        '</div></section>';
    }
    const binaryWhy = L.binaryTypeDisabled(form);
    const types = L.TYPE_ORDER.map((t) => optButton({
      id: `type-${m.id}-${t}`, action: 'type', data: { measure: m.id, value: t }, cls: 'chip',
      pressed: m.type === t, title: L.TYPE_LABELS[t],
      disabled: t === 'binary' && binaryWhy && m.type !== 'binary' ? binaryWhy : null,
    })).join('');
    const scale = m.type === 'rating'
      ? `<div role="group" id="${ids.measureScale(m.id)}" class="field" aria-labelledby="${ids.measureScale(m.id)}-label"${describedBy([`${ids.measureScale(m.id)}-hint`, visibleIssue(ids.measureScale(m.id)) && `${ids.measureScale(m.id)}-error`])}>` +
        `<div id="${ids.measureScale(m.id)}-label">Scale range</div><div class="field-row">` +
        `<label class="field-row" for="measure-${m.id}-scalemin"><span class="after">From</span></label>${textInput({ id: `measure-${m.id}-scalemin`, bind: 'scale-min', data: { measure: m.id }, value: m.scaleMin, cls: 'number w-80', inputmode: 'decimal' })}` +
        `<label class="field-row" for="measure-${m.id}-scalemax"><span class="after">to</span></label>${textInput({ id: `measure-${m.id}-scalemax`, bind: 'scale-max', data: { measure: m.id }, value: m.scaleMax, cls: 'number w-80', inputmode: 'decimal' })}</div>` +
        `<p class="small-hint" id="${ids.measureScale(m.id)}-hint">Optional. The lowest and highest possible values.</p>${errorEl(ids.measureScale(m.id), visibleIssue(ids.measureScale(m.id)))}</div>`
      : '';
    const linked = form.design === 'between' ? ''
      : `<div role="group" class="field" aria-labelledby="linked-${m.id}-label"><div id="linked-${m.id}-label">Does each participant give one value per condition?</div><div class="chip-row">` +
        optButton({ id: `linked-${m.id}-yes`, action: 'linked', data: { measure: m.id, value: 'yes' }, cls: 'chip', pressed: m.linked, title: 'Yes' }) +
        optButton({ id: `linked-${m.id}-no`, action: 'linked', data: { measure: m.id, value: 'no' }, cls: 'chip', pressed: !m.linked, title: 'No, values aren\'t linked to a participant' }) +
        `</div><p class="small-hint">Several trials per participant? Average them into one value per condition, then choose Yes.</p></div>`;
    return `<section class="card focus-card" aria-labelledby="mhead-${m.id}" style="gap:18px">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2 class="mono secondary" style="margin:0;font-size:14px;font-weight:400" id="mhead-${m.id}">Measure ${i + 1}</h2>` +
      `<button type="button" class="primary-toggle" id="primary-${m.id}" data-action="primary" data-measure="${m.id}" aria-pressed="${m.primary}">${m.primary ? '★ Primary' : '☆ Primary'}</button></div>` +
      `<div class="grid-2"><div class="field"><label for="${ids.measureName(m.id)}">Name</label>${textInput({ id: ids.measureName(m.id), bind: 'measure-name', data: { measure: m.id }, value: m.name, placeholder: 'e.g., Task time' })}${errorEl(ids.measureName(m.id), visibleIssue(ids.measureName(m.id)))}</div>` +
      (m.type === 'binary' ? '' : `<div class="field"><label for="measure-${m.id}-unit">Unit</label>${textInput({ id: `measure-${m.id}-unit`, bind: 'measure-unit', data: { measure: m.id }, value: m.unit, placeholder: m.type === 'time' || !m.type ? 'e.g., seconds' : 'e.g., points' })}</div>`) +
      `</div>` +
      group(ids.measureType(m.id), '<div id="%ID%" style="font-size:14px;font-weight:500">Result type</div>',
        `<div class="chip-row">${types}</div>${m.type ? `<p class="small-hint">${esc(L.TYPE_HELP[m.type])}</p>` : ''}`, 'field') +
      scale + linked +
      (form.measures.length > 1 ? `<div><button type="button" class="small-btn" id="remove-measure-${m.id}" data-action="remove-measure" data-measure="${m.id}" aria-label="Remove ${esc(name)}">Remove</button></div>` : '') +
      `</section>`;
  }

  function step2() {
    const form = state.form;
    return `<div class="page"><main class="main" id="main">` +
      `<div class="intro"><h1 tabindex="-1" id="page-title">What are you measuring?</h1><p>Add each dependent variable. Mark the one your decision rests on as primary.</p></div>` +
      `<div id="${ids.measures()}" style="display:flex;flex-direction:column;gap:24px" tabindex="-1">${form.measures.map(measureCard).join('')}${errorEl(ids.measures(), visibleIssue(ids.measures()))}</div>` +
      `<div class="chip-row" style="align-items:center"><button type="button" class="dashed-btn" style="height:48px" id="add-measure" data-action="add-measure">+ Add measure</button>` +
      `<span class="hint" style="margin-left:8px" id="presets-label">Fill the measure you're editing with a preset:</span>` +
      ['nasa-tlx', 'sus', 'seq'].map((k) => `<button type="button" class="chip round" id="preset-${k}" data-action="preset" data-value="${k}" aria-describedby="presets-label">${esc(L.PRESET_DISPLAY[k].name)}</button>`).join('') +
      `</div>` + generalError() +
      `<div class="nav-row"><a class="btn" href="#/compare/1" id="back">Back</a><div class="chip-row">` +
      `<button type="button" class="btn" id="start-over" data-action="new-plan">Start over</button>` +
      '<button type="button" class="btn primary" id="next-2" data-action="next" data-step="2">Next: Inputs</button></div></div>' +
      `</main>${sidebar(2)}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Step 3: inputs
  // ---------------------------------------------------------------------------

  function numberField(o) {
    const issue = visibleIssue(o.id);
    const hintId = o.hint ? `${o.id}-hint` : null;
    return `<div class="field ${o.large ? 'large' : ''}"><label for="${esc(o.id)}">${esc(o.label)}</label>` +
      (o.hint ? `<span class="field-hint" id="${hintId}">${esc(o.hint)}</span>` : '') +
      `<span class="field-row">${textInput({ id: o.id, bind: 'input', data: o.data, value: o.value, placeholder: o.placeholder, cls: `number ${o.width || 'w-120'}`, inputmode: o.inputmode || 'decimal', hintId })}` +
      (o.after ? `<span class="after">${esc(o.after)}</span>` : '') + `</span>${errorEl(o.id, issue)}</div>`;
  }

  function inputsBlock(m, key) {
    const form = state.form;
    const inp = L.inputsFor(m, key);
    const t = L.inputText(form, m, key);
    const d = (field) => ({ measure: m.id, key, field });
    const id = (field) => ids.input(m.id, key, field);
    const head = t.heading ? `<h3 class="comparison-head">${esc(t.heading)}</h3>` : '';

    if (m.type === 'binary') {
      const psi = t.paired
        ? `<details class="advanced" data-open-key="psi-${m.id}-${key}"${state.ui.open[`psi-${m.id}-${key}`] || inp.psi ? ' open' : ''}><summary>Advanced: share who succeed in one condition and fail in the other</summary><div class="details-body">` +
          numberField({ id: id('psi'), data: d('psi'), label: t.psiLabel, hint: t.psiHint, value: inp.psi, after: '%', width: 'w-100' }) + '</div></details>'
        : '';
      return `<section class="card focus-card" aria-label="${esc(t.heading || `${trimmed(m.name)} inputs`)}">${head}` +
        numberField({ id: id('p1'), data: d('p1'), label: t.p1Label, value: inp.p1, placeholder: '70', after: '%', width: 'w-100', large: true }) +
        numberField({ id: id('p2'), data: d('p2'), label: t.p2Label, value: inp.p2, placeholder: '85', after: '%', width: 'w-100', large: true }) +
        psi + '</section>';
    }

    const readout = L.variabilityReadout(form, m, key);
    const readoutHtml = readout
      ? `<div class="readout-line"><span class="hint">${esc(readout.label)}</span><span class="value">${esc(readout.value)}</span><span class="small-hint">${esc(readout.note)}</span></div>`
      : '';
    const deltaField = numberField({ id: id('delta'), data: d('delta'), label: `1. ${t.deltaLabel}`, hint: t.deltaHint, value: inp.delta, placeholder: t.deltaRequired ? '' : 'Optional', after: t.unit, large: true });

    // Question 2, or the past-data section that replaces it.
    const kId = id('k');
    const kIssue = visibleIssue(kId);
    const question2 = t.pastData ? '' :
      `<div class="field large"><label for="${esc(kId)}">2. ${esc(t.kQuestion)}</label>` +
      `<span class="field-hint" id="${esc(kId)}-hint">${esc(t.kRange)} ${rich(t.kTip)}${t.kContext ? ` ${esc(t.kContext)}` : ''}</span>` +
      `<span class="field-row">${textInput({ id: kId, bind: 'input', data: d('k'), value: inp.k, placeholder: '8', cls: 'number w-80', inputmode: 'numeric', hintId: `${kId}-hint` })}<span class="after">of 10</span></span>` +
      `${errorEl(kId, kIssue)}</div>`;
    const pastId = `past-${m.id}-${key}`;
    const pastData = `<div class="past-data"><button type="button" class="disclosure" id="${esc(pastId)}" data-action="past-data" data-measure="${m.id}" data-key="${esc(key)}" aria-expanded="${t.pastData}" aria-controls="${esc(pastId)}-body">` +
      `<span aria-hidden="true">${t.pastData ? '▾' : '▸'}</span> ${esc(t.pastDataToggle)}</button>` +
      (t.pastData
        ? `<div class="inset" id="${esc(pastId)}-body">` +
          numberField({ id: id('sd'), data: d('sd'), label: t.sdLabel, value: inp.sd, after: t.unit }) +
          (t.consistencyNote ? `<p class="small-hint" style="margin:0;line-height:1.5">${esc(t.consistencyNote)}</p>` : '') +
          '</div>'
        : '') + '</div>';
    const body = deltaField + question2 + pastData + readoutHtml + `<p class="small-hint" style="margin:0">${esc(t.resultsIn)}</p>`;
    return `<section class="card focus-card" style="gap:20px" aria-label="${esc(t.heading || `${trimmed(m.name)} inputs`)}">${head}${body}</section>`;
  }

  function advancedSection() {
    const form = state.form;
    const open = state.ui.open.advanced;
    const field = (id, label, value, hint) => {
      const issue = visibleIssue(id);
      return `<div class="field"><label for="${id}">${esc(label)}</label><span class="field-row">${textInput({ id, bind: id, value, cls: 'number w-100', inputmode: 'decimal', hintId: `${id}-hint` })}</span>` +
        `<span class="small-hint" id="${id}-hint">${esc(hint)}</span>${errorEl(id, issue)}</div>`;
    };
    const forced = visibleIssue(ids.alpha()) || visibleIssue(ids.power());
    return `<details class="advanced" data-open-key="advanced"${open || forced ? ' open' : ''}><summary>Advanced: power, alpha, test adjustment</summary>` +
      `<div class="details-body"><p class="hint" style="line-height:1.6">${rich(L.advancedSummary(form))}</p>` +
      `<div class="grid-2">${field(ids.power(), 'Chance of detecting the difference if it is real (power)', form.power, 'Default 0.80. Applies to every measure.')}` +
      `${field(ids.alpha(), 'Overall false-alarm risk (alpha)', form.alpha, 'Default 0.05, two-sided. Applies to every measure.')}</div></div></details>`;
  }

  function step3() {
    const form = state.form;
    if (!form.measures.some((m) => m.id === state.ui.tab)) state.ui.tab = form.measures[0].id;
    const tabs = form.measures.map((m, i) => {
      const selected = m.id === state.ui.tab;
      const flagged = live.issues.some((x) => x.measureId === m.id && x.step === 3 && isVisible(x));
      return `<button type="button" role="tab" class="tab" id="tab-${m.id}" aria-selected="${selected}" aria-controls="panel-${m.id}" tabindex="${selected ? 0 : -1}" data-action="tab" data-measure="${m.id}">` +
        `${m.primary ? '★ ' : ''}${esc(trimmed(m.name) || `Measure ${i + 1}`)}${flagged ? '<span class="tab-flag">needs attention</span>' : ''}</button>`;
    }).join('');
    const m = form.measures.find((x) => x.id === state.ui.tab);
    const keys = L.inputKeys(form);
    const measureIssue = visibleIssue(ids.measureInputs(m.id));
    const panel = `<div role="tabpanel" id="panel-${m.id}" aria-labelledby="tab-${m.id}" style="display:flex;flex-direction:column;gap:24px">` +
      `<h2 class="measure-heading" id="measure-heading-${m.id}">${esc(L.inputText(form, m, keys[0]).measureHeading)}</h2>` +
      `<div id="${ids.measureInputs(m.id)}" tabindex="-1">${measureIssue ? `<p class="warning">${esc(measureIssue.message)}</p>` : ''}</div>` +
      (m.type ? keys.map((k) => inputsBlock(m, k)).join('') : '<p class="warning">Choose a result type for this measure in step 2.</p>') +
      `<section class="card">${advancedSection()}</section></div>`;
    return `<div class="page"><main class="main" id="main">` +
      `<div class="intro"><h1 tabindex="-1" id="page-title">What difference matters?</h1><p>For each measure, describe the smallest improvement worth acting on. Decide it before the study.</p></div>` +
      `<div role="tablist" aria-label="Measures" class="tablist" id="tablist">${tabs}</div>${panel}` + generalError() +
      navRow('#/compare/2', '<button type="button" class="btn primary" id="see-plan" data-action="next" data-step="3">See the plan</button>') +
      `</main>${sidebar(3)}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Step 4: the plan
  // ---------------------------------------------------------------------------

  // Map a value range to SVG pixels.
  function scale(d0, d1, r0, r1) {
    return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  }

  function pathOf(points, xs, ys, key) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${xs(p.x).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
  }

  function powerCurveSvg(curve, cv) {
    const X0 = 40;
    const X1 = 860;
    const BASE = 200;
    const xs = scale(curve.xMin, curve.xMax, X0, X1);
    const ys = scale(0, curve.yMax, BASE, 50);
    const none = pathOf(curve.points, xs, ys, 'none');
    const target = pathOf(curve.points, xs, ys, 'target');
    const area = `${target} L${X1},${BASE} L${X0},${BASE} Z`;
    const bar = xs(curve.critical);
    const lower = curve.lowerCritical === null ? null : xs(curve.lowerCritical);
    const c0 = xs(curve.centers.none);
    const c1 = xs(curve.centers.target);
    const clamp = (x) => Math.min(Math.max(x, 110), 790);
    // Keep the curve labels clear of the significance bar (about 6.5 px per character).
    const placeLabel = (x, text) => {
      const half = (text.length * 6.5) / 2;
      if (x - half < bar + 8 && x + half > bar - 8) {
        return x >= bar ? { x: Math.min(bar + 10, 880 - 2 * half), anchor: 'start' } : { x: Math.max(bar - 10, 2 * half + 20), anchor: 'end' };
      }
      return { x: clamp(x), anchor: 'middle' };
    };
    const noneAt = placeLabel(c0, cv.curve.noneLabel);
    const targetAt = placeLabel(c1, cv.curve.targetLabel);
    const close = Math.abs(targetAt.x - noneAt.x) < 200;
    const ticks = cv.curve.ticks.map((t) => `<text x="${xs(t.x).toFixed(1)}" y="222" text-anchor="middle" class="svg-text-2" style="font-size:12px">${esc(t.label)}</text>`).join('');
    return `<svg viewBox="0 0 900 250" width="100%" role="img" aria-label="${esc(cv.curve.ariaLabel)}">` +
      `<defs><clipPath id="clip-caught"><rect x="${bar.toFixed(1)}" y="0" width="${(X1 - bar + 40).toFixed(1)}" height="${BASE}"/>` +
      (lower !== null ? `<rect x="0" y="0" width="${Math.max(0, lower).toFixed(1)}" height="${BASE}"/>` : '') + `</clipPath></defs>` +
      `<path d="${area}" fill="var(--accent)" fill-opacity="var(--shade-opacity)" clip-path="url(#clip-caught)"/>` +
      `<path d="${none}" fill="none" stroke="var(--control)" stroke-width="2" stroke-dasharray="5 4"/>` +
      `<path d="${target}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>` +
      `<line x1="${X0}" y1="${BASE}" x2="${X1}" y2="${BASE}" stroke="var(--control)" stroke-width="1.5"/>` +
      `<line x1="${bar.toFixed(1)}" y1="28" x2="${bar.toFixed(1)}" y2="${BASE}" stroke="var(--text)" stroke-width="2"/>` +
      `<text x="${clamp(bar).toFixed(1)}" y="20" text-anchor="middle" class="svg-text" style="font-size:13px;font-weight:600">${esc(cv.curve.barLabel)}</text>` +
      `<text x="${noneAt.x.toFixed(1)}" y="40" text-anchor="${noneAt.anchor}" class="svg-text-2" style="font-size:13px">${esc(cv.curve.noneLabel)}</text>` +
      `<text x="${targetAt.x.toFixed(1)}" y="${close ? 58 : 40}" text-anchor="${targetAt.anchor}" class="svg-accent" style="font-size:13px">${esc(cv.curve.targetLabel)}</text>` +
      `<text x="${Math.min(bar + 85, 820).toFixed(1)}" y="168" text-anchor="middle" class="svg-text" style="font-size:16px;font-weight:600">${esc(cv.curve.caught)}</text>` +
      `<text x="${Math.max(bar - 60, 70).toFixed(1)}" y="168" text-anchor="middle" class="svg-text-2" style="font-size:13px">${esc(cv.curve.missed)}</text>` +
      ticks +
      `<text x="450" y="245" text-anchor="middle" class="svg-text-2" style="font-size:13px">${esc(cv.curve.axisTitle)}</text></svg>`;
  }

  function precisionSvg(curve, cv, mode) {
    const p = cv.precision;
    let d0;
    let d1;
    if (mode === 'units') {
      d0 = curve.xMin;
      d1 = curve.xMax;
    } else {
      const span = p.highX - p.lowX;
      d0 = Math.min(0, p.lowX) - span * 0.15;
      d1 = p.highX + span * 0.15;
    }
    const xs = scale(d0, d1, 40, 860);
    return `<svg viewBox="0 0 900 56" width="100%" role="img" aria-label="${esc(p.label)}">` +
      `<line x1="40" y1="22" x2="860" y2="22" stroke="var(--line)"/>` +
      `<line x1="${xs(p.lowX).toFixed(1)}" y1="22" x2="${xs(p.highX).toFixed(1)}" y2="22" stroke="var(--accent)" stroke-width="6" stroke-linecap="round"/>` +
      `<circle cx="${xs(p.midX).toFixed(1)}" cy="22" r="8" fill="var(--accent)"/>` +
      `<text x="${xs(p.lowX).toFixed(1)}" y="50" text-anchor="middle" class="svg-text-2" style="font-size:12px">${esc(p.low)}</text>` +
      `<text x="${xs(p.midX).toFixed(1)}" y="50" text-anchor="middle" class="svg-text" style="font-size:12px">${esc(p.mid)}</text>` +
      `<text x="${xs(p.highX).toFixed(1)}" y="50" text-anchor="middle" class="svg-text-2" style="font-size:12px">${esc(p.high)}</text></svg>`;
  }

  function confidenceSection(plan) {
    const range = L.sliderRange(plan);
    if (state.ui.participants === null) state.ui.participants = range.value;
    const n = Math.min(Math.max(state.ui.participants, range.min), range.max);
    const c = L.confidence(plan, n, state.form);
    const sliderIssue = c.error;
    let body;
    if (c.report) {
      const cv = L.confidenceView(c.report, c.curve);
      body = `<div class="tiles">${cv.tiles.map((t) => `<div class="tile"><div class="value">${esc(t.value)}</div><div class="label">${esc(t.label)}</div></div>`).join('')}</div>` +
        powerCurveSvg(c.curve, cv) +
        (cv.precision ? `<div style="display:flex;flex-direction:column;gap:6px"><div class="label-caps">Precision: the ± range around your result</div>${precisionSvg(c.curve, cv, c.report.mode)}</div>` : '') +
        (cv.note ? `<div class="small-hint">${esc(cv.note)}</div>` : '');
    } else {
      body = '';
    }
    const unitWord = plan.design === 'between' ? ` (${plan.k} equal groups)` : '';
    return `<section class="card square" aria-labelledby="confidence-title"><h2 class="section-title" id="confidence-title">Confidence report</h2>` +
      `<p class="hint">For ${esc(plan.primary)}, the primary measure.</p>` +
      `<label class="slider-label" for="${ids.participants()}"><span>Participants you can recruit${esc(unitWord)}: <output for="${ids.participants()}" id="participants-out">${n}</output></span>` +
      `<input type="range" id="${ids.participants()}" data-bind="plan-n" min="${range.min}" max="${range.max}" step="${range.step}" value="${n}"${describedBy([sliderIssue && `${ids.participants()}-error`])}></label>` +
      errorEl(ids.participants(), sliderIssue) + body + '</section>';
  }

  function step4() {
    const plan = live.plan;
    if (!plan) {
      return `<main class="plan-main" id="main"><h1 tabindex="-1" id="page-title" class="section-title">The plan needs every input</h1>` +
        `<p class="hint">Some inputs changed or are missing.</p><div class="nav-row"><a class="btn square-btn" href="#/compare/3" id="back">Back to inputs</a></div></main>`;
    }
    const v = L.planView(plan, state.form);
    const rows = v.rows.map((r) => `<tr><td class="name">${r.primary ? '★ ' : ''}${esc(r.name)}</td>` +
      `<td class="needed ${r.covered ? 'covered' : 'under'}">${r.needed}<span class="status-word">${r.covered ? 'covered' : 'underpowered'}</span></td>` +
      `<td>${esc(r.method)}</td><td class="why">${esc(r.why)}</td></tr>`).join('');
    const trails = v.trails.map((t) => {
      const key = `trail-${t.name}`;
      const open = state.ui.open[key] === undefined ? t.open : state.ui.open[key];
      return `<details class="trail-details" data-open-key="${esc(key)}"${open ? ' open' : ''}><summary>${t.primary ? '★ ' : ''}${esc(t.name)}</summary>` +
        `<ol class="trail">${t.groups.map((g) => `<li><b>${esc(g.title)}.</b> ${g.lines.map((line) => rich(line)).join(' ')}</li>`).join('')}</ol></details>`;
    }).join('');
    const op = v.orderPlan;
    const orders = op.within
      ? `<ol class="orders">${op.orders.map((o) => `<li><span class="num">${o.number}</span>${esc(o.sequence)}</li>`).join('')}</ol>` +
        `<div class="small-hint">${op.key.map(esc).join(' · ')}</div>`
      : `<div class="small-hint">Conditions: ${op.key.map(esc).join(' · ')}</div>`;
    return `<main class="plan-main" id="main"><h1 class="sr-only" tabindex="-1" id="page-title">Your study plan</h1>` +
      `<section class="card square" style="gap:20px" aria-labelledby="readout-title"><h2 class="label-caps" style="margin:0" id="readout-title">Recommended sample</h2>` +
      `<div class="readout-grid">` +
      `<div><div class="label-caps">Participants</div><div class="hero">${v.participants}</div></div>` +
      `<div><div class="label-caps">Driven by</div><div class="value">${esc(v.drivenBy)}</div></div>` +
      `<div><div class="label-caps">Design</div><div class="value">${esc(v.design)}</div></div>` +
      `<div><div class="label-caps">Power · alpha</div><div class="value mono">${rich(v.powerAlpha, { end: true })}</div></div></div>` +
      `<button type="button" class="link-btn" id="to-how" data-action="scroll-how">How we got this number →</button></section>` +
      `<section class="card square" aria-labelledby="per-measure-title"><h2 class="section-title" id="per-measure-title">Per measure</h2>` +
      `<div class="table-wrap" tabindex="0" role="region" aria-label="Per measure table"><table class="plan-table"><thead><tr>` +
      ['Measure', 'Needed', 'Planned method', 'Why'].map((h) => `<th scope="col" class="label-caps">${h}</th>`).join('') +
      `</tr></thead><tbody>${rows}</tbody></table></div>` +
      v.warnings.map((w) => `<p class="warning">${esc(w)}</p>`).join('') +
      (v.coverAll ? `<p class="hint">${esc(v.coverAll)}</p>` : '') + '</section>' +
      `<section class="card square" aria-labelledby="analysis-title"><h2 class="section-title" id="analysis-title">Your analysis plan</h2>` +
      `<p class="hint">Run these after the study. The sample size above is based on the last step.</p>` +
      v.analysis.map((a) => `<div class="analysis-measure"><h3 class="analysis-name">${a.primary ? '★ ' : ''}${esc(a.name)}</h3>` +
        (a.steps.length > 1
          ? `<ul class="analysis-steps">${a.steps.map((st) => `<li>${rich(st)}</li>`).join('')}</ul>`
          : `<p class="analysis-one">${rich(a.steps[0])}</p>`) + '</div>').join('') +
      '</section>' +
      confidenceSection(plan) +
      `<section class="card square" id="how" aria-labelledby="how-title"><h2 class="section-title" id="how-title" tabindex="-1">How these numbers were reached</h2>${trails}</section>` +
      `<div class="two-col"><section class="card square" aria-labelledby="orders-title"><h2 class="section-title" id="orders-title">Order plan</h2><p class="hint" style="font-size:15px">${esc(op.text)}</p>${orders}</section>` +
      `<section class="card square guidance" aria-labelledby="guidance-title"><h2 class="section-title" id="guidance-title">Reporting guidance</h2>` +
      v.guidance.map((g) => `<p><b>${esc(g.lead)}:</b> ${esc(g.text)}</p>`).join('') + '</section></div>' +
      `<div class="nav-row"><a class="btn square-btn" href="#/compare/3" id="back">Back</a><button type="button" class="btn square-btn" id="new-plan" data-action="new-plan">Start a new plan</button></div>` +
      `</main>`;
  }

  // ---------------------------------------------------------------------------
  // Find problems
  // ---------------------------------------------------------------------------

  function findIssue(v, target) {
    const i = v.issues.find((x) => x.target === target);
    if (!i) return null;
    return i.kind !== 'missing' || state.ui.findAttempted ? i : null;
  }

  function findField(v, id, bind, label, hint, value, placeholder) {
    const issue = findIssue(v, id);
    const hintId = hint ? `${id}-hint` : null;
    return `<div class="field large"><label for="${id}">${esc(label)}</label>${hint ? `<span class="field-hint" id="${hintId}">${esc(hint)}</span>` : ''}` +
      `<span class="field-row"><input type="text" id="${id}" class="text-input number w-100" data-bind="${bind}" value="${esc(value)}" placeholder="${placeholder}" inputmode="decimal" autocomplete="off"` +
      `${issue ? ' aria-invalid="true"' : ''}${describedBy([hintId, issue && `${id}-error`])}><span class="after">%</span></span>${errorEl(id, issue)}</div>`;
  }

  function findCurveSvg(c) {
    const xs = scale(0, c.axisMax, 60, 860);
    const ys = scale(0, 1, 200, 20);
    const line = (key) => c.points.map((p) => `${xs(p.n).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
    const cx = xs(c.chosen);
    const px = xs(c.planN);
    const labelLeft = (x) => (x > 700 ? 'end' : 'start');
    const off = (x) => (x > 700 ? -8 : 8);
    const commonIdx = Math.min(4, c.axisMax);
    const chosenIdx = Math.round(c.axisMax * 0.75);
    return `<svg viewBox="0 0 900 250" width="100%" role="img" aria-label="${esc(c.ariaLabel)}">` +
      `<line x1="60" y1="200" x2="860" y2="200" stroke="var(--control)"/><line x1="60" y1="20" x2="60" y2="200" stroke="var(--control)"/>` +
      `<line x1="60" y1="${ys(c.targetLine).toFixed(1)}" x2="860" y2="${ys(c.targetLine).toFixed(1)}" stroke="var(--control)" stroke-dasharray="5 4"/>` +
      `<text x="866" y="${(ys(c.targetLine) + 4).toFixed(1)}" class="svg-text-2" style="font-size:12px">${esc(c.targetLabel)}</text>` +
      `<text x="52" y="24" text-anchor="end" class="svg-text-2" style="font-size:12px">100%</text><text x="52" y="204" text-anchor="end" class="svg-text-2" style="font-size:12px">0%</text>` +
      (c.showCommon ? `<polyline points="${line('common')}" fill="none" stroke="var(--control)" stroke-width="2" stroke-dasharray="6 4"/>` : '') +
      `<polyline points="${line('chosen')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>` +
      `<line x1="${cx.toFixed(1)}" y1="20" x2="${cx.toFixed(1)}" y2="200" stroke="var(--text)" stroke-width="2"/>` +
      `<circle cx="${cx.toFixed(1)}" cy="${ys(c.chosenY).toFixed(1)}" r="6" fill="var(--accent)"/>` +
      `<text x="${(cx + off(cx)).toFixed(1)}" y="${Math.min(ys(c.chosenY) + 18, 192).toFixed(1)}" text-anchor="${labelLeft(cx)}" class="svg-text" style="font-size:13px;font-weight:600">${esc(c.chosenLabel)}</text>` +
      (c.planN !== c.chosen
        ? `<circle cx="${px.toFixed(1)}" cy="${ys(c.planY).toFixed(1)}" r="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>` +
          `<text x="${(px + off(px)).toFixed(1)}" y="${Math.max(ys(c.planY) - 10, 14).toFixed(1)}" text-anchor="${labelLeft(px)}" class="svg-accent" style="font-size:13px">${esc(c.planLabel)}</text>`
        : '') +
      (c.showCommon ? `<text x="${(xs(commonIdx) + 6).toFixed(1)}" y="${Math.max(ys(c.points[commonIdx].common) - 10, 14).toFixed(1)}" class="svg-text-2" style="font-size:12px">${esc(c.commonCurveLabel)}</text>` : '') +
      `<text x="${xs(chosenIdx).toFixed(1)}" y="${Math.min(ys(c.points[chosenIdx].chosen) + 22, 192).toFixed(1)}" class="svg-accent" style="font-size:12px">${esc(c.chosenCurveLabel)}</text>` +
      c.ticks.map((t) => `<text x="${xs(t).toFixed(1)}" y="222" text-anchor="middle" class="svg-text-2" style="font-size:12px">${t}</text>`).join('') +
      `<text x="460" y="244" text-anchor="middle" class="svg-text-2" style="font-size:13px">Participants</text></svg>`;
  }

  function findScreen() {
    const f = state.find;
    const v = L.findView(f);
    const inputs = `<section class="card" style="gap:20px" aria-label="Inputs">` +
      findField(v, ids.findP(), 'find-p', 'Smallest problem frequency you care about', '(share of users who would run into it)', f.p, '10') +
      findField(v, ids.findBigP(), 'find-P', 'How sure do you want to be of seeing it at least once?', null, f.P, '80') + '</section>';
    let results;
    let aside;
    if (v.ready) {
      results = `<section class="card" style="gap:14px" aria-labelledby="chance-title"><h2 class="section-title" id="chance-title">Chance of seeing a problem at least once</h2>` +
        `<div class="table-wrap" tabindex="0" role="region" aria-label="Chance of seeing a problem table"><table class="find-table"><thead><tr><th scope="col">Participants</th>` +
        v.table.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('') + '</tr></thead><tbody>' +
        v.table.rows.map((r) => `<tr${r.plan ? ' class="plan-row"' : ''}><td>${esc(r.label)}</td>${r.values.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('') +
        '</tbody></table></div></section>' +
        `<section class="card" style="gap:14px" aria-labelledby="find-confidence-title"><h2 class="section-title" id="find-confidence-title">Confidence report</h2>` +
        `<label class="slider-label" for="find-n"><span>Participants you can recruit: <output for="find-n" id="find-n-out">${v.slider.value}</output></span>` +
        `<input type="range" id="find-n" data-bind="find-n" min="${v.slider.min}" max="${v.slider.max}" step="1" value="${v.slider.value}"></label>` +
        `<div class="curve-box"><div style="font-size:15px;font-weight:600">See it: chance of seeing a problem as you add participants</div>${findCurveSvg(v.curve)}` +
        `<div class="small-hint" style="line-height:1.5">The vertical line follows the participants slider. Common problems are caught almost immediately; rarer ones need many more people.</div></div>` +
        `<p class="sentence">With <b>${esc(v.sentence.participants)}</b>, you have an ${esc(v.sentence.chance)} chance of seeing problems that affect <b>${esc(v.sentence.frequency)}</b>. Rarer problems may be missed.</p>` +
        `<div class="small-hint" style="line-height:1.5">Assumes every participant is equally likely to hit a given problem. Real participants vary, so treat this as an upper estimate.</div></section>` +
        `<details class="card" style="padding:20px 24px" data-open-key="find-trail"${state.ui.open['find-trail'] ? ' open' : ''}><summary style="font-size:18px;font-weight:600">How this number was reached</summary>` +
        `<ol class="trail">${v.trail.map((t) => `<li><b>${esc(t.lead)}</b> ${esc(t.text)}${t.sup ? `<sup>${t.sup}</sup>` : ''}${esc(t.after || '')}</li>`).join('')}</ol>` +
        `<div class="hint" style="padding-top:12px">Formulas and sources: <a href="${METHODS_URL}" id="find-methods">read how the tool calculates</a></div></details>`;
      aside = `<aside class="aside result" aria-labelledby="result-title"><h2 class="hint" style="margin:0;font-weight:400" id="result-title">Recruit</h2>` +
        `<div class="big-number xl">${esc(v.result.n)}</div><div class="hint" style="font-size:15px;line-height:1.5">${esc(v.result.text)}</div></aside>`;
    } else {
      results = '<section class="card"><p class="hint">Enter both percentages to see how many participants you need.</p></section>';
      aside = '<aside class="aside result" aria-labelledby="result-title"><h2 class="hint" style="margin:0;font-weight:400" id="result-title">Recruit</h2><div class="big-number xl">–</div><div class="hint">Enter both percentages.</div></aside>';
    }
    return `<div class="page"><main class="main" id="main">` +
      `<div class="intro"><h1 tabindex="-1" id="page-title">How many participants to find problems?</h1><p>Pick the rarest problem you care about catching, and how sure you want to be of seeing it.</p></div>` +
      inputs + results + `<div class="nav-row"><a class="btn" href="#/start" id="back">Back</a></div></main>${aside}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Rendering: build the whole screen, then patch the live DOM in place so
  // focus, caret position and slider drags are kept.
  // ---------------------------------------------------------------------------

  function morph(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName ||
      (from.nodeType === 1 && (from.id || '') !== (to.id || ''))) {
      from.replaceWith(to);
      return;
    }
    if (from.nodeType !== 1) {
      if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
      return;
    }
    const isDetails = from.nodeName === 'DETAILS';
    Array.from(from.attributes).forEach((a) => {
      if (!to.hasAttribute(a.name) && !(isDetails && a.name === 'open')) from.removeAttribute(a.name);
    });
    Array.from(to.attributes).forEach((a) => {
      if (isDetails && a.name === 'open') return;
      if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
    });
    if (isDetails && to.hasAttribute('open') && !from.open) from.open = true;
    const fc = Array.from(from.childNodes);
    const tc = Array.from(to.childNodes);
    tc.forEach((child, i) => {
      if (i < fc.length) morph(fc[i], child);
      else from.appendChild(child);
    });
    for (let i = tc.length; i < fc.length; i++) fc[i].remove();
    if (from.nodeName === 'INPUT') {
      if (from.type === 'checkbox') from.checked = to.hasAttribute('checked');
      else if (from !== document.activeElement && from.value !== (to.getAttribute('value') || '')) from.value = to.getAttribute('value') || '';
    } else if (from.nodeName === 'SELECT') {
      const sel = to.querySelector('option[selected]');
      if (sel && from.value !== sel.value) from.value = sel.value;
    }
  }

  function screenHtml() {
    const r = state.route;
    if (r.screen === 'start') return startScreen();
    if (r.screen === 'find') return findScreen();
    if (r.step === 1) return step1();
    if (r.step === 2) return step2();
    if (r.step === 3) return step3();
    return step4();
  }

  function titleFor() {
    const r = state.route;
    if (r.screen === 'start') return 'Study Planner';
    if (r.screen === 'find') return 'Find problems · Study Planner';
    return `Step ${r.step}: ${STEP_NAMES[r.step - 1]} · Study Planner`;
  }

  function update() {
    live = L.liveStatus(state.form);
    const activeId = document.activeElement && document.activeElement.id;
    tipSeq = 0;
    const t = document.createElement('template');
    t.innerHTML = header() + screenHtml();
    const app = document.getElementById('app');
    const next = Array.from(t.content.childNodes);
    const cur = Array.from(app.childNodes);
    next.forEach((n, i) => {
      if (i < cur.length) morph(cur[i], n);
      else app.appendChild(n);
    });
    for (let i = next.length; i < cur.length; i++) cur[i].remove();
    if (activeId && (!document.activeElement || document.activeElement === document.body)) {
      const el = document.getElementById(activeId);
      if (el) el.focus();
    }
    document.title = titleFor();
    announce();
  }

  // Polite announcement when the recommended participant count changes.
  function announce() {
    let text = null;
    if (state.route.screen === 'compare') {
      const s = L.sidebarSummary(state.form, state.route.step, live);
      if (s.recommendedN !== null) text = `Participants needed: ${s.recommendedN}`;
    } else if (state.route.screen === 'find') {
      const v = L.findView(state.find);
      if (v.ready) text = v.announce;
    }
    if (text === null || text === lastAnnounced) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      lastAnnounced = text;
      document.getElementById('announcer').textContent = text;
    }, 600);
  }

  // Focus an element by id, or the first focusable element inside it.
  function focusTarget(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const focusable = el.matches('input, select, button, a, [tabindex]')
      ? el
      : el.querySelector('input, select, button:not([aria-disabled="true"]), a');
    (focusable || el).focus();
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------

  function parseHash() {
    const h = window.location.hash || '#/start';
    const m = h.match(/^#\/compare\/([1-4])$/);
    if (m) return { screen: 'compare', step: Number(m[1]) };
    if (h === '#/find') return { screen: 'find', step: 1 };
    return { screen: 'start', step: 1 };
  }

  function onRoute() {
    let route = parseHash();
    live = L.liveStatus(state.form);
    if (route.screen === 'compare') {
      // Later steps open only once the earlier ones are complete.
      let s = route.step;
      while (s > 1 && !stepReachable(s)) s -= 1;
      if (s !== route.step) {
        window.location.replace(`#/compare/${s}`);
        return;
      }
      if (route.step === 4) state.ui.participants = null;
    }
    state.route = route;
    update();
    const h1 = document.getElementById('page-title');
    if (h1) h1.focus();
    window.scrollTo(0, 0);
  }

  function go(hash) {
    if (window.location.hash === hash) onRoute();
    else window.location.hash = hash;
  }

  // "Next" and "See the plan": move on, or show what is missing.
  function next(step) {
    state.ui.attempted[step] = true;
    if (step === 3) {
      state.ui.attempted[1] = true;
      state.ui.attempted[2] = true;
    }
    live = L.liveStatus(state.form);
    const blocking = live.issues.filter((i) => i.step <= step && i.step <= 3);
    if (blocking.length === 0 && (step < 3 || live.plan)) {
      go(`#/compare/${step + 1}`);
      return;
    }
    const first = blocking[0] || live.issues[0];
    if (first.step < state.route.step) {
      go(`#/compare/${first.step}`);
      setTimeout(() => focusIssue(first), 0);
      return;
    }
    focusIssue(first);
  }

  function focusIssue(i) {
    if (i.step === 2 && i.measureId) state.ui.openMeasure = i.measureId;
    if (i.step === 3 && i.measureId) state.ui.tab = i.measureId;
    if (i.target === ids.alpha() || i.target === ids.power()) state.ui.open.advanced = true;
    update();
    focusTarget(i.target);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  const findMeasure = (id) => state.form.measures.find((m) => m.id === id);
  const findFactor = (id) => state.form.factors.find((f) => f.id === id);

  // Keep only comparisons that still exist after the conditions change.
  function pruneComparisons() {
    const c = L.candidateComparisons(state.form);
    const keys = new Set(c.main.concat(c.cell).map((x) => x.key));
    state.form.comparisons.selected = state.form.comparisons.selected.filter((k) => keys.has(k));
  }

  const actions = {
    theme() {
      const light = currentTheme() !== 'light';
      document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
      try {
        window.localStorage.setItem(THEME_KEY, light ? 'light' : 'dark');
      } catch (err) { /* storage unavailable: the choice lasts for this visit */ }
    },
    design(el) { state.form.design = el.dataset.value; },
    'add-level'(el) {
      const f = findFactor(el.dataset.factor);
      const l = L.nextLevel(f);
      f.levels.push(l);
      pruneComparisons();
      return () => focusTarget(ids.level(l.id));
    },
    'remove-level'(el) {
      const f = findFactor(el.dataset.factor);
      const idx = f.levels.findIndex((l) => l.id === el.dataset.level);
      f.levels.splice(idx, 1);
      pruneComparisons();
      return () => focusTarget(ids.level(f.levels[Math.max(0, idx - 1)].id));
    },
    'add-factor'() {
      const f = L.newFactor();
      state.form.factors.push(f);
      state.form.comparisons = { selected: [] };
      return () => focusTarget(ids.factorName(f.id));
    },
    'remove-factor'(el) {
      state.form.factors = state.form.factors.filter((f) => f.id !== el.dataset.factor);
      state.form.comparisons = { selected: [] };
      return () => focusTarget('add-factor');
    },
    'toggle-comparison'(el) {
      const sel = state.form.comparisons.selected;
      const key = el.dataset.key;
      const i = sel.indexOf(key);
      if (i >= 0) sel.splice(i, 1);
      else sel.push(key);
    },
    next(el) { next(Number(el.dataset.step)); return 'skip'; },
    primary(el) {
      state.form.measures.forEach((m) => { m.primary = m.id === el.dataset.measure; });
    },
    type(el) {
      const m = findMeasure(el.dataset.measure);
      m.type = el.dataset.value;
      if (m.preset && m.type !== 'rating') m.preset = null;
    },
    linked(el) { findMeasure(el.dataset.measure).linked = el.dataset.value === 'yes'; },
    'edit-measure'(el) {
      state.ui.openMeasure = el.dataset.measure;
      return () => focusTarget(ids.measureName(el.dataset.measure));
    },
    'remove-measure'(el) {
      const ms = state.form.measures;
      const idx = ms.findIndex((m) => m.id === el.dataset.measure);
      const wasPrimary = ms[idx].primary;
      ms.splice(idx, 1);
      if (wasPrimary) ms[0].primary = true;
      state.ui.openMeasure = ms[Math.max(0, idx - 1)].id;
      return () => focusTarget(ids.measureName(state.ui.openMeasure));
    },
    'add-measure'() {
      const m = L.newMeasure(false);
      state.form.measures.push(m);
      state.ui.openMeasure = m.id;
      return () => focusTarget(ids.measureName(m.id));
    },
    preset(el) {
      // Fills the measure being edited; "+ Add measure" is the only way to add one.
      const m = state.form.measures.find((x) => x.id === state.ui.openMeasure) || state.form.measures[0];
      L.applyPreset(m, el.dataset.value);
      state.ui.openMeasure = m.id;
      return () => focusTarget(ids.measureName(m.id));
    },
    tab(el) {
      state.ui.tab = el.dataset.measure;
      return () => focusTarget(`tab-${el.dataset.measure}`);
    },
    'past-data'(el) {
      const inp = L.inputsFor(findMeasure(el.dataset.measure), el.dataset.key);
      inp.variability = inp.variability === 'sd' ? 'estimate' : 'sd';
      return () => focusTarget(inp.variability === 'sd' ? ids.input(el.dataset.measure, el.dataset.key, 'sd') : el.id);
    },
    'scroll-how'() {
      return () => {
        const h = document.getElementById('how-title');
        h.scrollIntoView({ block: 'start' });
        h.focus({ preventScroll: true });
      };
    },
    'new-plan'() {
      // eslint-disable-next-line no-alert
      if (!window.confirm('Start over? This clears everything you entered for this plan.')) return 'skip';
      const theme = currentTheme();
      state = freshState();
      document.documentElement.setAttribute('data-theme', theme);
      go('#/start');
      return 'skip';
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !document.getElementById('app').contains(el)) return;
    if (el.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      return;
    }
    const fn = actions[el.dataset.action];
    if (!fn) return;
    const after = fn(el);
    if (after === 'skip') return;
    update();
    if (typeof after === 'function') after();
  });

  // Text inputs, selects, checkboxes and sliders bound to state.
  const binders = {
    level(el) { findFactor(el.dataset.factor).levels.find((l) => l.id === el.dataset.level).name = el.value; },
    'factor-name'(el) { findFactor(el.dataset.factor).name = el.value; },
    'measure-name'(el) { findMeasure(el.dataset.measure).name = el.value; },
    'measure-unit'(el) { findMeasure(el.dataset.measure).unit = el.value; },
    'scale-min'(el) { findMeasure(el.dataset.measure).scaleMin = el.value; },
    'scale-max'(el) { findMeasure(el.dataset.measure).scaleMax = el.value; },
    input(el) { L.inputsFor(findMeasure(el.dataset.measure), el.dataset.key)[el.dataset.field] = el.value; },
    alpha(el) { state.form.alpha = el.value; },
    power(el) { state.form.power = el.value; },
    'find-p'(el) { state.find.p = el.value; state.find.participants = null; },
    'find-P'(el) { state.find.P = el.value; state.find.participants = null; },
    'plan-n'(el) { state.ui.participants = Number(el.value); },
    'find-n'(el) { state.find.participants = Number(el.value); },
  };

  let frame = null;
  function onBound(e) {
    const el = e.target;
    const fn = el.dataset && binders[el.dataset.bind];
    if (!fn) return;
    fn(el);
    if (el.type === 'range') {
      // Slider: redraw at most once per frame. The timer covers pages whose
      // animation frames are paused (e.g. a background tab).
      if (frame) return;
      const draw = () => {
        if (!frame) return;
        frame = null;
        update();
      };
      frame = true;
      window.requestAnimationFrame(draw);
      setTimeout(draw, 50);
      return;
    }
    update();
  }
  document.addEventListener('input', onBound);
  document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' || e.target.nodeName === 'SELECT') onBound(e);
  });

  // Details open state is the user's: remember it across redraws.
  document.addEventListener('toggle', (e) => {
    const key = e.target.dataset && e.target.dataset.openKey;
    if (key) state.ui.open[key] = e.target.open;
  }, true);

  // Alpha tooltips: Escape hides an open tooltip until focus or the pointer
  // moves away (WCAG 1.4.13, content on hover or focus).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.tip:hover, .tip:focus').forEach((t) => t.classList.add('tip-dismissed'));
  });
  const undismiss = (e) => {
    const t = e.target.closest && e.target.closest('.tip');
    if (t) t.classList.remove('tip-dismissed');
  };
  document.addEventListener('focusout', undismiss);
  document.addEventListener('mouseout', undismiss);

  // Tabs: arrow keys, Home and End (ARIA tabs pattern).
  document.addEventListener('keydown', (e) => {
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab) return;
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const i = tabs.indexOf(tab);
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j === null) return;
    e.preventDefault();
    state.ui.tab = tabs[j].dataset.measure;
    update();
    focusTarget(`tab-${state.ui.tab}`);
  });

  window.addEventListener('hashchange', onRoute);
  onRoute();
})();
