#!/usr/bin/env python3
"""Nur-Effekte-Spur und Gesamtmix nachmessen: Pegel je Abschnitt, Lücken ohne Effekt, Effekte gegen die Musik, Lautheit.

  ton_check.py <sfx.wav> [--musik song.wav --musik-start 0.0 --musik-vol 0.15] [--mix mix.wav]
               [--abschnitt 2.0] [--luecke 0.5]

<sfx.wav> ist der Render nur der Effekte (in `example/`):
  npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
<mix.wav> ist der Render mit allem (`npx remotion render Demo mix.wav --codec=wav`).

Was geprüft wird:
- je Abschnitt der Pegel der Effekte und ihre Spitze
- Lücken: Strecken ohne Effekt, die länger sind als --luecke Sekunden
- mit --musik: die lauteste 0,4-s-Stelle der Effekte gegen die Musik an derselben Stelle (Ziel: etwa gleich laut, nicht darüber)
  und die Spitzen beider Spuren. --musik-start ist die Stelle im Song, an der das Video einsetzt, --musik-vol der Regler im Video.
- mit --mix: Lautheit (LUFS) und echte Spitze (dBTP) des Gesamtmixes (Ziel: höchstens −14 LUFS, Spitze höchstens −1 dBTP)

Braucht numpy, soundfile, librosa (nur mit --musik) und ffmpeg (nur mit --mix).
"""
import argparse
import re
import subprocess

import numpy as np
import soundfile as sf

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("sfx")
p.add_argument("--musik")
p.add_argument("--musik-start", type=float, default=0.0)
p.add_argument("--musik-vol", type=float, default=0.15)
p.add_argument("--mix")
p.add_argument("--abschnitt", type=float, default=2.0)
p.add_argument("--luecke", type=float, default=0.5)
a = p.parse_args()

db = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)
pk = lambda x: 20 * np.log10(np.abs(x).max() + 1e-12)

y, sr = sf.read(a.sfx, always_2d=True)
y = y.mean(axis=1)
dur = len(y) / sr
print(f"Effekte: {dur:.2f} s, Spitze {pk(y):.1f} dBFS")

print(f"Pegel je {a.abschnitt:g} s:")
for s in np.arange(0, dur, a.abschnitt):
    seg = y[int(s * sr):int(min(dur, s + a.abschnitt) * sr)]
    if len(seg):
        stumm = np.abs(seg).max() < 1e-4
        print(f"  {s:5.1f}–{min(dur, s + a.abschnitt):5.1f} s  " + ("kein Effekt" if stumm else f"{db(seg):6.1f} dB, Spitze {pk(seg):6.1f} dBFS"))

# Lücken: 20-ms-Raster, „aktiv“ = Spitze über −60 dBFS
n = int(0.02 * sr)
active = np.array([np.abs(y[i:i + n]).max() > 1e-3 for i in range(0, len(y), n)])
gaps, start = [], 0
for i, on in enumerate(np.append(active, True)):
    if on:
        if (i - start) * 0.02 > a.luecke:
            gaps.append((start * 0.02, i * 0.02))
        start = i + 1
print(f"Lücken über {a.luecke:g} s ohne Effekt: " + (", ".join(f"{s:.2f}–{e:.2f} s" for s, e in gaps) if gaps else "keine"))

if a.musik:
    import librosa

    mu, _ = librosa.load(a.musik, sr=sr, mono=True, offset=a.musik_start, duration=dur)
    mu = mu * a.musik_vol
    m = min(len(mu), len(y))
    w, h = int(0.4 * sr), int(0.05 * sr)
    best = None
    for i in range(0, m - w, h):
        e = y[i:i + w]
        if np.abs(e).max() < 1e-3:
            continue
        d = db(e) - db(mu[i:i + w])
        if best is None or d > best[0]:
            best = (d, i / sr)
    print(f"Musik (Regler {a.musik_vol:g}, ab Songstelle {a.musik_start:g} s): Pegel {db(mu[:m]):.1f} dB, Spitze {pk(mu[:m]):.1f} dBFS")
    if best:
        print(f"Effekte gegen Musik: lauteste 0,4-s-Stelle {best[0]:+.1f} dB bei {best[1]:.2f} s (0 = gleich laut, positiv = Effekte lauter)")

if a.mix:
    r = subprocess.run(["ffmpeg", "-nostats", "-i", a.mix, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    t = r[r.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", t)
    tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", t)
    if i and tp:
        print(f"Gesamtmix: {i.group(1)} LUFS, Spitze {tp.group(1)} dBTP")
    else:
        print("Gesamtmix: ffmpeg lieferte keine Messung")
