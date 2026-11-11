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
(`Utils → UI → Store → Prefs → Render → App`) in the order listed in `build.js`
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

## 16. Themes are flat, named token sets — no separate light/dark toggle

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Requested theming work: revisit colors/fonts, try a **new-brutalist**
direction, and offer **more than one** selectable theme. The app previously had
a binary light/dark toggle (`data-theme="dark"`).

**Decision:** Model themes as a flat list of **named** token sets applied via
`data-theme="<id>"` on `<html>`. The registry lives in `Render.THEMES`
(`{ id, name, emoji, scheme, color, colors }`) as the single source of truth for
the picker; the CSS token sets live in `src/styles.css`. Shipped themes:
`zen` (default light), `midnight` (dark), `paper` (warm light), `brutalist` and
`brutalist-dark`. The binary toggle is replaced by a **theme picker popover**
(palette button in the topbar). Old stored values migrate on load
(`light → zen`, `dark → midnight`); the choice persists in
`localStorage['ahabit.theme']`, and `color-scheme` is set per theme family.

**Consequences:** A theme can change far more than colors. Shared structural
tokens — `--radius`, `--border-w`, `--check-w`, `--pill`, `--shadow*`,
`--glow*`, `--font`, `--font-display`, `--display-tracking`,
`--display-transform`, `--on-accent` — let `brutalist` be genuinely different
(square corners, 3px black borders, hard offset shadows, mono uppercase
headings) while `zen`/`paper` stay soft. Adding a theme = one registry entry +
one CSS block. A small `[data-theme^="brutalist"]` override block handles what
tokens can't express (uppercase UI chrome, hard corners on component radii).
No external fonts (§7): brutalist uses system mono stacks, paper uses Georgia.
The `<meta name="theme-color">` is updated by JS to the active theme's
background.

---

## 17. Check-in timestamps recorded additively (enables time-of-day analytics)

**Date:** 2026-09-16 · **Status:** accepted · **Supersedes:** the §9 deferral

**Context:** §9 deferred time-of-day analytics because completions are numeric
counts with no timestamps, and it required an additive place to record *when* a
check-in happened without changing what a completion value means.

**Decision:** Add a top-level `times: { habitId: { 'YYYY-MM-DD': [epochMs…] } }`
map (parallel to `notes`), leaving `completions` numeric and `version: 1`.
Timestamps are recorded only for **live** check-ins (Today `toggle`/`inc`, plus
sample data). Backfilled or `day-all` additions on past dates get **no invented
time** — so a day's `times` array may be shorter than its count. `dec`/undo
prune the array so it never outnumbers the count, and clearing a day removes it.
`importJSON` sanitises times (known habits, valid date keys, finite positive
numbers, ≤ 100/day); `mergeWith` gap-fills; `deleteHabit` drops them;
`replaceWith` normalises a missing map to `{}`.

**Consequences:** Time-of-day insight (24-hour histogram + morning / afternoon /
evening / night peak, plus a per-habit ⏰ peak tag) works immediately, while
older data simply contributes no timestamps until it is re-entered. The schema
stays additive — no version bump, old backups import fine, and every existing
streak/analytics path still reads only `completions`. UI: a “Time of day” card
in Stats. Honest limitation (documented, not hidden): timestamps never exist for
backfilled days.

---

## 18. Custom cursor: CSS base + additive JS halo, never destructive

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Requested an in-app custom cursor. Done carelessly, custom cursors
hurt usability/accessibility (hiding the real cursor, breaking text selection,
running on touch), and Safari ignores SVG cursor images.

**Decision:** Hybrid, degrading gracefully:
- **Base (CSS only):** a neutral custom pointer — white disc + dark ring,
  centred hotspot — on `body` inside `@media (pointer: fine)`, with the built-in
  `auto` fallback. Text fields keep `cursor: text`. It is an inline SVG data URI,
  so it stays a single-file asset (no external files — §1/§7).
- **Flair (JS, additive):** `UI.initCursor()` appends a themed, lagging halo
  (uses `--accent`, so it follows any theme) that grows over interactive
  elements and contracts on press. It is `pointer-events: none`, `aria-hidden`,
  sits above modals/toasts, and **only initialises on a fine pointer without
  `prefers-reduced-motion`**.
