"""Synthesize a soundtrack that is timed to the scene's cues.

    python3 soundtrack.py cues.json track.wav

cues.json comes from `node render.mjs scene.html --cues cues.json`, so the
picture and the sound share one timeline. Everything is generated with numpy
from a fixed seed: a soft pad, a pulse that enters at the first cut,
whooshes on cuts, key ticks on typing, pops on landings and one low impact.
Loudness is left to ffmpeg's loudnorm in the mux step.
"""

import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def env(n, attack, release):
    """Linear attack, exponential release, in samples."""
    e = np.ones(n)
    a = max(1, int(attack * SR))
    e[:a] = np.linspace(0, 1, a)
    e[a:] = np.exp(-np.arange(n - a) / max(1, release * SR))
    return e


def tone(freq, dur, amp=1.0):
    t = np.arange(int(dur * SR)) / SR
    return amp * np.sin(2 * np.pi * freq * t)


def add(buf, clip, at):
    i = int(at * SR)
    j = min(len(buf), i + len(clip))
    if i < len(buf):
        buf[i:j] += clip[: j - i]


def lowpass(x, alpha):
    """One-pole low-pass; alpha in (0, 1], smaller is darker."""
    y = np.empty_like(x)
    acc = 0.0
    for k, v in enumerate(x):
        acc += alpha * (v - acc)
        y[k] = acc
    return y


def pad(total, chords, bar):
    """Sustained triads, one per bar, with slow fades so chord changes blur."""
    out = np.zeros(total)
    for b, chord in enumerate(chords):
        start = b * bar
        if start >= total / SR:
            break
        dur = bar + 0.6
        n = int(dur * SR)
        shape = np.minimum(1, np.minimum(np.arange(n) / (0.5 * SR), (n - np.arange(n)) / (0.6 * SR)))
        clip = sum(tone(f, dur, 0.22) + tone(f * 2.003, dur, 0.05) for f in chord) * shape
        add(out, clip, start)
    return out


def pulse(total, start, bpm):
    """A muted low pluck on each beat from `start`, so the music lifts after the premise."""
    out = np.zeros(total)
    beat = 60 / bpm
    t = start
    notes = [110.0, 110.0, 130.81, 98.0]
    k = 0
    while t < total / SR - 0.2:
        clip = (tone(notes[k % 4], 0.4, 0.5) + tone(notes[k % 4] * 2, 0.4, 0.15)) * env(int(0.4 * SR), 0.004, 0.09)
        add(out, clip, t)
        t += beat
        k += 1
    return out


def whoosh(dur=0.35):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    sweep = np.linspace(0.02, 0.35, n) ** 1.5
    y = np.empty(n)
    acc = 0.0
    for k in range(n):
        acc += sweep[k] * (noise[k] - acc)
        y[k] = acc
    shape = np.sin(np.pi * np.arange(n) / n) ** 2
    return 0.9 * y * shape


def tick():
    n = int(0.03 * SR)
    return 0.25 * rng.standard_normal(n) * env(n, 0.0005, 0.004)


def pop():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t * 18) + 380
    return 0.55 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.05)


def impact():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 70 * np.exp(-t * 3) + 42
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.45)
    # Upper harmonic so the hit still reads on a phone speaker.
    edge = 0.35 * np.sin(2 * np.pi * np.cumsum(f * 3) / SR) * env(n, 0.003, 0.12)
    return 0.9 * (body + edge)


def main(cues_path, out_path):
    cues = json.load(open(cues_path))
    dur = cues["frames"] / cues["fps"]
    total = int(dur * SR)
    bpm = 96
    bar = 4 * 60 / bpm
    A, C, D, E, F, G = 220.0, 261.63, 293.66, 329.63, 349.23, 392.0
    # Am, F, C, G.
    chords = [(A, C, E), (F / 2, A, C), (C, E, G), (G / 2, D, G)]
    mix = 0.5 * pad(total, chords * 2, bar)
    mix += 0.35 * pulse(total, cues["cuts"][0], bpm)

    # Each effect lands one frame after its picture: light arrives before sound.
    lag = 1 / cues["fps"]
    for t in cues["cuts"]:
        add(mix, whoosh(), t - 0.2)
    for t in cues["ticks"]:
        add(mix, tick(), t + lag)
    for t in cues["pops"]:
        add(mix, pop(), t + lag)
    add(mix, impact(), cues["impact"] + lag)

    # Fade the last half second and keep headroom; loudnorm sets the final level.
    fade = int(0.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix = lowpass(mix, 0.6)
    mix /= np.max(np.abs(mix)) / 0.8

    pcm = (mix * 32767).astype(np.int16)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {out_path}: {dur:.1f} s, {len(cues['ticks'])} ticks, {len(cues['cuts'])} cuts")


if __name__ == "__main__":
    main(*sys.argv[1:3])
