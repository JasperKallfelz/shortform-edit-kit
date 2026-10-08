#!/usr/bin/env python3
"""Replaces exactly matched text passages in a file – only if the file still has the expected md5.
Usage: patch_lines.py <file> <expected md5> <json with [[old, new], ...]>"""
import hashlib, json, sys
if len(sys.argv) != 4 or sys.argv[1] in ("-h", "--help"):
    sys.exit(__doc__)
path, want, swaps = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3], encoding="utf-8"))
raw = open(path, "rb").read()
got = hashlib.md5(raw).hexdigest()
if got != want:
    sys.exit(f"ABORT: {path} has changed ({got} instead of {want}) – nothing written.")
t = raw.decode("utf-8")
for old, new in swaps:
    if t.count(old) != 1:
        sys.exit(f"ABORT: passage not unique ({t.count(old)}x), nothing written:\n{old}")
    t = t.replace(old, new)
open(path, "w", encoding="utf-8").write(t)
print("written, new md5:", hashlib.md5(t.encode("utf-8")).hexdigest())
