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
| Session docs workflow | ✅ | `docs/`, handoff ritual |
| Time-of-day analytics | 💡 | Needs timestamps — deferred decision (DECISIONS §9) |
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

## Open questions

- ~~Should analytics cover archived habits?~~ **Decided** (DECISIONS §11):
  dashboards = active only; historical aggregates include archived.
- ~~One global "AHA score" on Today, or per-habit only?~~ **Decided**: per-habit
  health scores + simple average on Stats; no score on Today.
- **Export format**: keep `{version:1}` + additive schema (recommended) vs bump.
  No bump happened in v0.2 (timestamps deferred), so this is still open for
  the day timestamps arrive.

## Non-goals (for now)

- Cloud sync / accounts / backend (explicitly out — see DECISIONS §3).
- Multi-user features, social, streaks fights (out of spirit).
- Native apps (CSS is already mobile-responsive; PWA is the optional path).