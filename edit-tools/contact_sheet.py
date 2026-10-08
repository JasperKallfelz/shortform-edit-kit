#!/usr/bin/env python3
"""Contact sheet from a folder full of videos: one thumbnail per file, numbered, plus length and format as a list.
This is how you find the clip for a still frame or sort new material.

  contact_sheet.py <folder> [--at 1.0] [--out contact.jpg] [--columns 6]

Needs ffmpeg/ffprobe and Pillow.
"""
import argparse
import glob
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw

p = argparse.ArgumentParser()
p.add_argument("folder")
p.add_argument("--at", type=float, default=1.0)
p.add_argument("--out")
p.add_argument("--columns", type=int, default=6)
a = p.parse_args()
files = sorted(f for ext in ("mp4", "mov", "m4v", "MOV", "MP4") for f in glob.glob(os.path.join(a.folder, f"*.{ext}")))
W, H = 220, 220
sheet = Image.new("RGB", (a.columns * W, ((len(files) + a.columns - 1) // a.columns) * H), "white")
d = ImageDraw.Draw(sheet)
with tempfile.TemporaryDirectory() as tmp:
    for i, f in enumerate(files):
        info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.split()
        thumb = os.path.join(tmp, f"{i}.jpg")
        for at in (a.at, 0):  # very short clips have no frame at 1 s
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", f, "-frames:v", "1", "-vf", "scale=320:-2", thumb], capture_output=True)
            if os.path.exists(thumb):
                break
        x, y = (i % a.columns) * W, (i // a.columns) * H
        if os.path.exists(thumb):
            im = Image.open(thumb)
            im.thumbnail((W - 6, H - 22))
            sheet.paste(im, (x + 3, y + 18))
        d.text((x + 4, y + 3), f"{i + 1:02d}", fill="black")
        print(f"{i + 1:02d}  {os.path.basename(f)}  {' '.join(info)}")
out = a.out or os.path.join(a.folder, "contact.jpg")
sheet.save(out, quality=85)
print("Contact sheet:", out)
