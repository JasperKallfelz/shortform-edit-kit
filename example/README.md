# Example: short video with word timing and sound cues

A small Remotion project (9 s, 1080×1920, 30 fps, composition `Demo`) that shows the building blocks of a short video, without content of its own. The finished example sits next to it as `demo.mp4`; there the effects are 14 dB louder than in the project, so that you can hear them, whereas in the project they sit under voice and music.

## What the demo shows

1. **Hook** (0–3 s): an empty inset ("your clip") with a slow zoom, three lines of text that pop in exactly on the word, and the red script-font word sitting slightly over the inset. With shutter sounds, key presses and a pencil stroke.
2. **Number** (3–6 s): a green number that keeps rising until the cut, with a flap of the airport split-flap board every 3 frames (getting louder), a turned page up front and, at the end, a riser that ends exactly on the cut.
3. **Ending** (6–9 s): a name above a second inset, a squiggle arrow that draws itself from the name into the clip, a line of text below. A drum on the cut.

All times are in one place: `src/timing.ts` (word times in ms, as a voice recording delivers them after the word alignment). Scenes, texts and sounds hang on the same constants; if you change one time, picture and sound move together. In a real project this file is generated from the voiceover.

| File | Contents |
| --- | --- |
| `src/timing.ts` | word times, video length and name of the voiceover (`VO.file`, empty as delivered) |
| `script.json` | the spoken sentences and the keys under which they appear in `timing.ts` (for Voice Studio) |
| `src/Demo.tsx` | scenes, `Inset`, number, squiggle arrow, props schema and `SFX_CUES` |
| `src/lib/words.tsx` | word DSL: font, size, position and onset frame per word |
| `src/lib/ambient.tsx` | `AmbientInset`: clip card with an ambient-light glow, plus the `AMBIENT` values (see below) |
| `src/AmbientCard.tsx` | test for the glow: composition `AmbientCard` (3 s), just the card on white, without text and sound |
| `src/lib/safezone.tsx` | safe zones for Instagram and TikTok: the `SAFE` values and the check overlay `SafeZoneGuide` (see below) |
| `src/lib/fonts.ts` | fonts via `@remotion/google-fonts` |
| `src/lib/sfx.tsx` | catalog `SOUNDS` and the track `SfxTrack` that plays a cue list |
| `public/sfx/` | 53 prepared sounds (48 kHz, normalized) |

## Getting started

```
npm install
npm run dev
```

This opens Remotion Studio. Choose the composition `Demo` there. Every sound appears in the timeline as "SFX · name".

## Using your own clip, voiceover and music

Put the files into the `public/` folder, then select them in the props panel on the right in the studio:

- **Clip:** `slots` → entry 1 is the inset in the hook, entry 2 the one in the ending. Enter the file name at `clip` (e.g. `my-clip.mp4`), and use `startSec` to choose the start point in the clip. If left empty, the gray placeholder stays.
- **Voiceover:** best with Voice Studio (see below): it records, masters and writes the file and the word times to `src/timing.ts`; the demo then plays `VO.file` by itself. By hand: enter a file name at `voiceover` and adjust the times in `src/timing.ts`.
- **Music:** enter the file name at `music`, and `musicVolume` sets the volume. Empty = no music.
- `sfxVolume` sets all effects together (default 1.3), `counterTo` the value the number reaches at the cut.
- `safeZone` (default `false`) lays the check overlay for the safe zones over the picture, see below. `AmbientCard` also has `safeZone`.

## Ambient light: clip card with a glow

A rounded card (video or photo) on a white background, with the same media behind it once more: somewhat larger, heavily blurred, brightened and more strongly colored. This way the clip glows onto the white, like YouTube's ambient mode. The building block is `AmbientInset` in `src/lib/ambient.tsx`, independent of `Demo.tsx` and a replacement for `Inset` there when the background is light.

Building it in (`len(0)` stands for the length of the scene in frames, as in `Demo.tsx`):

```tsx
import { AmbientInset } from "./lib/ambient";

<AbsoluteFill style={{ background: "#fff" }}>
  <AmbientInset clip="my-clip.mp4" startSec={2} frames={len(0)} top={44} />
</AbsoluteFill>
```

