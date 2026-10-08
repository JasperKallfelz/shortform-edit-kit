#!/usr/bin/env python3
"""Draw one picture of the whole sound kit: every sound with its name, its waveform and its length.

  python3 sfx-kit/tools/sound_sheet.py [out.png] [--font /path/to/font.ttf]

Reads sfx-kit/catalogue.json and sfx-kit/sounds/*.wav, writes docs/sounds.png by default.
The sounds are grouped by family (camera, clicks, split-flap board, paper, air, keys and pencil, accents).
Needs numpy, soundfile and Pillow.
"""
import argparse
import json
import pathlib

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
KIT = ROOT / "sfx-kit"

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("out", nargs="?", default=str(ROOT / "docs" / "sounds.png"))
p.add_argument("--font", help="TrueType font for the labels (default: a monospace system font if one is found)")
a = p.parse_args()

# family → (colour, name prefixes). The first family whose prefix matches wins.
FAMILIES = [
    ("Camera", "#e1251b", ("shutter", "winder")),
    ("Clicks", "#4b5cf0", ("mouse", "trackpad", "switch", "pen")),
    ("Split-flap board", "#f59e0b", ("flap",)),
    ("Paper and cards", "#12b76a", ("page", "tear", "riffle", "cardPlace")),
    ("Keys and pencil", "#7c3aed", ("key", "typeBurst", "pencil")),
    ("Air", "#0ea5e9", ("swish", "whoosh")),
    ("Accents", "#db2777", ("riser", "tom", "clink", "coinCup")),
]


def family(name):
    # "pencil" must not fall into "pen": longest matching prefix decides
    best = None
    for i, (_, _, prefixes) in enumerate(FAMILIES):
        for pre in prefixes:
            if name.startswith(pre) and (best is None or len(pre) > best[1]):
                best = (i, len(pre))
    return best[0] if best else len(FAMILIES) - 1


def load_font(size):
    candidates = [a.font] if a.font else []
    candidates += ["/System/Library/Fonts/SFNSMono.ttf", "/System/Library/Fonts/Menlo.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "C:/Windows/Fonts/consola.ttf"]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except OSError:
            continue
    return ImageFont.load_default()


catalogue = json.loads((KIT / "catalogue.json").read_text())
names = sorted(catalogue, key=lambda n: (family(n), n))

S = 2  # draw at double size for sharp text
COLS, TW, TH, GAP, PAD, HEAD = 6, 290, 118, 14, 40, 96
rows = -(-len(names) // COLS)
W = PAD * 2 + COLS * TW + (COLS - 1) * GAP
H = PAD + HEAD + rows * TH + (rows - 1) * GAP + PAD + 44
img = Image.new("RGB", (W * S, H * S), "#eef0fb")
d = ImageDraw.Draw(img)
f_title, f_name, f_small = load_font(34 * S), load_font(19 * S), load_font(14 * S)
INK, SOFT = "#1d2033", "#5b607c"

d.text((PAD * S, PAD * S), f"{len(names)} sounds, all real recordings", font=f_title, fill=INK)
# legend
x = PAD * S
for label, colour, _ in FAMILIES:
    d.ellipse((x, (PAD + 56) * S, x + 14 * S, (PAD + 70) * S), fill=colour)
    d.text((x + 22 * S, (PAD + 53) * S), label, font=f_small, fill=SOFT)
    x += int(d.textlength(label, font=f_small)) + 52 * S

BARS = 56
for i, name in enumerate(names):
    col, row = i % COLS, i // COLS
    x0 = (PAD + col * (TW + GAP)) * S
    y0 = (PAD + HEAD + row * (TH + GAP)) * S
    d.rounded_rectangle((x0, y0, x0 + TW * S, y0 + TH * S), radius=16 * S, fill="#ffffff")
    colour = FAMILIES[family(name)][1]
    y, _ = sf.read(KIT / "sounds" / f"{name}.wav", always_2d=True)
    y = np.abs(y.mean(axis=1))
    n = max(1, len(y) // BARS)
    env = np.array([y[k * n : (k + 1) * n].max() if len(y[k * n : (k + 1) * n]) else 0 for k in range(BARS)])
    env = (env / (env.max() or 1)) ** 0.6
    bw = (TW - 36) * S / BARS
    mid = y0 + 44 * S
    for k, v in enumerate(env):
        h = max(2 * S, v * 30 * S)
        bx = x0 + 18 * S + k * bw
        d.rounded_rectangle((bx, mid - h, bx + bw * 0.62, mid + h), radius=int(bw * 0.3), fill=colour)
    d.text((x0 + 18 * S, y0 + 84 * S), name, font=f_name, fill=INK)
    length = f"{catalogue[name]['len'] / 1000:.2f} s"
    d.text((x0 + (TW - 18) * S - d.textlength(length, font=f_small), y0 + 88 * S), length, font=f_small, fill=SOFT)

d.text((PAD * S, (H - PAD - 18) * S), "sfx-kit/sounds/<name>.wav · CC0 or public domain · listen to them all: python3 listen.py", font=f_small, fill=SOFT)
out = pathlib.Path(a.out)
img.resize((W, H), Image.LANCZOS).save(out)
print(f"{len(names)} sounds drawn, {W} x {H} px: {out}")
