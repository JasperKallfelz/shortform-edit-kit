#!/usr/bin/env python3
"""Aligns a KNOWN script to a recording and returns the start of each word in ms.

Why not simply use the word times that Whisper outputs while transcribing? The timestamps per word vary between models
and runs by a tenth to half a second (measured: one word stood 560 ms too late, almost at the end of its sentence). So:
  1. Several Whisper models transcribe the recording freely (whisper.cpp, `whisper-cli`). Each returns a DTW time for every
     word piece (Dynamic Time Warping over the attention of the model = the moment at which the piece ends). The end of the previous
     word is the start of the next. For each word, the median over the models is taken.
  2. The recognized words are matched to the script (text comparison). If the number of words differs, the tool aborts
     instead of returning wrong times. A word heard differently with the same word count (proper names!) is harmless.
  3. The speech pauses are determined independently of that, from the loudness. The word directly after a pause is pulled to the
     measured onset – this is the most reliable timing there is.

Standalone call (for trying it out): align.py <audio> <script.json> [report.json] [--models a.bin,b.bin]
"""
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import script as sc  # noqa: E402

SR = 16000  # sample rate for Whisper and for the pause measurement
DTW_PRESETS = {"tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large.v1", "large.v2", "large.v3", "large.v3.turbo"}
PAUSE_MS = 120  # gaps from this length count as a speech pause (shorter ones are mostly stop consonants inside a word: "s|tudy")
STRONG_DB = 16.0  # a section must lie at least once this far above the threshold to count as speech


# ------------------------------------------------------------ Finding tools
def find_whisper() -> str:
    """Path to whisper-cli (whisper.cpp): environment variable WHISPER_CLI or PATH."""
    path = os.environ.get("WHISPER_CLI") or shutil.which("whisper-cli")
    if not path or not os.path.exists(path):
        raise SystemExit("ERROR: `whisper-cli` not found.\n  Install whisper.cpp (macOS: `brew install whisper-cpp`) or give the path in the environment variable WHISPER_CLI.")
    return path


def find_models(arg: str = "") -> list:
    """Model files (ggml-*.bin) from --models or the environment variable VOICE_STUDIO_MODELS (paths, separated by commas)."""
    raw = arg or os.environ.get("VOICE_STUDIO_MODELS", "")
    paths = [os.path.expanduser(p.strip()) for p in raw.split(",") if p.strip()]
    if not paths:
        raise SystemExit("ERROR: No Whisper model given.\n"
                         "  Provide one or more ggml model files from whisper.cpp and pass the path, e.g.\n"
                         "    export VOICE_STUDIO_MODELS=~/whisper/ggml-medium.en.bin,~/whisper/ggml-medium.bin\n"
                         "  or  --models <file>,<file>.  Download: `models/download-ggml-model.sh medium.en` in the whisper.cpp folder.\n"
                         "  Several models make the times more accurate (median); one is enough to start.")
    missing = [p for p in paths if not os.path.isfile(p)]
    if missing:
        raise SystemExit("ERROR: Whisper model not found: " + ", ".join(missing) + "\n  Check the path (VOICE_STUDIO_MODELS or --models).")
    return list(dict.fromkeys(paths))


def dtw_preset(model: str):
    """ggml-medium.en.bin → "medium.en"; ggml-small.en-q5_1.bin → "small.en"; unknown names → None (then DTW is missing)."""
    n = os.path.basename(model)
    n = re.sub(r"^ggml-", "", n)
    n = re.sub(r"\.bin$", "", n)
    n = re.sub(r"-q\d_\w+$", "", n)
    n = re.sub(r"^large-v", "large.v", n).replace("-turbo", ".turbo")
    return n if n in DTW_PRESETS else None


def model_name(model: str) -> str:
    return re.sub(r"\.bin$", "", re.sub(r"^ggml-", "", os.path.basename(model)))


# ------------------------------------------------------------ Audio
def load_audio(path: str) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    if not raw:
        raise SystemExit(f"ERROR: ffmpeg could not read {path}.")
    return np.frombuffer(raw, dtype=np.float32).copy()


