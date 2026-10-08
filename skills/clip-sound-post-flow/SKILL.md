---
name: clip-sound-post-flow
description: "Short vertical videos in Remotion from script to post: record a voiceover and measure word timings (Voice Studio), drop in new clips (WhatsApp, photo library, still image in the chat), sound design with real sounds, final export for TikTok/Reels, and posting to TikTok and Instagram (draft, approval, publish, read back), plus the psychology for script and edit (hook, climax, face, text). Use when someone wants to record or re-record a voiceover, sends or names clips ('X sent me some videos', 'use that one'), wants to add or drop sounds, has a video prepared for posting or posted, or plans a new script for a short video."
version: 1.1.0
platforms: [macos]
metadata:
  hermes:
    tags: [Remotion, Edit, Voiceover, Voice-Studio, Clips, WhatsApp, Photos, Sound-Design, SFX, Export, Posting, TikTok, Reels, Script, Retention]
    related_skills: [reference-to-social-post-flow]
---

# Script, voiceover, clips, sound, post

Start with the folder map, checklist and house rules: `AGENTS.md` in the root folder of this repo. The full version of all
flows with commands and reasons: `edit-tools/README.md`. Voiceover tool: `voice-studio/README.md`. Posting:
`edit-tools/POSTING.md`. Sound kit and level rules: `sfx-kit/README.md`. Example project with all building blocks:
`example/`.

The human does not type commands. They say in short sentences what they want, often several jobs in a row, and want to see
or hear a proposal in the studio, which they then correct. Do not hand big selection jobs back to them.

Order: 1 Script and voiceover, 2 Drop in clips, 3 Sound design, 4 Final export, 5 Posting.

## What is already automated

