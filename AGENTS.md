# AGENTS.md

> **Setting up first?** Prerequisites, steps with "done when …", every configuration setting and the self-test are in
> [`docs/setup.md`](docs/setup.md). All commands step by step: [`docs/manual.md`](docs/manual.md).

Starting point for an AI agent that is to build or change a short video with this kit. Humans find the overview in the
[`README.md`](README.md).

## What the kit is

A toolbox for short vertical videos (TikTok, Reels) in Remotion. A voiceover provides the word timings (`src/timing.ts`);
picture, text and sounds hang on those timings, so a new take moves everything together. There is a tool for every step from script
to post, and every step has a sign that shows it worked.

## Folder map

| Path | What it is for |
|---|---|
| `example/` | the Remotion project (composition `Demo`): `script.json`, `src/timing.ts`, `src/Demo.tsx` (scenes, props, `SFX_CUES`), `src/lib/` (word DSL, sound track, `ambient.tsx`: clip card with ambient-light glow, `safezone.tsx`: safe zones and check overlay), `public/` (sounds, clips, voiceover) |
| `voice-studio/` | voiceover: `recorder/` (recorder page), `vo/` (process, align, write `timing.ts`), `mic/` (switch the input device) |
| `edit-tools/` | `whatsapp_clips.py`, `contact_sheet.py`, `patch_lines.py`, `sound_check.py`, `beat_align.py`, `post_render.sh`, `post_social.py`, plus `POSTING.md` and `tests/` |
| `sfx-kit/`, `sfx-candidates/`, `listen.py` | 53 finished sounds with catalogue and tools; 233 raw candidates with a licence per file; the listening page for picking sounds |
| `flow-film/` | Remotion project that builds `docs/flow.mp4` and `docs/flow.gif`, the 30-second film at the top of the README |
| `tour/` | Remotion project that builds `docs/tour.mp4`, the tour of the kit (real browser recordings plus redrawn terminal scenes); see [`tour/README.md`](tour/README.md) |
| `skills/`, `docs/` | two skills (Hermes format); the setup guide with configuration reference (`setup.md`), all commands (`manual.md`), the research with sources (`research-2026-10.md`), learnings on sound and text sync (`sound-and-text-sync.md`), on script, voice, room tones, visual building blocks and formats for small accounts (`shortform-learnings-2026-10.md`) and the tour (`tour.mp4`) |

Every visual effect of the kit is listed by name, with an animated preview, in [`EFFECTS.md`](EFFECTS.md) at the repo root. The effect
components live in `effects/`.

## The five steps

Step 1 runs in the `example/` folder, the other commands from the repo root (where noted: back in `example/`).
The long version: [`edit-tools/README.md`](edit-tools/README.md).

### 1. Script and voiceover ([`voice-studio/README.md`](voice-studio/README.md))

