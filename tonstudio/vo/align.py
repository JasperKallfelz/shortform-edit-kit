#!/usr/bin/env python3
"""Richtet ein BEKANNTES Skript an einer Aufnahme aus und liefert den Beginn jedes Wortes in ms.

Warum nicht einfach die Wortzeiten, die Whisper beim Mitschreiben ausgibt? Die Zeitstempel pro Wort schwanken zwischen Modellen
und Durchläufen um Zehntel- bis halbe Sekunden (gemessen: ein Wort stand 560 ms zu spät, fast am Ende seines Satzes). Deshalb:
  1. Mehrere Whisper-Modelle hören die Aufnahme frei ab (whisper.cpp, `whisper-cli`). Jedes liefert für jedes Wort-Stück eine
     DTW-Zeit (Dynamic Time Warping über die Aufmerksamkeit des Modells = Zeitpunkt, an dem das Stück endet). Das Ende des vorigen
     Wortes ist der Beginn des nächsten. Pro Wort wird über die Modelle der Median genommen.
  2. Die erkannten Wörter werden dem Skript zugeordnet (Text-Vergleich). Weicht die Zahl der Wörter ab, bricht das Werkzeug ab,
     statt falsche Zeiten zu liefern. Ein anders gehörtes Wort bei gleicher Wortzahl (Eigennamen!) ist unkritisch.
  3. Die Sprechpausen werden unabhängig davon aus der Lautstärke bestimmt. Das Wort direkt nach einer Pause wird auf den
     gemessenen Einsatz gezogen – das ist die verlässlichste Zeitangabe überhaupt.

Eigenständiger Aufruf (zum Ausprobieren): align.py <audio> <skript.json> [bericht.json] [--modelle a.bin,b.bin]
"""
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import skript as sk  # noqa: E402

SR = 16000  # Abtastrate für Whisper und für die Pausen-Messung
DTW_PRESETS = {"tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large.v1", "large.v2", "large.v3", "large.v3.turbo"}
PAUSE_MS = 120  # Lücken ab dieser Länge zählen als Sprechpause (kürzere sind meist Verschlusslaute mitten im Wort: "s|tudy")
STRONG_DB = 16.0  # so weit über der Schwelle muss ein Abschnitt mindestens einmal liegen, um als Sprache zu zählen


# ------------------------------------------------------------ Werkzeuge finden
def finde_whisper() -> str:
    """Pfad zu whisper-cli (whisper.cpp): Umgebungsvariable WHISPER_CLI oder PATH."""
    pfad = os.environ.get("WHISPER_CLI") or shutil.which("whisper-cli")
    if not pfad or not os.path.exists(pfad):
        raise SystemExit("FEHLER: `whisper-cli` nicht gefunden.\n  whisper.cpp installieren (macOS: `brew install whisper-cpp`) oder den Pfad in der Umgebungsvariable WHISPER_CLI angeben.")
    return pfad


def finde_modelle(arg: str = "") -> list:
    """Modell-Dateien (ggml-*.bin) aus --modelle oder der Umgebungsvariable TONSTUDIO_MODELLE (Pfade, durch Komma getrennt)."""
    roh = arg or os.environ.get("TONSTUDIO_MODELLE", "")
    pfade = [os.path.expanduser(p.strip()) for p in roh.split(",") if p.strip()]
    if not pfade:
        raise SystemExit("FEHLER: Kein Whisper-Modell angegeben.\n"
                         "  Eine oder mehrere ggml-Modelldateien von whisper.cpp bereitstellen und den Pfad übergeben, z. B.\n"
                         "    export TONSTUDIO_MODELLE=~/whisper/ggml-medium.en.bin,~/whisper/ggml-medium.bin\n"
                         "  oder  --modelle <datei>,<datei>.  Download: `models/download-ggml-model.sh medium.en` im Ordner von whisper.cpp.\n"
                         "  Mehrere Modelle machen die Zeiten genauer (Median); eines reicht zum Anfangen.")
    fehlt = [p for p in pfade if not os.path.isfile(p)]
    if fehlt:
        raise SystemExit("FEHLER: Whisper-Modell nicht gefunden: " + ", ".join(fehlt) + "\n  Pfad prüfen (TONSTUDIO_MODELLE bzw. --modelle).")
    return list(dict.fromkeys(pfade))


