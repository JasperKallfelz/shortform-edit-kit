#!/usr/bin/env python3
"""Liest und prüft die Skript-Datei eines Videoprojekts (skript.json).

Die Datei sagt zwei Dingen: was gesprochen wird (für den Teleprompter der Aufnahme-Seite und für die Wort-Ausrichtung) und unter
welchem Schlüssel jede Sprechphrase in src/timing.ts landet (die Schlüssel, die der Code des Videos verwendet).

Aufbau:
{
  "sprache": "en",              Sprache der Aufnahme (Whisper-Kürzel, z. B. "de", "en")
  "datei": "vo.wav",            Name der fertigen Voiceover-Datei unter public/
  "ausklangMs": 640,            Zeit nach dem letzten Wort bis zum Videoende
  "zeilen": [                   eine Zeile = ein Satz oder Satzteil, so wie er auf dem Teleprompter steht
    { "hinweis": "Szene 1",     optional: steht links neben der Zeile und als Kommentar in timing.ts
      "phrasen": [
        { "key": "thisIs", "text": "this is" },             key = Name in timing.ts, text = gesprochene Wörter
        { "key": "yourHook", "text": "your hook,", "anzeige": "your *hook* |" }   anzeige (optional) = Text für den Teleprompter
      ] }
  ]
}
Der Wert eines Schlüssels ist später der Beginn des ERSTEN Wortes seiner Phrase in Millisekunden.
Anzeige-Zeichen: *betont*, | kurzer Atemzug, || längere Pause, ^ Stimme geht hoch, ~ Stimme fällt. Sie wirken nur auf dem Bildschirm.
"""
import json
import re
import sys

SCHLUESSEL = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")


def norm(wort: str) -> str:
    """Wort → Kleinbuchstaben ohne Satzzeichen ("I'm," → "im"), so vergleicht die Ausrichtung Skript und Gehörtes."""
    return re.sub(r"[^\w]", "", wort.lower().replace("_", ""))


def tokens(text: str):
    """Text → Liste normierter Wörter; Bindestriche trennen Wörter (co-founders → co, founders)."""
    return [t for t in (norm(x) for x in re.split(r"[\s\-–—]+", text)) if t]


def lade(pfad: str) -> dict:
    try:
        with open(pfad, encoding="utf-8") as f:
            s = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"FEHLER: Skript-Datei nicht gefunden: {pfad}\n  Eine skript.json im Projektordner anlegen (Aufbau: siehe tonstudio/README.md) oder --skript <datei> angeben.")
    except json.JSONDecodeError as e:
        raise SystemExit(f"FEHLER: {pfad} ist kein gültiges JSON ({e}).")
    fehler = []
    if not isinstance(s.get("zeilen"), list) or not s["zeilen"]:
        raise SystemExit(f"FEHLER: {pfad}: \"zeilen\" fehlt oder ist leer.")
    gesehen = set()
    for zi, z in enumerate(s["zeilen"], 1):
        if not isinstance(z.get("phrasen"), list) or not z["phrasen"]:
            fehler.append(f"Zeile {zi}: \"phrasen\" fehlt oder ist leer")
            continue
        for p in z["phrasen"]:
            k, t = p.get("key"), p.get("text")
            if not isinstance(k, str) or not SCHLUESSEL.match(k):
                fehler.append(f"Zeile {zi}: Schlüssel {k!r} ist kein gültiger Name (Buchstaben, Ziffern, _ ; kein Leerzeichen, nicht mit Ziffer beginnen)")
            elif k in gesehen:
                fehler.append(f"Schlüssel \"{k}\" kommt mehrfach vor")
            gesehen.add(k)
            if not isinstance(t, str) or not tokens(t):
                fehler.append(f"Schlüssel {k!r}: \"text\" fehlt oder enthält keine Wörter")
    if fehler:
        raise SystemExit(f"FEHLER in {pfad}:\n  " + "\n  ".join(fehler))
    s.setdefault("sprache", "en")
    s.setdefault("datei", "vo.wav")
    s.setdefault("ausklangMs", 640)
    return s


def phrasen(s: dict):
    """Alle Phrasen in Sprechreihenfolge: [{key, text, wort0, n, zeile}], wort0 = Index des ersten Wortes im Gesamttext."""
    out, i = [], 0
    for zi, z in enumerate(s["zeilen"]):
        for p in z["phrasen"]:
            n = len(tokens(p["text"]))
            out.append({"key": p["key"], "text": p["text"], "wort0": i, "n": n, "zeile": zi})
            i += n
    return out


def alle_woerter(s: dict):
    """Gesamttext als Liste normierter Wörter, in Sprechreihenfolge."""
    return [t for z in s["zeilen"] for p in z["phrasen"] for t in tokens(p["text"])]


if __name__ == "__main__":
    sk = lade(sys.argv[1])
    ph = phrasen(sk)
    print(f"{sk['datei']}, Sprache {sk['sprache']}, {len(ph)} Phrasen, {len(alle_woerter(sk))} Wörter")
