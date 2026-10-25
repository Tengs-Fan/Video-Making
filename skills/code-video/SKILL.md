---
name: code-video
description: Make an MP4 video by writing a program that draws every frame (motion graphics, explainers, product promos, data animations, title cards, loops), rendered with headless Chromium and ffmpeg. Use when asked to make, animate or render a video "in code", or when no video framework is installed. Includes a renderer, a determinism and quality checker, a contact-sheet tool for visual review, and a soundtrack synthesizer timed to the scene's cues. If the person asks for Remotion or HyperFrames, use that framework's own skill instead.
---

# code-video

You cannot output video, but you can write a page that draws any frame on demand.
The renderer calls `drawFrame(f)` for every frame in headless Chromium, screenshots it, and pipes the PNGs into ffmpeg.
Because each frame depends only on `f`, the render is repeatable, any frame can be redrawn alone, and a fix is an edit plus a re-render.

Scripts are in `scripts/` next to this file; run them with `node` / `python3` from the project folder, passing paths.
Start a new scene from `assets/template.html`; `examples/pipeline-explainer/scene.html` is a finished 15 s example.

## Setup check

Run once and fix what is missing before writing any scene:

```sh
node -v                                   # 18+
ffmpeg -version | head -1
node -e "require('playwright').chromium.launch().then(b => { console.log('chromium ok'); b.close() })"
python3 -c "import numpy; print('numpy ok')"   # only for soundtrack.py
```

Missing Playwright: `npm i playwright && npx playwright install chromium` in the project folder (ask before installing).

## Contract

A scene is one HTML file that defines:

```js
window.VIDEO = { width, height, fps, frames, cues: { cuts: [], ticks: [], pops: [], impact } };  // cues in seconds
window.drawFrame = f => { /* paint frame f */ };
```

1. `drawFrame(f)` reads only `f`. No `Date`, `performance.now`, timers, `requestAnimationFrame`, CSS transitions or animations, network fetches or `Math.random()`; use a hash of `f` for noise. `check.mjs` traps these.
2. It paints the whole frame every call (clear or fill the background first) and resets any state it changes (transform, alpha, clip).
3. Fonts are installed system fonts or `@font-face` to a local file; the renderer awaits `document.fonts.ready`.
4. Assets and libraries are local files, never a CDN (copy `three`, `gsap` and the like from `node_modules` next to the scene). If they load asynchronously, define `window.VIDEO` and `window.drawFrame` only once everything is decoded; the scripts wait up to 60 s for both to exist.
5. Canvas 2D, SVG, DOM, WebGL/Three.js and GSAP all work, as long as time comes from `f`: for GSAP build a paused timeline and call `tl.seek(f / fps)`; for Three.js set every animated value from `t = f / fps` and call `renderer.render` inside `drawFrame` (create the renderer with `preserveDrawingBuffer: true`).
6. The page skips its own preview loop when the URL has `?render` (the template does this).

## Work loop

1. **Brief.** Settle what the video is for, the length, the aspect ratio (1920×1080 by default; 1080×1920 for vertical), and the real material to use (site, repo, brand folder, screenshots, logo). Read that material; do not invent a brand look.
2. **Spec.** Write `SPEC.md` before code: goal in one sentence; format (W×H, fps, frames); look as numbers (ground, ink and accent as hex; type faces and px sizes; eases by role); one line per shot with its time range, its one hero move and the words the viewer reads; sound; and a BANNED line. See `references/craft.md`. For a film over about 15 s that tells something, propose two or three storylines in a few lines each and let the person pick unless they asked you not to stop.
3. **Build.** Copy `assets/template.html` to the project as `scene.html` and write the shots. Put every cut time in `VIDEO.cues.cuts`, typing in `ticks`, landings in `pops`, the payoff in `impact`.
4. **Gate.** `node scripts/check.mjs scene.html`. Fix every FAIL: page errors, clock or random reads, blank frames (frame 0 included: it is the thumbnail), non-determinism.
5. **Look.** `node scripts/sheet.mjs scene.html sheet.png` (one frame per second plus each cut at -0.2/0/+0.2 s), then read `sheet.png` as an image. Describe each tile in one sentence as a stranger would; anything you would have to explain is a problem. Check `references/craft.md` for the numbers and the banned defaults.
6. **Notes, then fixes.** Write each problem as `t=4.2s · where · problem → exact change`, rank P0 (breaks the read or the contract), P1 (weakens it), P2 (polish). Fix the P0s and the P1s worth it, then re-run steps 4-5 on what changed. Never score the video out of 10.
7. **Sound** (unless the person wants silence or gave a track): see `references/sound.md`.
   ```sh
   node scripts/render.mjs scene.html --cues cues.json
   python3 scripts/soundtrack.py cues.json track.wav
   ffmpeg -y -i track.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 track-norm.wav
   ```
8. **Render.** `node scripts/render.mjs scene.html out.mp4 --audio track-norm.wav` (omit `--audio` for silent). Test a cut quickly first with `--frames N`.
9. **Verify the file.** `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration -of compact out.mp4`; for sound, `ffmpeg -i out.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary` (aim for -16 to -14 LUFS, peak at or below -1 dBFS); `node scripts/check.mjs scene.html --sheet final-sheet.png --video out.mp4` for a sheet of the real encode.
10. **Deliver.** Give the path, the format line from ffprobe, and a short note: the creative calls you made, what you measured, what nobody checked (you cannot hear the audio; say so), and the weakest shot.

## Scripts

| Script | Does |
|---|---|
| `scripts/render.mjs scene.html out.mp4 [--audio a.wav] [--frames N] [--cues cues.json]` | Renders every frame to H.264 yuv420p MP4 (CRF 18, faststart), optional AAC audio; `--cues` writes the scene's cues as JSON (with no out.mp4 it only does that). Exits non-zero on page errors. |
| `scripts/check.mjs scene.html [--sheet s.png --video out.mp4]` | Gates: page errors, clock/random reads inside `drawFrame`, blank frames, determinism (sample frames forward vs reverse in a fresh page); optional sheet of the encoded MP4. |
| `scripts/sheet.mjs scene.html sheet.png [--every 1] [--at 2.5,7.1] [--cols 5]` | Contact sheet from the scene itself, with each tile's time stamped, without rendering the video. |
| `scripts/soundtrack.py cues.json track.wav` | numpy-synthesised bed (pad + pulse from the first cut), whoosh per cut, ticks, pops and one impact, each a frame after its picture. A placeholder-quality score: prefer the person's track or a music/TTS service when available. |

Render speed on a 4-CPU machine was about 13 frames per second of wall time at 1280×720 and 6 at 1920×1080 for a Canvas scene, so budget about 5 minutes per minute of 1080p30 video; WebGL in headless Chromium is slower.

## Limits

Code draws type, diagrams, UI, charts, maps and stylised 3D well, and faces, animals and photoreal scenes badly.
For those, ask for or use real assets (photos, footage, 3D models, generated stills) and animate them in the scene.
