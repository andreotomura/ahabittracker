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

  // Theme registry — single source of truth shared by App (apply/persist) and
  // the picker. `colors` are preview swatches; `color` is the browser/status-bar
  // tint applied to <meta name="theme-color">. CSS token sets live in styles.css.
  const THEMES = [
    { id: 'zen', name: 'Zen', emoji: '🌸', scheme: 'light', color: '#f4f5fb', colors: ['#6d5df6', '#a855f7', '#ff5c8a', '#f4f5fb'] },
    { id: 'midnight', name: 'Midnight', emoji: '🌙', scheme: 'dark', color: '#0e1017', colors: ['#0e1017', '#191c2b', '#8a7cf5', '#ff5c8a'] },
    { id: 'paper', name: 'Paper', emoji: '📜', scheme: 'light', color: '#f4ecdd', colors: ['#fffaf1', '#a8560a', '#c98a3a', '#3b3226'] },
    { id: 'brutalist', name: 'Brutalist', emoji: '⬛', scheme: 'light', color: '#f4f1e8', colors: ['#ffffff', '#0a0a0a', '#ff3b00', '#ffd400'] },
    { id: 'brutalist-dark', name: 'Brutalist Dark', emoji: '🟨', scheme: 'dark', color: '#0a0a0a', colors: ['#0a0a0a', '#f5f5f5', '#ffe600', '#ff3b00'] },
  ];

  /** Pickable list of themes, with the active one marked. */
  const themePickerHtml = (active) =>
    THEMES.map((t) => `
      <button class="theme-opt${t.id === active ? ' sel' : ''}" data-action="set-theme" data-theme="${t.id}" role="menuitem" aria-pressed="${t.id === active}">
        <span class="theme-swatches">${t.colors.map((c) => `<i class="theme-swatch" style="background:${c}"></i>`).join('')}</span>
        <span class="t-name">${t.emoji} ${t.name}</span>
        ${t.id === active ? '<span class="t-check">✓</span>' : ''}
      </button>`).join('');

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

  function renderToday(showWelcome) {
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
        const count = Store.countFor(h.id, tKey);
        const note = Store.getNote(h.id, tKey);
        const streak = Store.streakFor(h.id);
        const wp = Store.weekProgress(h.id);
        const meta = [];
        if (streak.current > 0) meta.push(`🔥 ${streak.current}d streak`);
        else if (streak.best > 0) meta.push(`best ${streak.best}d`);
        if (wp) meta.push(`this week ${wp.done}/${wp.target}`);
        return `
          <div class="habit${isDone ? ' done' : ''}">
            <button class="check${isDone ? ' done' : ''}" data-action="toggle" data-id="${h.id}"
              aria-label="${isDone ? 'Mark as not done' : 'Mark as done'}" title="${isDone ? (count > 1 ? `Undo all (×${count})` : 'Undo') : 'Done'}">${checkSvg()}</button>
            <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
            <div class="h-main">
              <div class="h-name">${Utils.esc(h.name)}</div>
              <div class="h-meta">${meta.join(' · ') || 'New habit — go for it!'}</div>
              ${wp ? `<div class="weekbar"><div class="weekbar-fill" style="width:${Math.round((wp.done / wp.target) * 100)}%"></div></div>` : ''}
              ${isDone || note
                ? `<input class="note-field" data-action="note" data-id="${h.id}" data-date="${tKey}" maxlength="240"
                    placeholder="Add a note…" value="${Utils.esc(note)}" aria-label="Note for ${Utils.esc(h.name)}">`
                : ''}
            </div>
            ${isDone ? stepper(h.id, tKey, count) : ''}
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

      ${showWelcome ? welcomeCard() : ''}

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
      <p class="cal-hint">${!Object.keys(summary).length && Store.activeHabits().length
        ? 'No check-ins this month — tap a day to backfill or add one.'
        : 'Tip: click any day to backfill or fix a check-in.'}</p>
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
    const meta = [`${Math.round(trend.rate * 100)}% · 30 days`];
    if (wp) meta.push(`this week ${wp.done}/${wp.target}`);
    return `<div class="health-card card" style="--i:${i}">
      <span class="h-emoji" style="--c:${h.color}">${h.emoji}</span>
      <div class="health-main">
        <div class="health-top">
          <span class="h-name">${Utils.esc(h.name)}</span>
          ${trendArrow(trend.direction)}
        </div>
        ${sparkline(trend.points, h.color, 260, 40)}
        <div class="health-meta">${meta.join(' · ')}</div>
      </div>
      ${scoreRing(health.score)}
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
  function heatmapCard() {
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

    return `
      <div class="card heat-card">
        <div class="heat-head">
          <h3>Activity heatmap</h3>
          <span>last 12 months</span>
        </div>
        <div class="heat-months">${monthCells}</div>
        <div class="heat-grid">${cellHtml}</div>
        <div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="heat-cell h${l}"></i>`).join('')}<span>More</span></div>
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

    const view = UI.q('#view-stats');
    view.innerHTML = `
      <div class="stats-head">
        <h2>Your stats</h2>
        <p>Patterns, momentum, and per-habit health across all your check-ins.</p>
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
        <div class="stat-card card">
          <div class="stat-num">${actives.length ? ins.avgHealth : '—'}</div>
          <div class="stat-label">Average health score</div>
        </div>
      </div>

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
      </div>

      ${healthList}

      <div class="card weekday-card">
        <div class="section-head">
          <h3>Weekday rhythm</h3>
          <span>Last 12 weeks</span>
        </div>
        ${weekdayBars(wdRates)}
        <p class="section-note">${rhythmNote}</p>
      </div>

      <div class="card insights-card">
        <div class="section-head"><h3>Insights</h3></div>
        <ul class="insight-list">${insightItems.join('')}</ul>
      </div>

      ${heatmapCard()}

      <p class="section-note analytics-note">Health score = 40% consistency + 30% weekly-target attainment + 30% current streak (habits with no weekly goal use 70% consistency + 30% streak).</p>
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
    themePickerHtml,
    THEMES,
  };
})();