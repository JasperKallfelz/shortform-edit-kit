#!/usr/bin/env python3
"""Turns a recorded take into the voiceover of the video and the timing table.

  npm run vo -- recordings/take.wav            (in the project folder; calls this script)

Steps:
  1. assemble pieces (with only one take: the whole take)
  2. master (master.py): tone, compressor, level -14 LUFS in the video  → public/<file from script.json>
  3. align (align.py): start of each phrase, several Whisper models, snapping to measured speech pauses
  4. write src/timing.ts (retime.py)
public/ and src/timing.ts are only overwritten once the alignment has succeeded.

Input: take.wav        whole take
       take.wav:from_ms:to_ms[:gain_db]   only a piece (to_ms = -1 → to the end); several pieces are placed one after the other,
                          e.g. the beginning of take 3 and the rest of take 5. Put the cuts in a speech pause (short crossfades are built in).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import align  # noqa: E402
import master  # noqa: E402
import retime  # noqa: E402
import script as sc  # noqa: E402

SR = 48000


def load_mono(path: str) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    if not raw:
        raise SystemExit(f"ERROR: {path} cannot be read (not an audio file?).")
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def fade(x: np.ndarray, n_in: int, n_out: int) -> np.ndarray:
    x = x.copy()
    if n_in:
        x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out:
        x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


def read_piece(spec: str):
    """"file" or "file:from:to[:gain]" → (file, from_ms, to_ms, gain_db). Colons in the path do not matter (read from the right)."""
    if os.path.exists(spec):
        return spec, 0.0, -1.0, 0.0
    parts = spec.rsplit(":", 3)
    try:
        if len(parts) == 4 and os.path.exists(parts[0]):
            return parts[0], float(parts[1]), float(parts[2]), float(parts[3])
        parts = spec.rsplit(":", 2)
        if len(parts) == 3 and os.path.exists(parts[0]):
            return parts[0], float(parts[1]), float(parts[2]), 0.0
    except ValueError:
        pass
    raise SystemExit(f"ERROR: input not found or not readable: {spec}\n  Format: file.wav  or  file.wav:from_ms:to_ms[:gain_db]")


def assemble(specs, target: str) -> str:
    """Puts the pieces together into one mono WAV (24 bit, 48 kHz). Returns a description of the origin (file names only)."""
    parts, origin = [], []
    for i, spec in enumerate(specs):
        file, start, stop, gain = read_piece(spec)
        x = load_mono(file)
        a = int(start * SR / 1000)
        b = len(x) if stop < 0 else int(stop * SR / 1000)
        if not 0 <= a < b <= len(x):
            raise SystemExit(f"ERROR: {spec}: range {start}–{stop} ms is outside the recording ({len(x) * 1000 // SR} ms).")
        seg = x[a:b] * 10 ** (gain / 20)
        is_last = i == len(specs) - 1
        if len(specs) > 1:  # crossfade only when assembling, a whole take stays untouched
            seg = fade(seg, int(0.012 * SR), 0 if is_last else int(0.015 * SR))
        print(f"  Piece {i + 1}: {os.path.basename(file)} {a * 1000 // SR}–{b * 1000 // SR} ms, {gain:+.1f} dB → starts at {sum(len(t) for t in parts) * 1000 // SR} ms in the result")
        parts.append(seg)
        descr = os.path.basename(file)
        if stop >= 0 or start > 0:
            descr += f" (from {int(start)} ms)" if stop < 0 else f" ({int(start)}–{int(stop)} ms)"
        origin.append(descr)
    y = np.concatenate(parts)
    if float(np.max(np.abs(y))) > 1.0:
        raise SystemExit("ERROR: The recording clips (values above 0 dBFS after the gain). Lower gain_db.")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", target], input=y.astype(np.float32).tobytes(), check=True)
    return " + ".join(origin)


def read_overrides(items):
    out = {}
    for x in items or []:
        if "=" not in x:
            raise SystemExit(f"ERROR: --set {x}: expected <key>=<ms>, e.g. --set hello=1500")
        k, v = x.split("=", 1)
        try:
            out[k.strip()] = int(float(v))
        except ValueError:
            raise SystemExit(f"ERROR: --set {x}: \"{v}\" is not a number (milliseconds).")
    return out


def main():
    ap = argparse.ArgumentParser(description="Take → voiceover in public/ + timing table src/timing.ts", formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("input", nargs="+", help="take.wav or take.wav:from_ms:to_ms[:gain_db] (several pieces are assembled)")
    ap.add_argument("--project", default=".", help="project folder (default: current folder)")
    ap.add_argument("--script", default="script.json", help="script file, relative to the project (default: script.json)")
    ap.add_argument("--timing", default="src/timing.ts", help="timing table that is written (default: src/timing.ts)")
    ap.add_argument("--public", default="public", help="folder for the finished audio file (default: public)")
    ap.add_argument("--chain", default="neutral", choices=sorted(master.EQ), help="tone variant of the mastering (default: neutral)")
    ap.add_argument("--models", default="", help="Whisper model files (ggml-*.bin), separated by commas; otherwise the environment variable VOICE_STUDIO_MODELS")
    ap.add_argument("--set", action="append", metavar="KEY=MS", help="override a single time value by hand (repeatable)")
    ap.add_argument("--allow-mismatch", action="store_true", help="skip words that Whisper counts differently from the script (times there are estimated)")
    a = ap.parse_args()

    project = os.path.abspath(a.project)
    rel = lambda p: p if os.path.isabs(p) else os.path.join(project, p)  # noqa: E731
    if not shutil.which("ffmpeg"):
        raise SystemExit("ERROR: ffmpeg not found (macOS: `brew install ffmpeg`).")
    s = sc.load(rel(a.script))
    whisper = align.find_whisper()
    models = align.find_models(a.models)
    overrides = read_overrides(a.set)
    for k in overrides:
        if k not in [p["key"] for p in sc.phrases(s)]:
            raise SystemExit(f"ERROR: --set {k}: the key does not exist in the script.")

    with tempfile.TemporaryDirectory() as tmp:
        print("1/4 Assemble pieces")
        raw = os.path.join(tmp, "raw.wav")
        origin = assemble(a.input, raw)
        print("2/4 Master")
        done = os.path.join(tmp, os.path.basename(s["file"]))
        master.master(raw, done, a.chain)
        print(f"3/4 Align ({len(models)} model{'s' if len(models) != 1 else ''})")
        res = align.align_script(done, s, models, whisper, a.allow_mismatch)
        times = align.phrase_times(res, s, overrides)
        print(align.report(res, s, times))
        print("4/4 Write")
        target_audio = os.path.join(rel(a.public), s["file"])
        os.makedirs(os.path.dirname(target_audio), exist_ok=True)
        shutil.copyfile(done, target_audio)
        text = retime.generate(s, times, res["speechEndMs"], s["file"], f"{origin}; mastered with voice-studio/vo/master.py ({a.chain})", overrides)
        retime.write(rel(a.timing), text, os.path.join(project, "recordings", "timing-handwritten.ts"))
        first = read_piece(a.input[0])[0]
        try:
            with open(os.path.splitext(first)[0] + ".alignment.json", "w", encoding="utf-8") as f:
                json.dump(res, f, indent=1, ensure_ascii=False)
        except OSError:
            pass
    print(f"\nDone: {os.path.relpath(target_audio, project)} and {os.path.relpath(rel(a.timing), project)} written.")
    print("View: npm run dev   (reload the studio) or  npx remotion render <composition> out/video.mp4")


if __name__ == "__main__":
    main()
