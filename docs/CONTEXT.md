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

Current milestone: **v0.8 shipped and working** — analytics (v0.2), notes
(v0.3), multi check-ins (v0.4), polish (v0.5), PWA (v0.6), themes (v0.7), and
time-of-day analytics (v0.8). What's next: headless e2e tests and smaller
polish (per-habit heatmaps are in the roadmap backlog).

## Quick facts

| Thing | Value |
| --- | --- |
| Runtime | Browser only (ES2020+; modern evergreen browsers) |
| Build | Node ≥ 14, **zero npm dependencies** (`npm run build`) |
| PWA build | `npm run build:pwa` → `dist/pwa/` (manifest + SW + icons; serve over http(s)) |
| Dev server | `npm run dev` → `http://localhost:8000` (serves `src/` raw; `node build.js dev dist/pwa` to preview PWA) |
| Tests | `npm test` → `scripts/smoke.js` (Node DOM-stub smoke tests) |
| Storage | `localStorage["ahabit.db.v1"]` — one versioned JSON document |
| Output | `dist/index.html` (single file, git-ignored) · `dist/pwa/` (installable) |
| Themes | `zen` · `midnight` · `paper` · `brutalist` · `brutalist-dark` — registry `Render.THEMES`, tokens in `styles.css` |
| Commit style | Conventional prefixes: `feat:` `fix:` `docs:` `chore:` `refactor:` `test:` |

**Commands to remember:** `npm run dev` · `npm run build` · `npm run build:pwa` ·
`npm run preview:pwa` · `npm test` · `npm run session -- "short topic"`.

## Repo map (where everything lives)

| Path | Role |
| --- | --- |
| `src/index.html` | App shell: header, tabs, menu, view containers, FAB, modal/toast roots; dev-mode script tags |
| `src/styles.css` | All styling; light/dark themes via `[data-theme]` CSS variables |
| `src/js/utils.js` | Pure helpers: dates (`YYYY-MM-DD` keys), uid, escaping, month matrix |
| `src/js/ui.js` | DOM helpers (`q/qa/el`), toasts, modal system, confirm/choice dialogs |
| `src/js/store.js` | Data layer: habits + completions, streaks, weekly progress, import/export |
| `src/js/render.js` | Pure view layer — state → HTML strings/nodes, no mutation |
| `src/js/app.js` | Controller: tabs, theme, menu, import flow, delegated click + note-input handlers |
| `build.js` | Zero-dep build tool: `dev [dir]` server / `build` (single file) / `pwa` (installable dir) |
| `scripts/smoke.js` | Node smoke tests (DON'T need a browser — stubs a minimal DOM) |
| `scripts/pwa.js` | PWA text assets: manifest, service worker, injected `<head>` snippet |
| `scripts/icons.js` | Zero-dep PNG icon generator (CRC32 + zlib; pure, unit-tested) |
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
  },
  "notes": {
    "habitId": { "YYYY-MM-DD": "optional free-text note" }  // ≤ 240 chars
  },
  "times": {
    "habitId": { "YYYY-MM-DD": [1726000000000] }  // live check-in timestamps
  }
}
```

- Completions are **count-per-day**; the UI records 1+ via the `− ×N ＋`
  steppers (v0.4), and count ≥ 1 means done. The check button = done /
  undo-all (DECISIONS §4, §13).
- Per-check-in **notes** are a separate top-level map (same date keys),
  independent of counts — clearing a check-in never deletes the note
  (DECISIONS §12).
- **Check-in times** live in a `times` map (same date keys) and record only
  **live** check-ins; backfilled days intentionally have none (DECISIONS §17).
  The schema stays `{version:1}` and additive — never silently change what a
  completion value means.
- Backups wrap the DB as `{ app, exportedAt, db }` — export/import round-trips
  (notes and times included).

## How the app works (60-second version)

1. `App.init()` (on DOMContentLoaded) → `Store.load()` → `bindEvents()` → render Today.
2. All dynamic UI is rendered by `Render.*` functions setting `innerHTML` of the
   four view sections (`#view-today`, `-calendar`, `-stats`, `-habits`).
3. One **delegated click listener** in `app.js` routes everything via
   `data-action` attributes (e.g. `data-action="toggle" data-id="…"`); note
   fields (`data-action="note"`) are live-saved by one delegated `input`
   listener. Inline `onclick` only for static dialog buttons built by `UI.el`.
