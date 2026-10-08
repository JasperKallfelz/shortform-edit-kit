#!/usr/bin/env python3
"""Fetch videos (and images) from WhatsApp Desktop (macOS) – reads the database only.

  whatsapp_clips.py chats [--days 14]
      Chats with received videos/images of the last days (name, count, last arrival).
  whatsapp_clips.py export "<part of the chat name>" [--date YYYY-MM-DD | --days N] [--images] [--all] [--out FOLDER] [--photos [ALBUM]]
      Copies the files in sender order to ~/Movies/WhatsApp-<name>-<date>/ (name-date-NN.mp4).
      --photos also imports them into the Photos library, into an album of their own.
      --images also takes images, --all also files you sent yourself.

WhatsApp shrinks videos (usually 1024 × 576). For a final export, ask the sender for the original.
Standard library only, runs with the system Python.
"""
import argparse
import datetime as dt
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time

BASE = os.path.expanduser("~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared")
APPLE_EPOCH = 978307200  # WhatsApp stores seconds since 2001-01-01


def db():
    return sqlite3.connect(f"file:{BASE}/ChatStorage.sqlite?mode=ro", uri=True)


def chats(days):
    since = time.time() - days * 86400 - APPLE_EPOCH
    rows = db().execute(
        """SELECT s.ZPARTNERNAME, sum(m.ZMESSAGETYPE=2), sum(m.ZMESSAGETYPE=1), max(m.ZMESSAGEDATE)
           FROM ZWAMESSAGE m JOIN ZWACHATSESSION s ON s.Z_PK=m.ZCHATSESSION
           WHERE m.ZMESSAGETYPE IN (1,2) AND m.ZISFROMME=0 AND m.ZMESSAGEDATE>? GROUP BY s.Z_PK ORDER BY 2 DESC, 3 DESC""", (since,)).fetchall()
    for name, vids, pics, last in rows:
        print(f"{vids:4d} videos {pics:4d} images  last {dt.datetime.fromtimestamp(last + APPLE_EPOCH):%Y-%m-%d %H:%M}  {name}")


def export(a):
    con = db()
    found = con.execute("SELECT Z_PK, ZPARTNERNAME FROM ZWACHATSESSION WHERE ZPARTNERNAME LIKE ? ORDER BY ZLASTMESSAGEDATE DESC", (f"%{a.chat}%",)).fetchall()
    if len(found) != 1:
        sys.exit("Chat not unique: " + (", ".join(n for _, n in found) or "no match") + " – give a more exact name (see: whatsapp_clips.py chats).")
    pk, name = found[0]
    types = (1, 2) if a.images else (2,)
    q = f"""SELECT mi.ZMEDIALOCALPATH, date(m.ZMESSAGEDATE+{APPLE_EPOCH},'unixepoch','localtime')
            FROM ZWAMESSAGE m JOIN ZWAMEDIAITEM mi ON mi.ZMESSAGE=m.Z_PK
            WHERE m.ZCHATSESSION=? AND m.ZMESSAGETYPE IN ({','.join(map(str, types))})"""
    args = [pk]
    if not a.all:
        q += " AND m.ZISFROMME=0"
    if a.date:
        q += f" AND date(m.ZMESSAGEDATE+{APPLE_EPOCH},'unixepoch','localtime')=?"
        args.append(a.date)
    else:
        q += " AND m.ZMESSAGEDATE>?"
        args.append(time.time() - a.days * 86400 - APPLE_EPOCH)
    rows = con.execute(q + " ORDER BY m.ZMESSAGEDATE, m.Z_PK", args).fetchall()
    if not rows:
        sys.exit(f"No matching files in the chat '{name}'.")
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-")
    stamp = a.date or dt.date.today().isoformat()
    out = os.path.expanduser(a.out or f"~/Movies/WhatsApp-{slug}-{stamp}")
    os.makedirs(out, exist_ok=True)
    done, missing = [], 0
    for n, (rel, _) in enumerate(rows, 1):
        src = os.path.join(BASE, "Message", rel) if rel else ""
        if not rel or not os.path.isfile(src):
            missing += 1  # not downloaded in WhatsApp yet: tap it once there
            continue
        dst = os.path.join(out, f"{slug}-{stamp}-{n:02d}{os.path.splitext(src)[1].lower()}")
        if not os.path.exists(dst):
            shutil.copy2(src, dst)
        done.append(dst)
    mb = sum(os.path.getsize(p) for p in done) / 1e6
    print(f"{len(done)} files ({mb:.0f} MB) from '{name}' in {out}" + (f"; {missing} not downloaded in WhatsApp yet" if missing else ""))
    if a.photos is not None and done:
        album = a.photos or f"WhatsApp {name} {stamp}"
        subprocess.run(["open", "-ga", "Photos"], check=True)
        for _ in range(15):  # Photos needs a few seconds before it accepts commands
            if subprocess.run(["osascript", "-e", 'tell application "Photos" to count of albums'], capture_output=True).returncode == 0:
                break
            time.sleep(2)
        script = '''on run argv
  set albumName to item 1 of argv
  set theFiles to {}
  repeat with i from 2 to count of argv
    set end of theFiles to (POSIX file (item i of argv)) as alias
  end repeat
  tell application "Photos"
    with timeout of 900 seconds
      if exists album albumName then
        set theAlbum to album albumName
      else
        set theAlbum to make new album named albumName
      end if
      set imported to import theFiles into theAlbum with skip check duplicates
      return "imported: " & (count of imported) & ", in album '" & albumName & "': " & (count of media items of theAlbum)
    end timeout
  end tell
end run'''
        r = subprocess.run(["osascript", "-", album] + done, input=script, capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("chats")
    c.add_argument("--days", type=int, default=14)
    e = sub.add_parser("export")
    e.add_argument("chat")
    e.add_argument("--date")
    e.add_argument("--days", type=int, default=1)
    e.add_argument("--images", action="store_true")
    e.add_argument("--all", action="store_true")
    e.add_argument("--out")
    e.add_argument("--photos", nargs="?", const="")
    a = p.parse_args()
    chats(a.days) if a.cmd == "chats" else export(a)