- [ ] `script.json` holds the spoken text; the keys are the ones the code reads (`VO.w.<key>`).
- [ ] Start the recorder page and tell the human the address (http://localhost:3600). Only the human can record.

```bash
npm run voice-studio
```

```bash
npm run vo -- recordings/<take>.wav
```

Done when `vo` runs without aborting (a wrong word count aborts: adjust the script or record again, do not guess), the rows
"disagree" and "ESTIMATED" of the table have been looked at, the studio shows the new length and a still frame on a stressed word
is right. `vo` overwrites `src/timing.ts` and `public/vo.wav`: back up a finished variant first.

### 2. Drop in clips

- [ ] Find the file (a still frame in the chat means "this video"), put it in `public/`, set the slot in the props (`slots`: label, file, start second).

```bash
python3 edit-tools/whatsapp_clips.py export "<name>" --date YYYY-MM-DD --photos
```

```bash
python3 edit-tools/contact_sheet.py <folder>
```

Done when a still frame (`npx remotion still Demo frame.png --frame=N`, in `example/`) has been rendered and looked at. WhatsApp clips
are downscaled (usually 1024 × 576): say so in the report and ask the sender for the original.

### 3. Sound design ([`sfx-kit/README.md`](sfx-kit/README.md))

- [ ] Every movement gets a cue in `SFX_CUES` (`example/src/Demo.tsx`), tied to a word timing or an animation constant and named.
- [ ] New sounds: `listen.py` to pick them, `prepare_sfx.py`, then `sync_remotion.py example [md5]` (rewrites `src/lib/sfx.tsx`
  and moves WAVs that are no longer in the kit to `unused/sfx-discarded`).

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
```

```bash
python3 edit-tools/sound_check.py example/sfx.wav --music <song.wav> --music-start <s> --music-vol 0.15
```

Done when the effects-only track (in `example/`; `voVolume: 0`, not `voiceover: ""`, otherwise the voice stays in) has been rendered,
measured against the music section by section, and gaps of more than 0.5 s without an effect have been listed (`sound_check.py`
prints both; without music the comparison is skipped). Word texts are fully there when the word begins (`TEXT_LEAD_MS`); the check is
done on rendered frames, see [`docs/sound-and-text-sync.md`](docs/sound-and-text-sync.md). With music: `beat_align.py` puts a beat on the most important word.

### 4. Final export ([`edit-tools/post_render.sh`](edit-tools/post_render.sh))

```bash
EDIT_HOST=<ssh-name> edit-tools/post_render.sh <project-folder> <composition> <name> 60,150,240
```

Done when `<project>/out/post-<date>/` holds both files (`…_with-music.mp4`, `…_without-music.mp4`) and the cover images, the
printed loudness of each version shows at most −14 LUFS, and the covers have been looked at. "With music" means: the composition's
default values (in the demo `music` is empty). Bring up the music rights ([`docs/research-2026-10.md`](docs/research-2026-10.md)).

### 5. Posting ([`edit-tools/POSTING.md`](edit-tools/POSTING.md))

- [ ] Propose a caption, the human approves it, only then put it in a file. Then `--dry-run`, and after the second approval `--publish`.

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <caption.txt> --dry-run
```

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <caption.txt> --publish
```

Done when the link or post ID has been read from the output (Instagram: "caption checked byte for byte"; otherwise `status`). On a
timeout or an unclear outcome do not repeat; look in the account first.

## House rules

- **Only real, recorded sounds.** Nothing synthetic. New sounds only if CC0, public domain or explicitly cleared, with a row
  in `sfx-candidates/manifest.tsv` ([`SOUND-LICENSES.md`](SOUND-LICENSES.md)). Effects are never louder than the music.
- **Every cue hangs on a word timing or an animation constant**, never on a fixed number, and has a name for the timeline.
- **A human approves captions and posting.** Never publish or create drafts to try something out: that is what `--dry-run` is for.
  A TikTok draft is already a real action in the account.
- **Keep to the safe zones.** On 1080 × 1920 keep 250 px at the top, 480 px at the bottom (anything important ends at y = 1440), 160 px on
  the right from y = 860 (there x ≤ 920) and 60 px on the left free of text, faces and pointers, because Instagram and TikTok show their
  elements there ([`example/README.md`](example/README.md#safe-zones-where-the-app-puts-its-controls), as of October 2026, guide values).
  Build the layout inside the frame from the start and look at every scene with `--props='{"safeZone":true}'` before the video is shown.
- **Originals, not previews** for photos and videos. If only a preview exists, say so.
- **Look and measure first, then say "done".** The report holds the real output of the checks (still frame, effects-only track,
  loudness, read-back) and says what was not checked.
- **Do not paper over an abort.** Options like `--allow-mismatch` only after asking; name estimated timings in the report.
- **Every script prints its usage with `--help`.** `whatsapp_clips.py`, `contact_sheet.py`, `post_social.py`, `vo.py`,
  `sound_check.py`, `beat_align.py` and the recorder's `server.mjs` exit with code 0 afterwards; `prepare_sfx.py`, `sync_remotion.py`,
  `listen.py`, `patch_lines.py` and `post_render.sh` print their usage and exit with code 1. `--help` never does any work (it does not
  rewrite sounds, start a server or write a file), so it is safe to call, and the exit code 1 is not an error.
- **Never print anything account-specific:** do not copy account IDs, upload addresses or captions into reports, commits or documents.

## Several agents on one project

- One writer per file. Checksum before writing (`md5 -q <file>`): `patch_lines.py <file> <md5> <swaps.json>` only changes the file if
  it still has this md5 and every spot occurs exactly once, otherwise it writes nothing. `sync_remotion.py` takes the md5 of
  `sfx.tsx` as its second argument.
- Make a backup ending in `.bak` before bigger changes (not `.ts`/`.tsx`, otherwise TypeScript checks the copy too).
- Report intermediate states in one sentence. At the end: what was done, what was checked, what is open.

## What never belongs in this repo

- your own video material, still frames from chats, photos; recordings (`recordings/`) and the generated voiceover (`public/vo.wav`)
- names of people or companies, account names and IDs, real captions, machine names and paths from your own home folder
- `edit-tools/post.config.json`, `post-log.jsonl`, `*.upload.json`, `selection.json` (listed in `.gitignore`, as are `*.bak`)
- music and sounds without a documented licence

Before committing, go through the file list and all new texts for these. The examples (script, names, captions) stay invented
placeholders.

## Where the human's preferences live

Not here: this repo is neutral. Language, tone, way of working and accounts belong in the notes or configuration of the human and
their agent. If something is missing, ask instead of inventing.
