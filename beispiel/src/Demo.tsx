// Demo (9 s, 9:16): drei kurze Szenen, getaktet auf Wortzeiten – dieselben Bausteine wie in einem echten Kurzvideo, nur ohne eigenen Inhalt.
// Alle Zeiten kommen aus src/timing.ts (Wortzeiten) – hier stehen keine festen Zeiten, Bild und Ton hängen an denselben Konstanten.
//
//  1  "this is your hook, hello"        weiße Karte + Inset-Clip (langsamer Zoom), drei Textzeilen, das Schreibschrift-Wort liegt leicht über dem Inset
//  2  "look at these numbers"           grüne Zahl, die bis zum Schnitt immer weiter steigt, dazu ein Klappen-Zähler
//  3  "I'm Your Name, thanks for watching"  Name über einem zweiten Inset, Kringel-Pfeil vom Namen zum Clip, Textzeile darunter
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { FONTS } from "./lib/fonts";
import { Word, Words } from "./lib/words";
import { Cue, SfxTrack, SOUNDS } from "./lib/sfx";
import { VO } from "./timing";

/** Millisekunden im Voiceover → Frames (30 fps). */
export const f = (ms: number) => Math.round(ms * 0.03);

/** Wortzeiten des Voiceovers in ms – aus src/timing.ts. */
const w = VO.w;
/** Szenengrenzen in ms. Szene i läuft von CUTS[i] bis CUTS[i+1]. */
const CUTS = [0, w.look, w.im, VO.endMs];
const start = (i: number) => f(CUTS[i]);
const len = (i: number) => f(CUTS[i + 1]) - f(CUTS[i]);
export const DEMO_FRAMES = f(CUTS[3]);

const slotSchema = z.object({ label: z.string(), clip: z.string(), startSec: z.number().min(0) });

export const demoSchema = z.object({
  /** Audiodatei unter public/ (leer = keine). Die Schnitte gehören zu den Wortzeiten in src/timing.ts – eine andere Aufnahme braucht eine neue timing.ts. */
  voiceover: z.string(),
  voVolume: z.number().min(0).max(1),
  /** Musik unter public/ (leer = keine). */
  music: z.string(),
  musicVolume: z.number().min(0).max(1),
  /** Lautstärke aller Sound-Effekte zusammen (0 = aus, 1 = Werte aus SFX_CUES). Bei 1.3 sind die Effekte etwa so laut wie Musik auf 0.15. */
  sfxVolume: z.number().min(0).max(2),
  /** Wert, den die grüne Zahl genau beim Schnitt auf Szene 3 erreicht – sie steigt bis dahin ununterbrochen. */
  counterTo: z.number().min(0),
  /** Die zwei Insets (Szene 1 und 3). clip = Dateiname unter public/ (z. B. "clip.mp4"); leer = grauer Platzhalter. */
  slots: z.array(slotSchema),
});
export type DemoProps = z.infer<typeof demoSchema>;
type Slot = z.infer<typeof slotSchema>;

export const demoDefaults: DemoProps = {
  voiceover: "",
  voVolume: 1,
  music: "",
  musicVolume: 0.15,
  sfxVolume: 1.3,
  counterTo: 1000000,
  slots: [
    { label: "your clip", clip: "", startSec: 0 },
    { label: "your clip", clip: "", startSec: 0 },
  ],
};

// ------------------------------------------------------------ Bausteine
const NONE: Slot = { label: "", clip: "", startSec: 0 };

