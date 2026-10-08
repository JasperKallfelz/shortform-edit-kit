#!/usr/bin/env python3
"""Hörseite: liefert index.html und die Audiodateien dieses Ordners aus, listet alle Sounds und merkt sich die Urteile.

Start:   python3 hoerseite.py            → http://localhost:3700
Urteile: auswahl.json neben dieser Datei, {"since": <erster Start>, "v": {"<pfad>": "keep" | "drop"}}.
Neue Dateien in sfx-kandidaten/ erscheinen ohne Neustart (die Seite fragt alle paar Sekunden nach).
Die Kategorie eines Kandidaten kommt aus dem Präfix des Dateinamens (CATS unten).
Nur Standardbibliothek, läuft mit dem System-Python (3.9).
"""
import csv
import json
import os
import re
import struct
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.environ.get("HOERSEITE_STATE", os.path.join(ROOT, "auswahl.json"))
PORT = int(os.environ.get("HOERSEITE_PORT", "3700"))
KIT = "sfx-kit/sounds"
CAND = "sfx-kandidaten"
AUDIO = (".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aif", ".aiff")
KIT_CAT = "Im Video (Sound-Kit)"

# Reihenfolge = Reihenfolge auf der Seite. Präfix = Dateiname bis zum ersten Unterstrich.
CATS = [
    ("Klapptafel", ["flap"]),
    ("Flutter", ["flutter"]),
    ("Riser", ["riser"]),
    ("UI", ["ui"]),
    ("Klick", ["click"]),
    ("Tick & Pop", ["tick", "pop"]),
    ("Kamera", ["shutter", "film", "autofocus"]),
    ("Whoosh", ["whoosh"]),
    ("Papier & Karte", ["paper", "card"]),
    ("Tastatur", ["type"]),
    ("Stift", ["pen"]),
    ("Funkeln", ["sparkle"]),
    ("Schlag", ["impact"]),
    ("Feuerzeug", ["lighter"]),
]
PREFIX = {p: name for name, ps in CATS for p in ps}
OTHER = "Sonstiges"
LOCK = threading.Lock()
_secs = {}


def wav_secs(path):
    """Länge aus dem RIFF-Kopf (Datenlänge / Bytes pro Sekunde); None bei allem, was kein WAV ist."""
    try:
        key = (path, os.path.getmtime(path))
        if key in _secs:
            return _secs[key]
        secs = None
        with open(path, "rb") as fh:
            head = fh.read(12)
            if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
                rate = 0
                while True:
                    ch = fh.read(8)
                    if len(ch) < 8:
                        break
                    size = struct.unpack("<I", ch[4:])[0]
                    if ch[:4] == b"fmt ":
                        rate = struct.unpack("<I", fh.read(size + (size & 1))[8:12])[0]
                    elif ch[:4] == b"data":
                        if rate:
                            secs = min(size, os.path.getsize(path) - fh.tell()) / rate
                        break
                    else:
                        fh.seek(size + (size & 1), 1)
        _secs[key] = secs
        return secs
    except (OSError, struct.error):
        return None


def tsv(path):
    try:
        with open(path, newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh, delimiter="\t", quoting=csv.QUOTE_NONE))
    except OSError:
        return []


def list_audio(rel):
    try:
        names = os.listdir(os.path.join(ROOT, rel))
    except OSError:
        return []
    return sorted(n for n in names if n.lower().endswith(AUDIO) and not n.startswith("."))


def natural(name):
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", name)]


def sounds():
    man = {r.get("file"): r for r in tsv(os.path.join(ROOT, CAND, "manifest.tsv"))}
    # Rohdatei → Name im Kit, damit ein Kandidat zeigt, dass er schon im Video steckt
    used = {}
    for r in tsv(os.path.join(ROOT, "sfx-kit", "quellen.tsv")):
        raw = (r.get("rohdatei") or "").strip()
        if raw.endswith(AUDIO):
            used[raw] = (r.get("sound") or "").strip()
    out = []
    for fn in sorted(list_audio(KIT), key=natural):
        p = os.path.join(ROOT, KIT, fn)
        out.append({"id": f"{KIT}/{fn}", "name": os.path.splitext(fn)[0], "cat": KIT_CAT, "secs": wav_secs(p), "mtime": os.path.getmtime(p), "kit": True})
    for fn in list_audio(CAND):
        p = os.path.join(ROOT, CAND, fn)
        row = man.get(fn) or {}
        try:
            mtime = os.path.getmtime(p)
        except OSError:
            continue
        out.append({
            "id": f"{CAND}/{fn}",
            "name": os.path.splitext(fn)[0].replace("_", " "),
            "cat": PREFIX.get(fn.split("_")[0].lower(), OTHER),
            "secs": wav_secs(p),
            "mtime": mtime,
            "src": row.get("source_page_url") or "",
            "lic": row.get("licence_name") or "",
            "note": row.get("note") or "",
            "used": used.get(fn, ""),
        })
    return {"cats": [KIT_CAT] + [c for c, _ in CATS] + [OTHER], "sounds": out}


def load_state():
    try:
        with open(STATE, encoding="utf-8") as fh:
            st = json.load(fh)
        if isinstance(st.get("v"), dict):
            return st
    except (OSError, ValueError):
        pass
    st = {"since": time.time(), "v": {}}
    save_state(st)
    return st


def save_state(st):
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(st, fh, indent=1, ensure_ascii=False, sort_keys=True)
    os.replace(tmp, STATE)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/sounds":
                return self.json(sounds())
            if path == "/api/state":
                with LOCK:
                    return self.json(load_state())
            if self.headers.get("Range") and self.send_range():
                return
            return super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_range(self):
        """Teilabruf (Safari spielt Audio nur mit 206-Antworten)."""
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers["Range"].strip())
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path) or not (m.group(1) or m.group(2)):
            return False
        size = os.path.getsize(path)
        if m.group(1):
            start, end = int(m.group(1)), min(int(m.group(2)), size - 1) if m.group(2) else size - 1
        else:
            start, end = max(0, size - int(m.group(2))), size - 1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return True
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(path, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = fh.read(min(65536, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)
        return True

    def do_POST(self):
        # Nur JSON: ein fremdes Formular im Browser kann diesen Inhaltstyp nicht ohne Rückfrage schicken.
        if self.path != "/api/state" or "application/json" not in (self.headers.get("Content-Type") or ""):
            return self.json({"error": "unbekannt"}, 404)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)))
            sid, v = body["id"], body.get("v")
        except (ValueError, KeyError, TypeError):
            return self.json({"error": "ungültig"}, 400)
        if v not in ("keep", "drop", None) or sid not in {s["id"] for s in sounds()["sounds"]}:
            return self.json({"error": "ungültig"}, 400)
        with LOCK:
            st = load_state()
            if v is None:
                st["v"].pop(sid, None)
            else:
                st["v"][sid] = v
            save_state(st)
        self.json(st)


if __name__ == "__main__":
    if len(sys.argv) > 1:  # keine Argumente vorgesehen; --help soll keinen Server starten
        sys.exit(__doc__)
    with LOCK:
        load_state()
    print(f"Hörseite: http://localhost:{PORT}  (Ordner {ROOT})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
