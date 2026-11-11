/*
 * icons.js — zero-dependency PNG icon generation for the PWA build.
 *
 * Rasterizes the brand mark (gradient rounded square + white "AHA") and encodes
 * PNGs by hand with Node's built-in `zlib`, so the project keeps its
 * no-npm-dependencies promise. Pure functions — `buildPng(size, {maskable})`
 * returns a Buffer; `writeIconFiles(dir)` writes the standard set.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------------- PNG encoding ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10..12 = compression/filter/interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- Brand mark raster ---------------- */

// Matches --grad in styles.css (135°): #6d5df6 → #a855f7 → #ff5c8a.
const STOPS = [
  [0x6d, 0x5d, 0xf6],
  [0xa8, 0x55, 0xf7],
  [0xff, 0x5c, 0x8a],
];

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function gradient(t) {
  t = Math.max(0, Math.min(1, t));
  return t <= 0.45 ? mix(STOPS[0], STOPS[1], t / 0.45) : mix(STOPS[1], STOPS[2], (t - 0.45) / 0.55);
}

function distToSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const L = vx * vx + vy * vy || 1;
  let t = ((px - ax) * vx + (py - ay) * vy) / L;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * The "AHA" brand mark as stroke segments in 0–1 space.
 * Keep in sync with the topbar <svg> and the favicon data URI in
 * `src/index.html` (both use the equivalent 0–100 path).
 */
const AHA_SEGMENTS = (() => {
  const top = 0.30, bot = 0.72, aw = 0.10, bar = 0.57;
  const t = (bar - top) / (bot - top);
  const A = (cx) => [
    [cx, top, cx - aw, bot],
    [cx, top, cx + aw, bot],
    [cx - aw * t, bar, cx + aw * t, bar],
  ];
  return [
    ...A(0.23),
    [0.40, top, 0.40, bot],
    [0.60, top, 0.60, bot],
    [0.40, 0.52, 0.60, 0.52],
    ...A(0.77),
  ];
})();

/**
 * Render the icon to an RGBA buffer.
 * `maskable` draws a full-bleed square (safe for OS masking) with the glyph
 * pulled into the central ~78% safe zone; otherwise a rounded square.
 */
function rasterIcon(size, maskable) {
  const SS = 2; // supersampling factor (anti-aliasing)
  const rgba = Buffer.alloc(size * size * 4);
  const radius = 0.22;
  const scale = maskable ? 0.78 : 1;
  const halfWidth = 0.035 * scale;
  const strokes = AHA_SEGMENTS.map(([ax, ay, bx, by]) => [
    0.5 + (ax - 0.5) * scale,
    0.5 + (ay - 0.5) * scale,
    0.5 + (bx - 0.5) * scale,
    0.5 + (by - 0.5) * scale,
  ]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;

          // shape alpha (rounded rect SDF) — full bleed when maskable
          let shape = 1;
          if (!maskable) {
            const qx = Math.abs(u - 0.5) - (0.5 - radius);
            const qy = Math.abs(v - 0.5) - (0.5 - radius);
            const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
            const inside = Math.min(Math.max(qx, qy), 0);
            const sdf = outside + inside - radius;
            shape = clamp01(0.5 - sdf * size);
          }

          let [cr, cg, cb] = gradient((u + v) / 2);

          let d = Infinity;
          for (const s of strokes) d = Math.min(d, distToSeg(u, v, s[0], s[1], s[2], s[3]));
          const white = clamp01(0.5 - (d - halfWidth) * size);
          cr += (255 - cr) * white;
          cg += (255 - cg) * white;
          cb += (255 - cb) * white;

          r += cr; g += cg; b += cb; a += shape;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      rgba[o] = Math.round(r / n);
      rgba[o + 1] = Math.round(g / n);
      rgba[o + 2] = Math.round(b / n);
      rgba[o + 3] = Math.round((a / n) * 255);
    }
  }
  return rgba;
}

function buildPng(size, { maskable = false } = {}) {
  return encodePng(size, size, rasterIcon(size, maskable));
}

/** Writes icon-192.png, icon-512.png and icon-maskable-512.png into `dir`. */
function writeIconFiles(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [
    ['icon-192.png', buildPng(192)],
    ['icon-512.png', buildPng(512)],
    ['icon-maskable-512.png', buildPng(512, { maskable: true })],
  ];
  for (const [name, buf] of files) fs.writeFileSync(path.join(dir, name), buf);
  return files.map(([name]) => name);
}

module.exports = { buildPng, writeIconFiles, encodePng, rasterIcon, crc32, AHA_SEGMENTS };
