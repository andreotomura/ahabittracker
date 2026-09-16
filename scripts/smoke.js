// Smoke test: runs the app logic in Node with a minimal DOM stub.
'use strict';
const fs = require('fs');
const path = require('path');

function fakeEl() {
  return {
    children: [], attrs: {}, style: {},
    className: '', textContent: '', value: '',
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; },
    getAttribute() { return null; },
    addEventListener() {},
    append(...n) { this.children.push(...n); },
    appendChild(n) { this.children.push(n); return n; },
    contains() { return false; },
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    click() {}, remove() {}, focus() {},
  };
}

global.window = global;
const els = {}; // memoized querySelector targets so tests can inspect rendered innerHTML
global.localStorage = {
  _s: {},
  setItem(k, v) { this._s[k] = v; },
  getItem(k) { return k in this._s ? this._s[k] : null; },
  removeItem(k) { delete this._s[k]; },
};
global.document = {
  createElement: () => fakeEl(),
  createTextNode: (t) => ({ nodeType: 3, textContent: t }),
  createDocumentFragment: () => fakeEl(),
  querySelector: (sel) => (els[sel] = els[sel] || fakeEl()),
  querySelectorAll: () => [],
  addEventListener() {},
  body: fakeEl(),
  documentElement: fakeEl(),
};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class {};
global.matchMedia = () => ({ matches: false });
global.requestAnimationFrame = (fn) => fn();

