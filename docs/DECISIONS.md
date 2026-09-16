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

See also the companion decision on the summary score: the "one global AHA
score" open question resolved to **per-habit scores + a simple average** on the
Stats view (no score on Today), logged as part of §10.

---

*(New entries go below.)*