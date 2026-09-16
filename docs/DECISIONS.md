# Decision Log (ADR-style)

Append-only. Newest entry at the **bottom**. Every entry: decision, context,
consequences. A decision is any choice that would be expensive or surprising to
reverse, or that another session might otherwise re-litigate.

---

## 1. Output is a single self-contained HTML file, built with zero dependencies

**Date:** 2026-09-15 · **Status:** accepted

**Context:** The product requirement is "after build, a single-html file" that
is fast, beautiful, portable — no account, no backend, no network. The repo
must remain easy to clone and build anywhere.

**Decision:** Source lives as separate files (`src/`); a plain-Node `build.js`
concatenates CSS + JS and inlines them into `dist/index.html`. Development uses
a tiny static server over the same `src/` files. No npm packages, no bundler.

**Consequences:** Zero supply chain and zero install step on new machines
(`node build.js build` needs only Node ≥ 14). Downside: no bundler features
(tree-shaking, source maps, hot reload) — we keep code lean instead. Revisit
only if the app grows past a few thousand lines.

---

## 2. No framework; global namespaces in a fixed load order

**Date:** 2026-09-15 · **Status:** accepted

**Context:** The inlining build has no module resolution, and ES modules don't
concatenate naively without a bundler.

**Decision:** Each file attaches to a global namespace
(`Utils → UI → Store → Render → App`) in the order listed in `build.js`
`JS_ORDER`. App = controller, Store = data, Render = pure views.

**Consequences:** Simple, greppable, zero tooling. Downside: globals — mitigated
by the namespace convention and by keeping mutation strictly inside Store.

---

## 3. localStorage, one versioned document, JSON backup

**Date:** 2026-09-15 · **Status:** accepted

**Context:** Needs to work from `file://` with no backend; data must be
exportable/importable as a single `.json`; future analytics need raw data.

**Decision:** Entire DB under `localStorage["ahabit.db.v1"]` as one JSON doc
`{version, habits, completions}`. Backup = export that doc; import supports
**replace** or **merge** (merge = add missing habits, take max count per date).

**Consequences:** Synchronous and fast for habit-tracker volumes. Cross-machine
sync is out of scope by design (backups are the story). If data outgrows
localStorage (~5 MB), migrate to IndexedDB behind the same Store API.

---

## 4. Completions stored as count per day, not booleans

**Date:** 2026-09-15 · **Status:** accepted

**Context:** v1 UI only needs done/not-done per day, but the roadmap includes
analytics (frequency, multi-check-in days).

**Decision:** `completions[habitId]["YYYY-MM-DD"] = count (>0 = done)`. Dates
are local `YYYY-MM-DD` strings (sortable, prefix-searchable). Set `0`/delete to
undo.

**Consequences:** Schema future-proof for multi-check-in and frequency
analytics at negligible cost today. Multiple check-ins per day have no UI yet —
adding it is purely a view change.

---

## 5. Streaks: current streak survives until the day ends

**Date:** 2026-09-15 · **Status:** accepted

**Context:** If "current streak" reset the moment a day starts unchecked,
checking in at night would look like a broken streak all day. UX research from
habit apps strongly favors a grace period.

**Decision:** A streak counts consecutive days with ≥1 check-in; if today has no
check-in yet, the current streak is measured anchored at **yesterday** (so it
survives until midnight). Best streak scans from the earliest completion
(backfills may precede habit creation).

**Consequences:** Realistic streaks; minor subtlety worth a unit test if logic
changes.

---

## 6. Calendar weeks and heatmap start on Monday

**Date:** 2026-09-15 · **Status:** accepted

**Context:** Consistency between views; GitHub-style heatmap is 53 Mon–Sun
columns.

**Decision:** All week logic uses Monday as day 0 (`(getDay()+6) % 7`); weekday
numbers in the data model are 1=Mon … 7=Sun.