def dtw_preset(modell: str):
    """ggml-medium.en.bin → "medium.en"; ggml-small.en-q5_1.bin → "small.en"; unbekannte Namen → None (dann fehlt DTW)."""
    n = os.path.basename(modell)
    n = re.sub(r"^ggml-", "", n)
    n = re.sub(r"\.bin$", "", n)
    n = re.sub(r"-q\d_\w+$", "", n)
    n = re.sub(r"^large-v", "large.v", n).replace("-turbo", ".turbo")
    return n if n in DTW_PRESETS else None


def modell_name(modell: str) -> str:
    return re.sub(r"\.bin$", "", re.sub(r"^ggml-", "", os.path.basename(modell)))


# ------------------------------------------------------------ Audio
def lade_audio(pfad: str) -> np.ndarray:
    roh = subprocess.run(["ffmpeg", "-v", "error", "-i", pfad, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    if not roh:
        raise SystemExit(f"FEHLER: ffmpeg konnte {pfad} nicht lesen.")
    return np.frombuffer(roh, dtype=np.float32).copy()


def sprechabschnitte(audio: np.ndarray, min_pause_ms: int = PAUSE_MS):
    """Sprechabschnitte aus der Lautstärke: Liste [start_ms, ende_ms] + Rauschboden und Schwelle in dBFS.

    Atmer und Raumgeräusche liegen nur wenige dB über der Schwelle (gemessen 3–13 dB), echte Sprache 30–45 dB, auch ein einzelnes
    „s“ noch über 20 dB. Läufe, die nie STRONG_DB über die Schwelle kommen, zählen deshalb nicht als Sprache – sonst würde ein
    Atmer vor einem Wort dessen Einsatz nach vorn ziehen."""
    hop, win = int(0.005 * SR), int(0.020 * SR)
    n = max(1, (len(audio) - win) // hop)
    # Effektivwert je 20-ms-Fenster, alle 5 ms (über eine Summentabelle der Quadrate, auch bei langen Aufnahmen schnell)
    summe = np.concatenate([[0.0], np.cumsum(audio.astype(np.float64) ** 2)])
    anfang = np.arange(n) * hop
    db = 10 * np.log10((summe[anfang + win] - summe[anfang]) / win + 1e-18)
    rausch = float(np.percentile(db, 5))
    laut = float(np.percentile(db, 95))
    schwelle = max(rausch + 12.0, laut - 38.0)
    hoch = schwelle + STRONG_DB
    aktiv = db > schwelle
    laeufe, i = [], 0
    while i < n:
        if aktiv[i]:
            j = i
            while j < n and aktiv[j]:
                j += 1
            laeufe.append((i, j))
            i = j
        else:
            i += 1
    segs = [[i * 5, j * 5 + 15] for i, j in laeufe if db[i:j].max() >= hoch]  # schwache Läufe (Atmer) fallen hier weg
    gemerged = []
    for s in segs:
        if gemerged and s[0] - gemerged[-1][1] < min_pause_ms:
            gemerged[-1][1] = s[1]
        else:
            gemerged.append(s)
    gemerged = [s for s in gemerged if s[1] - s[0] >= 60]  # Knackser ignorieren
    # Geht ein Atmer ohne Lücke in ein Wort über (oder hängt am Wortende), zählt höchstens 150 ms Vorlauf bzw. 250 ms Ausklang um
    # die lauten Fenster herum zum Abschnitt. Normale Wortanfänge und -enden sind kürzer und bleiben unberührt.
    out = []
    for a, b in gemerged:
        fi, fj = a // 5, min(n, max(a // 5 + 1, (b - 15) // 5))
        stark = np.nonzero(db[fi:fj] >= hoch)[0]
        if len(stark):
            a = max(a, (fi + int(stark[0])) * 5 - 150)
            b = min(b, (fi + int(stark[-1])) * 5 + 15 + 250)
        out.append([int(a), int(b)])
    if not out:
        raise SystemExit("ABBRUCH: In der Aufnahme wurde keine Sprache gefunden (nur Stille oder Rauschen). Mikrofon, Pegel und Datei prüfen.")
    return out, rausch, schwelle


# ------------------------------------------------------------ Whisper
def hoere(whisper: str, modell: str, wav16: str, sprache: str, arbeitsordner: str) -> list:
    """Lässt ein Modell die Aufnahme frei abhören. Ergebnis: Wörter [{roh, norm, beginn, ende, p}] in Sprechreihenfolge (ms).
    Mit DTW-Zeiten (Normalfall) gilt: ein Wort beginnt dort, wo das vorige samt Satzzeichen endet; `ende` ist das Ende des letzten
    Lautstücks. Ohne DTW (Modellname unbekannt) dienen die Zeitstempel der Stücke selbst als Beginn – das ist ungenauer."""
    preset = dtw_preset(modell)
    if ".en" in os.path.basename(modell) and sprache != "en":
        raise SystemExit(f"FEHLER: {os.path.basename(modell)} versteht nur Englisch, das Skript ist aber \"{sprache}\". Ein mehrsprachiges Modell (ohne .en im Namen) verwenden.")
    basis = os.path.join(arbeitsordner, modell_name(modell))
    cmd = [whisper, "-m", modell, "-f", wav16, "-l", sprache, "-ojf", "-of", basis, "-np"]
    cmd += ["-dtw", preset, "-nfa"] if preset else ["-ml", "1", "-sow"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(basis + ".json"):
        raise SystemExit(f"FEHLER: whisper-cli ({os.path.basename(modell)}) ist fehlgeschlagen:\n{(r.stderr or r.stdout)[-800:]}")
    with open(basis + ".json", encoding="utf-8") as f:
        j = json.load(f)
    roh = []
    for seg in j["transcription"]:
        for t in seg["tokens"]:
            text = t["text"]
            if text.startswith("[_"):  # Steuerzeichen des Modells ([_BEG_], [_TT_55] …)
                continue
            von, bis = t["offsets"]["from"], t["offsets"]["to"]
            dtw = t["t_dtw"] * 10 if preset and t.get("t_dtw", -1) >= 0 else None  # DTW-Zeit = Ende des Stücks, in 10-ms-Einheiten
            laut = bool(sk.norm(text))
            # Neues Wort, wenn das Stück mit Leerzeichen beginnt und selbst ein Wort ist; Satzzeichen und Wortreste hängen am vorigen
            if not roh or (text.startswith(" ") and laut):
                roh.append({"roh": text.strip(), "t0": von, "tend": bis, "ende": dtw if dtw is not None else bis, "grenze": dtw if dtw is not None else bis, "ps": [t["p"]] if laut else []})
            else:
                roh[-1]["roh"] += text
                roh[-1]["grenze"] = dtw if dtw is not None else bis
                if laut:
                    roh[-1]["ende"] = dtw if dtw is not None else bis
                    roh[-1]["tend"] = bis
                    roh[-1]["ps"].append(t["p"])
    roh = [w for w in roh if sk.norm(w["roh"])]
    if not roh:
        raise SystemExit(f"ABBRUCH: {os.path.basename(modell)} hat in der Aufnahme keine Wörter erkannt. Pegel prüfen (zu leise?) und Sprache in skript.json (\"sprache\").")
    out = []
    for k, w in enumerate(roh):
        if preset:
            beginn = roh[k - 1]["grenze"] if k > 0 else None
            ende = w["ende"]
        else:
            beginn = w["t0"]
            ende = min(w["tend"], roh[k + 1]["t0"]) if k + 1 < len(roh) else w["tend"]
        out.append({"roh": w["roh"], "norm": sk.norm(w["roh"]), "beginn": beginn, "ende": ende, "p": float(np.mean(w["ps"])) if w["ps"] else 0.0})
    return out


# ------------------------------------------------------------ Zuordnung Skript ↔ Gehörtes
def zuordnen(want: list, heard: list):
    """Ordnet jedes Skript-Wort einem gehörten Wort zu. Ergebnis: (zuordnung, abweichungen, anders_gehoert).
    zuordnung[i] = (j, anteil) → das Skript-Wort i beginnt beim gehörten Wort j, `anteil` (0–1) Teil seiner Dauer später (nur bei
    zusammen-/getrennt geschriebenen Wörtern, "co-founders" ↔ "cofounders"); None = nicht zuordenbar."""
    zu = [None] * len(want)
    abw, anders = [], []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=want, b=heard, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                zu[i1 + k] = (j1 + k, 0.0)
        elif tag == "replace" and (i2 - i1) == (j2 - j1):  # gleich viele Wörter, aber anders gehört (Eigennamen u. ä.): Stelle für Stelle
            for k in range(i2 - i1):
                zu[i1 + k] = (j1 + k, 0.0)
                anders.append((want[i1 + k], heard[j1 + k]))
        elif "".join(want[i1:i2]) == "".join(heard[j1:j2]):  # nur anders getrennt ("co founders" ↔ "cofounders")
            if j2 - j1 == 1:  # Skript trennt, Whisper schreibt zusammen: Beginn anteilig (nach Buchstaben) innerhalb des gehörten Wortes
                gesamt, vorn = sum(len(x) for x in want[i1:i2]), 0
                for k in range(i1, i2):
                    zu[k] = (j1, vorn / gesamt)
                    vorn += len(want[k])
            elif i2 - i1 == 1:  # Skript schreibt zusammen, Whisper trennt: Beginn des ersten gehörten Teils
                zu[i1] = (j1, 0.0)
        else:
            abw.append({"skript": " ".join(want[max(0, i1 - 2):i2 + 2]), "gehoert": " ".join(heard[max(0, j1 - 2):j2 + 2]), "differenz": (j2 - j1) - (i2 - i1)})
    return zu, abw, anders


# ------------------------------------------------------------ Ausrichtung
def ausrichten(audio_pfad: str, s: dict, modelle: list, whisper: str, erlaube_abweichung: bool = False, verbose: bool = True) -> dict:
    want = sk.alle_woerter(s)
    n = len(want)
    audio = lade_audio(audio_pfad)
    dauer_ms = int(round(len(audio) / SR * 1000))
    segs, rausch, schwelle = sprechabschnitte(audio)
    zeiten, enden, gehoert, geschaetzt, p_alle, anders_alle = {}, {}, {}, set(), {}, {}
    with tempfile.TemporaryDirectory() as tmp:
        wav16 = os.path.join(tmp, "audio16k.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", audio_pfad, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", wav16], check=True)
        for m in modelle:
            name = modell_name(m)
            if verbose:
                print(f"  hört ab: {name}" + ("" if dtw_preset(m) else "  (Achtung: Name nicht bekannt → keine DTW-Zeiten, ungenauere Wortzeiten)"), flush=True)
            h = hoere(whisper, m, wav16, s["sprache"], tmp)
            heard = [w["norm"] for w in h]
            gehoert[name] = " ".join(w["roh"] for w in h)
            zu, abw, anders = zuordnen(want, heard)
            if abw and not erlaube_abweichung:
                zeilen = "\n".join(f"    Skript: …{d['skript']}…   gehört: …{d['gehoert']}…   ({d['differenz']:+d} Wörter)" for d in abw)
                raise SystemExit(f"ABBRUCH: Die Aufnahme weicht vom Skript ab ({len(heard)} gehörte Wörter, {len(want)} im Skript), laut {name}:\n{zeilen}\n"
                                 f"  gehört: {gehoert[name]}\n"
                                 "  Entweder das Skript an das Gesprochene anpassen (skript.json) oder neu aufnehmen. Wörter, die Whisper nur anders schreibt\n"
                                 "  (Zahlen, Eigennamen mit anderer Wortzahl), lassen sich mit --erlaube-abweichung überspringen; die Zeiten dort werden dann\n"
                                 "  geschätzt und sollten mit --setze <schlüssel>=<ms> geprüft werden.")
            st = np.full(n, np.nan)
            en = np.full(n, np.nan)
            for i, z in enumerate(zu):
                if z is None:
                    continue
                j, anteil = z
                b = h[j]["beginn"]
                st[i] = np.nan if b is None else b + anteil * (h[j]["ende"] - b)
                en[i] = h[j]["ende"]
            zeiten[name], enden[name] = st, en
            p_alle[name] = np.array([h[z[0]]["p"] if z else np.nan for z in zu])
            anders_alle[name] = anders
            geschaetzt |= {i for i, z in enumerate(zu) if z is None}
    namen = [modell_name(m) for m in modelle]
    st_m = np.array([zeiten[k] for k in namen])  # Modelle × Wörter
    en_m = np.array([enden[k] for k in namen])
    with warnings.catch_warnings(), np.errstate(all="ignore"):
        warnings.simplefilter("ignore")  # "All-NaN slice": bei Wörtern ohne Zuordnung erwartet, sie werden unten geschätzt
        start = np.nanmedian(st_m, axis=0)
        ende = np.nanmedian(en_m, axis=0)
        streuung = np.nanmax(st_m, axis=0) - np.nanmin(st_m, axis=0)
        prob = np.nanmean(np.array([p_alle[k] for k in namen]), axis=0)
    start[0] = segs[0][0]  # die Aufnahme beginnt mit dem ersten Wort: Einsatz der ersten Sprache
    # nicht zuordenbare Wörter (nur mit --erlaube-abweichung): linear nach Buchstaben zwischen den Nachbarn schätzen
    fehlt = [i for i in range(n) if np.isnan(start[i])]
    for i in fehlt:
        geschaetzt.add(i)
    if fehlt:
        bekannt = [i for i in range(n) if not np.isnan(start[i])]
        for i in fehlt:
            vor = max((b for b in bekannt if b < i), default=0)
            nach = min((b for b in bekannt if b > i), default=None)
            t0 = start[vor]
            t1 = start[nach] if nach is not None else segs[-1][1]
            zw = list(range(vor, (nach if nach is not None else n)))
            gesamt = sum(len(want[k]) for k in zw) or 1
            start[i] = t0 + (t1 - t0) * sum(len(want[k]) for k in zw if k < i) / gesamt
            ende[i] = start[i] + (t1 - t0) * len(want[i]) / gesamt
    # Einrasten: Der Beginn des Sprechabschnitts nach einer Pause gehört zu dem Wort, das dort beginnt. Kandidaten sind die ersten zwei
    # Wörter, die laut Ausrichtung nach dem Einsatz noch klingen. Das Wort darf nicht tief im vorigen Abschnitt beginnen (dann hat
    # die Pause nichts mit ihm zu tun, z. B. ein Verschlusslaut) und nicht unplausibel spät nach dem Einsatz.
    eingerastet = [False] * n
    eingerastet[0] = True
    letzter = 0
    for k in range(1, len(segs)):
        a = segs[k][0]
        vorher_ende = segs[k - 1][1]
        kandidaten = [i for i in range(letzter + 1, n) if ende[i] > a + 40][:2]
        for i in kandidaten:
            if vorher_ende - 250 <= start[i] <= a + 400:
                start[i] = a
                eingerastet[i] = True
                letzter = i
                break
    for i in range(1, n):  # streng aufsteigend halten
        start[i] = max(start[i], start[i - 1] + 10)
    woerter = []
    for i, tok in enumerate(want):
        woerter.append({
            "i": i, "wort": tok,
            "start": int(round(float(start[i]) / 10) * 10),
            "nachPause": bool(eingerastet[i]),
            "streuungMs": 0 if np.isnan(streuung[i]) else int(round(float(streuung[i]))),
            "p": 0.0 if np.isnan(prob[i]) else round(float(prob[i]), 2),
            "geschaetzt": i in geschaetzt,
            "modelle": {k: (None if np.isnan(zeiten[k][i]) else int(round(float(zeiten[k][i])))) for k in namen},
        })
    return {
        "datei": os.path.basename(audio_pfad),
        "dauerMs": dauer_ms,
        "rauschbodenDb": round(rausch, 1),
        "schwelleDb": round(schwelle, 1),
        "abschnitte": segs,
        "sprechEndeMs": int(segs[-1][1]),
        "modelle": namen,
        "gehoert": gehoert,
        "andersGehoert": {k: [{"skript": a, "gehoert": b} for a, b in v] for k, v in anders_alle.items()},
        "woerter": woerter,
    }


def phrasenzeiten(res: dict, s: dict, setze: dict = None) -> list:
    """Beginn jeder Phrase (ms). `setze` = {schlüssel: ms} überschreibt einzelne Werte von Hand. Streng aufsteigend, sonst Abbruch."""
    ph = sk.phrasen(s)
    zeiten = [res["woerter"][p["wort0"]]["start"] for p in ph]
    for k, ms in (setze or {}).items():
        i = next((i for i, p in enumerate(ph) if p["key"] == k), None)
        if i is None:
            raise SystemExit(f"FEHLER: --setze {k}={ms}: den Schlüssel \"{k}\" gibt es im Skript nicht (vorhanden: {', '.join(p['key'] for p in ph)}).")
        zeiten[i] = int(ms)
    for i in range(1, len(zeiten)):
        if zeiten[i] <= zeiten[i - 1]:
            raise SystemExit(f"ABBRUCH: Zeiten nicht aufsteigend: {ph[i - 1]['key']}={zeiten[i - 1]} ms, {ph[i]['key']}={zeiten[i]} ms. Bei --setze die Reihenfolge der Schlüssel beachten.")
    return zeiten


def bericht(res: dict, s: dict, zeiten: list) -> str:
    ph = sk.phrasen(s)
    kopf = f"{res['datei']}: {res['dauerMs']} ms, Rauschboden {res['rauschbodenDb']} dBFS, {len(res['abschnitte'])} Sprechabschnitte: {res['abschnitte']}\n"
    kopf += f"Modelle: {', '.join(res['modelle'])}\n"
    z = [f"{'Schlüssel':<12} {'Beginn ms':>9}  {'Wort':<12} {'Pause':<6} {'Streuung':>8}  {'P':>4}   " + "  ".join(f"{m:>12}" for m in res["modelle"])]
    for p, t in zip(ph, zeiten):
        w = res["woerter"][p["wort0"]]
        flag = ""
        if w["geschaetzt"]:
            flag = "   <-- GESCHÄTZT (Wort nicht zugeordnet), prüfen"
        elif w["streuungMs"] > 150 and not w["nachPause"]:
            flag = "   <-- Modelle uneinig, prüfen"
        z.append(f"{p['key']:<12} {t:>9}  {w['wort']:<12} {'●' if w['nachPause'] else '':<6} {w['streuungMs']:>8}  {w['p']:>4.2f}   " + "  ".join(f"{(w['modelle'][m] if w['modelle'][m] is not None else '–'):>12}" for m in res["modelle"]) + flag)
    anders = {k: v for k, v in res["andersGehoert"].items() if v}
    extra = ""
    if anders:
        extra = "\nAnders gehört (gleiche Wortzahl, daher unkritisch): " + "; ".join(f"{k}: " + ", ".join(f"{a}→{b}" for a, b in [(x['skript'], x['gehoert']) for x in v]) for k, v in anders.items())
    return kopf + "\n".join(z) + extra


if __name__ == "__main__":
    # --modelle a.bin,b.bin und --modelle=a.bin,b.bin gehen beide; der Wert darf nie als Berichtspfad durchrutschen
    roh, args, flags, i = sys.argv[1:], [], {}, 0
    while i < len(roh):
        a = roh[i]
        if a.startswith("--") and "=" in a:
            k, v = a[2:].split("=", 1)
            flags[k] = v
        elif a == "--modelle" and i + 1 < len(roh):
            flags["modelle"] = roh[i + 1]
            i += 1
        elif not a.startswith("--"):
            args.append(a)
        i += 1
    if len(args) < 2 or any(p.endswith(".bin") for p in args):
        raise SystemExit("Aufruf: align.py <audio> <skript.json> [bericht.json] [--modelle a.bin,b.bin]")
    if len(args) < 2:
        raise SystemExit(__doc__)
    skr = sk.lade(args[1])
    mods = finde_modelle(flags.get("modelle", ""))
    r = ausrichten(args[0], skr, mods, finde_whisper(), erlaube_abweichung="--erlaube-abweichung" in sys.argv)
    zt = phrasenzeiten(r, skr)
    print(bericht(r, skr, zt))
    if len(args) > 2:
        with open(args[2], "w", encoding="utf-8") as f:
            json.dump(r, f, indent=1, ensure_ascii=False)