/** Video oder grauer Platzhalter mit Beschriftung. */
const Media: React.FC<{ slot: Slot; hue: number }> = ({ slot, hue }) =>
  slot.clip ? (
    <OffthreadVideo src={staticFile(slot.clip)} muted trimBefore={Math.round(slot.startSec * 30)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  ) : (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, hsl(${hue} 15% 86%), hsl(${hue} 18% 74%))`,
        justifyContent: "center",
        alignItems: "center",
        color: "rgba(0,0,0,0.35)",
        fontSize: 34,
        letterSpacing: "0.18em",
        textAlign: "center",
        padding: 40,
        lineHeight: 1.5,
        ...FONTS.sansLight,
      }}
    >
      {slot.label}
    </AbsoluteFill>
  );

/** Breite des Insets in % der Bildbreite (16:9, also Höhe = Breite · 9/16). */
const INSET_WIDTH = 86;

/** Abgerundetes 16:9-Inset auf weißer Karte. */
const Inset: React.FC<{ slot: Slot; hue: number; top?: number; radius?: number; zoom?: { to: number; origin: string; frames: number } }> = ({ slot, hue, top = 37, radius = 28, zoom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  // zoom: der Clip wächst über `frames` Frames gleichmäßig auf `to`, um den Punkt `origin` (in % des Clips) herum
  const z = zoom ? interpolate(frame, [0, zoom.frames], [1, zoom.to], { extrapolateRight: "clamp" }) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: `${(100 - INSET_WIDTH) / 2}%`,
        top: `${top}%`,
        width: `${INSET_WIDTH}%`,
        aspectRatio: "16 / 9",
        transform: `scale(${interpolate(sp, [0, 1], [0.92, 1])})`,
        opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        borderRadius: radius,
        overflow: "hidden",
        background: "#dfe3ea",
      }}
    >
      {zoom ? (
        <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: zoom.origin }}>
          <Media slot={slot} hue={hue} />
        </AbsoluteFill>
      ) : (
        <Media slot={slot} hue={hue} />
      )}
    </div>
  );
};

/** Alle Wort-Texte poppen 100 ms (3 Frames) vor ihrem gesprochenen Wort ein. So lange dauert das Einblenden –
 *  sie stehen damit genau zum Wortbeginn voll da statt 1–3 Frames danach. Beginnt eine Szene genau auf dem Wort
 *  ("look at", "I'm"), wird der Einsatz negativ: der Text steht dann schon im ersten Frame der Szene voll da. */
const TEXT_LEAD_MS = 100;

/** Wörter mit Einsatzzeit in ms im Voiceover (absolut) → relative Frames der Szene. */
const rel = (sceneIdx: number, ws: (Omit<Word, "at"> & { ms: number })[]): Word[] => ws.map(({ ms, ...w }) => ({ ...w, at: f(ms - TEXT_LEAD_MS) - start(sceneIdx) }));

const RED = "#e1251b";
const GREEN = "#12b76a";
const GREEN_DARK = "#0a8f50";

// ------------------------------------------------------------ Szenen
const S1: React.FC<{ slot: Slot }> = ({ slot }) => (
  <AbsoluteFill style={{ background: "#fff" }}>
    <Inset slot={slot} hue={210} top={44} zoom={{ to: 1.12, origin: "50% 50%", frames: len(0) }} />
    <Words
      color="#000"
      words={rel(0, [
        { ms: w.thisIs, text: "this is", font: "sansLight", size: 76, x: 28, y: 11 },
        { ms: w.yourHook, text: "your hook", font: "sans", size: 176, x: 50, y: 17.5 },
        // das Schreibschrift-Wort reicht vom linken bis zum rechten Bildrand und liegt unten leicht über dem Inset
        { ms: w.hello, text: "hello", font: "script", size: 520, x: 48.5, y: 38.5, weight: 700, color: RED },
      ])}
    />
  </AbsoluteFill>
);

/** Frame (in der Szene), ab dem die Zahl zählt: genau beim Wort "numbers". */
const COUNT_AT = f(w.numbers) - start(1);

/** Grüne Zahl, die bis zum Schnitt immer weiter steigt (beschleunigt) und auf keinem runden Endwert landet. */
const Counter: React.FC<{ counterTo: number }> = ({ counterTo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - COUNT_AT;
  if (local < 0) return null;
  const count = counterTo * Math.pow(Math.min(1, local / (len(1) - COUNT_AT)), 2.3);
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  const arrowBob = Math.sin(local / 4) * 7;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", alignItems: "center", gap: 24, transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`, opacity: interpolate(local, [0, 4], [0, 1], { extrapolateRight: "clamp" }) }}>
      <div style={{ color: GREEN, fontSize: 168, lineHeight: 1, ...FONTS.sans, fontWeight: 900, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", textShadow: "0 6px 30px rgba(18,183,106,0.28)" }}>{Math.round(count).toLocaleString("en-US")}</div>
      <div style={{ color: GREEN, fontSize: 90, lineHeight: 1, transform: `translateY(${-arrowBob}px)` }}>▲</div>
    </div>
  );
};

const S2: React.FC<{ counterTo: number }> = ({ counterTo }) => (
  <AbsoluteFill style={{ background: "#fff" }}>
    <Counter counterTo={counterTo} />
    <Words
      color="#000"
      words={rel(1, [
        { ms: w.look, text: "look at these", font: "sansLight", size: 84, x: 50, y: 31 },
        { ms: w.numbers, text: "views", font: "serifItalic", size: 130, x: 50, y: 60, color: GREEN_DARK },
      ])}
    />
  </AbsoluteFill>
);

