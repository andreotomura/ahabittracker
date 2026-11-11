// Smoke test: runs the app logic in Node with a minimal DOM stub.
'use strict';
const fs = require('fs');
const path = require('path');
const icons = require('./icons.js');
const pwa = require('./pwa.js');

function fakeEl() {
  return {
    children: [], attrs: {}, style: { setProperty() {}, removeProperty() {} }, dataset: {},
    className: '', textContent: '', value: '', innerHTML: '',
    classList: { toggle() {}, add() {}, remove() {}, contains() { return true; } },
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; },
    getAttribute() { return null; },
    addEventListener() {},
    append(...n) { this.children.push(...n); },
    appendChild(n) { this.children.push(n); return n; },
    contains() { return false; },
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    click() {}, remove() {}, focus() {}, replaceWith() {},
  };
}

global.window = global;
global.addEventListener = () => {};
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
const all = ['utils.js', 'ui.js', 'store.js', 'prefs.js', 'render.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(src, f), 'utf8'))
  .join('\n')
  // in Node the namespaces need to be real globals, not eval-local consts
  .replace(/^const (Utils|UI|Store|Prefs|Render|App) =/gm, 'globalThis.$1 =');
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

console.log('— multi check-ins —');
assert(Store.countFor(h.id, Utils.todayKey()) === 0, 'countFor reads 0 when absent');
Store.setCount(h.id, Utils.todayKey(), 2);
assert(Store.countFor(h.id, Utils.todayKey()) === 2 && Store.isDone(h.id, Utils.todayKey()), 'count ≥ 1 counts as done');
Store.inc(h.id, Utils.todayKey());
assert(Store.countFor(h.id, Utils.todayKey()) === 3, 'inc adds a check-in');
Store.dec(h.id, Utils.todayKey());
Store.dec(h.id, Utils.todayKey());
assert(Store.countFor(h.id, Utils.todayKey()) === 1, 'dec removes one at a time');
Store.dec(h.id, Utils.todayKey());
assert(Store.countFor(h.id, Utils.todayKey()) === 0 && !Store.isDone(h.id, Utils.todayKey()), 'dec at 1 un-dones the habit');
Store.inc(h.id, Utils.todayKey());
Store.inc(h.id, Utils.todayKey());
assert(Store.countFor(h.id, Utils.todayKey()) === 2, 'inc works from zero too');
Store.toggle(h.id, Utils.todayKey());
assert(Store.countFor(h.id, Utils.todayKey()) === 0, 'toggle fully undoes a multi count');

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

console.log('— check-in times —');
const tk = Utils.todayKey();
Store.setCount(h.id, tk, 0);
Store.toggle(h.id, tk);
assert(Store.timesOn(h.id, tk).length === 1, 'toggle records a timestamp');
Store.inc(h.id, tk);
assert(Store.timesOn(h.id, tk).length === 2, 'inc records another timestamp');
Store.dec(h.id, tk);
assert(Store.timesOn(h.id, tk).length === 1 && Store.countFor(h.id, tk) === 1, 'dec drops a timestamp');
Store.inc(h.id, tk);
Store.toggle(h.id, tk); // undo all
assert(Store.countFor(h.id, tk) === 0 && Store.timesOn(h.id, tk).length === 0, 'undo clears timestamps');
Store.setCount(h.id, '2020-01-01', 1);
assert(Store.timesOn(h.id, '2020-01-01').length === 0, 'backfilled days have no invented timestamps');
Store.setCount(h.id, '2020-01-01', 0);

console.log('— backup round trip —');
Store.exportJSON(); // just ensure no throw
const crafted = JSON.stringify({
  version: 1,
  habits: [{ id: 'zz1', name: 'Import me', emoji: '🚀', color: 'bad', target: 9, days: [0, 1, 8], createdAt: 1, archived: false, sort: 0 }],
  completions: { zz1: { '2025-01-02': 3, 'nope': 5 } },
  notes: { zz1: { '2025-01-02': '  keep this note ', 'nope': 'bad' }, ghost: { '2025-01-02': 'drop me' } },
  times: { zz1: { '2025-01-02': [1700000000000, 1700003600000], 'nope': [1] }, ghost: { '2025-01-02': [1700000000000] } },
});
const parsed = Store.importJSON(crafted);
assert(parsed.ok, 'importJSON accepts valid file');
assert(parsed.db.habits[0].color === '#6d5df6', 'bad color sanitized to default');
assert(parsed.db.habits[0].target === 7, 'target clamped to 7');
assert(parsed.db.habits[0].days.length === 1 && parsed.db.habits[0].days[0] === 1, 'invalid days filtered (0 and 8 dropped)');
assert(parsed.db.completions.zz1['2025-01-02'] === 3 && !('nope' in parsed.db.completions.zz1), 'completions filtered');
assert(parsed.db.notes.zz1['2025-01-02'] === 'keep this note', 'notes trimmed and kept for known habits');
assert(!('nope' in parsed.db.notes.zz1) && !('ghost' in parsed.db.notes), 'notes filtered (bad keys, unknown habits)');
assert(parsed.db.times.zz1['2025-01-02'].length === 2, 'times kept for known habit + valid date');
assert(!('nope' in parsed.db.times.zz1) && !('ghost' in parsed.db.times), 'times filtered (bad keys, unknown habits)');
const bad = Store.importJSON('not json');
assert(!bad.ok, 'importJSON rejects garbage');
const mergedBefore = Store.totalCompletions();
Store.mergeWith(parsed.db);
assert(Store.totalCompletions() === mergedBefore + 3, 'merge adds new completions');
assert(Store.getNote('zz1', '2025-01-02') === 'keep this note', 'merge fills note gaps');
assert(Store.timesOn('zz1', '2025-01-02').length === 2, 'merge fills time gaps');
Store.replaceWith(parsed.db);
assert(Store.activeHabits().length === 1 && Store.getHabit('zz1').name === 'Import me', 'replace wipes + restores');
assert(Store.getNote('zz1', '2025-01-02') === 'keep this note', 'replace restores notes');
assert(Store.timesOn('zz1', '2025-01-02').length === 2, 'replace restores times');

console.log('— rendering —');
Store.loadSample();
assert(Store.activeHabits().length > 0, 'sample data loads');
const water = Store.activeHabits().find((x) => x.name === 'Drink water');
assert(Store.getNote(water.id, Utils.todayKey()) === '2L so far 💪', 'sample data includes a note for today');
assert(Store.countFor(water.id, Utils.todayKey()) === 3, 'sample data demos a multi-check-in day');
const hcbd = Store.habitCountsByDay(water.id, Utils.keyOf(Utils.addDays(new Date(), -90)), Utils.todayKey());
assert(Object.keys(hcbd).length > 0 && Object.values(hcbd).every((n) => n > 0), 'habitCountsByDay returns positive per-habit counts');

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

console.log('— time of day —');
const tod = Store.timeOfDay();
assert(tod.hours.length === 24 && tod.total > 0, 'timeOfDay builds a 24-hour histogram from sample data');
assert(tod.peakPeriod && tod.peakPeriodLabel, 'timeOfDay reports a peak period');
assert(tod.byPeriod.length === 4 && tod.byPeriod.reduce((a, p) => a + p.count, 0) === tod.total, 'period counts sum to the total');
assert(Store.hourHistogram().length === 24, 'hourHistogram has 24 buckets');
assert(Store.habitPeakPeriod(Store.activeHabits()[0].id), 'per-habit peak period available from sample timestamps');

Render.renderToday();
assert(document.querySelector('#view-today').innerHTML.includes('note-field'), 'Today rows render note inputs when done');
assert(document.querySelector('#view-today').innerHTML.includes('step-btn') && document.querySelector('#view-today').innerHTML.includes('×3'), 'Today rows render count steppers with the right total');
Render.renderCalendar(0);
Render.renderStats();
assert(document.querySelector('#view-stats').innerHTML.includes('Time of day'), 'Stats renders the time-of-day card');
assert(document.querySelector('#view-stats').innerHTML.includes('Habit history') && document.querySelector('#view-stats').innerHTML.includes('hheat-card'), 'Stats renders per-habit heatmaps with the habit-colour ramp');
Render.renderHabits();
App.openEditor();
App.openEditor(Store.activeHabits()[0].id);
App.openDay(Utils.todayKey());
assert(true, 'all views + modals render without throwing');
App.switchTab('stats');
App.switchTab('calendar');
assert(true, 'tab switching works');

console.log('— polish / empty states —');
// Welcome card: shown for new users with habits, respects the dismissal flag.
App.switchTab('today');
assert(document.querySelector('#view-today').innerHTML.includes('welcome'), 'welcome card shows on Today for new users');
localStorage.setItem('ahabit.welcome.v1', '1');
App.switchTab('stats');
App.switchTab('today');
assert(!document.querySelector('#view-today').innerHTML.includes('welcome'), 'welcome card stays dismissed');
localStorage.removeItem('ahabit.welcome.v1');
// Direct render flag also controls it.
Render.renderToday(true);
assert(document.querySelector('#view-today').innerHTML.includes('dismiss-welcome'), 'Render.renderToday(true) includes the dismiss action');
Render.renderToday(false);
assert(!document.querySelector('#view-today').innerHTML.includes('welcome'), 'Render.renderToday(false) hides the welcome card');

// Empty-database states (no active habits, no history).
Store.replaceWith({ version: 1, habits: [], completions: {}, notes: {} });
Render.renderStats();
const statsHtml = document.querySelector('#view-stats').innerHTML;
assert(statsHtml.includes('No data to analyse') && !statsHtml.includes('Activity heatmap'), 'Stats shows a single empty state (no charts) with no habits');
Render.renderCalendar(0);
assert(true, 'calendar renders with no habits');
App.openDay(Utils.todayKey());
assert(true, 'empty day modal renders without throwing');
Store.loadSample();
assert(Store.activeHabits().length > 0, 'sample data reloads after empty-state tests');

console.log('— folders —');
assert(Store.folders().length === 3, 'sample data creates folders');
const health = Store.folders().find((f) => f.name === 'Health');
assert(health && health.emoji, 'folder has id/name/emoji');
assert(Store.activeHabits().filter((h) => h.folderId === health.id).length === 3, 'habits are grouped in a folder');

// CRUD.
const f2 = Store.addFolder({ name: '  Work  ', emoji: '💼' });
assert(f2 && f2.name === 'Work', 'addFolder trims the name');
assert(!Store.addFolder({ name: '   ' }), 'addFolder rejects an empty name');
Store.updateFolder(f2.id, { name: 'Career', emoji: '📈' });
assert(Store.getFolder(f2.id).name === 'Career' && Store.getFolder(f2.id).emoji === '📈', 'updateFolder patches fields');
Store.moveFolder(f2.id, -1);
assert(Store.folders().findIndex((x) => x.id === f2.id) === 2, 'moveFolder reorders upward');
Store.moveFolder(f2.id, 1);
assert(Store.folders().findIndex((x) => x.id === f2.id) === 3, 'moveFolder reorders downward');

// Assignment + manual reorder within a folder.
const ja = Store.addHabit({ name: 'Japanese', folderId: health.id });
const pr = Store.addHabit({ name: 'Programming', folderId: health.id });
assert(ja.folderId === health.id && pr.folderId === health.id, 'addHabit accepts a folderId');
const groupIds = () => Store.allHabits().filter((h) => h.folderId === health.id).sort((x, y) => x.sort - y.sort).map((h) => h.id);
Store.moveHabit(ja.id, 1);
assert(groupIds().indexOf(ja.id) > groupIds().indexOf(pr.id), 'moveHabit swaps within its own folder');
Store.updateHabit(ja.id, { folderId: null });
assert(Store.getHabit(ja.id).folderId === null, 'updateHabit can ungroup a habit');
Store.updateHabit(ja.id, { folderId: 'nope' });
assert(Store.getHabit(ja.id).folderId === null, 'unknown folderId is rejected');

// Deleting a folder keeps and ungroups its habits.
Store.updateHabit(pr.id, { folderId: f2.id });
Store.deleteFolder(f2.id);
assert(!Store.getFolder(f2.id) && Store.getHabit(pr.id) && Store.getHabit(pr.id).folderId === null, 'deleteFolder keeps + ungroups habits');

console.log('— folder prefs —');
Prefs.load();
assert(Prefs.sortMode() === 'manual' && Prefs.doneLast(), 'sort + done-last default sensibly');
Prefs.setSortMode('streak');
Prefs.setDoneLast(false);
Prefs.toggleCollapsed('__ungrouped');
Prefs.setCollapsed(health.id, true);
Prefs.save();
Prefs.load();
assert(Prefs.sortMode() === 'streak' && Prefs.doneLast() === false, 'list sort prefs round-trip');
assert(Prefs.isCollapsed('__ungrouped') && Prefs.isCollapsed(health.id), 'collapse state round-trips');
Prefs.setSortMode('bogus');
assert(Prefs.sortMode() === 'manual', 'unknown sort mode falls back to manual');
Prefs.clearCollapsed();
assert(!Prefs.isCollapsed(health.id), 'clearCollapsed resets');

console.log('— folder rendering —');
Render.renderToday();
const todayHtml = document.querySelector('#view-today').innerHTML;
assert(todayHtml.includes('folder-head') && todayHtml.includes('Studies'), 'Today renders collapsible folder sections');
assert(todayHtml.includes('toggle-fold') && todayHtml.includes('data-action="set-sort"'), 'Today renders folder toggle + sort controls');
Render.renderHabits();
const habitsHtml = document.querySelector('#view-habits').innerHTML;
assert(habitsHtml.includes('new-folder') && habitsHtml.includes('edit-folder'), 'Habits renders folder management');
assert(habitsHtml.includes('move-habit') && habitsHtml.includes('move-folder'), 'Habits renders manual reorder controls');
assert(typeof Render.folderEditorHtml === 'function', 'folder editor builder is exposed');
App.openFolderEditor();
App.openEditor(Store.activeHabits()[0].id);
UI.closeModal();
assert(true, 'folder + habit editors render without throwing');

console.log('— editor input preservation —');
// A picker click re-renders the form; live typing must survive it.
const editTarget = Store.activeHabits()[0];
App.openEditor(editTarget.id);
document.querySelector('#h-name').value = 'Renamed while editing';
App.refreshEditor();
assert(App.editorDraft.name === 'Renamed while editing', 'habit editor keeps a typed name across picker refreshes');
App.openFolderEditor(Store.folders()[0].id);
document.querySelector('#f-name').value = 'Renamed folder while editing';
App.refreshFolderEditor();
assert(App.folderDraft.name === 'Renamed folder while editing', 'folder editor keeps a typed name across picker refreshes');
UI.closeModal();

console.log('— folder backup —');
const craftedF = JSON.stringify({
  version: 1,
  folders: [
    { id: 'fA', name: '  Studies  ', emoji: '📚', sort: 0 },
    { id: 'fB', name: 'Dup', sort: 1 },
    { id: 'fA', name: 'Duplicate', sort: 2 },
    { id: 5, name: 'Bad' },
  ],
  habits: [
    { id: 'h1', name: 'Japanese', folderId: 'fA' },
    { id: 'h2', name: 'Lost', folderId: 'ghost' },
  ],
  completions: {},
});
const pf = Store.importJSON(craftedF);
assert(pf.ok && pf.db.folders.length === 2, 'import sanitizes folders (drops duplicate + invalid)');
assert(pf.db.folders[0].name === 'Studies', 'import trims the folder name');
assert(pf.db.habits.find((x) => x.id === 'h1').folderId === 'fA', 'valid folderId is kept');
assert(pf.db.habits.find((x) => x.id === 'h2').folderId === null, 'unknown folderId becomes ungrouped');
Store.replaceWith(pf.db);
assert(Store.folders().length === 2 && Store.getHabit('h1').folderId === 'fA', 'replace restores folders');
Store.mergeWith({ version: 1, folders: [{ id: 'fC', name: 'New', sort: 5 }], habits: [], completions: {} });
assert(Store.getFolder('fC') && Store.folders().length === 3, 'merge adds folders');
Store.replaceWith({ version: 1, habits: [], completions: {} });
Store.loadSample();
assert(Store.folders().length === 3, 'sample folders reload cleanly');

console.log('— pwa assets —');
const png = icons.buildPng(192);
assert(png.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'icon has a valid PNG signature');
assert(png.readUInt32BE(16) === 192 && png.readUInt32BE(20) === 192, 'icon PNG IHDR reports 192×192');
assert(png.length > 200, 'icon PNG has image data');
const maskable = icons.buildPng(512, { maskable: true });
assert(maskable.readUInt32BE(16) === 512, 'maskable icon is 512×512');
const man = JSON.parse(pwa.manifest());
assert(man.name && man.start_url === './' && man.display === 'standalone', 'manifest has required install fields');
assert(man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.purpose === 'maskable'), 'manifest declares 192px + maskable icons');
const sw = pwa.serviceWorker('abc123');
assert(sw.includes("const CACHE = 'ahabit-abc123'"), 'service worker cache is content-versioned');
assert(sw.includes("addEventListener('install'") && sw.includes("addEventListener('activate'") && sw.includes("addEventListener('fetch'"), 'service worker handles install/activate/fetch');
assert(pwa.PWA_HEAD.includes('rel="manifest"') && pwa.PWA_HEAD.includes('serviceWorker.register'), 'PWA head snippet has manifest + registration');

