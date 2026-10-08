#!/usr/bin/env python3
"""Writes src/timing.ts from the phrase times of the alignment (align.py) and the script (script.json).

The file always has the same shape: `VO.file` (audio file under public/), `VO.endMs` (length of the video) and `VO.w` with one
entry per key from the script. The video code reads only this file – a new take produces a new file, and picture, text and
sounds move along by themselves."""
import json
import os
import re
import shutil

import script as sc

MARKER = "Generated automatically"


def is_generated(path: str) -> bool:
    try:
        with open(path, encoding="utf-8") as f:
            return MARKER in f.read(600)
    except FileNotFoundError:
        return True  # nothing there, nothing to back up


def generate(s: dict, times: list, speech_end_ms: int, file: str, source: str, overrides: dict = None) -> str:
    ph = sc.phrases(s)
    end = int(round((speech_end_ms + int(s["tailMs"])) / 50.0) * 50)  # tail after the last word
    rows = []
    for li, line in enumerate(s["lines"]):
        mine = [(p, t) for p, t in zip(ph, times) if p["line"] == li]
        text = re.sub(r"\s+", " ", " ".join(p["text"] for p in line["phrases"])).strip()
        head = f'{line["note"]}: ' if line.get("note") else ""
        rows.append(f'    // {head}"{text}"')
        rows.append("    " + " ".join(f"{p['key']}: {t}," for p, t in mine))
    manual = ""
    if overrides:
        manual = "// Set by hand (--set): " + ", ".join(f"{k}={v}" for k, v in overrides.items()) + "\n"
    return f'''// Voiceover timings – the only place where times are stored.
// {MARKER} (voice-studio/vo/vo.py) – do not edit by hand, align a new take instead: npm run vo -- recordings/<take>.wav
// A single wrong time can be overridden when calling it with --set <key>=<ms>.
// Source: {source}
{manual}// Each number = start of the phrase in milliseconds from the start of the audio file. Phrases directly after a speech pause are
// pulled to the measured onset, the others come from the text alignment (median of several Whisper models).
export const VO = {{
  /** Audio file under public/ ("" = no voiceover) */
  file: {json.dumps(file, ensure_ascii=False)},
  /** Length of the video in ms (the last word ends at {speech_end_ms} ms, followed by the tail) */
  endMs: {end},
  w: {{
{chr(10).join(rows)}
  }},
}};
'''


def write(target: str, text: str, backup: str):
    """Writes timing.ts. A hand-written file is copied once to `backup` first."""
    if os.path.exists(target) and not is_generated(target) and not os.path.exists(backup):
        os.makedirs(os.path.dirname(backup) or ".", exist_ok=True)
        shutil.copyfile(target, backup)
        print(f"The hand-written {os.path.basename(target)} was backed up: {os.path.relpath(backup)}")
    os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        f.write(text)
