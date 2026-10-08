# Flow film: the kit in 30 seconds

This project builds `docs/flow.mp4` and the silent preview `docs/flow.gif` for the README. On the left a person says what they
want, in the middle the agent works through the five steps (voiceover, clips, sounds, export, post), on the right the video grows
inside a phone. 1920 × 1080, 30 frames per second, 32 seconds, drawn in Remotion.

The phone shows a real video built with the kit (`docs/real-example.mp4`): while its first line is "recorded" you hear the voice
alone and see the words pop on exactly the spoken words; at the end the finished video plays with its own sound. Everything else
you hear are sounds from `sfx-kit/sounds/` (real recordings). There is no music.

| File | Content |
|---|---|
| `src/plan.ts` | schedule, all texts and the list of sounds (`CUES`). Every time lives here exactly once; picture and sound read the same constants |
| `src/Flow.tsx` | the picture: speech bubbles, the five cards, the phone |
| `src/sounds.json` | length, cue point and loudness of the sounds in use, written by `npm run prepare-media` from the kit's catalogue |
| `assets/` | the first spoken line of the real video (`voice-line.wav`) and three clip thumbnails |
| `scripts/prepare.mjs` | copies sounds, assets and the real video into `public/` |
| `scripts/preview.mjs` | puts the film into `docs/` and builds the GIF previews and the five step pictures (`docs/steps/`) |

Not committed (see `.gitignore`): `node_modules/`, `public/`, `out/`.

## Build

Prerequisites: Node 20 or newer, ffmpeg. All commands in the folder `flow-film/`.

```bash
npm install
```

```bash
npm run prepare-media
```

Look at it and change it in Remotion Studio (composition `Flow`):

```bash
npm run dev
```

Check the types:

```bash
npm run typecheck
```

Render (H.264, yuv420p, AAC) to `out/flow.mp4`:

```bash
npm run render
```

Put film, previews and step pictures into `docs/`:

```bash
npm run preview
```

## Change

- **Texts:** `TEXT` in `src/plan.ts` (speech bubbles, the agent's reports, title, closing).
- **Pace:** `S` (start of the five steps) and `T` in `src/plan.ts`. The sounds hang on the same constants and move with them.
- **Sounds:** `CUES` in `src/plan.ts`. `at` is the frame the sound sits on, `db` the target level of its loudest part; the volume is
  computed from the catalogue value `loud`. After adding a new sound name, run `npm run prepare-media` once.
- **Another video in the phone:** replace `docs/real-example.mp4` and `assets/voice-line.wav`, then set `WORDS`, `WAVE`, `LINE_MS`,
  `REAL_FRAMES` and `PLAY_MS` in `src/plan.ts` and `CLIP` (where the clip sits in the picture) in `src/Flow.tsx`.
- **Overall volume:** props `sfxVolume` (effects) and `videoVolume` (voice and the real video), in the Studio on the right or when
  rendering with `--props='{"sfxVolume":0.8,"videoVolume":1}'`.

## Check

Render only the effects and look at levels per section and stretches without any effect:

```bash
npx remotion render Flow out/sfx.wav --codec=wav --props='{"sfxVolume":1,"videoVolume":0}'
```

```bash
python3 ../edit-tools/sound_check.py out/sfx.wav --section 4 --gap 1.2
```

Loudness and peak of the whole film:

```bash
ffmpeg -hide_banner -i out/flow.mp4 -af ebur128=peak=true -f null -
```
