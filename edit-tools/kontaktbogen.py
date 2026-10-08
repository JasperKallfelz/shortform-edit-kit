#!/usr/bin/env python3
"""Kontaktbogen aus einem Ordner voller Videos: ein Vorschaubild je Datei, nummeriert, dazu Länge und Format als Liste.
Damit findet man den Clip zu einem Standbild oder sortiert neues Material.

  kontaktbogen.py <ordner> [--at 1.0] [--out kontakt.jpg] [--spalten 6]

Braucht ffmpeg/ffprobe und Pillow.
"""
import argparse
import glob
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument("ordner")
p.add_argument("--at", type=float, default=1.0)
p.add_argument("--out")
p.add_argument("--spalten", type=int, default=6)
a = p.parse_args()
files = sorted(f for ext in ("mp4", "mov", "m4v", "MOV", "MP4") for f in glob.glob(os.path.join(a.ordner, f"*.{ext}")))
W, H = 220, 220
sheet = Image.new("RGB", (a.spalten * W, ((len(files) + a.spalten - 1) // a.spalten) * H), "white")
d = ImageDraw.Draw(sheet)
with tempfile.TemporaryDirectory() as tmp:
    for i, f in enumerate(files):
        info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.split()
        thumb = os.path.join(tmp, f"{i}.jpg")
        for at in (a.at, 0):  # sehr kurze Clips haben bei 1 s kein Bild mehr
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", f, "-frames:v", "1", "-vf", "scale=320:-2", thumb], capture_output=True)
            if os.path.exists(thumb):
                break
        x, y = (i % a.spalten) * W, (i // a.spalten) * H
        if os.path.exists(thumb):
            im = Image.open(thumb)
            im.thumbnail((W - 6, H - 22))
            sheet.paste(im, (x + 3, y + 18))
        d.text((x + 4, y + 3), f"{i + 1:02d}", fill="black")
        print(f"{i + 1:02d}  {os.path.basename(f)}  {' '.join(info)}")
out = a.out or os.path.join(a.ordner, "kontakt.jpg")
sheet.save(out, quality=85)
print("Kontaktbogen:", out)
