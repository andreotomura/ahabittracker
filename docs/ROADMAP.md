# Roadmap — AHA(bit) tracker

> Status legend: ✅ done · 🚧 in progress · ⏳ planned · 💡 idea
> Update this file after every session that ships, starts, or reprioritizes.

## Vision

A habit tracker that feels like a joy to open: one tap to record, a beautiful
calendar to see the momentum, and later — smart analytics that turn daily
inputs into insight. Local-first, private, portable as a single file, with the
database fully owned by the user as JSON.

## Status

| Feature | Status | Notes |
| --- | --- | --- |
| Single-file build (zero deps) | ✅ | `build.js`, dist ~119 KB |
| Today view: check-ins, progress, streaks, weekly goals | ✅ | Graceful streak (DECISIONS §5) |
| Calendar view + day backfill modal | ✅ | Monday-start, color dots, +N overflow |
| Habit management (emoji, color, weekly goal, allowed days, archive) | ✅ | |
| Stats: totals, best streak, 7-day rate, heatmap | ✅ | Foundation for analytics |
| JSON export/import (replace/merge) | ✅ | Round-trips cleanly (incl. notes + times) |
| Sample data for first-run exploration | ✅ | |
| Smoke tests (data layer + render + PWA assets) | ✅ | `npm test` |
| Session docs workflow | ✅ | `docs/`, handoff ritual |
| **Analytics & graphs (v0.2)** | ✅ | Trends, health scores, weekday rhythm, insights, SVG charts (DECISIONS §9–§11) |
| **Per-check-in notes (v0.3)** | ✅ | Additive `notes` map — inline on Today + day modal (DECISIONS §12) |
| **Multiple check-ins/day UI (v0.4)** | ✅ | Count steppers on Today + day modal; check = undo-all (DECISIONS §13) |
| **Polish: modals, empty states, onboarding (v0.5)** | ✅ | Welcome card, modal enter motion, empty-state consolidation (DECISIONS §14) |
| **PWA packaging (v0.6)** | ✅ | Additive `build:pwa` target: manifest, offline SW, generated icons (DECISIONS §15) |
| **Theming: 5 selectable themes (v0.7)** | ✅ | Zen · Midnight · Paper · Brutalist · Brutalist Dark; picker in topbar (DECISIONS §16) |
| **Time-of-day analytics (v0.8)** | ✅ | Live timestamps + hourly histogram & period peaks (DECISIONS §17) |
| **Custom cursor (v0.9)** | ✅ | CSS base + additive themed halo; a11y-gated (DECISIONS §18) |
| **Per-habit heatmaps (v0.10)** | ✅ | GitHub-style map per habit, flat habit-colour ramp (DECISIONS §19) |
| Readability + cursor consistency (v0.10.1) | ✅ | Text tokens ≥ 4.5:1; themed dot on every element (DECISIONS §20) |
| **Customization tool (v0.11)** | ✅ | Settings view: colour/font overrides (15 font stacks) + per-tab section visibility (DECISIONS §21) |
| **Habit folders (v0.12)** | ✅ | Flat single-membership groups on Today + Habits; collapse/expand, per-folder progress, sort modes (manual/name/streak/health/newest) (DECISIONS §22) |
| **Theme studio + element toggles (v0.13)** | ✅ | 11 presets, saved custom themes, shape controls, accent-derived heatmap, element-level show/hide + Minimal/Balanced/Everything; Customize is a tab (DECISIONS §23) |
| **Bundled embedded fonts** | ✅ | 13 OFL/Apache Latin WOFF2 inlined at build; picker stacks lead with embedded families, no preinstall (DECISIONS §24) |
| In-app reminders (Notification API) | 💡 | While the tab is open |
| Headless-browser e2e tests | 💡 | Would need a dev-only dep (Playwright/Puppeteer) — ask first |

## Shipped milestone: Analytics & graphs (v0.2)

Goal was to turn raw check-ins into *insight* — done without adding a single
dependency, still one self-contained HTML file.

### Shipped

1. **Per-habit trend lines** — trailing 7-day completion rate sampled daily over
   30 days (inline SVG sparkline), direction arrow (improving / slipping /
   flat), 7/30-day rate.
