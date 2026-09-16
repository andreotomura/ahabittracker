# Session 2026-09-16 — per-habit heatmaps (v0.10)

**Status:** ✅ finished
**Agent/tool:** pi (coding agent)
**Related docs touched:** DECISIONS §19 added, ROADMAP backlog → shipped, ARCHITECTURE/CONTEXT/README updated

## Goal

Ship the requested per-habit GitHub-style contribution graph — where the colours
use each habit's own palette instead of the shared global gradient.

## What was done

- **DECISIONS §19**: the all-habits map keeps the shared `--heat-*` ramp; each
  per-habit map uses a **flat ramp of the habit's own colour**.
- **Store** (`src/js/store.js`): `habitCountsByDay(id, start, end)` — raw
  per-habit check-in counts (exported).
- **Render** (`src/js/render.js`):
  - Refactored the global heatmap into a shared `heatmapGrid(habitId)` (53-week
    weeks/month labels/cells), returning `{ monthCells, cellHtml, done }`.
  - `heatmapCard()` (global, unchanged look) and new `habitHeatmapCard(h)`
    render from it.
  - New “Habit history” section in Stats: one card per active habit, with the
    habit emoji/name, a “N days · 12 mo” count, the grid, and a legend.
- **CSS** (`src/styles.css`): `.hheat-*` card/head/scroll styles and per-habit
  cell overrides — h1–h4 become `color-mix(in srgb, var(--c) N%, var(--card))`
  with level 4 = the solid habit colour. Empty cells keep the theme border.
- **Tests** (`scripts/smoke.js`): `habitCountsByDay` returns positive counts;
  Stats renders the Habit-history section and `hheat-card`s.
- **Version** → 0.10.0 (About + `package.json`).

## Key decisions & changes

- Levels are `min(4, count)` — for single-check-in habits the map reads as a
  clean done/not-done tint; multi-check-in days darken. (Most days are level 1
  = 35% tint, so the map stays legible rather than washed out.)
- Kept the global heatmap's shared ramp so the overview still shows *breadth*
  (habits done/day) — only the per-habit maps switched to identity colours.
- Per-habit maps are active-habits only (consistent with DECISIONS §11).

## Files touched

- `src/js/store.js`, `src/js/render.js`, `src/styles.css`, `src/js/app.js`
  (version), `scripts/smoke.js`, `package.json`
- `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`,
  `docs/CONTEXT.md`, `README.md`

## Verification

- `npm test` → ✅ all passed (per-habit counts + rendered Habit-history cards).
- `npm run build` → ✅ `dist/index.html` 118.4 KB, no external refs.
- Rendered inspection: 5 sample habits → 5 `hheat-card`s, each carrying its own
  `--c` (`#3b82f6`, `#8b5cf6`, `#f97316`, `#10b981`, `#ec4899`); the global card
  has no `--c` override.

## State of the app

- Working and committed. Nothing known broken.
- v0.2–v0.10 shipped; the feature backlog is now empty. The only notable gaps
  are verification-related (no headless e2e) and the low-priority reminders idea.

## NEXT STEPS (for the next session)

1. **Headless-browser e2e tests** — now the most valuable remaining work: it
   would actually exercise SW install/offline, theme rendering, the cursor, and
   these heatmaps (all currently reasoned about statically). Likely needs a
   dev-only dep (Playwright/puppeteer) — must ask before adding (DECISIONS §1).
2. Or **gentle reminders** (Notification API while the tab is open).
3. Or polish: per-theme cursor colour, a “System” theme option.
4. Whichever path: re-read `docs/CONTEXT.md` and this file first.

## Context dump

- `Render.heatmapGrid(habitId?)` is the single heatmap builder — extend it rather
  than duplicating the 53-week logic. It returns `done` (days with count > 0).
- Per-habit cell colours live only in the `.hheat-card .heat-cell.hN` CSS
  overrides; the base `.hN` rules stay theme-ramp based.
- `Store.habitCountsByDay` returns only days with count > 0 (sparse), unlike
  `countsByDay` which zero-fills the range — intentional.
- Version lives in `app.js` About + `package.json`; both bumped to 0.10.0.