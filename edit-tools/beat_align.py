#!/usr/bin/env python3
"""Find a music entry point where a beat of the song lands exactly on a word of the voiceover.

  beat_align.py <song.wav> <src/timing.ts> <word> [--also word,word,…] [--max-start 120] [--fps 30] [--top 6]

<word> is a key from `VO.w` in timing.ts (the word the beat should sit on). With --also you name more words
(for example the ones that carry cuts); for them it only shows how far away the nearest beat is.

Output per candidate: entry into the song (s), the song position that lands on the word, how strong the beat is there
(multiple of the median onset strength) and the distance to the nearest beat per word in ms. The entry snaps to whole frames.

How to use the result: write the song position into the project as a constant and compute the entry from it
(song position minus word time). Then the beat stays on the word by itself when you record a new take.

A beat interval of 350 ms means: an arbitrary point in time lies on average just under 90 ms from the nearest beat. Cuts
that hang on the voiceover therefore hit the beat only by chance. In the report, say which words sit on a beat and which do not.

Needs numpy and librosa.
"""
import argparse
import re

import librosa
import numpy as np

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("song")
p.add_argument("timing")
p.add_argument("word")
p.add_argument("--also", default="")
p.add_argument("--max-start", type=float, default=120.0)
p.add_argument("--fps", type=int, default=30)
p.add_argument("--top", type=int, default=6)
a = p.parse_args()

src = open(a.timing, encoding="utf-8").read()
w = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", src[src.index("w: {"):])}
others = [k for k in a.also.split(",") if k]
for k in [a.word, *others]:
    if k not in w:
        raise SystemExit(f"'{k}' is not in VO.w of {a.timing}. Available: {', '.join(w)}")

y, sr = librosa.load(a.song, sr=22050, mono=True)
hop = 256
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, units="time")
tempo = float(np.atleast_1d(tempo)[0])
ot = librosa.frames_to_time(np.arange(len(oenv)), sr=sr, hop_length=hop)
print(f"Song: {len(y) / sr:.1f} s, {tempo:.1f} BPM, beat interval {60000 / tempo:.0f} ms, {len(beats)} beats")

key = w[a.word] / 1000
last = max(0.0, min(a.max_start, len(y) / sr - key - 1))
res = []
for start in np.arange(0, last, 1 / a.fps):
    d_key = float(np.min(np.abs(beats - (start + key))))
    if d_key > 0.02:
        continue
    i = int(np.argmin(np.abs(ot - (start + key))))
    hit = float(oenv[max(0, i - 3):i + 4].max() / (np.median(oenv) + 1e-9))
    d = {k: float(np.min(np.abs(beats - (start + w[k] / 1000)))) for k in others}
    res.append((d_key + sum(d.values()) / (len(d) or 1) - 0.01 * hit, float(start), d_key, hit, d))
res.sort(key=lambda r: r[0])
seen = []
print(f"Beat on '{a.word}' ({w[a.word]} ms):")
for _, start, d_key, hit, d in res:
    if any(abs(start - s) < 1.0 for s in seen):
        continue
    seen.append(start)
    rest = "  ".join(f"{k} {v * 1000:.0f}" for k, v in d.items())
    print(f"  entry {start:7.3f} s | song position {start + key:7.3f} s | beat {hit:4.1f}× | {a.word} {d_key * 1000:.0f} ms" + (f" | {rest}" if rest else ""))
    if len(seen) >= a.top:
        break
if not seen:
    print("  no entry found where a beat is closer than 20 ms to the word")
