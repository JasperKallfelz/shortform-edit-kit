#!/usr/bin/env python3
"""Bereitet rohe Sound-Effekte für den Schnitt auf und schreibt sie nach ../sounds plus ../catalogue.json.

Pro Sound:
  1. Mono, 48 kHz.
  2. Stille am Anfang abschneiden (alles vor dem ersten Sample über -40 dB unter der Spitze, 2 ms Vorlauf bleiben),
     damit der Anschlag bei 0 ms sitzt und der Sound frame-genau platziert werden kann.
  3. Ausklang abschneiden, sobald er 55 dB unter der Spitze liegt; 1 ms Einblende, 15 ms Ausblende (kein Knacksen).
  4. Spitze auf -1 dBFS normalisieren – die Lautstärke im Video kommt allein aus dem vol-Wert der Cue.
  5. lead messen: 0 bei Klicks/Auslösern (der Anschlag sitzt auf dem Bild), bei Whooshes die Zeit bis zur lautesten Stelle.
  6. loud messen: lautestes 50-ms-Stück (RMS, dB). Damit lässt sich ein Sound gegen einen anderen tauschen, ohne dass er
     lauter oder leiser wirkt: vol_neu = vol_alt * 10^((loud_alt - loud_neu) / 20).

Tonhöhen-Varianten werden als eigene Dateien gebacken (pitch()), nicht per playbackRate im Video: Remotion hält beim
Rendern die Tonhöhe fest, die Vorschau nicht unbedingt – gebackene Dateien klingen in Studio und Render gleich.

Hausregel: nur echte, aufgenommene Geräusche. Alles Synthetische ist raus (siehe VERWORFEN).

Aufruf: python3 prepare_sfx.py            (liest SRC unten; Pfade anpassen und neue Zeilen ergänzen)
Braucht: numpy, soundfile, librosa.
"""
import json
import os
import sys

import librosa
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "sounds")
C = os.path.join(HERE, "..", "..", "sfx-candidates")
SR = 48000
PEAK = 10 ** (-1 / 20)

