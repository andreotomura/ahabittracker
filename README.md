# AHA(bit) tracker

A beautiful, local-first habit tracker that **builds to a single HTML file**.
Inspired by the vibe of apps like HabitKit, but yours to keep: no account, no
network, no spying. Your data lives in the browser and is yours to export as
plain JSON — any time, any device.

## Setup on a new machine (clone → build → test)

**Prerequisites:** [Node.js](https://nodejs.org) 14 or newer — it is only used for
building, the dev server, and tests. The final app itself is a plain HTML file
that needs **no Node, no dependencies, no internet**.

```bash
# 1. clone (replace the URL with yours)
git clone <repo-url> ahabit
cd ahabit

# 2. build the single-file app (no `npm install` — there are no dependencies)
npm run build        # → dist/index.html

# 3. (optional) run the smoke tests
npm test

# 4. open the app — any of these work:
open dist/index.html        # macOS
xdg-open dist/index.html    # Linux
start dist/index.html       # Windows
# …or just double-click it in your file manager
```

The app runs straight from `file://` — you can copy `dist/index.html` to a USB
stick, email it, or drop it on any static host and it works identically.

### Trying it in dev mode (while working on the code)

```bash
npm run dev     # little static server → http://localhost:8000
```

`src/` is served as-is (separate CSS/JS files), so edits are applied on reload —
no bundling step in between. Use a different port if 8000 is taken:

```bash
PORT=9000 npm run dev
```

### Making it an installable PWA

The default build is one self-contained HTML file. For a hosted deployment that
can be **installed** and works **offline**, build the PWA variant:

```bash
npm run build:pwa     # → dist/pwa/ (index.html + manifest + sw.js + icons)
npm run preview:pwa   # build, then serve dist/pwa at http://localhost:8000
```

Then open `http://localhost:8000` — your browser offers “Install”. A service
worker caches the app shell, so it keeps working with no connection.

> Why two builds? A service worker can't run from `file://`, and installability
> needs a manifest + icons. The PWA build is additive — `dist/index.html`
> (single file) stays the default, portable artifact.

### First-run sanity checklist

1. The Today view shows the empty state (with a “Load sample data” button).
2. Create a habit, check it off — the progress bar + streak should update.
3. Switch to **Calendar** and click a past day to backfill a check-in.
4. **Stats** shows a live activity heatmap after a few check-ins.
5. Menu (⋯) → **Export data (JSON)** downloads `ahabit-backup-YYYY-MM-DD.json`.
6. Menu (⋯) → **Import data (JSON)** lets you re-load that file (replace or merge).

## Features

- 🗂️ **Folders** — group related habits (e.g. Studies → Japanese, Programming)
  into collapsible sections with per-folder progress; sort by manual order,
  name, streak, health, or newest
- ☀️ **Today** — one-tap check-ins, per-day notes, multi-check-in steppers,
  streaks, weekly targets
- 📅 **Calendar** — monthly overview with per-day dots; click any day to backfill
- 📊 **Stats** — momentum trends, per-habit health scores, weekday rhythm,
  time-of-day histogram, insights, plus a global **and per-habit** GitHub-style
  heatmap (per-habit maps use the habit's own colour)
- ✨ **Habits** — emoji, color, weekly goal (× / week), allowed weekdays, archive
- 🎨 **Themes** — Zen, Midnight, Paper, Brutalist, and Brutalist Dark
  (switch from the palette button in the topbar)
- 🎛️ **Customize** — a settings view to override colors and fonts and to show
  or hide sections on each tab (⋯ → Customize…)
- 💾 **Backup** — export / import your whole database as one `.json`
  (replace or merge on import)
- 📱 **Installable PWA** — offline-capable hosted build (`npm run build:pwa`)
- 🖱️ **Custom cursor** — themed pointer with a subtle follow-halo (mouse devices
  only; untouched on touch/reduced-motion)
- 👀 **Sample data** — load it from the empty state to explore

## Data model

Everything is stored in `localStorage` under one versioned key (`ahabit.db.v1`):

```json
{
  "version": 1,
  "folders": [
    { "id": "f9x8y7z6", "name": "Studies", "emoji": "📚", "sort": 0 }
  ],
  "habits": [
    {
      "id": "a1b2c3d4",
      "name": "Drink water",
      "emoji": "💧",
      "color": "#3b82f6",
      "target": 7,            // weekly goal; 0 = any day
      "days": [],             // allowed weekdays (1=Mon…7=Sun); empty = any day
      "folderId": "f9x8y7z6", // folder id, or null = ungrouped
      "createdAt": 1726000000000,
      "archived": false,
      "sort": 0
    }
  ],
  "completions": {
    "a1b2c3d4": { "2025-09-15": 2 }   // count per habit per day (1+ = done)
  },
  "notes": {
    "a1b2c3d4": { "2025-09-15": "finished chapter 3" }  // optional, ≤ 240 chars
  },
  "times": {
    "a1b2c3d4": { "2025-09-15": [1757900000000] }       // live check-in timestamps
  }
}
```

Backups wrap this in `{ "app": "AHA(bit) tracker", "exportedAt": …, "db": … }`
— exports round-trip cleanly.

## Dev workflow

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run build`    | inlines `styles.css` + `js/*.js` into `dist/index.html` (single file) |
| `npm run build:pwa`| builds `dist/pwa/` — installable + offline (manifest, SW, icons) |
| `npm run preview:pwa` | builds the PWA and serves it on `:8000` for install testing |
| `npm run dev`      | static file server on `src/` (live without a bundler) |
| `npm test`         | smoke tests for the data layer, views, and PWA assets |

Source maps: none needed — keep code readable instead. Modules attach to global
namespaces in dependency order: `Utils → UI → Store → Prefs → Render → App`.

> **Note:** `dist/` is git-ignored (it's a build artifact), so a fresh clone
> always starts with `npm run build` first.

## Working on this project across sessions

This project is designed so you can **stop and resume with full context**, even
with different agents/LLMs. The repo is the memory — start here:

1. **Read `docs/CONTEXT.md`** — the resume entry point (state, file map, commands, conventions).
2. **Read the newest `docs/sessions/*.md`** — grainier context from the last session.
3. Follow the protocol in **`docs/WORKFLOW.md`** (start/end rituals, doc roles).
4. Start a handoff note with `npm run session -- "topic"` when work begins.

Deep dives when needed: `docs/ARCHITECTURE.md` (modules, data flows, build),
`docs/DECISIONS.md` (why-it's-built-this-way log), `docs/ROADMAP.md` (next up).

## Troubleshooting

| Problem                          | Fix                                        |
| -------------------------------- | ------------------------------------------ |
| `node: command not found`        | Install Node.js ≥ 14 — or just open `src/index.html` in a browser (dev mode works from `file://` too; `build` is only needed for the single-file output). |
| `EADDRINUSE … 8000`              | `PORT=9000 npm run dev`                    |
| Empty state has no sample button | That's normal — the button only shows while you have zero habits; “Add habit” works too. |
| I lost my data                   | localStorage is per-browser/per-machine — keep `.json` backups via ⋯ → Export. There's no cloud sync (by design). |

## Roadmap

**Shipped:** analytics & graphs · per-check-in notes · multiple check-ins/day ·
polish (onboarding, empty states, motion) · PWA packaging · theming (5 themes,
including new-brutalist) · time-of-day analytics · custom cursor · per-habit
heatmaps · customization tool (colors, fonts, layout) · habit folders (groups,
collapse/expand, sorting).

Next up:

- 🔔 Gentle reminders (while the app is open)
- 🧪 Headless-browser e2e tests

## License

MIT — do whatever you want with it. It's your data, after all.