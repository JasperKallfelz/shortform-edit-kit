#!/usr/bin/env python3
"""Schreibt src/timing.ts aus den Phrasenzeiten der Ausrichtung (align.py) und dem Skript (skript.json).

Die Datei hat immer dieselbe Gestalt: `VO.file` (Audiodatei unter public/), `VO.endMs` (Länge des Videos) und `VO.w` mit einem
Eintrag je Schlüssel aus dem Skript. Der Code des Videos liest nur diese Datei – ein neuer Take ergibt eine neue Datei, und Bild,
Text und Sounds wandern von selbst mit."""
import json
import os
import re
import shutil

import skript as sk

MARKE = "Automatisch erzeugt"


def ist_erzeugt(pfad: str) -> bool:
    try:
        with open(pfad, encoding="utf-8") as f:
            return MARKE in f.read(600)
    except FileNotFoundError:
        return True  # nichts da, nichts zu sichern


def erzeuge(s: dict, zeiten: list, sprech_ende_ms: int, datei: str, herkunft: str, setze: dict = None) -> str:
    ph = sk.phrasen(s)
    ende = int(round((sprech_ende_ms + int(s["ausklangMs"])) / 50.0) * 50)  # Ausklang nach dem letzten Wort
    zeilen = []
    for zi, z in enumerate(s["zeilen"]):
        mine = [(p, t) for p, t in zip(ph, zeiten) if p["zeile"] == zi]
        text = re.sub(r"\s+", " ", " ".join(p["text"] for p in z["phrasen"])).strip()
        kopf = f'{z["hinweis"]}: ' if z.get("hinweis") else ""
        zeilen.append(f'    // {kopf}"{text}"')
        zeilen.append("    " + " ".join(f"{p['key']}: {t}," for p, t in mine))
    hand = ""
    if setze:
        hand = "// Von Hand gesetzt (--setze): " + ", ".join(f"{k}={v}" for k, v in setze.items()) + "\n"
    return f'''// Zeitpunkte des Voiceovers – die einzige Stelle, an der Zeiten stehen.
// {MARKE} (voice-studio/vo/vo.py) – nicht von Hand ändern, sondern einen neuen Take ausrichten lassen: npm run vo -- recordings/<take>.wav
// Eine einzelne falsche Zeit lässt sich beim Aufruf mit --setze <schlüssel>=<ms> überschreiben.
// Herkunft: {herkunft}
{hand}// Jede Zahl = Beginn der Phrase in Millisekunden ab Start der Audiodatei. Phrasen direkt nach einer Sprechpause sind auf den
// gemessenen Einsatz gezogen, die übrigen stammen aus der Text-Ausrichtung (Median mehrerer Whisper-Modelle).
export const VO = {{
  /** Audiodatei unter public/ ("" = kein Voiceover) */
  file: {json.dumps(datei, ensure_ascii=False)},
  /** Länge des Videos in ms (letztes Wort endet bei {sprech_ende_ms} ms, danach Ausklang) */
  endMs: {ende},
  w: {{
{chr(10).join(zeilen)}
  }},
}};
'''


def schreibe(ziel: str, text: str, sicherung: str):
    """Schreibt die timing.ts. Eine von Hand geschriebene Datei wird vorher einmal nach `sicherung` kopiert."""
    if os.path.exists(ziel) and not ist_erzeugt(ziel) and not os.path.exists(sicherung):
        os.makedirs(os.path.dirname(sicherung) or ".", exist_ok=True)
        shutil.copyfile(ziel, sicherung)
        print(f"Die handgeschriebene {os.path.basename(ziel)} wurde gesichert: {os.path.relpath(sicherung)}")
    os.makedirs(os.path.dirname(ziel) or ".", exist_ok=True)
    with open(ziel, "w", encoding="utf-8") as f:
        f.write(text)
