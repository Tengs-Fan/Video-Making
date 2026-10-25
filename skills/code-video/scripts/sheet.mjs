// Contact sheet straight from the scene, without rendering the video.
//
//   node sheet.mjs scene.html sheet.png [--every 1] [--at 2.5,7.1] [--cols 5] [--width 384]
//
// Draws one frame every --every seconds, plus each cut in VIDEO.cues.cuts at
// -0.2 s, 0 and +0.2 s, plus any --at times, and tiles them into one PNG with
// the time printed under each tile. Read the PNG as an image to review a cut.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// require() rather than import, so a global Playwright install (NODE_PATH) also resolves.
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : def; };
const every = +opt('--every', '1');
const extra = opt('--at', '').split(',').filter(Boolean).map(Number);
const cols = +opt('--cols', '5');
const tileW = +opt('--width', '384');
const [scenePath, outPath] = args;
if (!scenePath || !outPath) {
  console.error('usage: node sheet.mjs scene.html sheet.png [--every 1] [--at 2.5,7.1] [--cols 5] [--width 384]');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(pathToFileURL(resolve(scenePath)).href + '?render');
// A scene that loads assets first may define VIDEO and drawFrame later.
await page.waitForFunction(() => window.VIDEO && window.drawFrame, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const video = await page.evaluate(() => window.VIDEO);
await page.setViewportSize({ width: video.width, height: video.height });

const last = video.frames - 1;
const times = new Set();
for (let t = 0; t * video.fps <= last; t += every) times.add(+t.toFixed(3));
for (const c of video.cues?.cuts || []) for (const d of [-0.2, 0, 0.2]) times.add(+(c + d).toFixed(3));
for (const t of extra) times.add(t);
const frames = [...new Set([...times].map(t => Math.min(last, Math.max(0, Math.round(t * video.fps)))))].sort((a, b) => a - b);

const rows = Math.ceil(frames.length / cols);
const tileH = Math.round(tileW * video.height / video.width);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-i', '-',
  '-vf', `scale=${tileW}:${tileH},tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', outPath],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, fail) => ff.on('close', c => c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`))));

for (const f of frames) {
  await page.evaluate(n => window.drawFrame(n), f);
  // Stamp the time on the frame so each tile says where it is.
  await page.evaluate(([label, px]) => {
    const tag = document.createElement('div');
    tag.id = '__sheet_label';
    tag.textContent = label;
    tag.style.cssText = 'position:fixed;left:0;bottom:0;padding:0.2em 0.5em;background:#000;color:#fff;font:600 ' + px + 'px monospace;z-index:2147483647';
    document.body.appendChild(tag);
  }, [`t=${(f / video.fps).toFixed(2)}s  f=${f}`, Math.round(video.height * 0.06)]);
  ff.stdin.write(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: video.width, height: video.height } }));
  await page.evaluate(() => document.getElementById('__sheet_label').remove());
}
ff.stdin.end();
await done;
await browser.close();
console.log(`wrote ${outPath}: ${frames.length} frames (${frames.join(', ')})`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
