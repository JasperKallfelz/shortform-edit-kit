// Sound-Effekte: Katalog der Dateien unter public/sfx und eine Spur, die eine Cue-Liste abspielt.
// Die Dateien sind aufbereitet: Stille am Anfang abgeschnitten (der Anschlag sitzt bei 0 ms), auf -1 dBFS normalisiert, 48 kHz.
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

/** Nur echte, aufgenommene Geräusche, nichts Synthetisches (keine Ticks, Pops oder Blips).
 *  len = Länge in ms. lead = ms vom Dateianfang bis zu der Stelle, die auf dem Bild sitzen soll:
 *  0 = der Anschlag (Klicks, Auslöser, Klappen), bei Whooshes und Papier die lauteste Stelle.
 *  loud = lautestes 50-ms-Stück in dB. Zwei Sounds bei gleicher Lautheit tauschen: vol_neu = vol_alt * 10^((loud_alt - loud_neu) / 20). */
export const SOUNDS = {
  // Kamera-Auslöser und Filmtransport
  shutter2: { file: "sfx/shutter2.wav", len: 358, lead: 0, loud: -16.9 },
  shutter3: { file: "sfx/shutter3.wav", len: 194, lead: 0, loud: -19.3 },
  shutterSlr2: { file: "sfx/shutterSlr2.wav", len: 369, lead: 0, loud: -17.4 },
  shutterSlr3: { file: "sfx/shutterSlr3.wav", len: 687, lead: 0, loud: -16.7 },
  shutterInsta1: { file: "sfx/shutterInsta1.wav", len: 296, lead: 0, loud: -21.2 },
  shutterInsta2: { file: "sfx/shutterInsta2.wav", len: 290, lead: 0, loud: -18.7 },
  shutterOld: { file: "sfx/shutterOld.wav", len: 2113, lead: 0, loud: -19.1 },
  shutterDslr: { file: "sfx/shutterDslr.wav", len: 272, lead: 0, loud: -22.0 },
  shutterBurst2: { file: "sfx/shutterBurst2.wav", len: 943, lead: 0, loud: -23.6 },
  shutterBurst3: { file: "sfx/shutterBurst3.wav", len: 1528, lead: 0, loud: -23.2 },
  shutterBurst4: { file: "sfx/shutterBurst4.wav", len: 1823, lead: 0, loud: -23.2 },
  winder1: { file: "sfx/winder1.wav", len: 704, lead: 0, loud: -20.5 },
  winder2: { file: "sfx/winder2.wav", len: 580, lead: 0, loud: -22.5 },
  // Maus, Trackpad, Schalter, Kugelschreiber
  mouse1: { file: "sfx/mouse1.wav", len: 156, lead: 0, loud: -22.8 },
  mouse2: { file: "sfx/mouse2.wav", len: 225, lead: 0, loud: -24.5 },
  mouse3: { file: "sfx/mouse3.wav", len: 192, lead: 0, loud: -23.0 },
  mouse4: { file: "sfx/mouse4.wav", len: 56, lead: 0, loud: -20.8 },
  trackpad1: { file: "sfx/trackpad1.wav", len: 199, lead: 0, loud: -19.1 },
  trackpad2: { file: "sfx/trackpad2.wav", len: 207, lead: 0, loud: -24.2 },
  switch: { file: "sfx/switch.wav", len: 384, lead: 0, loud: -14.5 },
  switch2: { file: "sfx/switch2.wav", len: 235, lead: 0, loud: -19.0 },
  switch3: { file: "sfx/switch3.wav", len: 2184, lead: 0, loud: -20.0 },
  pen1: { file: "sfx/pen1.wav", len: 353, lead: 0, loud: -26.6 },
  pen2: { file: "sfx/pen2.wav", len: 216, lead: 0, loud: -25.3 },
  pen3: { file: "sfx/pen3.wav", len: 242, lead: 0, loud: -28.6 },
  // Klapptafel wie am Flughafen (flapLo/flapHi = flap etwas tiefer/höher, gegen hörbare Wiederholung)
  flap: { file: "sfx/flap.wav", len: 112, lead: 0, loud: -14.4 },
  flapLo: { file: "sfx/flapLo.wav", len: 119, lead: 0, loud: -14.1 },
  flapHi: { file: "sfx/flapHi.wav", len: 106, lead: 0, loud: -14.6 },
  flapBurst3: { file: "sfx/flapBurst3.wav", len: 410, lead: 0, loud: -11.4 },
  flapBurst5: { file: "sfx/flapBurst5.wav", len: 500, lead: 0, loud: -11.5 },
  flapBurst8: { file: "sfx/flapBurst8.wav", len: 791, lead: 0, loud: -11.0 },
  flapEnd1: { file: "sfx/flapEnd1.wav", len: 1750, lead: 0, loud: -14.3 },
  flapEnd2: { file: "sfx/flapEnd2.wav", len: 1450, lead: 0, loud: -15.9 },
  flapRun: { file: "sfx/flapRun.wav", len: 4559, lead: 0, loud: -20.9 },
  // Papier
  page1: { file: "sfx/page1.wav", len: 512, lead: 183, loud: -19.5 },
  page2: { file: "sfx/page2.wav", len: 1643, lead: 722, loud: -20.3 },
  page3: { file: "sfx/page3.wav", len: 882, lead: 396, loud: -19.4 },
  tear: { file: "sfx/tear.wav", len: 841, lead: 446, loud: -18.5 },
  // Whooshes (sparsam einsetzen)
  swish: { file: "sfx/swish.wav", len: 355, lead: 121, loud: -13.7 },
  whooshShort: { file: "sfx/whooshShort.wav", len: 135, lead: 60, loud: -11.7 },
  // Riser (rückwärts gespieltes Becken), Trommel, Karten, Tasten, Bleistift, Glas, kleiner Swish, Tippen, Münze
  riser1: { file: "sfx/riser1.wav", len: 1500, lead: 858, loud: -9.5 },
  tom1: { file: "sfx/tom1.wav", len: 931, lead: 0, loud: -11.7 },
  riffle1: { file: "sfx/riffle1.wav", len: 596, lead: 0, loud: -21.4 },
  key1: { file: "sfx/key1.wav", len: 340, lead: 0, loud: -21.9 },
  key2: { file: "sfx/key2.wav", len: 315, lead: 0, loud: -22.7 },
  key3: { file: "sfx/key3.wav", len: 172, lead: 0, loud: -22.2 },
  pencil1: { file: "sfx/pencil1.wav", len: 630, lead: 0, loud: -11.5 },
  pencil2: { file: "sfx/pencil2.wav", len: 530, lead: 0, loud: -12.5 },
  cardPlace1: { file: "sfx/cardPlace1.wav", len: 767, lead: 170, loud: -21.7 },
  clink1: { file: "sfx/clink1.wav", len: 384, lead: 0, loud: -11.9 },
  swishSmall: { file: "sfx/swishSmall.wav", len: 298, lead: 74, loud: -11.9 },
  typeBurst1: { file: "sfx/typeBurst1.wav", len: 2143, lead: 0, loud: -21.0 },
  coinCup1: { file: "sfx/coinCup1.wav", len: 671, lead: 0, loud: -13.5 },
} as const;
export type SoundName = keyof typeof SOUNDS;

/** at = Frame im Video, auf dem der Sound sitzt; vol = Lautstärke 0–1; name erscheint in der Studio-Zeitleiste. */
export type Cue = { at: number; s: SoundName; vol: number; name: string };

/** Millisekunden → Frames (30 fps), wie f() in Demo.tsx. */
const fr = (ms: number) => Math.round(ms * 0.03);

/** Spielt jede Cue als eigene, benannte Sequenz ab. volume = Regler für alle zusammen. */
export const SfxTrack: React.FC<{ cues: Cue[]; volume?: number }> = ({ cues, volume = 1 }) => (
  <>
    {cues.map((c, i) => {
      const S = SOUNDS[c.s];
      return (
        <Sequence key={i} from={Math.max(0, c.at - fr(S.lead))} durationInFrames={Math.ceil(S.len * 0.03) + 2} layout="none" name={`SFX · ${c.name}`}>
          <Audio src={staticFile(S.file)} volume={c.vol * volume} />
        </Sequence>
      );
    })}
  </>
);
