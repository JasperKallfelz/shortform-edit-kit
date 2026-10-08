#!/usr/bin/env python3
"""Re-measure the effects-only track and the full mix: level per section, gaps without effects, effects against the music, loudness.

  sound_check.py <sfx.wav> [--music song.wav --music-start 0.0 --music-vol 0.15] [--mix mix.wav]
                 [--section 2.0] [--gap 0.5]

<sfx.wav> is the render of the effects only (in `example/`):
  npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
<mix.wav> is the render with everything (`npx remotion render Demo mix.wav --codec=wav`).

What is checked:
- per section the level of the effects and their peak
- gaps: stretches without effects that are longer than --gap seconds
- with --music: the loudest 0.4 s spot of the effects against the music at the same spot (target: about equally loud, not above)
  and the peaks of both tracks. --music-start is the spot in the song where the video starts, --music-vol is the volume control in the video.
- with --mix: loudness (LUFS) and true peak (dBTP) of the full mix (target: at most -14 LUFS, peak at most -1 dBTP)

Needs numpy, soundfile, librosa (only with --music) and ffmpeg (only with --mix).
"""
import argparse
import re
import subprocess

import numpy as np
import soundfile as sf

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("sfx")
p.add_argument("--music")
p.add_argument("--music-start", type=float, default=0.0)
p.add_argument("--music-vol", type=float, default=0.15)
p.add_argument("--mix")
p.add_argument("--section", type=float, default=2.0)
p.add_argument("--gap", type=float, default=0.5)
a = p.parse_args()

db = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)
pk = lambda x: 20 * np.log10(np.abs(x).max() + 1e-12)

y, sr = sf.read(a.sfx, always_2d=True)
y = y.mean(axis=1)
dur = len(y) / sr
print(f"Effects: {dur:.2f} s, peak {pk(y):.1f} dBFS")

print(f"Level per {a.section:g} s:")
for s in np.arange(0, dur, a.section):
    seg = y[int(s * sr):int(min(dur, s + a.section) * sr)]
    if len(seg):
        silent = np.abs(seg).max() < 1e-4
        print(f"  {s:5.1f}–{min(dur, s + a.section):5.1f} s  " + ("no effect" if silent else f"{db(seg):6.1f} dB, peak {pk(seg):6.1f} dBFS"))

# Gaps: 20 ms grid, "active" = peak above -60 dBFS
n = int(0.02 * sr)
active = np.array([np.abs(y[i:i + n]).max() > 1e-3 for i in range(0, len(y), n)])
gaps, start = [], 0
for i, on in enumerate(np.append(active, True)):
    if on:
        if (i - start) * 0.02 > a.gap:
            gaps.append((start * 0.02, i * 0.02))
        start = i + 1
print(f"Gaps over {a.gap:g} s without effect: " + (", ".join(f"{s:.2f}–{e:.2f} s" for s, e in gaps) if gaps else "none"))

if a.music:
    import librosa

    mu, _ = librosa.load(a.music, sr=sr, mono=True, offset=a.music_start, duration=dur)
    mu = mu * a.music_vol
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
    print(f"Music (volume {a.music_vol:g}, from song position {a.music_start:g} s): level {db(mu[:m]):.1f} dB, peak {pk(mu[:m]):.1f} dBFS")
    if best:
        print(f"Effects against music: loudest 0.4 s spot {best[0]:+.1f} dB at {best[1]:.2f} s (0 = equally loud, positive = effects louder)")

if a.mix:
    r = subprocess.run(["ffmpeg", "-nostats", "-i", a.mix, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    t = r[r.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", t)
    tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", t)
    if i and tp:
        print(f"Full mix: {i.group(1)} LUFS, peak {tp.group(1)} dBTP")
    else:
        print("Full mix: ffmpeg returned no measurement")
