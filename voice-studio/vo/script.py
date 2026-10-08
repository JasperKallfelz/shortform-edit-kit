#!/usr/bin/env python3
"""Reads and validates the script file of a video project (script.json).

The file says two things: what is spoken (for the teleprompter on the recorder page and for the word alignment) and under which
key each spoken phrase ends up in src/timing.ts (the keys that the video code uses).

Structure:
{
  "language": "en",             language of the recording (Whisper code, e.g. "de", "en")
  "file": "vo.wav",             name of the finished voiceover file under public/
  "tailMs": 640,                time from the last word to the end of the video
  "lines": [                    one line = one sentence or clause, as it appears on the teleprompter
    { "note": "Scene 1",        optional: shown left of the line and as a comment in timing.ts
      "phrases": [
        { "key": "thisIs", "text": "this is" },             key = name in timing.ts, text = spoken words
        { "key": "yourHook", "text": "your hook,", "display": "your *hook* |" }   display (optional) = text for the teleprompter
      ] }
  ]
}
The value of a key later is the start of the FIRST word of its phrase, in milliseconds.
Display marks: *stressed*, | short breath, || longer pause, ^ voice goes up, ~ voice falls. They only affect the screen.
"""
import json
import re
import sys

KEY_PATTERN = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")


def norm(word: str) -> str:
    """Word → lowercase without punctuation ("I'm," → "im"); this is how the alignment compares script and heard words."""
    return re.sub(r"[^\w]", "", word.lower().replace("_", ""))


def tokens(text: str):
    """Text → list of normalized words; hyphens separate words (co-founders → co, founders)."""
    return [t for t in (norm(x) for x in re.split(r"[\s\-–—]+", text)) if t]


def load(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            s = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"ERROR: script file not found: {path}\n  Create a script.json in the project folder (structure: see voice-studio/README.md) or pass --script <file>.")
    except json.JSONDecodeError as e:
        raise SystemExit(f"ERROR: {path} is not valid JSON ({e}).")
    errors = []
    if not isinstance(s.get("lines"), list) or not s["lines"]:
        raise SystemExit(f"ERROR: {path}: \"lines\" is missing or empty.")
    seen = set()
    for li, line in enumerate(s["lines"], 1):
        if not isinstance(line.get("phrases"), list) or not line["phrases"]:
            errors.append(f"Line {li}: \"phrases\" is missing or empty")
            continue
        for p in line["phrases"]:
            k, t = p.get("key"), p.get("text")
            if not isinstance(k, str) or not KEY_PATTERN.match(k):
                errors.append(f"Line {li}: key {k!r} is not a valid name (letters, digits, _ ; no spaces, must not start with a digit)")
            elif k in seen:
                errors.append(f"Key \"{k}\" appears more than once")
            seen.add(k)
            if not isinstance(t, str) or not tokens(t):
                errors.append(f"Key {k!r}: \"text\" is missing or contains no words")
    if errors:
        raise SystemExit(f"ERROR in {path}:\n  " + "\n  ".join(errors))
    s.setdefault("language", "en")
    s.setdefault("file", "vo.wav")
    s.setdefault("tailMs", 640)
    return s


def phrases(s: dict):
    """All phrases in speaking order: [{key, text, word0, n, line}], word0 = index of the first word in the full text."""
    out, i = [], 0
    for li, line in enumerate(s["lines"]):
        for p in line["phrases"]:
            n = len(tokens(p["text"]))
            out.append({"key": p["key"], "text": p["text"], "word0": i, "n": n, "line": li})
            i += n
    return out


def all_words(s: dict):
    """Full text as a list of normalized words, in speaking order."""
    return [t for line in s["lines"] for p in line["phrases"] for t in tokens(p["text"])]


if __name__ == "__main__":
    script = load(sys.argv[1])
    ph = phrases(script)
    print(f"{script['file']}, language {script['language']}, {len(ph)} phrases, {len(all_words(script))} words")