- The native cursor is **never** hidden (`cursor: none` is deliberately unused),
  so keyboard/touch/reduced-motion users and any JS failure lose nothing.

**Consequences:** The custom cursor is pure decoration over a fully usable UI.
Touch devices never see it; reduced-motion users get no follow animation; Safari
falls back to its normal cursor (the JS halo still appears, since it isn't an
image). No new dependency and no new asset file — inline SVG plus ~40 lines in
`ui.js`.

---

## 19. Per-habit heatmaps use a flat habit-colour ramp

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Requested: a GitHub-style contribution graph for *each* habit,
where the colours don't need the shared gradient the all-habits heatmap uses.

**Decision:** `Render.heatmapGrid(habitId)` builds the 53-week grid. With no id,
the existing all-habits heatmap keeps the shared `--heat-*` ramp. With a habit
id, counts come from `Store.habitCountsByDay` and levels 1–4 are flat tints of
that habit's own colour (`color-mix(in srgb, var(--c) N%, var(--card))`; level 4
is the solid colour). Level = `min(4, count)`, so multi-check-in days read
darker. Per-habit cards live in a “Habit history” section under the global map.

**Consequences:** Each map clearly belongs to its habit (colour identity),
matching the requested non-gradient look, while the overview map still shows
overall breadth. `color-mix` keeps the ramp readable on every theme. No schema
or data changes.

---

## 20. Readability floor + cursor applied to all interactive elements

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Review surfaced two consistency problems: tertiary text was hard to
read (as low as **2.7:1** on cards) and varied a lot between themes; and the
custom cursor reverted to the default hand over buttons because component
`cursor: pointer` rules outranked the base cursor rule.

**Decision:**
- **Contrast floor:** `--text`, `--text-2` and `--text-3` must each be **≥ 4.5:1**
  against their theme's `--card`. The failing tertiary tokens were adjusted in
  place (`zen #6b7280`, `midnight #8b91ab`, `paper #776951`,
  `brutalist-dark #8a8a8a`; brutalist already passed). New themes must meet it.
- **Cursor scope:** the pointer image moved into a `--cursor` variable and is
  applied to **every interactive element** (`button`, `a`, `select`,
  `[role=button]`, `[data-action]`, and the component classes incl.
  `.check-label`) from a block placed **last** in `styles.css`, so it overrides
  the components' `cursor: pointer`. Text fields keep `cursor: text` (an I-beam
  is the correct affordance for typing/selection).

**Consequences:** Text is legible and consistent across all themes, and the
themed dot shows everywhere including buttons — no default hand. This refines
§18, which only described `body`.

---

## 21. Customization is UI-only state: token overrides + section visibility

**Date:** 2026-09-16 · **Status:** accepted

**Context:** Requested a settings tool to customise all colours and fonts, and
show/hide elements per tab.

**Decision:** A new `Prefs` namespace (`src/js/prefs.js`, loaded between Store
and Render) holds **UI-only** preferences in
`localStorage['ahabit.prefs.v1']` — never exported (cf. §14):
- **Colours/fonts** are applied as **inline CSS custom properties on `<html>`**,
  which layer over the active theme's token set. `--grad`, `--grad-soft` and
  `--on-accent` are derived from the accent colours (with a luminance check so
  ink on the accent stays readable). Fonts come from **system stacks only**
  (§7). Selecting a theme preset clears colour/font overrides (fresh start).
- **Visibility**: a `Render.SECTIONS` registry lists hideable sections per view;
  Render guards each with `Prefs.isHidden(id)`.
- The Settings surface is a dedicated `#view-settings` view (opened from the ⋯
  menu), not a modal, so it has room and previews changes live.

**Consequences:** Fully additive — no DB/schema change, no new dependency. User
colours can intentionally override the §20 contrast floor (their call), while
the built-in presets still meet it; the `--on-accent` derivation prevents the
most common self-inflicted contrast bug.

---

*(New entries go below.)*

---

## 22. Habit folders are a flat, single-membership grouping (DB) + UI-only list state

**Date:** 2026-11-11 · **Status:** accepted

**Context:** Requested grouping habits into folders (e.g. studies → japanese,
programming) with expand/collapse plus sorting.