console.log('— themes —');
assert(Render.THEMES.length >= 4, 'more than one theme is offered');
assert(Render.THEMES.every((t) => t.id && t.name && t.emoji && t.scheme && t.color && Array.isArray(t.colors) && t.colors.length >= 3), 'theme registry entries are complete');
assert(Render.THEMES.some((t) => t.id === 'brutalist') && Render.THEMES.some((t) => t.id === 'brutalist-dark'), 'brutalist light + dark themes are offered');
assert(Render.THEMES.some((t) => t.scheme === 'light') && Render.THEMES.some((t) => t.scheme === 'dark'), 'themes cover both light and dark schemes');
const picker = Render.themePickerHtml('brutalist');
assert(Render.THEMES.every((t) => picker.includes(`data-theme="${t.id}"`)), 'picker lists every theme');
assert(picker.includes('sel') && picker.includes('data-theme="brutalist"'), 'picker marks the active theme');
assert(App.resolveTheme('dark') === 'midnight' && App.resolveTheme('light') === 'zen', 'old light/dark values migrate to themed names');
assert(App.resolveTheme('brutalist') === 'brutalist', 'known theme ids pass through');
assert(['zen', 'midnight'].includes(App.resolveTheme('nonsense')), 'unknown theme falls back to a real theme');
App.setTheme('brutalist');
assert(localStorage.getItem('ahabit.theme') === 'brutalist', 'setTheme persists the choice');
assert(document.documentElement.dataset.theme === 'brutalist', 'setTheme applies data-theme to <html>');
assert(document.querySelector('#theme-pop').innerHTML.includes('data-theme="brutalist"'), 'theme popover re-renders with the active theme');
App.setTheme('zen');
assert(document.documentElement.dataset.theme === 'zen', 'setTheme switches back');

