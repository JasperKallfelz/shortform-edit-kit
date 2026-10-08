# Tour: video through the shortform-edit-kit

> **Note:** the committed `docs/tour.mp4` was recorded before the translation to English and still shows the German interface of the tools. It has to be re-recorded (see "Re-record" below).

This project builds `docs/tour.mp4`: a tour in five steps (Script and voiceover, Drop in clips, Sound design, Final export, Posting), 1920 × 1080, 30 fps, about 80 seconds. The browser tools are **real captures** (headless Chromium, sharp at double resolution), the terminal scenes are **re-created** (no real terminal, so that no user, machine or path name appears in the picture).
It is composed with Remotion: windows with rounded corners and a shadow on a calm gradient, gentle zooms, a chapter label at the top, a caption at the bottom. Sound: only quiet effects from `sfx-kit/sounds/` (page turn, shutter, keys) and the sound of `example/demo.mp4`.

| Folder/file | Contents |
|---|---|
| `captures/cap.mjs` | capture library: Chrome screencast at full resolution, mouse pointer, click ring, key display |
| `captures/record.mjs` | the four browser scenes: `voice-studio`, `props`, `timeline`, `listen` |
| `scripts/prepare.mjs` | scales the captures, copies the demo video and sounds to `public/`, writes `src/marks.json` (run it with `npm run prepare-media`) |
| `src/Tour.tsx` | the cut: scenes, zooms, captions, chapters, sound |
| `src/Terminal.tsx`, `src/scripts.ts` | the drawn terminal and its text |
| `src/marks.json` | time marks of the captures (small, checked in so that `tsc` runs without the raw captures) |

Not checked in (see `.gitignore`): `node_modules/`, `public/`, `out/`, `work/` and everything large in `captures/` (raw videos, browser, test microphone).

## Requirements

Node 20 or newer, Python 3, ffmpeg, and on macOS the `say` command (for the test speaker voice). For step 1 you also need whisper.cpp with a model (see `voice-studio/README.md`).

```bash
cd tour && npm install
```

```bash
cd tour/captures && npm install
```

Chromium goes into a folder next to the capture scripts (the repo stays clean, nothing lands in your home folder):

```bash
cd tour/captures && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers npx playwright install chromium-headless-shell
```

## Re-record

The tools run on their own ports so that nothing collides with a running session. So that `npm run vo` and the studio do not change anything in the repo, they work in a copy of `example/` and `voice-studio/` under `tour/work/` (APFS clone, takes almost no space).

```bash
cd tour && mkdir -p work captures/raw captures/logs && cp -Rc ../example work/example && cp -Rc ../voice-studio work/voice-studio && rm -rf work/example/out
```

Test microphone: a voice made with `say`, with four seconds of silence at the start (the countdown of the recorder page lasts that long), at about −9 dBFS.
The sentence is the text from `example/script.json`.

```bash
cd tour/captures/raw && say -v Daniel -r 150 -o u.aiff "this is your hook, [[slnc 250]] hello. [[slnc 700]] look at these numbers. [[slnc 700]] I'm Your Name, [[slnc 150]] thanks [[slnc 120]] for watching."
```

```bash
cd tour/captures/raw && ffmpeg -y -i u.aiff -af "adelay=3900|3900,apad=pad_dur=3,volume=-8dB" -ar 48000 -ac 1 -c:a pcm_s16le fake-mic.wav
```

A neutral example clip for the props field (a calm color gradient, no footage of people):

```bash
cd tour/work/example/public && ffmpeg -y -f lavfi -i "gradients=s=1280x720:d=14:r=30:speed=0.018:c0=0x1d4ed8:c1=0xf59e0b:c2=0xec4899:c3=0x10b981:nb_colors=4" -c:v libx264 -pix_fmt yuv420p -crf 20 example-clip.mp4
```

Start the tools, each in its own terminal, from the repo folder (ports 4731 to 4733; the addresses in the title bars of the video are the default ports from the README files). The listening page runs from the repo itself; its picks go into the copy through `LISTEN_STATE`, so `selection.json` in the repo stays untouched:

```bash
LISTEN_PORT=4731 LISTEN_STATE=$PWD/tour/work/selection.json python3 listen.py
```

```bash
cd tour/work/example && npm run voice-studio -- --port 4732
```

Record the Voice Studio scene first (it puts a take into `work/example/recordings/`) and then do the real `vo` run, whose output the terminal in the video shows. Whisper likes to leave out "thanks for watching" at the end (a known quirk); with this voice and the short pause after "thanks" it is recognized, otherwise `--allow-mismatch` helps.

```bash
cd tour/captures && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node record.mjs voice-studio
```

```bash
cd tour/work/example && VOICE_STUDIO_MODELS=<path>/ggml-large-v3-turbo.bin npm run vo -- recordings/<take>.wav
```

Then start the Studio in the copy (it reads the new `timing.ts` and `public/vo.wav`):

```bash
cd tour/work/example && npx remotion studio --port 4733 --no-open
```

Record the other three scenes:

```bash
cd tour/captures && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node record.mjs props
```

```bash
cd tour/captures && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node record.mjs timeline
```

```bash
cd tour/captures && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node record.mjs listen
```

To choose other ports, set `PORT_VOICE_STUDIO`, `PORT_STUDIO` and `PORT_LISTEN`. Afterwards stop all servers and delete `work/selection.json`.

Note: when you leave a props field, the Studio briefly shows "Cannot update default props" (the default values are in a variable, not in the file). The `props` scene waits for the message, and the cut in `Tour.tsx` skips exactly those seconds.

## Render

Prepare the captures and sound for Remotion (calls ffmpeg, writes `public/` and `src/marks.json`; the npm script is called `prepare-media` because npm runs a script named `prepare` on every `npm install`):

```bash
cd tour && npm run prepare-media
```

Check the types:

```bash
cd tour && npx tsc --noEmit
```

Render (H.264, yuv420p, AAC; with PNG frames, otherwise ffmpeg reports the video as `yuvj420p` with full range):

```bash
cd tour && npx remotion render Tour out/tour.mp4 --image-format=png --codec=h264 --crf=23 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=192k
```

Still image for the preview (frame 1004 is the start of chapter 3, the window sits fully on the gradient):

```bash
cd tour && npx remotion still Tour ../docs/tour.jpg --frame=1004 --image-format=jpeg --jpeg-quality=85
```

Put the video into `docs/` (about 11 MB; the still image is already there):

```bash
cp tour/out/tour.mp4 docs/tour.mp4
```

## Customize

- Texts of the terminal scenes: `src/scripts.ts`. The output of `npm run vo` comes from a real run (long lines shortened with "…"); `post_render.sh` and `post_social.py` follow the output format of the scripts, and the numbers (loudness, file sizes) are example values.
- Zooms and pace per scene: at the top of `src/Tour.tsx` (the `*Segs` sections are in raw time of the capture, `*ZoomRaw` has the scale and the target point as a fraction of the window).
- A self-recording with your own voice: `../docs/tour-recording-plan.md`.