**Consequences:** One mental model everywhere. (Locale configurability is a
possible future nicety, not today's problem.)

---

## 7. No external fonts, icons, assets, or network calls

**Date:** 2026-09-15 · **Status:** accepted

**Context:** The single file must be fully offline and privacy-clean.

**Decision:** System font stack, emoji icons, inline SVG, everything inline.
Zero requests are made by the built file at runtime.

**Consequences:** Works from `file://`, USB sticks, air-gapped machines.
Trade-off: no webfont typography; visual richness comes from color, spacing,
and animation instead.

---

## 8. `dist/` is git-ignored

**Date:** 2026-09-15 · **Status:** accepted

**Context:** It's a generated artifact; committing it would create merge noise
and stale builds.

**Decision:** `.gitignore` excludes `dist/`; the README documents
`npm run build` as part of the clone flow. `src/` is the source of truth.

**Consequences:** Fresh clones must run the build once (2 seconds). We revisit
this if anyone wants a "download and double-click" distribution through GitHub.

---

## 9. Time-of-day analytics deferred — no timestamp schema change in v0.2

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Roadmap's timestamp question (options a/b/c). Today's UI only
toggles 0↔1, and backfilled days can't know a time, so time-of-day data would
be sparse and misleading. Capturing times would either make completion values
objects (schema break) or add a second log collection (second source of truth).

**Decision:** Do **not** record check-in times in v0.2. Keep the `{version:1}`
count-per-day schema. Time-of-day insights ("you usually check in at night")
are explicitly out of scope until a future schema bump.

**Consequences:** All v0.2 analytics (trends, health scores, weekday rhythm)
work without timestamps. When/if times are wanted later, prefer the additive
path: keep the numeric count and add `times[]` (per-date epoch ms) either in a
parallel structure or via a version-2 bump with a migration inside
`Store.importJSON` — never silently change what a completion value means.

---

## 10. Health score is an explainable weighted composite (0–100)

**Date:** 2026-09-16 · **Status:** accepted

**Context:** "Habit health score" needs a simple, honest formula a user could
recompute by hand — not a magic black box.

**Decision:**
- Habits **with a weekly goal**: 40% 30-day consistency + 30% weekly-target
  attainment (average of the last 4 complete Mon–Sun weeks, capped at 100%)
  + 30% current streak (capped at 14 days).
- Habits **without a goal**: 70% 30-day consistency + 30% current streak.
- Rates only count *scheduled* days (respecting the habit's allowed weekdays)
  and only days since tracking began (the earlier of habit creation and its
  earliest completion, so backfills/sample data don't zero out brand-new
  habits). The formula is shown as a footnote in the Stats view.

**Consequences:** Consistent, explainable scores across sessions. The 14-day
streak cap prevents one metric from dominating. Summary "Average health" is
shown as a stat card; per-habit rings are in the habit-health list
(`Render.healthCard` / `Store.healthScore`).

---

## 11. Analytics dashboards cover active habits only

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Roadmap open question — should analytics cover archived habits?

**Decision:** Per-habit analytics (`habitTrend`, `healthScore`, `weekdayRates`,
`insights`, momentum) operate on **active** habits only. Aggregates that already
included everything (totals, days tracked, heatmap) keep including archived
history.

**Consequences:** The analytics view stays an actionable picture of *current*
routines, while archived history still counts toward totals/heatmap. Restoring
an archived habit automatically brings it back into analytics.

---

## 12. Check-in notes are additive plain text, independent of completions

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Roadmap's "per-check-in notes" item. Completions are numeric counts
(DECISIONS §4) and §9 forbids silently changing what a value means — so notes
must not mutate the completion value into an object.

**Decision:** Add a top-level `notes: { habitId: { 'YYYY-MM-DD': text } }` map
with the same key convention as completions. Notes are optional plain text,
capped at 240 chars, validated on write (`Store.setNote`) and on import.
Notes are **independent of check-ins**: toggling a check-in or "Clear day"
never deletes notes. A note is removed only when the field is cleared, its
habit is deleted, or an import **replace** wipes the db. Import **merge**
fill-gaps only (imported notes never overwrite existing ones).

**Consequences:** Round-trips through export/import (sanitized like the rest);
backups from before notes import fine (`notes` defaults to `{}` on load).
Streaks, totals, and all analytics ignore notes entirely. UI: notes are edited
inline on Today rows (revealed when the habit is done or already has a note)
and in the day modal; `app.js` wires a second delegated `input` listener
(`data-action="note"`) next to the click listener — no per-field listeners.

---

## 13. Multi-check-in UI: steppers on Today + day modal; check = done/undo-all

**Date:** 2026-09-16 · **Status:** accepted

**Context:** The schema has supported count-per-day since §4, but the UI only
toggled 0↔1, so counts > 1 were unreachable by users. Goal: record multiple
check-ins a day (e.g. "Drink water" × 4).

**Decision:**
- Store: add `countFor(id, key)` plus `inc(id, key)` / `dec(id, key)`.
- UI: a `− ×N ＋` stepper appears on Today rows and in the day modal whenever a
  habit is done (count ≥ 1). The `−` button is disabled at 1, so the stepper
  manages counts within [1, ∞) and never silently un-dones a habit.
- The check button keeps its mental model: tap = done (0→1); tap again =
  undo — at N ≥ 2 it undoes **all** check-ins (tooltip says "Undo all (×N)").
- Sample data: "Drink water" today = 3 check-ins, so the feature is visible
  on first run.

**Consequences:** Streaks, week progress, and analytics are untouched because
they only test count ≥ 1 (truthiness). "Total check-ins" now reflects real
multi counts (it always summed raw counts — the UI just couldn't produce
them). The heatmap still colors by *habits done per day* (breadth), not raw
count — kept deliberately this session; if totals-per-day ever matter there,
that's a separate tweak. Version bumped 0.3 → 0.4 (About dialog).

---

## 14. Onboarding dismissal is UI-only state (not in the exported DB)

**Date:** 2026-09-16 · **Status:** accepted

**Context:** The polish pass adds a first-run welcome card on Today. Whether it
has been dismissed is presentation state, not user data.

**Decision:** Store the dismissal flag in `localStorage['ahabit.welcome.v1']`
(alongside the theme key), managed by `App.showWelcome()/dismissWelcome()`.
It is deliberately **not** part of the `ahabit.db.v1` document, so it never
appears in export/import and a restored backup doesn't change it. The card
only appears when there's at least one active habit (the Today empty state
already covers "no habits"). `Render.renderToday(showWelcome)` receives the
flag from App — Render stays pure and never reads localStorage.

**Consequences:** UI preferences and user data stay separate. A user importing
a backup on a fresh browser may briefly see the welcome card again (the flag
is per-browser) — acceptable. Empty/zero-data views now collapse to a single
friendly empty state (e.g. Stats with no habits) rather than a dashboard of
zeros, while archived history remains visible via the heatmap.

---

See also the companion decision on the summary score: the "one global AHA
score" open question resolved to **per-habit scores + a simple average** on the
Stats view (no score on Today), logged as part of §10.

---

## 15. PWA is an additive build target — the single-file build stays default

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Roadmap's PWA item. A service worker can't run from `file://`, and
installability needs a manifest, icons, and a same-origin SW script — so true
PWA support requires sidecar files. But DECISIONS §1 promises one
self-contained HTML file.

**Decision:** Keep `npm run build` exactly as it was: one self-contained
`dist/index.html` with no PWA hooks and zero external refs. Add
`npm run build:pwa` → `dist/pwa/` containing the same inlined `index.html`
plus `manifest.webmanifest`, `sw.js`, and PNG icons. The PWA `<head>` tags
(manifest link, `theme-color`, apple-touch, SW registration) are injected at a
`<!--PWA-->` marker that the plain build strips out.

**Consequences:** Portability is preserved — `dist/index.html` still runs from
a USB stick; the PWA variant only matters when hosted over http(s), and SW
registration is guarded by a protocol check so the file:// build attempts
nothing. Icons are generated at build time by a hand-rolled PNG encoder
(`scripts/icons.js` — zlib + CRC32), keeping §1's zero-dependency promise. The
SW cache name is derived from the built-HTML hash, so any content change ships
a new worker and refreshes the cache automatically. `node build.js dev <dir>`
now takes a directory so the PWA output can be previewed locally.

---

*(New entries go below.)*