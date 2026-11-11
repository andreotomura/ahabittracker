/*
 * prefs.js — user customisation (appearance + layout), stored as UI-only state.
 *
 * Nothing here touches the exported database: like the theme and welcome flag,
 * preferences live in localStorage (`ahabit.prefs.v1`) and are applied as inline
 * CSS custom properties on <html> (so they layer over the active theme's token
 * set) plus a per-section visibility map that Render consults.
 *
 * Attaches to the global `Prefs` namespace.
 */
'use strict';

const Prefs = (() => {
  const KEY = 'ahabit.prefs.v1';

  // Customisable colour tokens, grouped for the settings UI. Gradients
  // (`--grad`, `--grad-soft`) and `--on-accent` are derived from these.
  const COLORS = [
    { group: 'Surfaces', token: '--bg', label: 'Background' },
    { token: '--bg-soft', label: 'Background soft' },
    { token: '--card', label: 'Surface' },
    { token: '--card-2', label: 'Surface soft' },
    { group: 'Text', token: '--text', label: 'Text' },
    { token: '--text-2', label: 'Muted' },
    { token: '--text-3', label: 'Faint' },
    { group: 'Accent', token: '--accent', label: 'Accent' },
    { token: '--accent-2', label: 'Accent 2' },
    { group: 'Lines', token: '--border', label: 'Lines' },
    { token: '--border-strong', label: 'Lines strong' },
    { group: 'Feedback', token: '--ok', label: 'Success' },
    { token: '--warn', label: 'Warning' },
    { token: '--err', label: 'Danger' },
    { group: 'Heatmap', token: '--heat-1', label: 'Level 1' },
    { token: '--heat-2', label: 'Level 2' },
    { token: '--heat-3', label: 'Level 3' },
    { token: '--heat-4', label: 'Level 4' },
  ];
  const TOKENS = COLORS.map((c) => c.token);

  // Font choices. Each stack starts with an **embedded** open-source family
  // (src/fonts.css) so the choice renders even with no fonts preinstalled, then
  // falls back to OS faces and ends in a generic family (so it always resolves).
  // `body: false` marks display-only faces, kept out of the body picker.
  const FONT_LIST = [
    { id: 'theme', label: 'Theme default', stack: null },
    { id: 'system', label: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif' },
    { id: 'rounded', label: 'Rounded', stack: '"Nunito", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif' },
    { id: 'sans', label: 'Neutral', stack: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
    { id: 'humanist', label: 'Humanist', stack: '"Source Sans 3", "Segoe UI", Optima, Candara, "Trebuchet MS", system-ui, sans-serif' },
    { id: 'geometric', label: 'Geometric', stack: '"Poppins", Futura, "Century Gothic", "Avenir Next", Avenir, system-ui, sans-serif' },
    { id: 'condensed', label: 'Condensed', stack: '"Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", system-ui, sans-serif' },
    { id: 'serif', label: 'Serif', stack: '"Source Serif 4", Georgia, "Times New Roman", "Liberation Serif", Times, serif' },
    { id: 'reading', label: 'Reading serif', stack: '"Literata", ui-serif, "New York", "Iowan Old Style", Charter, Georgia, serif' },
    { id: 'oldstyle', label: 'Old-style', stack: '"EB Garamond", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
    { id: 'slab', label: 'Slab serif', stack: '"Roboto Slab", Rockwell, "Courier New", Georgia, serif' },
    { id: 'mono', label: 'Monospace', stack: '"JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace' },
    { id: 'typewriter', label: 'Typewriter', stack: '"Courier Prime", "Courier New", Courier, "Nimbus Mono PS", monospace' },
    { id: 'display', label: 'Display', stack: '"Archivo Black", Impact, Haettenschweiler, "Arial Black", system-ui, sans-serif', body: false },
    { id: 'playful', label: 'Playful', stack: '"Comic Neue", "Comic Sans MS", "Chalkboard SE", cursive', body: false },
  ];
  const FONTS = {};
  FONT_LIST.forEach((f) => (FONTS[f.id] = f.stack));
  const FONT_OPTIONS = FONT_LIST.map((f) => ({ id: f.id, label: f.label, body: f.body !== false }));

  // Sorting of the habit list (Today); manual uses each habit's stored `sort`.
  const SORT_MODES = [
    { id: 'manual', label: 'Manual' },
    { id: 'name', label: 'Name' },
    { id: 'streak', label: 'Streak' },
    { id: 'health', label: 'Health' },
    { id: 'newest', label: 'Newest' },
  ];
  const SORT_IDS = SORT_MODES.map((m) => m.id);

  // Structural overrides (inline CSS vars, layered over the theme like colours).
  const STRUCT_OPTIONS = {
    radius: [
      { id: 'theme', label: 'Theme' },
      { id: '0', label: 'Sharp' },
      { id: '8', label: 'Small' },
      { id: '12', label: 'Medium' },
      { id: '16', label: 'Large' },
      { id: '22', label: 'Round' },
    ],
    border: [
      { id: 'theme', label: 'Theme' },
      { id: '0', label: 'None' },
      { id: '1', label: 'Thin' },
      { id: '2', label: 'Bold' },
      { id: '3', label: 'Heavy' },
    ],
    shadow: [
      { id: 'theme', label: 'Theme' },
      { id: 'hard', label: 'Hard' },
      { id: 'none', label: 'None' },
    ],
  };
  const STRUCT_KEYS = Object.keys(STRUCT_OPTIONS);
  const STRUCT_DEFAULT = { radius: 'theme', border: 'theme', shadow: 'theme' };
  const validChoice = (key, value) => STRUCT_OPTIONS[key].some((o) => o.id === String(value));

  function sanitizeStructure(s) {
    const out = { ...STRUCT_DEFAULT };
    if (s && typeof s === 'object') {
      for (const k of STRUCT_KEYS) if (validChoice(k, s[k])) out[k] = String(s[k]);
    }
    return out;
  }

  function sanitizeColors(colors) {
    const out = {};
    if (colors && typeof colors === 'object') {
      for (const t of TOKENS) if (typeof colors[t] === 'string' && /^#[0-9a-f]{6}$/i.test(colors[t])) out[t] = colors[t];
    }
    return out;
  }

  const blank = () => ({
    colors: {}, font: 'theme', displayFont: 'theme', hidden: {},
    collapsed: {}, sortMode: 'manual', doneLast: true,
    structure: { ...STRUCT_DEFAULT }, customThemes: [],
  });
  let state = blank();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const p = raw ? JSON.parse(raw) : null;
      state = blank();
      if (p && typeof p === 'object') {
        if (p.colors && typeof p.colors === 'object') {
          for (const t of TOKENS) if (typeof p.colors[t] === 'string' && /^#[0-9a-f]{6}$/i.test(p.colors[t])) state.colors[t] = p.colors[t];
        }
        if (typeof p.font === 'string' && p.font in FONTS) state.font = p.font;
        if (typeof p.displayFont === 'string' && p.displayFont in FONTS) state.displayFont = p.displayFont;
        if (p.hidden && typeof p.hidden === 'object') for (const k in p.hidden) if (p.hidden[k]) state.hidden[k] = true;
        if (p.collapsed && typeof p.collapsed === 'object') for (const k in p.collapsed) if (p.collapsed[k]) state.collapsed[k] = true;
        if (SORT_IDS.includes(p.sortMode)) state.sortMode = p.sortMode;
        if (typeof p.doneLast === 'boolean') state.doneLast = p.doneLast;
        state.structure = sanitizeStructure(p.structure);
        if (Array.isArray(p.customThemes)) {
          const seen = new Set();
          state.customThemes = p.customThemes
            .map(sanitizeCustomTheme)
            .filter((t) => t && !seen.has(t.id) && seen.add(t.id));
        }
      }
    } catch (_e) {
      state = blank();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_e) {
      /* storage full / unavailable — customisation is best-effort */
    }
  }

  const get = () => state;
  const hasCustomColors = () => Object.keys(state.colors).length > 0;
  const hasCustomFonts = () => state.font !== 'theme' || state.displayFont !== 'theme';

  /* ---------------- Colour maths (for --on-accent) ---------------- */

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  function luminance(hex) {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const s = v.map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }
  const contrast = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /** Readable ink (near-black or white) for a given accent colour. */
  const inkOn = (hex) => (contrast(hex, '#0a0a0a') >= contrast(hex, '#ffffff') ? '#0a0a0a' : '#ffffff');

  /* ---------------- Mutations ---------------- */

  function setColor(token, value) {
    if (!TOKENS.includes(token)) return;
    if (/^#[0-9a-f]{6}$/i.test(value)) state.colors[token] = value;
    else delete state.colors[token];
    save();
    apply();
  }

  function clearColors() {
    state.colors = {};
    save();
    apply();
  }

  function setFont(which, id) {
    if (!(id in FONTS)) id = 'theme';
    if (which === 'display') state.displayFont = id;
    else state.font = id;
    save();
    apply();
  }

  function clearFonts() {
    state.font = 'theme';
    state.displayFont = 'theme';
    save();
    apply();
  }

  const isHidden = (id) => !!state.hidden[id];

  function setHidden(id, hidden) {
    if (hidden) state.hidden[id] = true;
    else delete state.hidden[id];
    save();
    applyChrome();
  }

  function clearHidden() {
    state.hidden = {};
    save();
    applyChrome();
  }

  /* ---------------- List grouping (folders) ---------------- */

  const isCollapsed = (id) => !!state.collapsed[id];

  function setCollapsed(id, collapsed) {
    if (collapsed) state.collapsed[id] = true;
    else delete state.collapsed[id];
    save();
  }

  const toggleCollapsed = (id) => {
    setCollapsed(id, !state.collapsed[id]);
    return isCollapsed(id);
  };

  function clearCollapsed() {
    state.collapsed = {};
    save();
  }

  const sortMode = () => state.sortMode;

  function setSortMode(mode) {
    state.sortMode = SORT_IDS.includes(mode) ? mode : 'manual';
    save();
  }

  const doneLast = () => state.doneLast;
  const setDoneLast = (v) => { state.doneLast = !!v; save(); };

  /* ---------------- Structure ---------------- */

  const structure = () => ({ ...state.structure });
  const hasCustomStructure = () => STRUCT_KEYS.some((k) => state.structure[k] !== 'theme');

  function setStructure(patch) {
    if (patch && typeof patch === 'object') {
      for (const k of STRUCT_KEYS) if (k in patch && validChoice(k, patch[k])) state.structure[k] = String(patch[k]);
    }
    save();
    apply();
  }

  function clearStructure() {
    state.structure = { ...STRUCT_DEFAULT };
    save();
    apply();
  }

  /* ---------------- Custom themes ---------------- */

  /** Validate a saved theme snapshot (used on load). */
  function sanitizeCustomTheme(t) {
    if (!t || typeof t.id !== 'string' || !t.id.startsWith('ct_') || typeof t.name !== 'string') return null;
    return {
      id: t.id,
      name: t.name.trim().slice(0, 32) || 'Custom theme',
      base: typeof t.base === 'string' ? t.base : 'zen',
      colors: sanitizeColors(t.colors),
      font: typeof t.font === 'string' && t.font in FONTS ? t.font : 'theme',
      displayFont: typeof t.displayFont === 'string' && t.displayFont in FONTS ? t.displayFont : 'theme',
      structure: sanitizeStructure(t.structure),
    };
  }

  const customThemes = () => state.customThemes.slice();
  const getCustomTheme = (id) => state.customThemes.find((t) => t.id === id) || null;

  /** Snapshot the current look as a named, reusable theme. */
  function addCustomTheme(fields) {
    const name = String((fields && fields.name) || '').trim().slice(0, 32);
    if (!name) return null;
    const t = sanitizeCustomTheme({
      id: 'ct_' + Utils.uid(),
      name,
      base: (fields && fields.base) || 'zen',
      colors: fields && fields.colors,
      font: fields && fields.font,
      displayFont: fields && fields.displayFont,
      structure: fields && fields.structure,
    });
    if (!t) return null;
    state.customThemes.push(t);
    save();
    return t;
  }

  function updateCustomTheme(id, patch) {
    const t = getCustomTheme(id);
    if (!t) return null;
    if (patch.name != null) {
      const n = String(patch.name).trim().slice(0, 32);
      if (n) t.name = n;
    }
    if (patch.base != null && typeof patch.base === 'string') t.base = patch.base;
    save();
    return t;
  }

  function deleteCustomTheme(id) {
    state.customThemes = state.customThemes.filter((t) => t.id !== id);
    save();
  }

  /** Replace the live overrides with a saved theme snapshot. */
  function applyThemeSnapshot(t) {
    if (!t) return;
    state.colors = sanitizeColors(t.colors);
    state.font = t.font in FONTS ? t.font : 'theme';
    state.displayFont = t.displayFont in FONTS ? t.displayFont : 'theme';
    state.structure = sanitizeStructure(t.structure);
    save();
    apply();
  }

  /* ---------------- Visibility ---------------- */

  /** Replace the whole hidden map (used by layout presets). */
  function setHiddenMap(map) {
    state.hidden = {};
    if (map && typeof map === 'object') for (const k in map) if (map[k]) state.hidden[k] = true;
    save();
    applyChrome();
  }

  /** Toggle static chrome that Render does not own (brand, theme button). */
  function applyChrome() {
    const b = document.body;
    if (!b || !b.classList) return;
    b.classList.toggle('hide-brand', isHidden('global.brand'));
    b.classList.toggle('hide-theme-btn', isHidden('global.theme-btn'));
  }

  /* ---------------- DOM application ---------------- */

  /** Read the effective value of a token (custom override, else computed theme value). */
  function tokenValue(token) {
    if (state.colors[token]) return state.colors[token];
    if (typeof getComputedStyle === 'function' && document.documentElement) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    }
    return '#888888';
  }

  const STRUCT_VARS = [
    '--radius', '--radius-sm', '--border-w',
    '--shadow', '--shadow-lift', '--glow', '--glow-soft', '--glow-strong', '--danger-glow',
    '--heat-1', '--heat-2', '--heat-3', '--heat-4',
  ];

  /** Push all overrides onto <html>; clears previous ones first. */
  function apply() {
    const root = document.documentElement;
    if (!root || !root.style) return;
    for (const t of TOKENS.concat(['--grad', '--grad-soft', '--font', '--font-display', '--on-accent'], STRUCT_VARS)) {
      root.style.removeProperty(t);
    }
    for (const token in state.colors) root.style.setProperty(token, state.colors[token]);

    if (hasCustomColors()) {
      const a = state.colors['--accent'];
      const b = state.colors['--accent-2'];
      if (a) {
        root.style.setProperty('--grad', b && b !== a ? `linear-gradient(135deg, ${a}, ${b})` : a);
        root.style.setProperty('--grad-soft', `linear-gradient(135deg, color-mix(in srgb, ${a} 14%, transparent), color-mix(in srgb, ${b || a} 14%, transparent))`);
        root.style.setProperty('--on-accent', inkOn(a));

        // Derive a matching heatmap ramp unless the user set one explicitly.
        const heatCustom = ['--heat-1', '--heat-2', '--heat-3', '--heat-4'].some((k) => state.colors[k]);
        if (!heatCustom) {
          root.style.setProperty('--heat-1', `color-mix(in srgb, ${a} 22%, var(--card))`);
          root.style.setProperty('--heat-2', `color-mix(in srgb, ${a} 45%, var(--card))`);
          root.style.setProperty('--heat-3', `color-mix(in srgb, ${a} 72%, var(--card))`);
          root.style.setProperty('--heat-4', a);
        }
      }
    }
    if (state.font !== 'theme') root.style.setProperty('--font', FONTS[state.font]);
    if (state.displayFont !== 'theme') root.style.setProperty('--font-display', FONTS[state.displayFont]);

    const s = state.structure;
    if (s.radius !== 'theme') {
      const r = Number(s.radius);
      root.style.setProperty('--radius', `${r}px`);
      root.style.setProperty('--radius-sm', `${Math.max(0, r - 4)}px`);
    }
    if (s.border !== 'theme') root.style.setProperty('--border-w', `${Number(s.border)}px`);
    if (s.shadow === 'none') {
      root.style.setProperty('--shadow', 'none');
      root.style.setProperty('--shadow-lift', 'none');
      root.style.setProperty('--glow', 'none');
      root.style.setProperty('--glow-soft', 'none');
      root.style.setProperty('--glow-strong', 'none');
      root.style.setProperty('--danger-glow', 'none');
    } else if (s.shadow === 'hard') {
      root.style.setProperty('--shadow', '4px 4px 0 var(--border-strong)');
      root.style.setProperty('--shadow-lift', '6px 6px 0 var(--border-strong)');
      root.style.setProperty('--glow', '2px 2px 0 var(--border-strong)');
      root.style.setProperty('--glow-soft', '2px 2px 0 var(--border-strong)');
      root.style.setProperty('--glow-strong', '4px 4px 0 var(--border-strong)');
      root.style.setProperty('--danger-glow', '3px 3px 0 var(--err)');
    }
    applyChrome();
  }

  function resetAll() {
    const savedThemes = state.customThemes; // keep saved themes; only reset the live look
    state = blank();
    state.customThemes = savedThemes || [];
    save();
    apply();
  }

  return {
    KEY, COLORS, FONTS, FONT_OPTIONS, SORT_MODES, STRUCT_OPTIONS,
    load, save, get, apply, applyChrome, tokenValue,
    setColor, clearColors, hasCustomColors,
    setFont, clearFonts, hasCustomFonts,
    structure, setStructure, clearStructure, hasCustomStructure,
    customThemes, getCustomTheme, addCustomTheme, updateCustomTheme, deleteCustomTheme, applyThemeSnapshot,
    isHidden, setHidden, setHiddenMap, clearHidden,
    isCollapsed, setCollapsed, toggleCollapsed, clearCollapsed,
    sortMode, setSortMode, doneLast, setDoneLast,
    resetAll,
  };
})();
