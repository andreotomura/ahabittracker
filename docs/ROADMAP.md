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
| Session docs workflow | ✅ | `docs/`, handoff ritual |
| **Analytics & graphs** | ⏳ | The next major milestone — see below |
| Per-check-in notes | ⏳ | After analytics (schema change likely) |
| Multiple check-ins/day UI | ⏳ | Schema already supports it (DECISIONS §4) |
| PWA packaging for hosted deployments | 💡 | SW can't run on `file://`; needs hosting story |
| In-app reminders (Notification API) | 💡 | While tab is open |
| Headless-browser e2e tests | 💡 | Playwright etc. would be a dev-only dep |

## Next milestone: Analytics & graphs (v0.2)

Goal: create value from the inputs — not just show numbers, but *insight*.

### Proposed scope

1. **Per-habit trend lines** — 7/30-day rolling completion rate, direction arrow
   (improving / slipping / flat).
2. **Habit health score** — a 0–100 composite (streak, consistency, weekly
   target attainment). Needs a simple, explainable formula.
3. **Time-of-day insights** — *requires a schema decision*: today completions
   store only a count with no timestamp. Options:
   - (a) add `times: [epochMs]` to each date entry (back-compatible: keep count),
   - (b) add a separate `checkins` log collection (cleaner for analytics but a
     second source of truth),
   - (c) skip time analytics (lowest effort).
   → This should be a logged decision in `docs/DECISIONS.md` before building.
4. **Worst/best days & consistency** — weekday heat, longest gap, most
   consistent habit.
5. **Better visuals** — trend charts as inline SVG (no dependencies, keep the
   single-file promise).

### Suggested order (for the next session)

1. Re-read `docs/CONTEXT.md` + newest session file.
2. Decide the timestamp question (DECISIONS entry) — it shapes everything.
3. Add the data-support functions to `Store` + extend `scripts/smoke.js`.
4. Build SVG sparklines/trend UI in the Stats tab; keep `Render` pure.
5. Update docs: DECISIONS, ROADMAP statuses, session handoff.

### Open questions

- Should analytics cover archived habits? (Probably yes for history, no for
  "today" surfaces — needs a decision.)
- One global "AHA score" on Today, or per-habit only?
- Export format v2: keep `{version:1}` + additive schema (recommended) vs bump.

## Non-goals (for now)

- Cloud sync / accounts / backend (explicitly out — see DECISIONS §3).
- Multi-user features, social, streaks fights (out of spirit).
- Native apps (CSS is already mobile-responsive; PWA is the optional path).