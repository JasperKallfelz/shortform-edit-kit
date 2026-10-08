# Voice Studio

Local tools for the voiceover of a short video: record in the browser, master the recording, measure the word timings and
generate the timing table `src/timing.ts` of the Remotion project from them. Picture, text and sounds hang on this table and
move along when a new take comes in. **Everything runs on your own computer**: no account, no cloud, the recorder page
listens only on `127.0.0.1`, and the speech recognition (whisper.cpp) runs locally.

```
script.json ──► recorder page ──► recordings/take-….wav ──► npm run vo ──► public/vo.wav
 (sentences + keys)  (teleprompter)                          (master,          src/timing.ts
                                                              measure words)   (picture, text, sound follow)
```

## Requirements

- Node 20+ (the recorder page needs no packages), a current browser
- Python 3.9+ with `numpy`, ffmpeg
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`whisper-cli`) and at least one ggml model. Several models make the
  times more accurate (median), one is enough to start. For English, for example, `medium.en` and `medium`; for other languages a model without `.en`.
- Optional, macOS: Swift, to switch the input device (`mic/setinput.swift`)

```bash
brew install whisper-cpp ffmpeg
```

```bash
pip install numpy
```

Download models (in the whisper.cpp folder) and tell the tool the paths, separated by commas. Alternatively, pass `--models` on every call:

```bash
sh models/download-ggml-model.sh medium.en
```

```bash
export VOICE_STUDIO_MODELS=~/whisper/ggml-medium.en.bin,~/whisper/ggml-medium.bin
```

If `whisper-cli` is not in the `PATH`, give the path in `WHISPER_CLI`. If a model is missing, `vo` aborts with a message before anything is changed.

## Step 0: Script file in the video project

`script.json` says what is spoken and under which key each phrase ends up in `src/timing.ts` (the keys that the code of the video
uses). The value of a key is the start of the **first word** of its phrase.

```json
{
  "language": "en",
  "file": "vo.wav",
  "tailMs": 640,
  "lines": [
    {
      "note": "Scene 1",
      "phrases": [
        { "key": "thisIs", "text": "this is" },
        { "key": "yourHook", "text": "your hook,", "display": "your *hook* |" }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `language` | language of the recording (Whisper code: `en`, `de`, …) |
| `file` | name of the finished voiceover under `public/` |
| `tailMs` | time from the last word to the end of the video (`endMs`) |
| `lines[].note` | optional: shown on the left of the teleprompter and as a comment in `timing.ts` |
| `phrases[].key` | name in `timing.ts` (letters, digits, `_`; unique per file) |
| `phrases[].text` | the spoken words, in speaking order; punctuation is allowed |
| `phrases[].display` | optional, for the screen only: `*stressed*`, `\|` breath, `\|\|` pause, `^` voice up, `~` voice falls |

If the script contains a placeholder (such as "Your Name"), you say your own name there with the **same word count**.

A new video needs only a new `script.json` and matching keys in the code. The two commands go into the `package.json`
of the project (adjust the path to `voice-studio/`):

```json
"voice-studio": "node ../voice-studio/recorder/server.mjs",
"vo": "python3 ../voice-studio/vo/vo.py"
```

## Step 1: Record

```bash
npm run voice-studio
```

Then open http://localhost:3600. On the left are the level meter and the record button, on the right the script to read from (font size with A−/A+, "Marks"
hides the stress marks). First press "Test level": the peaks should lie in the green zone (−12 to −6 dBFS). After the start,
a 3-second countdown runs. **Every take is saved to `recordings/` immediately** (24 bit, 48 kHz, never overwritten), and the
page shows the command for the next step. Options: `--port`, `--dir`, `--script`, `--project` (`node ../voice-studio/recorder/server.mjs --help`).

## Step 2: Choose a take, master it, measure the times

```bash
npm run vo -- recordings/take-20261008-141530-1.wav
```

The tool (`voice-studio/vo/vo.py`) does four things and overwrites `public/` and `src/timing.ts` only once the alignment has succeeded:

1. **Master** (`master.py`): tone, compressor, level to −14 LUFS in the video, limiter. Result: `public/<file from script.json>`
   as a two-channel WAV. If a target is missed, it aborts.
2. **Listen**: Each Whisper model transcribes the recording freely and returns a DTW time for every word (Dynamic Time Warping: where the
   model hears the end of the piece). The end of the previous word is the start of the next; across the models, the median applies.
3. **Match**: Heard words and script are compared. If the word count does not match, the tool aborts instead of returning wrong times.
4. **Snap**: The speech pauses are measured from the loudness. The word directly after a pause starts exactly at the measured onset;
   this is the most reliable timing. After that, `retime.py` writes `timing.ts` (`file`, `endMs` and one value in ms per key).

At the end there is a table with key, start, pause (●), spread between the models and the times per model. Rows with
"models disagree" or "ESTIMATED" are the ones to look at. A report is saved as `<take>.alignment.json` next to the take.

Further options:

| Option | Effect |
|---|---|
| `--chain deep` | tone variant: `neutral` (default) only removes rumble and mud, `deep` gives thin voices more body (details in `master.py`) |
| `--models a.bin,b.bin` | Whisper models instead of `VOICE_STUDIO_MODELS` |
| `--set hello=1500` | override a time value by hand (repeatable) |
| `--allow-mismatch` | skip words that Whisper counts differently from the script; their times are estimated |
| `--script`, `--timing`, `--public`, `--project` | other paths, if the project is laid out differently |

To take the beginning from one take and the rest from another (put the cuts in a speech pause; short crossfades are built in; `to_ms` = -1 means to the end, optionally a gain in dB follows):

```bash
npm run vo -- recordings/take-a.wav:0:3800 recordings/take-b.wav:1740:-1:1.5
```

A hand-written `timing.ts` is saved to `recordings/timing-handwritten.ts` the first time it is overwritten.

## Step 3: Look at it

```bash
npm run dev
```

In the studio, reload the composition: the voiceover plays (from `VO.file`), the length follows the recording, and text and sounds sit at the new times.

```bash
npx remotion render Demo out/video.mp4
```

## Typical problems

- **The browser does not ask for the microphone / "Permission missing".** The page must run via `http://localhost:3600`. In the browser, click the lock
  in the address bar, allow the microphone, reload the page. On macOS additionally: System Settings → Privacy → Microphone → browser.
