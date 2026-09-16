# Architecture — AHA(bit) tracker

## Big picture

A no-framework single-page app. Source is kept as separate files for
readability; `build.js` concatenates them into **one self-contained
`dist/index.html`** (CSS inlined in `<style>`, JS inlined in one `<script>`).

```
User clicks / types
   │
   ▼
App.bindEvents()  ──  one delegated 'click' listener routes by data-action
   │                + tab/theme/menu/file/Escape listeners born in bindEvents
   ▼
Store.* mutation  (e.g. Store.toggle(id, key))  → save() → localStorage
   │
   ▼
Render.*          (pure: state → HTML)  → innerHTML of the active #view-…
```

## Modules (load order = dependency order)

| # | File | Global | Responsibility | Key exports |
| --- | --- | --- | --- | --- |
| 1 | `src/js/utils.js` | `Utils` | dates (`keyOf/parseKey/addDays`), `YYYY-MM-DD` key convention, Monday-start week, month matrix, `uid`, `esc` | `todayKey, monthMatrix, weekEnding, fmtDayTitle, esc` |
| 2 | `src/js/ui.js` | `UI` | DOM helpers, toast, modal (open/update/close), confirm/choice dialogs, `modalShell` | `q, qa, el, toast, openModal, updateModal, closeModal, confirmDialog, choiceDialog` |
| 3 | `src/js/store.js` | `Store` | the whole data layer | `load, save, activeHabits, addHabit, updateHabit, deleteHabit, toggle, setCount, isDone, dailySummary, countsByDay, streakFor, weekProgress, statsOverview, habitTrend, healthScore, weekdayRates, overallTrend, insights, exportJSON, importJSON, replaceWith, mergeWith, loadSample` |
| 4 | `src/js/render.js` | `Render` | pure view builders | `renderToday, renderCalendar, renderStats, renderHabits, dayModalHtml, habitEditorHtml` |
| 5 | `src/js/app.js` | `App` | controller + boot | `init, switchTab, openEditor, saveEditor, openDay, importFlow, bindEvents` |

`build.js` `JS_ORDER` must stay in sync with the list above.

## Key flows

### Check-in (Today)
`[data-action="toggle"]` → `Store.toggle(id, Utils.todayKey())` →
`App.renderCurrent()` → `Render.renderToday()` re-renders the whole view
(simple and fast enough; no vdom).

### Backfill (Calendar → day modal)
`[data-action="open-day"]` carries `data-date` → `App.openDay(dateKey)` →
`UI.openModal(Render.dayModalHtml(dateKey))`. Toggles inside the modal use
`[data-action="toggle-day"]` with both `data-id` and `data-date`, then
`App.refreshDayModal(date)` re-renders just the modal body, plus
`Render.renderCalendar()` behind it.

### Habit editor
`App.openEditor(id?)` keeps `App.editorDraft` (the working copy). Picker clicks
(`pick-emoji`, `pick-color`, `pick-target`, `pick-day`) mutate the draft and
call `App.refreshEditor()` → `UI.updateModal(Render.habitEditorHtml(draft))`.
`save-habit` reads `#h-name` / `#h-arch` from the DOM, calls
`Store.addHabit|updateHabit`, closes, re-renders.

### Import
Menu → `#import-file` input → `FileReader` → `App.importFlow(text)` →
`Store.importJSON(text)` (parse + sanitize) → `UI.choiceDialog` (Replace /
Merge / Cancel) → `Store.replaceWith|mergeWith` → re-render + toast.

## Data & performance notes

- Completions map: `habitId → { "YYYY-MM-DD": count }`. Lookup is O(1);
  monthly/daily aggregations iterate only in-range keys
  (`dailySummary` uses a `YYYY-MM-` prefix scan of each habit's map).
- Streaks/heatmap are computed on the fly (fast enough up to years of data).
- `countsByDay(startKey, endKey)` string-compares keys — safe because
  `YYYY-MM-DD` sorts lexicographically.
- localStorage holds the whole DB as one JSON string; export/import is just a
  serialization of that document.

## Rendering conventions

- `Render.*` builds HTML with template literals → `innerHTML`; user content
  must pass through `Utils.esc`.
- Modal bodies are built with `UI.el(...)` nodes (not strings) so the modal
  shell (`UI.modalShell`) can own close-button/overlay behavior.
- The only inline `onclick` handlers are on static dialog buttons created via
  `UI.el` (`onclick: UI.closeModal`, etc.). Everything dynamic uses `data-action`.

## Styling

- `src/styles.css`: CSS variables per theme; `[data-theme="dark"]` overrides.
- Heatmap cells use `.h0..h4` levels driven by `var(--heat-*)` per theme.
- Habit color chip: `style="--c:#hex"` + `color-mix(in srgb, var(--c) 14%, …)`.
- `body.modal-open` locks scroll while a modal is open.

## Build (`build.js`)

- `node build.js dev` — static server for `src/` (MIME map, path-traversal
  guard). Port via `PORT=9000`.
- `node build.js build` — reads `src/index.html`, replaces the dev `<link
  href="styles.css">` + `<script src="js/*.js">` block with one inlined
  `<style>`/`<script>`, writes `dist/index.html`.
- The HTML comment markers `<!--STYLES-->` / `<!--SCRIPTS-->` anchor the swaps.
- Output must stay **dependency-free and offline-capable** (no external fonts,
  CDNs, or fetch calls).

## Testing (`npm test` → `scripts/smoke.js`)

- Plain Node (no browser): stubs `localStorage`, `document`,
  `requestAnimationFrame`, `URL`, etc., then evaluates the 5 source files in
  order (namespace `const`s rewritten to `globalThis` so they're visible to the
  test scope).
- Covers: CRUD, toggles, streaks, week progress, aggregations, import
  sanitization, merge vs replace, sample data, and that every view + modal
  renders without throwing, plus tab switching.
- Not covered (yet): end-to-end click simulation, calendar month boundaries,
  real-browser visual checks. A headless browser test would be a good TBD.

## Extension points / analytics notes

- Analytics helpers live in `Store` (pure data math, fully unit-tested):
  `habitTrend(id)` → 30-day point series of trailing-7-day rates + direction;
  `healthScore(id)` → explainable 0–100 composite (DECISIONS §10);
  `weekdayRates(12)` → per-weekday slots; `overallTrend(30)`; `insights()`.
- All rates respect a habit's **allowed weekdays** and its **tracking start**
  (earlier of creation date and earliest completion — so backfills/sample data
  don't zero out young habits).
- Charts are inline SVG (`Render.sparkline`/`scoreRing`/`weekdayBars`) — no
  dependencies, per DECISIONS §7.
- Count-per-day schema — ready for multi-check-in UI.
- Time-of-day analytics remains blocked on a timestamp schema decision —
  deliberately deferred (DECISIONS §9).