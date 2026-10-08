# Manual: all commands step by step

The commands of the kit in the order in which a video is made. The overview is in the [`README.md`](../README.md); setup and
all configuration settings are in [`setup.md`](setup.md).

## The flow in five steps

A video is made in this order. Every step has a sign that shows it is done; the long version is in
[`edit-tools/README.md`](../edit-tools/README.md). Step 1 runs in the `example/` folder (the project folder), the commands of
steps 2 to 5 from the repo's root folder, unless noted otherwise.

**1. Script and voiceover** – [`voice-studio/`](../voice-studio/README.md).
The spoken sentences are in `script.json`. You record in the browser with a teleprompter; then `npm run vo` measures the word timings
and rewrites `src/timing.ts`. Picture, text and sounds hang on these timings and move with them. A variant of the video is
another take of a similar script. Done when the alignment runs without aborting and the studio shows the new length.

```bash
npm run voice-studio
```

```bash
npm run vo -- recordings/<take>.wav
```

**2. Drop in clips** – [`edit-tools/README.md`](../edit-tools/README.md#step-2-drop-in-clips).
Fetch videos from WhatsApp, find the clip that belongs to a still frame with a contact sheet, put the file in `public/` and set a slot
in the studio (`slots` in the props: label, file, start second). Done when a rendered still frame has been looked at.

```bash
python3 edit-tools/whatsapp_clips.py export "<name>" --date YYYY-MM-DD --photos
```

```bash
python3 edit-tools/contact_sheet.py <folder>
```

**3. Sound design** – [`sfx-kit/README.md`](../sfx-kit/README.md).
Pick sounds on the listening page and enter them in the cue list `SFX_CUES`, every cue tied to a word timing or an animation constant.
Done when the effects-only track has been rendered and measured against the music (command in the `example/` folder).

```bash
python3 listen.py
```

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
```

**4. Final export** – [`edit-tools/post_render.sh`](../edit-tools/post_render.sh).
High-quality picture (H.264, CRF 14), sound at no more than −14 LUFS, once with and once without music, plus cover images of the
named frames (here 60, 150 and 240). The result is in `<project>/out/post-<date>/`; the script prints the measured loudness of each version.

```bash
EDIT_HOST=<ssh-name> edit-tools/post_render.sh <project-folder> <composition> <name> 60,150,240
```

**5. Posting** – [`edit-tools/POSTING.md`](../edit-tools/POSTING.md).
A human approves the caption. Only then a dry run or draft, and after a second approval `--publish`; afterwards the script reads
the post back (post ID, link, for Instagram the caption byte for byte). Without `--publish` nothing is published.

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <caption.txt> --dry-run
```

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <caption.txt> --publish
```

## Quick start

Start the example project (Remotion Studio, composition `Demo`), in the `example/` folder:

```bash
npm install
```

```bash
npm run dev
```

Start the listening page (runs at http://localhost:3700, picks end up in `selection.json`, which is not committed):

```bash
python3 listen.py
```

New sounds into the kit and into the project:

```bash
python3 sfx-kit/tools/prepare_sfx.py
```

```bash
python3 sfx-kit/tools/sync_remotion.py example
```

Check that everything still fits together: lint and types of the example project (in the `example/` folder) and the tests of the post
script (no network):

```bash
npm run lint
```

```bash
python3 -m unittest discover -s edit-tools/tests
```

Prerequisites: Node 20+, Python 3.9+, ffmpeg. Depending on the step, also:

- Voice Studio: `numpy` and [whisper.cpp](https://github.com/ggerganov/whisper.cpp) with at least one model (details in [`voice-studio/README.md`](../voice-studio/README.md))
- `prepare_sfx.py`: `numpy`, `soundfile`, `librosa`
- `sound_check.py`, `beat_align.py`: `numpy`, `soundfile`, `librosa`
- contact sheet: `Pillow`; `whatsapp_clips.py`: macOS with WhatsApp Desktop
- `post_render.sh`: `zsh`, `ssh`, `rsync` (also works on a single machine if remote login is on there)
- posting: Composio CLI (signed in) and `curl`, see [`edit-tools/POSTING.md`](../edit-tools/POSTING.md)
