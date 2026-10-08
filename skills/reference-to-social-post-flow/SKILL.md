---
name: reference-to-social-post-flow
description: "Flow for rebuilding a reference video (Instagram/TikTok) with your own material in Remotion and then posting it to TikTok and Instagram (with edit-tools/post_social.py: get the caption approved, dry run or draft, publish, read back). Use when someone shows a model video and wants it rebuilt, looks for clips in the photo library for an edit, or wants to show, render or publish a Remotion edit."
version: 1.1.0
platforms: [macos]
metadata:
  hermes:
    tags: [Remotion, Edit, TikTok, Instagram, Photos, Posting]
    related_skills: [clip-sound-post-flow]
---

# Reference → Remotion edit → post

The flow from script and voiceover to the finished export is described by `clip-sound-post-flow` (and `AGENTS.md` in the root
folder of this repo). This skill adds how to rebuild a reference and how to post at the end.

## The flow in brief

1. **Analyse the reference, frame-accurate.** Measure the onset frames and rectangles of new elements with frame differencing
   at 30 fps (OpenCV: difference of adjacent frames, threshold, bounding box); do not estimate from 4 fps contact sheets.
   Leave out the marks, handles and watermarks of the reference, and replace other people's names with your own.
2. **Material.** Clip list from the Photos database (sqlite, table `ZASSET`; `ZKIND=1` = video). Export the originals through
   the Photos app (`osascript … export … with using originals`). You can find the video for a still image with Vision
   feature prints against the thumbnails of the library, or with a contact sheet (`edit-tools/contact_sheet.py`). iPhone
   clips are often stored rotated and in HDR: convert to SDR for proxies and mind the rotation.
3. **Remotion.** Every clip is a slot in the props panel (file, start second). Word DSL for text. Portrait in 16:9 with a
   blurred copy as the background.
4. **Check.** Lint and type check, put frames next to the reference, and only then say "done".
5. **Show.** Show it in the studio instead of sending render files, unless a render is explicitly requested.
6. **Post** only with explicit approval for text, hashtags and account, with `edit-tools/post_social.py` (next section).

## Posting with post_social.py

The script uploads the finished MP4 and creates it on TikTok (through Zernio) and Instagram (Graph API) via the Composio CLI.
All commands, the configuration and the traps: `edit-tools/POSTING.md`. Beforehand, create `post.config.json` once from
`post.config.example.json` (never checked in); `accounts` names the values that belong in it:

```bash
python3 edit-tools/post_social.py accounts
```

The safe order, each stage on its own:

1. **Write the caption and have a human approve it.** Only then it goes into a file (UTF-8, real `#`, at most 5 hashtags on
   Instagram, 3 to 4 relevant ones on TikTok).
2. **Dry run.** Uploads nothing and creates nothing, shows the calls:

   ```bash
   python3 edit-tools/post_social.py tiktok <video> --caption-file <file> --dry-run
   ```

   Instagram without `--publish` also only shows the calls. A TikTok draft (a call without `--publish` and without
   `--dry-run`) is already a real action in the account: only after the caption has been approved.
3. **Second approval, then publish:**

   ```bash
   python3 edit-tools/post_social.py instagram <video> --caption-file <file> --publish
   ```

4. **Read back.** TikTok: status and post ID. Instagram: link, and the published caption is compared byte for byte with the
   file (non-zero exit code on a mismatch). Later, at any time:

   ```bash
   python3 edit-tools/post_social.py status --instagram-media <MEDIA-ID>
   ```

Never publish or create drafts to try things out: that is what `--dry-run` is for.

## General traps when posting through an API (scheduler, Graph API)

- Always create it as a **draft** first, wait for approval, then publish. Some tools schedule a post automatically if neither
  "draft" nor "now" is set (Zernio: in 60 minutes): read the parameters beforehand. `post_social.py` always sends exactly one
  of the two.
- Do not send large files through a browser upload field (often limited to a few MB), but through the upload endpoint of the
  service (request a presigned URL, upload the file by PUT, complete the upload). The script does this and checks the file
  size on the server.
- Instagram Reels through the Graph API: create the container (type REELS, public video URL) → poll the status until it is
  ready → publish → read the post back and check the text.
- **Pass the caption as raw text**, with a real `#` and real line breaks. URL-encoded text is not decoded and then appears
  verbatim in the post. Published texts cannot be changed through many tools.
- Do not retry anything automatically: after a timeout it is unclear whether the post exists. Check the account first.
- Visibility, duet and stitch often cannot be set through third-party tools; check in the app. A custom cover image cannot be
  set on TikTok this way.
- What the platforms say about caption, hashtags, cover, music and trial reels: `docs/research-2026-10.md`.

## Rules

- "Wait, don't do anything" really means do nothing until material arrives.
- Do not cut before the script and example videos are there.
- Always originals in the highest quality, no previews.
- Posting and any change to public content only after explicit approval, even if the technology can do it.
