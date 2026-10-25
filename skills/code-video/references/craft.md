# Craft: spec, numbers, banned defaults

Adjectives are where the generic look comes from.
Every adjective in the brief becomes a number in `SPEC.md`, and every number is something the review can check.

## SPEC.md template

```text
GOAL:    what the viewer feels or does at the end, in one sentence
OUTPUT:  W x H, fps, frames (seconds x fps)
LOOK:    ground (hex), ink (hex), one accent (hex) and where it may appear;
         display face, weight, px size; body face, weight, px size;
         the medium (paper and ink, product UI, glass, clay, blueprint, 3D studio) and its numbers
MOTION:  eases by role (enter, move, exit, camera); durations and staggers in frames
SHOTS:   one line each: frame range, the one hero move, the words read on screen, the sound,
         how it hands off to the next shot
SOUND:   bed feel and tempo, the one moment it changes, which actions get effects, or silence and why
BANNED:  the defaults below, plus anything this video must not become
QA:      the frames to check and what each must show
```

## Words to numbers

| Word | Becomes, for example |
|---|---|
| premium | one material with numbers: satin paper with 2% grain, a product on a seamless sweep with a soft contact shadow |
| modern | a 30-frame push on one ease; a display face at about 9% of frame height with slightly negative tracking |
| clean | a grid (12 columns, 96 px margins at 1080p) and the accent on one word per shot |
| dynamic | cuts on the beat; a layout change every bar; one hero move per shot |
| playful | springy overshoot on position and scale (never on opacity or colour) |
| cinematic | a lens and a light: a 35 mm framing, a key light from upper left, a light vignette |

## Floors the review checks

- Readable text is at least 2.6% of the frame's short side (28 px at 1080p, 19 px at 720p).
  Too many words: cut words, never shrink type.
- A line is held at least 0.5 s + 0.3 s per word after it lands, and does not move while it is read.
- Something new every 2-4 s; nothing static for more than 3 s unless the hold is deliberate.
- The hero of a shot fills at least 40% of the frame's width or height.
  A small object in the middle of an empty frame is not a shot.
- One hero move per shot; secondary moves travel about half as far and start a little after it.
- Frame 0 already shows the subject: it is the thumbnail on most players.
- Content inside the 90% action-safe box; captions and key text inside 80%.
  Vertical video: keep text out of the bottom 20% and right edge where platform buttons sit.
- Transitions have a cause on screen (an object grows into the next frame, a colour floods, a whip, an iris from the clicked point); use three to five kinds, not the same one at every cut, and never crossfade one world into another.

## Banned by default

These are where generated video lands when nothing is decided.
Each is banned unless the brand's own material uses it:

- a black or dark navy void with small elements floating in the middle;
- glow, bloom, neon, lens flares, glowing orbs and rings, decorative particles;
- purple or blue gradients, mesh gradients, glass cards;
- the cream-paper look with a serif display, italic accent words, "01 / 02" labels and small monospace caps;
- everything centred; everything fading in at once; every element fading and sliding up;
- titles that keep drifting or scaling after they land; breathing or pulsing loops standing in for motion;
- corner brackets, frame borders and HUD readouts as decoration;
- three cards in a row, KPI grids, a title over a dimmed screenshot;
- the logo docked in a corner.

After each contact sheet, name every default it shows, from this list or not, add it to the BANNED line in `SPEC.md`, and replace it with something from the subject, the brand or the chosen medium.

These rules condense the HyperFrames skill (Apache-2.0, HeyGen) and patterns shared by creators of Opus 5.5 videos.
