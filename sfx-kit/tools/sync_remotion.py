#!/usr/bin/env python3
"""Bringt das Kit in ein Remotion-Projekt: kopiert sounds/*.wav nach <projekt>/public/sfx und schreibt den Katalog
(SOUNDS in <projekt>/src/lib/sfx.tsx) aus catalogue.json neu. Dateien in public/sfx, die nicht mehr im Kit sind,
wandern nach <projekt>/unused/sfx-verworfen.

Aufruf: python3 sync_remotion.py <projekt> [erwarteter md5 von src/lib/sfx.tsx]
Mit md5 bricht das Skript ab, ohne zu schreiben, wenn jemand anderes die Datei inzwischen geändert hat.
Läuft mit dem System-Python (nur Standardbibliothek; die Gruppen liest es aus prepare_sfx.py, ohne es zu importieren).
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
    sys.exit("GROUPS nicht in prepare_sfx.py gefunden")


def main():
    project = os.path.expanduser(sys.argv[1])
    want = sys.argv[2] if len(sys.argv) > 2 else None
    path = os.path.join(project, "src", "lib", "sfx.tsx")
    raw = open(path, "rb").read()
    got = hashlib.md5(raw).hexdigest()
    if want and got != want:
        sys.exit(f"ABBRUCH: {path} hat sich geändert ({got} statt {want}) – nichts geschrieben.")
    cat = json.load(open(os.path.join(KIT, "catalogue.json")))
    listed = [n for _, names in groups() for n in names]
    if sorted(listed) != sorted(cat):
        sys.exit(f"ABBRUCH: GROUPS und catalogue.json passen nicht zusammen: {sorted(set(listed) ^ set(cat))}")
    lines = []
    for title, names in groups():
        lines.append(f"  // {title}")
        lines += [f'  {n}: {{ file: "sfx/{n}.wav", len: {cat[n]["len"]}, lead: {cat[n]["lead"]}, loud: {cat[n]["loud"]} }},' for n in names]
    t = raw.decode("utf-8")
    if t.count(START) != 1:
        sys.exit("ABBRUCH: SOUNDS-Block nicht eindeutig gefunden.")
    a = t.index(START)
    b = t.index(END, a) + len(END)
    t = t[:a] + START + "\n" + "\n".join(lines) + "\n" + END + t[b:]
    sfx_dir = os.path.join(project, "public", "sfx")
    gone = os.path.join(project, "unused", "sfx-verworfen")
    os.makedirs(sfx_dir, exist_ok=True)
    for fn in sorted(os.listdir(sfx_dir)):
        if fn.endswith(".wav") and fn[:-4] not in cat:
            os.makedirs(gone, exist_ok=True)
            shutil.move(os.path.join(sfx_dir, fn), os.path.join(gone, fn))
    for n in cat:
        shutil.copyfile(os.path.join(KIT, "sounds", f"{n}.wav"), os.path.join(sfx_dir, f"{n}.wav"))
    open(path, "w", encoding="utf-8").write(t)
    print(f"{len(cat)} Sounds im Projekt, neuer md5 von sfx.tsx: {hashlib.md5(t.encode('utf-8')).hexdigest()}")


if __name__ == "__main__":
    main()