**Decision:**
- **Schema (additive, `version: 1`):** a top-level `folders: [{ id, name,
  emoji, sort }]` array; each habit gains `folderId` (string, or `null` =
  ungrouped). One folder per habit, **one level only** — no nesting, no tags.
  Old backups import unchanged (`folders` defaults to `[]`, a dangling
  `folderId` becomes ungrouped). Same additive pattern as notes (§12) and
  times (§17) — no version bump.
- **Deleting a folder never deletes habits** — they become ungrouped.
- **Ordering** reuses each entity's existing `sort` field. `moveFolder` /
  `moveHabit` swap `sort` with the adjacent sibling **within the same folder +
  archived state**; cross-folder ties are harmless because rendering groups by
  folder first.
- **Collapse, sort mode and “done last” are UI-only** (`Prefs`,
  `localStorage['ahabit.prefs.v1']`, cf. §14/§21) — never exported.
- **Sort modes** (`manual` · `name` · `streak` · `health` · `newest`) apply
  *within* each folder. “Done last” is a stable secondary sort (default **on**,
  preserving pre-folders Today behaviour). **No filtering** for now.
- **Scope:** folders affect the **Today** and **Habits** views only; Calendar
  and Stats keep operating on all habits.

**Consequences:** Grouping is portable (it lives in the JSON backup) while
personal display choices stay local. Manual reorder uses ↑/↓ buttons —
touch-friendly, dependency-free, and no drag-and-drop to maintain.

---
## 23. Themes: more presets, saved custom themes, shape controls + element-level visibility

**Date:** 2026-11-11 · **Status:** accepted

**Context:** The five presets felt samey (both darks were purple-ish), customisation
was colour/font only, and show/hide was card-level. Requested: more themes, a
theme configuration surface, and finer-grained element toggles.

**Decision:**
- **11 presets.** Added `graphite` (neutral dark), `frost` (cool light),
  `gruvbox` (warm retro dark), `matcha` (botanical light), `synthwave` (neon
  dark), `mono` (high-contrast grayscale) alongside the original five. Each is a
  token set in `styles.css` + an entry in `Render.THEMES`; all new text tokens
  meet the §20 **≥ 4.5:1** floor. `THEMES[].colors` is now semantic
  `[bg, surface, accent, accent2]` (was ad-hoc swatches) so the gallery previews
  are truthful.
- **Custom themes are UI-only snapshots** (`Prefs.customThemes`,
  `localStorage['ahabit.prefs.v1']`) — never in the exported DB (cf. §14/§21). A
  snapshot stores `{id: ct_*, name, base preset, colors, fonts, structure}`.
  Selecting one applies it over its base theme; the active id lives in
  `ahabit.theme`. Rename/delete are supported; **theme JSON import/export is
  deferred**.
- **Shape controls** (`Prefs.structure`): corner radius, border width and shadow
  style (theme / hard / none), written as inline CSS custom properties on
  `<html>` so they layer over the active theme. Customising the accent
  **auto-derives `--grad`, `--grad-soft`, `--heat-1..4` and `--on-accent`**
  unless the user set those tokens explicitly.
- **Element-level visibility:** `Render.SECTIONS` grew from 13 card-level
  entries to ~28 element-level ones (streaks, notes, steppers, folder grouping,
  sparklines, rings, heatmap legend, brand, theme button, FAB…). Static chrome
  is toggled via `body` classes in `Prefs.applyChrome()`. `Render.LAYOUT_PRESETS`
  adds **Minimal / Balanced / Everything** quick presets. Still UI-only.
- **Surface:** `Customize` is now a first-class top nav tab next to Habits (the
  ⋯ menu still jumps to it), with a live theme **gallery**, shape controls,
  colours, fonts, and layout toggles.

**Consequences:** A lot more range without a single dependency; presets stay
accessible and user snapshots stay portable only if exported manually (deferred).
User overrides may deliberately exceed the §20 contrast floor (their call), but
every built-in preset passes it.

---

## 24. Fonts are bundled (embedded WOFF2), not fetched or assumed preinstalled

**Date:** 2026-11-11 · **Status:** accepted

**Context:** The font picker offered system stacks only (§7), so a chosen face
rendered correctly only if the OS had it — otherwise it silently fell back to a
generic family. Requested: the fonts must render everywhere without being
preinstalled.

