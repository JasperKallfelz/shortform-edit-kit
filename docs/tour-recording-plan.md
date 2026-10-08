# Recording plan: the tour, recorded yourself

The tour video (`docs/tour.mp4`) still shows the German interface and German captions; it will be re-recorded in English.

Goal: the same tour as in [`tour.mp4`](tour.mp4), only with your own voice, in two to three minutes, recorded with
[Cap](https://cap.so), Screen Studio or the screen recorder of macOS. One take, leave small slips in.

## Preparation (about 10 minutes)

- **Clean environment.** Your own browser profile without a bookmarks bar, extensions and signed-in accounts (or a private
  window). Notifications off (Focus "Do Not Disturb"), hide Dock and menu bar, empty desktop. Only the browser or terminal window is
  recorded, never the whole screen.
- **Window size.** Browser 1600 × 1000 pixels, terminal about 1400 × 880. Terminal font 18 to 20 points.
- **Neutral prompt.** In the terminal run `export PS1='$ '` once, so that neither user name nor machine name nor path is in the picture.
  Do not show the window title, or set it to "Terminal".
- **Cap settings.** Mode "Window", background a calm gradient, rounded corners, shadow on, automatic zoom on clicks on, highlight the
  cursor, 1080p at 30 frames per second. Before you start, make a ten-second test recording with sound.
- **Start the tools beforehand**, each in its own terminal, everything in the repo folder:

```bash
cd example && npm run voice-studio
```

```bash
cd example && npm run dev
```

```bash
python3 listen.py
```

- **One take is already in place** (`example/recordings/`), so that the `npm run vo` command runs without waiting. A sample clip without
  people and without brands is in `example/public/`.

## Flow

| Time | Step | What happens on screen | What you say |
|---|---|---|---|
| 0:00 | **Intro** | Repo name in large type, then the five steps as a list | "This is the shortform-edit-kit: five steps from script to post." |
| 0:10 | **1 · Script and voiceover** | Voice Studio in the browser: script in the teleprompter, "Start recording", countdown, read one sentence, stop, card with the saved take. Then terminal: `npm run vo -- recordings/<take>.wav`, word-timing table, `tail -14 src/timing.ts` | "I read the script from the teleprompter, every take is saved at once. One command turns it into the voiceover and the table of word timings that everything hangs on later." |
| 0:55 | **2 · Drop in clips** | Remotion Studio, composition `Demo`, props on the right: enter a file name under `slots`, start second, play the preview | "Clips go into the slots: enter the file name and the start second, and the section can be moved without touching code." |
| 1:25 | **3 · Sound design** | Listening page: click a few sounds, switch with the arrow keys, B keeps, X drops, counter at the top. Then the studio timeline: click the track "SFX · …", playback | "I pick sounds with the keyboard. In the video every effect hangs as a named sequence on a word timing; if the take changes, they move with it." |
| 2:00 | **4 · Final export** | Terminal: `post_render.sh` with sample names, the lines with loudness, then the file list | "The export delivers two files, with and without music; the loudness is at most minus 14 LUFS." |
| 2:25 | **5 · Posting** | Terminal: `post_social.py tiktok … --dry-run`, the output of the dry run up to "nothing was created" | "Without `--publish` at most a draft is created. Posting happens only if a human approves." |
| 2:45 | **Close** | Play `example/demo.mp4`, repo name | "That is what the result looks like. Everything else is in the README files." |

## What must not be in the picture

- **Step 1:** the device name in the microphone menu if it contains a person's name (choose a neutral device first); user name and
  paths in the terminal; takes with private content (read only the sample text).
- **Step 2:** your own or other people's clips with recognisable people, WhatsApp chats and contact names, photo library, file names with names.
- **Step 3:** Finder windows, an address bar with folder paths, `selection.json` with your own picks in the editor.
- **Step 4:** the real SSH name of the editing machine (set `EDIT_HOST` to a neutral name), home paths, client names in the project folder.
- **Step 5:** account IDs, `post.config.json`, `post-log.jsonl`, tokens, the output of `composio whoami` (it shows the sign-in), account names,
  chats. **Never post for real during the recording**, only `--dry-run` or `accounts` with the output covered.
- **Always:** notifications, other windows and tabs, password-manager pop-ups, bookmarks.

## After the recording

- Watch it once in full and check for names, paths and account details, in the audio too (leave out "this is my …").
- Speed up long waits (countdown, rendering) to double speed in the edit, or cut them.
- Get the export under 15 MB if the video is to go into the repo:

```bash
ffmpeg -i raw.mov -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart tour-own.mp4
```