- **Wrong device, "NO SIGNAL", too quiet.** At the top right of the page, choose the microphone (the page remembers the choice). If that is not enough: macOS
  System Settings → Sound → check the input, set the level there and on the audio interface (gain). The default input device can also be switched:
  ```bash
  swiftc -O voice-studio/mic/setinput.swift -o voice-studio/mic/setinput
  ```
  ```bash
  voice-studio/mic/setinput "part of the device name"
  ```
  Without an argument, `setinput` lists all input devices.
- **Whisper hears a word wrong.** With the **same word count** (proper names, "Your Name" → real name) this is harmless: the matching goes position by position,
  and the message "Heard differently" is only a hint. If the **word count** differs (numbers like "2026" instead of "twenty twenty-six", words spoken together or apart,
  swallowed words), `vo` aborts with "Script: … heard: …". Then adapt the script to what was spoken, or record again. If neither is possible,
  set `--allow-mismatch` and check the estimated times.
- **A single time is wrong.** Process the take again with `--set`, for example `npm run vo -- recordings/take.wav --set hello=1500`. Read the number from the
  studio (timeline, milliseconds = frame ÷ 30 × 1000). Changing it by hand in `timing.ts` also works, but only lasts until the next `vo` run.
  The values apply to exactly this take; check them again for a new take.
- **Message "model only understands English".** Models with `.en` in the name are English. For `"language": "de"`, give a model without `.en` (for example `medium`).
- **Model name unknown.** The DTW times need the standard name (`ggml-medium.en.bin`, `ggml-small.bin`, …). For other file names, the tool points this out
  and uses Whisper's less accurate word stamps; better not to rename the files.

## Files

| Path | Contents |
|---|---|
| `recorder/server.mjs`, `recorder/recorder.html` | recorder page and its small local server (recording via AudioWorklet, teleprompter from `script.json`) |
| `vo/vo.py` | the command behind `npm run vo`: assemble pieces, master, align, write |
| `vo/master.py` | mastering, can also be called on its own: `master.py raw.wav target.wav [neutral\|deep]` |
| `vo/align.py` | word alignment (models, matching, snapping to pauses), can also be called on its own |
| `vo/retime.py`, `vo/script.py` | writes `timing.ts`; reads and validates `script.json` |
| `mic/setinput.swift` | source for switching the default input device on macOS (the built program is not checked in) |

Recordings (`recordings/`) and the generated voiceover do not belong in the repository; the `.gitignore` of the example project excludes them.