2. **Habit health score (0–100)** — explainable composite, formula in
   `docs/DECISIONS.md` §10; conic-gradient rings per habit + average health
   stat card.
3. **Weekday rhythm & consistency** — per-weekday completion bars over the last
   12 weeks, strongest/toughest day sentence.
4. **Insights** — most consistent habit, longest current quiet stretch, best/
   worst weekday.
5. **Momentum chart** — overall trailing-7-day rate over 30 days with a
   trending up/down/steady verdict.
6. **Better visuals** — all charts are inline SVG / CSS (no dependencies).

### Deferred (logged, not forgotten)

- **Time-of-day insights** — needs a timestamp schema decision; explicitly
  deferred in `docs/DECISIONS.md` §9.

### Suggested order — completed

1. Re-read `docs/CONTEXT.md` + newest session file. ✅
2. Decide the timestamp question (DECISIONS entry). ✅ → §9
3. Add the data-support functions to `Store` + extend `scripts/smoke.js`. ✅
4. Build SVG sparklines/trend UI in the Stats tab; keep `Render` pure. ✅
5. Update docs. ✅ (this file + DECISIONS/ARCHITECTURE/CONTEXT)

## Shipped milestone: Per-check-in notes (v0.3)

1. **Schema** — top-level `notes: { habitId: { 'YYYY-MM-DD': text } }`,
   additive per DECISIONS §12; old backups import fine.
2. **Store API** — `getNote` / `setNote` (trim, 240-char cap), notes cleaned up
   on habit delete, sanitized on import, merge = gap-fill only.
3. **UI** — inline note field on Today rows (revealed when done or has a note)
   and in the day modal for every habit; live-saved via one delegated `input`
   listener (`data-action="note"`).
4. **Sample data** — a few notes so the feature is discoverable.
5. **Tests** — trim/cap/clear, import sanitization, merge/replace round-trips,
   rendered Today rows include note inputs.

## Shipped milestone: Multiple check-ins/day UI (v0.4)

1. **Store** — `countFor` / `inc` / `dec`; the check button keeps its
   done/undo-all semantics (at N ≥ 2: "Undo all (×N)"), and the stepper
   manages counts within [1, ∞) — `−` is disabled at 1.
2. **UI** — `− ×N ＋` steppers on Today rows and in the day modal whenever a
   habit is done.
3. **Sample data** — "Drink water" today = 3 check-ins so the feature is
   discoverable.
4. **Version** — bumped to 0.4.0 (About dialog + `package.json`).
5. **Totals** — "Total check-ins" now genuinely reflects multi counts.
6. **Tests** — inc/dec edge cases, count-as-done, toggle full-undo, steppers
   present in rendered Today HTML.

## Shipped milestone: Polish pass (v0.5)

1. **Onboarding** — dismissible welcome card on Today (check-in / notes / Stats
   tips), persisted as UI-only state outside the DB (DECISIONS §14); appears
   once there's at least one habit.
2. **Empty states** — Stats with no active habits collapses to a single
   friendly state (history heatmap still shows if there is archived data); the
   day modal gets a proper empty state with an "Add habit" CTA; the calendar
   explains an empty month.
3. **Modal motion** — one-shot enter animation on modal bodies, applied only
   on `openModal` (never on picker refreshes, which would flicker).
4. **Micro-polish** — hover lift on stat/health cards, staggered health-card
   entrance (via `--i`), welcome-card responsiveness.
5. **Version** — bumped to 0.5.0.

## Shipped milestone: PWA packaging (v0.6)

1. **Additive build target** — `npm run build:pwa` → `dist/pwa/` with the
   inlined `index.html` + `manifest.webmanifest` + `sw.js` + 3 PNG icons. The
   plain `npm run build` is unchanged (single file, no PWA hooks) — DECISIONS §15.
2. **Offline service worker** — app-shell precache, network-first navigations
   with offline fallback, cache-first assets; cache name is content-hashed so
   updates propagate automatically.
3. **Icons** — generated at build time by a zero-dep PNG encoder
   (`scripts/icons.js`, zlib + CRC32): gradient rounded square + white check,
   plus a full-bleed maskable 512.
4. **Dev loop** — `npm run preview:pwa` builds and serves `dist/pwa/`;
   `node build.js dev <dir>` now accepts a directory.
