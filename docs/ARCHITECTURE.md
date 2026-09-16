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
   │                + one delegated 'input' listener for note fields
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
| 2 | `src/js/ui.js` | `UI` | DOM helpers, toast, modal (open/update/close), confirm/choice dialogs, `modalShell`, custom cursor | `q, qa, el, toast, openModal, updateModal, closeModal, confirmDialog, choiceDialog, initCursor` |
| 3 | `src/js/store.js` | `Store` | the whole data layer | `load, save, activeHabits, addHabit, updateHabit, deleteHabit, toggle, setCount, inc, dec, countFor, isDone, getNote, setNote, timesFor, timesOn, dailySummary, countsByDay, habitCountsByDay, streakFor, weekProgress, statsOverview, habitTrend, healthScore, weekdayRates, overallTrend, insights, hourHistogram, timeOfDay, habitPeakPeriod, exportJSON, importJSON, replaceWith, mergeWith, loadSample` |
| 4 | `src/js/prefs.js` | `Prefs` | UI-only customisation: colour/font token overrides + per-section visibility | `load, apply, get, tokenValue, COLORS, FONTS, FONT_OPTIONS, setColor, clearColors, hasCustomColors, setFont, clearFonts, hasCustomFonts, isHidden, setHidden, clearHidden, resetAll` |
| 5 | `src/js/render.js` | `Render` | pure view builders | `renderToday(showWelcome), renderCalendar, renderStats, renderHabits, renderSettings, dayModalHtml, habitEditorHtml, THEMES, SECTIONS` (internal: `sparkline, scoreRing, healthCard, weekdayBars, timeOfDayCard, stepper, heatmapGrid, heatmapCard, habitHeatmapCard, welcomeCard, themePickerHtml`) |
| 6 | `src/js/app.js` | `App` | controller + boot | `init, switchTab, openEditor, saveEditor, openDay, importFlow, showWelcome, dismissWelcome, setTheme, bindEvents` |

`build.js` `JS_ORDER` must stay in sync with the list above.

## Key flows

### Check-in (Today)
`[data-action="toggle"]` → `Store.toggle(id, Utils.todayKey())` →
`App.renderCurrent()` → `Render.renderToday()` re-renders the whole view
(simple and fast enough; no vdom).

### Multi-check-in steppers
`[data-action="inc"|"dec"]` carry `data-id` + `data-date` → `Store.inc|dec` →
refresh the open day modal (`App.refreshDayModal`) or `App.renderCurrent()`;
`Render.stepper` is shared by Today rows and day-modal rows. The check button
stays done/undo-all (DECISIONS §13).

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

### Onboarding
`App.showWelcome()` (not dismissed + ≥ 1 active habit) →
`Render.renderToday(true)` renders a dismissible welcome card;
`[data-action="dismiss-welcome"]` → `App.dismissWelcome()` sets
`localStorage['ahabit.welcome.v1']` (UI-only state, never exported —
DECISIONS §14).

## Data & performance notes

