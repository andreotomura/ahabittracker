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

  const emptyDb = () => ({ version: 1, folders: [], habits: [], completions: {}, notes: {}, times: {} });

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        db = JSON.parse(raw);
        if (!Array.isArray(db.habits) || typeof db.completions !== 'object') db = emptyDb();
        else {
          if (!Array.isArray(db.folders)) db.folders = []; // pre-folders backups
          if (!db.notes || typeof db.notes !== 'object') db.notes = {}; // pre-notes backups
          if (!db.times || typeof db.times !== 'object') db.times = {}; // pre-timestamps backups
          // Drop folder references that no longer resolve (defensive).
          const ids = new Set(db.folders.map((f) => f && f.id));
          db.habits.forEach((h) => { if (h.folderId && !ids.has(h.folderId)) h.folderId = null; });
        }
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
      folderId: validFolderId(fields.folderId),
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
    if (patch.folderId !== undefined) h.folderId = validFolderId(patch.folderId);
    if (patch.archived != null) h.archived = !!patch.archived;
    save();
    return h;
  }

  /* ---------------- Folders ---------------- */

  /** Folders in display order (manual `sort`). */
  const folders = () => db.folders.slice().sort((a, b) => a.sort - b.sort);
  const getFolder = (id) => db.folders.find((f) => f.id === id) || null;
  /** A habit's folder id, or null when ungrouped / orphaned. */
  const validFolderId = (id) => {
    if (typeof id !== 'string' || !id) return null;
    return db.folders.some((f) => f.id === id) ? id : null;
  };

  function addFolder(fields) {
    const name = String((fields && fields.name) || '').trim().slice(0, 32);
    if (!name) return null;
    const folder = {
      id: 'f' + Utils.uid(),
      name,
      emoji: String((fields && fields.emoji) || '📁').slice(0, 8),
      sort: db.folders.length,
    };
    db.folders.push(folder);
    save();
    return folder;
  }

  function updateFolder(id, patch) {
    const f = getFolder(id);
    if (!f) return null;
    if (patch.name != null) {
      const n = String(patch.name).trim().slice(0, 32);
      if (n) f.name = n;
    }
    if (patch.emoji != null) f.emoji = String(patch.emoji).slice(0, 8);
    save();
    return f;
  }

  /** Remove a folder; its habits are kept and become ungrouped. */
  function deleteFolder(id) {
    db.folders = db.folders.filter((f) => f.id !== id);
    db.habits.forEach((h) => { if (h.folderId === id) h.folderId = null; });
    save();
  }

  /** Move a folder up (-1) or down (+1) in the manual order. */
  function moveFolder(id, dir) {
    const list = folders();
    const i = list.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    const t = a.sort;
    a.sort = b.sort;
    b.sort = t;
    save();
  }

  /** Reorder a habit within its own folder + archived state (manual order). */
  function moveHabit(id, dir) {
    const h = getHabit(id);
    if (!h) return;
    const group = db.habits
      .filter((x) => (x.folderId || null) === (h.folderId || null) && !!x.archived === !!h.archived)
      .sort((a, b) => a.sort - b.sort);
    const i = group.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= group.length) return;
    const a = group[i], b = group[j];
    const t = a.sort;
    a.sort = b.sort;
    b.sort = t;
    save();
  }

  function deleteHabit(id) {
    db.habits = db.habits.filter((h) => h.id !== id);
    delete db.completions[id];
    delete db.notes[id];
    delete db.times[id];
    save();
  }

  /* ---------------- Completions ---------------- */

  const completionsFor = (id) => db.completions[id] || {};
  const isDone = (id, key) => (completionsFor(id)[key] || 0) > 0;
  /** Raw count for a habit on a day (0 when absent). */
  const countFor = (id, key) => completionsFor(id)[key] || 0;

  function setCount(id, key, count) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    count = Math.max(0, parseInt(count, 10) || 0);
    const map = db.completions[id] || (db.completions[id] = {});
    if (count > 0) map[key] = count;
    else {
      delete map[key];
      if (!Object.keys(map).length) delete db.completions[id];
    }
    pruneTimes(id, key, count);
    save();
  }

  /* ---------------- Check-in times (time-of-day analytics) ---------------- */

  const timesFor = (id) => db.times[id] || {};
  /** Recorded check-in timestamps for a habit on a day (may be shorter than count). */
  const timesOn = (id, key) => (timesFor(id)[key] || []).slice();

  function pushTimeAt(id, key, ms) {
    const map = db.times[id] || (db.times[id] = {});
    (map[key] = map[key] || []).push(ms);
  }

  function clearTimes(id, key) {
    const map = db.times[id];
    if (!map) return;
    delete map[key];
    if (!Object.keys(map).length) delete db.times[id];
  }

  /** Keep times from outnumbering the count, or outliving a cleared day. */
  function pruneTimes(id, key, count) {
    const arr = timesFor(id)[key];
    if (!arr) return;
    if (count <= 0) clearTimes(id, key);
    else if (arr.length > count) arr.length = count;
  }

  /**
   * Check-in / undo for a habit on a given day. Live check-ins record the time;
   * backfilled days get no invented timestamp (honest data).
   */
  function toggle(id, key) {
    const wasDone = isDone(id, key);
    setCount(id, key, wasDone ? 0 : 1);
    if (!wasDone && key === Utils.todayKey()) { pushTimeAt(id, key, Date.now()); save(); }
  }

  /** Add one more check-in to a habit on a day (count-per-day). */
  function inc(id, key) {
    setCount(id, key, countFor(id, key) + 1);
    if (key === Utils.todayKey()) { pushTimeAt(id, key, Date.now()); save(); }
  }

  /** Remove one check-in; at 1 this un-dones the habit. */
  function dec(id, key) {
    setCount(id, key, countFor(id, key) - 1); // setCount also drops the newest recorded time
  }

  /* ---------------- Notes ---------------- */

  const notesFor = (id) => db.notes[id] || {};

  /** Note attached to a (habit, day) — optional plain text, max 240 chars. */
  function getNote(id, key) {
    return String(notesFor(id)[key] || '');
  }

  function setNote(id, key, text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    const t = String(text || '').trim().slice(0, 240);
    const map = db.notes[id] || (db.notes[id] = {});
    if (t) map[key] = t;
    else {
      delete map[key];
      if (!Object.keys(map).length) delete db.notes[id];
    }
    save();
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

  /** Per-habit counts for a range — raw check-in counts (feeds per-habit heatmaps). */
  function habitCountsByDay(id, startKey, endKey) {
    const counts = {};
    const c = completionsFor(id);
    for (const k in c) {
      if (k >= startKey && k <= endKey && c[k] > 0) counts[k] = c[k];
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

  /* ---------------- Analytics ---------------- */

  /** Weekday number for a Date: 1=Mon … 7=Sun. */
  const weekdayNum = (d) => ((d.getDay() + 6) % 7) + 1;

  /** A day is "scheduled" when the habit allows that weekday (empty days = any day). */
  const isScheduled = (h, d) => !h.days || !h.days.length || h.days.includes(weekdayNum(d));

  /**
   * First day that counts for a habit: the earlier of its creation date and
   * its earliest completion (backfills/sample data can predate creation).
   */
  function trackingStart(h) {
    let start = Utils.keyOf(new Date(h.createdAt || Date.now()));
    const comps = completionsFor(h.id);
    for (const k in comps) if (k < start) start = k;
    return start;
  }

  /** Completion over the `days` days ending at `endDate`, scheduled days only. */
  function windowRate(h, endDate, days) {
    const comps = completionsFor(h.id);
    const start = trackingStart(h);
    const today = Utils.todayKey();
    let done = 0, scheduled = 0;
    for (let i = 0; i < days; i++) {
      const d = Utils.addDays(endDate, -i);
      const key = Utils.keyOf(d);
      if (key < start || key > today) continue; // before tracking began / in the future
      if (!isScheduled(h, d)) continue;
      scheduled++;
      if (comps[key]) done++;
    }
    return { done, scheduled, rate: scheduled ? done / scheduled : 0 };
  }

  /**
   * Per-habit trend: a trailing 7-day completion rate sampled daily over the
   * last `days` days (trimmed to when the habit started), plus the current vs
   * previous window rate and a direction arrow.
   */
  function habitTrend(id, days = 30) {
    const h = getHabit(id);
    if (!h) return null;
    const today = new Date();
    const startDate = Utils.parseKey(trackingStart(h));
    const points = [];
    for (let i = days - 1; i >= 0; i--) {
      const end = Utils.addDays(today, -i);
      if (Utils.addDays(end, -6) < startDate) continue; // whole 7-day window predates the habit
      points.push(windowRate(h, end, 7).rate);
    }
    if (!points.length) points.push(windowRate(h, today, 7).rate);

    const cur = windowRate(h, today, days);
    const prev = windowRate(h, Utils.addDays(today, -days), days);
    const delta = cur.rate - prev.rate;
    const direction = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
    return { points, rate: cur.rate, prevRate: prev.rate, delta, direction };
  }

  /**
   * 0–100 explainable health score.
   *   target habits:    40% 30-day consistency + 30% weekly-target attainment + 30% streak
   *   no-target habits: 70% 30-day consistency + 30% streak
   */
  function healthScore(id) {
    const h = getHabit(id);
    if (!h) return null;
    const today = new Date();
    const c30 = windowRate(h, today, 30);
    const streak = streakFor(id).current;
    const streakScore = Math.min(streak, 14) / 14;

    let targetScore = c30.rate;
    if (h.target > 0) {
      // Average attainment over the last 4 complete Mon–Sun weeks.
      const monday = Utils.weekEnding(today)[0];
      const start = trackingStart(h);
      let sum = 0, n = 0;
      for (let w = 1; w <= 4; w++) {
        const m = Utils.addDays(monday, -7 * w);
        if (Utils.keyOf(m) < start) continue; // week predates tracking
        let d = 0;
        for (let i = 0; i < 7; i++) if (isDone(id, Utils.keyOf(Utils.addDays(m, i)))) d++;
        sum += Math.min(d / h.target, 1);
        n++;
      }
      if (n) targetScore = sum / n;
    }

    const score = h.target > 0
      ? 0.4 * c30.rate + 0.3 * targetScore + 0.3 * streakScore
      : 0.7 * c30.rate + 0.3 * streakScore;

    return {
      score: Math.round(score * 100),
      consistency: Math.round(c30.rate * 100),
      target: Math.round(targetScore * 100),
      streak: Math.round(streakScore * 100),
      streakDays: streak,
      hasTarget: h.target > 0,
    };
  }

  /** Completion rate per weekday (1=Mon…7=Sun) over the last `weeks` weeks. */
  function weekdayRates(weeks = 12) {
    const out = Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, done: 0, scheduled: 0, rate: 0 }));
    const today = new Date();
    for (const h of activeHabits()) {
      const comps = completionsFor(h.id);
      const start = trackingStart(h);
      for (let i = 0; i < weeks * 7; i++) {
        const d = Utils.addDays(today, -i);
        const key = Utils.keyOf(d);
        if (key < start || key > Utils.todayKey()) continue;
        if (!isScheduled(h, d)) continue;
        const slot = out[weekdayNum(d) - 1];
        slot.scheduled++;
        if (comps[key]) slot.done++;
      }
    }
    out.forEach((s) => { s.rate = s.scheduled ? s.done / s.scheduled : 0; });
    return out;
  }

  /** Overall trailing 7-day completion rate sampled daily (all active habits). */
  function overallTrend(days = 30) {
    const habits = activeHabits();
    const today = new Date();
    const rateAt = (end) => {
      let done = 0, scheduled = 0;
      for (const h of habits) {
        const r = windowRate(h, end, 7);
        done += r.done;
        scheduled += r.scheduled;
      }
      return scheduled ? done / scheduled : 0;
    };
    const points = [];
    for (let i = days - 1; i >= 0; i--) points.push(rateAt(Utils.addDays(today, -i)));
    return points;
  }

  /** Aggregate highlights for the Stats view. */
  function insights() {
    const habits = activeHabits();
    const wd = weekdayRates(12).filter((s) => s.scheduled > 0);
    let bestDay = null, worstDay = null;
    for (const s of wd) {
      if (!bestDay || s.rate > bestDay.rate) bestDay = s;
      if (!worstDay || s.rate < worstDay.rate) worstDay = s;
    }

    let mostConsistent = null;
    let avgHealth = 0;
    const today = new Date();
    if (habits.length) {
      for (const h of habits) {
        const r = windowRate(h, today, 30);
        if (r.scheduled > 0 && (!mostConsistent || r.rate > mostConsistent.rate)) {
          mostConsistent = { name: h.name, emoji: h.emoji, color: h.color, rate: r.rate };
        }
        avgHealth += (healthScore(h.id) || { score: 0 }).score;
      }
      avgHealth = Math.round(avgHealth / habits.length);
    }

    // Longest current quiet stretch (days since last check-in), 3+ days only.
    let gap = null;
    const todayMid = Utils.parseKey(Utils.todayKey());
    for (const h of habits) {
      const comps = completionsFor(h.id);
      let last = null;
      for (const k in comps) if (!last || k > last) last = k;
      if (!last) continue;
      const days = Math.round((todayMid - Utils.parseKey(last)) / 86400000);
      if (days >= 3 && (!gap || days > gap.days)) gap = { days, name: h.name, emoji: h.emoji };
    }

    return { bestDay, worstDay, mostConsistent, avgHealth, gap };
  }

  /* ---------------- Time-of-day analytics ---------------- */

  const PERIODS = [
    { id: 'morning', label: 'mornings', from: 5, to: 11 },
    { id: 'afternoon', label: 'afternoons', from: 12, to: 16 },
    { id: 'evening', label: 'evenings', from: 17, to: 21 },
    { id: 'night', label: 'nights', from: 22, to: 4 },
  ];

  const periodOf = (hour) => {
    for (const p of PERIODS) {
      if (p.from <= p.to ? hour >= p.from && hour <= p.to : hour >= p.from || hour <= p.to) return p.id;
    }
    return 'night';
  };

  /** 24-bucket histogram of recorded check-in hours (all active habits, or one). */
  function hourHistogram(id) {
    const hours = new Array(24).fill(0);
    const scan = (map) => {
      for (const k in map) {
        for (const t of map[k]) {
          const h = new Date(t).getHours();
          if (h >= 0 && h < 24) hours[h]++;
        }
      }
    };
    if (id) scan(timesFor(id));
    else for (const h of activeHabits()) scan(timesFor(h.id));
    return hours;
  }

  /** Time-of-day summary built from recorded timestamps (empty until people check in live). */
  function timeOfDay(id) {
    const hours = hourHistogram(id);
    const total = hours.reduce((a, b) => a + b, 0);
    const counts = {};
    PERIODS.forEach((p) => (counts[p.id] = 0));
    hours.forEach((n, h) => { counts[periodOf(h)] += n; });

    let peakPeriod = null;
    for (const p of PERIODS) if (peakPeriod === null || counts[p.id] > counts[peakPeriod]) peakPeriod = p.id;

    // Busiest hour *within* the peak period, so the two highlights agree.
    let peakHour = null, peakHourCount = 0;
    if (total) {
      hours.forEach((n, h) => {
        if (periodOf(h) === peakPeriod && n > peakHourCount) { peakHourCount = n; peakHour = h; }
      });
    }

    return {
      hours,
      total,
      counts,
      peakHour,
      peakPeriod: total ? peakPeriod : null,
      peakPeriodLabel: total ? (PERIODS.find((p) => p.id === peakPeriod) || {}).label : null,
      byPeriod: PERIODS.map((p) => ({ ...p, count: counts[p.id] })),
    };
  }

  /** Dominant time-of-day period for one habit, or null without timestamps. */
  function habitPeakPeriod(id) {
    const tod = timeOfDay(id);
    return tod.total ? { id: tod.peakPeriod, label: tod.peakPeriodLabel, count: tod.total } : null;
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
      const folders = [];
      if (Array.isArray(data.folders)) {
        const seenF = new Set();
        data.folders.forEach((f, i) => {
          if (!f || typeof f.id !== 'string' || !f.id || typeof f.name !== 'string') return;
          if (seenF.has(f.id)) return;
          seenF.add(f.id);
          folders.push({
            id: f.id,
            name: String(f.name).trim().slice(0, 32),
            emoji: String(f.emoji || '📁').slice(0, 8),
            sort: Number.isFinite(Number(f.sort)) ? Number(f.sort) : i,
          });
        });
      }
      const folderIds = new Set(folders.map((f) => f.id));

      const habits = data.habits
        .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
        .map((h) => ({
          id: h.id,
          name: String(h.name).slice(0, 48),
          emoji: String(h.emoji || '⭐').slice(0, 8),
          color: /^#[0-9a-f]{6}$/i.test(h.color || '') ? h.color : '#6d5df6',
          target: Utils.clamp(parseInt(h.target, 10) || 0, 0, 7),
          days: Array.isArray(h.days) ? h.days.filter((d) => d >= 1 && d <= 7) : [],
          folderId: folderIds.has(h.folderId) ? h.folderId : null,
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
      const notes = {};
      if (data.notes && typeof data.notes === 'object') {
        const known = new Set(habits.map((h) => h.id));
        for (const hid in data.notes) {
          if (!known.has(hid)) continue;
          const nm = data.notes[hid];
          if (!nm || typeof nm !== 'object') continue;
          const out = {};
          for (const k in nm) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
              const v = String(nm[k]).trim().slice(0, 240);
              if (v) out[k] = v;
            }
          }
          if (Object.keys(out).length) notes[hid] = out;
        }
      }
      const times = {};
      if (data.times && typeof data.times === 'object') {
        const known = new Set(habits.map((h) => h.id));
        for (const hid in data.times) {
          if (!known.has(hid)) continue;
          const tm = data.times[hid];
          if (!tm || typeof tm !== 'object') continue;
          const out = {};
          for (const k in tm) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
            const arr = Array.isArray(tm[k])
              ? tm[k].filter((n) => Number.isFinite(n) && n > 0).slice(0, 100)
              : [];
            if (arr.length) out[k] = arr;
          }
          if (Object.keys(out).length) times[hid] = out;
        }
      }
      return { ok: true, db: { version: 1, folders, habits, completions, notes, times } };
    } catch (_e) {
      return { ok: false, error: 'Could not read the file — invalid JSON.' };
    }
  }

  function replaceWith(db2) {
    // Normalise: callers (import, tests) may omit optional maps.
    db = Object.assign(emptyDb(), db2);
    if (!Array.isArray(db.folders)) db.folders = [];
    if (!db.notes || typeof db.notes !== 'object') db.notes = {};
    if (!db.times || typeof db.times !== 'object') db.times = {};
    save();
  }

  function mergeWith(db2) {
    const byFolder = {};
    db.folders.forEach((f) => (byFolder[f.id] = f));
    for (const f of db2.folders || []) {
      if (!byFolder[f.id]) {
        byFolder[f.id] = f;
        db.folders.push(f);
      }
    }
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
    for (const hid in db2.notes || {}) {
      const cur = db.notes[hid] || (db.notes[hid] = {});
      for (const k in db2.notes[hid]) {
        if (!(k in cur)) cur[k] = db2.notes[hid][k]; // gap-fill only, never clobber
      }
    }
    for (const hid in db2.times || {}) {
      const cur = db.times[hid] || (db.times[hid] = {});
      for (const k in db2.times[hid]) {
        if (!(k in cur)) cur[k] = db2.times[hid][k].slice();
      }
    }
    save();
  }

  /* ---------------- Sample data (first-run helper) ---------------- */

  function loadSample() {
    const folders = [
      addFolder({ name: 'Health', emoji: '💪' }),
      addFolder({ name: 'Studies', emoji: '📚' }),
      addFolder({ name: 'Mind', emoji: '🧘' }),
    ];
    const fixtures = [
      { name: 'Drink water', emoji: '💧', color: '#3b82f6', target: 7, prob: 0.85, folderId: folders[0].id },
      { name: 'Read 20 pages', emoji: '📚', color: '#8b5cf6', target: 5, prob: 0.8, folderId: folders[1].id },
      { name: 'Exercise', emoji: '🏃', color: '#f97316', target: 4, prob: 0.55, folderId: folders[0].id },
      { name: 'Meditate', emoji: '🧘', color: '#10b981', target: 6, prob: 0.7, folderId: folders[2].id },
      { name: 'No sugar', emoji: '🍎', color: '#ec4899', target: 5, prob: 0.6, folderId: folders[0].id },
    ];
    const added = fixtures.map((f) => addHabit({ ...f, days: [] }));
    // Backfill the last 90 days so the calendar + heatmap look alive.
    const today = new Date();
    const baseHours = [8, 21, 18, 7, 20]; // plausible peak hour per habit (time-of-day demo)
    added.forEach((h, i) => {
      const prob = fixtures[i].prob;
      const hour = baseHours[i % baseHours.length];
      for (let back = 90; back >= 1; back--) {
        const d = Utils.addDays(today, -back);
        if (Math.random() < prob) {
          const key = Utils.keyOf(d);
          setCount(h.id, key, 1);
          const at = new Date(d);
          at.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
          pushTimeAt(h.id, key, at.getTime());
        }
      }
    });
    // A couple of nice visible streaks.
    for (let back = 0; back < 5; back++) setCount(added[1].id, Utils.keyOf(Utils.addDays(today, -back)), 1);
    for (let back = 0; back < 3; back++) setCount(added[0].id, Utils.keyOf(Utils.addDays(today, -back)), 1);
    // A few sample notes so the notes feature is discoverable.
    setNote(added[0].id, Utils.keyOf(today), '2L so far 💪');
    setNote(added[1].id, Utils.keyOf(Utils.addDays(today, -1)), 'Chapter 3 — the plot thickens!');
    setNote(added[2].id, Utils.keyOf(Utils.addDays(today, -2)), '5 km run 🏃♂️');
    setCount(added[0].id, Utils.keyOf(today), 3); // demo: multiple check-ins in one day
    [8, 10, 14].forEach((h) => {
      const at = new Date(today);
      at.setHours(h, 30, 0, 0);
      pushTimeAt(added[0].id, Utils.keyOf(today), at.getTime());
    });
    save();
  }

  return {
    load, save,
    activeHabits, allHabits, getHabit, addHabit, updateHabit, deleteHabit, moveHabit,
    folders, getFolder, addFolder, updateFolder, deleteFolder, moveFolder,
    completionsFor, isDone, countFor, setCount, toggle, inc, dec,
    timesFor, timesOn,
    doneCount, dailySummary, countsByDay, habitCountsByDay,
    getNote, setNote,
    streakFor, weekProgress, totalCompletions, statsOverview,
    habitTrend, healthScore, weekdayRates, overallTrend, insights,
    hourHistogram, timeOfDay, habitPeakPeriod,
    exportJSON, importJSON, replaceWith, mergeWith, loadSample,
  };
})();