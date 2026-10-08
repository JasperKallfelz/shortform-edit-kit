# Short-form video learnings: script, voice, room tone, visual building blocks, formats

Learnings from 8 Oct 2026, from working on short videos of about 13 seconds: voiceover, music, about 25 sound cues and
room tones, corrected by ear several times in one day. This document complements
[`sound-and-text-sync.md`](sound-and-text-sync.md) (text lead, loudness against the music, cue placement), which is not
repeated here. Every point says what worked, why, and how to check it. "By ear" means: the human who signs off the video
listened and decided. Measurements show that something changed, not that it sounds better.

## 1. Script first, then the edit

While you record, the wording changes several times: words drop out, a half-sentence gets better, a number is said
differently. Everything that depends on the wording has to follow. If you cut first, you cut several times.

- **Update the teleprompter right after every change.** `script.json` is the teleprompter text and the key mapping at the
  same time. If you speak something other than what is written there, `npm run vo` aborts when the word count differs; that
  is the safeguard, not a bug. If the new wording is in the script immediately, the human reads it off on the next pass.
- **Always transcribe a take before you use it.** The spoken wording counts, not the script. A speech-recognition transcript
  shows what is really on the recording:

  ```bash
  whisper-cli -m <model> -f recordings/<take>.wav -l <language> -otxt
  ```

- **The text on screen follows the spoken wording.** This applies to words as much as to numbers: the number a counter on
  screen runs to is a prop (`counterTo`) and not a fixed value in the code, so it moves with the take.

**Check:** Put every word text on screen next to the transcript of the take in use (render a still and read it off), and
look at the "models disagree" and "ESTIMATED" rows of the `vo` table.

## 2. Recording: whole passes, then assemble

- **Speak the whole text several times in one piece.** After a slip, do not stop and correct: start again and keep going.
  The flow stays intact, and in the end you have several complete passes.
- **Assemble from the clean parts.** For example, lines 1 to 2 from the second pass and lines 3 to 4 from the first pass.
  Put the cuts in speech pauses; no word onset is disturbed there, and the word timings snap to pauses:

  ```bash
  npm run vo -- recordings/take-a.wav:0:3800 recordings/take-b.wav:1740:-1
  ```

- **Avoid long single recordings in the browser.** The recorder page keeps the take in the memory of the tab and writes it
  to `recordings/` only when you stop. If the tab crashes or reloads before you stop, everything is gone. Better: many
  short passes, each with a stop.

**Check:** After each pass a new file is in `recordings/`. After assembling, listen to the joins (no cut-off breath, no half
word) and note which take was used for which lines.

## 3. Pace: shorten speech pauses

With about 13 seconds, every pause counts. It was shortened like this:

- Speech pauses between the phrases to **0.08 to 0.12 s**.
- Lead-in before the first word **2 frames** (67 ms), the tail after the last word short (`tailMs` in `script.json`).
- Example in numbers: **13.3 s → 11.4 s**, about 14% shorter.

The kit has no dedicated tool for shortening. You cut at the measured pauses, each time with short fades; the pauses are
measured by `voice-studio/vo/align.py` (from 120 ms), and roughly it also works with ffmpeg:

```bash
ffmpeg -i voiceover.wav -af silencedetect=n=-45dB:d=0.05 -f null - 2>&1 | grep silence_duration
```

Each line is a pause with its duration; the first is the lead-in, the last is the tail. The threshold (−45 dB) depends on
the room noise of the recording and needs to be set once by ear.

**Note:** `align.py` counts gaps as a speech pause only from 120 ms. Pauses of 0.08 to 0.12 s sit at this limit, so
snapping to measured onsets has fewer anchors afterwards. In the `vo` table, look at the rows without ● and with
"ESTIMATED" or "models disagree".

**Re-align afterwards.** Shortening shifts all word timings. The old `timing.ts` no longer fits the new recording: run
`npm run vo` again with the shortened take. Picture, text and cues hang on this table and move along as soon as it is
right. If you keep several versions of the voice, the file and the timing table belong together in pairs: a comment next
to the `voiceover` prop says which file fits which table. A version with the old, longer pauses fits only the saved old
table.

