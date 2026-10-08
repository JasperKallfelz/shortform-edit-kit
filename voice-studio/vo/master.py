#!/usr/bin/env python3
"""Mastering of a raw voice recording into a finished voiceover.

Chain: tone (EQ) → phase rotation → compressor (tames loudly stressed words) → level to target loudness → limiter (catches residual peaks).
No automatic readjusting (loudnorm in dynamic mode): the loudness is measured and set with a fixed factor, so that the
progression of the recording is preserved.

Two tone variants (EQ):
  neutral  Rumble removed (high-pass 75 Hz) and slightly less mud (-1.5 dB at 250 Hz). Otherwise the voice stays as it is.
           Good for a microphone that already sounds good (e.g. a dynamic speech microphone).
  deep     more body for bright or thin voices: high-pass 90 Hz, +5 dB at 140 Hz (bass where the fundamental of many male voices
           lies), -2.5 dB at 330 Hz (mud), +0.8 dB at 3.2 kHz (presence). Below 90 Hz the level is cut instead of boosted,
           because only plosive thumps sit there. If the fundamental of the voice is higher or lower, adjust the frequency 140.

All variants: two allpass filters rotate the phase so that the speech waveform becomes more symmetrical (peaks about 2.5 dB lower,
sound unchanged); compressor threshold -18 dB, ratio 3.5:1; limiter ceiling -1.8 dBFS.

Result: two-channel WAV (left = right, 16 bit / 48 kHz) with -14 LUFS in the video, true peak at most -1.5 dBTP. Two channels because
Remotion lowers a mono file by 3 dB when it distributes it to two channels; a two-channel file passes through unchanged.
The calculation uses -17 LUFS per channel. Both are measured again on the result; if a target is missed, the tool aborts.

Usage: master.py <raw.wav> <target.wav> [neutral|deep] [target_lufs_per_channel=-17]
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 48000
# phase rotation (see above)
AP = "allpass=f=100:t=q:w=0.7,allpass=f=200:t=q:w=0.7"
# No de-esser: before the level stage it would have no effect; for sharp S sounds it belongs after the level stage and has to be set there
# after measuring (the ffmpeg filter acts very steeply from i=0.5).
EQ = {
    "neutral": "highpass=f=75:poles=2,equalizer=f=250:t=q:w=1.2:g=-1.5," + AP,
    "deep": "highpass=f=90:poles=2,equalizer=f=140:t=q:w=1.0:g=5,equalizer=f=330:t=q:w=1.2:g=-2.5,equalizer=f=3200:t=q:w=1.0:g=0.8," + AP,
}
COMP = "acompressor=threshold=-18dB:ratio=3.5:attack=4:release=140:detection=peak:makeup=1"
LIMIT_DB = -1.8  # limiter ceiling (sample values); with moderate limiting the true peak lies about 0.1 dB above it
TP_MAX = -1.5  # allowed true peak (dBTP), checked on the result
TOL = 0.15  # allowed deviation from the target loudness (LU)


def run(args, **kw):
    return subprocess.run(args, capture_output=True, **kw)


def loud(path, af=None):
    """(loudness LUFS, true peak dBTP, loudness range LU) of a file, optionally after a filter chain."""
    cmd = ["ffmpeg", "-hide_banner", "-i", path, "-af", (af + "," if af else "") + "loudnorm=I=-14:TP=-1.5:print_format=json", "-f", "null", "-"]
    err = run(cmd, text=True).stderr
    try:
        j = json.loads(err[err.rindex("{"):err.rindex("}") + 1])
        return float(j["input_i"]), float(j["input_tp"]), float(j["input_lra"])
    except (ValueError, KeyError):
        raise SystemExit(f"ERROR: ffmpeg could not measure {path}:\n{err[-600:]}")


def load(p, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", p] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(run(cmd).stdout, dtype=np.float32).astype(np.float64)


def master(raw, dest, chain="neutral", target=-17.0, comp=COMP, verbose=True):
    if chain not in EQ:
        raise SystemExit(f"ERROR: unknown tone variant \"{chain}\" (options: {', '.join(EQ)})")
    pre = EQ[chain] + "," + comp
    i0, tp0, _ = loud(raw, pre)
    if i0 < -60:
        raise SystemExit(f"ABORT: The recording contains practically no signal ({i0:.0f} LUFS). Check microphone permission, mute and gain.")
    mono = dest + ".mono.wav"
    limit_db = LIMIT_DB
    try:
        for _attempt in range(5):  # lower the limiter ceiling if needed until the true peak fits
            lim = 10 ** (limit_db / 20)
            gain = target - i0
            for _pass in range(10):  # readjust the level until the loudness fits (the limiter takes a little away)
                af = f"{pre},volume={gain:.2f}dB,alimiter=limit={lim:.4f}:attack=3:release=60:level=0:latency=1"
                run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", mono], check=True)
                i1, tp1, lra1 = loud(mono)
                if abs(i1 - target) < TOL - 0.05:
                    break
                gain += target - i1
            else:
                raise SystemExit(f"ABORT {os.path.basename(dest)}: target loudness of {target:.1f} LUFS per channel not reached (last {i1:.2f}). Lower the target or check the recording.")
            # write the two-channel file (both channels identical, no level change) and measure the result again
            run(["ffmpeg", "-v", "error", "-y", "-i", mono, "-af", "pan=stereo|c0=c0|c1=c0", "-c:a", "pcm_s16le", dest], check=True)
            i_st, tp_st, _ = loud(dest)
            if tp_st <= TP_MAX:
                break
            limit_db -= (tp_st - TP_MAX) + 0.1
        else:
            raise SystemExit(f"ABORT {os.path.basename(dest)}: true peak {tp_st:.2f} dBTP is above {TP_MAX} dBTP. Lower the target loudness.")
    finally:
        if os.path.exists(mono):
            os.remove(mono)
    # how hard does the limiter work?
    x = load(raw, f"{pre},volume={gain:.2f}dB")
    hop = SR // 100
    pk = np.array([np.abs(x[k * hop:(k + 1) * hop]).max() for k in range(len(x) // hop)])
    over = 20 * np.log10(np.maximum(pk, 1e-9) / lim)
    stats = dict(chain=chain, lufs_before=i0, tp_before=tp0, gain=gain, ceiling_db=limit_db, lufs=i1, tp=tp1, lra=lra1, lufs_stereo=i_st, tp_stereo=tp_st,
                 lim_max=float(over.max()), lim_ms_1=int((over > 1).sum() * 10), lim_ms_3=int((over > 3).sum() * 10), lim_ms_6=int((over > 6).sum() * 10))
    if verbose:
        print(f"Mastered [{chain}]: after EQ + compressor {i0:.1f} LUFS / {tp0:.1f} dBTP → {gain:+.1f} dB → per channel {i1:.2f} LUFS, "
              f"two-channel file {i_st:.2f} LUFS, peak {tp_st:.2f} dBTP, LRA {lra1:.1f} | limiter (ceiling {limit_db:.1f}): max {over.max():.1f} dB, "
              f">1 dB {stats['lim_ms_1']} ms, >3 dB {stats['lim_ms_3']} ms, >6 dB {stats['lim_ms_6']} ms")
    return stats


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    master(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "neutral", float(sys.argv[4]) if len(sys.argv) > 4 else -17.0)
