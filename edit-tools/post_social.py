#!/usr/bin/env python3
"""Post a finished video to TikTok and Instagram Reels – through the Composio CLI (`composio execute …`).

  post_social.py accounts
      Read connected accounts (read only) and say which values belong in post.config.json.
  post_social.py upload <video> [--new]
      Upload the video to Zernio's temporary media storage, check the size on the server and print the public URL.
      <video>.upload.json is written next to it; the commands below reuse the URL as long as it is fresh.
  post_social.py tiktok <video> --caption-file FILE [--publish]
      Without --publish: creates a DRAFT (is_draft). With --publish: publishes immediately (publish_now) and reads it back.
  post_social.py instagram <video> --caption-file FILE [--thumb-ms N] [--not-in-feed] [--publish]
      Without --publish: only checks (composio --dry-run), creates nothing. With --publish: container → wait → publish →
      read it back and compare the caption byte for byte.
  post_social.py status --tiktok-post ID | --instagram-media ID
      Read back the state of a post.

Global (before or after the command): --dry-run  (only shows the calls, creates nothing and uploads nothing)
                                      --config PATH  (default: post.config.json next to this script, is not checked in)

There are two safeguards: without --publish nothing public is created, and every TikTok call carries exactly one of
is_draft / publish_now (without either, Zernio would silently schedule the post for 60 minutes later).
Captions go out unchanged: real #, real line breaks. The "# as %23" from Instagram's tool description
is wrong and would be published literally.

Standard library only (Python 3.9+); calls `composio` and `curl`.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / "post.config.json"
ZERNIO = "https://zernio.com"
UPLOAD_MAX_AGE_MIN = 45  # an upload (temporary URL) is reused for this long
HASHTAG_LIMIT = {"tiktok": 5, "instagram": 5}  # Instagram: at most 5 since December 2025; TikTok: more brings nothing
CURL_WRITE_OUT = "\n%{http_code}"  # appends the HTTP code on a line of its own to the output
CONTENT_TYPES = {".mp4": "video/mp4", ".mov": "video/quicktime"}
PLACEHOLDER_URL = "https://example.invalid/public-url-comes-after-the-upload.mp4"
IG_POLL_SECONDS = 5
IG_POLL_MAX_SECONDS = 300
CONFIG_KEYS = ("tiktok_account_id", "instagram_user_id", "composio_account_zernio", "composio_account_instagram")


class PostError(Exception):
    """Expected error with a message that is shown to the human."""


# ---------------------------------------------------------------------------------------------------------------------
# Pure functions (no network, tested in tests/test_post_social.py)
# ---------------------------------------------------------------------------------------------------------------------

def mask_token(token):
    """Never shows a single character of a token – only that there is one."""
    return f"<TOKEN, {len(token)} characters>"


def mask_text(text, secrets=()):
    """Removes upload tokens, signed URL parameters and passed secrets from text that is displayed."""
    text = str(text)
    for s in secrets:
        if s and len(s) >= 6:
            text = text.replace(s, "<SECRET>")
    text = re.sub(r"(/upload/)(?!presign\b|complete\b)[^\s/?#\"')]{6,}", r"\1<TOKEN>", text)
    text = re.sub(r"(?i)(\btoken\s*[:=]\s*)[^\s&\"')]{6,}", r"\1<TOKEN>", text)
    text = re.sub(r"(?i)((?:signature|x-amz-credential|x-amz-security-token|sig)=)[^&\s\"']+", r"\1<…>", text)
    return text


def parse_json_output(text):
    """composio sometimes writes a 'Tip: …' line before the JSON: read from the first line start with {,
    otherwise from any { (the first one that parses as a JSON object)."""
    decoder = json.JSONDecoder()
    starts = [m.start() for m in re.finditer(r"^\{", text, re.M)] + [m.start() for m in re.finditer(r"\{", text)]
    for i in starts:
        try:
            obj, _ = decoder.raw_decode(text[i:])
        except ValueError:
            continue
        if isinstance(obj, dict):
            return obj
    raise PostError("no JSON response found")


def result_text(obj):
    """The text under data.result (this is how the Zernio tools answer)."""
    data = obj.get("data") or {}
    res = data.get("result") if isinstance(data, dict) else None
    return res if isinstance(res, str) else json.dumps(data, ensure_ascii=False)


def extract_token(text):
    """Upload token from the answer of ZERNIO_MCP_MEDIA_GENERATE_UPLOAD_LINK: line 'Token: …', otherwise from the upload URL."""
    m = re.search(r"^\s*Token:\s*(\S+)\s*$", text, re.M) or re.search(r"/upload/([^\s/?#\"')]+)", text)
    if not m:
        raise PostError("The upload link result contains no token (format changed?): " + mask_text(text)[:300])
    return m.group(1)


def parse_accounts(text):
    """Lines like '- tiktok: Name (ID: abc123)' → [{'platform', 'name', 'id'}, …]."""
    found = []
    for m in re.finditer(r"^\s*-\s*([A-Za-z]+):\s*(.*?)\s*\(ID:\s*([^)\s]+)\)\s*$", text, re.M):
        found.append({"platform": m.group(1).lower(), "name": m.group(2), "id": m.group(3)})
    return found


def parse_post_result(text):
    """Result of ZERNIO_MCP_POSTS_CREATE: '✅ Published to tiktok (@name) … Post ID: …'.
    kind is 'published', 'draft', 'scheduled' or 'unknown'. Without a post ID it is an error."""
    pid = re.search(r"Post ID:\s*([A-Za-z0-9_\-]+)", text)
    if not pid:
        raise PostError("No post ID in the response: " + mask_text(text).strip()[:400])
    pub = re.search(r"Published to\s+(\w+)(?:\s*\(([^)]*)\))?", text)
    low = text.lower()
    if pub:
        kind = "published"
    elif "draft" in low:
        kind = "draft"
    elif "scheduled" in low:
        kind = "scheduled"
    else:
        kind = "unknown"
    return {"kind": kind, "platform": pub.group(1).lower() if pub else None,
            "handle": (pub.group(2) or None) if pub else None, "post_id": pid.group(1)}


def parse_status(text):
    """'Status: published' from ZERNIO_MCP_POSTS_GET (lowercased) or None."""
    m = re.search(r"Status:\s*([A-Za-z_\-]+)", text)
    return m.group(1).lower() if m else None


def load_caption(path):
    """Read UTF-8 text, convert line endings to \\n, remove trailing line breaks, keep inner ones."""
    try:
        raw = Path(path).read_bytes()
    except OSError as e:
        raise PostError(f"Caption not readable: {path} ({e.strerror})")
    try:
        text = raw.decode("utf-8-sig")  # a BOM at the start would otherwise be posted too
    except UnicodeDecodeError:
        raise PostError(f"Caption is not UTF-8: {path}")
    text = text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    if not text.strip():
        raise PostError(f"Caption is empty: {path}")
    return text


_HASHTAG = re.compile(r"(?<![\w#&/])#(\w+)")


def count_hashtags(text):
    """Counts real hashtags; '#1', '&#39;' and URL anchors do not count."""
    return sum(1 for m in _HASHTAG.finditer(text) if not m.group(1).isdigit())


def caption_warnings(platform, caption):
    """Hints that do not block (except %23 when publishing to Instagram, see cmd_instagram)."""
    out = []
    n, limit = count_hashtags(caption), HASHTAG_LIMIT[platform]
    if n > limit:
        if platform == "instagram":
            out.append(f"{n} hashtags – since December 2025 Instagram allows at most {limit} per post.")
        else:
            out.append(f"{n} hashtags – according to the research, more than {limit} brings nothing on TikTok; 3 to 4 fitting ones are enough.")
    if "%23" in caption:
        out.append("The caption contains '%23' and would be published literally. The instruction 'write # as %23' "
                   "in the tool description is wrong: use a real #.")
    if platform == "instagram" and len(caption) > 2200:
        out.append(f"The caption has {len(caption)} characters – Instagram allows at most 2200.")
    return out


def ensure_one_mode(args):
    """Every TikTok call carries exactly one of is_draft / publish_now (both or neither → error)."""
    modes = [k for k in ("is_draft", "publish_now") if args.get(k) is True]
    stray = [k for k in ("is_draft", "publish_now") if k in args and args[k] is not True]
    if len(modes) != 1 or stray:
        raise PostError("Internal error: a TikTok call must contain exactly one of is_draft/publish_now (=true).")
    return modes[0]


def build_tiktok_args(account_id, caption, video_url, publish):
    args = {"platform": "tiktok", "content": caption, "account_id": account_id, "media_urls": video_url}
    args["publish_now" if publish else "is_draft"] = True
    ensure_one_mode(args)
    return args


def build_instagram_container_args(ig_user_id, video_url, caption, thumb_ms=None, share_to_feed=True):
    args = {"ig_user_id": ig_user_id, "media_type": "REELS", "video_url": video_url, "caption": caption,
            "share_to_feed": bool(share_to_feed)}
    if thumb_ms is not None:
        args["thumb_offset"] = int(thumb_ms)
    return args


def build_instagram_publish_args(ig_user_id, creation_id):
    return {"ig_user_id": ig_user_id, "creation_id": creation_id}


def captions_equal(expected, actual):
    """Equal byte for byte (UTF-8)."""
    return expected.encode("utf-8") == (actual or "").encode("utf-8")


def describe_diff(expected, actual):
    actual = actual or ""
    i = next((k for k, (x, y) in enumerate(zip(expected, actual)) if x != y), min(len(expected), len(actual)))
    return (f"first difference at character {i}: file …{expected[max(0, i - 15):i + 15]!r}… "
            f"↔ Instagram …{actual[max(0, i - 15):i + 15]!r}… (lengths {len(expected)} ↔ {len(actual)})")


def curl_quote(s):
    """Value for a curl config line (this way the URL and token never appear in the process list)."""
    return '"' + (s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r")
                  .replace("\t", "\\t")) + '"'


def build_curl_config(url, headers=(), data=None, upload_file=None, head=False, timeout=120):
    lines = ["silent", "show-error", f"max-time = {int(timeout)}", f"url = {curl_quote(url)}",
             f"write-out = {curl_quote(CURL_WRITE_OUT)}"]
    lines += [f"header = {curl_quote(h)}" for h in headers]
    if head:
        lines += ["head", "location"]
    if data is not None:
        lines.append(f"data-raw = {curl_quote(data)}")
    if upload_file is not None:
        lines.append(f"upload-file = {curl_quote(str(upload_file))}")
    return "\n".join(lines) + "\n"


def parse_content_length(header_text):
    """Last content-length of a (possibly multi-part, because redirected) header output, or None."""
    values = re.findall(r"(?im)^content-length:\s*(\d+)\s*$", header_text)
    return int(values[-1]) if values else None


def sidecar_path(video):
    return Path(str(video) + ".upload.json")


def read_fresh_upload(video, now=None, max_age_min=UPLOAD_MAX_AGE_MIN):
    """URL from <video>.upload.json if the file is unchanged (size, modification time) and younger than max_age_min, otherwise None."""
    video = Path(video)
    now = now or dt.datetime.now(dt.timezone.utc)
    try:
        info = json.loads(sidecar_path(video).read_text(encoding="utf-8"))
        st = video.stat()
        stamp = dt.datetime.fromisoformat(info["time"])
        same_file = info["size"] == st.st_size and abs(float(info["mtime"]) - st.st_mtime) <= 0.01
        young = dt.timedelta(minutes=-1) <= now - stamp <= dt.timedelta(minutes=max_age_min)
        return info["url"] if same_file and young and info["url"] else None
    except (OSError, ValueError, KeyError, TypeError):
        return None


def write_sidecar(video, url, now=None):
    video = Path(video)
    st = video.stat()
    info = {"url": url, "size": st.st_size, "mtime": st.st_mtime,
            "time": (now or dt.datetime.now(dt.timezone.utc)).isoformat(timespec="seconds")}
    p = sidecar_path(video)
    p.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    p.chmod(0o600)
    return p


def load_config(path):
    """A missing file is not an error (accounts, upload and status need none); empty values count as not set."""
    path = Path(path)
    if not path.exists():
        return {}
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        raise PostError(f"{path.name} is not valid JSON: {e}")
    if not isinstance(cfg, dict):
        raise PostError(f"{path.name} must be a JSON object.")
    return {k: v.strip() for k, v in cfg.items() if isinstance(v, str) and v.strip()}


def need(cfg, key, config_path):
    if not cfg.get(key):
        raise PostError(f"{Path(config_path).name} is missing '{key}'. `post_social.py accounts` shows the values; "
                        "template: post.config.example.json (copy it as post.config.json, it is not checked in).")
    return cfg[key]


# ---------------------------------------------------------------------------------------------------------------------
# Calls to the outside (composio, curl)
# ---------------------------------------------------------------------------------------------------------------------

def run_composio(slug, args, account=None, dry_run=False, timeout=300):
    """`composio execute SLUG -d -` with the JSON on stdin (none of it appears in the process list). Returns the parsed JSON.
    It is never retried automatically: repeating a create or publish call could post twice."""
    cmd = ["composio", "execute", slug, "-d", "-"]
    if account:
        cmd += ["--account", account]
    if dry_run:
        cmd.append("--dry-run")
    try:
        p = subprocess.run(cmd, input=json.dumps(args, ensure_ascii=False), capture_output=True, text=True,
                           encoding="utf-8", timeout=timeout)
    except FileNotFoundError:
        raise PostError("The composio CLI is missing (not on the PATH). Installation and login: see POSTING.md.")
    except subprocess.TimeoutExpired:
        raise PostError(f"{slug}: no response after {timeout} s. Outcome unclear: do not repeat blindly, check first "
                        "(account interface or `status`).")
    try:
        obj = parse_json_output(p.stdout or "")
    except PostError:
        raise PostError(f"{slug}: unexpected response (exit {p.returncode}): "
                        + mask_text(((p.stdout or "") + (p.stderr or "")).strip())[:400])
    if not obj.get("successful"):
        raise PostError(f"{slug} failed: " + mask_text(obj.get("error") or "no error text")[:500])
    return obj


def curl_request(url, headers=(), data=None, upload_file=None, head=False, timeout=120, secrets=()):
    """curl with the config on stdin. Returns (HTTP code, text); with head=True the text is the header output."""
    cfg = build_curl_config(url, headers, data, upload_file, head, timeout)
    try:
        p = subprocess.run(["curl", "-K", "-"], input=cfg, capture_output=True, text=True, encoding="utf-8",
                           timeout=timeout + 30)
    except FileNotFoundError:
        raise PostError("curl is missing.")
    except subprocess.TimeoutExpired:
        raise PostError("curl: timeout.")
    if p.returncode != 0:
        raise PostError(f"curl error {p.returncode}: " + mask_text((p.stderr or "").strip(), secrets)[:300])
    body, _, code = (p.stdout or "").rpartition("\n")
    return (int(code) if code.strip().isdigit() else 0), body


def remote_size(url, secrets=()):
    code, headers = curl_request(url, head=True, timeout=60, secrets=secrets)
    if not 200 <= code < 300:
        raise PostError(f"The uploaded file cannot be fetched from the public URL (HTTP {code}).")
    size = parse_content_length(headers)
    if size is None:
        raise PostError("The server gives no file size (content-length); the upload cannot be checked.")
    return size


def check_video(path):
    video = Path(path).expanduser()
    if not video.is_file():
        raise PostError(f"Video not found: {path}")
    if video.suffix.lower() not in CONTENT_TYPES:
        raise PostError("Only .mp4 and .mov are uploaded.")
    if video.stat().st_size == 0:
        raise PostError("The video is empty.")
    return video


def upload_video(video, account=None):
    """The four steps of the temporary Zernio upload. Returns (public URL, size on the server)."""
    size = video.stat().st_size
    ctype = CONTENT_TYPES[video.suffix.lower()]
    print("  1/4 Requesting upload link …", flush=True)
    token = extract_token(result_text(run_composio("ZERNIO_MCP_MEDIA_GENERATE_UPLOAD_LINK", {}, account)))
    secrets = [token]
    print(f"      {mask_token(token)}", flush=True)
    json_head = ["Content-Type: application/json"]
    file_entry = {"filename": video.name, "contentType": ctype, "size": size}

    print("  2/4 Preparing upload (presign) …", flush=True)
    code, body = curl_request(f"{ZERNIO}/api/v1/media/upload/presign?token={token}", json_head,
                              data=json.dumps(file_entry), secrets=secrets)
    try:
        pre = json.loads(body)
        upload_url, key = pre["uploadUrl"], pre["key"]
    except (ValueError, KeyError, TypeError):
        raise PostError(f"presign: unexpected response (HTTP {code}): " + mask_text(body, secrets)[:300])
    secrets.append(upload_url)

    print(f"  3/4 Uploading file ({size / 1e6:.1f} MB) …", flush=True)
    code, body = curl_request(upload_url, [f"Content-Type: {ctype}"], upload_file=video, timeout=1800, secrets=secrets)
    if not 200 <= code < 300:
        raise PostError(f"Upload rejected (HTTP {code}): " + mask_text(body, secrets)[:300])

    print("  4/4 Completing upload …", flush=True)
    code, body = curl_request(f"{ZERNIO}/api/v1/media/upload/complete?token={token}", json_head,
                              data=json.dumps({"files": [dict(file_entry, key=key)]}), secrets=secrets)
    try:
        done = json.loads(body)
        url = done["files"][0]["url"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise PostError(f"complete: unexpected response (HTTP {code}): " + mask_text(body, secrets)[:300])

    remote = remote_size(url, secrets)
    if remote != size:
        raise PostError(f"Size mismatch: {size} bytes locally, {remote} bytes on the server. Discard the upload and try again.")
    return url, remote


def obtain_url(ctx, video, force_new=False, dry_run=False):
    """Fresh URL from the sidecar (if it can still be fetched), otherwise upload. A dry run never uploads."""
    account = ctx.cfg.get("composio_account_zernio")
    fresh = None if force_new else read_fresh_upload(video)
    if fresh:
        if dry_run:
            print("Reusing the earlier upload.")
            return fresh
        try:
            if remote_size(fresh) == video.stat().st_size:
                print(f"Reusing the earlier upload (at most {UPLOAD_MAX_AGE_MIN} minutes old).")
                return fresh
        except PostError:
            pass
        print("The remembered upload can no longer be fetched, uploading again.")
    if dry_run:
        print("Dry run: no upload, the call contains a placeholder URL.")
        return PLACEHOLDER_URL
    print(f"Uploading {video.name}:")
    url, remote = upload_video(video, account)
    write_sidecar(video, url)
    ctx.log({"action": "upload", "file": video.name, "bytes": remote})
    print(f"Size checked: {remote} bytes locally and on the server.")
    return url


# ---------------------------------------------------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------------------------------------------------

@dataclasses.dataclass
class Ctx:
    cfg: dict
    config_path: Path
    dry_run: bool = False

    @property
    def log_path(self):
        return self.config_path.resolve().parent / "post-log.jsonl"  # next to the config, ignored in edit-tools/

    def log(self, entry):
        """One JSON line per real action (no caption, no token)."""
        line = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
        line.update(entry)
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
        try:
            self.log_path.chmod(0o600)
        except OSError:
            pass


def show_call(obj):
    shown = {k: v for k, v in obj.items() if k in ("slug", "arguments")} or {k: v for k, v in obj.items() if k not in ("userId", "schemaPath")}
    print("  " + json.dumps(shown, indent=2, ensure_ascii=False).replace("\n", "\n  "))


def warn(text):
    print(f"Warning: {text}", file=sys.stderr, flush=True)


def active_connections(toolkit):
    """Names (word_id) of the active Composio connections of a toolkit; empty if `connections list` does not work."""
    try:
        p = subprocess.run(["composio", "connections", "list"], capture_output=True, text=True, encoding="utf-8", timeout=60)
        obj = parse_json_output(p.stdout or "")
    except (OSError, subprocess.TimeoutExpired, PostError):
        return []
    return [c["word_id"] for c in obj.get(toolkit, []) if isinstance(c, dict) and c.get("status") == "ACTIVE" and c.get("word_id")]


def cmd_accounts(a, ctx):
    zernio_pref, ig_pref = ctx.cfg.get("composio_account_zernio"), ctx.cfg.get("composio_account_instagram")
    zernio_list = [zernio_pref] if zernio_pref else (active_connections("zernio_mcp") or [None])
    ig_list = [ig_pref] if ig_pref else (active_connections("instagram") or [None])
    tiktok, ig_users, zernio_with_accounts = [], [], []
    print("Zernio (TikTok, YouTube …) – read only:")
    for conn in zernio_list:
        label = conn or "default connection"
        try:
            accounts = parse_accounts(result_text(run_composio("ZERNIO_MCP_ACCOUNTS_LIST", {}, conn)))
        except PostError as e:
            print(f"  [{label}] error: {e}")
            continue
        if not accounts:
            print(f"  [{label}] no accounts connected")
            continue
        zernio_with_accounts.append(conn)
        for acc in accounts:
            print(f"  [{label}] {acc['platform']}: {acc['name']} (ID: {acc['id']})")
            if acc["platform"] == "tiktok":
                tiktok.append(acc)
    print("Instagram – read only:")
    for conn in ig_list:
        label = conn or "default connection"
        try:
            data = run_composio("INSTAGRAM_GET_USER_INFO", {"fields": "id,user_id,username"}, conn).get("data") or {}
        except PostError as e:
            print(f"  [{label}] error: {e}")
            continue
        uid = data.get("id") or data.get("user_id")
        if uid:
            ig_users.append((conn, uid))
            print(f"  [{label}] @{data.get('username', '?')} (ig_user_id: {uid})")
    print("\nThese values belong in post.config.json (template: post.config.example.json):")
    cfg = {"tiktok_account_id": tiktok[0]["id"] if len(tiktok) == 1 else "",
           "instagram_user_id": ig_users[0][1] if len(ig_users) == 1 else ""}
    if len(zernio_list) > 1 and len(zernio_with_accounts) == 1 and zernio_with_accounts[0]:
        cfg["composio_account_zernio"] = zernio_with_accounts[0]  # the default connection would have no accounts here
    if len(ig_list) > 1 and len(ig_users) == 1 and ig_users[0][0]:
        cfg["composio_account_instagram"] = ig_users[0][0]
    print(json.dumps(cfg, indent=2, ensure_ascii=False))
    if len(tiktok) != 1 or len(ig_users) != 1:
        print("Note: with more or fewer than one account per platform, pick the matching ID from above yourself.")
    print("The file stays local (it is listed in edit-tools/.gitignore).")
    return 0


def cmd_upload(a, ctx):
    video = check_video(a.video)
    if ctx.dry_run:
        print(f"Dry run: would upload {video.name} ({video.stat().st_size} bytes) to the temporary Zernio storage "
              f"and write {sidecar_path(video).name}.")
        return 0
    url = obtain_url(ctx, video, force_new=a.new)
    print(f"Public URL (temporary): {url}")
    print(f"Remembered in {sidecar_path(video).name}; tiktok and instagram use the URL as long as the upload is at most "
          f"{UPLOAD_MAX_AGE_MIN} minutes old.")
    return 0


def read_tiktok_status(post_id, account, tries, pause):
    status, text = None, ""
    for i in range(tries):
        text = result_text(run_composio("ZERNIO_MCP_POSTS_GET", {"post_id": post_id}, account))
        status = parse_status(text)
        if status in ("published", "failed", "error", "draft", "cancelled", "scheduled") or i == tries - 1:
            break
        time.sleep(pause)
    return status, text


def cmd_tiktok(a, ctx):
    video = check_video(a.video)
    caption = load_caption(a.caption_file)
    for w in caption_warnings("tiktok", caption):
        warn(w)
    account_id = need(ctx.cfg, "tiktok_account_id", ctx.config_path)
    zernio = ctx.cfg.get("composio_account_zernio")
    url = obtain_url(ctx, video, dry_run=ctx.dry_run)
    args = build_tiktok_args(account_id, caption, url, a.publish)
    mode = ensure_one_mode(args)
    print(f"TikTok: {'PUBLISH (publish_now)' if a.publish else 'create DRAFT (is_draft)'}")
    if ctx.dry_run:
        show_call(run_composio("ZERNIO_MCP_POSTS_CREATE", args, zernio, dry_run=True))
        print("Dry run: nothing was created or published.")
        return 0
    created = run_composio("ZERNIO_MCP_POSTS_CREATE", args, zernio)
    try:
        post_id = parse_post_result(result_text(created))["post_id"]
    except PostError as e:
        # The call succeeded, only the response is unreadable: the post may exist
        ctx.log({"action": "tiktok_publish" if a.publish else "tiktok_draft", "platform": "tiktok",
                 "post_id": None, "status": "unclear"})
        raise PostError(f"{e}\nOutcome unclear: do NOT run again, first check in the account whether a post or draft was created.")
    print(f"Post ID: {post_id}")
    entry = {"action": "tiktok_publish" if a.publish else "tiktok_draft", "platform": "tiktok",
             "post_id": post_id, "status": None}
    try:
        status, text = read_tiktok_status(post_id, zernio, tries=1 if mode == "is_draft" else 8, pause=5)
        entry["status"] = status
    except PostError as e:
        raise PostError(f"Post created (post ID {post_id}), but reading it back failed: {e}")
    finally:
        ctx.log(entry)
    print(f"Status after reading back: {status or 'unknown'}")
    if not a.publish:
        if status in ("published", "scheduled"):
            print(f"WARNING: The post is not in draft status ({status}). Check the account immediately.", file=sys.stderr)
            return 1
        print("Draft created. NOTHING is published; use --publish to publish.")
        return 0
    if status == "published":
        print(f"Published. Post ID {post_id}.")
        return 0
    if status == "scheduled":
        print(f"WARNING: The post was only SCHEDULED, not published immediately (post ID {post_id}). Check the account.", file=sys.stderr)
        return 1
    if status in ("failed", "error", "cancelled"):
        print(f"TikTok reports {status}: " + mask_text(text).strip()[:300], file=sys.stderr)
        return 1
    print(f"Not finished yet (status {status}). Check later: post_social.py status --tiktok-post {post_id}", file=sys.stderr)
    return 3


def cmd_instagram(a, ctx):
    video = check_video(a.video)
    caption = load_caption(a.caption_file)
    warnings = caption_warnings("instagram", caption)
    for w in warnings:
        warn(w)
    ig_user = need(ctx.cfg, "instagram_user_id", ctx.config_path)
    ig_acc = ctx.cfg.get("composio_account_instagram")
    dry = ctx.dry_run or not a.publish
    if a.publish and not ctx.dry_run and "%23" in caption:
        raise PostError("Abort: '%23' in the caption would be published unchanged and permanently (Instagram posts can neither be "
                        "edited nor deleted through Composio). Fix the file with a real #.")
    url = obtain_url(ctx, video, dry_run=dry)
    container = build_instagram_container_args(ig_user, url, caption, a.thumb_ms, not a.not_in_feed)
    if dry:
        print("Instagram Reels: check only (composio --dry-run), nothing is created."
              if not ctx.dry_run else "Instagram Reels: dry run.")
        show_call(run_composio("INSTAGRAM_POST_IG_USER_MEDIA", container, ig_acc, dry_run=True))
        show_call(run_composio("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
                               build_instagram_publish_args(ig_user, "<creation_id from the container>"), ig_acc, dry_run=True))
        print("Nothing was created or published. To publish: --publish.")
        return 0

    print("Instagram Reels: PUBLISH")
    creation_id = str((run_composio("INSTAGRAM_POST_IG_USER_MEDIA", container, ig_acc).get("data") or {}).get("id") or "")
    if not creation_id:
        raise PostError("The container was created, but the response contains no ID (data.id).")
    ctx.log({"action": "instagram_container", "platform": "instagram", "container_id": creation_id})
    print(f"Container: {creation_id}; waiting for processing (30 to 50 s is usual) …", flush=True)
    waited = 0
    while True:
        data = run_composio("INSTAGRAM_GET_POST_STATUS", {"creation_id": creation_id}, ig_acc).get("data") or {}
        code = data.get("status_code")
        if code == "FINISHED":
            break
        if code != "IN_PROGRESS":
            raise PostError(f"Instagram reports {code or 'an unknown status'} for container {creation_id}: "
                            + mask_text(data.get("status") or "")[:300] + " Nothing was published.")
        if waited >= IG_POLL_MAX_SECONDS:
            raise PostError(f"Container {creation_id} is still not ready after {waited} s. Nothing was published; "
                            "try again later.")
        time.sleep(IG_POLL_SECONDS)
        waited += IG_POLL_SECONDS
        print(f"  … {waited} s, status {code}", flush=True)
    print(f"Container ready after about {waited} s. Publishing …", flush=True)
    try:
        media_id = str((run_composio("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", build_instagram_publish_args(ig_user, creation_id),
                                     ig_acc).get("data") or {}).get("id") or "")
    except PostError as e:
        raise PostError(f"{e}\nOutcome unclear: do NOT run again, first check in the Instagram account whether the post is online.")
    if not media_id:
        raise PostError("Published, but the response contains no media ID. Check the Instagram account; do not run again.")
    entry = {"action": "instagram_publish", "platform": "instagram", "container_id": creation_id,
             "media_id": media_id, "permalink": None, "caption_equal": None}
    try:
        media = run_composio("INSTAGRAM_GET_IG_MEDIA", {"ig_media_id": media_id,
                             "fields": "id,caption,permalink,media_product_type,timestamp"}, ig_acc).get("data") or {}
        entry["permalink"] = media.get("permalink")
        same = captions_equal(caption, media.get("caption"))
        entry["caption_equal"] = same
    except PostError as e:
        raise PostError(f"Published (media ID {media_id}), but reading it back failed: {e}")
    finally:
        ctx.log(entry)
    print(f"Published. Media ID: {media_id}")
    print(f"Link: {media.get('permalink') or '(not provided)'}  ({media.get('media_product_type') or '?'}, {media.get('timestamp') or '?'})")
    if not same:
        print("ERROR: The published caption differs from the file – " + describe_diff(caption, media.get("caption")), file=sys.stderr)
        print("The post is online and cannot be edited or deleted through Composio: correct it in the Instagram app.", file=sys.stderr)
        return 1
    print("Caption checked byte for byte: equal to the file.")
    return 0


def cmd_status(a, ctx):
    if a.tiktok_post:
        text = result_text(run_composio("ZERNIO_MCP_POSTS_GET", {"post_id": a.tiktok_post}, ctx.cfg.get("composio_account_zernio")))
        print(mask_text(text).strip())
        print(f"\nStatus: {parse_status(text) or 'unknown'}")
    else:
        media = run_composio("INSTAGRAM_GET_IG_MEDIA", {"ig_media_id": a.instagram_media,
                             "fields": "id,caption,permalink,media_product_type,timestamp"},
                             ctx.cfg.get("composio_account_instagram")).get("data") or {}
        for k in ("id", "media_product_type", "timestamp", "permalink"):
            print(f"{k}: {media.get(k)}")
        print("caption:\n" + (media.get("caption") or ""))
    return 0


# ---------------------------------------------------------------------------------------------------------------------

def build_parser():
    common = argparse.ArgumentParser(add_help=False)
    # SUPPRESS: a value before or after the command counts; neither overwrites the other with the default.
    # parse_args() sets the defaults afterwards; set_defaults() would be wrong because parent and subparsers share the same
    # action objects and a "--dry-run" before the command would otherwise be lost.
    common.add_argument("--dry-run", action="store_true", default=argparse.SUPPRESS,
                        help="only show what would happen; upload, create or publish nothing")
    common.add_argument("--config", default=argparse.SUPPRESS, metavar="PATH", help="configuration (default: post.config.json next to the script)")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, parents=[common])
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("accounts", parents=[common], help="read connected accounts and name the configuration values")
    u = sub.add_parser("upload", parents=[common], help="upload a video and print the public URL")
    u.add_argument("video")
    u.add_argument("--new", action="store_true", help="upload again even if a fresh upload is still remembered")
    t = sub.add_parser("tiktok", parents=[common], help="create a draft (default) or publish with --publish")
    t.add_argument("video")
    t.add_argument("--caption-file", required=True, metavar="FILE")
    t.add_argument("--publish", action="store_true", help="publish immediately (without: draft)")
    i = sub.add_parser("instagram", parents=[common], help="check the Reel (default) or publish with --publish")
    i.add_argument("video")
    i.add_argument("--caption-file", required=True, metavar="FILE")
    i.add_argument("--thumb-ms", type=int, metavar="N", help="cover image from the video at N milliseconds")
    i.add_argument("--not-in-feed", action="store_true", help="Reel only in the Reels tab, not additionally in the profile feed")
    i.add_argument("--publish", action="store_true", help="really publish (without: check only)")
    s = sub.add_parser("status", parents=[common], help="read back the state of a post")
    g = s.add_mutually_exclusive_group(required=True)
    g.add_argument("--tiktok-post", metavar="ID")
    g.add_argument("--instagram-media", metavar="ID")
    return p


def parse_args(argv=None):
    a = build_parser().parse_args(argv)
    a.dry_run = getattr(a, "dry_run", False)
    a.config = getattr(a, "config", None)
    return a


COMMANDS = {"accounts": cmd_accounts, "upload": cmd_upload, "tiktok": cmd_tiktok, "instagram": cmd_instagram, "status": cmd_status}


def main(argv=None):
    a = parse_args(argv)
    config_path = Path(a.config).expanduser() if a.config else DEFAULT_CONFIG
    try:
        ctx = Ctx(load_config(config_path), config_path, a.dry_run)
        return COMMANDS[a.cmd](a, ctx)
    except PostError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nAborted. If something was already created, its ID is in post-log.jsonl.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
