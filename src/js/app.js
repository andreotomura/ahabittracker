/*
 * app.js — the controller. Wires events, keeps UI state (active tab,
 * calendar offset, editor draft), and calls Render after Store mutations.
 * Boots on DOMContentLoaded.
 *
 * Attaches to the global `App` namespace.
 */
'use strict';

const App = {
  tab: 'today',
  monthOffset: 0,
  editorDraft: null,

  WELCOME_KEY: 'ahabit.welcome.v1',

  /* ---------------- Onboarding ---------------- */

  welcomeDismissed() {
    return localStorage.getItem(this.WELCOME_KEY) === '1';
  },

  /** First-run welcome shows once there is at least one habit to act on. */
  showWelcome() {
    return !this.welcomeDismissed() && Store.activeHabits().length > 0;
  },

  dismissWelcome() {
    localStorage.setItem(this.WELCOME_KEY, '1');
    this.renderCurrent();
  },

  /* ---------------- Rendering ---------------- */

  renderCurrent() {
    if (this.tab === 'today') Render.renderToday(this.showWelcome());
    else if (this.tab === 'calendar') Render.renderCalendar(this.monthOffset);
    else if (this.tab === 'stats') Render.renderStats();
    else if (this.tab === 'habits') Render.renderHabits();
    this.syncFab();
  },

  syncFab() {
    const fab = UI.q('#fab');
    fab.classList.toggle('hidden', this.tab !== 'today' || !Store.activeHabits().length);
  },

  switchTab(tab) {
    this.tab = tab;
    UI.qa('.tab').forEach((t) => {
      const active = t.dataset.tab === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active);
    });
    UI.qa('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
    if (tab === 'stats') this.monthOffset = 0;
    this.renderCurrent();
  },

  /* ---------------- Theme ---------------- */

  /** Resolve a stored/system theme id to a known theme (migrates old light/dark). */
  resolveTheme(id) {
    const alias = { light: 'zen', dark: 'midnight' };
    id = alias[id] || id;
    if (Render.THEMES.some((t) => t.id === id)) return id;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'midnight' : 'zen';
  },

  initTheme() {
    this.setTheme(this.resolveTheme(localStorage.getItem('ahabit.theme')), false);
  },

  setTheme(id, persist = true) {
    const theme = Render.THEMES.find((t) => t.id === id) || Render.THEMES[0];
    document.documentElement.dataset.theme = theme.id;
    if (persist) localStorage.setItem('ahabit.theme', theme.id);
    const btn = UI.q('#theme-btn');
    if (btn) btn.textContent = theme.emoji;
    const meta = UI.q('#theme-color');
    if (meta) meta.setAttribute('content', theme.color);
    this.syncThemePop();
  },

  syncThemePop() {
    const pop = UI.q('#theme-pop');
    if (pop) pop.innerHTML = Render.themePickerHtml(document.documentElement.dataset.theme);
  },

  closeThemePop() {
    const pop = UI.q('#theme-pop');
    const btn = UI.q('#theme-btn');
    if (pop) pop.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  },

  toggleThemePop() {
    const pop = UI.q('#theme-pop');
    const willOpen = pop.classList.contains('hidden');
    if (willOpen) this.syncThemePop();
    pop.classList.toggle('hidden', !willOpen);
    UI.q('#theme-btn').setAttribute('aria-expanded', String(willOpen));
    // opening the theme picker closes the main menu
    const menu = UI.q('#menu');
    if (menu) {
      menu.classList.add('hidden');
      UI.q('#menu-btn').setAttribute('aria-expanded', 'false');
    }
  },

  /* ---------------- Habit editor ---------------- */

  openEditor(habitId) {
    const h = habitId ? Store.getHabit(habitId) : null;
    this.editorDraft = h
      ? { id: h.id, name: h.name, emoji: h.emoji, color: h.color, target: h.target, days: h.days.slice(), archived: h.archived }
      : { id: null, name: '', emoji: '⭐', color: '#6d5df6', target: 0, days: [], archived: false };
    UI.openModal(Render.habitEditorHtml(this.editorDraft));
  },

  refreshEditor() {
    UI.updateModal(Render.habitEditorHtml(this.editorDraft));
  },

  saveEditor() {
    const d = this.editorDraft;
    const name = (UI.q('#h-name')?.value || '').trim();
    if (!name) {
      UI.toast('Give your habit a name first 🙂', 'warn');
      UI.q('#h-name')?.focus();
      return;
    }
    const archived = UI.q('#h-arch')?.checked || false;
    const fields = { ...d, name, archived };
    if (d.id) Store.updateHabit(d.id, fields);
    else Store.addHabit(fields);
    UI.closeModal();
    this.editorDraft = null;
    this.renderCurrent();
    UI.toast(d.id ? 'Habit updated ✓' : 'Habit created ✓');
  },

  /* ---------------- Day modal ---------------- */

  openDay(dateKey) {
    UI.openModal(Render.dayModalHtml(dateKey));
  },

  refreshDayModal(dateKey) {
    UI.updateModal(Render.dayModalHtml(dateKey));
  },

  /* ---------------- Import / export ---------------- */

  async importFlow(text) {
    const result = Store.importJSON(text);
    if (!result.ok) {
      UI.toast(result.error, 'err', 4000);
      return;
    }
    const choice = await UI.choiceDialog({
      title: 'Import backup',
      message: `Found ${result.db.habits.length} habits in this backup. How should it be applied?`,
      options: [
        { label: 'Replace everything', value: 'replace', danger: true },
        { label: 'Merge with current data', value: 'merge' },
      ],
    });
    if (!choice) return;
    if (choice === 'replace') Store.replaceWith(result.db);
    else Store.mergeWith(result.db);
    this.monthOffset = 0;
    this.renderCurrent();
    UI.toast('Import complete ✓');
  },

  /* ---------------- Events ---------------- */

  bindEvents() {
    // Tabs
    UI.qa('.tab').forEach((t) => t.addEventListener('click', () => this.switchTab(t.dataset.tab)));

    // Theme picker
    const themeBtn = UI.q('#theme-btn');
    const themePop = UI.q('#theme-pop');
    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleThemePop();
    });

    // Menu
    const menuBtn = UI.q('#menu-btn');
    const menu = UI.q('#menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('hidden') === false;
      menuBtn.setAttribute('aria-expanded', open);
      if (open) this.closeThemePop();
    });
    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== menuBtn) {
        menu.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
      if (!themePop.classList.contains('hidden') && !themePop.contains(e.target) && e.target !== themeBtn) {
        this.closeThemePop();
      }
    });

    // Import file input
    UI.q('#import-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => this.importFlow(String(reader.result));
      reader.onerror = () => UI.toast('Could not read that file.', 'err');
      reader.readAsText(file);
      e.target.value = '';
    });

    // Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        UI.closeModal();
        const m = UI.q('#menu');
        if (!m.classList.contains('hidden')) {
          m.classList.add('hidden');
          UI.q('#menu-btn').setAttribute('aria-expanded', 'false');
        }
        const tp = UI.q('#theme-pop');
        if (tp && !tp.classList.contains('hidden')) this.closeThemePop();
      }
    });

    // Modal overlay click (on backdrop) closes
    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('modal-overlay')) UI.closeModal();
    });

    // Delegated actions (everything rendered dynamically)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      // Clicking a menu item closes the menu
      if (menu.contains(btn)) {
        menu.classList.add('hidden');
        UI.q('#menu-btn').setAttribute('aria-expanded', 'false');
      }
      const { action } = btn.dataset;
      const id = btn.dataset.id;
      const date = btn.dataset.date;

      switch (action) {
        case 'add': this.openEditor(); break;
        case 'edit': this.openEditor(id); break;
        case 'toggle': {
          Store.toggle(id, Utils.todayKey());
          this.renderCurrent();
          break;
        }
        case 'toggle-day': {
          Store.toggle(id, date);
          this.refreshDayModal(date);
          if (this.tab === 'calendar') Render.renderCalendar(this.monthOffset);
          break;
        }
        case 'inc':
        case 'dec': {
          Store[action](id, date);
          if (UI.q('#modal .modal')) this.refreshDayModal(date);
          else this.renderCurrent();
          if (this.tab === 'calendar') Render.renderCalendar(this.monthOffset);
          break;
        }
        case 'day-all':
          Store.activeHabits().forEach((h) => Store.setCount(h.id, date, 1));
          this.refreshDayModal(date);
          if (this.tab === 'calendar') Render.renderCalendar(this.monthOffset);
          UI.toast('Day marked complete 🎉');
          break;
        case 'day-none':
          Store.activeHabits().forEach((h) => Store.setCount(h.id, date, 0));
          this.refreshDayModal(date);
          if (this.tab === 'calendar') Render.renderCalendar(this.monthOffset);
          break;
        case 'open-day': this.openDay(date); break;
        case 'cal-prev': this.monthOffset--; Render.renderCalendar(this.monthOffset); break;
        case 'cal-next': this.monthOffset++; Render.renderCalendar(this.monthOffset); break;
        case 'archive':
          Store.updateHabit(id, { archived: true });
          this.renderCurrent();
          UI.toast('Habit archived 📦');
          break;
        case 'unarchive':
          Store.updateHabit(id, { archived: false });
          this.renderCurrent();
          break;
        case 'del': {
          const h = Store.getHabit(id);
          UI.confirmDialog({
            title: 'Delete habit?',
            message: `“${h ? h.name : 'This habit'}” and all of its history will be gone forever.`,
            confirmText: 'Delete',
            danger: true,
          }).then((ok) => {
            if (!ok) return;
            Store.deleteHabit(id);
            this.renderCurrent();
            UI.toast('Habit deleted');
          });
          break;
        }
        case 'export': Store.exportJSON(); UI.toast('Backup downloaded ⬇️'); break;
        case 'dismiss-welcome': this.dismissWelcome(); break;
        case 'set-theme':
          this.setTheme(btn.dataset.theme);
          this.closeThemePop();
          break;
        case 'import': UI.q('#import-file').click(); break;
        case 'load-sample':
          Store.loadSample();
          this.renderCurrent();
          UI.toast('Sample data loaded — have fun! ✨');
          break;
        case 'about': this.openAbout(); break;

        // Editor picks
        case 'pick-emoji': this.editorDraft.emoji = btn.dataset.e; this.refreshEditor(); break;
        case 'pick-color': this.editorDraft.color = btn.dataset.c; this.refreshEditor(); break;
        case 'pick-target':
          this.editorDraft.target = Number(btn.dataset.t);
          this.refreshEditor();
          break;
        case 'pick-day': {
          const d = Number(btn.dataset.d);
          const days = this.editorDraft.days;
          this.editorDraft.days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
          this.refreshEditor();
          break;
        }
        case 'save-habit': this.saveEditor(); break;
      }
    });

    // Delegated input listener for per-check-in note fields (saved live).
    document.addEventListener('input', (e) => {
      const t = e.target && e.target.closest && e.target.closest('[data-action="note"]');
      if (!t) return;
      Store.setNote(t.dataset.id, t.dataset.date, t.value);
    });
  },

  openAbout() {
    const body = UI.el('div', { class: 'about' },
      UI.el('p', {}, 'A local-first habit tracker that ships as a single HTML file.'),
      UI.el('p', {}, 'Your data never leaves this device unless you export it — and you own it as plain JSON.'),
      UI.el('p', { class: 'tiny' }, `Version 0.7.0 · no trackers, no network, no cookies.`),
    );
    UI.openModal(UI.modalShell({ title: 'About AHA(bit) tracker', body }));
  },

  /* ---------------- Boot ---------------- */

  init() {
    Store.load();
    this.initTheme();
    this.bindEvents();
    this.switchTab('today');
    console.log('☀️ AHA(bit) tracker ready — your data lives in localStorage (`ahabit.db.v1`).');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());