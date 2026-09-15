/*
 * new-session.js — starts a session handoff file from the template.
 *
 *   node scripts/new-session.js "analytics trend lines"
 *   → creates docs/sessions/2026-09-15-analytics-trend-lines.md
 *
 * The session workflow lives in docs/WORKFLOW.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'docs', 'sessions');
const TEMPLATE = path.join(SESSIONS_DIR, '_TEMPLATE.md');

const topic = (process.argv[2] || 'untitled').trim();
const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
const date = new Date().toISOString().slice(0, 10);
const file = path.join(SESSIONS_DIR, `${date}-${slug}.md`);

if (!fs.existsSync(TEMPLATE)) {
  console.error('❌ Template missing:', TEMPLATE);
  process.exit(1);
}
if (fs.existsSync(file)) {
  console.error(`⚠️  Already exists: ${path.relative(ROOT, file)} — edit that one instead.`);
  process.exit(1);
}

const content = fs
  .readFileSync(TEMPLATE, 'utf8')
  .replace(/{{date}}/g, date)
  .replace(/{{topic}}/g, topic);

fs.writeFileSync(file, content);
console.log(`📝 Session file created: ${path.relative(ROOT, file)}`);
console.log('Fill it in (see docs/WORKFLOW.md — ending a session), then commit:');
console.log('  git add -A && git commit -m "docs: handoff ' + date + ': ' + topic.toLowerCase() + '"');