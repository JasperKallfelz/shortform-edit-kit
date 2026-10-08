#!/usr/bin/env python3
"""Brings the kit into a Remotion project: copies sounds/*.wav to <project>/public/sfx and rewrites the catalogue
(SOUNDS in <project>/src/lib/sfx.tsx) from catalogue.json. Files in public/sfx that are no longer in the kit
move to <project>/unused/sfx-discarded.

Usage: python3 sync_remotion.py <project> [expected md5 of src/lib/sfx.tsx]
With the md5, the script aborts without writing if someone else has changed the file in the meantime.
Runs with the system Python (standard library only; it reads the groups from prepare_sfx.py without importing it).
"""
import ast
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, "..")
START, END = "export const SOUNDS = {", "} as const;"


def groups():
    tree = ast.parse(open(os.path.join(HERE, "prepare_sfx.py"), encoding="utf-8").read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "GROUPS":
            return ast.literal_eval(node.value)
    sys.exit("GROUPS not found in prepare_sfx.py")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        sys.exit(__doc__)
    project = os.path.expanduser(sys.argv[1])
    want = sys.argv[2] if len(sys.argv) > 2 else None
    path = os.path.join(project, "src", "lib", "sfx.tsx")
    raw = open(path, "rb").read()
    got = hashlib.md5(raw).hexdigest()
    if want and got != want:
        sys.exit(f"ABORT: {path} has changed ({got} instead of {want}) - nothing written.")
    cat = json.load(open(os.path.join(KIT, "catalogue.json")))
    listed = [n for _, names in groups() for n in names]
    if sorted(listed) != sorted(cat):
        sys.exit(f"ABORT: GROUPS and catalogue.json do not match: {sorted(set(listed) ^ set(cat))}")
    lines = []
    for title, names in groups():
        lines.append(f"  // {title}")
        lines += [f'  {n}: {{ file: "sfx/{n}.wav", len: {cat[n]["len"]}, lead: {cat[n]["lead"]}, loud: {cat[n]["loud"]} }},' for n in names]
    t = raw.decode("utf-8")
    if t.count(START) != 1:
        sys.exit("ABORT: SOUNDS block not found exactly once.")
    a = t.index(START)
    b = t.index(END, a) + len(END)
    t = t[:a] + START + "\n" + "\n".join(lines) + "\n" + END + t[b:]
    sfx_dir = os.path.join(project, "public", "sfx")
    gone = os.path.join(project, "unused", "sfx-discarded")
    os.makedirs(sfx_dir, exist_ok=True)
    for fn in sorted(os.listdir(sfx_dir)):
        if fn.endswith(".wav") and fn[:-4] not in cat:
            os.makedirs(gone, exist_ok=True)
            shutil.move(os.path.join(sfx_dir, fn), os.path.join(gone, fn))
    for n in cat:
        shutil.copyfile(os.path.join(KIT, "sounds", f"{n}.wav"), os.path.join(sfx_dir, f"{n}.wav"))
    open(path, "w", encoding="utf-8").write(t)
    print(f"{len(cat)} sounds in the project, new md5 of sfx.tsx: {hashlib.md5(t.encode('utf-8')).hexdigest()}")


if __name__ == "__main__":
    main()
