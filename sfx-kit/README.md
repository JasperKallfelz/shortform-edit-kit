# Sound kit for video edits

Prepared sound effects and the workflow that gets them into a video.

## What is in here

| Path | Content |
|---|---|
| `sounds/` | 53 finished WAVs (48 kHz, 24-bit, mono, peak -1 dBFS, attack at 0 ms), real recordings only |
| `catalogue.json` | per sound `len` (length in ms), `lead` (ms to the point that should sit on the picture) and `loud` (loudest 50 ms stretch in dB) |
| `sources.tsv` | origin and licence per sound |
| `tools/prepare_sfx.py` | turns the raw files in `../sfx-candidates/` into the finished sounds (add new sounds there in `SRC` and `GROUPS`) |
| `tools/sync_remotion.py` | copies the WAVs to `<project>/public/sfx` and rewrites the `SOUNDS` catalogue in `<project>/src/lib/sfx.tsx` |
| `remotion/sfx.tsx` | catalogue + `SfxTrack` for Remotion, to copy to `src/lib/sfx.tsx` |

The sounds:
- Camera: `shutter2`, `shutter3`, `shutterSlr2/3`, `shutterInsta1/2`, `shutterOld`, `shutterDslr`, `shutterBurst2–4` (bursts), `winder1/2` (film winder)
- Mouse, trackpad, switches: `mouse1–4`, `trackpad1/2`, `switch`, `switch2`, `switch3`, `pen1–3` (pen click)
- Split-flap board like at an airport: `flap` (one flap; `flapLo`/`flapHi` are slightly lower/higher to avoid an audible repeat), `flapBurst3/5/8` (short bursts), `flapEnd1/2` (run-out), `flapRun` (longer run)
- Paper: `page1–3` (page turn), `tear` (paper tearing)
- Whooshes, used sparingly: `swish`, `whooshShort`, `swishSmall`
- Others: `riser1` (reversed cymbal), `tom1` (low drum), `riffle1` (card riffle), `key1–3` (keys), `pencil1/2` (pencil stroke), `cardPlace1` (laying a card down), `clink1` (glass)
- Themed single sounds: `typeBurst1` (typing on a laptop keyboard, 2.1 s; meant for a word like "engineer", cut to the length of the section) and `coinCup1` (a coin falls into a cup; meant for a sum of money). Use them with `Extra`, see [`../docs/shortform-learnings-2026-10.md`](../docs/shortform-learnings-2026-10.md#themed-single-sounds)

## House rule

**Only real, recorded sounds. Nothing synthetic.** Synthetic UI sounds (ticks, pops, blips) sound "like a spaceship" in a
calm, typographic video. Every movement on screen gets a small sound, but so quiet and so fitting that it does not sound
added. Whooshes only in the smallest dose.

## The workflow

1. **Collect the picture events.** Look in the code for the frame where something happens (cut, arrow, photo appears, tile
   pops, number counts). Every cue hangs on the same word timing or animation constant as the picture, no fixed numbers.
   When a new voiceover take comes in, the sounds move along by themselves.
2. **Prepare the sounds** (`tools/prepare_sfx.py`): cut the silence at the start so the attack sits at 0 ms; set the peak to
   -1 dBFS; measure `lead` for whooshes. Bake pitch variants as files of their own, do not set them with the playback rate
   in the video (preview and render would sound different).
3. **Place.** Clicks and shutters with the attack on the event. Whooshes with the loudest point on the fastest point of the
   movement (for an arrow, the middle of the flight), not on the start or the end.
4. **Name.** Every cue gets a name and appears in the Studio timeline as "SFX · name". Corrections are made by ear, using the
   name or the category.
5. **Set the levels** (rules below).
6. **Measure.** Render only the effects (`npx remotion render <composition> sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'`; use `voVolume: 0` instead of
   `voiceover: ""`, because when a voiceover exists the composition falls back to `VO.file`), then compare the level per section and against the music.
   Measure loudness and peak of the full mix. `../edit-tools/sound_check.py` prints both.
7. **Show it in the Studio, work in the corrections, measure again.**

## Level rules

- **Music** sits about 12–13 dB below the voice.
- **Effects about as loud as the music, not above.** Measure against the music, not against the voice (0.4 s level of the
  effects-only track against the music). In the example project, `sfxVolume` handles this (1.3 with music at 0.15); the `vol` values
  of the cues only set the ratio between them.
- **Whooshes** may be a little louder.
- **Very short sounds** (shutters, clicks) quickly seem too loud, especially as a transition effect. Keep them deliberately quieter there.
- **Thin out dense runs.** If many elements pop up within a few frames, let one click at most every 4 frames
  (sorted by frame, not by number), otherwise it rattles.
- **No fast mechanical repeats.** By ear, these failed: shutters as a transition (`shutterInsta1/2`) and fast flap runs
  (`flapBurst3/8`); they sound like a multiple shutter. A single riffle (`riffle1`) held up.
  Details: [`../docs/shortform-learnings-2026-10.md`](../docs/shortform-learnings-2026-10.md#5-sounds-what-failed-by-ear-and-what-stayed).
- **Where the sound belongs to the picture** (a photo appears, so a shutter) it may be a little louder.
- Target for the final mix: -14 LUFS, peak -1 dBTP.

When you swap one sound for another, convert the `vol` value through `loud`
(`vol_new = vol_old * 10^((loud_old - loud_new) / 20)`), otherwise the new one seems louder or quieter than the old one.

## Music

- Choose the point where the music starts so that one beat of the song lands on the most important word. Find the beats with
  librosa and calculate the start from the word timing (position in the song minus word timing); then it stays on the word
  when a new take comes in.
- Cuts that hang on the voiceover hit the beat only by chance. Say honestly which ones land and which do not.
- Take the music away shortly before the climax, and bring it back abruptly on the word.
- `../edit-tools/beat_align.py` finds the start point. Background and ways to measure: `../docs/sound-and-text-sync.md`.
- Music does not belong in this repo. For rights when posting, see `../docs/research-2026-10.md`.
