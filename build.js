/*
 * AHA(bit) tracker — zero-dependency build tool.
 *
 *   node build.js dev    → tiny static dev server (serves src/ so you can iterate fast)
 *   node build.js build  → inlines styles.css + js/*.js into a single dist/index.html
 *
 * The result is one self-contained HTML file: no network, no dependencies,
 * works from file:// or any static host.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// Load order matters — each file attaches to a global namespace (Utils, UI, Store, Render, App).
const JS_ORDER = ['utils.js', 'ui.js', 'store.js', 'render.js', 'app.js'];

function build() {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const js = JS_ORDER
    .map((f) => {
      const code = fs.readFileSync(path.join(SRC, 'js', f), 'utf8');
      return `/* ============ js/${f} ============ */\n${code}\n`;
    })
    .join('\n');

  const out = html
    // inline the stylesheet (also removes the dev <link>)
    .replace(/<link rel="stylesheet" href="styles\.css">\s*<!--STYLES-->/, () => `<style>\n${css}\n</style>`)
    // inline the scripts (also removes the dev <script> tags)
    .replace(/(?:\s*<script src="js\/[^"]+\.js"><\/script>)*\s*<!--SCRIPTS-->/, () => `<script>\n${js}\n</script>`);

  fs.mkdirSync(DIST, { recursive: true });
  const file = path.join(DIST, 'index.html');
  fs.writeFileSync(file, out);

  const size = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`✅ Built ${path.relative(ROOT, file)} (${size} KB — single file, no dependencies)`);
}

function devServer(port) {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };

  http
    .createServer((req, res) => {
      let raw = decodeURIComponent((req.url || '/').split('?')[0]);
      if (raw === '/') raw = '/index.html';
      const file = path.normalize(path.join(SRC, raw));
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => {
      console.log(`🛠  Dev server:  http://localhost:${port}/`);
      console.log('   (Ctrl+C to stop · run `node build.js build` to produce the single-file build)');
    });
}

const cmd = process.argv[2];
if (cmd === 'dev') {
  devServer(Number(process.env.PORT || 8000));
} else if (cmd === 'build') {
  build();
} else {
  console.log('Usage: node build.js [dev|build]');
}