/*
 * render.js — pure view layer: turns Store state into HTML.
 * Nothing here mutates state; App wires events and calls these after mutations.
 *
 * Attaches to the global `Render` namespace.
 */
'use strict';

const Render = (() => {
  const EMOJIS = [
    '⭐', '🔥', '💧', '📚', '🏃', '🧘', '💪', '🍎', '🥗', '😴', '🧠', '✍️',
    '🎨', '🎸', '🎹', '🎯', '💻', '📵', '💰', '🚭', '🌅', '🌿', '🧹', '🛏️',
    '🚿', '🪞', '🦷', '💊', '📝', '🐶', '🌱', '✈️', '🎲', '🙏', '💖', '☕',
    '🚴', '🏊', '🧗', '🥊', '🚀', '⏰', '🎧', '🗣️', '♻️', '🧊', '🕯️', '🍵',
  ];

  const COLORS = [
    '#6d5df6', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
    '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#f43f5e', '#64748b',
  ];

  // Emoji choices for folder icons (habits have their own larger set above).
  const FOLDER_EMOJIS = [
    '📁', '📚', '💪', '🧘', '🏠', '💼', '💻', '🎯', '🌱', '🎨',
    '🎵', '🏃', '🍎', '💰', '✈️', '🛠️', '❤️', '🔬', '🎓', '🌍',
  ];

  // Theme registry — single source of truth shared by App (apply/persist) and
  // the picker. `colors` are preview swatches; `color` is the browser/status-bar
  // tint applied to <meta name="theme-color">. CSS token sets live in styles.css.
  const THEMES = [
    // `colors` = [background, surface, accent, accent 2] — used by swatches + gallery previews.
    { id: 'zen', name: 'Zen', emoji: '🌸', scheme: 'light', color: '#f4f5fb', colors: ['#f4f5fb', '#ffffff', '#6d5df6', '#ff5c8a'] },
    { id: 'midnight', name: 'Midnight', emoji: '🌙', scheme: 'dark', color: '#0e1017', colors: ['#0e1017', '#191c2b', '#8a7cf5', '#ff5c8a'] },
    { id: 'paper', name: 'Paper', emoji: '📜', scheme: 'light', color: '#f4ecdd', colors: ['#f4ecdd', '#fffaf1', '#a8560a', '#2f6b4f'] },
    { id: 'brutalist', name: 'Brutalist', emoji: '⬛', scheme: 'light', color: '#f4f1e8', colors: ['#f4f1e8', '#ffffff', '#ff3b00', '#0057ff'] },
    { id: 'brutalist-dark', name: 'Brutalist Dark', emoji: '🟨', scheme: 'dark', color: '#0a0a0a', colors: ['#0a0a0a', '#121212', '#ffe600', '#00e0ff'] },
    { id: 'graphite', name: 'Graphite', emoji: '⚫', scheme: 'dark', color: '#0f1115', colors: ['#0f1115', '#191d23', '#4c9aff', '#22c55e'] },
    { id: 'frost', name: 'Frost', emoji: '❄️', scheme: 'light', color: '#eceff4', colors: ['#eceff4', '#ffffff', '#5e81ac', '#4c8a9c'] },
    { id: 'gruvbox', name: 'Gruvbox', emoji: '🟠', scheme: 'dark', color: '#282828', colors: ['#282828', '#3c3836', '#d79921', '#b8bb26'] },
    { id: 'matcha', name: 'Matcha', emoji: '🍵', scheme: 'light', color: '#eef3ea', colors: ['#eef3ea', '#ffffff', '#4f7a4a', '#7fa650'] },
    { id: 'synthwave', name: 'Synthwave', emoji: '🌆', scheme: 'dark', color: '#150b2e', colors: ['#150b2e', '#241748', '#ff2fb9', '#00e5ff'] },
    { id: 'mono', name: 'Mono', emoji: '⚪', scheme: 'light', color: '#ffffff', colors: ['#ffffff', '#f0f0f0', '#000000', '#555555'] },
  ];

  /** Presets + saved custom themes, shaped for the picker/gallery. */
  function allThemes(customThemes = []) {
    const customs = (customThemes || []).map((t) => {
      const base = THEMES.find((x) => x.id === t.base) || THEMES[0];
      const c = t.colors || {};
      return {
        id: t.id,
        name: t.name,
        emoji: '🎨',
        scheme: base.scheme,
        color: c['--bg'] || base.color,
        colors: [
          c['--bg'] || base.colors[0],
          c['--card'] || base.colors[1],
          c['--accent'] || base.colors[2],
          c['--accent-2'] || base.colors[3],
        ],
        custom: true,
      };
    });
    return THEMES.concat(customs);
  }

  /** Pickable list of themes, with the active one marked. */
  const themePickerHtml = (active, customThemes = []) =>
    allThemes(customThemes).map((t) => `
      <button class="theme-opt${t.id === active ? ' sel' : ''}" data-action="set-theme" data-theme="${t.id}" role="menuitem" aria-pressed="${t.id === active}">
        <span class="theme-swatches">${t.colors.map((c) => `<i class="theme-swatch" style="background:${c}"></i>`).join('')}</span>
        <span class="t-name">${t.emoji} ${Utils.esc(t.name)}</span>
        ${t.id === active ? '<span class="t-check">✓</span>' : ''}
      </button>`).join('');

  /** Larger gallery cards for the Customize tab (live mini-preview). */
  function themeGalleryHtml(active, customThemes = []) {
    return allThemes(customThemes).map((t) => `
      <div class="theme-card${t.id === active ? ' sel' : ''}">
        <button class="theme-card-main" data-action="set-theme" data-theme="${t.id}" aria-pressed="${t.id === active}">
          <span class="theme-preview" style="--tp-bg:${t.colors[0]};--tp-card:${t.colors[1]};--tp-a:${t.colors[2]};--tp-b:${t.colors[3]}">
            <i class="tp-bar"></i><i class="tp-dot"></i><i class="tp-line"></i><i class="tp-line short"></i>
          </span>
          <span class="theme-card-name">${t.emoji} ${Utils.esc(t.name)}</span>
          <span class="theme-card-meta">${t.scheme}${t.custom ? ' · custom' : ''}</span>
          ${t.id === active ? '<span class="theme-card-check">✓</span>' : ''}
        </button>
        ${t.custom ? `<div class="theme-card-actions">
          <button class="icon-btn" data-action="edit-custom-theme" data-id="${t.id}" aria-label="Rename theme" title="Rename">✏️</button>
          <button class="icon-btn danger" data-action="del-custom-theme" data-id="${t.id}" aria-label="Delete theme" title="Delete">🗑️</button>
        </div>` : ''}
      </div>`).join('');
  }

  // Sections the user can show/hide per tab (Layout settings). Render guards
  // each with `Prefs.isHidden(id)`.
  const SECTIONS = [
    { id: 'today.greeting', view: 'Today', label: 'Greeting & date' },
    { id: 'today.welcome', view: 'Today', label: 'Welcome card' },
    { id: 'today.progress', view: 'Today', label: 'Daily progress' },
    { id: 'today.sort', view: 'Today', label: 'Sort controls' },
    { id: 'today.folders', view: 'Today', label: 'Folder grouping' },
    { id: 'today.streak', view: 'Today', label: 'Streak text' },
    { id: 'today.weekgoal', view: 'Today', label: 'Weekly goal + bar' },
    { id: 'today.notes', view: 'Today', label: 'Note fields' },
    { id: 'today.steppers', view: 'Today', label: 'Count steppers' },
    { id: 'calendar.hint', view: 'Calendar', label: 'Backfill hint' },
    { id: 'calendar.dots', view: 'Calendar', label: 'Day dots' },
    { id: 'stats.overview', view: 'Stats', label: 'Summary numbers' },
    { id: 'stats.momentum', view: 'Stats', label: 'Momentum' },
    { id: 'stats.health', view: 'Stats', label: 'Habit health' },
    { id: 'stats.health.spark', view: 'Stats', label: 'Habit sparklines' },
    { id: 'stats.health.rings', view: 'Stats', label: 'Health rings' },
    { id: 'stats.weekday', view: 'Stats', label: 'Weekday rhythm' },
    { id: 'stats.tod', view: 'Stats', label: 'Time of day' },
    { id: 'stats.insights', view: 'Stats', label: 'Insights' },
    { id: 'stats.heatmap', view: 'Stats', label: 'Activity heatmap' },
    { id: 'stats.heatmap.legend', view: 'Stats', label: 'Heatmap legend' },
    { id: 'stats.history', view: 'Stats', label: 'Habit history' },
    { id: 'stats.note', view: 'Stats', label: 'Health-score note' },
    { id: 'habits.folders', view: 'Habits', label: 'Folder management' },
    { id: 'habits.archived', view: 'Habits', label: 'Archived list' },
    { id: 'global.brand', view: 'Global', label: 'Logo & wordmark' },
    { id: 'global.theme-btn', view: 'Global', label: 'Theme button' },
    { id: 'global.fab', view: 'Global', label: 'Add button (FAB)' },
  ];

  // Quick layout presets — each is the list of elements to HIDE.
  const LAYOUT_PRESETS = {
    minimal: [
      'today.greeting', 'today.welcome', 'today.sort', 'today.streak', 'today.weekgoal', 'today.notes',
      'calendar.hint', 'calendar.dots',
      'stats.momentum', 'stats.health', 'stats.weekday', 'stats.tod', 'stats.insights',
      'stats.history', 'stats.note', 'stats.health.spark', 'stats.health.rings', 'stats.heatmap.legend',
      'habits.archived', 'global.brand',
    ],
    balanced: ['today.welcome', 'stats.note', 'stats.history', 'stats.heatmap.legend'],
    full: [],
  };

  const hidden = (id) => Prefs.isHidden(id);

  // [label, weekday(Mon=1)]
  const DAY_CHIPS = [['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6], ['S', 7]];

  const checkSvg = () =>
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4L19 7.5"/></svg>';

  /** Compact − ×N + stepper for count-per-day check-ins. */
  const stepper = (id, dateKey, count) => `
    <div class="stepper" role="group" aria-label="Check-in count">
      <button class="step-btn" data-action="dec" data-id="${id}" data-date="${dateKey}"
        aria-label="One fewer check-in" title="One fewer"${count <= 1 ? ' disabled' : ''}>−</button>
      <span class="step-count">×${count}</span>
      <button class="step-btn inc" data-action="inc" data-id="${id}" data-date="${dateKey}"
        aria-label="Add a check-in" title="Add another check-in">＋</button>
    </div>`;

  const freqLabel = (h) => {
    if (h.target > 0) {
      const days = h.days.length
        ? ` on ${h.days.map((d) => Utils.WD[(d % 7)].slice(0, 3)).join(', ')}`
        : '';
      return `${h.target}× per week${days}`;
    }
    return 'Any day';
  };

  /* ================= Today ================= */

  /** First-run welcome card (dismissal is UI state owned by App). */
  const welcomeCard = () => `
    <div class="welcome card">
      <span class="welcome-emoji">👋</span>
      <div class="welcome-main">
        <strong>Welcome to AHA(bit)</strong>
        <ul class="welcome-tips">
          <li>Tap the circle to check in — <b>＋</b> logs another for the same day.</li>
          <li>Notes save as you type.</li>
          <li>See momentum &amp; habit health in <b>Stats</b>.</li>
        </ul>
      </div>
      <button class="btn ghost welcome-dismiss" data-action="dismiss-welcome">Got it</button>
    </div>`;

  /** Sort a habit list by the active mode (reads UI prefs; no mutation). */
  function sortHabits(list, doneKey) {
    const byMode = {
      name: (a, b) => a.name.localeCompare(b.name),
      streak: (a, b) => Store.streakFor(b.id).current - Store.streakFor(a.id).current || a.sort - b.sort,
      health: (a, b) => (Store.healthScore(b.id) || { score: 0 }).score - (Store.healthScore(a.id) || { score: 0 }).score || a.sort - b.sort,
      newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      manual: (a, b) => a.sort - b.sort,
    };
    const arr = list.slice().sort(byMode[Prefs.sortMode()] || byMode.manual);
    // Optional secondary "done last" pass — sort() is stable, so mode order holds.
    if (doneKey && Prefs.doneLast()) {
      arr.sort((a, b) => (Store.isDone(a.id, doneKey) ? 1 : 0) - (Store.isDone(b.id, doneKey) ? 1 : 0));
    }
    return arr;
  }

  /** Collapsible folder header with a tiny completion bar. */
  function folderHeader(folder, doneCount, total, collapsed) {
    const pct = total ? Math.round((doneCount / total) * 100) : 0;
    return `
      <button class="folder-head" data-action="toggle-fold" data-id="${folder.id}"
        aria-expanded="${collapsed ? 'false' : 'true'}" title="${collapsed ? 'Expand' : 'Collapse'} ${Utils.esc(folder.name)}">
        <span class="folder-chevron${collapsed ? '' : ' open'}">▸</span>
        <span class="folder-emoji">${folder.emoji}</span>
        <span class="folder-name">${Utils.esc(folder.name)}</span>
        <span class="folder-count">${doneCount}/${total}</span>
        <span class="folder-bar"><span class="folder-bar-fill" style="width:${pct}%"></span></span>
      </button>`;
  }

  /** A folder section (header + rows) for the Today list. */
  function folderSection(folder, items, dateKey) {
    const collapsed = Prefs.isCollapsed(folder.id);
    const doneCount = items.filter((h) => Store.isDone(h.id, dateKey)).length;
    return `
      <section class="folder${collapsed ? ' collapsed' : ''}" data-folder="${folder.id}">
        ${folderHeader(folder, doneCount, items.length, collapsed)}
        ${collapsed ? '' : `<div class="folder-body">${items.map((h) => habitRow(h, dateKey)).join('')}</div>`}
      </section>`;
  }

  /** Sort control bar (sort mode + done-last) above the Today list. */
  function sortBar() {
    const opts = Prefs.SORT_MODES
      .map((m) => `<option value="${m.id}"${Prefs.sortMode() === m.id ? ' selected' : ''}>${m.label}</option>`)
      .join('');
    return `
      <div class="list-bar">
        <label class="list-sort">Sort
          <select data-action="set-sort" aria-label="Sort habits">${opts}</select>
        </label>
        <label class="list-toggle">
          <input type="checkbox" data-action="toggle-done-last"${Prefs.doneLast() ? ' checked' : ''}>
          <span>Done last</span>
        </label>
      </div>`;
  }

  /** One check-in row on the Today list. */
  function habitRow(h, dateKey) {
    const isDone = Store.isDone(h.id, dateKey);
    const count = Store.countFor(h.id, dateKey);
    const note = Store.getNote(h.id, dateKey);
    const streak = Store.streakFor(h.id);
    const wp = Store.weekProgress(h.id);
    const showStreak = !hidden('today.streak');
    const showGoal = !hidden('today.weekgoal');
    const showNotes = !hidden('today.notes');
    const showSteppers = !hidden('today.steppers');
    const meta = [];
    if (showStreak && streak.current > 0) meta.push(`🔥 ${streak.current}d streak`);
    else if (showStreak && streak.best > 0) meta.push(`best ${streak.best}d`);
    if (showGoal && wp) meta.push(`this week ${wp.done}/${wp.target}`);
    const metaStr = meta.join(' · ') || (showStreak || showGoal ? 'New habit — go for it!' : '');
    return `
      <div class="habit${isDone ? ' done' : ''}">
        <button class="check${isDone ? ' done' : ''}" data-action="toggle" data-id="${h.id}"
          aria-label="${isDone ? 'Mark as not done' : 'Mark as done'}" title="${isDone ? (count > 1 ? `Undo all (×${count})` : 'Undo') : 'Done'}">${checkSvg()}</button>
        <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
        <div class="h-main">
          <div class="h-name">${Utils.esc(h.name)}</div>
          ${metaStr ? `<div class="h-meta">${metaStr}</div>` : ''}
          ${showGoal && wp ? `<div class="weekbar"><div class="weekbar-fill" style="width:${Math.round((wp.done / wp.target) * 100)}%"></div></div>` : ''}
          ${showNotes && (isDone || note)
            ? `<input class="note-field" data-action="note" data-id="${h.id}" data-date="${dateKey}" maxlength="240"
                placeholder="Add a note…" value="${Utils.esc(note)}" aria-label="Note for ${Utils.esc(h.name)}">`
            : ''}
        </div>
        ${showSteppers && isDone ? stepper(h.id, dateKey, count) : ''}
      </div>`;
  }

  function renderToday(showWelcome) {
    const tKey = Utils.todayKey();
    const habits = Store.activeHabits();
    const doneSet = habits.filter((h) => Store.isDone(h.id, tKey));
    const total = habits.length;
    const done = doneSet.length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 5) return 'Burning the midnight oil';
      if (h < 12) return 'Good morning';
      if (h < 18) return 'Good afternoon';
      return 'Good evening';
    })();
    const dateStr = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
    const message = total === 0
      ? 'Add a habit to get started.'
      : done === total
        ? 'All done — you crushed today! 🎉'
        : total - done === 1
          ? 'One more to go.'
          : `${total - done} to go — you’ve got this.`;

    // Group into folders when any exist (and grouping is enabled).
    const folderList = hidden('today.folders') ? [] : Store.folders();
    let listHtml;
    if (!total) {
      listHtml = '';
    } else if (!folderList.length) {
      listHtml = `<div class="habit-list">${sortHabits(habits, tKey).map((h) => habitRow(h, tKey)).join('')}</div>`;
    } else {
      const used = new Set();
      const sections = folderList.map((f) => {
        const items = sortHabits(habits.filter((h) => h.folderId === f.id), tKey);
        items.forEach((h) => used.add(h.id));
        return items.length ? folderSection(f, items, tKey) : '';
      });
      const loose = sortHabits(habits.filter((h) => !used.has(h.id)), tKey);
      if (loose.length) sections.push(folderSection({ id: '__ungrouped', name: 'Ungrouped', emoji: '📄' }, loose, tKey));
      listHtml = `<div class="folder-list">${sections.join('')}</div>`;
    }

    const empty = total === 0 ? `
      <div class="empty">
        <div class="empty-emoji">✨</div>
        <div class="empty-title">No habits yet</div>
        <div class="empty-sub">Create your first habit, or explore with sample data.</div>
        <div class="btn-row">
          <button class="btn primary" data-action="add">＋ Add habit</button>
          <button class="btn ghost" data-action="load-sample">Load sample data</button>
        </div>
      </div>` : '';

    const view = UI.q('#view-today');
    view.innerHTML = `
      ${hidden('today.greeting') ? '' : `<div class="today-head">
        <div>
          <h1 class="today-greeting">${greeting} 👋</h1>
          <p class="today-date">${dateStr}</p>
        </div>
      </div>`}

      ${showWelcome && !hidden('today.welcome') ? welcomeCard() : ''}

      ${total ? `
        ${hidden('today.progress') ? '' : `<div class="progress-wrap card">
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label"><strong>${done}</strong> of ${total} done · <em>${message}</em></div>
        </div>`}
        ${hidden('today.sort') ? '' : sortBar()}
        ${listHtml}` : empty}
    `;
  }

  /* ================= Calendar ================= */

  function renderCalendar(monthOffset) {
    const now = new Date();
    const base = Utils.addMonths(new Date(now.getFullYear(), now.getMonth(), 1), monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const tKey = Utils.todayKey();
    const summary = Store.dailySummary(year, month);
    const weeks = Utils.monthMatrix(year, month);

    const cells = weeks
      .flat()
      .map((cell) => {
        const info = summary[cell.key] || [];
        const dots = info.slice(0, 4);
        const more = info.length - dots.length;
        const today = cell.key === tKey;
        return `
          <button class="cal-cell${cell.inMonth ? '' : ' out'}${today ? ' today' : ''}"
            data-action="open-day" data-date="${cell.key}"
            title="${Utils.fmtDayTitle(cell.key)}${more ? ` · ${info.length} habits` : ''}">
            <span class="cal-day">${cell.date.getDate()}</span>
            ${hidden('calendar.dots') ? '' : `<span class="dots">
              ${dots.map((d) => `<i class="dot" style="--d:${d.color}"></i>`).join('')}
              ${more > 0 ? `<span class="more">+${more}</span>` : ''}
            </span>`}
          </button>`;
      })
      .join('');

    const view = UI.q('#view-calendar');
    view.innerHTML = `
      <div class="cal-toolbar">
        <button class="icon-btn" data-action="cal-prev" aria-label="Previous month" title="Previous month">‹</button>
        <h2 class="cal-title">${Utils.monthTitle(year, month)}</h2>
        <button class="icon-btn" data-action="cal-next" aria-label="Next month" title="Next month">›</button>
      </div>
      <div class="cal-head">${Utils.WD.slice(1).map((d) => `<span>${d}</span>`).join('')}${'<span>Sun</span>'}</div>
      <div class="cal-grid">${cells}</div>
      ${hidden('calendar.hint') ? '' : `<p class="cal-hint">${!Object.keys(summary).length && Store.activeHabits().length
        ? 'No check-ins this month — tap a day to backfill or add one.'
        : 'Tip: click any day to backfill or fix a check-in.'}</p>`}
    `;
  }

  /* ---- analytics widgets ---- */

  const trendArrow = (dir) => {
    if (dir === 'up') return '<span class="trend up" title="Improving">▲</span>';
    if (dir === 'down') return '<span class="trend down" title="Slipping">▼</span>';
    return '<span class="trend flat" title="Steady">→</span>';
  };

  /** Inline SVG sparkline from an array of 0–1 values; color via CSS var `--c`. */
  function sparkline(points, color, w = 160, h = 40) {
    const n = points.length;
    if (n < 2) return '';
    const pad = 3;
    const stepX = (w - pad * 2) / (n - 1);
    const y = (v) => (h - pad) - (h - pad * 2) * Utils.clamp(v, 0, 1);
    const pts = points.map((v, i) => [pad + i * stepX, y(v)]);
    const line = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[n - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="--c:${Utils.esc(color)}" aria-hidden="true">
      <path class="spark-area" d="${area}"></path>
      <path class="spark-line" d="${line}"></path>
    </svg>`;
  }

  /** Conic-gradient health ring (0–100). */
  const scoreRing = (score) => {
    const ring = score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--err)';
    return `<div class="score-ring" style="--p:${score};--ring:${ring}" title="Health score ${score}/100">
      <div class="score-inner">${score}</div>
    </div>`;
  };

  function healthCard(h, i = 0) {
    const trend = Store.habitTrend(h.id, 30) || { points: [], rate: 0, direction: 'flat' };
    const health = Store.healthScore(h.id) || { score: 0 };
    const wp = Store.weekProgress(h.id);
    const peak = Store.habitPeakPeriod(h.id);
    const meta = [`${Math.round(trend.rate * 100)}% · 30 days`];
    if (wp) meta.push(`this week ${wp.done}/${wp.target}`);
    if (peak) meta.push(`⏰ ${peak.label}`);
    return `<div class="health-card card" style="--i:${i}">
      <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
      <div class="health-main">
        <div class="health-top">
          <span class="h-name">${Utils.esc(h.name)}</span>
          ${trendArrow(trend.direction)}
        </div>
        ${hidden('stats.health.spark') ? '' : sparkline(trend.points, h.color, 260, 40)}
        <div class="health-meta">${meta.join(' · ')}</div>
      </div>
      ${hidden('stats.health.rings') ? '' : scoreRing(health.score)}
    </div>`;
  }

  const fmtHour = (h) => {
    const ampm = h < 12 ? 'am' : 'pm';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}${ampm}`;
  };

  /** 24-hour histogram card of recorded check-in times. */
  function timeOfDayCard() {
    const tod = Store.timeOfDay();
    const head = '<div class="section-head"><h3>Time of day</h3><span>when you check in</span></div>';
    if (!tod.total) {
      return `<div class="card tod-card">${head}
        <p class="section-note">No timestamps yet — check in from Today and we'll learn your rhythm.</p></div>`;
    }
    const max = Math.max(1, ...tod.hours);
    const bars = tod.hours.map((n, h) => `
      <div class="tod-col" title="${fmtHour(h)} · ${Utils.plural(n, 'check-in')}">
        <div class="tod-track"><div class="tod-fill" style="height:${Math.round((n / max) * 100)}%"></div></div>
        <span class="tod-label">${h % 6 === 0 ? fmtHour(h) : ''}</span>
      </div>`).join('');
    return `<div class="card tod-card">${head}
      <div class="tod-bars">${bars}</div>
      <p class="section-note">You check in most in the <strong>${tod.peakPeriodLabel}</strong> · busiest around <strong>${fmtHour(tod.peakHour)}</strong>.</p>
    </div>`;
  }

  function weekdayBars(rates) {
    const cols = rates.map((r) => {
      const label = Utils.WD[r.weekday % 7];
      const pct = Math.round(r.rate * 100);
      return `<div class="wd-col" title="${label} · ${pct}% (${r.done}/${r.scheduled})">
        <div class="wd-track"><div class="wd-fill" style="height:${pct}%"></div></div>
        <span class="wd-label">${label[0]}</span>
      </div>`;
    }).join('');
    return `<div class="weekday-bars">${cols}</div>`;
  }

  /* ================= Stats ================= */

  /** 53-week activity heatmap card (colors by habits done per day). */
  /**
   * Build the 53-week GitHub-style grid. Without `habitId` it counts habits
   * done per day (shared ramp); with one it uses that habit's raw counts and a
   * flat ramp in the habit's own colour (no shared gradient).
   */
  function heatmapGrid(habitId) {
    const end = Utils.weekEnding(new Date())[6];
    const start = Utils.addDays(end, -(53 * 7 - 1));
    let cursor = start;
    const weeks = [];
    for (let c = 0; c < 53; c++) {
      const col = [];
      for (let r = 0; r < 7; r++) {
        col.push(cursor);
        cursor = Utils.addDays(cursor, 1);
      }
      weeks.push(col);
    }
    const counts = habitId
      ? Store.habitCountsByDay(habitId, Utils.keyOf(start), Utils.keyOf(end))
      : Store.countsByDay(Utils.keyOf(start), Utils.keyOf(end));

    // Month labels along the top.
    let prevMonth = -1;
    const monthCells = weeks.map((col, i) => {
      const d = col[0];
      const label = d.getMonth() !== prevMonth ? Utils.MON[d.getMonth()] : '';
      prevMonth = d.getMonth();
      return `<span class="heat-month${label ? ' has-label' : ''}" style="grid-column:${i + 1}">${label}</span>`;
    }).join('');

    const today = Utils.todayKey();
    const cellHtml = weeks
      .flat()
      .map((d) => {
        const key = Utils.keyOf(d);
        if (key > today) return `<span class="heat-cell h0"></span>`;
        const n = counts[key] || 0;
        const level = Math.min(4, n);
        return `<span class="heat-cell h${level}" title="${Utils.fmtDayTitle(key)} · ${Utils.plural(n, 'check-in')}"></span>`;
      })
      .join('');

    return { monthCells, cellHtml, done: Object.values(counts).filter((n) => n > 0).length };
  }

  /** 53-week activity heatmap card (colors by habits done per day). */
  function heatmapCard() {
    const { monthCells, cellHtml } = heatmapGrid();
    return `
      <div class="card heat-card">
        <div class="heat-head">
          <h3>Activity heatmap</h3>
          <span>all habits · last 12 months</span>
        </div>
        <div class="heat-months">${monthCells}</div>
        <div class="heat-grid">${cellHtml}</div>
        ${hidden('stats.heatmap.legend') ? '' : `<div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="heat-cell h${l}"></i>`).join('')}<span>More</span></div>`}
      </div>`;
  }

  /** One habit's own contribution graph, ramped in its colour (no shared gradient). */
  function habitHeatmapCard(h) {
    const { monthCells, cellHtml, done } = heatmapGrid(h.id);
    return `
      <div class="card hheat-card" style="--c:${h.color}">
        <div class="hheat-head">
          <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
          <span class="hheat-name">${Utils.esc(h.name)}</span>
          <span class="hheat-meta">${done} ${done === 1 ? 'day' : 'days'} · 12 mo</span>
        </div>
        <div class="hheat-scroll">
          <div class="heat-months">${monthCells}</div>
          <div class="heat-grid">${cellHtml}</div>
        </div>
        ${hidden('stats.heatmap.legend') ? '' : `<div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="heat-cell h${l}"></i>`).join('')}<span>More</span></div>`}
      </div>`;
  }

  function renderStats() {
    const actives = Store.activeHabits();

    // No active habits: one friendly empty state (but keep archived history visible).
    if (!actives.length) {
      UI.q('#view-stats').innerHTML = `
        <div class="stats-head">
          <h2>Your stats</h2>
          <p>Patterns, momentum, and per-habit health across all your check-ins.</p>
        </div>
        <div class="empty">
          <div class="empty-emoji">📊</div>
          <div class="empty-title">No data to analyse yet</div>
          <div class="empty-sub">Add a habit and check in for a few days — trends and health scores will appear here.</div>
          <div class="btn-row"><button class="btn primary" data-action="add">＋ Add habit</button></div>
        </div>
        ${Store.totalCompletions() ? heatmapCard() : ''}
      `;
      return;
    }

    const stats = Store.statsOverview();
    const ins = Store.insights();
    const wdRates = Store.weekdayRates(12);
    const overall = Store.overallTrend(30);

    // Momentum summary (trailing 7-day rate now vs a week ago).
    const now7 = overall.length ? overall[overall.length - 1] : 0;
    const was7 = overall.length > 7 ? overall[overall.length - 8] : (overall[0] || 0);
    const momDir = now7 - was7 > 0.03 ? 'up' : now7 - was7 < -0.03 ? 'down' : 'flat';
    const momLabel = momDir === 'up' ? 'trending up' : momDir === 'down' ? 'trending down' : 'holding steady';

    const dayName = (s) => (s ? Utils.WD[s.weekday % 7] : null);
    let rhythmNote = 'Track a few weeks to reveal your weekly rhythm.';
    if (ins.bestDay && ins.worstDay && ins.bestDay.weekday !== ins.worstDay.weekday) {
      rhythmNote = `Strongest on <strong>${dayName(ins.bestDay)}</strong> · toughest on <strong>${dayName(ins.worstDay)}</strong>.`;
    }

    const healthList = `<h3 class="section-sub">Habit health</h3>
      <div class="health-list">${actives.map((h, i) => healthCard(h, i)).join('')}</div>`;

    const habitHistory = `<h3 class="section-sub">Habit history</h3>
      <div class="hheat-list">${actives.map(habitHeatmapCard).join('')}</div>`;

    const insightItems = [];
    if (ins.mostConsistent) {
      insightItems.push(`<li><span class="ins-ico">🏆</span> Most consistent: <strong>${ins.mostConsistent.emoji} ${Utils.esc(ins.mostConsistent.name)}</strong> — ${Math.round(ins.mostConsistent.rate * 100)}% over 30 days</li>`);
    }
    if (ins.bestDay) {
      insightItems.push(`<li><span class="ins-ico">📅</span> Strongest day: <strong>${dayName(ins.bestDay)}</strong> (${Math.round(ins.bestDay.rate * 100)}%)</li>`);
    }
    if (ins.gap) {
      insightItems.push(`<li><span class="ins-ico">💤</span> Longest quiet stretch: <strong>${ins.gap.emoji} ${Utils.esc(ins.gap.name)}</strong> — ${Utils.plural(ins.gap.days, 'day')}</li>`);
    }
    if (!insightItems.length) {
      insightItems.push('<li><span class="ins-ico">🌱</span> Keep checking in — insights unlock as history builds up.</li>');
    }

    const overview = `
      <div class="grid-stats">
        <div class="stat-card card">
          <div class="stat-num">${stats.total}</div>
          <div class="stat-label">Total check-ins</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num">${stats.daysTracked}</div>
          <div class="stat-label">Days tracked</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num">${stats.best.name ? `${stats.best.days}<small>d</small>` : '—'}</div>
          <div class="stat-label">Best current streak${stats.best.name ? ` · ${Utils.esc(stats.best.name)}` : ''}</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num">${stats.rate7}%</div>
          <div class="stat-label">Completion rate · 7 days</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num">${actives.length ? ins.avgHealth : '—'}</div>
          <div class="stat-label">Average health score</div>
        </div>
      </div>`;

    const momentum = `
      <div class="card trend-card">
        <div class="section-head">
          <h3>Momentum</h3>
          <span>Last 30 days · 7-day average</span>
        </div>
        ${overall.length >= 2 ? sparkline(overall, 'var(--accent)', 620, 96) : '<p class="section-note">Not enough history yet — keep checking in.</p>'}
        <div class="trend-foot">
          <div><strong>${Math.round(now7 * 100)}%</strong><span> completion · last 7 days</span></div>
          <div class="trend-dir">${trendArrow(momDir)} ${momLabel}</div>
        </div>
      </div>`;

    const weekday = `
      <div class="card weekday-card">
        <div class="section-head">
          <h3>Weekday rhythm</h3>
          <span>Last 12 weeks</span>
        </div>
        ${weekdayBars(wdRates)}
        <p class="section-note">${rhythmNote}</p>
      </div>`;

    const insightsCard = `
      <div class="card insights-card">
        <div class="section-head"><h3>Insights</h3></div>
        <ul class="insight-list">${insightItems.join('')}</ul>
      </div>`;

    const scoreNote = '<p class="section-note analytics-note">Health score = 40% consistency + 30% weekly-target attainment + 30% current streak (habits with no weekly goal use 70% consistency + 30% streak).</p>';

    const view = UI.q('#view-stats');
    view.innerHTML = `
      <div class="stats-head">
        <h2>Your stats</h2>
        <p>Patterns, momentum, and per-habit health across all your check-ins.</p>
      </div>

      ${hidden('stats.overview') ? '' : overview}

      ${hidden('stats.momentum') ? '' : momentum}

      ${hidden('stats.health') ? '' : healthList}

      ${hidden('stats.weekday') ? '' : weekday}

      ${hidden('stats.tod') ? '' : timeOfDayCard()}

      ${hidden('stats.insights') ? '' : insightsCard}

      ${hidden('stats.heatmap') ? '' : heatmapCard()}

      ${hidden('stats.history') ? '' : habitHistory}

      ${hidden('stats.note') ? '' : scoreNote}
    `;
  }

  /* ================= Habits (manage) ================= */

  function renderHabits() {
    const all = Store.allHabits();
    const active = all.filter((h) => !h.archived);
    const archived = all.filter((h) => h.archived);
    const folders = Store.folders();

    const row = (h) => {
      const group = all
        .filter((x) => (x.folderId || null) === (h.folderId || null) && !!x.archived === !!h.archived)
        .sort((a, b) => a.sort - b.sort);
      const i = group.findIndex((x) => x.id === h.id);
      const folder = h.folderId ? Store.getFolder(h.folderId) : null;
      const tag = folder ? ` · ${folder.emoji} ${Utils.esc(folder.name)}` : '';
      return `
      <div class="mrow card">
        <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
        <div class="m-main">
          <div class="m-name">${Utils.esc(h.name)}</div>
          <div class="m-meta">${freqLabel(h)} · 🔥 best ${Store.streakFor(h.id).best}d${tag}</div>
        </div>
        <div class="m-actions">
          <button class="icon-btn" data-action="move-habit" data-id="${h.id}" data-dir="-1" aria-label="Move up" title="Move up"${i <= 0 ? ' disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="move-habit" data-id="${h.id}" data-dir="1" aria-label="Move down" title="Move down"${i >= group.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="icon-btn" data-action="edit" data-id="${h.id}" aria-label="Edit" title="Edit">✏️</button>
          ${h.archived
            ? `<button class="icon-btn" data-action="unarchive" data-id="${h.id}" aria-label="Restore" title="Restore">↩️</button>`
            : `<button class="icon-btn" data-action="archive" data-id="${h.id}" aria-label="Archive" title="Archive">📦</button>`}
          <button class="icon-btn danger" data-action="del" data-id="${h.id}" aria-label="Delete" title="Delete">🗑️</button>
        </div>
      </div>`;
    };

    const folderRow = (f) => {
      const i = folders.findIndex((x) => x.id === f.id);
      const n = all.filter((h) => h.folderId === f.id && !h.archived).length;
      return `
        <div class="mrow card folder-row">
          <span class="folder-emoji">${f.emoji}</span>
          <div class="m-main">
            <div class="m-name">${Utils.esc(f.name)}</div>
            <div class="m-meta">${Utils.plural(n, 'habit')}</div>
          </div>
          <div class="m-actions">
            <button class="icon-btn" data-action="move-folder" data-id="${f.id}" data-dir="-1" aria-label="Move up" title="Move up"${i <= 0 ? ' disabled' : ''}>↑</button>
            <button class="icon-btn" data-action="move-folder" data-id="${f.id}" data-dir="1" aria-label="Move down" title="Move down"${i >= folders.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="icon-btn" data-action="edit-folder" data-id="${f.id}" aria-label="Edit folder" title="Edit">✏️</button>
            <button class="icon-btn danger" data-action="del-folder" data-id="${f.id}" aria-label="Delete folder" title="Delete">🗑️</button>
          </div>
        </div>`;
    };

    // Active habits grouped by folder (folder order), then any ungrouped ones.
    const used = new Set();
    const groups = folders.map((f) => {
      const items = active.filter((h) => h.folderId === f.id);
      items.forEach((h) => used.add(h.id));
      return { folder: f, items };
    });
    const loose = active.filter((h) => !used.has(h.id));
    const anyGrouped = groups.some((g) => g.items.length);
    // Always label the loose list so it reads as separate from the Folders block.
    const looseHeading = anyGrouped ? '📄 Ungrouped' : 'All habits';

    const activeHtml = active.length
      ? groups.filter((g) => g.items.length).map((g) => `
          <h3 class="section-sub folder-sub">${g.folder.emoji} ${Utils.esc(g.folder.name)}</h3>
          <div class="manage-list">${g.items.map(row).join('')}</div>`).join('')
        + (loose.length ? `
          <h3 class="section-sub folder-sub">${looseHeading}</h3>
          <div class="manage-list">${loose.map(row).join('')}</div>` : '')
      : `<div class="empty"><div class="empty-emoji">🌱</div><div class="empty-title">Nothing here yet</div>
             <div class="empty-sub">Create your first habit — the tiny steps are the big ones.</div>
             <div class="btn-row"><button class="btn primary" data-action="add">＋ Add habit</button></div></div>`;

    const view = UI.q('#view-habits');
    view.innerHTML = `
      <div class="habits-head">
        <h2>Habits</h2>
        <button class="btn primary" data-action="add">＋ New habit</button>
      </div>

      ${hidden('habits.folders') ? '' : `<div class="section-sub-row">
        <h3 class="section-sub">Folders</h3>
        <button class="btn ghost small" data-action="new-folder">＋ New folder</button>
      </div>
      ${folders.length
        ? `<div class="manage-list folder-manage">${folders.map(folderRow).join('')}</div>`
        : `<p class="section-note">No folders yet — group related habits to keep things tidy.</p>`}`}

      ${activeHtml}

      ${!hidden('habits.archived') && archived.length ? `
        <h3 class="section-sub">Archived (${archived.length})</h3>
        <div class="manage-list">${archived.map(row).join('')}</div>` : ''}
    `;
  }

  /* ================= Settings ================= */

  /** Group the colour tokens for the settings UI. */
  function prefColorGroups() {
    const groups = [];
    for (const c of Prefs.COLORS) {
      const name = c.group || 'Colors';
      let g = groups[groups.length - 1];
      if (!g || g.name !== name) {
        g = { name, items: [] };
        groups.push(g);
      }
      g.items.push(c);
    }
    return groups;
  }

  function renderSettings(activeTheme) {
    const theme = activeTheme || document.documentElement.dataset.theme;
    const p = Prefs.get();
    const customThemes = Prefs.customThemes();
    const visByView = {};
    for (const s of SECTIONS) (visByView[s.view] || (visByView[s.view] = [])).push(s);

    const colorGroupHtml = prefColorGroups()
      .map((g) => `
        <div class="set-group">
          <h4>${g.name}</h4>
          <div class="set-colors">
            ${g.items.map((c) => `
              <label class="set-color" title="${c.label}">
                <input type="color" data-action="set-color" data-token="${c.token}" value="${Prefs.tokenValue(c.token)}" aria-label="${c.label}">
                <span>${c.label}</span>
              </label>`).join('')}
          </div>
        </div>`)
      .join('');

    const layoutHtml = Object.keys(visByView)
      .map((v) => `
        <div class="set-group">
          <h4>${v}</h4>
          <div class="set-toggles">
            ${visByView[v].map((s) => `
              <label class="set-toggle">
                <input type="checkbox" data-action="toggle-section" data-section="${s.id}"${hidden(s.id) ? '' : ' checked'}>
                <span>${s.label}</span>
              </label>`).join('')}
          </div>
        </div>`)
      .join('');

    const structField = (key, label) => `
      <div class="set-field">
        <label for="set-struct-${key}">${label}</label>
        <select id="set-struct-${key}" data-action="set-structure" data-key="${key}">
          ${Prefs.STRUCT_OPTIONS[key].map((o) => `<option value="${o.id}"${p.structure[key] === o.id ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>`;

    const layoutPresets = `
      <div class="set-presets">
        <span class="set-preset-label">Quick presets</span>
        ${[['minimal', 'Minimal'], ['balanced', 'Balanced'], ['full', 'Everything']]
          .map(([id, label]) => `<button class="chip" data-action="layout-preset" data-preset="${id}">${label}</button>`)
          .join('')}
      </div>`;

    const fontOptions = (selected, bodyOnly) => Prefs.FONT_OPTIONS
      .filter((o) => !bodyOnly || o.body)
      .map((o) => `<option value="${o.id}"${selected === o.id ? ' selected' : ''}>${o.label}</option>`)
      .join('');

    const view = UI.q('#view-settings');
    view.innerHTML = `
      <div class="settings-head">
        <div>
          <h2>Customize</h2>
          <p>Make it yours — themes, colors, fonts, shape, and what each tab shows.</p>
        </div>
      </div>

      <div class="card set-card">
        <div class="section-head"><h3>Theme</h3><span>${customThemes.length ? `${customThemes.length} saved` : 'presets'}</span></div>
        <div class="theme-gallery">${themeGalleryHtml(theme, customThemes)}</div>
        <p class="set-hint">Picking a preset resets custom colors, fonts &amp; shape.</p>
        <div class="btn-row"><button class="btn ghost" data-action="save-theme">＋ Save current look as theme</button></div>
      </div>

      <div class="card set-card">
        <div class="section-head"><h3>Shape</h3><span>corners, borders, shadows</span></div>
        ${structField('radius', 'Corner radius')}
        ${structField('border', 'Border width')}
        ${structField('shadow', 'Shadow style')}
        <div class="btn-row"><button class="btn ghost" data-action="reset-structure">Reset shape</button></div>
      </div>

      <div class="card set-card">
        <div class="section-head"><h3>Colors</h3><span>${Prefs.hasCustomColors() ? 'customised' : 'from theme'}</span></div>
        ${colorGroupHtml}
        <p class="set-hint">Changing the accent auto-derives the gradient &amp; heatmap.</p>
        <div class="btn-row"><button class="btn ghost" data-action="reset-colors">Reset colors</button></div>
      </div>

      <div class="card set-card">
        <div class="section-head"><h3>Fonts</h3><span>system stacks only</span></div>
        <div class="set-field">
          <label for="set-font-body">Body</label>
          <select id="set-font-body" data-action="set-font" data-which="body">${fontOptions(p.font, true)}</select>
        </div>
        <div class="set-field">
          <label for="set-font-display">Headings &amp; numbers</label>
          <select id="set-font-display" data-action="set-font" data-which="display">${fontOptions(p.displayFont, false)}</select>
        </div>
        <div class="btn-row"><button class="btn ghost" data-action="reset-fonts">Reset fonts</button></div>
      </div>

      <div class="card set-card">
        <div class="section-head"><h3>Layout</h3><span>show / hide elements</span></div>
        ${layoutPresets}
        ${layoutHtml}
        <div class="btn-row"><button class="btn ghost" data-action="reset-hidden">Show everything</button></div>
      </div>

      <div class="btn-row set-danger">
        <button class="btn danger" data-action="reset-all">Reset all customizations</button>
      </div>
    `;
  }

  /* ================= Day details modal ================= */

  function dayModalHtml(dateKey) {
    const all = Store.activeHabits();
    const doneN = all.filter((h) => Store.isDone(h.id, dateKey)).length;
    const pct = all.length ? Math.round((doneN / all.length) * 100) : 0;

    const rows = all.map((h) => {
      const done = Store.isDone(h.id, dateKey);
      const count = Store.countFor(h.id, dateKey);
      const note = Store.getNote(h.id, dateKey);
      return `
        <div class="habit compact day-row${done ? ' done' : ''}">
          <button class="check${done ? ' done' : ''}" data-action="toggle-day" data-id="${h.id}" data-date="${dateKey}"
            aria-label="${done ? 'Mark as not done' : 'Mark as done'}" title="${done ? (count > 1 ? `Undo all (×${count})` : 'Undo') : 'Done'}">${checkSvg()}</button>
          <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
          <div class="h-main">
            <div class="h-name">${Utils.esc(h.name)}</div>
            <input class="note-field" data-action="note" data-id="${h.id}" data-date="${dateKey}" maxlength="240"
              placeholder="Add a note…" value="${Utils.esc(note)}" aria-label="Note for ${Utils.esc(h.name)}">
          </div>
          ${done ? stepper(h.id, dateKey, count) : ''}
        </div>`;
    }).join('');

    const body = UI.el('div', {}, [
      UI.el('div', { class: 'day-head' },
        UI.el('div', {},
          UI.el('h3', {}, Utils.fmtDayTitle(dateKey)),
          UI.el('p', {}, all.length ? `${doneN} of ${all.length} habits completed` : 'No active habits yet.'),
        ),
        UI.el('span', { class: `day-badge${doneN === all.length && all.length ? ' full' : ''}` }, all.length ? `${pct}%` : '—'),
      ),
      all.length
        ? UI.el('div', { class: 'day-list' }, htmlToNode(rows))
        : UI.el('div', { class: 'empty compact' },
            UI.el('div', { class: 'empty-emoji' }, '🌱'),
            UI.el('div', { class: 'empty-title' }, 'No active habits'),
            UI.el('div', { class: 'empty-sub' }, 'Create one to start checking in.'),
          ),
    ]);

    const foot = all.length
      ? UI.el('div', { class: 'btn-row' },
          UI.el('button', { class: 'btn ghost', 'data-action': 'day-none', 'data-date': dateKey }, 'Clear day'),
          UI.el('button', { class: 'btn primary', 'data-action': 'day-all', 'data-date': dateKey }, 'All done'),
        )
      : UI.el('div', { class: 'btn-row' },
          UI.el('button', { class: 'btn primary', 'data-action': 'add' }, '＋ Add habit'),
        );

    return UI.modalShell({ title: 'Day details', body, footer: foot });
  }

  // HTML string → DocumentFragment (for the modal body).
  function htmlToNode(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content;
  }

  /* ================= Habit editor modal ================= */

  function habitEditorHtml(draft) {
    const row = (label, inner, hint) => `
      <div class="form-row">
        <label>${label}${hint ? ` <small>${hint}</small>` : ''}</label>
        ${inner}
      </div>`;

    const emojiGrid = `
      <div class="emoji-grid">
        ${EMOJIS.map((e) => `<button type="button" class="emoji-btn${e === draft.emoji ? ' sel' : ''}" data-action="pick-emoji" data-e="${e}" title="${e}">${e}</button>`).join('')}
      </div>`;

    const swatches = `
      <div class="swatches">
        ${COLORS.map((c) => `<button type="button" class="swatch${c === draft.color ? ' sel' : ''}" data-action="pick-color" data-c="${c}" style="background:${c}" aria-label="${c}" title="${c}"></button>`).join('')}
      </div>`;

    const targets = `
      <div class="chips">
        <button type="button" class="chip${draft.target === 0 ? ' sel' : ''}" data-action="pick-target" data-t="0">Any</button>
        ${[1, 2, 3, 4, 5, 6, 7].map((t) => `<button type="button" class="chip${draft.target === t ? ' sel' : ''}" data-action="pick-target" data-t="${t}">${t}×</button>`).join('')}
      </div>`;

    const days = `
      <div class="chips">
        ${DAY_CHIPS.map(([l, d]) => `<button type="button" class="chip${draft.days.includes(d) ? ' sel' : ''}" data-action="pick-day" data-d="${d}">${l}</button>`).join('')}
      </div>`;

    const folderOptions = `
      <select class="field" id="h-folder">
        <option value="">No folder</option>
        ${Store.folders().map((f) => `<option value="${f.id}"${draft.folderId === f.id ? ' selected' : ''}>${f.emoji} ${Utils.esc(f.name)}</option>`).join('')}
      </select>`;

    const archived = draft.id
      ? `<div class="form-row checkrow"><label class="check-label"><input type="checkbox" id="h-arch"${draft.archived ? ' checked' : ''}> Archive <small>(hidden from Today)</small></label></div>`
      : '';

    const body = UI.el('div', { class: 'editor' }, [
      htmlToNode(row('Name', `<input class="field" id="h-name" maxlength="48" placeholder="e.g. Drink water" value="${Utils.esc(draft.name)}">`)),
      htmlToNode(row('Icon', emojiGrid)),
      htmlToNode(row('Color', swatches)),
      htmlToNode(row('Weekly goal', targets, 'target check-ins per week')),
      htmlToNode(row('Allowed days', days, 'optional — none means any day')),
      htmlToNode(row('Folder', folderOptions, 'optional — group related habits')),
      htmlToNode(archived),
    ]);

    const foot = UI.el('div', { class: 'btn-row' },
      UI.el('button', { class: 'btn ghost', onclick: UI.closeModal }, 'Cancel'),
      UI.el('button', { class: 'btn primary', 'data-action': 'save-habit' }, draft.id ? 'Save changes' : 'Create habit'),
    );

    return UI.modalShell({ title: draft.id ? 'Edit habit' : 'New habit', body, footer: foot });
  }

  /** Folder create/edit modal (name + emoji). */
  function folderEditorHtml(draft) {
    const emojiGrid = `
      <div class="emoji-grid">
        ${FOLDER_EMOJIS.map((e) => `<button type="button" class="emoji-btn${e === draft.emoji ? ' sel' : ''}" data-action="pick-folder-emoji" data-e="${e}" title="${e}">${e}</button>`).join('')}
      </div>`;
    const body = UI.el('div', { class: 'editor' }, [
      htmlToNode(`<div class="form-row"><label>Name</label><input class="field" id="f-name" maxlength="32" placeholder="e.g. Studies" value="${Utils.esc(draft.name)}"></div>`),
      htmlToNode(`<div class="form-row"><label>Icon</label>${emojiGrid}</div>`),
    ]);
    const foot = UI.el('div', { class: 'btn-row' },
      UI.el('button', { class: 'btn ghost', onclick: UI.closeModal }, 'Cancel'),
      UI.el('button', { class: 'btn primary', 'data-action': 'save-folder' }, draft.id ? 'Save folder' : 'Create folder'),
    );
    return UI.modalShell({ title: draft.id ? 'Edit folder' : 'New folder', body, footer: foot });
  }

  /** Name or rename a saved custom theme. */
  function customThemeHtml(draft) {
    const body = UI.el('div', { class: 'editor' }, [
      htmlToNode(`<div class="form-row"><label>Theme name</label><input class="field" id="ct-name" maxlength="32" placeholder="e.g. My calm dark" value="${Utils.esc(draft.name)}"></div>`),
    ]);
    const foot = UI.el('div', { class: 'btn-row' },
      UI.el('button', { class: 'btn ghost', onclick: UI.closeModal }, 'Cancel'),
      UI.el('button', { class: 'btn primary', 'data-action': 'save-custom-theme' }, draft.id ? 'Save name' : 'Save theme'),
    );
    return UI.modalShell({ title: draft.id ? 'Rename theme' : 'Save current look as theme', body, footer: foot });
  }

  return {
    renderToday,
    renderCalendar,
    renderStats,
    renderHabits,
    renderSettings,
    dayModalHtml,
    habitEditorHtml,
    folderEditorHtml,
    customThemeHtml,
    themePickerHtml,
    themeGalleryHtml,
    THEMES,
    SECTIONS,
    LAYOUT_PRESETS,
  };
})();