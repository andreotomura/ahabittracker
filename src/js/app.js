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
  prevTab: 'today',
  monthOffset: 0,
  editorDraft: null,
  folderDraft: null,

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
    else if (this.tab === 'settings') Render.renderSettings();
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
    // Choosing a preset is a fresh start for custom appearance (but not layout).
    if (persist) {
      Prefs.clearColors();
      Prefs.clearFonts();
    }
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
      ? { id: h.id, name: h.name, emoji: h.emoji, color: h.color, target: h.target, days: h.days.slice(), folderId: h.folderId || null, archived: h.archived }
      : { id: null, name: '', emoji: '⭐', color: '#6d5df6', target: 0, days: [], folderId: null, archived: false };
    UI.openModal(Render.habitEditorHtml(this.editorDraft));
  },

  refreshEditor() {
    // Picking an icon/colour/etc. rebuilds the form, so fold any live typing
    // back into the draft first — otherwise the field would reset.
    const nameEl = UI.q('#h-name');
    if (nameEl) this.editorDraft.name = nameEl.value;
    const archEl = UI.q('#h-arch');
    if (archEl) this.editorDraft.archived = archEl.checked;
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
    const folderId = UI.q('#h-folder')?.value || null;
    const fields = { ...d, name, archived, folderId };
    if (d.id) Store.updateHabit(d.id, fields);
    else Store.addHabit(fields);
    UI.closeModal();
    this.editorDraft = null;
    this.renderCurrent();
    UI.toast(d.id ? 'Habit updated ✓' : 'Habit created ✓');
  },

  /* ---------------- Folder editor ---------------- */

  openFolderEditor(folderId) {
    const f = folderId ? Store.getFolder(folderId) : null;
    this.folderDraft = f
      ? { id: f.id, name: f.name, emoji: f.emoji }
      : { id: null, name: '', emoji: '📁' };
    UI.openModal(Render.folderEditorHtml(this.folderDraft));
  },

  refreshFolderEditor() {
    const nameEl = UI.q('#f-name');
    if (nameEl) this.folderDraft.name = nameEl.value;
    UI.updateModal(Render.folderEditorHtml(this.folderDraft));
  },

  saveFolderEditor() {
    const d = this.folderDraft;
    const name = (UI.q('#f-name')?.value || '').trim();
    if (!name) {
      UI.toast('Give your folder a name first 🙂', 'warn');
      UI.q('#f-name')?.focus();
      return;
    }
    if (d.id) Store.updateFolder(d.id, { name, emoji: d.emoji });
    else Store.addFolder({ name, emoji: d.emoji });
    UI.closeModal();
    this.folderDraft = null;
    this.renderCurrent();
    UI.toast(d.id ? 'Folder updated ✓' : 'Folder created ✓');
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
        case 'toggle-fold': Prefs.toggleCollapsed(id); this.renderCurrent(); break;
        case 'move-habit': Store.moveHabit(id, Number(btn.dataset.dir)); this.renderCurrent(); break;
        case 'move-folder': Store.moveFolder(id, Number(btn.dataset.dir)); this.renderCurrent(); break;
        case 'new-folder': this.openFolderEditor(); break;
        case 'edit-folder': this.openFolderEditor(id); break;
        case 'del-folder': {
          const f = Store.getFolder(id);
          UI.confirmDialog({
            title: 'Delete folder?',
            message: `“${f ? f.name : 'This folder'}” will be removed. Its habits are kept and become ungrouped.`,
            confirmText: 'Delete',
            danger: true,
          }).then((ok) => {
            if (!ok) return;
            Store.deleteFolder(id);
            this.renderCurrent();
            UI.toast('Folder deleted');
          });
          break;
        }
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
        case 'open-settings': this.prevTab = this.tab; this.switchTab('settings'); break;
        case 'close-settings': this.switchTab(this.prevTab || 'today'); break;
        case 'reset-colors': Prefs.clearColors(); this.renderCurrent(); break;
        case 'reset-fonts': Prefs.clearFonts(); this.renderCurrent(); break;
        case 'reset-hidden': Prefs.clearHidden(); this.renderCurrent(); break;
        case 'reset-all': Prefs.resetAll(); this.renderCurrent(); UI.toast('Customizations reset'); break;
        case 'set-theme':
          this.setTheme(btn.dataset.theme);
          this.closeThemePop();
          if (this.tab === 'settings') this.renderCurrent();
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

        // Folder editor picks
        case 'pick-folder-emoji': this.folderDraft.emoji = btn.dataset.e; this.refreshFolderEditor(); break;
        case 'save-folder': this.saveFolderEditor(); break;
      }
    });

    // Delegated input listener — note fields and colour pickers (live).
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || !t.dataset) return;
      if (t.dataset.action === 'note') Store.setNote(t.dataset.id, t.dataset.date, t.value);
      else if (t.dataset.action === 'set-color') Prefs.setColor(t.dataset.token, t.value);
    });

    // Delegated change listener — font pickers and layout toggles.
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || !t.dataset) return;
      if (t.dataset.action === 'set-font') {
        Prefs.setFont(t.dataset.which === 'display' ? 'display' : 'body', t.value);
        this.renderCurrent();
      } else if (t.dataset.action === 'toggle-section') {
        Prefs.setHidden(t.dataset.section, !t.checked);
      } else if (t.dataset.action === 'set-sort') {
        Prefs.setSortMode(t.value);
        this.renderCurrent();
      } else if (t.dataset.action === 'toggle-done-last') {
        Prefs.setDoneLast(t.checked);
        this.renderCurrent();
      }
    });
  },

  openAbout() {
    const body = UI.el('div', { class: 'about' },
      UI.el('p', {}, 'A local-first habit tracker that ships as a single HTML file.'),
      UI.el('p', {}, 'Your data never leaves this device unless you export it — and you own it as plain JSON.'),
      UI.el('p', { class: 'tiny' }, `Version 0.12.0 · no trackers, no network, no cookies.`),
    );
    UI.openModal(UI.modalShell({ title: 'About AHA(bit) tracker', body }));
  },

  /* ---------------- Boot ---------------- */

  init() {
    Store.load();
    Prefs.load();
    this.initTheme();
    Prefs.apply();
    this.bindEvents();
    UI.initCursor();
    this.switchTab('today');
    console.log('☀️ AHA(bit) tracker ready — your data lives in localStorage (`ahabit.db.v1`).');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());