console.log('— custom cursor —');
const mm = global.matchMedia;
global.matchMedia = (q) => ({ matches: /pointer: fine/.test(q) });
const bodyBefore = document.body.children.length;
UI.initCursor();
assert(document.body.children.length === bodyBefore + 1, 'initCursor adds the halo on a fine pointer');
global.matchMedia = () => ({ matches: false });
const bodySkip = document.body.children.length;
UI.initCursor();
assert(document.body.children.length === bodySkip, 'initCursor is skipped without a fine pointer');
global.matchMedia = mm;
assert(typeof UI.initCursor === 'function', 'initCursor is exposed on the UI namespace');

console.log('— prefs / customization —');
Prefs.load();
assert(Prefs.get() && Object.keys(Prefs.get().colors).length === 0, 'prefs start empty');
Prefs.setColor('--accent', '#ff0000');
assert(Prefs.get().colors['--accent'] === '#ff0000' && Prefs.hasCustomColors(), 'setColor stores and flags custom colours');
Prefs.setColor('--accent', 'not-a-color');
assert(!Prefs.get().colors['--accent'], 'invalid colour is rejected');
Prefs.setFont('body', 'serif');
assert(Prefs.get().font === 'serif', 'setFont stores a stack');
Prefs.setFont('body', 'bogus');
assert(Prefs.get().font === 'theme', 'unknown font falls back to theme');
Prefs.setColor('--accent', '#123456');
Prefs.setFont('display', 'mono');
Prefs.setHidden('stats.momentum', true);
Prefs.save();
Prefs.load();
assert(Prefs.get().colors['--accent'] === '#123456' && Prefs.get().font === 'theme' && Prefs.get().displayFont === 'mono', 'prefs round-trip through storage');
assert(Prefs.isHidden('stats.momentum') && !Prefs.isHidden('stats.insights'), 'isHidden reflects saved state');
Render.renderStats();
assert(!document.querySelector('#view-stats').innerHTML.includes('Momentum'), 'a hidden section is not rendered');
assert(document.querySelector('#view-stats').innerHTML.includes('Insights'), 'other sections still render');
Prefs.setHidden('stats.momentum', false);
Render.renderSettings();
const setHtml = document.querySelector('#view-settings').innerHTML;
assert(setHtml.includes('Customize') && setHtml.includes('set-color') && setHtml.includes('Layout'), 'settings page renders appearance + layout controls');
App.prevTab = 'today';
App.switchTab('settings');
assert(document.querySelector('#view-settings').innerHTML.includes('set-toggles'), 'settings view routes via switchTab');
Prefs.clearColors();
Prefs.clearFonts();
Prefs.clearHidden();
assert(!Prefs.hasCustomColors() && !Prefs.hasCustomFonts() && !Prefs.isHidden('stats.momentum'), 'reset helpers clear state');

console.log('— font options —');
assert(Prefs.FONT_OPTIONS.length >= 12, `plenty of font choices (${Prefs.FONT_OPTIONS.length})`);
assert(Prefs.FONT_OPTIONS.filter((o) => o.body).length >= 10, 'body picker offers 10+ readable stacks');
assert(Prefs.FONT_OPTIONS.some((o) => !o.body), 'display-only faces are marked');
const generic = /(sans-serif|serif|monospace|cursive|fantasy)\s*$/;
const noFallback = Object.keys(Prefs.FONTS).filter((id) => id !== 'theme' && !generic.test(Prefs.FONTS[id]));
assert(noFallback.length === 0, `every font stack ends in a generic family (${noFallback.join(', ') || 'all ok'})`);
Prefs.setFont('body', 'geometric');
assert(Prefs.get().font === 'geometric', 'new font stacks are selectable');
Prefs.setFont('body', 'theme');
assert(Prefs.get().font === 'theme', 'font reset to theme default');

console.log('\n✅ All smoke tests passed');