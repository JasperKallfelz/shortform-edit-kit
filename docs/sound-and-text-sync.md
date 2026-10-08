# Sound and text sync: what building showed

Learnings from a 16-second video with voiceover, music and about 50 sound cues that was corrected by ear in several rounds.
The rules themselves are in [`../sfx-kit/README.md`](../sfx-kit/README.md) and [`../AGENTS.md`](../AGENTS.md); this page
says why they are the way they are and how to re-measure them.

## Text must be fully there on the word

A text counts as in sync only when it is **fully visible at the start of the word**, not when it only starts there.

- The word timings can be right (±20–40 ms) and the text still looks late: the fade-in takes 3 frames, so the text is fully
  visible only 1–3 frames after the word. At the start of the video it was 100 ms.
- Therefore every word text starts earlier by the duration of its fade-in (`TEXT_LEAD_MS = 100` in
  `example/src/Demo.tsx`). 2–4 frames of lead read as "simultaneous"; more than about 5 frames look like a spoiler.
- If a scene begins exactly on a word, the text cannot come before the cut. Then let the start time go negative (do not
  clamp it at 0): the text is already fully opaque in the first frame of the scene.
- Lines that change hard without a fade-in (subtitles) are fully there at once, but at the same time as the voice, not
  before it. Whether they should also come 2–3 frames earlier is a separate decision.

**Re-measure, do not infer from the code.** Really render the frames and count, for each text line, from which frame it is
opaque; read the speech onset from the spectrogram of the recording and compare both.

```bash
npx remotion render Demo /tmp/seq --frames=0-70 --sequence --scale=0.25
```

The preview in the studio is not frame-accurate for sound, especially right after the start. If something looks minimally
offset there, the render counts.

## Loudness: measure against the music

- The most common mistake: aligning the effects to the voice. Then they are far too loud. The yardstick is the music.
- Over three listening rounds the target settled: first too loud, then 2 dB below the music was too quiet, and in the end
  **the loudest 0.4 s point of the effects as loud as the music, not above it**.
- Separate two levels: the `vol` values of the cues set the ratio of the sounds to each other, one master control
  (`sfxVolume`) sets the loudness of all of them together. Then "everything a bit louder" changes one number instead of
  fifty.
- Corrections come by ear in categories ("the whooshes", "the short sounds at transitions", "at the spot with the photos"),
  rarely per cue. So name every cue and report changes back as a short list of names.
- Short sounds (shutter, clicks) quickly get too loud as a transition; where the sound belongs to the image (a photo
  appears), it may be stronger. Whooshes tolerate a little more.

Measuring:

```bash
python3 edit-tools/sound_check.py sfx.wav --music <song.wav> --music-start <s> --music-vol 0.15 --mix mix.wav
```

This shows the level per section, gaps without an effect, the loudest point of the effects against the music, and the
loudness and peak of the full mix. A loud hit on an emphasised word can push the peak of the mix up to full scale although
each track has headroom on its own: re-measure the peak after every level change.

## Many events in quick succession

If 30 tiles pop up within 22 frames, one click per tile turns into rattling. Thin out by time, not by number: sort the
events by their frame and let at most one of them click every 4 frames. This stays right when the number or order of the
tiles changes.

## Is every cue on its frame?

Render the effects-only track and, for each cue, search for the processed file in the render by cross-correlation (window
±80 ms around the expected position). If the hit is within ±2 ms, the cue sits. Two traps:

- Very quiet cues fall below any threshold. That is then a limit of the measurement, not a position error: check the
  position that was found, not just "found/not found".
- Right next to a loud sound (a hit, a shutter with its tail), the correlation hits the loud neighbour. Report such cues as
  "not individually verifiable" instead of as an error or as passed.

## Music

- Choose the entry so that a beat falls on the most important word, and compute it from the word time (song position minus
  word time). When a new take comes, the beat stays on the word.

```bash
python3 edit-tools/beat_align.py <song.wav> example/src/timing.ts <word> --also <word>,<word>
```

- At 172 BPM the beats are 348 ms apart; an arbitrary cut is off by just under 90 ms on average. Cuts that hang on the
  voiceover hit the beat only by chance. Say which ones sit and which do not, instead of claiming "beat-accurate".
- A proven pattern from commercials: take the music away shortly before the climax and bring it back exactly on a cut. In a
  measured 4-minute spot that was about 7 seconds of silence (about 3% of the length), directly followed by the loudest
  10-second block. Transferred to 16 seconds, that is about half a second.
- Bake a pitch variant as its own file, not via the playback rate in the video: preview and render treat pitch differently,
  the baked file sounds the same in both.

## Traps when measuring other people's videos

- A detector for high impulses ("click on the cut?") also fires on speech consonants. At one and a half hits per second and
  a ±120 ms window, about 30% of the cuts are "on an impulse" by chance alone. A value of 40–50% then proves nothing. First
  separate voice, music and the rest, then count.
- Word timings from speech recognition can be off by several hundred milliseconds. Align words after a speech pause to the
  measured onset (that is what `voice-studio/vo/` does), and spot-check the rest against the spectrogram.

## Two agents on one file

What prevented a near-loss in practice: every change checks the checksum right before writing and aborts if it does not
match. Then the new checksum goes to the other session in two sentences (what was changed, what was left untouched).
Whoever plans a bigger rework announces it and names the identifiers that parts owned by others depend on.