**Check:** Length before and after (`ffprobe -v error -show_entries format=duration -of csv=p=0 <file>`), pause list with
`silencedetect`, the new length in the studio, a still on an emphasised word (frame = milliseconds × 0.03).

## 4. Voice: three wishes in a row

The voice was changed in three rounds by ear, each time reprocessed from the same pieces:

| Wish | Change | Expected effect |
|---|---|---|
| "deeper" | boost at 140 Hz (in the kit: `--chain deep`, +5 dB at 140 Hz, see `voice-studio/vo/master.py`) | more body |
| "smoother, cleaner" | noise reduction; cut at 4 kHz and 6.5 kHz; highs slightly back overall | less sibilance and roughness, the voice gets duller |
| "more clarity" | low mids around 280 Hz −3 dB; presence around 2.8 kHz +2.5 dB; narrow cut at 4.2 kHz; highs slightly +1.5 dB | speech becomes more intelligible, but brighter again |

**Honestly:** Smoothing and clarity pull in opposite directions. Smoothing takes away highs, clarity gives (some of) them
back. There is no setting that fully satisfies both; the human picks the version by ear. The "smoother" and "clearer"
chains are not in the kit, only the values above.

**Make it measurable:** Compare the mean level per frequency band before and after, at **equal loudness** (−14 LUFS, as
`master.py` produces it). Otherwise every louder version seems "clearer". A measuring tool in twenty lines (numpy and
ffmpeg), tested on noise with a known boost:

```python
import subprocess
import numpy as np

SR = 48000
BANDS = [(100, 200), (200, 400), (400, 800), (800, 1600), (1600, 3200), (3200, 6400), (6400, 12800)]


def load(path):
    """File as a mono sequence of samples (ffmpeg decodes any format)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def bands_db(y):
    """Mean level per frequency band in dB (50 ms blocks, quiet blocks left out)."""
    n = SR // 20
    blocks = y[: len(y) // n * n].reshape(-1, n) * np.hanning(n)
    blocks = blocks[(blocks ** 2).mean(axis=1) > 1e-6]  # pauses and noise floor do not count
    p = (np.abs(np.fft.rfft(blocks, axis=1)) ** 2).mean(axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    return [10 * np.log10(p[(f >= a) & (f < b)].sum() + 1e-20) for a, b in BANDS]


before, after = bands_db(load("before.wav")), bands_db(load("after.wav"))
for (lo, hi), x, y in zip(BANDS, before, after):
    print(f"{lo:>5}-{hi:<5} Hz  {y - x:+5.1f} dB")
```

A broad boost spreads over neighbouring bands: with +6 dB at 2.8 kHz and −6 dB at 280 Hz (both Q = 1), the measurement
showed +4.7 dB in the 1.6 to 3.2 kHz band and −5.0 dB in the 200 to 400 Hz band. The direction is right; the amount is not
exact to the dB.

## 5. Sounds: what failed by ear and what stayed

| Sound | Use | Verdict |
|---|---|---|
| Camera shutter (`shutterInsta1/2`) | as a transition on cuts and when a clip appears | **failed**: "doesn't fit anywhere". On cuts there is now paper (`page1`, `page3`) |
| fast flap sequences (`flapBurst3`, `flapBurst8`, split-flap board series) | on numbers and question marks | **failed**: The row sounds like a multiple shutter ("Shutter, Shutter, Shutter"). Removed; for a growing wall, a single riffle is enough instead of one flap per row |
| a single riffle (`riffle1`) | on a calendar that flips through | **confirmed**: "very clean" |