**Decision:**
- **Bundle open-source fonts.** `src/fonts/` holds the **Latin WOFF2 subset** of
  13 OFL/Apache families (Inter, Nunito, Poppins, Source Sans 3, Source Serif 4,
  Literata, EB Garamond, Roboto Condensed, Roboto Slab, JetBrains Mono, Courier
  Prime, Archivo Black, Comic Neue). Licences live in `src/fonts/LICENSES.md`.
- **`src/fonts.css`** declares the `@font-face` rules; `src/index.html` links it
  before `styles.css`. In dev the browser fetches the `.woff2` files normally.
- **The build inlines them.** `build.js` rewrites every `url(fonts/x.woff2)` to a
  `data:font/woff2;base64,…` URI, so both `dist/index.html` and the PWA build
  stay single-file/offline with **zero external references**. The dev server
  gained a `font/woff2` MIME type.
- **Picker stacks lead with the embedded family**, then OS faces, then a generic
  tail (unchanged rule: every stack ends in a generic family). Theme
  `--font` / `--font-display` defaults were switched to embedded families
  (Nunito, Inter, Source Serif 4, JetBrains Mono) so themes are self-sufficient.

**Consequences:** Typography is identical on every machine, online or off. The
cost is size: the single file grew from ~183 KB to **~809 KB** (≈623 KB of base64
fonts). Still zero dependencies, zero network calls, and fully portable.

**Relationship to §7:** §7 said "no external fonts" meaning no webfonts fetched
from a CDN and no network calls. That intent is preserved — the fonts are now
*part of the artifact*, not requested from anywhere. §7's "no network" rule is
unchanged; its "no external fonts" wording is superseded by this entry.

---

## 25. The brand mark is a font-independent "AHA" (shared across topbar, favicon, PWA)

**Date:** 2026-11-11 · **Status:** accepted

**Context:** The mark was a single letter "A" in the topbar/favicon while the PWA
icon was a check — inconsistent, and the "A" was rendered with whatever font was
available. Requested: make the logo read "AHA", with variants to choose from.

**Decision:**
- **One geometry, three renderers.** "AHA" is drawn as **stroke segments** in
  0–1 space (`AHA_SEGMENTS` in `scripts/icons.js`). The same 0–100 path is
  inlined in `src/index.html` for the topbar `<svg>` and the favicon data URI.
  It is **not text**, so it renders identically with no fonts involved.
- **Theme-aware.** The topbar tile keeps `background: var(--grad)` and the
  strokes use `currentColor` / `--on-accent`, so every theme (and custom theme)
  recolours the logo automatically; the favicon/PWA use the fixed brand gradient.
- **The PWA icon changed from a check to "AHA"**, matching the topbar/favicon.
- **Variants gallery** at `docs/logo-variants.html` (Classic, Accent H, Bold,
  Mono; compact vs wide lockup; size strip) — a design aid, not shipped UI. The
  wired-in default is **Classic**.

**Consequences:** The logo is crisp and consistent at every size (16 px favicon
through 512 px PWA) with no font dependency. Editing the mark means touching
`AHA_SEGMENTS` and the two copies of the path in `index.html` — they're small
and commented to stay in sync.

---

## 26. Header: drop the icon-only theme button; button icons become optional

**Date:** 2026-11-11 · **Status:** accepted

**Context:** The topbar had an icon-only theme button opening a popover, which
duplicated the Customize tab. Separately, a more minimal header was requested —
buttons should be able to show text without their emoji glyphs.

**Decision:**
- **Remove the topbar theme button + popover** (`#theme-btn`, `#theme-pop`,
  `Render.themePickerHtml`, the popover CSS and `App` handlers). Theme switching
  now happens only in the Customize tab's gallery (`themeGalleryHtml`); the
  `#theme-color` meta still follows the active theme. `Render.SECTIONS` lost the
  `global.theme-btn` entry.
- **Optional button icons.** New UI-only pref `Prefs.btnIcons` (default **true**).
  When off, `body.no-btn-icons` hides the `.ui-ico` glyphs in the tab bar and the
  ⋯ menu, leaving text-only buttons. On mobile, where tab labels are normally
  hidden, an explicit rule keeps `.tab-label` visible so tabs are never blank.
  Exposed in **Customize → Layout** (`toggle-btn-icons`).

**Consequences:** One canonical place to change themes, and an optional
minimalist header. All of this stays UI-only (not in the exported DB), consistent
with §14/§21/§23.

---