def speech_sections(audio: np.ndarray, min_pause_ms: int = PAUSE_MS):
    """Speech sections from the loudness: list [start_ms, end_ms] + noise floor and threshold in dBFS.

    Breaths and room noise lie only a few dB above the threshold (measured 3–13 dB), real speech 30–45 dB, even a single
    "s" still above 20 dB. Runs that never get STRONG_DB above the threshold therefore do not count as speech – otherwise a
    breath before a word would pull the onset of that word forward."""
    hop, win = int(0.005 * SR), int(0.020 * SR)
    n = max(1, (len(audio) - win) // hop)
    # RMS per 20 ms window, every 5 ms (via a cumulative sum of the squares, fast even for long recordings)
    csum = np.concatenate([[0.0], np.cumsum(audio.astype(np.float64) ** 2)])
    begin = np.arange(n) * hop
    db = 10 * np.log10((csum[begin + win] - csum[begin]) / win + 1e-18)
    noise = float(np.percentile(db, 5))
    loud = float(np.percentile(db, 95))
    threshold = max(noise + 12.0, loud - 38.0)
    high = threshold + STRONG_DB
    active = db > threshold
    runs, i = [], 0
    while i < n:
        if active[i]:
            j = i
            while j < n and active[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    segs = [[i * 5, j * 5 + 15] for i, j in runs if db[i:j].max() >= high]  # weak runs (breaths) drop out here
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_pause_ms:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    merged = [s for s in merged if s[1] - s[0] >= 60]  # ignore clicks
    # If a breath runs into a word without a gap (or hangs on the end of a word), at most 150 ms of lead-in or 250 ms of tail around
    # the loud windows counts as part of the section. Normal word beginnings and endings are shorter and stay untouched.
    out = []
    for a, b in merged:
        fi, fj = a // 5, min(n, max(a // 5 + 1, (b - 15) // 5))
        strong = np.nonzero(db[fi:fj] >= high)[0]
        if len(strong):
            a = max(a, (fi + int(strong[0])) * 5 - 150)
            b = min(b, (fi + int(strong[-1])) * 5 + 15 + 250)
        out.append([int(a), int(b)])
    if not out:
        raise SystemExit("ABORT: No speech was found in the recording (only silence or noise). Check the microphone, the level and the file.")
    return out, noise, threshold


# ------------------------------------------------------------ Whisper
def transcribe(whisper: str, model: str, wav16: str, language: str, workdir: str) -> list:
    """Lets a model transcribe the recording freely. Result: words [{raw, norm, begin, end, p}] in speaking order (ms).
    With DTW times (the normal case): a word begins where the previous one, including punctuation, ends; `end` is the end of the last
    sound piece. Without DTW (model name unknown) the timestamps of the pieces themselves serve as the start – this is less accurate."""
    preset = dtw_preset(model)
    if ".en" in os.path.basename(model) and language != "en":
        raise SystemExit(f"ERROR: {os.path.basename(model)} only understands English, but the script language is \"{language}\". Use a multilingual model (without .en in the name).")
    base = os.path.join(workdir, model_name(model))
    cmd = [whisper, "-m", model, "-f", wav16, "-l", language, "-ojf", "-of", base, "-np"]
    cmd += ["-dtw", preset, "-nfa"] if preset else ["-ml", "1", "-sow"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(base + ".json"):
        raise SystemExit(f"ERROR: whisper-cli ({os.path.basename(model)}) failed:\n{(r.stderr or r.stdout)[-800:]}")
    with open(base + ".json", encoding="utf-8") as f:
        j = json.load(f)
    raw = []
    for seg in j["transcription"]:
        for t in seg["tokens"]:
            text = t["text"]
            if text.startswith("[_"):  # control tokens of the model ([_BEG_], [_TT_55] …)
                continue
            start, stop = t["offsets"]["from"], t["offsets"]["to"]
            dtw = t["t_dtw"] * 10 if preset and t.get("t_dtw", -1) >= 0 else None  # DTW time = end of the piece, in 10 ms units
            voiced = bool(sc.norm(text))
            # New word if the piece begins with a space and is a word itself; punctuation and word remnants attach to the previous one
            if not raw or (text.startswith(" ") and voiced):
                raw.append({"raw": text.strip(), "t0": start, "tend": stop, "end": dtw if dtw is not None else stop, "bound": dtw if dtw is not None else stop, "ps": [t["p"]] if voiced else []})
            else:
                raw[-1]["raw"] += text
                raw[-1]["bound"] = dtw if dtw is not None else stop
                if voiced:
                    raw[-1]["end"] = dtw if dtw is not None else stop
                    raw[-1]["tend"] = stop
                    raw[-1]["ps"].append(t["p"])
    raw = [w for w in raw if sc.norm(w["raw"])]
    if not raw:
        raise SystemExit(f"ABORT: {os.path.basename(model)} recognized no words in the recording. Check the level (too quiet?) and the language in script.json (\"language\").")
    out = []
    for k, w in enumerate(raw):
        if preset:
            begin = raw[k - 1]["bound"] if k > 0 else None
            end = w["end"]
        else:
            begin = w["t0"]
            end = min(w["tend"], raw[k + 1]["t0"]) if k + 1 < len(raw) else w["tend"]
        out.append({"raw": w["raw"], "norm": sc.norm(w["raw"]), "begin": begin, "end": end, "p": float(np.mean(w["ps"])) if w["ps"] else 0.0})
    return out


# ------------------------------------------------------------ Matching script ↔ heard words
def match_words(want: list, heard: list):
    """Matches every script word to a heard word. Result: (mapping, mismatches, heard_differently).
    mapping[i] = (j, fraction) → script word i begins at heard word j, `fraction` (0–1) of its duration later (only for words
    written together or apart, "co-founders" ↔ "cofounders"); None = cannot be matched."""
    mapping = [None] * len(want)
    mismatches, differently = [], []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=want, b=heard, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                mapping[i1 + k] = (j1 + k, 0.0)
        elif tag == "replace" and (i2 - i1) == (j2 - j1):  # same number of words, but heard differently (proper names etc.): position by position
            for k in range(i2 - i1):
                mapping[i1 + k] = (j1 + k, 0.0)
                differently.append((want[i1 + k], heard[j1 + k]))
        elif "".join(want[i1:i2]) == "".join(heard[j1:j2]):  # only split differently ("co founders" ↔ "cofounders")
            if j2 - j1 == 1:  # script splits, Whisper writes together: start proportionally (by letters) within the heard word
                total, before = sum(len(x) for x in want[i1:i2]), 0
                for k in range(i1, i2):
                    mapping[k] = (j1, before / total)
                    before += len(want[k])
            elif i2 - i1 == 1:  # script writes together, Whisper splits: start of the first heard part
                mapping[i1] = (j1, 0.0)
        else:
            mismatches.append({"script": " ".join(want[max(0, i1 - 2):i2 + 2]), "heard": " ".join(heard[max(0, j1 - 2):j2 + 2]), "difference": (j2 - j1) - (i2 - i1)})
    return mapping, mismatches, differently


# ------------------------------------------------------------ Alignment
def align_script(audio_path: str, s: dict, models: list, whisper: str, allow_mismatch: bool = False, verbose: bool = True) -> dict:
    want = sc.all_words(s)
    n = len(want)
    audio = load_audio(audio_path)
    duration_ms = int(round(len(audio) / SR * 1000))
    segs, noise, threshold = speech_sections(audio)
    starts, ends, heard_text, estimated, p_all, differently_all = {}, {}, {}, set(), {}, {}
    with tempfile.TemporaryDirectory() as tmp:
        wav16 = os.path.join(tmp, "audio16k.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", audio_path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", wav16], check=True)
        for m in models:
            name = model_name(m)
            if verbose:
                print(f"  transcribing: {name}" + ("" if dtw_preset(m) else "  (warning: name not known → no DTW times, less accurate word times)"), flush=True)
            h = transcribe(whisper, m, wav16, s["language"], tmp)
            heard = [w["norm"] for w in h]
            heard_text[name] = " ".join(w["raw"] for w in h)
            mapping, mismatches, differently = match_words(want, heard)
            if mismatches and not allow_mismatch:
                rows = "\n".join(f"    Script: …{d['script']}…   heard: …{d['heard']}…   ({d['difference']:+d} words)" for d in mismatches)
                raise SystemExit(f"ABORT: The recording differs from the script ({len(heard)} heard words, {len(want)} in the script), according to {name}:\n{rows}\n"
                                 f"  heard: {heard_text[name]}\n"
                                 "  Either adapt the script to what was spoken (script.json) or record again. Words that Whisper merely writes differently\n"
                                 "  (numbers, proper names with a different word count) can be skipped with --allow-mismatch; the times there are then\n"
                                 "  estimated and should be checked with --set <key>=<ms>.")
            st = np.full(n, np.nan)
            en = np.full(n, np.nan)
            for i, z in enumerate(mapping):
                if z is None:
                    continue
                j, fraction = z
                b = h[j]["begin"]
                st[i] = np.nan if b is None else b + fraction * (h[j]["end"] - b)
                en[i] = h[j]["end"]
            starts[name], ends[name] = st, en
            p_all[name] = np.array([h[z[0]]["p"] if z else np.nan for z in mapping])
            differently_all[name] = differently
            estimated |= {i for i, z in enumerate(mapping) if z is None}
    names = [model_name(m) for m in models]
    st_m = np.array([starts[k] for k in names])  # models × words
    en_m = np.array([ends[k] for k in names])
    with warnings.catch_warnings(), np.errstate(all="ignore"):
        warnings.simplefilter("ignore")  # "All-NaN slice": expected for words without a match, they are estimated below
        start = np.nanmedian(st_m, axis=0)
        end = np.nanmedian(en_m, axis=0)
        spread = np.nanmax(st_m, axis=0) - np.nanmin(st_m, axis=0)
        prob = np.nanmean(np.array([p_all[k] for k in names]), axis=0)
    start[0] = segs[0][0]  # the recording begins with the first word: onset of the first speech
    # words that cannot be matched (only with --allow-mismatch): estimate linearly by letters between the neighbours
    missing = [i for i in range(n) if np.isnan(start[i])]
    for i in missing:
        estimated.add(i)
    if missing:
        known = [i for i in range(n) if not np.isnan(start[i])]
        for i in missing:
            before = max((b for b in known if b < i), default=0)
            after = min((b for b in known if b > i), default=None)
            t0 = start[before]
            t1 = start[after] if after is not None else segs[-1][1]
            between = list(range(before, (after if after is not None else n)))
            total = sum(len(want[k]) for k in between) or 1
            start[i] = t0 + (t1 - t0) * sum(len(want[k]) for k in between if k < i) / total
            end[i] = start[i] + (t1 - t0) * len(want[i]) / total
    # Snapping: The start of the speech section after a pause belongs to the word that begins there. Candidates are the first two
    # words that, according to the alignment, are still sounding after the onset. The word must not begin deep inside the previous section (then
    # the pause has nothing to do with it, e.g. a stop consonant) and not implausibly late after the onset.
    snapped = [False] * n
    snapped[0] = True
    last = 0
    for k in range(1, len(segs)):
        a = segs[k][0]
        prev_end = segs[k - 1][1]
        candidates = [i for i in range(last + 1, n) if end[i] > a + 40][:2]
        for i in candidates:
            if prev_end - 250 <= start[i] <= a + 400:
                start[i] = a
                snapped[i] = True
                last = i
                break
    for i in range(1, n):  # keep strictly ascending
        start[i] = max(start[i], start[i - 1] + 10)
    words = []
    for i, tok in enumerate(want):
        words.append({
            "i": i, "word": tok,
            "start": int(round(float(start[i]) / 10) * 10),
            "afterPause": bool(snapped[i]),
            "spreadMs": 0 if np.isnan(spread[i]) else int(round(float(spread[i]))),
            "p": 0.0 if np.isnan(prob[i]) else round(float(prob[i]), 2),
            "estimated": i in estimated,
            "models": {k: (None if np.isnan(starts[k][i]) else int(round(float(starts[k][i])))) for k in names},
        })
    return {
        "file": os.path.basename(audio_path),
        "durationMs": duration_ms,
        "noiseFloorDb": round(noise, 1),
        "thresholdDb": round(threshold, 1),
        "sections": segs,
        "speechEndMs": int(segs[-1][1]),
        "models": names,
        "heard": heard_text,
        "heardDifferently": {k: [{"script": a, "heard": b} for a, b in v] for k, v in differently_all.items()},
        "words": words,
    }


def phrase_times(res: dict, s: dict, overrides: dict = None) -> list:
    """Start of each phrase (ms). `overrides` = {key: ms} overrides single values by hand. Strictly ascending, otherwise abort."""
    ph = sc.phrases(s)
    times = [res["words"][p["word0"]]["start"] for p in ph]
    for k, ms in (overrides or {}).items():
        i = next((i for i, p in enumerate(ph) if p["key"] == k), None)
        if i is None:
            raise SystemExit(f"ERROR: --set {k}={ms}: the key \"{k}\" does not exist in the script (available: {', '.join(p['key'] for p in ph)}).")
        times[i] = int(ms)
    for i in range(1, len(times)):
        if times[i] <= times[i - 1]:
            raise SystemExit(f"ABORT: Times not ascending: {ph[i - 1]['key']}={times[i - 1]} ms, {ph[i]['key']}={times[i]} ms. With --set, mind the order of the keys.")
    return times


def report(res: dict, s: dict, times: list) -> str:
    ph = sc.phrases(s)
    head = f"{res['file']}: {res['durationMs']} ms, noise floor {res['noiseFloorDb']} dBFS, {len(res['sections'])} speech sections: {res['sections']}\n"
    head += f"Models: {', '.join(res['models'])}\n"
    z = [f"{'Key':<12} {'Start ms':>9}  {'Word':<12} {'Pause':<6} {'Spread':>8}  {'P':>4}   " + "  ".join(f"{m:>12}" for m in res["models"])]
    for p, t in zip(ph, times):
        w = res["words"][p["word0"]]
        flag = ""
        if w["estimated"]:
            flag = "   <-- ESTIMATED (word not matched), check"
        elif w["spreadMs"] > 150 and not w["afterPause"]:
            flag = "   <-- models disagree, check"
        z.append(f"{p['key']:<12} {t:>9}  {w['word']:<12} {'●' if w['afterPause'] else '':<6} {w['spreadMs']:>8}  {w['p']:>4.2f}   " + "  ".join(f"{(w['models'][m] if w['models'][m] is not None else '–'):>12}" for m in res["models"]) + flag)
    differently = {k: v for k, v in res["heardDifferently"].items() if v}
    extra = ""
    if differently:
        extra = "\nHeard differently (same word count, so harmless): " + "; ".join(f"{k}: " + ", ".join(f"{a}→{b}" for a, b in [(x['script'], x['heard']) for x in v]) for k, v in differently.items())
    return head + "\n".join(z) + extra


if __name__ == "__main__":
    # --models a.bin,b.bin and --models=a.bin,b.bin both work; the value must never slip through as the report path
    raw, args, flags, i = sys.argv[1:], [], {}, 0
    while i < len(raw):
        a = raw[i]
        if a.startswith("--") and "=" in a:
            k, v = a[2:].split("=", 1)
            flags[k] = v
        elif a == "--models" and i + 1 < len(raw):
            flags["models"] = raw[i + 1]
            i += 1
        elif not a.startswith("--"):
            args.append(a)
        i += 1
    if len(args) < 2 or any(p.endswith(".bin") for p in args):
        raise SystemExit("Usage: align.py <audio> <script.json> [report.json] [--models a.bin,b.bin]")
    if len(args) < 2:
        raise SystemExit(__doc__)
    script = sc.load(args[1])
    mods = find_models(flags.get("models", ""))
    r = align_script(args[0], script, mods, find_whisper(), allow_mismatch="--allow-mismatch" in sys.argv)
    pt = phrase_times(r, script)
    print(report(r, script, pt))
    if len(args) > 2:
        with open(args[2], "w", encoding="utf-8") as f:
            json.dump(r, f, indent=1, ensure_ascii=False)
