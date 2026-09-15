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

  // [label, weekday(Mon=1)]
  const DAY_CHIPS = [['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6], ['S', 7]];

  const checkSvg = () =>
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4L19 7.5"/></svg>';

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

  function renderToday() {
    const tKey = Utils.todayKey();
    const habits = Store.activeHabits();
    const doneSet = habits.filter((h) => Store.isDone(h.id, tKey));
    const total = habits.length;
    const done = doneSet.length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const sorted = habits
      .slice()
      .sort((a, b) => (Store.isDone(a.id, tKey) ? 1 : 0) - (Store.isDone(b.id, tKey) ? 1 : 0) || a.sort - b.sort);

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

    const rows = sorted
      .map((h) => {
        const isDone = Store.isDone(h.id, tKey);
        const streak = Store.streakFor(h.id);
        const wp = Store.weekProgress(h.id);
        const meta = [];
        if (streak.current > 0) meta.push(`🔥 ${streak.current}d streak`);
        else if (streak.best > 0) meta.push(`best ${streak.best}d`);
        if (wp) meta.push(`this week ${wp.done}/${wp.target}`);
        return `
          <div class="habit${isDone ? ' done' : ''}">
            <button class="check${isDone ? ' done' : ''}" data-action="toggle" data-id="${h.id}"
              aria-label="${isDone ? 'Mark as not done' : 'Mark as done'}" title="${isDone ? 'Undo' : 'Done'}">${checkSvg()}</button>
            <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
            <div class="h-main">
              <div class="h-name">${Utils.esc(h.name)}</div>
              <div class="h-meta">${meta.join(' · ') || 'New habit — go for it!'}</div>
              ${wp ? `<div class="weekbar"><div class="weekbar-fill" style="width:${Math.round((wp.done / wp.target) * 100)}%"></div></div>` : ''}
            </div>
          </div>`;
      })
      .join('');

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
      <div class="today-head">
        <div>
          <h1 class="today-greeting">${greeting} 👋</h1>
          <p class="today-date">${dateStr}</p>
        </div>
      </div>

      ${total ? `
        <div class="progress-wrap card">
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label"><strong>${done}</strong> of ${total} done · <em>${message}</em></div>
        </div>
        <div class="habit-list">${rows}</div>` : empty}
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
            <span class="dots">
              ${dots.map((d) => `<i class="dot" style="--d:${d.color}"></i>`).join('')}
              ${more > 0 ? `<span class="more">+${more}</span>` : ''}
            </span>
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
      <p class="cal-hint">Tip: click any day to backfill or fix a check-in.</p>
    `;
  }

  /* ================= Stats ================= */

  function renderStats() {
    const stats = Store.statsOverview();

    // 53 weeks ending this week (anchored Monday) — GitHub-style heatmap.
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
    const counts = Store.countsByDay(Utils.keyOf(start), Utils.keyOf(end));

    // Month labels along the top.
    let prevMonth = -1;
    const monthCells = weeks.map((col, i) => {
      const d = col[0];
      const label = d.getMonth() !== prevMonth ? Utils.MON[d.getMonth()] : '';
      prevMonth = d.getMonth();
      return `<span class="heat-month${label ? ' has-label' : ''}" style="grid-column:${i + 1}">${label}</span>`;
    }).join('');

    const cellHtml = weeks
      .flat()
      .map((d) => {
        const key = Utils.keyOf(d);
        if (key > Utils.todayKey()) return `<span class="heat-cell h0"></span>`;
        const n = counts[key] || 0;
        const level = Math.min(4, n);
        return `<span class="heat-cell h${level}" title="${Utils.fmtDayTitle(key)} · ${Utils.plural(n, 'check-in')}"></span>`;
      })
      .join('');

    const view = UI.q('#view-stats');
    view.innerHTML = `
      <div class="stats-head">
        <h2>Your stats</h2>
        <p>Activity across all habits — check-ins per day.</p>
      </div>

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
      </div>

      <div class="card heat-card">
        <div class="heat-head">
          <h3>Activity heatmap</h3>
          <span>last 12 months</span>
        </div>
        <div class="heat-months">${monthCells}</div>
        <div class="heat-grid">${cellHtml}</div>
        <div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="heat-cell h${l}"></i>`).join('')}<span>More</span></div>
      </div>
    `;
  }

  /* ================= Habits (manage) ================= */

  function renderHabits() {
    const active = Store.allHabits().filter((h) => !h.archived);
    const archived = Store.allHabits().filter((h) => h.archived);

    const row = (h) => `
      <div class="mrow card">
        <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
        <div class="m-main">
          <div class="m-name">${Utils.esc(h.name)}</div>
          <div class="m-meta">${freqLabel(h)} · 🔥 best ${Store.streakFor(h.id).best}d</div>
        </div>
        <div class="m-actions">
          <button class="icon-btn" data-action="edit" data-id="${h.id}" aria-label="Edit" title="Edit">✏️</button>
          ${h.archived
            ? `<button class="icon-btn" data-action="unarchive" data-id="${h.id}" aria-label="Restore" title="Restore">↩️</button>`
            : `<button class="icon-btn" data-action="archive" data-id="${h.id}" aria-label="Archive" title="Archive">📦</button>`}
          <button class="icon-btn danger" data-action="del" data-id="${h.id}" aria-label="Delete" title="Delete">🗑️</button>
        </div>
      </div>`;

    const view = UI.q('#view-habits');
    view.innerHTML = `
      <div class="habits-head">
        <h2>Habits</h2>
        <button class="btn primary" data-action="add">＋ New habit</button>
      </div>

      ${active.length ? `<div class="manage-list">${active.map(row).join('')}</div>`
        : `<div class="empty"><div class="empty-emoji">🌱</div><div class="empty-title">Nothing here yet</div>
             <div class="empty-sub">Create your first habit — the tiny steps are the big ones.</div>
             <div class="btn-row"><button class="btn primary" data-action="add">＋ Add habit</button></div></div>`}

      ${archived.length ? `
        <h3 class="section-sub">Archived (${archived.length})</h3>
        <div class="manage-list">${archived.map(row).join('')}</div>` : ''}
    `;
  }

  /* ================= Day details modal ================= */

  function dayModalHtml(dateKey) {
    const all = Store.activeHabits();
    const doneN = all.filter((h) => Store.isDone(h.id, dateKey)).length;
    const pct = all.length ? Math.round((doneN / all.length) * 100) : 0;

    const rows = all.map((h) => {
      const done = Store.isDone(h.id, dateKey);
      return `
        <div class="habit compact day-row${done ? ' done' : ''}">
          <button class="check${done ? ' done' : ''}" data-action="toggle-day" data-id="${h.id}" data-date="${dateKey}"
            aria-label="${done ? 'Mark as not done' : 'Mark as done'}" title="${done ? 'Undo' : 'Done'}">${checkSvg()}</button>
          <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
          <div class="h-main"><div class="h-name">${Utils.esc(h.name)}</div></div>
        </div>`;
    }).join('');

    const body = UI.el('div', {}, [
      UI.el('div', { class: 'day-head' },
        UI.el('div', {},
          UI.el('h3', {}, Utils.fmtDayTitle(dateKey)),
          UI.el('p', {}, all.length ? `${doneN} of ${all.length} habits completed` : 'No active habits yet — create one first.'),
        ),
        UI.el('span', { class: `day-badge${doneN === all.length && all.length ? ' full' : ''}` }, all.length ? `${pct}%` : '—'),
      ),
      all.length ? UI.el('div', { class: 'day-list' }, htmlToNode(rows)) : null,
    ]);

    const foot = UI.el('div', { class: 'btn-row' },
      UI.el('button', { class: 'btn ghost', 'data-action': 'day-none', 'data-date': dateKey, disabled: !all.length }, 'Clear day'),
      UI.el('button', { class: 'btn primary', 'data-action': 'day-all', 'data-date': dateKey, disabled: !all.length }, 'All done'),
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

    const archived = draft.id
      ? `<div class="form-row checkrow"><label class="check-label"><input type="checkbox" id="h-arch"${draft.archived ? ' checked' : ''}> Archive <small>(hidden from Today)</small></label></div>`
      : '';

    const body = UI.el('div', { class: 'editor' }, [
      htmlToNode(row('Name', `<input class="field" id="h-name" maxlength="48" placeholder="e.g. Drink water" value="${Utils.esc(draft.name)}">`)),
      htmlToNode(row('Icon', emojiGrid)),
      htmlToNode(row('Color', swatches)),
      htmlToNode(row('Weekly goal', targets, 'target check-ins per week')),
      htmlToNode(row('Allowed days', days, 'optional — none means any day')),
      htmlToNode(archived),
    ]);

    const foot = UI.el('div', { class: 'btn-row' },
      UI.el('button', { class: 'btn ghost', onclick: UI.closeModal }, 'Cancel'),
      UI.el('button', { class: 'btn primary', 'data-action': 'save-habit' }, draft.id ? 'Save changes' : 'Create habit'),
    );

    return UI.modalShell({ title: draft.id ? 'Edit habit' : 'New habit', body, footer: foot });
  }

  return {
    renderToday,
    renderCalendar,
    renderStats,
    renderHabits,
    dayModalHtml,
    habitEditorHtml,
  };
})();