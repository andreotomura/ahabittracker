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
| Single-file build (zero deps) | ✅ | `build.js`, dist ~68 KB |
| Today view: check-ins, progress, streaks, weekly goals | ✅ | Graceful streak (DECISIONS §5) |
| Calendar view + day backfill modal | ✅ | Monday-start, color dots, +N overflow |
| Habit management (emoji, color, weekly goal, allowed days, archive) | ✅ | |
| Stats: totals, best streak, 7-day rate, heatmap | ✅ | Foundation for analytics |
| Light/dark theme | ✅ | Follows system, toggleable |
| JSON export/import (replace/merge) | ✅ | Round-trips cleanly |
| Sample data for first-run exploration | ✅ | |
| Smoke tests (data layer + render) | ✅ | `npm test` |
| **Analytics & graphs (v0.2)** | ✅ | Trends, health scores, weekday rhythm, insights, SVG charts (DECISIONS §9–§11) |
| **Per-check-in notes (v0.3)** | ✅ | Additive `notes` map — inline on Today + day modal (DECISIONS §12) |
| **Multiple check-ins/day UI (v0.4)** | ✅ | Count steppers on Today + day modal; check = undo-all (DECISIONS §13) |
| **Polish: modals, empty states, onboarding (v0.5)** | ✅ | Welcome card, modal enter motion, empty-state consolidation (DECISIONS §14) |
| **PWA packaging (v0.6)** | ✅ | Additive `build:pwa` target: manifest, offline SW, generated icons (DECISIONS §15) |
| **Theming system: multiple themes (incl. new-brutalist) (v0.7)** | ✅ | Zen · Midnight · Paper · Brutalist · Brutalist Dark; picker in topbar (DECISIONS §16) |
| Session docs workflow | ✅ | `docs/`, handoff ritual |
| **Time-of-day analytics (v0.8)** | ✅ | Live timestamps + hourly histogram & period peaks (DECISIONS §17) |
| Per-habit heatmaps (contribution graph per habit) | 💡 | Backlog request — habit-colour (non-gradient) ramp (see Backlog) |
| PWA packaging for hosted deployments | 💡 | SW can't run on `file://`; needs hosting story |
| In-app reminders (Notification API) | 💡 | While tab is open |
| Headless-browser e2e tests | 💡 | Playwright etc. would be a dev-only dep |

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

## Open questions

- ~~Should analytics cover archived habits?~~ **Decided** (DECISIONS §11):
  dashboards = active only; historical aggregates include archived.
- ~~One global "AHA score" on Today, or per-habit only?~~ **Decided**: per-habit
  health scores + simple average on Stats; no score on Today.
- ~~**Export format**: keep `{version:1}` + additive schema vs bump?~~ **Decided
  in practice**: notes (v0.3) and times (v0.8) both landed additively with no
  version bump — keep additive.

## Backlog / ideas

- **Per-habit GitHub-style heatmaps** (requested): a contribution graph per habit
  in Stats, alongside the global one. Unlike the global heatmap, these don't
  need the shared purple gradient — use each habit's own colour as a flat /
  opacity ramp so each map reads as *that* habit.

## Non-goals (for now)

- Cloud sync / accounts / backend (explicitly out — see DECISIONS §3).
- Multi-user features, social, streaks fights (out of spirit).
- Native apps (CSS is already mobile-responsive; PWA is the optional path).