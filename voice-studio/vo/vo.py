#!/usr/bin/env python3
"""Aus einem aufgenommenen Take das Voiceover des Videos und die Zeit-Tabelle machen.

  npm run vo -- recordings/take.wav            (im Projektordner; ruft dieses Skript auf)

Schritte:
  1. Stücke zusammensetzen (bei nur einem Take: der ganze Take)
  2. aufbereiten (master.py): Klang, Kompressor, Pegel −14 LUFS im Video  → public/<datei aus skript.json>
  3. ausrichten (align.py): Beginn jeder Phrase, mehrere Whisper-Modelle, Einrasten auf gemessene Sprechpausen
  4. src/timing.ts schreiben (retime.py)
Erst wenn die Ausrichtung gelungen ist, werden public/ und src/timing.ts überschrieben.

Eingabe: take.wav        ganzer Take
         take.wav:von_ms:bis_ms[:gain_db]   nur ein Stück (bis_ms = -1 → bis zum Ende); mehrere Stücke werden hintereinander gesetzt,
                          z. B. den Anfang aus Take 3 und den Rest aus Take 5. Schnitte in eine Sprechpause legen (kurze Blenden sind drin).
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
import skript as sk  # noqa: E402

SR = 48000


def lade_mono(pfad: str) -> np.ndarray:
    roh = subprocess.run(["ffmpeg", "-v", "error", "-i", pfad, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    if not roh:
        raise SystemExit(f"FEHLER: {pfad} lässt sich nicht lesen (keine Audiodatei?).")
    return np.frombuffer(roh, dtype=np.float32).astype(np.float64)


def blende(x: np.ndarray, n_ein: int, n_aus: int) -> np.ndarray:
    x = x.copy()
    if n_ein:
        x[:n_ein] *= np.linspace(0, 1, n_ein)
    if n_aus:
        x[-n_aus:] *= np.linspace(1, 0, n_aus)
    return x


def stueck_lesen(spec: str):
    """"datei" oder "datei:von:bis[:gain]" → (datei, von_ms, bis_ms, gain_db). Doppelpunkte im Pfad stören nicht (von rechts gelesen)."""
    if os.path.exists(spec):
        return spec, 0.0, -1.0, 0.0
    teile = spec.rsplit(":", 3)
    try:
        if len(teile) == 4 and os.path.exists(teile[0]):
            return teile[0], float(teile[1]), float(teile[2]), float(teile[3])
        teile = spec.rsplit(":", 2)
        if len(teile) == 3 and os.path.exists(teile[0]):
            return teile[0], float(teile[1]), float(teile[2]), 0.0
    except ValueError:
        pass
    raise SystemExit(f"FEHLER: Eingabe nicht gefunden oder nicht lesbar: {spec}\n  Format: datei.wav  oder  datei.wav:von_ms:bis_ms[:gain_db]")


def zusammensetzen(specs, ziel: str) -> str:
    """Setzt die Stücke zu einer Mono-WAV (24 Bit, 48 kHz) zusammen. Gibt eine Herkunftsbeschreibung (nur Dateinamen) zurück."""
    teile, herkunft = [], []
    for i, spec in enumerate(specs):
        datei, von, bis, gain = stueck_lesen(spec)
        x = lade_mono(datei)
        a = int(von * SR / 1000)
        b = len(x) if bis < 0 else int(bis * SR / 1000)
        if not 0 <= a < b <= len(x):
            raise SystemExit(f"FEHLER: {spec}: Bereich {von}–{bis} ms liegt außerhalb der Aufnahme ({len(x) * 1000 // SR} ms).")
        seg = x[a:b] * 10 ** (gain / 20)
        letztes = i == len(specs) - 1
        if len(specs) > 1:  # nur beim Zusammensetzen blenden, ein ganzer Take bleibt unangetastet
            seg = blende(seg, int(0.012 * SR), 0 if letztes else int(0.015 * SR))
        print(f"  Stück {i + 1}: {os.path.basename(datei)} {a * 1000 // SR}–{b * 1000 // SR} ms, {gain:+.1f} dB → beginnt im Ergebnis bei {sum(len(t) for t in teile) * 1000 // SR} ms")
        teile.append(seg)
        beschr = os.path.basename(datei)
        if bis >= 0 or von > 0:
            beschr += f" (ab {int(von)} ms)" if bis < 0 else f" ({int(von)}–{int(bis)} ms)"
        herkunft.append(beschr)
    y = np.concatenate(teile)
    if float(np.max(np.abs(y))) > 1.0:
        raise SystemExit("FEHLER: Die Aufnahme übersteuert (Werte über 0 dBFS nach der Verstärkung). gain_db senken.")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", ziel], input=y.astype(np.float32).tobytes(), check=True)
    return " + ".join(herkunft)


def setze_lesen(liste):
    out = {}
    for x in liste or []:
        if "=" not in x:
            raise SystemExit(f"FEHLER: --setze {x}: erwartet <schlüssel>=<ms>, z. B. --setze hello=1500")
        k, v = x.split("=", 1)
        try:
            out[k.strip()] = int(float(v))
        except ValueError:
            raise SystemExit(f"FEHLER: --setze {x}: \"{v}\" ist keine Zahl (Millisekunden).")
    return out


def main():
    ap = argparse.ArgumentParser(description="Take → Voiceover in public/ + Zeit-Tabelle src/timing.ts", formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("eingabe", nargs="+", help="take.wav oder take.wav:von_ms:bis_ms[:gain_db] (mehrere Stücke werden zusammengesetzt)")
    ap.add_argument("--projekt", default=".", help="Projektordner (Standard: aktueller Ordner)")
    ap.add_argument("--skript", default="skript.json", help="Skript-Datei, relativ zum Projekt (Standard: skript.json)")
    ap.add_argument("--zeiten", default="src/timing.ts", help="Zeit-Tabelle, die geschrieben wird (Standard: src/timing.ts)")
    ap.add_argument("--public", default="public", help="Ordner für die fertige Audiodatei (Standard: public)")
    ap.add_argument("--kette", default="neutral", choices=sorted(master.EQ), help="Klang-Variante der Aufbereitung (Standard: neutral)")
    ap.add_argument("--modelle", default="", help="Whisper-Modelldateien (ggml-*.bin), durch Komma getrennt; sonst Umgebungsvariable TONSTUDIO_MODELLE")
    ap.add_argument("--setze", action="append", metavar="SCHLÜSSEL=MS", help="einen Zeitwert von Hand überschreiben (wiederholbar)")
    ap.add_argument("--erlaube-abweichung", action="store_true", help="Wörter, die Whisper anders zählt als das Skript, überspringen (Zeiten dort geschätzt)")
    a = ap.parse_args()

    projekt = os.path.abspath(a.projekt)
    rel = lambda p: p if os.path.isabs(p) else os.path.join(projekt, p)  # noqa: E731
    if not shutil.which("ffmpeg"):
        raise SystemExit("FEHLER: ffmpeg nicht gefunden (macOS: `brew install ffmpeg`).")
    s = sk.lade(rel(a.skript))
    whisper = align.finde_whisper()
    modelle = align.finde_modelle(a.modelle)
    setze = setze_lesen(a.setze)
    for k in setze:
        if k not in [p["key"] for p in sk.phrasen(s)]:
            raise SystemExit(f"FEHLER: --setze {k}: den Schlüssel gibt es im Skript nicht.")

    with tempfile.TemporaryDirectory() as tmp:
        print("1/4 Stücke zusammensetzen")
        roh = os.path.join(tmp, "roh.wav")
        herkunft = zusammensetzen(a.eingabe, roh)
        print("2/4 Aufbereiten")
        fertig = os.path.join(tmp, os.path.basename(s["datei"]))
        master.master(roh, fertig, a.kette)
        print(f"3/4 Ausrichten ({len(modelle)} Modell{'e' if len(modelle) != 1 else ''})")
        res = align.ausrichten(fertig, s, modelle, whisper, a.erlaube_abweichung)
        zeiten = align.phrasenzeiten(res, s, setze)
        print(align.bericht(res, s, zeiten))
        print("4/4 Schreiben")
        ziel_audio = os.path.join(rel(a.public), s["datei"])
        os.makedirs(os.path.dirname(ziel_audio), exist_ok=True)
        shutil.copyfile(fertig, ziel_audio)
        text = retime.erzeuge(s, zeiten, res["sprechEndeMs"], s["datei"], f"{herkunft}; aufbereitet mit voice-studio/vo/master.py ({a.kette})", setze)
        retime.schreibe(rel(a.zeiten), text, os.path.join(projekt, "recordings", "timing-handgeschrieben.ts"))
        erste = stueck_lesen(a.eingabe[0])[0]
        try:
            with open(os.path.splitext(erste)[0] + ".ausrichtung.json", "w", encoding="utf-8") as f:
                json.dump(res, f, indent=1, ensure_ascii=False)
        except OSError:
            pass
    print(f"\nFertig: {os.path.relpath(ziel_audio, projekt)} und {os.path.relpath(rel(a.zeiten), projekt)} geschrieben.")
    print("Ansehen: npm run dev   (Studio neu laden) oder  npx remotion render <Komposition> out/video.mp4")


if __name__ == "__main__":
    main()
