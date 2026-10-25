// Render a draw(f) scene to MP4: headless Chromium paints each frame, ffmpeg encodes.
//
//   node render.mjs scene.html out.mp4 [--audio track.wav] [--cues cues.json] [--frames N]
//
// The page must define window.VIDEO = {width, height, fps, frames, cues?} and
// window.drawFrame(f). Frames are piped to ffmpeg as PNGs, so nothing is written
// to disk except the MP4 (and cues.json when --cues is given).

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// require() rather than import, so a global Playwright install (NODE_PATH) also resolves.
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const audio = opt('--audio');
const cuesOut = opt('--cues');
const frameLimit = opt('--frames');
const [scenePath, outPath] = args;
if (!scenePath || (!outPath && !cuesOut)) {
  console.error('usage: node render.mjs scene.html out.mp4 [--audio track.wav] [--cues cues.json] [--frames N]');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const url = pathToFileURL(resolve(scenePath)).href + '?render';
await page.goto(url);
// A scene that loads assets first may define VIDEO and drawFrame later.
await page.waitForFunction(() => window.VIDEO && window.drawFrame, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const video = await page.evaluate(() => window.VIDEO);
await page.setViewportSize({ width: video.width, height: video.height });

if (cuesOut) {
  writeFileSync(cuesOut, JSON.stringify({ fps: video.fps, frames: video.frames, ...video.cues }, null, 2));
  console.log(`wrote ${cuesOut}`);
  if (!outPath) { await browser.close(); process.exit(0); }
}

const frames = frameLimit ? Math.min(+frameLimit, video.frames) : video.frames;
const ffArgs = ['-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(video.fps), '-i', '-'];
if (audio) ffArgs.push('-i', audio);
ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-vf', 'setsar=1', '-movflags', '+faststart');
if (audio) ffArgs.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
ffArgs.push(outPath);

const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, fail) => ff.on('close', c => c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`))));
const write = buf => new Promise(ok => ff.stdin.write(buf) ? ok() : ff.stdin.once('drain', ok));

const clip = { x: 0, y: 0, width: video.width, height: video.height };
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(n => window.drawFrame(n), f);
  await write(await page.screenshot({ type: 'png', clip }));
  if (f % 50 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
}
ff.stdin.end();
await done;
await browser.close();

console.log(`\rrendered ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${outPath}`);
if (errors.length) {
  console.error(`${errors.length} page error(s):\n` + errors.join('\n'));
  process.exit(1);
}
