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

  // Font choices are **system stacks only** (no external fonts — DECISIONS §7),
  // and every stack ends in a generic family so it always resolves on any OS.
  // `body: false` marks display-only faces, kept out of the body picker.
  const FONT_LIST = [
    { id: 'theme', label: 'Theme default', stack: null },
    { id: 'system', label: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif' },
    { id: 'rounded', label: 'Rounded', stack: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Segoe UI Variable Display", system-ui, sans-serif' },
    { id: 'sans', label: 'Neutral', stack: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif' },
    { id: 'humanist', label: 'Humanist', stack: '"Segoe UI", Optima, Candara, "Trebuchet MS", "Noto Sans", system-ui, sans-serif' },
    { id: 'geometric', label: 'Geometric', stack: 'Futura, "Century Gothic", "Avenir Next", Avenir, "URW Gothic", "Noto Sans", system-ui, sans-serif' },
    { id: 'condensed', label: 'Condensed', stack: '"Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", "Liberation Sans Narrow", "Noto Sans", system-ui, sans-serif' },
    { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", "Liberation Serif", "Nimbus Roman", Times, serif' },
    { id: 'reading', label: 'Reading serif', stack: 'ui-serif, "New York", "Iowan Old Style", Charter, "Bitstream Charter", Georgia, serif' },
    { id: 'oldstyle', label: 'Old-style', stack: '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", Georgia, serif' },
    { id: 'slab', label: 'Slab serif', stack: 'Rockwell, "Roboto Slab", "Courier New", Georgia, serif' },
    { id: 'mono', label: 'Monospace', stack: 'ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace' },
    { id: 'typewriter', label: 'Typewriter', stack: '"Courier New", Courier, "Nimbus Mono PS", "Liberation Mono", monospace' },
    { id: 'display', label: 'Display', stack: 'Impact, Haettenschweiler, "Arial Black", "Franklin Gothic Bold", system-ui, sans-serif', body: false },
    { id: 'playful', label: 'Playful', stack: '"Comic Sans MS", "Chalkboard SE", "Comic Sans", cursive', body: false },
  ];
  const FONTS = {};
  FONT_LIST.forEach((f) => (FONTS[f.id] = f.stack));
  const FONT_OPTIONS = FONT_LIST.map((f) => ({ id: f.id, label: f.label, body: f.body !== false }));

  const blank = () => ({ colors: {}, font: 'theme', displayFont: 'theme', hidden: {} });
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
  }

  function clearHidden() {
    state.hidden = {};
    save();
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

  /** Push all overrides onto <html>; clears previous ones first. */
  function apply() {
    const root = document.documentElement;
    if (!root || !root.style) return;
    for (const t of TOKENS.concat(['--grad', '--grad-soft', '--font', '--font-display', '--on-accent'])) {
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
      }
    }
    if (state.font !== 'theme') root.style.setProperty('--font', FONTS[state.font]);
    if (state.displayFont !== 'theme') root.style.setProperty('--font-display', FONTS[state.displayFont]);
  }

  function resetAll() {
    state = blank();
    save();
    apply();
  }

  return {
    KEY, COLORS, FONTS, FONT_OPTIONS,
    load, save, get, apply, tokenValue,
    setColor, clearColors, hasCustomColors,
    setFont, clearFonts, hasCustomFonts,
    isHidden, setHidden, clearHidden,
    resetAll,
  };
})();
