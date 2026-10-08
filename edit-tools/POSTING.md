# Posting to TikTok and Instagram Reels

`post_social.py` is the last step after `post_render.sh`: upload the finished MP4 and create it as a draft or post through the
Composio CLI. Standard library only, Python 3.9+. A human approves the caption beforehand (see "Safe order").

## Prerequisites

- **Composio CLI** (`composio`), logged in. Check with `composio whoami`.
- **Connected toolkits** in Composio: `zernio_mcp` (upload and TikTok; the TikTok account must be connected in the Zernio account) and
  `instagram` (Instagram business or creator account). Connect missing ones with `composio link zernio_mcp` or `composio link instagram`.
- `curl` (comes with macOS).

## Configuration

`post.config.json` lives next to the script and is never checked in (it is listed in `.gitignore`). Next to it are `post-log.jsonl`
(one line per real action: time, platform, IDs, link) and the remembered uploads `<video>.upload.json`.

```bash
cp edit-tools/post.config.example.json edit-tools/post.config.json
```

```bash
python3 edit-tools/post_social.py accounts
```

`accounts` only reads and prints which values belong in the file:

| Key | Meaning |
|---|---|
| `tiktok_account_id` | account ID from the Zernio list |
| `instagram_user_id` | ID of the Instagram account |
| `composio_account_zernio` | only needed if Composio has several Zernio connections and the default connection sees no account |
| `composio_account_instagram` | the same for Instagram |

With `--config PATH` (before or after the command) you can use another file; the log then lives next to it.

## Commands

Upload (temporary media storage; checks the file size on the server and remembers the URL for 45 minutes):

```bash
python3 edit-tools/post_social.py upload out/post-2026-10-08/My-Video_1080x1920_without-music.mp4
```

TikTok as a draft (without `--publish` only a draft is created, nothing is public):

```bash
python3 edit-tools/post_social.py tiktok out/My-Video.mp4 --caption-file caption-tiktok.txt
```

Publish to TikTok (live at once; afterwards it reads back status and post ID):

```bash
python3 edit-tools/post_social.py tiktok out/My-Video.mp4 --caption-file caption-tiktok.txt --publish
```

Check Instagram (creates nothing, shows the calls via `composio --dry-run`):

```bash
python3 edit-tools/post_social.py instagram out/My-Video.mp4 --caption-file caption-instagram.txt --thumb-ms 1500
```

Publish to Instagram (container, wait for "FINISHED", publish, read back, compare the caption byte for byte, print the link; exit code not 0 on a mismatch or an error):

```bash
python3 edit-tools/post_social.py instagram out/My-Video.mp4 --caption-file caption-instagram.txt --publish
```

Read back the state:

```bash
python3 edit-tools/post_social.py status --tiktok-post <POST-ID>
```

```bash
python3 edit-tools/post_social.py status --instagram-media <MEDIA-ID>
```

Only see what would happen (no upload, nothing created), also together with `--publish`:

```bash
python3 edit-tools/post_social.py tiktok out/My-Video.mp4 --caption-file caption-tiktok.txt --publish --dry-run
```

More switches: `upload --new` uploads again despite a fresh upload; `instagram --not-in-feed` shows the Reel only in the Reels tab.

## Caption file

UTF-8 text. Trailing line breaks are removed, inner ones stay. Real `#`, real umlauts and accents, and emoji. The script warns about more
than 5 hashtags (since December 2025 Instagram allows at most 5; for TikTok more brings nothing) but does not block.
Hashtags, length and music rights: [`../docs/research-2026-10.md`](../docs/research-2026-10.md).

## Safe order

1. Have the caption written and **approved by a human**. Only then put it in the file.
2. TikTok: create it as a draft. Instagram: run it without `--publish` (shows the calls). When in doubt, add `--dry-run`.
3. Second approval, then `--publish`.
4. Look at the result: link or post ID from the output, entry in `post-log.jsonl`.

## Traps

- **Zernio schedules silently.** `ZERNIO_MCP_POSTS_CREATE` without `is_draft` and without `publish_now` creates the post **in 60 minutes**.
  The script always sends exactly one of the two and reports it if the post is "scheduled" afterwards.
- **"# as %23" is wrong.** The Instagram tool description demands URL encoding of hashtags. The caption is not decoded, so `%23` would
  stand literally in the post. The script sends raw text; a caption with `%23` makes it abort before publishing.
- **Several Zernio connections:** If the default connection sees no accounts ("No accounts connected"), have `accounts` shown
  and set `composio_account_zernio`.
- **The upload is temporary.** The URL is valid only briefly; the script uploads again if it can no longer be fetched.
- **Nothing is repeated automatically.** If a publish runs into a timeout, the outcome is unclear: first look in the account
  or use `status`, do not blindly start it again.

## What does not work this way

- **TikTok: no cover image.** No cover can be set this way. The script also does not set the cover images from `post_render.sh`
  anywhere; on Instagram `--thumb-ms` picks a still frame from the video, otherwise only the app remains.
- **Instagram: posts can be neither edited nor deleted through Composio.** That is why the script checks everything checkable before
  publishing and compares the caption afterwards. Corrections only in the Instagram app.
- **No music selection from the platform library.** The tools have no parameter for it (on Instagram only a name for the audio track). For
  platform music, take the "without music" version and choose music in the app; for the rights, see the research.