Looking at it: in the studio, choose the composition `AmbientCard` and enter a file from `public/` at `clip` on the right (switching `glow` off and on shows the difference). If `clip` stays empty, a colorful gradient lies in the card, so that you can see the glow even without material. As a still with a colorful test video (do not check it in):

```
ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30:duration=4 -pix_fmt yuv420p public/test.mp4
npx remotion still AmbientCard ambient.png --frame=45 --props='{"clip":"test.mp4"}'
```

Parameters of `AmbientInset`:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `clip` | – | file under `public/` (mp4, jpg, png, webp); empty = colorful gradient |
| `startSec` | 0 | start point in the video in seconds |
| `frames` | – | length of the scene in frames; the zoom runs over this duration |
| `top`, `width` | 37, 86 | position: distance from the top (% of the height) and width (% of the width) |
| `aspect`, `radius` | `"16 / 9"`, 28 | aspect ratio and corner radius in pixels |
| `focus` | `"50% 50%"` | crop within the clip (`object-position`), e.g. `"50% 30%"` for a person in the upper third |
| `zoomTo` | 1.08 | scale at the end of the zoom, 1 = no zoom |
| `rate` | 1 | playback speed of the video |
| `glow` | `true` | `false` = card without glow |

The glow itself is set by `AMBIENT` at the top of `ambient.tsx`: `scale` 1.07 (how far it reaches beyond the card), `blur` 58 (how soft, in pixels), `brightness` 1.3, `saturate` 1.8 (how bright and strong) and `opacity` 0.85. The blur is tuned to 1080 × 1920; scale it along for a different resolution.

What you should know:

- **One frame carries everything.** Position, pop-in (spring) and fade-in sit on the outer frame, so glow and card move together.
- **Same crop for both.** The glow is a sibling *under* the card and needs the same `startSec` and `rate` as the card's video, otherwise the colors lag behind the picture. `AmbientInset` sets both together; if you rebuild the block, you have to keep that.
- **`brightness` above 1 is intentional.** On white, a glow can only tint, not brighten. With dark material, an unbrightened copy looks like a dirty shadow instead of like light.
- **Colorful footage glows best** (blue sky, green grass). Gray material stays subtle.
- **Only on a light background.** On dark, the glow cannot be seen.
- **The card's shadow is reduced** (smaller and paler than on the `Inset` of the demo), so that it does not dirty the glow.
- **Cost:** one second video layer per card, so the render takes correspondingly longer. For cards without a glow, use `glow={false}`.

## Safe zones: where the app puts its controls

Instagram Reels and TikTok lay their own elements over the video: at the top the header, tabs and search, at the bottom name, description, sound and navigation, on the right the column with profile picture, like, comment and share. Whatever lies underneath is covered. House rule: **Nothing important ever goes into these strips.** The building block is `src/lib/safezone.tsx`, independent of `Demo.tsx`: `SAFE` (the values) and `SafeZoneGuide` (a check overlay that tints the strips).

The values for 1080 × 1920 (9:16), as of October 2026:

| Side | clear | the app shows there | Important things lie within |
| --- | --- | --- | --- |
| top | 250 px | header, tabs, search | y ≥ 250 |
| bottom | 480 px | name, description, sound, navigation | y ≤ 1440 |
| right | 160 px, only from y = 860 downward | profile picture, like, comment, share | x ≤ 920 |
| left | 60 px | nothing, just a safety margin | x ≥ 60 |

- **Important** are text, faces, arrows and pointers, and the spot that a scene is about (for example a circle on a card).
- **May extend into them:** background, card edges, legs and floor, and full-frame video.

Checking with the overlay: it lies as the top layer over the picture and tints the four strips pink with a dashed border. `Demo` and `AmbientCard` have the prop `safeZone` for this (default `false`; a normal render and `demo.mp4` stay unchanged). In the studio, switch `safeZone` on on the right, or render a still per scene (in `example/`):

```
npx remotion still Demo zone.png --frame=70 --props='{"safeZone":true}'
```

Look at the picture: if text, a face or a pointer lies in the pink, rebuild the scene. Switch the overlay on only for checking, and off again before rendering the video. This is how it goes into your own composition (`safeZone: z.boolean()` in the schema, `false` in the defaults):

```tsx
import { SafeZoneGuide } from "./lib/safezone";

<AbsoluteFill>
  {/* … scenes … */}
  {safeZone ? <SafeZoneGuide /> : null}
</AbsoluteFill>
```

What you should know:

