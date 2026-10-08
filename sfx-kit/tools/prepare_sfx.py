#!/usr/bin/env python3
"""Prepares raw sound effects for editing and writes them to ../sounds plus ../catalogue.json.

For each sound:
  1. Mono, 48 kHz.
  2. Cut the silence at the start (everything before the first sample louder than -40 dB relative to the peak; 2 ms of
     lead-in stay), so the attack sits at 0 ms and the sound can be placed frame-accurately.
  3. Cut the tail as soon as it is 55 dB below the peak; 1 ms fade-in, 15 ms fade-out (no clicks).
  4. Normalise the peak to -1 dBFS. The volume in the video comes only from the cue's vol value.
  5. Measure lead: 0 for clicks and shutters (the attack sits on the picture), for whooshes the time to the loudest point.
  6. Measure loud: the loudest 50 ms stretch (RMS, dB). It lets you swap one sound for another without it seeming
     louder or quieter: vol_new = vol_old * 10^((loud_old - loud_new) / 20).

Pitch variants are baked as files of their own (pitch()), not set with playbackRate in the video: Remotion keeps the
pitch fixed when it renders, but the preview does not necessarily. Baked files sound the same in Studio and in the render.

House rule: only real, recorded sounds. Everything synthetic is out (see DISCARDED).

Usage: python3 prepare_sfx.py            (reads SRC below; adjust paths and add new lines)
Needs: numpy, soundfile, librosa.
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

# name: (raw file in sfx-candidates, "onset" | "peak")
SRC = {
    # Camera
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
    # Mouse, trackpad, switches
    "mouse1": ("click_mouse_01.wav", "onset"),
    "mouse2": ("click_mouse_apple_magic_01.wav", "onset"),
    "mouse3": ("click_mouse_raspberry_01.wav", "onset"),
    "mouse4": ("click_mouse_kenney_01.wav", "onset"),
    "trackpad1": ("click_trackpad_macbookpro_01.wav", "onset"),
    "trackpad2": ("click_trackpad_macbook_02.wav", "onset"),
    "switch": ("click_switch_mic_01.wav", "onset"),
    "switch2": ("click_ui_switch_01.wav", "onset"),
    "switch3": ("click_switch_05.wav", "onset"),
    # Split-flap board (airport display)
    "flap": ("flap_single_board_02.wav", "onset"),
    "flapBurst3": ("flap_burst3_board_01.wav", "onset"),
    "flapBurst5": ("flap_burst5_board_01.wav", "onset"),
    "flapBurst8": ("flap_burst8_board_01.wav", "onset"),
    "flapEnd1": ("flap_end_board_01.wav", "onset"),
    "flapEnd2": ("flap_end_board_02.wav", "onset"),
    "flapRun": ("flap_run_timetable_01.wav", "onset"),
    # Paper
    "page1": ("paper_page_turn_01.wav", "peak"),
    "page2": ("paper_page_turn_05.wav", "peak"),
    "page3": ("paper_page_turn_06.wav", "peak"),
    "tear": ("paper_tear_04.wav", "peak"),
    # Whoosh (use sparingly)
    "swish": ("whoosh_knife_swish_kenney_01.wav", "peak"),
    "whooshShort": ("whoosh_short_01.wav", "peak"),
    # Riser, tom drum, cards, keys, pencil, glass (all real recordings)
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
    # Typing and coin (themed single sounds)
    "typeBurst1": ("type_burst_macbook_01.wav", "onset"),
    "coinCup1": ("sparkle_coin_cup_01.wav", "onset"),
}
# Groups for the catalogue in the Remotion project (tools/sync_remotion.py): heading → names
GROUPS = [
    ("Camera shutters and film winder", ["shutter2", "shutter3", "shutterSlr2", "shutterSlr3", "shutterInsta1", "shutterInsta2", "shutterOld", "shutterDslr", "shutterBurst2", "shutterBurst3", "shutterBurst4", "winder1", "winder2"]),
    ("Mouse, trackpad, switches, pen click", ["mouse1", "mouse2", "mouse3", "mouse4", "trackpad1", "trackpad2", "switch", "switch2", "switch3", "pen1", "pen2", "pen3"]),
    ("Split-flap board like at an airport (flapLo/flapHi = flap slightly lower/higher, to avoid an audible repeat)", ["flap", "flapLo", "flapHi", "flapBurst3", "flapBurst5", "flapBurst8", "flapEnd1", "flapEnd2", "flapRun"]),
    ("Paper", ["page1", "page2", "page3", "tear"]),
    ("Whooshes (use sparingly)", ["swish", "whooshShort"]),
    ("Riser (reversed cymbal), tom drum, cards, keys, pencil, glass, small swish, typing, coin", ["riser1", "tom1", "riffle1", "key1", "key2", "key3", "pencil1", "pencil2", "cardPlace1", "clink1", "swishSmall", "typeBurst1", "coinCup1"]),
]
# From one long recording with several sounds: name prefix → (raw file, number of single sounds)
CUTS = {"pen": ("click_pen_longtake_01.wav", 3)}
# Shorter version of a finished sound: name → (base, from s, to s). 5 ms fade-in, 80 ms fade-out; lead is measured again.
TRIMS = {}
# Slight pitch variants, so a sound played several times does not sound like a repeat: name → (base, factor)
VARIANTS = {"flapLo": ("flap", 0.94), "flapHi": ("flap", 1.06)}
# Deliberately not in the kit: synthetic sounds (game/UI packs: ticks, pops, blips, toggles; artificial hits). They sound like a spaceship.
DISCARDED = ["click_toggle_kenney_01", "pop_pluck_kenney_01", "pop_select_kenney_02", "click_ui_kenney_01", "tick_ui_kenney_01", "tick_ui_kenney_02"]


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
    """Like a sampler: faster = shorter and higher."""
    return librosa.resample(y, orig_sr=SR, target_sr=int(SR / rate))


def loud(y):
    """Loudest 50 ms stretch as RMS in dB (short sounds are padded with silence, just as the ear hears them as quieter)."""
    w = int(0.05 * SR)
    y = np.pad(y, (0, max(0, w - len(y))))
    e = np.convolve(y ** 2, np.ones(w) / w, mode="valid")
    return 10 * np.log10(max(e.max(), 1e-12))


def events(y, n, gap=0.12, max_len=0.6):
    """The n loudest single sounds of a long recording: stretches louder than -30 dB relative to the peak; pauses under 120 ms belong to the same sound."""
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
    if len(sys.argv) > 1:  # no arguments expected; --help must not rewrite anything
        sys.exit(__doc__)
    main()
