# Sound

You cannot hear the result, so plan sound from the picture's cues and measure the file; say in the delivery note that it was measured, not heard.

## Where the sound comes from, best first

1. **The person's own track**, as given.
   Find its tempo and strong beats (ask, or estimate onsets with ffmpeg or numpy) and put the cuts on them.
2. **A music or voice service** the person has keys for (ElevenLabs, Gemini TTS, and similar): ask before calling a paid API.
   A voiceover becomes the clock: time each shot's start to the word that names it.
3. **`scripts/soundtrack.py`**: a numpy bed with effects on the scene's cues.
   It is fine for a short clip or a placeholder; say so in the note.

## Rules

- A video over about 15 s that tells something gets a bed and effects on visible actions, unless the person wants silence or it will autoplay muted.
- Every effect has a cause on screen: whoosh on a cut or a fast move, ticks on typing, a pop on something landing, one impact on the payoff.
  Too many effects read as a template.
- An effect lands one frame after its picture (light arrives before sound); `soundtrack.py` already offsets by one frame.
- Keep each hit a few dB above the bed, and give low hits an upper harmonic: energy under 150 Hz plays as nothing on a phone speaker.
- Mix to about -16 to -14 LUFS integrated for social video, true peak at or below -1 dBTP:
  `ffmpeg -i track.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 track-norm.wav`.
- Check the final MP4: `ffmpeg -i out.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary`.

## Editing soundtrack.py

The cue names it reads are `cuts`, `ticks`, `pops` and `impact` (seconds), plus `fps` and `frames`.
Change the chords, tempo (`bpm`) or levels in `main()`; keep `rng` seeded so the track is identical on every run.