- Completions map: `habitId → { "YYYY-MM-DD": count }`. Lookup is O(1);
  monthly/daily aggregations iterate only in-range keys
  (`dailySummary` uses a `YYYY-MM-` prefix scan of each habit's map).
- Notes map mirrors completion keys: `notes[habitId][dateKey] = text` (≤ 240
  chars). Notes are fully independent of counts — toggling/clearing check-ins
  never touches them, and streaks/analytics ignore them (DECISIONS §12).
- Times map also mirrors the keys: `times[habitId][dateKey] = [epochMs…]`,
  recorded on **live** check-ins only (backfills get none), pruned to never
  exceed the count, and cleared with the day (DECISIONS §17). Reads go through
  `timesFor`/`timesOn`; time-of-day analytics (`hourHistogram`, `timeOfDay`,
  `habitPeakPeriod`) only ever look here.
- Counts > 1 are user-reachable via the steppers (`inc`/`dec`) since v0.4;
  mark-done logic everywhere tests `count ≥ 1` (truthiness), so multi counts
  don't change streaks/analytics (DECISIONS §13).
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
- `UI.openModal` adds a one-shot `modal-enter` class for the entrance CSS
  animation; `UI.updateModal` does **not**, so editor-picker refreshes don't
  re-trigger animation.
- The only inline `onclick` handlers are on static dialog buttons created via
  `UI.el` (`onclick: UI.closeModal`, etc.). Everything dynamic uses `data-action`.

## Theming

- Themes are named token sets applied via `data-theme="<id>"` on `<html>`.
  Registry: `Render.THEMES` (`{id, name, emoji, scheme, color, colors}`) — the
  single source of truth for the picker; the CSS sets live in `src/styles.css`.
- Base `:root` = `zen`; each theme overrides only what differs. Shared
  **structural tokens** (`--radius`, `--border-w`, `--check-w`, `--pill`,
  `--shadow*`, `--glow*`, `--on-accent`, `--font`, `--font-display`,
  `--display-tracking`, `--display-transform`) let a theme change shape and
  type, not just colors. `[data-theme^="brutalist"]` holds the few non-token
  overrides (uppercase UI chrome, hard component corners).
- Flow: `App.initTheme()` → `App.resolveTheme(saved)` (migrates old
  `light`/`dark`) → `setTheme()` writes `data-theme`, persists `ahabit.theme`,
  updates the `#theme-color` meta and re-renders the picker popover.
  Selection arrives via `[data-action="set-theme"]` in the delegated click
  handler. No external fonts (DECISIONS §7).
- Heatmap cells use `.h0..h4` levels. The all-habits map drives them from
  `var(--heat-*)` per theme; per-habit maps (`.hheat-card`) override h1–h4 with a
  flat ramp of the habit's own `--c` via `color-mix` (DECISIONS §19).
- Habit color chip: `style="--c:#hex"` + `color-mix(in srgb, var(--c) 14%, …)`.
  (`--c`, `--d`, `--i`, `--ring`, `--p` are set inline by templates — not
  global theme tokens.)
- `body.modal-open` locks scroll while a modal is open.
- **Custom cursor**: the pointer image is `--cursor` (inline SVG data URI,
  `auto` fallback) and is applied to every interactive element from a block
  **last** in `styles.css` so it beats component `cursor: pointer`; text fields
  keep `cursor: text`. `UI.initCursor()` adds an additive themed halo
  (`--accent`) gated on fine pointer + no reduced-motion. Never hides the
  native cursor (DECISIONS §18, §20).
- **Readability floor**: every theme's `--text` / `--text-2` / `--text-3` must be
  ≥ 4.5:1 against its `--card` (DECISIONS §20).

## Customization (`Prefs` + Settings view)

- `Prefs` is a UI-only state module (`localStorage['ahabit.prefs.v1']`): colour
  overrides, font choices, and hidden sections. It never touches the DB.
- Colour overrides are written as **inline CSS custom properties on `<html>`**
  (`Prefs.apply()`), so they layer over the active theme; `--grad` /
  `--grad-soft` / `--on-accent` are derived from the accents.
- Fonts are system stacks only (`Prefs.FONTS`). Choosing a theme preset clears
  colour/font overrides (`App.setTheme` when persisting).
- `Render.SECTIONS` is the registry of hideable sections; each render function
  guards with `Prefs.isHidden(id)`. The Settings view is `#view-settings`
  (opened from the ⋯ menu, route `App.tab === 'settings'`), driven by delegated
  `set-color`, `set-font`, `toggle-section` events and reset actions.
- New themes still must meet the §20 contrast floor; user overrides may
  deliberately exceed/ignore it.

## Build (`build.js`)

Three modes, all zero-dependency:

- `node build.js dev [dir]` — static server (defaults to `src/`; pass `dist/pwa`
  to preview the PWA output). MIME map incl. `.webmanifest`; path-traversal
  guard is rooted to the served dir. Port via `PORT=9000`.
- `node build.js build` — inlines `styles.css` + `js/*.js` into
  `dist/index.html` and strips the `<!--PWA-->` marker. This is the portable
  single-file artifact (DECISIONS §1) and has **no external refs**.
- `node build.js pwa` — same inlined HTML with the `<!--PWA-->` marker replaced
  by the manifest/meta/registration snippet (`scripts/pwa.js`), then writes
  `dist/pwa/`: `index.html`, `manifest.webmanifest`, `sw.js` (cache name = short
  hash of the HTML), and PNG icons (`scripts/icons.js`). See DECISIONS §15.

- The HTML comment markers `<!--STYLES-->` / `<!--SCRIPTS-->` anchor the
  inlining; `<!--PWA-->` anchors the PWA head injection.
- Output must stay **dependency-free and offline-capable** (no external fonts,
  CDNs, or fetch calls). Icons are encoded with Node's built-in `zlib` — no
  image libraries.

### PWA assets (`scripts/pwa.js`, `scripts/icons.js`)

- `pwa.manifest()` — install metadata + 192/512/maskable icons.
- `pwa.serviceWorker(version)` — app-shell precache; network-first navigations
  with offline fallback; cache-first assets; content-hashed cache name.
- `icons.buildPng(size, {maskable})` — pure PNG encoder (CRC32 + zlib) that
  rasterizes the gradient+check brand mark; `writeIconFiles(dir)` writes the set.
  Both are unit-tested in `scripts/smoke.js`.

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
- Time-of-day analytics is now live: `times` records live check-ins, and
  `hourHistogram`/`timeOfDay`/`habitPeakPeriod` back the Stats card (DECISIONS
  §17). Backfilled days intentionally carry no timestamp.