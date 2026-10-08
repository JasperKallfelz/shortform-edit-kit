#!/usr/bin/env python3
"""Musik-Einstieg finden, bei dem ein Schlag des Songs genau auf ein Wort des Voiceovers fällt.

  beat_align.py <song.wav> <src/timing.ts> <wort> [--auch wort,wort,…] [--max-start 120] [--fps 30] [--top 6]

<wort> ist ein Schlüssel aus `VO.w` in timing.ts (das Wort, auf dem der Schlag sitzen soll). Mit --auch nennt man weitere
Wörter (zum Beispiel die, auf denen Schnitte liegen); für sie wird nur gezeigt, wie weit der nächste Schlag entfernt ist.

Ausgabe je Kandidat: Einstieg in den Song (s), die Songstelle, die auf dem Wort landet, wie kräftig der Schlag dort ist
(Vielfaches des mittleren Einsatzes) und der Abstand zum nächsten Schlag je Wort in ms. Der Einstieg rastet auf ganze Frames.

So benutzt man das Ergebnis: Die Songstelle als Konstante ins Projekt schreiben und den Einstieg daraus berechnen
(Songstelle minus Wortzeit). Dann bleibt der Schlag bei einem neuen Take von selbst auf dem Wort.

Ein Schlagabstand von 350 ms heißt: ein beliebiger Zeitpunkt liegt im Mittel knapp 90 ms neben dem nächsten Schlag. Schnitte,
die am Voiceover hängen, treffen den Beat also nur zufällig. Im Bericht nennen, welche Wörter sitzen und welche nicht.

Braucht numpy und librosa.
"""
import argparse
import re

import librosa
import numpy as np

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("song")
p.add_argument("timing")
p.add_argument("wort")
p.add_argument("--auch", default="")
p.add_argument("--max-start", type=float, default=120.0)
p.add_argument("--fps", type=int, default=30)
p.add_argument("--top", type=int, default=6)
a = p.parse_args()

src = open(a.timing, encoding="utf-8").read()
w = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", src[src.index("w: {"):])}
others = [k for k in a.auch.split(",") if k]
for k in [a.wort, *others]:
    if k not in w:
        raise SystemExit(f"„{k}“ steht nicht in VO.w von {a.timing}. Vorhanden: {', '.join(w)}")

y, sr = librosa.load(a.song, sr=22050, mono=True)
hop = 256
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, units="time")
tempo = float(np.atleast_1d(tempo)[0])
ot = librosa.frames_to_time(np.arange(len(oenv)), sr=sr, hop_length=hop)
print(f"Song: {len(y) / sr:.1f} s, {tempo:.1f} BPM, Schlagabstand {60000 / tempo:.0f} ms, {len(beats)} Schläge")

key = w[a.wort] / 1000
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
print(f"Schlag auf „{a.wort}“ ({w[a.wort]} ms):")
for _, start, d_key, hit, d in res:
    if any(abs(start - s) < 1.0 for s in seen):
        continue
    seen.append(start)
    rest = "  ".join(f"{k} {v * 1000:.0f}" for k, v in d.items())
    print(f"  Einstieg {start:7.3f} s | Songstelle {start + key:7.3f} s | Schlag {hit:4.1f}× | {a.wort} {d_key * 1000:.0f} ms" + (f" | {rest}" if rest else ""))
    if len(seen) >= a.top:
        break
if not seen:
    print("  kein Einstieg gefunden, bei dem ein Schlag näher als 20 ms am Wort liegt")
