// Gates to run on a draw(f) scene before anyone watches it.
//
//   node check.mjs scene.html [--sheet sheet.png --video out.mp4]
//
// 1. no page errors while drawing every frame
// 2. no clock or randomness read while drawing (Date, performance.now, Math.random, timers)
// 3. determinism: sample frames drawn in order and again in reverse, in a fresh page, hash the same
// 4. no blank frames (one flat colour over 99.5% of a downscaled screenshot), frame 0 included: it is the thumbnail
// 5. optional contact sheet of the rendered MP4 (one frame per second) for a visual review

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// require() rather than import, so a global Playwright install (NODE_PATH) also resolves.
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const sheet = opt('--sheet');
const videoPath = opt('--video');
const [scenePath] = args;
const url = pathToFileURL(resolve(scenePath)).href + '?render';

// Installed before the page's own scripts: count every clock or dice read made inside drawFrame.
const trap = () => {
  window.__reads = [];
  let drawing = false;
  const wrap = (obj, key, label) => {
    const orig = obj[key];
    obj[key] = function (...a) { if (drawing) window.__reads.push(label); return orig.apply(this, a); };
  };
  wrap(Date, 'now', 'Date.now');
  wrap(performance, 'now', 'performance.now');
  wrap(Math, 'random', 'Math.random');
  wrap(window, 'setTimeout', 'setTimeout');
  wrap(window, 'setInterval', 'setInterval');
  wrap(window, 'requestAnimationFrame', 'requestAnimationFrame');
  const RealDate = Date;
  window.Date = new Proxy(RealDate, { construct(T, a) { if (drawing && !a.length) window.__reads.push('new Date()'); return new T(...a); } });
  window.__draw = f => { drawing = true; try { window.drawFrame(f); } finally { drawing = false; } };
};

async function open(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(trap);
  await page.goto(url);
  await page.waitForFunction(() => window.VIDEO && window.drawFrame, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const video = await page.evaluate(() => window.VIDEO);
  await page.setViewportSize({ width: video.width, height: video.height });
  return { page, errors, video };
}

const shot = async (page, video, f) => {
  await page.evaluate(n => window.__draw(n), f);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: video.width, height: video.height } });
};
const sha = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16);

const browser = await chromium.launch();
const results = [];
const gate = (name, ok, detail) => { results.push({ name, ok, detail }); };

// Pass A: draw every frame in order, collect errors, clock reads and blank frames.
const A = await open(browser);
const { video } = A;
const blank = [];
for (let f = 0; f < video.frames; f++) {
  await A.page.evaluate(n => window.__draw(n), f);
  // Measured on a screenshot, so it works for Canvas, WebGL, SVG and DOM scenes alike.
  const shotB64 = (await A.page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: video.width, height: video.height } })).toString('base64');
  const flat = await A.page.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + b64;
    await img.decode();
    const c = new OffscreenCanvas(160, Math.max(1, Math.round(160 * img.height / img.width)));
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const count = new Map();
    let n = 0;
    for (let i = 0; i < d.length; i += 4, n++) {
      const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4;
      count.set(k, (count.get(k) || 0) + 1);
    }
    return Math.max(...count.values()) / n;
  }, shotB64);
  // Blank: one flat colour covers 99.5% or more of the frame.
  if (flat >= 0.995) blank.push(f);
}
const reads = await A.page.evaluate(() => window.__reads);
gate('page errors', A.errors.length === 0, A.errors.slice(0, 3).join(' | ') || 'none');
gate('clock/random reads in drawFrame', reads.length === 0, reads.length ? [...new Set(reads)].join(', ') + ` (${reads.length} calls)` : 'none');
gate('blank frames', blank.length === 0, blank.length ? `frames ${blank.slice(0, 10).join(', ')}` : 'none');

// Pass B: sample frames in order in page A, then in reverse in a fresh page B.
const samples = [0, 1, Math.floor(video.frames / 3), Math.floor(video.frames / 2), video.frames - 2, video.frames - 1];
const fwd = {};
for (const f of samples) fwd[f] = sha(await shot(A.page, video, f));
const B = await open(browser);
const mismatch = [];
for (const f of [...samples].reverse()) {
  const h = sha(await shot(B.page, video, f));
  if (h !== fwd[f]) mismatch.push(f);
}
gate('determinism (forward vs reverse, fresh page)', mismatch.length === 0, mismatch.length ? `frames ${mismatch.join(', ')} differ` : `${samples.length} frames match`);
await browser.close();

if (sheet && videoPath) {
  const cols = 5, rows = Math.ceil(video.frames / video.fps / cols);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videoPath,
    '-vf', `fps=1,scale=384:-1,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', sheet]);
  gate('contact sheet', true, sheet);
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