const src = path.join(__dirname, '..', 'src', 'js');
const all = ['utils.js', 'ui.js', 'store.js', 'render.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(src, f), 'utf8'))
  .join('\n')
  // in Node the namespaces need to be real globals, not eval-local consts
  .replace(/^const (Utils|UI|Store|Render|App) =/gm, 'globalThis.$1 =');
(0, eval)(all);

const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✓ ' + msg); };

console.log('— store basics —');
Store.load();
const h = Store.addHabit({ name: 'Meditate', emoji: '🧘', color: '#10b981', target: 6 });
assert(h && h.id, 'addHabit returns habit with id');
assert(Store.activeHabits().length === 1, 'activeHabits lists it');
assert(Store.isDone(h.id, Utils.todayKey()) === false, 'not done today yet');

console.log('— toggle & count —');
Store.toggle(h.id, Utils.todayKey());
assert(Store.isDone(h.id, Utils.todayKey()), 'toggle marks done');
assert(Store.doneCount(Utils.todayKey()) === 1, 'doneCount reflects it');
Store.toggle(h.id, Utils.todayKey());
assert(!Store.isDone(h.id, Utils.todayKey()), 'toggle undoes');

console.log('— notes —');
assert(Store.getNote(h.id, Utils.todayKey()) === '', 'no note by default');
Store.setNote(h.id, Utils.todayKey(), '  deep breaths 🧘 ');
assert(Store.getNote(h.id, Utils.todayKey()) === 'deep breaths 🧘', 'setNote trims and stores');
Store.setNote(h.id, Utils.todayKey(), 'x'.repeat(300));
assert(Store.getNote(h.id, Utils.todayKey()).length === 240, 'notes capped at 240 chars');
Store.setNote(h.id, Utils.todayKey(), '');
assert(Store.getNote(h.id, Utils.todayKey()) === '', 'empty note clears the entry');
Store.setNote(h.id, 'not-a-date', 'nope');
assert(Store.getNote(h.id, 'not-a-date') === '', 'invalid date keys rejected');
assert(Store.getNote('ghost-id', Utils.todayKey()) === '', 'getNote safe for unknown habits');

console.log('— streaks —');
const y = Utils.addDays(new Date(), -1).getFullYear() - 1;
// create a run of 3 consecutive days ending today
const s1 = new Date();
for (let i = 0; i < 3; i++) Store.setCount(h.id, Utils.keyOf(Utils.addDays(s1, -i)), 1);
let st = Store.streakFor(h.id);
assert(st.current === 3, `current streak = 3 (got ${st.current})`);
assert(st.best === 3, `best streak = 3 (got ${st.best})`);
// 2-day older run (gap at -3) must NOT beat the current 3-day run
Store.setCount(h.id, Utils.keyOf(Utils.addDays(s1, -4)), 1);
Store.setCount(h.id, Utils.keyOf(Utils.addDays(s1, -5)), 1);
st = Store.streakFor(h.id);
assert(st.best === 3, `best stays 3 with weaker older run (got ${st.best})`);
assert(st.current === 3, `current still 3`);

console.log('— week progress —');
const wp = Store.weekProgress(h.id);
assert(wp && wp.target === 6 && wp.done >= 1, 'weekProgress counts this week (done=' + wp.done + ')');

console.log('— aggregations —');
const months = Store.dailySummary(new Date().getFullYear(), new Date().getMonth());
assert(Object.keys(months).length >= 1, 'dailySummary has entries for this month');
const counts = Store.countsByDay(Utils.keyOf(Utils.addDays(s1, -6)), Utils.todayKey());
assert(Object.values(counts).reduce((a, b) => a + b, 0) === 5, 'countsByDay sums correctly over range');
const ov = Store.statsOverview();
assert(ov.total === 5 && ov.daysTracked === 5, `statsOverview total + daysTracked (got ${ov.total}/${ov.daysTracked})`);
assert(typeof ov.rate7 === 'number', 'statsOverview rate7');
assert(ov.best.days >= 3 && ov.best.name === 'Meditate', 'statsOverview best streak habit');

console.log('— backup round trip —');
Store.exportJSON(); // just ensure no throw
const crafted = JSON.stringify({
  version: 1,
  habits: [{ id: 'zz1', name: 'Import me', emoji: '🚀', color: 'bad', target: 9, days: [0, 1, 8], createdAt: 1, archived: false, sort: 0 }],
  completions: { zz1: { '2025-01-02': 3, 'nope': 5 } },
  notes: { zz1: { '2025-01-02': '  keep this note ', 'nope': 'bad' }, ghost: { '2025-01-02': 'drop me' } },
});
const parsed = Store.importJSON(crafted);
assert(parsed.ok, 'importJSON accepts valid file');
assert(parsed.db.habits[0].color === '#6d5df6', 'bad color sanitized to default');
assert(parsed.db.habits[0].target === 7, 'target clamped to 7');
assert(parsed.db.habits[0].days.length === 1 && parsed.db.habits[0].days[0] === 1, 'invalid days filtered (0 and 8 dropped)');
assert(parsed.db.completions.zz1['2025-01-02'] === 3 && !('nope' in parsed.db.completions.zz1), 'completions filtered');
assert(parsed.db.notes.zz1['2025-01-02'] === 'keep this note', 'notes trimmed and kept for known habits');
assert(!('nope' in parsed.db.notes.zz1) && !('ghost' in parsed.db.notes), 'notes filtered (bad keys, unknown habits)');
const bad = Store.importJSON('not json');
assert(!bad.ok, 'importJSON rejects garbage');
const mergedBefore = Store.totalCompletions();
Store.mergeWith(parsed.db);
assert(Store.totalCompletions() === mergedBefore + 3, 'merge adds new completions');
assert(Store.getNote('zz1', '2025-01-02') === 'keep this note', 'merge fills note gaps');
Store.replaceWith(parsed.db);
assert(Store.activeHabits().length === 1 && Store.getHabit('zz1').name === 'Import me', 'replace wipes + restores');
assert(Store.getNote('zz1', '2025-01-02') === 'keep this note', 'replace restores notes');

console.log('— rendering —');
Store.loadSample();
assert(Store.activeHabits().length > 0, 'sample data loads');
const water = Store.activeHabits().find((x) => x.name === 'Drink water');
assert(Store.getNote(water.id, Utils.todayKey()) === '2L so far 💪', 'sample data includes a note for today');

console.log('— analytics —');
// Deterministic: a fresh habit checked in for each of the last 10 days.
const perf = Store.addHabit({ name: 'Perfect', emoji: '🎯', color: '#10b981', target: 7 });
for (let i = 0; i < 10; i++) Store.setCount(perf.id, Utils.keyOf(Utils.addDays(new Date(), -i)), 1);
const pTrend = Store.habitTrend(perf.id, 30);
assert(pTrend && pTrend.points.length >= 2 && pTrend.points.length <= 30, 'habitTrend returns a trimmed point series');
assert(pTrend.rate === 1, `perfect habit 30-day rate is 1 (got ${pTrend.rate})`);
assert(pTrend.direction !== 'down', 'perfect habit is not slipping');
const pHealth = Store.healthScore(perf.id);
assert(pHealth.score >= 90, `perfect habit health is high (got ${pHealth.score})`);
assert(pHealth.streakDays >= 10 && pHealth.consistency === 100, 'healthScore exposes streak + consistency');
assert(pHealth.hasTarget && typeof pHealth.target === 'number', 'healthScore explains target attainment');

const trend = Store.habitTrend(Store.activeHabits()[0].id, 30);
assert(trend && trend.points.length >= 2, 'habitTrend works on sample habits');
assert(['up', 'down', 'flat'].includes(trend.direction), 'habitTrend direction is valid');
const hs = Store.healthScore(Store.activeHabits()[0].id);
assert(hs && hs.score >= 0 && hs.score <= 100, `healthScore in 0–100 (got ${hs && hs.score})`);
assert(typeof hs.streak === 'number', 'healthScore has explainable parts');

const wdr = Store.weekdayRates(12);
assert(wdr.length === 7 && wdr.every((r) => r.rate >= 0 && r.rate <= 1), 'weekdayRates returns 7 fractions');
assert(wdr.every((r) => r.scheduled === 0 || r.rate === r.done / r.scheduled), 'weekdayRates rates match counts');
const overall = Store.overallTrend(30);
assert(overall.length === 30 && overall.every((v) => v >= 0 && v <= 1), 'overallTrend returns 30 fractions');
const ins = Store.insights();
assert(ins && ins.avgHealth >= 0 && ins.avgHealth <= 100, `insights avgHealth in range (got ${ins && ins.avgHealth})`);
assert(!ins.bestDay || !ins.worstDay || ins.bestDay.rate >= ins.worstDay.rate, 'best weekday ≥ worst weekday');
assert(ins.mostConsistent && ins.mostConsistent.rate >= 0, 'insights finds a most-consistent habit');

Render.renderToday();
assert(document.querySelector('#view-today').innerHTML.includes('note-field'), 'Today rows render note inputs when done');
Render.renderCalendar(0);
Render.renderStats();
Render.renderHabits();
App.openEditor();
App.openEditor(Store.activeHabits()[0].id);
App.openDay(Utils.todayKey());
assert(true, 'all views + modals render without throwing');
App.switchTab('stats');
App.switchTab('calendar');
assert(true, 'tab switching works');

console.log('\n✅ All smoke tests passed');