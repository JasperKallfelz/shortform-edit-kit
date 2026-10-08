#!/usr/bin/env python3
"""Fertiges Video auf TikTok und Instagram Reels posten – über die Composio-CLI (`composio execute …`).

  post_social.py accounts
      Verbundene Konten lesen (nur lesend) und sagen, welche Werte in post.config.json gehören.
  post_social.py upload <video> [--neu]
      Video in den temporären Medienspeicher von Zernio hochladen, die Größe auf dem Server prüfen und die öffentliche URL
      ausgeben. Daneben entsteht <video>.upload.json; die URL wird von den Befehlen unten wiederverwendet, solange sie frisch ist.
  post_social.py tiktok <video> --caption-file DATEI [--publish]
      Ohne --publish: legt einen ENTWURF an (is_draft). Mit --publish: veröffentlicht sofort (publish_now) und liest nach.
  post_social.py instagram <video> --caption-file DATEI [--thumb-ms N] [--nicht-im-feed] [--publish]
      Ohne --publish: prüft nur (composio --dry-run), legt nichts an. Mit --publish: Container → warten → veröffentlichen →
      nachlesen und die Beschreibung Byte für Byte vergleichen.
  post_social.py status --tiktok-post ID | --instagram-media ID
      Stand eines Beitrags nachlesen.

Global (vor oder nach dem Befehl): --dry-run  (zeigt nur die Aufrufe, legt nichts an und lädt nichts hoch)
                                   --config PFAD  (Standard: post.config.json neben diesem Skript, wird nicht eingecheckt)

Es gibt zwei Sicherungen: Ohne --publish entsteht nichts Öffentliches, und jeder TikTok-Aufruf trägt genau eines von
is_draft / publish_now (ohne beide würde Zernio den Beitrag still in 60 Minuten einplanen).
Beschreibungen gehen unverändert hinaus: echtes #, echte Zeilenumbrüche. Das „# als %23“ aus der Werkzeugbeschreibung von
Instagram ist falsch und würde wörtlich veröffentlicht.

Nur Standardbibliothek (Python 3.9+); ruft `composio` und `curl` auf.
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
UPLOAD_MAX_AGE_MIN = 45  # so lange wird ein Upload (temporäre URL) wiederverwendet
HASHTAG_LIMIT = {"tiktok": 5, "instagram": 5}  # Instagram: höchstens 5 seit Dezember 2025; TikTok: mehr bringt nichts
CURL_WRITE_OUT = "\n%{http_code}"  # hängt den HTTP-Code in einer eigenen Zeile an die Ausgabe
CONTENT_TYPES = {".mp4": "video/mp4", ".mov": "video/quicktime"}
PLACEHOLDER_URL = "https://example.invalid/oeffentliche-url-kommt-nach-dem-upload.mp4"
IG_POLL_SECONDS = 5
IG_POLL_MAX_SECONDS = 300
CONFIG_KEYS = ("tiktok_account_id", "instagram_user_id", "composio_account_zernio", "composio_account_instagram")


class PostError(Exception):
    """Erwartbarer Fehler mit einer Meldung, die dem Menschen gezeigt wird."""


# ---------------------------------------------------------------------------------------------------------------------
# Reine Funktionen (ohne Netz, getestet in tests/test_post_social.py)
# ---------------------------------------------------------------------------------------------------------------------

def mask_token(token):
    """Zeigt von einem Token nie ein Zeichen – nur dass es einen gibt."""
    return f"<TOKEN, {len(token)} Zeichen>"


def mask_text(text, secrets=()):
    """Entfernt Upload-Token, signierte URL-Parameter und übergebene Geheimnisse aus Text, der angezeigt wird."""
    text = str(text)
    for s in secrets:
        if s and len(s) >= 6:
            text = text.replace(s, "<GEHEIM>")
    text = re.sub(r"(/upload/)(?!presign\b|complete\b)[^\s/?#\"')]{6,}", r"\1<TOKEN>", text)
    text = re.sub(r"(?i)(\btoken\s*[:=]\s*)[^\s&\"')]{6,}", r"\1<TOKEN>", text)
    text = re.sub(r"(?i)((?:signature|x-amz-credential|x-amz-security-token|sig)=)[^&\s\"']+", r"\1<…>", text)
    return text


def parse_json_output(text):
    """composio schreibt manchmal eine „Tip: …“-Zeile vor das JSON: ab dem ersten Zeilenanfang mit { lesen,
    sonst ab irgendeiner { (die erste, die sich als JSON-Objekt lesen lässt)."""
    decoder = json.JSONDecoder()
    starts = [m.start() for m in re.finditer(r"^\{", text, re.M)] + [m.start() for m in re.finditer(r"\{", text)]
    for i in starts:
        try:
            obj, _ = decoder.raw_decode(text[i:])
        except ValueError:
            continue
        if isinstance(obj, dict):
            return obj
    raise PostError("keine JSON-Antwort gefunden")


def result_text(obj):
    """Der Text unter data.result (so antworten die Zernio-Werkzeuge)."""
    data = obj.get("data") or {}
    res = data.get("result") if isinstance(data, dict) else None
    return res if isinstance(res, str) else json.dumps(data, ensure_ascii=False)


def extract_token(text):
    """Upload-Token aus der Antwort von ZERNIO_MCP_MEDIA_GENERATE_UPLOAD_LINK: Zeile „Token: …“, sonst aus der Upload-URL."""
    m = re.search(r"^\s*Token:\s*(\S+)\s*$", text, re.M) or re.search(r"/upload/([^\s/?#\"')]+)", text)
    if not m:
        raise PostError("Im Upload-Link-Ergebnis steht kein Token (Format geändert?): " + mask_text(text)[:300])
    return m.group(1)


def parse_accounts(text):
    """Zeilen wie „- tiktok: Name (ID: abc123)“ → [{'platform', 'name', 'id'}, …]."""
    found = []
    for m in re.finditer(r"^\s*-\s*([A-Za-z]+):\s*(.*?)\s*\(ID:\s*([^)\s]+)\)\s*$", text, re.M):
        found.append({"platform": m.group(1).lower(), "name": m.group(2), "id": m.group(3)})
    return found


def parse_post_result(text):
    """Ergebnis von ZERNIO_MCP_POSTS_CREATE: „✅ Published to tiktok (@name) … Post ID: …“.
    art ist 'published', 'draft', 'scheduled' oder 'unknown'. Ohne Post-ID ist es ein Fehler."""
    pid = re.search(r"Post ID:\s*([A-Za-z0-9_\-]+)", text)
    if not pid:
        raise PostError("Keine Post-ID in der Antwort: " + mask_text(text).strip()[:400])
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
    """„Status: published“ aus ZERNIO_MCP_POSTS_GET (klein geschrieben) oder None."""
    m = re.search(r"Status:\s*([A-Za-z_\-]+)", text)
    return m.group(1).lower() if m else None


def load_caption(path):
    """UTF-8-Text lesen, Zeilenenden auf \\n bringen, nachgestellte Zeilenumbrüche entfernen, innere behalten."""
    try:
        raw = Path(path).read_bytes()
    except OSError as e:
        raise PostError(f"Beschreibung nicht lesbar: {path} ({e.strerror})")
    try:
        text = raw.decode("utf-8-sig")  # ein BOM am Anfang würde sonst mitgepostet
    except UnicodeDecodeError:
        raise PostError(f"Beschreibung ist kein UTF-8: {path}")
    text = text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    if not text.strip():
        raise PostError(f"Beschreibung ist leer: {path}")
    return text


_HASHTAG = re.compile(r"(?<![\w#&/])#(\w+)")


def count_hashtags(text):
    """Zählt echte Hashtags; „#1“, „&#39;“ und URL-Anker zählen nicht."""
    return sum(1 for m in _HASHTAG.finditer(text) if not m.group(1).isdigit())


def caption_warnings(platform, caption):
    """Hinweise, die nicht blockieren (außer %23 bei Instagram-Veröffentlichung, siehe cmd_instagram)."""
    out = []
    n, limit = count_hashtags(caption), HASHTAG_LIMIT[platform]
    if n > limit:
        if platform == "instagram":
            out.append(f"{n} Hashtags – Instagram erlaubt seit Dezember 2025 höchstens {limit} je Beitrag.")
        else:
            out.append(f"{n} Hashtags – mehr als {limit} bringt auf TikTok nach der Recherche nichts; 3 bis 4 passende reichen.")
    if "%23" in caption:
        out.append("Die Beschreibung enthält „%23“ und würde so wörtlich veröffentlicht. Der Hinweis „# als %23 schreiben“ "
                   "in der Werkzeugbeschreibung ist falsch: echtes # verwenden.")
    if platform == "instagram" and len(caption) > 2200:
        out.append(f"Beschreibung hat {len(caption)} Zeichen – Instagram erlaubt höchstens 2200.")
    return out


def ensure_one_mode(args):
    """Jeder TikTok-Aufruf trägt genau eines von is_draft / publish_now (beides oder keines → Fehler)."""
    modes = [k for k in ("is_draft", "publish_now") if args.get(k) is True]
    stray = [k for k in ("is_draft", "publish_now") if k in args and args[k] is not True]
    if len(modes) != 1 or stray:
        raise PostError("Interner Fehler: TikTok-Aufruf muss genau eines von is_draft/publish_now (=true) enthalten.")
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
    """Byte für Byte (UTF-8) gleich."""
    return expected.encode("utf-8") == (actual or "").encode("utf-8")


def describe_diff(expected, actual):
    actual = actual or ""
    i = next((k for k, (x, y) in enumerate(zip(expected, actual)) if x != y), min(len(expected), len(actual)))
    return (f"erste Abweichung bei Zeichen {i}: Datei …{expected[max(0, i - 15):i + 15]!r}… "
            f"↔ Instagram …{actual[max(0, i - 15):i + 15]!r}… (Längen {len(expected)} ↔ {len(actual)})")


def curl_quote(s):
    """Wert für eine curl-Konfigurationszeile (so stehen URL und Token nie in der Prozessliste)."""
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
    """Letzte content-length einer (ggf. mehrteiligen, weil umgeleiteten) Header-Ausgabe oder None."""
    values = re.findall(r"(?im)^content-length:\s*(\d+)\s*$", header_text)
    return int(values[-1]) if values else None


def sidecar_path(video):
    return Path(str(video) + ".upload.json")


def read_fresh_upload(video, now=None, max_age_min=UPLOAD_MAX_AGE_MIN):
    """URL aus <video>.upload.json, wenn Datei unverändert (Größe, Änderungszeit) und jünger als max_age_min, sonst None."""
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
    """Fehlende Datei ist kein Fehler (accounts, upload und status brauchen keine); leere Werte zählen als nicht gesetzt."""
    path = Path(path)
    if not path.exists():
        return {}
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        raise PostError(f"{path.name} ist kein gültiges JSON: {e}")
    if not isinstance(cfg, dict):
        raise PostError(f"{path.name} muss ein JSON-Objekt sein.")
    return {k: v.strip() for k, v in cfg.items() if isinstance(v, str) and v.strip()}


def need(cfg, key, config_path):
    if not cfg.get(key):
        raise PostError(f"In {Path(config_path).name} fehlt „{key}“. `post_social.py accounts` zeigt die Werte; "
                        "Vorlage: post.config.example.json (Kopie als post.config.json, wird nicht eingecheckt).")
    return cfg[key]


# ---------------------------------------------------------------------------------------------------------------------
# Aufrufe nach außen (composio, curl)
# ---------------------------------------------------------------------------------------------------------------------

def run_composio(slug, args, account=None, dry_run=False, timeout=300):
    """`composio execute SLUG -d -` mit dem JSON auf stdin (nichts davon steht in der Prozessliste). Liefert das geparste JSON.
    Es wird nie automatisch wiederholt: eine Wiederholung eines Anlegens oder Veröffentlichens könnte doppelt posten."""
    cmd = ["composio", "execute", slug, "-d", "-"]
    if account:
        cmd += ["--account", account]
    if dry_run:
        cmd.append("--dry-run")
    try:
        p = subprocess.run(cmd, input=json.dumps(args, ensure_ascii=False), capture_output=True, text=True,
                           encoding="utf-8", timeout=timeout)
    except FileNotFoundError:
        raise PostError("Die composio-CLI fehlt (nicht im PATH). Installation und Anmeldung: siehe POSTEN.md.")
    except subprocess.TimeoutExpired:
        raise PostError(f"{slug}: keine Antwort nach {timeout} s. Ausgang unklar: nicht blind wiederholen, erst nachsehen "
                        "(Konto-Oberfläche oder `status`).")
    try:
        obj = parse_json_output(p.stdout or "")
    except PostError:
        raise PostError(f"{slug}: unerwartete Antwort (Exit {p.returncode}): "
                        + mask_text(((p.stdout or "") + (p.stderr or "")).strip())[:400])
    if not obj.get("successful"):
        raise PostError(f"{slug} fehlgeschlagen: " + mask_text(obj.get("error") or "ohne Fehlertext")[:500])
    return obj


def curl_request(url, headers=(), data=None, upload_file=None, head=False, timeout=120, secrets=()):
    """curl mit Konfiguration auf stdin. Gibt (HTTP-Code, Text) zurück; Text ist bei head=True die Header-Ausgabe."""
    cfg = build_curl_config(url, headers, data, upload_file, head, timeout)
    try:
        p = subprocess.run(["curl", "-K", "-"], input=cfg, capture_output=True, text=True, encoding="utf-8",
                           timeout=timeout + 30)
    except FileNotFoundError:
        raise PostError("curl fehlt.")
    except subprocess.TimeoutExpired:
        raise PostError("curl: Zeitüberschreitung.")
    if p.returncode != 0:
        raise PostError(f"curl-Fehler {p.returncode}: " + mask_text((p.stderr or "").strip(), secrets)[:300])
    body, _, code = (p.stdout or "").rpartition("\n")
    return (int(code) if code.strip().isdigit() else 0), body


def remote_size(url, secrets=()):
    code, headers = curl_request(url, head=True, timeout=60, secrets=secrets)
    if not 200 <= code < 300:
        raise PostError(f"Die hochgeladene Datei ist unter der öffentlichen URL nicht abrufbar (HTTP {code}).")
    size = parse_content_length(headers)
    if size is None:
        raise PostError("Der Server nennt keine Dateigröße (content-length); der Upload lässt sich nicht prüfen.")
    return size


def check_video(path):
    video = Path(path).expanduser()
    if not video.is_file():
        raise PostError(f"Video nicht gefunden: {path}")
    if video.suffix.lower() not in CONTENT_TYPES:
        raise PostError("Nur .mp4 und .mov werden hochgeladen.")
    if video.stat().st_size == 0:
        raise PostError("Das Video ist leer.")
    return video


def upload_video(video, account=None):
    """Die vier Schritte des temporären Zernio-Uploads. Gibt (öffentliche URL, Größe auf dem Server) zurück."""
    size = video.stat().st_size
    ctype = CONTENT_TYPES[video.suffix.lower()]
    print("  1/4 Upload-Link anfordern …", flush=True)
    token = extract_token(result_text(run_composio("ZERNIO_MCP_MEDIA_GENERATE_UPLOAD_LINK", {}, account)))
    secrets = [token]
    print(f"      {mask_token(token)}", flush=True)
    json_head = ["Content-Type: application/json"]
    file_entry = {"filename": video.name, "contentType": ctype, "size": size}

    print("  2/4 Upload vorbereiten (presign) …", flush=True)
    code, body = curl_request(f"{ZERNIO}/api/v1/media/upload/presign?token={token}", json_head,
                              data=json.dumps(file_entry), secrets=secrets)
    try:
        pre = json.loads(body)
        upload_url, key = pre["uploadUrl"], pre["key"]
    except (ValueError, KeyError, TypeError):
        raise PostError(f"presign: unerwartete Antwort (HTTP {code}): " + mask_text(body, secrets)[:300])
    secrets.append(upload_url)

    print(f"  3/4 Datei hochladen ({size / 1e6:.1f} MB) …", flush=True)
    code, body = curl_request(upload_url, [f"Content-Type: {ctype}"], upload_file=video, timeout=1800, secrets=secrets)
    if not 200 <= code < 300:
        raise PostError(f"Upload abgelehnt (HTTP {code}): " + mask_text(body, secrets)[:300])

    print("  4/4 Upload abschließen …", flush=True)
    code, body = curl_request(f"{ZERNIO}/api/v1/media/upload/complete?token={token}", json_head,
                              data=json.dumps({"files": [dict(file_entry, key=key)]}), secrets=secrets)
    try:
        done = json.loads(body)
        url = done["files"][0]["url"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise PostError(f"complete: unerwartete Antwort (HTTP {code}): " + mask_text(body, secrets)[:300])

    remote = remote_size(url, secrets)
    if remote != size:
        raise PostError(f"Größe stimmt nicht: lokal {size} Byte, auf dem Server {remote} Byte. Upload verwerfen und neu versuchen.")
    return url, remote


def obtain_url(ctx, video, force_new=False, dry_run=False):
    """Frische URL aus dem Sidecar (wenn sie noch abrufbar ist), sonst Upload. Im Trockenlauf wird nie hochgeladen."""
    account = ctx.cfg.get("composio_account_zernio")
    fresh = None if force_new else read_fresh_upload(video)
    if fresh:
        if dry_run:
            print("Upload von vorhin wird wiederverwendet.")
            return fresh
        try:
            if remote_size(fresh) == video.stat().st_size:
                print(f"Upload von vorhin wird wiederverwendet (höchstens {UPLOAD_MAX_AGE_MIN} Minuten alt).")
                return fresh
        except PostError:
            pass
        print("Der gespeicherte Upload ist nicht mehr abrufbar, lade neu hoch.")
    if dry_run:
        print("Trockenlauf: kein Upload, im Aufruf steht eine Platzhalter-URL.")
        return PLACEHOLDER_URL
    print(f"Lade {video.name} hoch:")
    url, remote = upload_video(video, account)
    write_sidecar(video, url)
    ctx.log({"aktion": "upload", "datei": video.name, "bytes": remote})
    print(f"Größe geprüft: {remote} Byte lokal und auf dem Server.")
    return url


# ---------------------------------------------------------------------------------------------------------------------
# Befehle
# ---------------------------------------------------------------------------------------------------------------------

@dataclasses.dataclass
class Ctx:
    cfg: dict
    config_path: Path
    dry_run: bool = False

    @property
    def log_path(self):
        return self.config_path.resolve().parent / "post-log.jsonl"  # neben der Konfiguration, in edit-tools/ ignoriert

    def log(self, entry):
        """Eine JSON-Zeile je echter Aktion (keine Beschreibung, keine Token)."""
        line = {"zeit": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
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
    print(f"Warnung: {text}", file=sys.stderr, flush=True)


def active_connections(toolkit):
    """Namen (word_id) der aktiven Composio-Verbindungen eines Toolkits; leer, wenn `connections list` nicht geht."""
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
    print("Zernio (TikTok, YouTube …) – nur lesend:")
    for conn in zernio_list:
        label = conn or "Standardverbindung"
        try:
            accounts = parse_accounts(result_text(run_composio("ZERNIO_MCP_ACCOUNTS_LIST", {}, conn)))
        except PostError as e:
            print(f"  [{label}] Fehler: {e}")
            continue
        if not accounts:
            print(f"  [{label}] keine Konten angebunden")
            continue
        zernio_with_accounts.append(conn)
        for acc in accounts:
            print(f"  [{label}] {acc['platform']}: {acc['name']} (ID: {acc['id']})")
            if acc["platform"] == "tiktok":
                tiktok.append(acc)
    print("Instagram – nur lesend:")
    for conn in ig_list:
        label = conn or "Standardverbindung"
        try:
            data = run_composio("INSTAGRAM_GET_USER_INFO", {"fields": "id,user_id,username"}, conn).get("data") or {}
        except PostError as e:
            print(f"  [{label}] Fehler: {e}")
            continue
        uid = data.get("id") or data.get("user_id")
        if uid:
            ig_users.append((conn, uid))
            print(f"  [{label}] @{data.get('username', '?')} (ig_user_id: {uid})")
    print("\nIn post.config.json (Vorlage: post.config.example.json) gehört:")
    cfg = {"tiktok_account_id": tiktok[0]["id"] if len(tiktok) == 1 else "",
           "instagram_user_id": ig_users[0][1] if len(ig_users) == 1 else ""}
    if len(zernio_list) > 1 and len(zernio_with_accounts) == 1 and zernio_with_accounts[0]:
        cfg["composio_account_zernio"] = zernio_with_accounts[0]  # die Standardverbindung hätte hier keine Konten
    if len(ig_list) > 1 and len(ig_users) == 1 and ig_users[0][0]:
        cfg["composio_account_instagram"] = ig_users[0][0]
    print(json.dumps(cfg, indent=2, ensure_ascii=False))
    if len(tiktok) != 1 or len(ig_users) != 1:
        print("Hinweis: Bei mehr oder weniger als einem Konto je Plattform die passende ID oben selbst auswählen.")
    print("Die Datei bleibt lokal (steht in edit-tools/.gitignore).")
    return 0


def cmd_upload(a, ctx):
    video = check_video(a.video)
    if ctx.dry_run:
        print(f"Trockenlauf: würde {video.name} ({video.stat().st_size} Byte) in den temporären Zernio-Speicher laden "
              f"und {sidecar_path(video).name} schreiben.")
        return 0
    url = obtain_url(ctx, video, force_new=a.neu)
    print(f"Öffentliche URL (temporär): {url}")
    print(f"Gemerkt in {sidecar_path(video).name}; tiktok und instagram nutzen die URL, solange der Upload höchstens "
          f"{UPLOAD_MAX_AGE_MIN} Minuten alt ist.")
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
    print(f"TikTok: {'VERÖFFENTLICHEN (publish_now)' if a.publish else 'ENTWURF anlegen (is_draft)'}")
    if ctx.dry_run:
        show_call(run_composio("ZERNIO_MCP_POSTS_CREATE", args, zernio, dry_run=True))
        print("Trockenlauf: nichts wurde angelegt oder veröffentlicht.")
        return 0
    created = run_composio("ZERNIO_MCP_POSTS_CREATE", args, zernio)
    try:
        post_id = parse_post_result(result_text(created))["post_id"]
    except PostError as e:
        # Der Aufruf war erfolgreich, nur die Antwort ist nicht lesbar: der Beitrag kann existieren
        ctx.log({"aktion": "tiktok_veroeffentlichen" if a.publish else "tiktok_entwurf", "plattform": "tiktok",
                 "post_id": None, "status": "unklar"})
        raise PostError(f"{e}\nAusgang unklar: NICHT erneut ausführen, erst im Konto nachsehen, ob ein Beitrag oder Entwurf entstanden ist.")
    print(f"Post-ID: {post_id}")
    entry = {"aktion": "tiktok_veroeffentlichen" if a.publish else "tiktok_entwurf", "plattform": "tiktok",
             "post_id": post_id, "status": None}
    try:
        status, text = read_tiktok_status(post_id, zernio, tries=1 if mode == "is_draft" else 8, pause=5)
        entry["status"] = status
    except PostError as e:
        raise PostError(f"Beitrag angelegt (Post-ID {post_id}), aber das Nachlesen schlug fehl: {e}")
    finally:
        ctx.log(entry)
    print(f"Status laut Nachlesen: {status or 'unbekannt'}")
    if not a.publish:
        if status in ("published", "scheduled"):
            print(f"ACHTUNG: Der Beitrag ist nicht im Entwurfsstatus ({status}). Sofort im Konto prüfen.", file=sys.stderr)
            return 1
        print("Entwurf angelegt. Veröffentlicht ist NICHTS; mit --publish veröffentlichen.")
        return 0
    if status == "published":
        print(f"Veröffentlicht. Post-ID {post_id}.")
        return 0
    if status == "scheduled":
        print(f"ACHTUNG: Der Beitrag wurde nur EINGEPLANT, nicht sofort veröffentlicht (Post-ID {post_id}). Im Konto prüfen.", file=sys.stderr)
        return 1
    if status in ("failed", "error", "cancelled"):
        print(f"TikTok meldet {status}: " + mask_text(text).strip()[:300], file=sys.stderr)
        return 1
    print(f"Noch nicht abgeschlossen (Status {status}). Später prüfen: post_social.py status --tiktok-post {post_id}", file=sys.stderr)
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
        raise PostError("Abbruch: „%23“ in der Beschreibung würde unveränderlich so veröffentlicht (Instagram-Beiträge lassen sich "
                        "über Composio weder ändern noch löschen). Datei mit echtem # korrigieren.")
    url = obtain_url(ctx, video, dry_run=dry)
    container = build_instagram_container_args(ig_user, url, caption, a.thumb_ms, not a.nicht_im_feed)
    if dry:
        print("Instagram Reels: nur prüfen (composio --dry-run), es wird nichts angelegt."
              if not ctx.dry_run else "Instagram Reels: Trockenlauf.")
        show_call(run_composio("INSTAGRAM_POST_IG_USER_MEDIA", container, ig_acc, dry_run=True))
        show_call(run_composio("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
                               build_instagram_publish_args(ig_user, "<creation_id aus dem Container>"), ig_acc, dry_run=True))
        print("Es wurde nichts angelegt oder veröffentlicht. Zum Veröffentlichen: --publish.")
        return 0

    print("Instagram Reels: VERÖFFENTLICHEN")
    creation_id = str((run_composio("INSTAGRAM_POST_IG_USER_MEDIA", container, ig_acc).get("data") or {}).get("id") or "")
    if not creation_id:
        raise PostError("Container wurde angelegt, aber die Antwort enthält keine ID (data.id).")
    ctx.log({"aktion": "instagram_container", "plattform": "instagram", "container_id": creation_id})
    print(f"Container: {creation_id}; warte auf die Verarbeitung (30 bis 50 s sind üblich) …", flush=True)
    waited = 0
    while True:
        data = run_composio("INSTAGRAM_GET_POST_STATUS", {"creation_id": creation_id}, ig_acc).get("data") or {}
        code = data.get("status_code")
        if code == "FINISHED":
            break
        if code != "IN_PROGRESS":
            raise PostError(f"Instagram meldet {code or 'unbekannten Status'} für den Container {creation_id}: "
                            + mask_text(data.get("status") or "")[:300] + " Es wurde nichts veröffentlicht.")
        if waited >= IG_POLL_MAX_SECONDS:
            raise PostError(f"Container {creation_id} nach {waited} s noch nicht fertig. Es wurde nichts veröffentlicht; "
                            "später noch einmal versuchen.")
        time.sleep(IG_POLL_SECONDS)
        waited += IG_POLL_SECONDS
        print(f"  … {waited} s, Status {code}", flush=True)
    print(f"Container fertig nach rund {waited} s. Veröffentliche …", flush=True)
    try:
        media_id = str((run_composio("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", build_instagram_publish_args(ig_user, creation_id),
                                     ig_acc).get("data") or {}).get("id") or "")
    except PostError as e:
        raise PostError(f"{e}\nAusgang unklar: NICHT erneut ausführen, erst im Instagram-Konto nachsehen, ob der Beitrag online ist.")
    if not media_id:
        raise PostError("Veröffentlicht, aber die Antwort enthält keine Media-ID. Im Instagram-Konto nachsehen; nicht erneut ausführen.")
    entry = {"aktion": "instagram_veroeffentlichen", "plattform": "instagram", "container_id": creation_id,
             "media_id": media_id, "permalink": None, "beschreibung_gleich": None}
    try:
        media = run_composio("INSTAGRAM_GET_IG_MEDIA", {"ig_media_id": media_id,
                             "fields": "id,caption,permalink,media_product_type,timestamp"}, ig_acc).get("data") or {}
        entry["permalink"] = media.get("permalink")
        same = captions_equal(caption, media.get("caption"))
        entry["beschreibung_gleich"] = same
    except PostError as e:
        raise PostError(f"Veröffentlicht (Media-ID {media_id}), aber das Nachlesen schlug fehl: {e}")
    finally:
        ctx.log(entry)
    print(f"Veröffentlicht. Media-ID: {media_id}")
    print(f"Link: {media.get('permalink') or '(nicht geliefert)'}  ({media.get('media_product_type') or '?'}, {media.get('timestamp') or '?'})")
    if not same:
        print("FEHLER: Die veröffentlichte Beschreibung weicht von der Datei ab – " + describe_diff(caption, media.get("caption")), file=sys.stderr)
        print("Der Beitrag ist online und lässt sich über Composio nicht ändern oder löschen: in der Instagram-App korrigieren.", file=sys.stderr)
        return 1
    print("Beschreibung Byte für Byte geprüft: gleich der Datei.")
    return 0


def cmd_status(a, ctx):
    if a.tiktok_post:
        text = result_text(run_composio("ZERNIO_MCP_POSTS_GET", {"post_id": a.tiktok_post}, ctx.cfg.get("composio_account_zernio")))
        print(mask_text(text).strip())
        print(f"\nStatus: {parse_status(text) or 'unbekannt'}")
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
    # SUPPRESS: ein Wert vor oder nach dem Befehl gilt, der eine überschreibt nicht den anderen mit dem Standard.
    # Die Standardwerte setzt parse_args() danach; set_defaults() wäre falsch, weil Eltern- und Unterparser dieselben
    # Aktionsobjekte teilen und das „--dry-run“ vor dem Befehl sonst verloren ginge.
    common.add_argument("--dry-run", action="store_true", default=argparse.SUPPRESS,
                        help="nur zeigen, was passieren würde; nichts hochladen, anlegen oder veröffentlichen")
    common.add_argument("--config", default=argparse.SUPPRESS, metavar="PFAD", help="Konfiguration (Standard: post.config.json neben dem Skript)")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, parents=[common])
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("accounts", parents=[common], help="verbundene Konten lesen und Konfigurationswerte nennen")
    u = sub.add_parser("upload", parents=[common], help="Video hochladen und öffentliche URL ausgeben")
    u.add_argument("video")
    u.add_argument("--neu", action="store_true", help="auch dann neu hochladen, wenn noch ein frischer Upload gemerkt ist")
    t = sub.add_parser("tiktok", parents=[common], help="Entwurf anlegen (Standard) oder mit --publish veröffentlichen")
    t.add_argument("video")
    t.add_argument("--caption-file", required=True, metavar="DATEI")
    t.add_argument("--publish", action="store_true", help="sofort veröffentlichen (ohne: Entwurf)")
    i = sub.add_parser("instagram", parents=[common], help="Reel prüfen (Standard) oder mit --publish veröffentlichen")
    i.add_argument("video")
    i.add_argument("--caption-file", required=True, metavar="DATEI")
    i.add_argument("--thumb-ms", type=int, metavar="N", help="Titelbild aus dem Video bei N Millisekunden")
    i.add_argument("--nicht-im-feed", action="store_true", help="Reel nur im Reels-Tab, nicht zusätzlich im Profil-Feed")
    i.add_argument("--publish", action="store_true", help="wirklich veröffentlichen (ohne: nur prüfen)")
    s = sub.add_parser("status", parents=[common], help="Stand eines Beitrags nachlesen")
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
        print(f"Fehler: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nAbgebrochen. Falls schon etwas angelegt wurde, steht die ID in post-log.jsonl.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
