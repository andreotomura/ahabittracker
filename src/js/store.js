/*
 * store.js — the data layer.
 *
 * Everything lives in localStorage as one versioned document:
 *
 *   {
 *     version: 1,
 *     habits: [{ id, name, emoji, color, target, days, createdAt, archived, sort }],
 *     completions: { [habitId]: { 'YYYY-MM-DD': count } }
 *   }
 *
 * `target` = weekly goal (0 = any day / no goal). `days` = allowed weekdays (1–7, Mon=1),
 * empty = any day. `count` allows multiple check-ins per day (analytics-friendly later);
 * the UI currently toggles between 0 and 1.
 *
 * Attaches to the global `Store` namespace.
 */
'use strict';

const Store = (() => {
  const DB_KEY = 'ahabit.db.v1';

  let db = null;

  const emptyDb = () => ({ version: 1, habits: [], completions: {} });

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        db = JSON.parse(raw);
        if (!Array.isArray(db.habits) || typeof db.completions !== 'object') db = emptyDb();
      } else {
        db = emptyDb();
      }
    } catch (_e) {
      db = emptyDb();
    }
    return db;
  }

  function save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (_e) {
      UI.toast('Could not save — storage full. Please export a backup.', 'err', 4000);
    }
  }

  /* ---------------- Habits ---------------- */

  const activeHabits = () =>
    db.habits
      .filter((h) => !h.archived)
      .slice()
      .sort((a, b) => a.sort - b.sort);

  const allHabits = () => db.habits.slice().sort((a, b) => a.sort - b.sort);

  const getHabit = (id) => db.habits.find((h) => h.id === id);

  function addHabit(fields) {
    const habit = {
      id: Utils.uid(),
      name: String(fields.name || '').trim().slice(0, 48),
      emoji: String(fields.emoji || '⭐').slice(0, 8),
      color: /^#[0-9a-f]{6}$/i.test(fields.color || '') ? fields.color : '#6d5df6',
      target: Utils.clamp(parseInt(fields.target, 10) || 0, 0, 7),
      days: Array.isArray(fields.days) ? fields.days.filter((d) => d >= 1 && d <= 7) : [],
      createdAt: Date.now(),
      archived: !!fields.archived,
      sort: db.habits.length,
    };
    if (!habit.name) return null;
    db.habits.push(habit);
    save();
    return habit;
  }

  function updateHabit(id, patch) {
    const h = getHabit(id);
    if (!h) return null;
    if (patch.name != null) h.name = String(patch.name).trim().slice(0, 48) || h.name;
    if (patch.emoji != null) h.emoji = String(patch.emoji).slice(0, 8);
    if (patch.color != null && /^#[0-9a-f]{6}$/i.test(patch.color)) h.color = patch.color;
    if (patch.target != null) h.target = Utils.clamp(parseInt(patch.target, 10) || 0, 0, 7);
    if (patch.days != null) h.days = patch.days.filter((d) => d >= 1 && d <= 7);
    if (patch.archived != null) h.archived = !!patch.archived;
    save();
    return h;
  }

  function deleteHabit(id) {
    db.habits = db.habits.filter((h) => h.id !== id);
    delete db.completions[id];
    save();
  }

  /* ---------------- Completions ---------------- */

  const completionsFor = (id) => db.completions[id] || {};
  const isDone = (id, key) => (completionsFor(id)[key] || 0) > 0;

  function setCount(id, key, count) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    count = Math.max(0, parseInt(count, 10) || 0);
    const map = db.completions[id] || (db.completions[id] = {});
    if (count > 0) map[key] = count;
    else {
      delete map[key];
      if (!Object.keys(map).length) delete db.completions[id];
    }
    save();
  }

  /** Check-in / undo for a habit on a given day (0 ↔ 1 for now). */
  function toggle(id, key) {
    setCount(id, key, isDone(id, key) ? 0 : 1);
  }

  /** Number of habits completed on a date across *all* habits (incl. archived). */
  function doneCount(key) {
    let n = 0;
    for (const h of db.habits) if (isDone(h.id, key)) n++;
    return n;
  }

  /**
   * Map of date → [{id, color, emoji}] for one month (for the calendar).
   * Only looks at completions within the month, so it stays fast.
   */
  function dailySummary(year, month) {
    const map = {};
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    for (const h of db.habits) {
      const c = db.completions[h.id];
      if (!c) continue;
      for (const k in c) {
        if (k.length === 10 && k.startsWith(prefix) && c[k] > 0) {
          (map[k] = map[k] || []).push({ id: h.id, color: h.color, emoji: h.emoji });
        }
      }
    }
    return map;
  }

  /** Map of date → total check-ins (count of habits done) for a range of keys. */
  function countsByDay(startKey, endKey) {
    const counts = {};
    let d = Utils.parseKey(startKey);
    const end = Utils.parseKey(endKey);
    while (d <= end) {
      counts[Utils.keyOf(d)] = 0;
      d = Utils.addDays(d, 1);
    }
    for (const h of db.habits) {
      const c = db.completions[h.id];
      if (!c) continue;
      for (const k in c) {
        if (k >= startKey && k <= endKey && c[k] > 0) counts[k] = (counts[k] || 0) + 1;
      }
    }
    return counts;
  }

  /* ---------------- Derived stats ---------------- */

  /** Current + best streak (consecutive days with ≥1 check-in). */
  function streakFor(id) {
    const comps = completionsFor(id);
    const tKey = Utils.todayKey();

    // Current streak: if today isn't done yet, the streak may still be alive from yesterday.
    let cur = 0;
    let d = new Date();
    if (!comps[tKey]) d = Utils.addDays(d, -1);
    while (comps[Utils.keyOf(d)]) {
      cur++;
      d = Utils.addDays(d, -1);
      if (cur > 3660) break; // safety valve (~10 years)
    }

    let best = 0;
    let run = 0;
    const habit = getHabit(id);
    const created = Utils.parseKey(Utils.keyOf(new Date((habit && habit.createdAt) || Date.now())));
    // Start from the earliest completion (backfills can predate createdAt).
    let earliest = null;
    for (const k in comps) if (!earliest || k < earliest) earliest = k;
    const start = earliest && Utils.parseKey(earliest) < created ? Utils.parseKey(earliest) : created;
    for (let dt = start; Utils.keyOf(dt) <= tKey; dt = Utils.addDays(dt, 1)) {
      if (comps[Utils.keyOf(dt)]) { run++; if (run > best) best = run; }
      else run = 0;
    }

    return { current: cur, best };
  }

  /** {done, target} for the current Mon–Sun week, or null when the habit has no goal. */
  function weekProgress(id) {
    const h = getHabit(id);
    if (!h || !h.target) return null;
    const monday = Utils.weekEnding(new Date())[0];
    const comps = completionsFor(id);
    let done = 0;
    for (let i = 0; i < 7; i++) {
      if (comps[Utils.keyOf(Utils.addDays(monday, i))]) done++;
    }
    return { done, target: h.target };
  }

  const totalCompletions = () => {
    let n = 0;
    for (const hid in db.completions) for (const k in db.completions[hid]) n += db.completions[hid][k] || 0;
    return n;
  };

  /** Aggregates for the Stats view: totals, best current streak, 7-day rate. */
  function statsOverview() {
    let total = 0;
    const days = new Set();
    for (const hid in db.completions) {
      for (const k in db.completions[hid]) {
        total += db.completions[hid][k] || 0;
        days.add(k);
      }
    }

    let best = { days: 0, name: '' };
    for (const h of activeHabits()) {
      const cur = streakFor(h.id).current;
      if (cur > best.days) best = { days: cur, name: h.name };
    }

    const week = Utils.weekEnding(new Date());
    const counts = countsByDay(Utils.keyOf(week[0]), Utils.keyOf(week[6]));
    const done7 = Object.values(counts).reduce((a, b) => a + b, 0);
    const possible = activeHabits().length * 7;
    const rate7 = possible ? Math.round((done7 / possible) * 100) : 0;

    return { total, daysTracked: days.size, best, rate7 };
  }

  /* ---------------- Backup: export / import ---------------- */

  function exportJSON() {
    const payload = JSON.stringify(
      { app: 'AHA(bit) tracker', exportedAt: new Date().toISOString(), db },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ahabit-backup-${Utils.todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  /** Parse + sanitize a backup file. Returns {ok, db} or {ok: false, error}. */
  function importJSON(text) {
    try {
      let data = JSON.parse(text);
      if (data && data.db && Array.isArray(data.db.habits)) data = data.db; // re-import of our own export
      if (!data || !Array.isArray(data.habits)) {
        return { ok: false, error: 'Not a valid AHA(bit) backup file.' };
      }
      const habits = data.habits
        .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
        .map((h) => ({
          id: h.id,
          name: String(h.name).slice(0, 48),
          emoji: String(h.emoji || '⭐').slice(0, 8),
          color: /^#[0-9a-f]{6}$/i.test(h.color || '') ? h.color : '#6d5df6',
          target: Utils.clamp(parseInt(h.target, 10) || 0, 0, 7),
          days: Array.isArray(h.days) ? h.days.filter((d) => d >= 1 && d <= 7) : [],
          createdAt: Number(h.createdAt) || Date.now(),
          archived: !!h.archived,
          sort: Number(h.sort) || 0,
        }));

      const completions = {};
      if (data.completions && typeof data.completions === 'object') {
        for (const hid in data.completions) {
          const cm = data.completions[hid];
          if (!cm || typeof cm !== 'object') continue;
          const out = {};
          for (const k in cm) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
              const v = parseInt(cm[k], 10) || 0;
              if (v > 0) out[k] = v;
            }
          }
          if (Object.keys(out).length) completions[hid] = out;
        }
      }
      return { ok: true, db: { version: 1, habits, completions } };
    } catch (_e) {
      return { ok: false, error: 'Could not read the file — invalid JSON.' };
    }
  }

  function replaceWith(db2) {
    db = db2;
    save();
  }

  function mergeWith(db2) {
    const byId = {};
    db.habits.forEach((h) => (byId[h.id] = h));
    for (const h of db2.habits) {
      if (!byId[h.id]) {
        byId[h.id] = h;
        db.habits.push(h);
      }
    }
    for (const hid in db2.completions) {
      const cur = db.completions[hid] || (db.completions[hid] = {});
      for (const k in db2.completions[hid]) {
        cur[k] = Math.max(cur[k] || 0, db2.completions[hid][k]);
      }
    }
    save();
  }

  /* ---------------- Sample data (first-run helper) ---------------- */

  function loadSample() {
    const fixtures = [
      { name: 'Drink water', emoji: '💧', color: '#3b82f6', target: 7, prob: 0.85 },
      { name: 'Read 20 pages', emoji: '📚', color: '#8b5cf6', target: 5, prob: 0.8 },
      { name: 'Exercise', emoji: '🏃', color: '#f97316', target: 4, prob: 0.55 },
      { name: 'Meditate', emoji: '🧘', color: '#10b981', target: 6, prob: 0.7 },
      { name: 'No sugar', emoji: '🍎', color: '#ec4899', target: 5, prob: 0.6 },
    ];
    const added = fixtures.map((f) => addHabit({ ...f, days: [] }));
    // Backfill the last 90 days so the calendar + heatmap look alive.
    const today = new Date();
    added.forEach((h, i) => {
      const prob = fixtures[i].prob;
      for (let back = 90; back >= 1; back--) {
        const d = Utils.addDays(today, -back);
        if (Math.random() < prob) setCount(h.id, Utils.keyOf(d), 1);
      }
    });
    // A couple of nice visible streaks.
    for (let back = 0; back < 5; back++) setCount(added[1].id, Utils.keyOf(Utils.addDays(today, -back)), 1);
    for (let back = 0; back < 3; back++) setCount(added[0].id, Utils.keyOf(Utils.addDays(today, -back)), 1);
    save();
  }

  return {
    load, save,
    activeHabits, allHabits, getHabit, addHabit, updateHabit, deleteHabit,
    completionsFor, isDone, setCount, toggle, doneCount, dailySummary, countsByDay,
    streakFor, weekProgress, totalCompletions, statsOverview,
    exportJSON, importJSON, replaceWith, mergeWith, loadSample,
  };
})();