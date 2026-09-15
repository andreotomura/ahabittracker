/*
 * utils.js — small, dependency-free helpers (dates, ids, escaping).
 * Attaches to the global `Utils` namespace.
 */
'use strict';

const Utils = (() => {
  const pad = (n) => String(n).padStart(2, '0');

  /** Local date → 'YYYY-MM-DD' */
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => keyOf(new Date());
  /** 'YYYY-MM-DD' → local Date at midnight */
  const parseKey = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

  /** Returns a week array ending at `end` (inclusive), anchored to Monday. */
  const weekEnding = (end) => {
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const day = (e.getDay() + 6) % 7; // Monday = 0
    const start = addDays(e, -day);
    const week = [];
    for (let i = 0; i < 7; i++) week.push(addDays(start, i));
    return week;
  };

  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const fmtDayTitle = (k) => {
    const d = parseKey(k);
    return `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  };
  const fmtDayShort = (k) => {
    const d = parseKey(k);
    return `${WD[d.getDay()]} ${d.getDate()}`;
  };
  const monthTitle = (y, m) => `${MONTHS_FULL[m]} ${y}`;

  /** 6×7 month matrix starting on Monday; cells: {date, key, inMonth} */
  const monthMatrix = (year, month) => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday = 0
    const start = addDays(first, -offset);
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, w * 7 + i);
        week.push({ date: d, key: keyOf(d), inMonth: d.getMonth() === month });
      }
      weeks.push(week);
    }
    return weeks;
  };

  const uid = () =>
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  /** Escape a string for safe injection into HTML. */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return {
    keyOf, todayKey, parseKey, addDays, addMonths, weekEnding,
    fmtDayTitle, fmtDayShort, monthTitle, monthMatrix,
    uid, esc, clamp, plural, WD, MON,
  };
})();