4. User interaction → `Store.*` mutation → `save()` to localStorage → re-render.
5. `Render` never mutates state; `Store` never knows about the DOM (except
   `exportJSON`'s download anchor).
6. Calendar is 6×7 Monday-start grids; heatmap is 53 weeks (Mon–Sun columns);
   streaks computed on the fly (never stored).

## Current state

**Working (v0.8):** Today check-ins w/ streaks + weekly goals + inline notes +
count steppers + dismissible first-run welcome card · calendar w/ backfill
via day modal (notes + steppers + empty states) · stats & analytics (totals,
streaks, 7-day rate, heatmap, momentum trend, per-habit health scores,
weekday rhythm, **time-of-day histogram**, insights — all inline SVG/CSS,
animated entrance) · habit CRUD (emoji/color pickers, target, allowed days,
archive) · 5 selectable themes incl. new-brutalist · JSON export/import
(replace or merge, incl. notes + times) · sample data loader · single-file
**and** installable PWA builds · dev server · smoke tests.

**Known limitations:**
- Time-of-day data accrues only from **live** check-ins — backfilled days carry
  no timestamp (DECISIONS §17).
- Heatmap colors by habits-done-per-day (breadth), not raw check-in count.
- localStorage is per-browser/per-machine — no sync (by design; JSON backups).
- Only the hosted `build:pwa` output is installable/offline; the single-file
  build can't run a Service Worker (no `file://` install).
- Day modal + editor modal are functional but could use visual polish passes.

## Next up (details in `docs/ROADMAP.md`)

1. v0.2 analytics · v0.3 notes · v0.4 multi check-ins · v0.5 polish · v0.6 PWA · v0.7 themes · v0.8 time-of-day — all shipped ✅.
2. Headless-browser e2e tests (would also verify SW install + theme rendering).
3. Backlog: per-habit GitHub-style heatmaps (habit-colour, non-gradient ramp).

## Conventions (must follow)

- **Zero dependencies** — never add an npm package without asking first.
- Keep the **namespace + load-order** pattern; don't introduce a bundler/ES
  modules without updating `build.js` and this doc.
- Escape ALL user content with `Utils.esc()` in HTML strings.
- New UI controls: use `data-action` delegation, not scattered listeners.
- `Render.*` = pure; keep it that way (App wires events, Store mutates).
- **Theming**: define a theme as a token set in `src/styles.css`
  (`[data-theme="<id>"]`) and register it in `Render.THEMES`; prefer the shared
  structural tokens over hardcoded px so a theme can change shape/type, not just
  color. No external fonts (DECISIONS §7).
- Run `npm test` before finishing; `npm run build` when HTML/CSS/JS output
  changes. Update `docs/CONTEXT.md` if behavior or commands change.
- UX tone: fast, friendly, beautiful — emoji are fine, no clutter.
- `dist/` is git-ignored (build artifact). Never commit it unless asked.

## Last handoff

| Date | Topic | File |
| --- | --- | --- |
| 2026-09-16 | Time-of-day analytics (v0.8) | `docs/sessions/2026-09-16-time-of-day.md` |
| 2026-09-16 | Theming system — 5 themes incl. new-brutalist (v0.7) | `docs/sessions/2026-09-16-themes.md` |
| 2026-09-16 | PWA packaging (v0.6) | `docs/sessions/2026-09-16-pwa.md` |
| 2026-09-16 | Polish: onboarding, empty states, modal motion (v0.5) | `docs/sessions/2026-09-16-polish.md` |
| 2026-09-16 | Multiple check-ins/day (v0.4) | `docs/sessions/2026-09-16-multi-checkin.md` |
| 2026-09-16 | Per-check-in notes (v0.3) | `docs/sessions/2026-09-16-notes.md` |
| 2026-09-16 | Analytics & graphs (v0.2) | `docs/sessions/2026-09-16-analytics.md` |
| 2026-09-15 | Initial setup + docs workflow | `docs/sessions/2026-09-15-initial-setup.md` |

→ When you finish a session, add the newest entry at the top of this table and
follow the handoff ritual in `docs/WORKFLOW.md#ending-a-session`.