**Rule:** no fast mechanical repetitions. The ear hears many identical single sounds in quick succession as a machine
(shutter series, flap row), not as movement. If something keeps running on screen, put **one** continuous sound under it
instead of one per step. The shutter stays a sound for a photo that appears; as a transition and when a video clip fades
in, it did not carry. This narrows the list "What works for what" in
[`../edit-tools/README.md`](../edit-tools/README.md#step-3-sound-design).

**Check:** The cue list has names ("Paper · cut to the bubble"): feedback by ear comes as names or categories and can be
applied without searching. After removing, re-render the effects-only track and look at the gaps (`sound_check.py`), so
that there is not suddenly silence at that spot.

## 6. "Immersive", without becoming intrusive

The finished result was confirmed as "super super good". Two layers carry it: **quiet room tones under every scene** and
**themed single sounds** on individual words or images.

### Room tones from your own material

- Wind under outdoor shots, crowd chatter under a crowd of people. The sounds come from the project's **own clips**: that
  fits the picture and needs no licence. For exactly that reason they are not in the sound kit and not in this repo; the
  building blocks for playing them (below) are.
- **Find quiet spots by level**, not by feel: compute the level per half second and take sections in which it barely
  varies (no speech, no hit):

  ```python
  def quiet_sections(y, min_half_secs=4, max_swing_db=3.0):
      """Start times (s) and level (dBFS) of sections in which the RMS level per half second barely varies."""
      n = SR // 2
      blocks = y[: len(y) // n * n].reshape(-1, n)
      levels = 20 * np.log10(np.sqrt((blocks ** 2).mean(axis=1)) + 1e-9)
      out = []
      for i in range(len(levels) - min_half_secs + 1):
          w = levels[i : i + min_half_secs]
          if w.max() - w.min() <= max_swing_db:
              out.append((i / 2, round(float(w.mean()), 1)))
      return out
  ```

  (`SR`, `load` and `np` as in the example above; tested on noise with an inserted bang: the windows containing the bang
  are missing.)
- **Use speech recognition to check that no word is intelligible.** A crowd may sound like voices, but nobody should be
  understandable. The transcript of the piece (`whisper-cli … -otxt`) should be empty. On noise, speech recognition
  sometimes invents words: a "hit" then means listening again, not automatically discarding.

### Themed single sounds

| Image or word | Sound |
|---|---|
| Typing under the word "engineer" | `typeBurst1` (keyboard, 2.1 s), limited to the length of the section |
| Coin on a sum of money | `coinCup1` (coin drops into a cup) |
| Riser that ends when the counting-up number arrives | `riser1`, the loudest point (`lead`) on the frame where the number reaches its target |
| A card appears | `cardPlace1`, the card "lands" on the sound |
| Small movement (such as a jump) | `swishSmall`, very quiet: a breath of air, not a whoosh |

The two new kit sounds `typeBurst1` and `coinCup1` were made from the candidates `type_burst_macbook_01.wav` and
`sparkle_coin_cup_01.wav` (source and licence in `sfx-candidates/manifest.tsv`).

### Building blocks and a separate volume control

Room tones are continuous sounds and behave differently in the mix than single hits. They therefore get their **own volume
control** (`atmoVolume`, 0 = off), separate from `sfxVolume`. "All sounds a bit louder" then does not raise the wind, and
with 0 you can hear before and after directly.

```tsx
const AUDIO = "audio/"; // folder under public/ with the room tones and extra sounds
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Quiet room tone under a section, with a short fade in and out. startSec = position in the file. */
const Bed: React.FC<{ from: number; frames: number; file: string; startSec: number; vol: number; fade?: number; name: string }> = ({ from, frames, file, startSec, vol, fade = 4, name }) => (
  <Sequence from={from} durationInFrames={frames} layout="none" name={`Atmo · ${name}`}>
    <Audio src={staticFile(AUDIO + file)} trimBefore={Math.round(startSec * 30)} volume={(fr) => vol * interpolate(fr, [0, fade, frames - fade, frames], [0, 1, 1, 0], clamp)} />
  </Sequence>
);

/** Single sound; frames limits the length, the last 3 frames fade out (also for kit sounds, e.g. "sfx/typeBurst1.wav"). */
const Extra: React.FC<{ at: number; frames: number; file: string; vol: number; name: string }> = ({ at, frames, file, vol, name }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={frames} layout="none" name={`Sound · ${name}`}>
    <Audio src={staticFile(file)} volume={(fr) => vol * interpolate(fr, [frames - 3, frames], [1, 0], clamp)} />
  </Sequence>
);
```

Both are placed behind the cue track, each only when `atmoVolume > 0`:

```tsx
{atmoVolume > 0 ? (
  <>
    <Bed from={start(0)} frames={len(0)} file="wind.wav" startSec={1} vol={0.75 * atmoVolume} name="outdoors (scene 1)" />
    <Extra at={pop(w.sum)} frames={19} file="sfx/coinCup1.wav" vol={0.07 * atmoVolume} name="Coin · sum" />
  </>
) : null}
```

### Checking

Render the sounds alone and the music alone and **compare per scene**, plus the full mix:

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
npx remotion render Demo music.wav --codec=wav --props='{"voVolume":0,"sfxVolume":0,"music":"<song.wav>"}'
python3 edit-tools/sound_check.py sfx.wav --music <song.wav> --music-start <s> --music-vol 0.15 --mix mix.wav
```

The room tones count in the sound track as long as `atmoVolume` is not 0. Measured in the project: the sounds stayed
**4 to 21 dB below the music** in every scene; together they were at about **−34.6 LUFS**, the music at **−25.8 LUFS**, the
full mix at **−14.5 LUFS**. That fits the rule "effects never louder than the music"
([`../sfx-kit/README.md`](../sfx-kit/README.md)); the gap of about 9 dB between sounds and music overall fits with nothing
sounding intrusive.

## 7. Visual building blocks that worked

The same look in all scenes (white surface, large type, one red), every movement hung on a word time (`pop()` and
`start()` as in [`../example/src/Demo.tsx`](../example/src/Demo.tsx)). The text is fully there 3 frames (100 ms) before the
word, see [`sound-and-text-sync.md`](sound-and-text-sync.md).

- **One number, big and red.** The word DSL is enough: `{ ms: w.sum, text: "€100", font: "sans", size: 350, weight: 900, color: RED }`. The
  number in extra-bold type is the eye-catcher of the scene.
- **A "world" surface the camera pulls out of.** First a detail at full size (a circle filled with tiles), then the camera
  pulls out and shows the crowd around it. First the detail, then the crowd: the detail is readable as long as it is large,
  and the crowd then shows how many there are.
- **Counting-up number with a plus at the target**, fast start and slow arrival.
- **Tear-off calendar** that flips through months (a time jump in one image).
- **Hand-drawn arrow.** The path draws itself via `strokeDashoffset`, a slight wobble comes from an SVG filter with a
  changing `seed`, a white outline keeps the stroke readable over video.

All times in the snippets are frames at 30 fps; `RED` and `FONTS` come from the project. The snippets are generalised
(without the texts, images and names of the original) and checked with `tsc` against Remotion 4.0.532.

### Randomness without `Math.random`

Remotion renders every frame on its own. `Math.random()` then returns different values in every frame, and the crowd around
it would flicker. A small random generator with a fixed start value (`seed`) returns the same sequence in every frame:

```tsx
const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
```

### World with zoom-out

```tsx
/** One large surface whose origin is the centre of the detail. The camera first shows it at full size and pulls out from `zoomAt`;
 *  afterwards it keeps drifting slowly so the image does not freeze. */
const World: React.FC<{ zoomAt: number; frames: number; centre: { x: number; y: number }; detail: React.ReactNode; crowd: React.ReactNode }> = ({ zoomAt, frames, centre, detail, crowd }) => {
  const frame = useCurrentFrame();
  const ZOOM = { to: 0.5, drift: 0.45, frames: 24 };
  const out = interpolate(frame, [zoomAt, zoomAt + ZOOM.frames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drift = interpolate(frame, [zoomAt + ZOOM.frames, frames], [0, 1], clamp);
  const scale = 1 + (ZOOM.to - 1) * out + (ZOOM.drift - ZOOM.to) * drift;
  const crowdOpacity = interpolate(frame, [zoomAt - 2, zoomAt + 5], [0, 1], clamp); // the crowd appears shortly before the move
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: centre.x, top: centre.y, width: 0, height: 0, transform: `scale(${scale})` }}>
        <div style={{ opacity: crowdOpacity }}>{crowd}</div>
        {detail}
      </div>
    </div>
  );
};
```

The crowd around it is a grid (every second row offset by half a cell) in which all cells within the detail are left out.
It is generated once at load with `rng`:

```tsx
const CELL = 150;
const CROWD_CELLS = (() => {
  const r = rng(11);
  const out: { x: number; y: number; ask: number | null }[] = [];
  for (let gy = -12; gy <= 13; gy++)
    for (let gx = -10; gx <= 10; gx++) {
      const x = gx * CELL + (gy % 2 ? CELL / 2 : 0);
      const y = gy * CELL;
      const ask = r() < 0.45 ? 6 + Math.floor(r() * 20) : null; // frame (after the zoom starts) at which a question mark pops up
      if (Math.hypot(x, y) < 425 + 90) continue; // nothing in the detail and nothing right at the edge
      out.push({ x, y, ask });
    }
  return out;
})();
```

A tile in the detail fades in over 5 frames and then stays still. If the image file is missing, the name is shown as text,
so that the video builds even with incomplete material:

```tsx
const Cell: React.FC<{ name: string; file?: string; x: number; y: number; w: number; h: number; at: number }> = ({ name, file, x, y, w, h, at }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", opacity: t, transform: `scale(${0.86 + 0.14 * t})` }}>
      {file ? <Img src={staticFile(file)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ whiteSpace: "nowrap", fontSize: 30 }}>{name}</span>}
    </div>
  );
};
```

### Counting-up number and calendar

```tsx
/** Number that runs from a to b between the frames `from` and `to` (fast start, slow arrival) and gets a plus at the target. */
const Counter: React.FC<{ from: number; to: number; a: number; b: number }> = ({ from, to, a, b }) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const t = interpolate(frame, [from, to], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const value = Math.round((a + (b - a) * t) / 10) * 10; // in steps of ten: single digits would be too fast to read
  return (
    <div style={{ color: RED, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
      €{value.toLocaleString("en-US")}
      {frame >= to ? "+" : ""}
    </div>
  );
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** Tear-off calendar: flips `steps` months onward in `frames` frames, starting at month `startMonth` (0 = January) in year `startYear`. */
const Calendar: React.FC<{ frames: number; steps: number; startMonth: number; startYear: number }> = ({ frames, steps, startMonth, startYear }) => {
  const frame = useCurrentFrame();
  const step = Math.floor(interpolate(frame, [2, Math.max(3, frames - 4)], [0, steps], clamp));
  const month = (startMonth + step) % 12;
  const year = startYear + Math.floor((startMonth + step) / 12);
  const tilt = step > 0 && step < steps ? (frame % 2 === 0 ? -7 : 5) : 0; // each sheet tilts forward briefly while flipping
  return (
    <div style={{ perspective: 1200 }}>
      <div style={{ transform: `rotateX(${tilt}deg)`, transformOrigin: "50% 0%" }}>
        <div style={{ background: RED, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{year}</div>
        <div>{MONTHS[month]}</div>
      </div>
    </div>
  );
};
```

The sound for it: **one** riffle (`riffle1`) under the whole run, not one click per month (see section 5). The counter
reaches its target on frame `to`; the loudest point of the riser (`riser1` with `lead`) belongs there.

### Hand-drawn arrow

```tsx
/** The line draws itself from frame `at` over `draw` frames (pathLength 1, strokeDashoffset 1 → 0), then the head.
 *  The filter makes the stroke wobble: feTurbulence + feDisplacementMap, the seed changes every 4 frames.
 *  The white outline (a wider stroke underneath) keeps the arrow readable over a clip. */
const HandArrow: React.FC<{ at: number; path: string; head: string; draw?: number }> = ({ at, path, head, draw = 13 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const line = interpolate(frame, [at, at + draw], [1, 0], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const tip = interpolate(frame, [at + draw - 1, at + draw + 4], [1, 0], clamp);
  const seed = Math.floor(frame / 4) % 3;
  const stroke = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <defs>
          <filter id="hand" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={seed + 3} />
            <feDisplacementMap in="SourceGraphic" scale="9" />
          </filter>
        </defs>
        <g filter="url(#hand)">
          <path d={path} stroke="#fff" strokeWidth={22} strokeDashoffset={line} {...stroke} />
          <path d={head} stroke="#fff" strokeWidth={22} strokeDashoffset={tip} {...stroke} />
          <path d={path} stroke={RED} strokeWidth={11} strokeDashoffset={line} {...stroke} />
          <path d={head} stroke={RED} strokeWidth={11} strokeDashoffset={tip} {...stroke} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
```

The arrow starts as soon as the word it points at is up (`at` from the word time plus a few frames). The path leads past
text that lies above it and ends in the image it points at; in the example project, the simpler version without the wobble
is `Squiggle`.

**Check:** For each building block, render stills at the start, middle and end of the movement and look at them
(`npx remotion still … --frame=N`). On the zoom-out, watch the edges (empty area at the edge of the frame); on the arrow,
the readability over the clip; on the counter, that the end number is the spoken one.

## 8. Formats that ran far beyond the follower count on small accounts

From an evaluation of Instagram Reels (as of 8 Oct 2026): The search was for reels that ran far beyond the follower count
on small accounts, in order to adopt their construction. An example of the order of magnitude: an account with **about
1,400 followers and 1.9 million views** on an 11-second reel. As patterns, without accounts:

| Pattern | Construction (brief) |
|---|---|
| one image, one line, long caption | a single shot (static or a calm camera move), 5–10 s, one to three lines of text on screen; the line sometimes breaks off with "…", the story is in the caption (650–1,400 characters) |
| times of day over clips | title line, then five to seven times of day, each with a small line, over calm clips (about 16 s); as a variant, a fixed shot in time-lapse over which a clock runs |
| list in fast cuts | about every second a different clip with a label at the top of the frame; or two people in frame, over whom labels appear one after another (the joke is in the difference) |
| "Day 1" series | the first part of a series ("Day 1 of …"), mostly spoken with word-by-word subtitles and short insert shots of the screen |
| age and confession | a static shot at a desk, over it the age plus an admission or a question in quotation marks with the answer below; 7–10 s, no speaker |

The construction was read from ten stills per video and from the caption texts, not from information given by the accounts.

Common to almost all: **6 to 16 seconds and no speaker**. The kit builds on voiceover and word timings; these formats get
by without a speaker. Whether a voiceover helps or hurts them is not shown by the evaluation.

**Limits of the evaluation, honestly:**

- **Rounded numbers.** The platform shows views and followers rounded ("307K"); ratios are orders of magnitude.
- **Follower count of today.** How many followers the account had at the time of posting is unknown. For accounts that have
  grown since, the ratio back then was higher than calculated.
- **Selection by the platform.** The reels came from topic pages and a search, so from what the platform shows. Accounts
  with little reach are necessarily missing: this is a selection of the successful, not a comparison with the unsuccessful.
- **Small sample, Instagram only.** About a dozen reels were watched and transcribed; the construction was read from
  contact sheets and transcripts. Correlation is not proof that the format caused the reach.
- **Views are not followers.** How many new followers such a reel brought was not collected.
- **Follow-up parts of a series** were not examined, only the first part.

It follows: use this as a starting point for your own tests, not as a recipe. Change one thing per round and wait at least
72 hours ([`research-2026-10.md`](research-2026-10.md), section 5).

## 9. Several agents working on one project

The rules on checksums and reporting are in [`sound-and-text-sync.md`](sound-and-text-sync.md) and
[`../AGENTS.md`](../AGENTS.md). Added on this day:

- **One writer per file, md5 before writing** (`md5 -q <file>`, then `patch_lines.py` or `sync_remotion.py` with the md5).
- **Change shared building blocks only after agreeing.** If a second composition imports building blocks, constants or props
  types from the file of the first one (here, for example, clip frames, red and text lead), every change there also shifts
  the other video. Whoever wants to touch such a file says so beforehand and names the identifiers that others depend on.
- **Transfer files that belong together in one step.** Timing table and voiceover file, cue list and sound files,
  composition and props belong together. If the new table arrives before the new recording (or the other way round), the
  studio shows misaligned words, and nobody sees right away why. Use one `rsync` over all affected paths in **one** call,
  then compare the checksums on both sides.

**Check:** After the transfer, `md5 -q` of the files on both machines, reload the studio, a still on an emphasised word.
