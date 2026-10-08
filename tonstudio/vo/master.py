#!/usr/bin/env python3
"""Aufbereitung einer rohen Sprachaufnahme zu einem fertigen Voiceover.

Kette: Klang (EQ) → Phasendrehung → Kompressor (zähmt laut betonte Wörter) → Pegel auf Ziel-Lautheit → Begrenzer (fängt Restspitzen).
Kein automatisches Nachregeln (loudnorm im Dynamikmodus): die Lautheit wird gemessen und mit festem Faktor eingestellt, damit der
Verlauf der Aufnahme erhalten bleibt.

Zwei Klang-Varianten (EQ):
  neutral  Trittschall weg (Hochpass 75 Hz) und etwas weniger Mulm (−1,5 dB bei 250 Hz). Sonst bleibt die Stimme, wie sie ist.
           Gut für ein Mikrofon, das schon gut klingt (z. B. dynamisches Sprechmikrofon).
  tief     mehr Körper für helle oder dünne Stimmen: Hochpass 90 Hz, +5 dB bei 140 Hz (Bass dort, wo bei vielen Männerstimmen der
           Grundton liegt), −2,5 dB bei 330 Hz (Mulm), +0,8 dB bei 3,2 kHz (Präsenz). Unter 90 Hz wird abgesenkt statt angehoben,
           dort sitzen nur Plosiv-Stöße. Liegt der Grundton der Stimme höher oder tiefer, die Frequenz 140 anpassen.

Alle Varianten: zwei Allpässe drehen die Phase so, dass die Sprach-Wellenform symmetrischer wird (Spitzen etwa 2,5 dB niedriger,
Klang unverändert); Kompressor Schwelle −18 dB, Verhältnis 3,5:1; Begrenzer-Decke −1,8 dBFS.

Ergebnis: Zweikanal-WAV (links = rechts, 16 Bit / 48 kHz) mit −14 LUFS im Video, echte Spitze höchstens −1,5 dBTP. Zweikanal, weil
Remotion eine Mono-Datei beim Verteilen auf zwei Kanäle um 3 dB senkt; eine Zweikanal-Datei geht unverändert durch.
Gerechnet wird mit −17 LUFS je Kanal. Beides wird am Ergebnis nachgemessen; wird ein Ziel verfehlt, bricht das Werkzeug ab.

Aufruf: master.py <roh.wav> <ziel.wav> [neutral|tief] [ziel_lufs_je_kanal=-17]
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 48000
# Phasendrehung (siehe oben)
AP = "allpass=f=100:t=q:w=0.7,allpass=f=200:t=q:w=0.7"
# Kein De-Esser: vor der Pegelstufe wäre er wirkungslos; bei scharfen S-Lauten gehört er hinter die Pegelstufe und muss dort nach
# Messung eingestellt werden (der ffmpeg-Filter greift ab i=0.5 sehr steil).
EQ = {
    "neutral": "highpass=f=75:poles=2,equalizer=f=250:t=q:w=1.2:g=-1.5," + AP,
    "tief": "highpass=f=90:poles=2,equalizer=f=140:t=q:w=1.0:g=5,equalizer=f=330:t=q:w=1.2:g=-2.5,equalizer=f=3200:t=q:w=1.0:g=0.8," + AP,
}
COMP = "acompressor=threshold=-18dB:ratio=3.5:attack=4:release=140:detection=peak:makeup=1"
LIMIT_DB = -1.8  # Decke des Begrenzers (Abtastwerte); die echte Spitze liegt bei mäßigem Eingriff etwa 0,1 dB darüber
TP_MAX = -1.5  # erlaubte echte Spitze (dBTP), wird am Ergebnis geprüft
TOL = 0.15  # erlaubte Abweichung von der Ziel-Lautheit (LU)


def run(args, **kw):
    return subprocess.run(args, capture_output=True, **kw)


def loud(path, af=None):
    """(Lautheit LUFS, echte Spitze dBTP, Lautheitsbereich LU) einer Datei, optional nach einer Filterkette."""
    cmd = ["ffmpeg", "-hide_banner", "-i", path, "-af", (af + "," if af else "") + "loudnorm=I=-14:TP=-1.5:print_format=json", "-f", "null", "-"]
    err = run(cmd, text=True).stderr
    try:
        j = json.loads(err[err.rindex("{"):err.rindex("}") + 1])
        return float(j["input_i"]), float(j["input_tp"]), float(j["input_lra"])
    except (ValueError, KeyError):
        raise SystemExit(f"FEHLER: ffmpeg konnte {path} nicht messen:\n{err[-600:]}")


def lade(p, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", p] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(run(cmd).stdout, dtype=np.float32).astype(np.float64)


def master(roh, ziel, kette="neutral", target=-17.0, comp=COMP, verbose=True):
    if kette not in EQ:
        raise SystemExit(f"FEHLER: unbekannte Klang-Variante \"{kette}\" (möglich: {', '.join(EQ)})")
    pre = EQ[kette] + "," + comp
    i0, tp0, _ = loud(roh, pre)
    if i0 < -60:
        raise SystemExit(f"ABBRUCH: Die Aufnahme enthält praktisch kein Signal ({i0:.0f} LUFS). Mikrofon-Freigabe, Stummschaltung oder Gain prüfen.")
    mono = ziel + ".mono.wav"
    limit_db = LIMIT_DB
    try:
        for _versuch in range(5):  # Decke des Begrenzers bei Bedarf absenken, bis die echte Spitze passt
            lim = 10 ** (limit_db / 20)
            gain = target - i0
            for _durchlauf in range(10):  # Pegel nachstellen, bis die Lautheit sitzt (der Begrenzer nimmt etwas weg)
                af = f"{pre},volume={gain:.2f}dB,alimiter=limit={lim:.4f}:attack=3:release=60:level=0:latency=1"
                run(["ffmpeg", "-v", "error", "-y", "-i", roh, "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", mono], check=True)
                i1, tp1, lra1 = loud(mono)
                if abs(i1 - target) < TOL - 0.05:
                    break
                gain += target - i1
            else:
                raise SystemExit(f"ABBRUCH {os.path.basename(ziel)}: Ziel-Lautheit {target:.1f} LUFS je Kanal nicht erreicht (zuletzt {i1:.2f}). Ziel senken oder Aufnahme prüfen.")
            # Zweikanal-Datei schreiben (beide Kanäle identisch, ohne Pegeländerung) und am Ergebnis nachmessen
            run(["ffmpeg", "-v", "error", "-y", "-i", mono, "-af", "pan=stereo|c0=c0|c1=c0", "-c:a", "pcm_s16le", ziel], check=True)
            i_st, tp_st, _ = loud(ziel)
            if tp_st <= TP_MAX:
                break
            limit_db -= (tp_st - TP_MAX) + 0.1
        else:
            raise SystemExit(f"ABBRUCH {os.path.basename(ziel)}: echte Spitze {tp_st:.2f} dBTP liegt über {TP_MAX} dBTP. Ziel-Lautheit senken.")
    finally:
        if os.path.exists(mono):
            os.remove(mono)
    # wie stark greift der Begrenzer?
    x = lade(roh, f"{pre},volume={gain:.2f}dB")
    hop = SR // 100
    pk = np.array([np.abs(x[k * hop:(k + 1) * hop]).max() for k in range(len(x) // hop)])
    ueber = 20 * np.log10(np.maximum(pk, 1e-9) / lim)
    stats = dict(kette=kette, lufs_vorher=i0, tp_vorher=tp0, gain=gain, decke_db=limit_db, lufs=i1, tp=tp1, lra=lra1, lufs_zweikanal=i_st, tp_zweikanal=tp_st,
                 begr_max=float(ueber.max()), begr_ms_1=int((ueber > 1).sum() * 10), begr_ms_3=int((ueber > 3).sum() * 10), begr_ms_6=int((ueber > 6).sum() * 10))
    if verbose:
        print(f"Aufbereitet [{kette}]: nach Klang+Kompressor {i0:.1f} LUFS / {tp0:.1f} dBTP → {gain:+.1f} dB → je Kanal {i1:.2f} LUFS, "
              f"Zweikanal-Datei {i_st:.2f} LUFS, Spitze {tp_st:.2f} dBTP, LRA {lra1:.1f} | Begrenzer (Decke {limit_db:.1f}): max {ueber.max():.1f} dB, "
              f">1 dB {stats['begr_ms_1']} ms, >3 dB {stats['begr_ms_3']} ms, >6 dB {stats['begr_ms_6']} ms")
    return stats


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    master(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "neutral", float(sys.argv[4]) if len(sys.argv) > 4 else -17.0)
