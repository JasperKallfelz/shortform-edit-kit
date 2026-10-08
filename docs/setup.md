# Setup and configuration

This guide is written for an AI agent that sets the kit up on someone else's machine. Humans can follow the same steps. All commands
run in the root folder of the cloned repo unless noted otherwise. Every step ends with a sign ("done when …") that you can read off the
command itself.

Rules for the setup:

- Post nothing, create no drafts, connect no accounts. Only the human does that.
- Only the human can record, grant microphone access and sign in to accounts. Tell them what is missing instead of papering over it.
- Personal files (account IDs, recordings, picks) stay out of commits; the list is under [Personal files](#34-personal-files-never-committed).
- Do not print account IDs, upload addresses or captions in reports.

## 1. Check the prerequisites

This guide was tested with Node 22, Python 3.9 (system) and 3.13, ffmpeg 8 and npm 12 on macOS.

| What | Check command | If it is missing | Needed for |
|---|---|---|---|
| Node 20 or newer | `node --version` | from nodejs.org or `brew install node` | everything with Remotion, recorder page |
| Python 3.9 or newer | `python3 --version` | `brew install python` | all scripts |
| ffmpeg and ffprobe | `ffmpeg -version` | `brew install ffmpeg` | `vo`, `post_render.sh`, contact sheet |
| `numpy` | `python3 -c "import numpy"` | `pip install numpy` | Voice Studio (`npm run vo`) |
| `whisper-cli` | `command -v whisper-cli` | `brew install whisper-cpp` | word timings (`npm run vo`) |
| a ggml model | `echo "$VOICE_STUDIO_MODELS"`, then `ls -l <path>` for each path | see step 7 | word timings (`npm run vo`) |
| `soundfile`, `librosa` | `python3 -c "import soundfile, librosa"` | `pip install soundfile librosa` | `prepare_sfx.py`, `sound_check.py`, `beat_align.py` |
| `Pillow` | `python3 -c "import PIL"` | `pip install Pillow` | `contact_sheet.py` |
| `zsh`, `ssh`, `rsync` | `zsh --version`, `ssh -V`, `rsync --version` | the system's package manager | `post_render.sh` |
| `composio`, `curl` | `composio whoami`, `curl --version` | see [`edit-tools/POSTING.md`](../edit-tools/POSTING.md) | `post_social.py` (posting only) |
| macOS with WhatsApp Desktop | `ls ~/Library/Group\ Containers \| grep -i whatsapp` | only possible on macOS | `whatsapp_clips.py` (only for clips from WhatsApp) |
| Browser with a microphone | (no command) | the human chooses it | recorder page |
| `swiftc` (optional) | `command -v swiftc` | `xcode-select --install` | switching the input device (`setinput`) |

Only the example project and the tests need Node, Python and ffmpeg. Everything else applies only once the human needs the step in
question: tell them at the end what is missing, and do not install anything they do not need.

On the first render, Remotion downloads a headless Chrome once (about 95 MB) into `example/node_modules/.remotion`. The machine needs
network access for that first render.

## 2. Set up

Step 1: change into the repo and check that it is complete.

```bash
ls AGENTS.md example/package.json voice-studio/recorder/server.mjs
```

Done when all three files are listed.

Step 2: install the example project.

```bash
cd example && npm ci
```

Done when the command ends with exit code 0 and `example/node_modules/` exists. Notes about vulnerabilities (`npm audit`) and about a
blocked install script of `esbuild` appear with this version of npm; lint and render work anyway.

Step 3: check types and style of the example project (in the `example/` folder).

```bash
npm run lint
```

Done when the command ends without an error message (exit code 0; it runs `eslint src && tsc`).

Step 4: run the tests of the post script. They need no network and no account.

```bash
python3 -m unittest discover -s edit-tools/tests
```

Done when the last line is `OK`.

Step 5: start Remotion Studio (in the `example/` folder). It keeps running until you stop it; tell the human the address it prints.

```bash
npm run dev
```

Done when the output names an address and the composition `Demo` appears in the browser. Without the studio you can show the same
thing like this (in the `example/` folder):

```bash
npx remotion compositions src/index.ts
```

Done when a line with `Demo`, `30`, `1080x1920` and `270 (9.00 sec)` appears (name, frames per second, size, length).

Step 6: render a still frame and look at it (in the `example/` folder; `out/` is excluded from Git).

```bash
npx remotion still Demo out/frame.png --frame=60
```

Done when `out/frame.png` exists (1080 × 1920 pixels) and the image has been looked at.

Step 7: provide Whisper for the word timings. Only needed if the human wants to record a voiceover.

```bash
brew install whisper-cpp
```

Download a model (in the whisper.cpp folder; for languages other than English use a model without `.en`):

```bash
sh models/download-ggml-model.sh medium.en
```

Tell the kit the paths, separated by commas (several models make the timings more accurate, one is enough):

```bash
export VOICE_STUDIO_MODELS=~/whisper/ggml-medium.en.bin
```

Done when `command -v whisper-cli` prints a path and every model file exists. Without a model, `npm run vo` aborts with
"No Whisper model given" before anything is changed.

Step 8: start the recorder page (in the `example/` folder). Only the human can record.

```bash
npm run voice-studio
```

Done when the output says `Recorder page: http://localhost:3600` and the page returns 200:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3600/
```

The browser asks for the microphone there; the permission is only possible via `http://localhost:…` (not via any other address).

Step 9: start the listening page if the human wants to pick sounds.

```bash
python3 listen.py
```

Done when it answers at `http://localhost:3700` and kit and candidates together deliver 286 sounds (53 processed ones and 233 candidates):

```bash
curl -s http://localhost:3700/api/sounds | python3 -c "import json,sys; print(len(json.load(sys.stdin)['sounds']))"
```

The listening page creates `selection.json` (excluded from Git). If nothing should be created in the repo, set `LISTEN_STATE` to another file.

Step 10: change sounds, only if the human wants new sounds. `prepare_sfx.py` rewrites **all** sounds and the catalogue; `sync_remotion.py` copies them
into the project (there into `public/sfx` and `src/lib/sfx.tsx`).

```bash
python3 sfx-kit/tools/prepare_sfx.py
```

```bash
python3 sfx-kit/tools/sync_remotion.py example
```

Done when `sync_remotion.py` reports "53 sounds in the project". With the second argument (md5 of `src/lib/sfx.tsx`) it aborts without writing
if another agent has changed the file in the meantime.

Step 11: prepare posting, only if the human wants to post. They connect the account themselves (see [`edit-tools/POSTING.md`](../edit-tools/POSTING.md)).

```bash
cp edit-tools/post.config.example.json edit-tools/post.config.json
```

```bash
python3 edit-tools/post_social.py accounts
```

`accounts` only reads and names the values that belong in the file. Done when the file contains the values `accounts` named.
`post.config.json` is listed in `.gitignore`.

Step 12: prepare the final export, only if a video is to be exported. `post_render.sh` needs `EDIT_HOST`, the SSH name of the machine that holds the
Remotion project (it can be the same machine if remote login is on there).

```bash
ssh <ssh-name> true
```

Done when the command ends with exit code 0 without a password prompt.

### What only the human can do

- grant the microphone in the browser and in the system settings, and speak the recording
- connect the TikTok and Instagram accounts at Composio
- approve the caption and then the publishing
- choose music whose rights are cleared (see [`research-2026-10.md`](research-2026-10.md))

## 3. Configuration reference

Locations are file names as of this repo's current state. Paths are relative to the repo root.

### 3.1 Environment variables

| Name | Read in | Default | What for |
|---|---|---|---|
| `VOICE_STUDIO_MODELS` | `voice-studio/vo/align.py` | empty (then abort) | paths of the Whisper models (`ggml-*.bin`), separated by commas, `~` is resolved; `--models` takes precedence |
| `WHISPER_CLI` | `voice-studio/vo/align.py` | `whisper-cli` from the `PATH` | path to `whisper-cli` |
| `VOICE_STUDIO_PORT` | `voice-studio/recorder/server.mjs` | `3600` | port of the recorder page (the server listens on `127.0.0.1` only); `--port` takes precedence |
| `LISTEN_PORT` | `listen.py` | `3700` | port of the listening page (`127.0.0.1` only) |
| `LISTEN_STATE` | `listen.py` | `selection.json` next to `listen.py` | file for the picks (keep or drop). **Personal** |
| `EDIT_HOST` | `edit-tools/post_render.sh` | none, **required** | SSH name of the machine that holds the Remotion project |
| `PORT_VOICE_STUDIO` | `tour/captures/record.mjs` | `4732` | port of the recorder page when the tour is re-recorded |
| `PORT_STUDIO` | `tour/captures/record.mjs` | `4733` | port of the Remotion Studio there |
| `PORT_LISTEN` | `tour/captures/record.mjs` | `4731` | port of the listening page there |
| `TOUR_DEBUG` | `tour/src/Tour.tsx` | not set | when set, the tour prints the length of every scene |
| `PLAYWRIGHT_BROWSERS_PATH` | read by Playwright itself; set in the commands of `tour/README.md` | Playwright's user folder | folder for the Chromium used for the tour recordings |

### 3.2 Command-line flags

Every script prints its usage with `--help` and does no work in that case. `vo.py`, `server.mjs`, `whatsapp_clips.py`, `contact_sheet.py`, `post_social.py`,
`sound_check.py` and `beat_align.py` exit with code 0; `prepare_sfx.py`, `sync_remotion.py`, `listen.py`, `patch_lines.py` and `post_render.sh` exit with code 1.

**Recorder page** (`node voice-studio/recorder/server.mjs`, in the project as `npm run voice-studio`; flags defined in `voice-studio/recorder/server.mjs`)

| Flag | Default | Effect |
|---|---|---|
| `--project <folder>` | current folder | project folder |
| `--script <file>` | `script.json` in the project | script for the teleprompter |
| `--dir <target>` | `recordings` in the project (created) | where the takes are saved; never overwritten |
| `--port <number>` | `VOICE_STUDIO_PORT`, otherwise 3600 | port |

**Voiceover** (`python3 voice-studio/vo/vo.py`, in the project as `npm run vo -- <take>`; flags defined in `voice-studio/vo/vo.py`)

| Flag | Default | Effect |
|---|---|---|
| `input` (one or more) | required | `take.wav` or `take.wav:from_ms:to_ms[:gain_db]`; several pieces are placed one after another |
| `--project` | `.` | project folder |
| `--script` | `script.json` | script file, relative to the project |
| `--timing` | `src/timing.ts` | timing table that is written |
| `--public` | `public` | folder for the finished audio file |
| `--chain` | `neutral` | sound variant: `neutral` or `deep` |
| `--models` | empty (then `VOICE_STUDIO_MODELS`) | Whisper models, separated by commas |
| `--set KEY=MS` | none | override one timing value by hand (repeatable) |
| `--allow-mismatch` | off | skip words that Whisper counts differently; their timings are estimated |

Can be called on their own: `align.py <audio> <script.json> [report.json] [--models a.bin,b.bin] [--allow-mismatch]` (`voice-studio/vo/align.py`),
`master.py <raw.wav> <target.wav> [neutral|deep] [target_lufs_per_channel, default -17]` (`voice-studio/vo/master.py`), `script.py <script.json>` checks a script file (`voice-studio/vo/script.py`).
`setinput` (built from `voice-studio/mic/setinput.swift`) switches the input device: the argument is part of the device name, without an argument the devices are listed.

**Clips** (`whatsapp_clips.py`, `contact_sheet.py`)

| Flag | Default | Effect | Defined in |
|---|---|---|---|
| `chats --days N` | 14 | chats with new videos from the last N days | `edit-tools/whatsapp_clips.py` |
| `export <chat> --date YYYY-MM-DD` | none | only files from this day | `edit-tools/whatsapp_clips.py` |
| `export --days N` | 1 | without `--date`: the last N days | `edit-tools/whatsapp_clips.py` |
| `export --images` | off | also images | `edit-tools/whatsapp_clips.py` |
| `export --all` | off | also files you sent yourself | `edit-tools/whatsapp_clips.py` |
| `export --out <folder>` | `~/Movies/WhatsApp-<name>-<date>` | target folder | `edit-tools/whatsapp_clips.py` |
| `export --photos [ALBUM]` | off | also import into the photo library | `edit-tools/whatsapp_clips.py` |
| `contact_sheet.py <folder> --at S` | 1.0 | second of the thumbnail | `edit-tools/contact_sheet.py` |
| `contact_sheet.py --out <file>` | `<folder>/contact.jpg` | target file | `edit-tools/contact_sheet.py` |
| `contact_sheet.py --columns N` | 6 | columns | `edit-tools/contact_sheet.py` |

`whatsapp_clips.py` reads the path of the WhatsApp database from the constant `BASE` (in `edit-tools/whatsapp_clips.py`) and opens it read-only.

**Audio** (`sound_check.py`, `beat_align.py`)

| Flag | Default | Effect | Defined in |
|---|---|---|---|
| `sound_check.py <sfx.wav>` | required | effects-only track | `edit-tools/sound_check.py` |
| `--music <song>` | none | measure the effects against the music | `edit-tools/sound_check.py` |
| `--music-start S` | 0.0 | position in the song where the video starts | `edit-tools/sound_check.py` |
| `--music-vol V` | 0.15 | music volume in the video | `edit-tools/sound_check.py` |
| `--mix <mix.wav>` | none | loudness and peak of the whole mix | `edit-tools/sound_check.py` |
| `--section S` | 2.0 | length of a section for the level | `edit-tools/sound_check.py` |
| `--gap S` | 0.5 | list stretches without an effect from this length | `edit-tools/sound_check.py` |
| `beat_align.py <song> <timing.ts> <word>` | required | put a beat of the song on a word | `edit-tools/beat_align.py` |
| `--also w1,w2` | empty | further words whose distance to the beat is shown | `edit-tools/beat_align.py` |
| `--max-start S` | 120.0 | latest entry point in the song | `edit-tools/beat_align.py` |
| `--fps N` | 30 | frame rate for snapping | `edit-tools/beat_align.py` |
| `--top N` | 6 | number of candidates | `edit-tools/beat_align.py` |

**Final export and posting** (`post_render.sh`, `post_social.py`)

| Flag | Default | Effect | Defined in |
|---|---|---|---|
| `post_render.sh <project> <composition> <name> [frames]` | three required values | project folder in the home folder of `EDIT_HOST`, composition, file name, cover frames like `60,150,240` | `edit-tools/post_render.sh` |
| `--dry-run` | off | `post_social.py`: only show, upload or create nothing (also together with `--publish`) | `edit-tools/post_social.py` |
| `--config <path>` | `post.config.json` next to the script | other configuration file; the log then sits next to it | `edit-tools/post_social.py` |
| `upload --new` | off | upload again despite a fresh upload | `edit-tools/post_social.py` |
| `tiktok --caption-file <file>` | required | caption (UTF-8) | `edit-tools/post_social.py` |
| `tiktok --publish` | off (then a draft) | publish at once | `edit-tools/post_social.py` |
| `instagram --caption-file <file>` | required | caption (UTF-8) | `edit-tools/post_social.py` |
| `instagram --thumb-ms N` | none | cover image from the video at N milliseconds | `edit-tools/post_social.py` |
| `instagram --not-in-feed` | off | reel only in the Reels tab | `edit-tools/post_social.py` |
| `instagram --publish` | off (then check only) | really publish | `edit-tools/post_social.py` |
| `status --tiktok-post <id>` or `--instagram-media <id>` | one of the two required | read the state of a post | `edit-tools/post_social.py` |

**Other scripts:** `sync_remotion.py <project> [md5]` (`sfx-kit/tools/sync_remotion.py`; with md5 it aborts if `src/lib/sfx.tsx` has changed),
`patch_lines.py <file> <md5> <swaps.json>` (`edit-tools/patch_lines.py`). `prepare_sfx.py` and `listen.py` take no arguments; any argument,
including `--help`, only prints the usage and exits with code 1 (`sfx-kit/tools/prepare_sfx.py`, `listen.py`).

### 3.3 Configuration files and props

**`example/script.json`** (example: `example/script.json`; checked by `voice-studio/vo/script.py`)

| Field | Default | What for |
|---|---|---|
| `language` | `en` (set in `voice-studio/vo/script.py`) | Whisper code of the recording: `en`, `de`, … |
| `file` | `vo.wav` (set in `voice-studio/vo/script.py`) | name of the finished voiceover under `public/` |
| `tailMs` | `640` (set in `voice-studio/vo/script.py`) | time from the last word to the end of the video |
| `lines[].note` | none | appears on the teleprompter and as a comment in `timing.ts` |
| `lines[].phrases[].key` | required | name in `timing.ts`; letters, digits, `_`, `$`, must not start with a digit, unique per file (checked in `voice-studio/vo/script.py`) |
| `lines[].phrases[].text` | required | spoken words in speaking order |
| `lines[].phrases[].display` | `text` | for the screen only: `*stressed*`, `\|` breath, `\|\|` pause, `^` voice up, `~` voice falls |

**`example/src/timing.ts`** is generated by `npm run vo` (`voice-studio/vo/retime.py`): `VO.file` (audio file under `public/`, empty = no voiceover),
`VO.endMs` (length of the video in ms) and `VO.w.<key>` (start of every phrase in ms). If you change it by hand, the change lasts only until the next `vo` run; a version
written by hand is saved once to `recordings/timing-handwritten.ts` (`voice-studio/vo/retime.py`).

**Props of the composition `Demo`** (schema and defaults in `example/src/Demo.tsx`; in Remotion Studio in the props field on the right, or with `--props='{…}'` when rendering)

| Prop | Default | What for |
|---|---|---|
| `voiceover` | `""` | audio file under `public/`; empty = `VO.file` from `timing.ts` |
| `voVolume` | `1` (0 to 1) | volume of the voice; `0` for the effects-only track |
| `music` | `""` | music file under `public/`; empty = no music |
| `musicVolume` | `0.15` (0 to 1) | volume of the music |
| `sfxVolume` | `1.3` (0 to 2) | volume of all effects together |
| `counterTo` | `1000000` | value the number reaches at the cut to scene 3 |
| `slots[]` | two entries | one entry per inset with `label` (label text), `clip` (file under `public/`, empty = placeholder) and `startSec` (start position in the clip) |

**Constants in the code** that you change to adapt the video:

| Constant | File | Value | What for |
|---|---|---|---|
| Composition `Demo` | `example/src/Root.tsx` | 30 frames/s, 1080 × 1920, length from `VO.endMs` | format and length |
| `TEXT_LEAD_MS` | `example/src/Demo.tsx` | `100` | how many ms before the spoken word a text is fully visible |
| `INSET_WIDTH` | `example/src/Demo.tsx` | `86` | width of the clip frame in percent |
| `SFX_CUES` | `example/src/Demo.tsx` | list | each cue: frame (from a word timing), sound, volume, name |
| `SOUNDS` | `example/src/lib/sfx.tsx` | catalogue | written by `sync_remotion.py` |

**`edit-tools/post.config.json`** (template `edit-tools/post.config.example.json`; read in `edit-tools/post_social.py`; empty values count as not set). **Personal.**

| Key | Required for | What for |
|---|---|---|
| `tiktok_account_id` | `tiktok` | account ID from the Zernio list (`accounts` names it) |
| `instagram_user_id` | `instagram` | ID of the Instagram account |
| `composio_account_zernio` | only with several Zernio connections | the connection that can see the account |
| `composio_account_instagram` | only with several Instagram connections | the same for Instagram |

**Remotion settings:** `example/remotion.config.ts` (Rspack on, intermediate frames as JPEG, overwrite existing files);
`tour/remotion.config.ts` (additionally JPEG quality 92). The scripts are in `example/package.json` (`dev`, `build`, `render`, `lint`, `voice-studio`, `vo`)
and `tour/package.json` (`dev`, `prepare-media`, `typecheck`, `render`, `still`). Style and types: `example/.prettierrc`, `example/tsconfig.json`, `example/eslint.config.mjs`.

**Fixed values in the tools** (not flags; if you want to change them, change the code):

| Where | Value | What for |
|---|---|---|
| `voice-studio/vo/master.py` | EQ chains `neutral` and `deep`, compressor −18 dB at 3.5:1, limiter −1.8 dBFS, peak at most −1.5 dBTP, tolerance 0.15 LU | processing the voiceover (target −14 LUFS in the video) |
| `voice-studio/vo/align.py` | pause from 120 ms, speech from 16 dB above the threshold, list of model names with DTW timings | word alignment |
| `voice-studio/recorder/server.mjs` | 600 MB per recording | upper limit when saving |
| `listen.py` | folders `sfx-kit/sounds` and `sfx-candidates`, categories by file-name prefix | listening page |
| `sfx-kit/tools/prepare_sfx.py` | 48 kHz, peak −1 dBFS, mapping raw file → sound (`SRC`), groups (`GROUPS`) | processing the sounds |
| `edit-tools/post_render.sh` | CRF 14, preset `slow`, AAC 320 kbit/s, at most −14 LUFS and −1.2 dBTP | final export. The search path `/opt/homebrew/bin:/usr/local/bin` on `EDIT_HOST` is fixed as well |
| `edit-tools/post_social.py` | reuse an upload for 45 minutes, at most 5 hashtags (warning), Instagram polling every 5 s for at most 300 s | posting |

### 3.4 Personal files, never committed

These files are listed in `.gitignore`. They hold the accounts, recordings or picks of a human and belong in no commit, report or
chat (see also [`AGENTS.md`](../AGENTS.md)).

| File | Contents | Listed in |
|---|---|---|
| `edit-tools/post.config.json` | account IDs for posting | `.gitignore`, `edit-tools/.gitignore` |
| `edit-tools/post-log.jsonl` | log of real actions (time, platform, IDs, link) | `.gitignore`, `edit-tools/.gitignore` |
| `<video>.upload.json` | remembered temporary upload address | `.gitignore`, `edit-tools/.gitignore` |
| `selection.json`, `selection.json.tmp` | picks from the listening page | `.gitignore` |
| `recordings/` | recorded takes | `.gitignore`, `example/.gitignore` |
| `example/public/vo.wav` | generated voiceover | `.gitignore`, `example/.gitignore` |
| `*.bak` | backup copies made before changes | `.gitignore` |
| `voice-studio/mic/setinput` | built program | `voice-studio/.gitignore` |
| `node_modules/`, `out/` | generated, can be recreated at any time | `.gitignore` |
| `tour/public/`, `tour/work/`, `tour/captures/raw/` | raw recordings and everything made from them | `tour/.gitignore`, `tour/captures/.gitignore` |

Not in Git, but also personal: the recorder page remembers the choice of microphone in the browser (`localStorage`, `voice-studio/recorder/recorder.html`);
the Composio CLI sign-in lives with the CLI, not in the repo.

## 4. Self-test

With these commands the agent shows that the setup is in place. They run without a microphone, an account or a sign-in.

```bash
node --version && python3 --version && ffmpeg -version | head -1
```

Expected: Node 20 or newer, Python 3.9 or newer, an ffmpeg version.

```bash
cd example && npm run lint
```

Expected: exit code 0, no error message.

```bash
cd example && npx remotion compositions src/index.ts
```

Expected: a line with `Demo`, `30`, `1080x1920` and `270 (9.00 sec)`.

```bash
cd example && npx remotion still Demo out/frame.png --frame=60
```

Expected: `out/frame.png` with 1080 × 1920 pixels; look at the image.

```bash
python3 -m unittest discover -s edit-tools/tests
```

Expected: `OK` on the last line.

```bash
python3 voice-studio/vo/vo.py --help
```

Expected: exit code 0 and the list of flags from section 3.2.

```bash
python3 edit-tools/post_social.py --help
```

Expected: exit code 0; the script uploads nothing and creates nothing in the process.

```bash
git status --short
```

Expected: no files except those the human wanted. `post.config.json`, `recordings/`, `selection.json` and `out/` never appear
in the list, because `.gitignore` excludes them.

If these checks are green, tell the human in the report what is still missing: microphone and recording (step 8), Whisper model (step 7),
accounts for posting (step 11), `EDIT_HOST` for the final export (step 12). Write explicitly in the report what you could not check.