# name: (Rohdatei in sfx-candidates, "onset" | "peak")
SRC = {
    # Kamera
    "shutter2": ("shutter_slr_trigger_01.wav", "onset"),
    "shutter3": ("shutter_old_film_01.wav", "onset"),
    "shutterSlr2": ("shutter_slr_trigger_02.wav", "onset"),
    "shutterSlr3": ("shutter_slr_trigger_03.wav", "onset"),
    "shutterInsta1": ("shutter_instamatic_01.wav", "onset"),
    "shutterInsta2": ("shutter_instamatic_02.wav", "onset"),
    "shutterOld": ("shutter_old_camera_01.wav", "onset"),
    "shutterDslr": ("shutter_dslr_fast_01.wav", "onset"),
    "shutterBurst2": ("shutter_slr_burst_02.wav", "onset"),
    "shutterBurst3": ("shutter_slr_burst_03.wav", "onset"),
    "shutterBurst4": ("shutter_slr_burst_04.wav", "onset"),
    "winder1": ("film_advance_instamatic_winder_01.wav", "onset"),
    "winder2": ("film_advance_instamatic_winder_02.wav", "onset"),
    # Maus, Trackpad, Schalter
    "mouse1": ("click_mouse_01.wav", "onset"),
    "mouse2": ("click_mouse_apple_magic_01.wav", "onset"),
    "mouse3": ("click_mouse_raspberry_01.wav", "onset"),
    "mouse4": ("click_mouse_kenney_01.wav", "onset"),
    "trackpad1": ("click_trackpad_macbookpro_01.wav", "onset"),
    "trackpad2": ("click_trackpad_macbook_02.wav", "onset"),
    "switch": ("click_switch_mic_01.wav", "onset"),
    "switch2": ("click_ui_switch_01.wav", "onset"),
    "switch3": ("click_switch_05.wav", "onset"),
    # Klapptafel (Flughafen-Anzeige)
    "flap": ("flap_single_board_02.wav", "onset"),
    "flapBurst3": ("flap_burst3_board_01.wav", "onset"),
    "flapBurst5": ("flap_burst5_board_01.wav", "onset"),
    "flapBurst8": ("flap_burst8_board_01.wav", "onset"),
    "flapEnd1": ("flap_end_board_01.wav", "onset"),
    "flapEnd2": ("flap_end_board_02.wav", "onset"),
    "flapRun": ("flap_run_timetable_01.wav", "onset"),
    # Papier
    "page1": ("paper_page_turn_01.wav", "peak"),
    "page2": ("paper_page_turn_05.wav", "peak"),
    "page3": ("paper_page_turn_06.wav", "peak"),
    "tear": ("paper_tear_04.wav", "peak"),
    # Whoosh (sparsam einsetzen)
    "swish": ("whoosh_knife_swish_kenney_01.wav", "peak"),
    "whooshShort": ("whoosh_short_01.wav", "peak"),
    # Riser, Trommel, Karten, Tasten, Bleistift, Glas (alles echte Aufnahmen)
    "riser1": ("riser_reverse_cymbal_short_02.wav", "peak"),
    "tom1": ("impact_bass_tom_01.wav", "onset"),
    "riffle1": ("flutter_card_riffle_01.wav", "onset"),
    "key1": ("type_key_macbook_01.wav", "onset"),
    "key2": ("type_key_macbookpro_01.wav", "onset"),
    "key3": ("type_key_imac_01.wav", "onset"),
    "pencil1": ("pen_pencil_stroke_01.wav", "onset"),
    "pencil2": ("pen_pencil_stroke_02.wav", "onset"),
    "cardPlace1": ("card_place_table_01.wav", "peak"),
    "clink1": ("sparkle_glass_clink_02.wav", "onset"),
    "swishSmall": ("whoosh_swish_small_01.wav", "peak"),
    # Tippen und Münze (thematische Einzelgeräusche)
    "typeBurst1": ("type_burst_macbook_01.wav", "onset"),
    "coinCup1": ("sparkle_coin_cup_01.wav", "onset"),
}
# Gruppen für den Katalog im Remotion-Projekt (tools/sync_remotion.py): Überschrift → Namen
GROUPS = [
    ("Kamera-Auslöser und Filmtransport", ["shutter2", "shutter3", "shutterSlr2", "shutterSlr3", "shutterInsta1", "shutterInsta2", "shutterOld", "shutterDslr", "shutterBurst2", "shutterBurst3", "shutterBurst4", "winder1", "winder2"]),
    ("Maus, Trackpad, Schalter, Kugelschreiber", ["mouse1", "mouse2", "mouse3", "mouse4", "trackpad1", "trackpad2", "switch", "switch2", "switch3", "pen1", "pen2", "pen3"]),
    ("Klapptafel wie am Flughafen (flapLo/flapHi = flap etwas tiefer/höher, gegen hörbare Wiederholung)", ["flap", "flapLo", "flapHi", "flapBurst3", "flapBurst5", "flapBurst8", "flapEnd1", "flapEnd2", "flapRun"]),
    ("Papier", ["page1", "page2", "page3", "tear"]),
    ("Whooshes (sparsam einsetzen)", ["swish", "whooshShort"]),
    ("Riser (rückwärts gespieltes Becken), Trommel, Karten, Tasten, Bleistift, Glas, kleiner Swish, Tippen, Münze", ["riser1", "tom1", "riffle1", "key1", "key2", "key3", "pencil1", "pencil2", "cardPlace1", "clink1", "swishSmall", "typeBurst1", "coinCup1"]),
]
# Aus einer langen Aufnahme mit mehreren Tönen: name-Präfix → (Rohdatei, Anzahl Einzeltöne)
CUTS = {"pen": ("click_pen_longtake_01.wav", 3)}
# Kürzere Fassung eines fertigen Sounds: name → (Basis, von s, bis s). 5 ms Ein-, 80 ms Ausblende; lead wird neu gemessen.
TRIMS = {}
# Leichte Tonhöhen-Varianten, damit ein mehrfach gespielter Sound nicht wie eine Wiederholung klingt: name → (Basis, Faktor)
VARIANTS = {"flapLo": ("flap", 0.94), "flapHi": ("flap", 1.06)}
# Bewusst nicht im Kit: synthetische Sounds (Spiele-/UI-Pakete: Ticks, Pops, Blips, Toggles; künstliche Schläge) – „klingt nach Raumschiff“.
VERWORFEN = ["click_toggle_kenney_01", "pop_pluck_kenney_01", "pop_select_kenney_02", "click_ui_kenney_01", "tick_ui_kenney_01", "tick_ui_kenney_02"]


