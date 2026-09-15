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

### First-run sanity checklist

1. The Today view shows the empty state (with a “Load sample data” button).
2. Create a habit, check it off — the progress bar + streak should update.
3. Switch to **Calendar** and click a past day to backfill a check-in.
4. **Stats** shows a live activity heatmap after a few check-ins.
5. Menu (⋯) → **Export data (JSON)** downloads `ahabit-backup-YYYY-MM-DD.json`.
6. Menu (⋯) → **Import data (JSON)** lets you re-load that file (replace or merge).

## Features (v1)

- ☀️ **Today** — one-tap check-ins, daily progress bar, streaks, weekly targets
- 📅 **Calendar** — monthly overview with per-day dots; click any day to backfill
- 📊 **Stats** — totals, streaks, 7-day completion rate, GitHub-style heatmap
- ✨ **Habits** — emoji, color, weekly goal (× / week), allowed weekdays, archive
- 🌙 **Light / dark** theme (follows system, toggleable)
- 💾 **Backup** — export / import your whole database as one `.json`
  (replace or merge on import)
- 👀 **Sample data** — load it from the empty state to explore

## Data model

Everything is stored in `localStorage` under one versioned key (`ahabit.db.v1`):

```json
{
  "version": 1,
  "habits": [
    {
      "id": "a1b2c3d4",
      "name": "Drink water",
      "emoji": "💧",
      "color": "#3b82f6",
      "target": 7,            // weekly goal; 0 = any day
      "days": [],             // allowed weekdays (1=Mon…7=Sun); empty = any day
      "createdAt": 1726000000000,
      "archived": false,
      "sort": 0
    }
  ],
  "completions": {
    "a1b2c3d4": { "2025-09-15": 1 }   // count per habit per day
  }
}
```

Backups wrap this in `{ "app": "AHA(bit) tracker", "exportedAt": …, "db": … }`
— exports round-trip cleanly.

## Dev workflow

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run build`    | inlines `styles.css` + `js/*.js` into `dist/index.html` |
| `npm run dev`      | static file server on `src/` (live without a bundler) |
| `npm test`         | smoke tests for the data layer + all views    |

Source maps: none needed — keep code readable instead. Modules attach to global
namespaces in dependency order: `Utils → UI → Store → Render → App`.

> **Note:** `dist/` is git-ignored (it's a build artifact), so a fresh clone
> always starts with `npm run build` first.

## Troubleshooting

| Problem                          | Fix                                        |
| -------------------------------- | ------------------------------------------ |
| `node: command not found`        | Install Node.js ≥ 14 — or just open `src/index.html` in a browser (dev mode works from `file://` too; `build` is only needed for the single-file output). |
| `EADDRINUSE … 8000`              | `PORT=9000 npm run dev`                    |
| Empty state has no sample button | That's normal — the button only shows while you have zero habits; “Add habit” works too. |
| I lost my data                   | localStorage is per-browser/per-machine — keep `.json` backups via ⋯ → Export. There's no cloud sync (by design). |

## Roadmap

- 📈 Analytics & graphs (time-of-day insights, trend lines, habit health scores)
- 📱 PWA packaging + installable single-file version
- 📋 Multiple check-ins per day, notes per check-in
- ⏰ Gentle reminders (while the app is open)

## License

MIT — do whatever you want with it. It's your data, after all.