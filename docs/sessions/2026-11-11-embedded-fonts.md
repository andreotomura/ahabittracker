<!-- Best practice: fill every section. Be honest and explicit — especially
about half-done work and failures. The next session (possibly a different
LLM) has zero memory and will trust this file. -->

# Session 2026-11-11 — embedded fonts

**Status:** ✅ finished
**Agent/tool:** pi (coding agent)
**Related docs touched:** DECISIONS §24 added (refines §7); ROADMAP,
ARCHITECTURE, CONTEXT, README updated.

## Goal

The font picker used system stacks only, so a chosen face rendered correctly
only when the OS happened to have it. Make the fonts render everywhere **without
being preinstalled**.

## What was done

- **Downloaded 13 open-source families** (Latin WOFF2 subset) into
  `src/fonts/` — Inter, Nunito, Poppins, Source Sans 3, Roboto Condensed,
  Source Serif 4, Literata, EB Garamond, Roboto Slab, JetBrains Mono, Courier
  Prime, Archivo Black, Comic Neue (16 files; static faces have 400+700).
  Licences in `src/fonts/LICENSES.md` (OFL-1.1 / Apache-2.0).
- **`src/fonts.css`** declares the `@font-face` rules (variable fonts use a
  `400 700` weight range; static use one block per weight). `display: swap`.
- **`src/index.html`** links `fonts.css` before `styles.css`.
- **`build.js`**: new `inlineFonts()` rewrites `url(fonts/x.woff2)` →
  `data:font/woff2;base64,…` and inlines the sheet with the rest of the CSS; the
  dev server MIME map gained `.woff2`. Build throws if a font file is missing.
- **`src/js/prefs.js`**: every picker stack now **leads with the embedded
  family**, then OS faces, then a mandatory generic tail. Labels/ids unchanged.
- **`src/styles.css`**: default `--font` → Nunito-first; paper `--font-display`
  → Source Serif 4; gruvbox/brutalist `--font`/`--font-display` → embedded
  Inter/JetBrains Mono.
- **`scripts/smoke.js`**: new “embedded fonts” suite — `@font-face` present for
  all 13, ≥13 WOFF2 files with a valid `wOF2` signature, licence file present,
  and each picker stack leading with its embedded family.
- **Docs:** DECISIONS §24, ROADMAP milestone, ARCHITECTURE (build/theming),
  CONTEXT (repo map, state, conventions), README.

## Key decisions & changes

- **DECISIONS §24.** §7's “no external fonts” meant “don’t fetch webfonts from a
  CDN / no network”; that intent is kept — the fonts are now *part of the
  artifact*. §7's no-network rule is unchanged; its “no external fonts” wording
  is superseded.
- **Latin subset only.** No italic files (the browser synthesises obliqueness
  for the rare `<em>`); keeps size down.
- Exact Latin URLs were extracted from the Google Fonts CSS by matching the
  `unicode-range: … U+0000-00FF …` block (the last block per family).

## Files touched

- `src/fonts/*.woff2` (new, 16 files), `src/fonts/LICENSES.md` (new),
  `src/fonts.css` (new)
- `src/index.html` — link `fonts.css`
- `build.js` — `inlineFonts()` + `.woff2` MIME
- `src/js/prefs.js` — embedded-first font stacks
- `src/styles.css` — theme `--font` / `--font-display` defaults
- `scripts/smoke.js` — embedded-font suite
- `docs/DECISIONS.md` §24, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`,
  `docs/CONTEXT.md`, `README.md`

## Verification

- `npm test` → ✅ all passed (new embedded-font suite included).
- `npm run build` → ✅ `dist/index.html` **808.9 KB** (was ~183 KB).
- `npm run build:pwa` → ✅.
- Self-contained check on the build: **16** `data:font/woff2;base64` URIs,
  **0** `url(fonts/…)`, **0** `fonts.gstatic.com` / `fonts.googleapis.com`; the
  only `http://` left is the SVG namespace.
- WOFF2 signature check: all 16 files start with `wOF2`.

## State of the app

Working. The single-file and PWA builds are still fully offline and
dependency-free; typography no longer depends on the host. **Not yet seen in a
real browser** — a visual pass of the picker across all 15 options is still owed
(also true of the v0.13 theme studio).

Trade-off to keep in mind: the embedded fonts are ~623 KB of base64, so the
single file is ~810 KB. Still fine for a local-first app, but revisit if it
matters (e.g. drop `Roboto Condensed`/`Source Serif 4`, or subset further).

## NEXT STEPS (for the next session)

1. **Real-browser visual pass**: cycle all 15 font options + all 11 presets and
   confirm each renders (fonts are now guaranteed present, so any mismatch is a
   CSS/mapping bug). Check `src/styles.css` and `src/js/prefs.js`.
2. Optional: reduce bundle weight if ~810 KB is undesirable.
3. Theme JSON export/import and folder filtering remain deferred (see ROADMAP).

## Context dump

- **Fonts are fetched in dev, embedded in the build.** Editing `src/fonts.css`
  and refreshing `npm run dev` works because the dev server serves `src/fonts/`.
  `npm run build` must be re-run after adding/changing a font.
- **To add a font:** drop the Latin `.woff2` into `src/fonts/`, add an
  `@font-face` to `src/fonts.css`, lead a stack in `Prefs.FONT_LIST` with the
  family name, and add the family to the smoke test's `bundledFamilies`.
- **Licensing:** keep `src/fonts/LICENSES.md` in sync. Only redistribute OFL /
  Apache faces — do **not** add proprietary faces (Segoe UI, SF Pro, Helvetica…).
- Theme defaults now name embedded families; if a theme is added, give it an
  embedded `--font`/`--font-display` (or inherit `:root`).