def load(path):
    y, sr = sf.read(path, always_2d=True)
    y = y.mean(axis=1)
    return librosa.resample(y, orig_sr=sr, target_sr=SR) if sr != SR else y


def prep(y, sync, tail_db=-55, fade_out=0.015):
    m = np.abs(y)
    pk = m.max()
    on = max(0, np.where(m > pk * 10 ** (-40 / 20))[0][0] - int(0.002 * SR))
    off = np.where(m > pk * 10 ** (tail_db / 20))[0][-1] + int(0.01 * SR)
    y = y[on:off].copy()
    fi, fo = int(0.001 * SR), min(int(fade_out * SR), len(y) // 3)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)
    y *= PEAK / np.abs(y).max()
    lead = 0.0
    if sync == "peak":
        w = int(0.02 * SR)
        env = np.convolve(np.abs(y), np.ones(w) / w, mode="same")
        lead = env.argmax() / SR * 1000
    return y, lead


def pitch(y, rate):
    """Wie ein Sampler: schneller = kürzer und höher."""
    return librosa.resample(y, orig_sr=SR, target_sr=int(SR / rate))


def loud(y):
    """Lautestes 50-ms-Stück als RMS in dB (kurze Sounds werden mit Stille aufgefüllt, wie das Ohr sie auch leiser hört)."""
    w = int(0.05 * SR)
    y = np.pad(y, (0, max(0, w - len(y))))
    e = np.convolve(y ** 2, np.ones(w) / w, mode="valid")
    return 10 * np.log10(max(e.max(), 1e-12))


def events(y, n, gap=0.12, max_len=0.6):
    """Die n lautesten Einzeltöne einer langen Aufnahme: Stücke über -30 dB (unter der Spitze), Pausen unter 120 ms gehören zum selben Ton."""
    w = int(0.005 * SR)
    env = np.convolve(np.abs(y), np.ones(w) / w, mode="same")
    on = env > env.max() * 10 ** (-30 / 20)
    idx = np.where(on)[0]
    if not len(idx):
        return []
    breaks = np.where(np.diff(idx) > gap * SR)[0]
    starts = np.concatenate(([idx[0]], idx[breaks + 1]))
    ends = np.concatenate((idx[breaks], [idx[-1]]))
    segs = [(s, e) for s, e in zip(starts, ends) if 0.01 * SR < e - s < max_len * SR]
    segs.sort(key=lambda se: -np.abs(y[se[0]:se[1]]).max())
    pad = int(0.03 * SR)
    return [y[max(0, s - pad):e + int(0.15 * SR)] for s, e in sorted(segs[:n])]


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = {}

    def put(name, y, lead=0.0):
        y = y * (PEAK / np.abs(y).max())
        sf.write(os.path.join(OUT, f"{name}.wav"), y, SR, subtype="PCM_24")
        cat[name] = {"len": round(len(y) / SR * 1000), "lead": round(lead), "loud": round(loud(y), 1)}

    base = {}
    for name, (raw, sync) in SRC.items():
        y, lead = prep(load(f"{C}/{raw}"), sync)
        base[name] = y
        put(name, y, lead)
    for prefix, (raw, n) in CUTS.items():
        for i, seg in enumerate(events(load(f"{C}/{raw}"), n), 1):
            put(f"{prefix}{i}", prep(seg, "onset")[0])
    for name, (src, rate) in VARIANTS.items():
        put(name, pitch(base[src], rate))
    for name, (src, a, b) in TRIMS.items():
        y = base[src][int(a * SR):int(b * SR)].copy()
        fi, fo = int(0.005 * SR), int(0.08 * SR)
        y[:fi] *= np.linspace(0, 1, fi)
        y[-fo:] *= np.linspace(1, 0, fo)
        w = int(0.02 * SR)
        put(name, y, np.convolve(np.abs(y), np.ones(w) / w, mode="same").argmax() / SR * 1000)
    json.dump(cat, open(os.path.join(HERE, "..", "catalogue.json"), "w"), indent=1)
    for k, v in cat.items():
        print(f'  {k}: {{ file: "sfx/{k}.wav", len: {v["len"]}, lead: {v["lead"]}, loud: {v["loud"]} }},')


if __name__ == "__main__":
    if len(sys.argv) > 1:  # keine Argumente vorgesehen; --help soll nichts neu schreiben
        sys.exit(__doc__)
    main()