5. **Tests** — PNG signature/IHDR, manifest install fields, SW handlers, PWA
   head snippet.
6. **Version** — bumped to 0.6.0.

## Shipped milestone: Theming system (v0.7)

1. **Named themes** — `zen` (default light), `midnight` (dark), `paper` (warm
   light), `brutalist`, and **`brutalist-dark`**, applied via `data-theme` and
   defined as token sets in `src/styles.css`.
2. **Theme picker** — a palette button in the topbar opens a popover listing
   every theme with color swatches; the choice persists (`ahabit.theme`). Old
   `light`/`dark` values migrate automatically (DECISIONS §16).
3. **Structural tokens** — radius, border width, pill radius, shadows/glows,
   display font, uppercase/tracking and on-accent ink are all themeable, so
   brutalist is genuinely different (square, 3px borders, hard offset shadows,
   mono uppercase) rather than a recolor.
4. **`<meta name="theme-color">`** follows the active theme.
5. **Tests** — registry completeness, picker markup, theme resolution /
   migration, apply + persist.
6. **Version** — bumped to 0.7.0.

## Shipped milestone: Time-of-day analytics (v0.8)

1. **Timestamps** — additive `times` map records **live** check-ins only; it
   never invents times for backfilled days (DECISIONS §17).
2. **Analytics** — `Store.timeOfDay()` (24-hour histogram + period peaks) and
   `Store.habitPeakPeriod()`.
3. **UI** — a “Time of day” card in Stats (24-bar histogram + “most in the
   evenings · busiest around 9pm”) and a ⏰ peak tag on each habit’s health card.
4. **Sample data** now carries plausible timestamps so the insight is visible on
   first run.
5. **Tests** — timestamp record/prune/clear, no-time-on-backfill, import
   sanitisation, merge, histogram/period maths, and the Stats card rendering.
6. **Version** — bumped to 0.8.0.

## Shipped milestone: Custom cursor (v0.9)

1. **Base cursor (CSS)** — a neutral custom pointer (white disc + dark ring,
   centred hotspot) on `body` under `@media (pointer: fine)`, with an `auto`
   fallback; text fields keep `cursor: text`. Inline SVG data URI (single-file
   safe, no external asset).
2. **Halo (JS flair)** — `UI.initCursor()` adds a themed, lagging accent that
   grows over interactive elements and contracts on press. `pointer-events:
   none`, above modals/toasts, and only on a fine pointer without
   `prefers-reduced-motion`.
3. **Never destructive** — the native cursor is never hidden, so touch,
   keyboard, reduced-motion and Safari users all degrade gracefully
   (DECISIONS §18).
4. **Tests** — halo added on a fine pointer, skipped otherwise.
5. **Version** — bumped to 0.9.0.

## Shipped milestone: Per-habit heatmaps (v0.10)

1. **Shared grid** — the global 53-week heatmap was refactored into
   `Render.heatmapGrid(habitId)`; the all-habits map keeps the shared ramp.
2. **Per-habit maps** — one contribution graph per active habit in a new “Habit
   history” section, coloured with that habit's own colour as a flat tint ramp
   (no shared gradient), level = `min(4, count)` (DECISIONS §19).
3. **Data** — `Store.habitCountsByDay(id, start, end)` for raw per-habit counts.
4. **Tests** — per-habit counts and the rendered Habit-history cards.
5. **Version** — bumped to 0.10.0.

## Shipped milestone: Customization tool (v0.11)

1. **Settings view** — opened from the ⋯ menu (`#view-settings`), with live
   preview (no modal).
2. **Colors** — 18 token pickers (surfaces, text, accents, lines, feedback,
   heatmap); `--grad` / `--grad-soft` / `--on-accent` are derived from the
   accents.
3. **Fonts** — body + display pickers, system stacks only.
4. **Layout** — per-tab show/hide for 13 sections via a `Render.SECTIONS`
   registry.
5. **State** — `Prefs` (UI-only, `ahabit.prefs.v1`); choosing a theme preset
   resets colour/font overrides; reset buttons for colors/fonts/layout/all.
6. **Tests** — prefs round-trip, validation, section gating, settings render.
7. **Version** — bumped to 0.11.0.

## Shipped milestone: Habit folders (v0.12)

