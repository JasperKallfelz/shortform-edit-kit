#!/usr/bin/env python3
"""Ersetzt exakt gefundene Textstellen in einer Datei auf dem Main Mac – nur wenn die Datei noch den erwarteten md5 hat.
Aufruf: patch_lines.py <datei> <erwarteter md5> <json mit [[alt, neu], ...]>"""
import hashlib, json, sys
path, want, swaps = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3], encoding="utf-8"))
raw = open(path, "rb").read()
got = hashlib.md5(raw).hexdigest()
if got != want:
    sys.exit(f"ABBRUCH: {path} hat sich geändert ({got} statt {want}) – nichts geschrieben.")
t = raw.decode("utf-8")
for old, new in swaps:
    if t.count(old) != 1:
        sys.exit(f"ABBRUCH: Stelle nicht eindeutig ({t.count(old)}x), nichts geschrieben:\n{old}")
    t = t.replace(old, new)
open(path, "w", encoding="utf-8").write(t)
print("geschrieben, neuer md5:", hashlib.md5(t.encode("utf-8")).hexdigest())
