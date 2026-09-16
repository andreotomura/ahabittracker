# AHA(bit) tracker — Agent Context (READ ME FIRST)

> **To any LLM agent starting a session:** you have no memory of past sessions.
> This file is your entry point. Read it fully, then read the newest file in
> `docs/sessions/`. Only dig into `docs/ARCHITECTURE.md` / `docs/DECISIONS.md`
> / `docs/ROADMAP.md` when you need detail. Do not invent context that isn't
> here or in `docs/sessions/` — ask the user instead.
>
> Working protocol: `docs/WORKFLOW.md` (must read before editing).

---

## What this is

A beautiful, **local-first habit tracker** that builds to a **single HTML file**.
No account, no network, no dependencies. Data lives in the browser
(localStorage) and can be exported/imported as one JSON file. Inspired by apps
like HabitKit.

Current milestone: **v0.2 shipped and working** — analytics & graphs (trends,
health scores, weekday rhythm, insights). What's next: per-check-in notes and a
multi-check-in/day UI.

## Quick facts

| Thing | Value |
| --- | --- |
| Runtime | Browser only (ES2020+; modern evergreen browsers) |
| Build | Node ≥ 14, **zero npm dependencies** (`npm run build`) |
| Dev server | `npm run dev` → `http://localhost:8000` (serves `src/` raw) |
| Tests | `npm test` → `scripts/smoke.js` (Node DOM-stub smoke tests) |
| Storage | `localStorage["ahabit.db.v1"]` — one versioned JSON document |
| Output | `dist/index.html` (git-ignored build artifact, ~68 KB) |
| Commit style | Conventional prefixes: `feat:` `fix:` `docs:` `chore:` `refactor:` `test:` |

**Commands to remember:** `npm run dev` · `npm run build` · `npm test` ·
`npm run session -- "short topic"` (creates a session handoff file).

## Repo map (where everything lives)

| Path | Role |
| --- | --- |
| `src/index.html` | App shell: header, tabs, menu, view containers, FAB, modal/toast roots; dev-mode script tags |
| `src/styles.css` | All styling; light/dark themes via `[data-theme]` CSS variables |
| `src/js/utils.js` | Pure helpers: dates (`YYYY-MM-DD` keys), uid, escaping, month matrix |
| `src/js/ui.js` | DOM helpers (`q/qa/el`), toasts, modal system, confirm/choice dialogs |
| `src/js/store.js` | Data layer: habits + completions, streaks, weekly progress, import/export |
| `src/js/render.js` | Pure view layer — state → HTML strings/nodes, no mutation |
| `src/js/app.js` | Controller: tabs, theme, menu, import flow, one delegated click handler |
| `build.js` | Zero-dep build tool: `dev` server / `build` (inlines CSS + JS in order) |
| `scripts/smoke.js` | Node smoke tests (DON'T need a browser — stubs a minimal DOM) |
| `scripts/new-session.js` | Creates `docs/sessions/<date>-<slug>.md` from the template |
| `docs/` | The workflow memory — see sections below |

**Script load order matters** (namespace pattern, not ES modules):
`utils → ui → store → render → app` (see `build.js` `JS_ORDER`). Each file
attaches to a global: `Utils`, `UI`, `Store`, `Render`, `App`. No bundler —
`build.js` concatenates in exactly this order.

## Data model (compact)

```jsonc
{
  "version": 1,
  "habits": [
    // id: uid string · name · emoji · color: #hex · archived: bool · sort: number
    // target: weekly goal 0–7 (0 = any day / no goal)
    // days: allowed weekdays [1..7], Mon=1; [] = any day
    // createdAt: epoch ms
  ],
  "completions": {
    "habitId": { "YYYY-MM-DD": count }   // count > 0 = done that day
  }
}
```

- Completions are **count-per-day** (schema allows >1 check-in/day for future
  analytics; today's UI only toggles 0↔1).
- ⚠️ No timestamps stored per check-in — time-of-day analytics was explicitly
  **deferred** (see `docs/DECISIONS.md` §9); the schema stays `{version:1}`
  and additive. Don't silently change what a completion value means.
- Backups wrap the DB as `{ app, exportedAt, db }` — export/import round-trips.

## How the app works (60-second version)

1. `App.init()` (on DOMContentLoaded) → `Store.load()` → `bindEvents()` → render Today.
2. All dynamic UI is rendered by `Render.*` functions setting `innerHTML` of the
   four view sections (`#view-today`, `-calendar`, `-stats`, `-habits`).
3. One **delegated click listener** in `app.js` routes everything via
   `data-action` attributes (e.g. `data-action="toggle" data-id="…"`). Inline
   `onclick` only for static dialog buttons built by `UI.el`.
4. User interaction → `Store.*` mutation → `save()` to localStorage → re-render.
5. `Render` never mutates state; `Store` never knows about the DOM (except
   `exportJSON`'s download anchor).
6. Calendar is 6×7 Monday-start grids; heatmap is 53 weeks (Mon–Sun columns);
   streaks computed on the fly (never stored).

## Current state

**Working (v0.2):** Today check-ins w/ streaks + weekly goals · calendar w/
backfill via day modal · stats & analytics (totals, streaks, 7-day rate,
heatmap, **momentum trend, per-habit health scores, weekday rhythm,
insights — all inline SVG/CSS**) · habit CRUD (emoji/color pickers, target,
allowed days, archive) · light/dark theme · JSON export/import (replace or
merge) · sample data loader · dev server · smoke tests.

**Known limitations:**
- No time-of-day analytics (deferred by design, `DECISIONS.md` §9).
- No per-check-in notes; no >1 check-in/day UI.
- localStorage is per-browser/per-machine — no sync (by design; JSON backups).
- No PWA installability (Service Worker can't run from `file://`).
- Day modal + editor modal are functional but could use visual polish passes.

## Next up (details in `docs/ROADMAP.md`)

1. Analytics shipped in v0.2 ✅ — time-of-day insights deferred (DECISIONS §9).
2. Per-habit notes on check-ins.
3. Multiple check-ins/day (schema already supports it).
4. PWA packaging for hosted deployments.
5. Polish: modal animations, empty states, onboarding.

## Conventions (must follow)

- **Zero dependencies** — never add an npm package without asking first.
- Keep the **namespace + load-order** pattern; don't introduce a bundler/ES
  modules without updating `build.js` and this doc.
- Escape ALL user content with `Utils.esc()` in HTML strings.
- New UI controls: use `data-action` delegation, not scattered listeners.
- `Render.*` = pure; keep it that way (App wires events, Store mutates).
- Run `npm test` before finishing; `npm run build` when HTML/CSS/JS output
  changes. Update `docs/CONTEXT.md` if behavior or commands change.
- UX tone: fast, friendly, beautiful — emoji are fine, no clutter.
- `dist/` is git-ignored (build artifact). Never commit it unless asked.

## Last handoff

| Date | Topic | File |
| --- | --- | --- |
| 2026-09-16 | Analytics & graphs (v0.2) | `docs/sessions/2026-09-16-analytics.md` |
| 2026-09-15 | Initial setup + docs workflow | `docs/sessions/2026-09-15-initial-setup.md` |

→ When you finish a session, add the newest entry at the top of this table and
follow the handoff ritual in `docs/WORKFLOW.md#ending-a-session`.