| Job | Command |
|---|---|
| Record a voiceover (recorder page with teleprompter, http://localhost:3600) | `npm run voice-studio` (in the project folder) |
| Process a take, measure word timings, rewrite `src/timing.ts` | `npm run vo -- recordings/<take>.wav` (in the project folder) |
| Chats with new videos | `whatsapp_clips.py chats --days 7` |
| Fetch the videos of a chat and put them in the photo library | `whatsapp_clips.py export "<name>" --date YYYY-MM-DD --photos` |
| Find the clip for a still image | `contact_sheet.py <folder>`, look at the sheet |
| Word timings of a clip | `whisper-cli -m ggml-medium.en.bin -f clip.wav -ml 1 -sow -oj` |
| Change a file in the project safely | `patch_lines.py <file> <md5> <swaps.json>` (aborts if the file has changed) |
| Show sounds for picking | `listen.py` → http://localhost:3700; picks go in `selection.json` |
| Process the kept sounds and bring them into the project | `sfx-kit/tools/prepare_sfx.py`, then `sfx-kit/tools/sync_remotion.py <project> [md5]` |
| Export for TikTok/Reels (with and without music, loudness, cover) | `EDIT_HOST=<ssh-name> post_render.sh <project> <composition> <name> [frames]` |
| Read accounts (read-only) | `post_social.py accounts` |
| Check a post, create it as a draft, publish it | `post_social.py tiktok <video> --caption-file <file> [--dry-run] [--publish]`, `post_social.py instagram <video> --caption-file <file> [--dry-run] [--publish]` |
| Read back the state of a post | `post_social.py status --tiktok-post <ID>` or `--instagram-media <ID>` |

No `--help` for `prepare_sfx.py`, `sync_remotion.py`, `listen.py`, `patch_lines.py` and `post_render.sh`: they execute
immediately or read the first argument as a path.

## Script and voiceover

Everything hangs on the word timings, so they come first.

1. `script.json` in the project folder: spoken phrases, one key per phrase, under which its start lands in `src/timing.ts`.
2. `npm run voice-studio`, record (test the level; every take stays unchanged in `recordings/`).
3. `npm run vo -- recordings/<take>.wav`. If the word count does not match, it aborts instead of delivering wrong times. Look
   at the "models disagree" and "ESTIMATED" rows in the table, and set single times with `--set <key>=<ms>`.
4. Reload the studio, render a still on an emphasised word and look at it. Only after that say it is done.

`vo` overwrites `src/timing.ts` and the audio file: save a finished variant first. Voice Studio runs locally, without an
account; recordings and the generated voiceover do not belong in the repo.

## Drop in clips

1. Fetch them (WhatsApp script or photo library). A still image in the chat means "this video": find the file yourself, via a
   contact sheet.
2. Choose the spot: the shot from the still image, or use whisper to find a passage of text that fits the voiceover.
3. File into `public/`, slot in the props (label, file, start second), so that the cut can be moved in the studio.
   Building blocks: `Inset` (clip on a white card, optionally a slow zoom onto the person), `AmbientInset` (`lib/ambient.tsx`:
   the same with an ambient-light glow, only on a light background), `SAFE` and `SafeZoneGuide` (`lib/safezone.tsx`: safe
   zones for Instagram and TikTok with a check overlay), `Squiggle` (hand-drawn squiggle arrow), word DSL `Words`.
4. Render a still (`npx remotion still`) and really look at it before saying "done". Build the layout inside the safe-zone
   frame from the start (1080 × 1920: 250 px at the top, 480 px at the bottom, 160 px on the right from y = 860, 60 px on
   the left; anything important ends at y = 1440 and, on the right, at x = 920) and look at **every scene** with
   `--props='{"safeZone":true}'` before the video is shown. Guide values, as of October 2026: `example/README.md`.
5. WhatsApp clips are downscaled (mostly 1024 × 576): say so in the report, and ask the sender for the original.

## Sound design

- **Only real, recorded sounds.** Nothing synthetic (no game/UI packs, no ticks, pops, blips).
- Every movement gets a small sound, quiet enough that it does not sound inserted. Shutter, mouse click, split-flap board,
  paper, pencil, keys; whoosh only very minimal. Effects never louder than the music.
- Proven: a key per text line, pencil on handwriting and drawn lines, shutter when a photo or clip appears, a shutter series
  on a photo wall, split-flap board for tiles and running numbers, a page turn onto a cut, a reversed cymbal into the music
  hole before the climax, a real drum on the climax.
- Every cue (`SFX_CUES`) hangs on a word time or an animation constant and has a name for the studio timeline. Set levels via
  `loud + 20·log10(vol)` (guide values in the README). Then do an effects-only render and list the gaps over 0.5 s:
  `npx remotion render <composition> sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'`. `voVolume: 0` instead of
  `voiceover: ""`, because if a voiceover exists, the composition falls back to `VO.file`.
- Do not wait for hundreds of candidates to be sorted: choose by description, place, name, and let the human correct.

## Final export for the post

- `post_render.sh` delivers 1080 × 1920, 30 fps, H.264 High, AAC 320 kbit/s, at most −14 LUFS / −1.2 dBTP, once with and once
  without music (the default values of the composition decide what "with music" contains), plus cover images. Read the
  printed loudness and the covers.
- Before a public post, raise the music question (`docs/research-2026-10.md`): when in doubt, take the version without music.

## Posting

Details and traps: `edit-tools/POSTING.md`. Safe order, each stage on its own:

1. Propose a caption, **the human approves it**, and only then it goes into a file (real `#`, at most 5 hashtags on Instagram).
2. Trial run: `post_social.py tiktok <video> --caption-file <file> --dry-run` (uploads nothing, creates nothing). Instagram
   without `--publish` also only shows the calls. A TikTok draft is already a real action in the account: only after approval.
3. Second approval, then `--publish`.
4. Read back: link or post ID from the output, `status`. Unclear outcome (timeout): do not repeat, check the account first.
   Never publish or create drafts to try things out.

## Variants

A video is a template. For three to four variants (for example as trial reels), each gets its own voiceover take with its own
word timings (`npm run vo`); picture and sounds hang on the word timings and move along. Change only one thing between
variants, first the first 1.5 seconds.

## Psychology for script and edit

1. The first 1.5 to 3 seconds decide: start with the strongest image.
2. One clear emotional climax, tied to the content; the music drops out briefly before it.
3. Face large and early.
4. Text on screen, word by word with the voiceover.
5. No vocals under the voice.
6. Speak briskly and engaged; cuts every two to three seconds are enough.
7. Turning saturation up does nothing according to the evidence; match exposure, contrast and warmth.

Script pattern for 15 seconds and about 40 words: setting off → place and step → people → what we are building (climax on the
name) → ambition → sender and open ending. Each line gets its own image; movements are finished before the emphasised word.

## Rules

- Several agents on the same project: compare md5 before every write, and make a backup with the extension `.bak` first.
- Photos and videos as originals where they exist; name any substitute explicitly.
- Post nothing and change nothing public without explicit approval.
- In the report, say what was checked (still viewed, effects-only track measured, loudness read, post read back) and what was not.
