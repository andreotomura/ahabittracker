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
  querySelector: () => fakeEl(),
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
});
const parsed = Store.importJSON(crafted);
assert(parsed.ok, 'importJSON accepts valid file');
assert(parsed.db.habits[0].color === '#6d5df6', 'bad color sanitized to default');
assert(parsed.db.habits[0].target === 7, 'target clamped to 7');
assert(parsed.db.habits[0].days.length === 1 && parsed.db.habits[0].days[0] === 1, 'invalid days filtered (0 and 8 dropped)');
assert(parsed.db.completions.zz1['2025-01-02'] === 3 && !('nope' in parsed.db.completions.zz1), 'completions filtered');
const bad = Store.importJSON('not json');
assert(!bad.ok, 'importJSON rejects garbage');
const mergedBefore = Store.totalCompletions();
Store.mergeWith(parsed.db);
assert(Store.totalCompletions() === mergedBefore + 3, 'merge adds new completions');
Store.replaceWith(parsed.db);
assert(Store.activeHabits().length === 1 && Store.getHabit('zz1').name === 'Import me', 'replace wipes + restores');

console.log('— rendering —');
Store.loadSample();
assert(Store.activeHabits().length > 0, 'sample data loads');
Render.renderToday();
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