/** Lage von Name und Inset in Szene 3 (% der Höhe) – daraus ergeben sich Start und Spitze des Pfeils. */
const NAME_Y = 22;
const INSET3_TOP = 38;
/** Mitte des Insets in Bildpunkten (1080 × 1920): dorthin zeigt der Pfeil. */
const INSET_MID_Y = (INSET3_TOP / 100) * 1920 + (1080 * (INSET_WIDTH / 100) * 9) / 16 / 2;

/** Kringel-Pfeil vom Namen in die Mitte des Insets, wie von Hand gezeichnet: eine Linie mit Schlaufe, die sich ab SQUIGGLE_AT
 *  in SQUIGGLE_FRAMES Frames zeichnet, danach die zwei Striche der Pfeilspitze. Start (SX, SY) liegt unter dem Ende des Namens, die Spitze (EX, EY) in der Mitte des Insets.
 *  Die Kurve ist relativ zu Start und Spitze gebaut, verschiebt man also einen der beiden Punkte, läuft der Pfeil trotzdem dorthin. Koordinaten in Bildpunkten. */
const SX = 880;
const SY = (NAME_Y / 100) * 1920 + 110;
const EX = 650;
const EY = INSET_MID_Y;
const SQUIGGLE = `M ${SX} ${SY} C ${SX + 85} ${SY + 2} ${SX + 129} ${SY + 60} ${SX + 97} ${SY + 116} C ${SX + 71} ${SY + 162} ${SX + 1} ${SY + 156} ${SX + 1} ${SY + 111} C ${SX + 1} ${SY + 66} ${SX + 71} ${SY + 62} ${SX + 85} ${SY + 128} C ${SX + 99} ${SY + 198} ${EX + 182} ${EY} ${EX} ${EY}`;
const SQUIGGLE_HEAD = [`M ${EX} ${EY} L ${EX + 34} ${EY - 21}`, `M ${EX} ${EY} L ${EX + 30} ${EY + 25}`];
const SQUIGGLE_AT = f(w.yourName + 60) - start(2);
const SQUIGGLE_FRAMES = 12;
const Squiggle: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < SQUIGGLE_AT) return null;
  const line = interpolate(frame, [SQUIGGLE_AT, SQUIGGLE_AT + SQUIGGLE_FRAMES], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const head = interpolate(frame, [SQUIGGLE_AT + SQUIGGLE_FRAMES, SQUIGGLE_AT + SQUIGGLE_FRAMES + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // pathLength 1 + Strichmuster 1: strokeDashoffset 1 = nichts gezeichnet, 0 = ganze Linie
  const pen = { fill: "none", stroke: RED, strokeWidth: 9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <svg viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <path d={SQUIGGLE} {...pen} strokeDashoffset={1 - line} />
      {head > 0 ? SQUIGGLE_HEAD.map((d) => <path key={d} d={d} {...pen} strokeDashoffset={1 - head} />) : null}
    </svg>
  );
};

/** Schluss: oben "I'm" + Name, darunter das Inset mit leichtem Zoom, der Kringel-Pfeil zeigt vom Namen in den Clip, unter dem Inset eine Textzeile. */
const S3: React.FC<{ slot: Slot }> = ({ slot }) => {
  const frame = useCurrentFrame();
  const frames = len(2);
  const fade = interpolate(frame, [frames - 8, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <Inset slot={slot} hue={210} top={INSET3_TOP} zoom={{ to: 1.12, origin: "50% 50%", frames }} />
        <Words
          color="#000"
          words={rel(2, [
            { ms: w.im, text: "I'm", font: "sansLight", size: 84, x: 22, y: NAME_Y - 7.5 },
            { ms: w.yourName, text: "Your Name", font: "sans", size: 160, x: 52, y: NAME_Y },
            { ms: w.thanks, text: "thanks for watching", font: "sansLight", size: 84, x: 50, y: 75 },
          ])}
        />
        <Squiggle />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ Komposition
/** Sound-Effekte. at = Frame im Video, auf dem der Sound sitzt (bei Whooshes die lauteste Stelle); vol = Lautstärke 0–1.
 *  Die Frames hängen an denselben Wortzeiten und Animationswerten wie das Bild, wandern bei einer neuen timing.ts also mit.
 *  Pegel: Die vol-Werte geben das Verhältnis der Sounds untereinander an (Trommel und Seite kräftiger, Tasten und Klappen leise).
 *  Wie laut alle zusammen sind, stellt sfxVolume ein. Der Katalog mit den Dateien steht in lib/sfx.tsx. */
/** Eine Klappe der Flughafen-Tafel in drei leicht verschiedenen Tonhöhen; FLAP_ORDER mischt sie, damit kein Muster hörbar wird. */
const FLAPS = ["flapLo", "flap", "flapHi"] as const;
const FLAP_ORDER = [1, 0, 2, 0, 1, 2, 0];
const COUNT_TICKS = Math.floor((f(CUTS[2]) - 2 - f(w.numbers)) / 3) + 1;
/** Frame, auf dem ein Wort-Text aufpoppt (TEXT_LEAD_MS vor dem gesprochenen Wort). */
const pop = (ms: number) => Math.max(0, f(ms - TEXT_LEAD_MS));
/** Der Riser soll genau auf dem Schnitt in Szene 3 enden: sein Ende liegt (len − lead) nach der Stelle, die auf `at` sitzt. */
const RISER_AT = f(CUTS[2] - (SOUNDS.riser1.len - SOUNDS.riser1.lead));
const SFX_CUES: Cue[] = [
  // Szene 1: Auslöser, wenn der Clip aufpoppt; je Textzeile ein leiser Tastenanschlag; auf dem Schreibschrift-Wort ein Bleistiftstrich
  { at: start(0), s: "shutterSlr3", vol: 0.085, name: "Hook-Clip (Auslöser)" },
  { at: pop(w.thisIs), s: "key1", vol: 0.07, name: "this is (Taste)" },
  { at: pop(w.yourHook), s: "key2", vol: 0.075, name: "your hook (Taste)" },
  { at: pop(w.hello), s: "pencil1", vol: 0.04, name: "hello (Bleistift)" },
  // Szene 2: Seite blättert auf den Schnitt; eine Klappe der Flughafen-Tafel alle 3 Frames, bis zum Schnitt immer lauter;
  // ein rückwärts gespieltes Becken schwillt an und endet genau auf dem Schnitt
  { at: start(1), s: "page1", vol: 0.12, name: "Schnitt Zahl (Seite blättert)" },
  ...Array.from({ length: COUNT_TICKS }, (_, i): Cue => {
    const p = i / Math.max(1, COUNT_TICKS - 1);
    return { at: f(w.numbers) + i * 3, s: FLAPS[FLAP_ORDER[i % FLAP_ORDER.length]], vol: 0.02 + 0.03 * p, name: `Zahl ${i + 1}` };
  }),
  { at: RISER_AT, s: "riser1", vol: 0.06, name: "Riser vor Schnitt" },
  // Szene 3: Trommel auf dem ersten Frame, Auslöser, wenn der Clip aufpoppt; Bleistift, während sich der Kringel-Pfeil zeichnet; Taste auf der Textzeile
  { at: start(2), s: "tom1", vol: 0.13, name: "Schnitt Schluss (Trommel)" },
  { at: start(2), s: "shutterInsta2", vol: 0.085, name: "Schluss-Clip (Auslöser)" },
  { at: start(2) + SQUIGGLE_AT, s: "pencil1", vol: 0.042, name: "Kringel-Pfeil (Bleistift)" },
  { at: pop(w.thanks), s: "key3", vol: 0.075, name: "thanks for watching (Taste)" },
];

/** Musik-Pegel je Frame: in den letzten 18 Frames blendet sie aus. */
const musicGain = (frame: number) => interpolate(frame, [DEMO_FRAMES - 18, DEMO_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const Demo: React.FC<DemoProps> = ({ slots, voiceover, voVolume, music, musicVolume, sfxVolume, counterTo }) => {
  const S = (i: number) => slots[i] ?? NONE;
  const scene = (i: number, name: string, node: React.ReactNode) => (
    <Sequence key={i} from={start(i)} durationInFrames={len(i)} name={name}>
      {node}
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {voiceover ? <Audio src={staticFile(voiceover)} volume={voVolume} /> : null}
      {music ? <Audio src={staticFile(music)} volume={(fr) => musicVolume * musicGain(fr)} /> : null}
      <SfxTrack cues={SFX_CUES} volume={sfxVolume} />
      {scene(0, "1 · Hook", <S1 slot={S(0)} />)}
      {scene(1, "2 · Zahl", <S2 counterTo={counterTo} />)}
      {scene(2, "3 · Schluss", <S3 slot={S(1)} />)}
    </AbsoluteFill>
  );
};