- **Check every scene, not just the first.** One still per scene once everything is in place (after the last word onset). For a zoom or a growing number, also look at the largest state shortly before the cut.
- **If a scene violates the zone at the top,** put the text and cards of this scene into a common `AbsoluteFill` with `transform: translateY(140px)`, so that they move together. Full-frame video stays where it is.
- **A card may hang into the strip at the bottom,** as long as the face and the spot of interest stay above y = 1440.
- **Long words** (script font) may reach to the right edge above y = 860, but not below.
- **The tail of an arrow counts too,** not just the tip.
- **Start inside the frame right away.** Build the layout inside the limits from the beginning, instead of pushing it in at the end.

### How the demo fares

The demo has not been reworked: it shows the building blocks, and a real video builds its layout inside the frame from the start. Viewed with the overlay and measured on the stills without the overlay (frames 70, 150, 179 and 255; text and lines outside the cards counted; the demo has no faces):

- **Scene 1 (hook):** "this is" lies entirely in the top strip (y 181 to 239) and violates the rule. "your hook" begins just below it. The script-font "hello" lies inside, only the end of the "h" reaches up to 7 px into the left strip (x 53 to 59, y 864 to 872). The inset hangs into the column at the bottom right; that is a card and allowed.
- **Scene 2 (number):** everything inside. The ▲ ends at x = 906, 14 px before the limit; with a larger `counterTo` the number becomes wider and bumps into it.
- **Scene 3 (ending):** "thanks for watching" (y 1406 to 1487) lies about halfway in the bottom strip and violates the rule. "I'm" touches the limit at the top (top edge at y ≈ 246). The squiggle arrow stays outside the right column: the loop reaches to x = 991, but lies above y = 860; below that the line goes to x = 879 at most.

### Where the numbers come from

The values are rules of thumb, averaged from several safe-zone templates. **Neither Instagram nor TikTok publishes fixed dimensions for regular (organic) posts.** After a redesign of either app, re-check the values on a real phone.

For context: Meta gives margins only for Reels ads (about 14 % at the top, 35 % at the bottom, 6 % each at the sides; on 1080 × 1920 that is roughly 269, 672 and 65 px). For ads, TikTok supplies overlay files per placement instead of a single table of numbers. Third-party guides give values of about 320 to 672 px for the bottom (up to 768 px with an ad notice); the 480 px of the house rule lie in between.

Sources (as of October 2026):

- [AdKit: Safe Zones for Meta](https://adkit.so/tools/safe-zones/meta)
- [AdKit: Safe Zones for TikTok](https://adkit.so/tools/safe-zones/tiktok)
- [Inro: Instagram Reels Safe Zone Checker](https://www.inro.social/tools/instagram-reels-safe-zone-checker)
- [Poster.ly: TikTok Safe Zone Checker](https://www.poster.ly/tools/tiktok-safe-zone-checker)
- [Ignite Social Media: What are the safe zones for TikToks and Instagram Reels?](https://www.ignitesocialmedia.com/content-creation/what-are-the-safe-zones-for-tiktoks-and-instagram-reels/)

## Recording your own voiceover (Voice Studio)

The word times in `src/timing.ts` are example values. With [Voice Studio](../voice-studio/README.md) they come from a real recording:
recorder page with teleprompter (script from `script.json`), mastering, word alignment with Whisper (local) and a new `timing.ts`.
The requirements (whisper.cpp, models, `numpy`) are listed there.

```
npm run voice-studio
```

This starts the recorder page at http://localhost:3600 and saves every take in `recordings/` (not checked in). Then choose a take:

```
npm run vo -- recordings/take-….wav
```

This writes `public/vo.wav` (not checked in) and overwrites `src/timing.ts`; the length of the demo follows the recording. Back to the example state:
`git checkout src/timing.ts` and delete `public/vo.wav` (the hand-written version is also kept in `recordings/timing-handwritten.ts`).
For a render with effects only (to check the level of the sounds), pass `--props '{"voVolume":0,"music":""}'`.

## Rendering

```
npx remotion render Demo out/demo.mp4
```

## Sounds

The sounds in `public/sfx` are CC0 or CC0-like (BigSoundBank "CC0 1.0 / WTFPL", Freesound CC0, Remotion SFX, Kenney). Origin and license per file are in `../sfx-kit/sources.tsv`.
