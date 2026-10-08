# Steps and tools

Five steps that have proven themselves when building short vertical videos with Remotion and an AI agent: record and measure the
voiceover, bring clips into the project, lay sounds under the picture, prepare the file for the post (final export) and post it.
Plus: what to watch for in script and edit.

For an agent, the starting point (folder map, checklist, house rules) is [`../AGENTS.md`](../AGENTS.md). The voiceover tool is
described in [`../voice-studio/README.md`](../voice-studio/README.md), posting in [`POSTING.md`](POSTING.md).

Assumption: one machine on which the Remotion project and the studio run (the "edit Mac"), and optionally a second one on which
the agent works. Where both are the same machine, `ssh` and `rsync` are not needed.

## What is already automated

The scripts are written without a path; they live in `edit-tools/` (the listening page and the sound kit with `../`). `npm run …`
runs in the project folder (in the repo: `example/`).

| Task | Command |
|---|---|
| Record the voiceover (recorder page with teleprompter at http://localhost:3600) | `npm run voice-studio` |
| Process a take, measure word timings, rewrite `src/timing.ts` | `npm run vo -- recordings/<take>.wav` |
| Which WhatsApp chats have new videos? | `whatsapp_clips.py chats --days 7` |
| Videos of a chat into a folder and into the Photos library | `whatsapp_clips.py export "<name>" --date YYYY-MM-DD --photos` |
| Contact sheet of a folder (find the clip for a still frame) | `contact_sheet.py <folder>` |
| Word timings of a clip | `whisper-cli -m ggml-medium.en.bin -f clip.wav -ml 1 -sow -oj` ([whisper.cpp](https://github.com/ggerganov/whisper.cpp)) |
| Change a file safely when several agents write to the same project | `patch_lines.py <file> <md5> <swaps.json>` |
| Show sounds for picking (keep/drop) | `../listen.py` → http://localhost:3700, picks in `../selection.json` |
| Prepare the kept sounds | `../sfx-kit/tools/prepare_sfx.py` |
| Bring the kit into the Remotion project (WAVs + catalogue) | `../sfx-kit/tools/sync_remotion.py <project> [md5]` |
| Re-measure the effects-only track and the mix (level per section, gaps, effects against music, loudness) | `sound_check.py <sfx.wav> [--music <song> --music-start <s> --music-vol 0.15] [--mix <mix.wav>]` |
| Find a music entry point where a beat lands on a word | `beat_align.py <song.wav> <src/timing.ts> <word> [--also word,word]` |
| Final export for TikTok/Reels | `EDIT_HOST=<ssh-name> post_render.sh <project> <composition> <name> [frames]` |
| Read connected accounts (read only) | `post_social.py accounts` |
| Create a post as a draft (TikTok) or check it (Instagram); publish with `--publish` | `post_social.py tiktok <video> --caption-file <file> [--publish]`, `post_social.py instagram <video> --caption-file <file> [--publish]` |
| Read back the state of a post | `post_social.py status --tiktok-post <ID>` or `--instagram-media <ID>` |
| Tests of the posting script (no network; from the repo root) | `python3 -m unittest discover -s edit-tools/tests` |

Be careful when trying things out: without `--help`, `prepare_sfx.py`, `sync_remotion.py`, `listen.py`, `patch_lines.py` and
`post_render.sh` run at once (`prepare_sfx.py` rewrites all sounds, `listen.py` starts the server) or read the first argument as a
path. With `--help`, these five print their usage and do nothing else (they exit with code 1 afterwards). `whatsapp_clips.py`,
`contact_sheet.py`, `post_social.py`, `vo.py`, `sound_check.py` and `beat_align.py` have a regular `--help`.

Why the rules for volume, text lead and music are the way they are, and how to measure them: [`../docs/sound-and-text-sync.md`](../docs/sound-and-text-sync.md).

## Step 1: Script and voiceover

Picture, text and sounds hang on the word timings, so the voiceover comes first. The tool for it is the Voice Studio
([`../voice-studio/README.md`](../voice-studio/README.md), which also lists the prerequisites: whisper.cpp, models, `numpy`). It runs
entirely locally, without an account.

1. **Fix the script.** `script.json` in the project folder holds the spoken phrases and, for each phrase, a key (`key`) under which its
   start lands in `src/timing.ts`. The code of the video reads only these keys (`VO.w.<key>`). If there is a placeholder in the text
   (a name, say), you speak the same number of words there. Example: [`../example/script.json`](../example/script.json).
2. **Record.** `npm run voice-studio`, then http://localhost:3600. First "Test level" (peaks in the green zone), then record.
   Every take is stored unchanged in `recordings/` right away and is never overwritten.
3. **Pick a take and measure it.** `npm run vo -- recordings/<take>.wav` processes the recording (-14 LUFS) and writes it as
   `public/<file from script.json>`, measures the word timings and writes `src/timing.ts`. Nothing is overwritten until the alignment
   has succeeded; if the word count is wrong, `vo` aborts. In the table at the end, look at the rows marked "disagree" and
   "ESTIMATED", and correct single timings with `--set <key>=<ms>`. To take the start from one take and the rest from another:
   `npm run vo -- recordings/take-a.wav:0:3800 recordings/take-b.wav:1740:-1`.
4. **Look.** Reload the studio: the voiceover plays, the length follows the recording, text and sounds sit on the new times.
   Render a still frame on a stressed word and look at it (frame = milliseconds × 0.03).

`vo` overwrites `src/timing.ts` and the audio file. If you want to keep several variants (see "Variants"), back up each finished
version first, for example in a branch or project folder of its own.

## Step 2: Drop in clips

Material usually arrives as a still frame in the chat ("take this one"), as a hint ("X sent me videos") or as a file.
A still frame means "this video" – finding the file is the agent's job.

1. **Fetch.** From WhatsApp with `whatsapp_clips.py export … --photos` (copies to `~/Movies/WhatsApp-<name>-<date>/` and creates an
   album in the Photos library). The WhatsApp Desktop database is only read.
2. **Find.** Run `contact_sheet.py` over the folder, look at the sheet, compare the number with the still frame.
3. **Choose the spot.** The shot from the still frame, or transcribe the audio with whisper and look for a passage that fits the
   voiceover. Pull a few single frames and look at where the person stands in the picture.
4. **Build in.** Put the file into `public/` of the project and create a slot in the props (label, file, start second). That way
   the excerpt can be moved in the studio without touching code. Building blocks from `example/src/Demo.tsx`:
   - `Inset` – rounded 16:9 clip on a white card; with `zoom` it slowly grows toward the person.
   - `AmbientInset` (`example/src/lib/ambient.tsx`) – the same with an ambient-light glow: behind it lies the clip once more, blurred and brightened, and shines onto the white. Only on a light background; parameters and experience in `example/README.md`.
   - `SafeZoneGuide` and `SAFE` (`example/src/lib/safezone.tsx`) – the safe zones of Instagram and TikTok (250 px at the top, 480 px at the bottom, 160 px on the right from y = 860, 60 px on the left) and a check overlay for them, via the prop `safeZone`. Values, sources and experience in `example/README.md`.
   - `Squiggle` – hand-drawn squiggle arrow as SVG that draws itself (`pathLength` 1, `strokeDashoffset` runs from 1 to 0).
   - Word DSL (`Words`) – every word with font, size, position in percent and onset taken from the word timing.
5. **Look before "done".** `npx remotion still <composition> frame.png --frame=N` and really look at the image. Where text
   sits, measure it by colour (coloured pixels → bounding box), do not guess. Look at every scene with the overlay too
   (`--props='{"safeZone":true}'`): text, faces and pointers stay out of the safe zones.
6. **State the quality.** WhatsApp shrinks videos (usually 1024 × 576). For the final export, ask the sender for the original.

## Step 3: Sound design

House rule: every movement gets a small sound, but so quiet and so fitting that it does not sound pasted in.
**Only real, recorded noises**, nothing synthetic. Shutter, mouse click, split-flap board, paper, pencil, keys;
whoosh only very minimally. Effects are never louder than the music. The sound kit with catalogue and level rules: [`../sfx-kit/README.md`](../sfx-kit/README.md).

1. Collect new sounds only from real recordings, with source and licence in `../sfx-candidates/manifest.tsv`. The prefix in the
   file name (`flap_`, `flutter_`, `riser_`, `click_`, …) decides the category on the listening page.
2. Sort on the listening page (✓ / ✕, keys B / X). The picks are stored in `selection.json`.
3. An agent does not wait for hundreds of files to be sorted: choose by description, put the sounds in, name the cue,
   then have it corrected by ear.
4. `prepare_sfx.py` (silence removed, peak -1 dBFS, `lead`, `loud`) → `sync_remotion.py` → cues into the cue list (`SFX_CUES`), each on a
   word timing or an animation constant, with names for the studio timeline. Because the word timings come from the voiceover (step 1),
   the sounds move along with a new take.
5. Set the level via the effective loudness: `loud + 20·log10(vol)`. Reference values (each times `sfxVolume` 1.3, music at 0.15):
   keys on text lines -45 dB, pencil/card/glass -40 to -42 dB, shutter as a transition -38 to -40 dB, riser -34 dB,
   hit on the climax -29 dB, shutter on photos -28 to -32 dB. The loudest spot of the effects stays at music level.
6. Render the effects only, compare the level per section with the previous state and list gaps over 0.5 s without an effect. Those are
   the places where something can still be laid underneath. In the project folder:

   ```bash
   npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
   ```

   `voVolume: 0` matters: if a voiceover exists (`VO.file` in `src/timing.ts`), the composition falls back to this file when `voiceover`
   is empty, and the voice would stay in the track. The prop names are those of the demo; in another project, use the ones there.

What works for what: a key press per text line, pencil on cursive words and drawn lines, shutter when a photo or clip appears, film
winder after a photo, a shutter series on a photo wall, a split-flap click for tiles and running numbers, a page turning on a cut, a
reversed cymbal into a music hole before the climax, a real drum on the climax. A restriction after later listening rounds: shutter
as a transition on cuts and fast flap sequences failed, see [`../docs/shortform-learnings-2026-10.md`](../docs/shortform-learnings-2026-10.md#5-sounds-what-failed-by-ear-and-what-stayed).

## Step 4: Final export for the post

1. `post_render.sh` delivers two files (with and without music) and cover images:

   ```bash
   EDIT_HOST=<ssh-name> post_render.sh <project-folder> <composition> <name> 60,150,240
   ```

   `<project-folder>` lies in the home folder of `EDIT_HOST`, the numbers are the frames of the cover images. The script first checks the
   types (`tsc`), renders the picture and both audio tracks, lowers each version to at most -14 LUFS and -1.2 dBTP (it does not
   make anything louder) and prints the measured loudness of each version before and after lowering.
2. Result in `<project>/out/post-<date>/`: `<name>_1080x1920_with-music.mp4`, `<name>_1080x1920_without-music.mp4`,
   `cover-frame-<frame>.png`, plus the raw picture and both audio tracks as WAV.
3. Target: 1080 × 1920, 30 fps, H.264 High, bt709, AAC 320 kbit/s. Look at the cover images, read the printed loudness values.
4. "With music" is the version with the default values of the composition (in the demo `demoDefaults` in `src/Demo.tsx`, where `music`
   is empty). If the music is only in the props field of the studio and not in the default values, both files are the same: in that case
   enter the music in the default values before you start `post_render.sh`.
5. Clear the music rights before anything becomes public (see `../docs/research-2026-10.md`): when in doubt, take the "without music"
   version and add the song from the platform's library in the app.

## Step 5: Posting

The script `post_social.py` uploads the finished MP4 and creates it as a draft or a post through the Composio CLI. Prerequisites,
configuration, all commands and the traps are in [`POSTING.md`](POSTING.md). The safe order:

1. **Have the caption written and approved by a human.** Only then put it in the file. Hashtags: at most 5 on Instagram, 3 to 4 fitting
   ones on TikTok (`../docs/research-2026-10.md`).
2. **Dry run.** Nothing is uploaded or created:

   ```bash
   python3 post_social.py tiktok <video> --caption-file <file> --dry-run
   ```

   For Instagram, running without `--publish` already only shows the calls. A TikTok draft (without `--publish`), on the other hand, is a
   real action in the account: create it only after the caption has been approved.
3. **Second approval, then publish:**

   ```bash
   python3 post_social.py tiktok <video> --caption-file <file> --publish
   ```

4. **Read back.** The script reads the post back (TikTok: status and post ID, Instagram: link and the caption byte for byte).
   On a timeout or an unclear outcome, do not repeat blindly; look in the account or with `status` first.

What does not work this way (TikTok cover image, editing or deleting an Instagram post, choosing platform music) is also described in `POSTING.md`.

## Variants

A video is a template, not a one-off. If you want to test three to four variants (for example as test Reels), you record several
similar scripts (step 1). Each variant needs its own voiceover take with its own word timings; picture, sounds and
cuts hang on the word timings and move along. What the platforms say about nearly identical videos and about reposting
is in `../docs/research-2026-10.md`.

## What matters in script and edit

Short version of the research in `../docs/research-2026-10.md`:

1. The first 1.5 to 3 seconds decide: start with the strongest picture, not with a calm build-up.
2. One clear emotional climax, tied to the content. Take the music away shortly before it and bring it back on the word.
3. Face big and early.
4. Text in the picture, word by word with the voiceover.
5. No singing under the voice.
6. Speak briskly and with engagement; cuts every two to three seconds are enough.
7. Turning the saturation up brings nothing according to the evidence. Match clips in exposure, contrast and warmth.

A script pattern for an introduction in 15 seconds and about 40 words: departure → place and step → people → what we are
building (climax on the name) → ambition → sender and open end. Every line gets a picture of its own, stressed words are big
or in cursive, movements are finished before the stressed word.

## Several agents working together

- One writer per file. Before every write, compare the checksum (`patch_lines.py`; for `sync_remotion.py` the optional
  md5 parameter) and make a backup beforehand (extension `.bak`, otherwise TypeScript checks the copy too).
- Report interim states in one sentence. At the end: what was done, what was checked, what is open.
- Post nothing and change nothing public without explicit approval.
