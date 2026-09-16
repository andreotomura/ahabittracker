/*
 * AHA(bit) tracker — zero-dependency build tool.
 *
 *   node build.js dev [dir]  → tiny static dev server (defaults to src/)
 *   node build.js build      → inlines CSS + JS into a single dist/index.html
 *   node build.js pwa        → build + manifest, service worker and icons in dist/pwa/
 *
 * `build` keeps the promise: one self-contained HTML file, works from file://.
 * `pwa` is the hosted variant — the same inlined HTML plus sidecar files that
 * make it installable/offline over http(s). Still zero dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const { manifest, serviceWorker, PWA_HEAD } = require('./scripts/pwa.js');
const { writeIconFiles } = require('./scripts/icons.js');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// Load order matters — each file attaches to a global namespace (Utils, UI, Store, Render, App).
const JS_ORDER = ['utils.js', 'ui.js', 'store.js', 'prefs.js', 'render.js', 'app.js'];

/** Inline styles.css + all JS into the src/index.html shell. */
function inlineHtml() {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const js = JS_ORDER
    .map((f) => {
      const code = fs.readFileSync(path.join(SRC, 'js', f), 'utf8');
      return `/* ============ js/${f} ============ */\n${code}\n`;
    })
    .join('\n');

  return html
    // inline the stylesheet (also removes the dev <link>)
    .replace(/<link rel="stylesheet" href="styles\.css">\s*<!--STYLES-->/, () => `<style>\n${css}\n</style>`)
    // inline the scripts (also removes the dev <script> tags)
    .replace(/(?:\s*<script src="js\/[^"]+\.js"><\/script>)*\s*<!--SCRIPTS-->/, () => `<script>\n${js}\n</script>`);
}

const withoutPwa = (html) => html.replace(/\n?[ \t]*<!--PWA-->/, '');
const withPwa = (html) => html.replace(/[ \t]*<!--PWA-->/, `${PWA_HEAD}\n`);

function build() {
  const out = withoutPwa(inlineHtml());
  fs.mkdirSync(DIST, { recursive: true });
  const file = path.join(DIST, 'index.html');
  fs.writeFileSync(file, out);

  const size = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`✅ Built ${path.relative(ROOT, file)} (${size} KB — single file, no dependencies)`);
}

function buildPwa() {
  const out = withPwa(inlineHtml());
  const dir = path.join(DIST, 'pwa');
  fs.mkdirSync(dir, { recursive: true });

  // The cache name is derived from the HTML, so any content change ships a new
  // service worker (browsers then re-install and refresh the cache).
  const version = crypto.createHash('sha1').update(out).digest('hex').slice(0, 8);

  const files = [
    ['index.html', out],
    ['manifest.webmanifest', manifest()],
    ['sw.js', serviceWorker(version)],
  ];
  for (const [name, content] of files) fs.writeFileSync(path.join(dir, name), content);
  const icons = writeIconFiles(dir);

  const size = (Buffer.byteLength(out) / 1024).toFixed(1);
  console.log(`✅ Built ${path.relative(ROOT, dir)}/ (index.html ${size} KB + manifest + sw.js + ${icons.length} icons)`);
  console.log(`   Serve over http(s) and install:  node build.js dev ${path.relative(ROOT, dir)}`);
}

function devServer(port, rootArg) {
  const root = path.resolve(rootArg || SRC);
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };

  http
    .createServer((req, res) => {
      let raw = decodeURIComponent((req.url || '/').split('?')[0]);
      if (raw === '/') raw = '/index.html';
      const file = path.normalize(path.join(root, raw));
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => {
      console.log(`🛠  Dev server:  http://localhost:${port}/   (serving ${path.relative(ROOT, root) || '.'}/)`);
      console.log('   (Ctrl+C to stop · `node build.js build` makes the single-file build)');
    });
}

const cmd = process.argv[2];
if (cmd === 'dev') {
  devServer(Number(process.env.PORT || 8000), process.argv[3]);
} else if (cmd === 'build') {
  build();
} else if (cmd === 'pwa' || cmd === 'build:pwa') {
  buildPwa();
} else {
  console.log('Usage: node build.js [dev [dir] | build | pwa]');
}
