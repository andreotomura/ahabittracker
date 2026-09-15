# AHA(bit) tracker

A beautiful, local-first habit tracker that **builds to a single HTML file**.
Inspired by the vibe of apps like HabitKit, but yours to keep: no account, no
network, no spying. Your data lives in the browser and is yours to export as
plain JSON — any time, any device.

## Quick start

```bash
npm run dev     # dev server → http://localhost:8000
npm run build   # → dist/index.html  (single self-contained file)
```

Open `dist/index.html` in any browser — it works from `file://`, a USB stick,
or any static host. Everything (CSS, JS, data) is in that one file.

> No dependencies, no npm install needed — `build.js` is plain Node.

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
| `npm run dev`      | static file server on `src/` (live without a bundler) |
| `npm run build`    | inlines `styles.css` + `js/*.js` into `dist/index.html` |

Source maps: none needed — keep code readable instead. Modules attach to global
namespaces in dependency order: `Utils → UI → Store → Render → App`.

## Roadmap

- 📈 Analytics & graphs (time-of-day insights, trend lines, habit health scores)
- 📱 PWA packaging + installable single-file version
- 📋 Multiple check-ins per day, notes per check-in
- ⏰ Gentle reminders (while the app is open)

## License

MIT — do whatever you want with it. It's your data, after all.