1. **Schema** — additive `folders: [{id, name, emoji, sort}]` + `folderId` on
   each habit (`null` = ungrouped); one level, one folder per habit (DECISIONS §22).
2. **Store** — `folders/addFolder/updateFolder/deleteFolder/moveFolder` and
   `moveHabit`; delete-folder ungroups (never deletes), unknown `folderId`
   rejected, import/merge sanitise + union folders.
3. **Today** — collapsible folder sections with `done/total` + mini progress
   bar, ungrouped last, plus a sort bar (sort mode + “Done last”); flat list
   preserved when no folders exist.
4. **Habits** — folder management block (new/rename/re-icon/delete/reorder) and
   habits grouped under folder sub-headers with ↑/↓ manual reorder.
5. **Editor** — a “Folder” select in the habit editor; emoji + name folder modal.
6. **Prefs** — collapse state, sort mode and done-last live in `ahabit.prefs.v1`
   (UI-only, never exported).
7. **Tests** — folder CRUD/ordering/ungroup, prefs round-trip, import/merge
   sanitisation, and folder-aware Today/Habits rendering.
8. **Version** — bumped to 0.12.0.

## Shipped milestone: Theme studio + element toggles (v0.13)

1. **Six new presets** — Graphite, Frost, Gruvbox, Matcha, Synthwave, Mono
   (11 total); all new text tokens pass the ≥4.5:1 floor (DECISIONS §23).
2. **Custom theme gallery** — live previews for every preset; save the current
   look as a named theme (`ct_*`), rename, delete; UI-only snapshots.
3. **Shape controls** — corner radius, border width, shadow style, written as
   inline CSS vars; accent changes auto-derive gradient + heatmap ramp.
4. **Element-level show/hide** — ~28 toggles across Today/Calendar/Stats/
   Habits/Global, with **Minimal / Balanced / Everything** presets; static
   chrome toggled via body classes.
5. **Customize tab** — first-class nav tab next to Habits (⋯ menu jumps there).
6. **Tests** — preset presence + CSS token sets, gallery/picker with custom
   themes, structure vars, snapshot round-trip, element hiding, presets, chrome.
7. **Version** — bumped to 0.13.0.

## Shipped milestone: Bundled embedded fonts

1. **Fonts** — 13 open-source families (Inter, Nunito, Poppins, Source Sans 3,
   Roboto Condensed, Source Serif 4, Literata, EB Garamond, Roboto Slab,
   JetBrains Mono, Courier Prime, Archivo Black, Comic Neue) as Latin WOFF2 in
   `src/fonts/`; licences in `src/fonts/LICENSES.md` (DECISIONS §24).
2. **Build** — `build.js` rewrites `url(fonts/*.woff2)` to base64 `data:` URIs, so
   the single file and PWA stay offline/self-contained (no CDN, no preinstall).
3. **Picker** — every stack leads with the embedded family, then OS faces, then a
   generic tail; theme `--font` defaults switched to embedded families.
4. **Tests** — `@font-face` coverage, WOFF2 signatures, licence file, and
   embedded-first stacks.
5. **Note** — single-file size grows to ~809 KB (≈623 KB fonts).

## Open questions

- ~~Should analytics cover archived habits?~~ **Decided** (DECISIONS §11):
  dashboards = active only; historical aggregates include archived.
- ~~One global "AHA score" on Today, or per-habit only?~~ **Decided**: per-habit
  health scores + simple average on Stats; no score on Today.
- ~~**Export format**: keep `{version:1}` + additive schema vs bump?~~ **Decided
  in practice**: notes (v0.3) and times (v0.8) both landed additively with no
  version bump — keep additive.

## Backlog / ideas

- 💡 **Folder filtering** (folder chips, search, hide-done) — deliberately
  deferred in v0.12; not needed at ≤10 habits (DECISIONS §22).
- 💡 **Theme JSON export/import** — custom themes are currently local-only
  (DECISIONS §23).
- *(Nothing else queued — see “Next up” in `docs/CONTEXT.md` and the status
  table for what's planned.)*

## Non-goals (for now)

- Cloud sync / accounts / backend (explicitly out — see DECISIONS §3).
- Multi-user features, social, streaks fights (out of spirit).
- Native apps (CSS is already mobile-responsive; PWA is the optional path).