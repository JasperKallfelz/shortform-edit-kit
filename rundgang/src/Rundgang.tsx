import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Caption, Chapter, COLORS, FPS, Frame, MONO, Stage, type ZoomKey } from "./lib";
import { CaptureVideo, planSeconds, rawToLocal, type Seg } from "./Capture";
import { build, Terminal } from "./Terminal";
import { postScript, renderScript, voScript } from "./scripts";
import marks from "./marks.json";

const M = marks as Record<string, { seconds: number; marks: Record<string, number> }>;
const f = (s: number) => Math.round(s * FPS);
const OVERLAP = 12; // Frames, in denen eine Szene in die nächste übergeht

// ---------------------------------------------------------------- Aufnahmen: Abschnitte (Rohzeit) und Zoom (Rohzeit)
const tonSegs: Seg[] = [
  { from: 1.2, to: 5.8, speed: 3.2 },
  { from: 5.8, to: M.tonstudio.marks["aufnahme-laeuft"] + 0.1, speed: 1.4 },
  { from: M.tonstudio.marks["aufnahme-laeuft"] + 0.1, to: M.tonstudio.marks["stopp"] - 0.4, speed: 2.8 },
  { from: M.tonstudio.marks["stopp"] - 0.4, to: M.tonstudio.marks["stopp"] + 4.0, speed: 1.6 },
];
const tonZoomRaw = [
  { t: 1.2, s: 1.0, u: 0.5, v: 0.5 },
  { t: 3.9, s: 1.0, u: 0.5, v: 0.5 },
  { t: 5.8, s: 1.5, u: 0.24, v: 0.3 },
  { t: 10.4, s: 1.3, u: 0.38, v: 0.17 },
  { t: M.tonstudio.marks["stopp"] + 0.1, s: 1.75, u: 0.24, v: 0.56 },
];

const propsSegs: Seg[] = [
  { from: 1.4, to: M.props.marks["geklickt"] + 0.05, speed: 2.1 },
  { from: M.props.marks["meldung-weg"] + 0.1, to: M.props.marks["spielt"] + 4.0, speed: 1.15 },
];
const propsZoomRaw = [
  { t: 1.4, s: 1.0, u: 0.5, v: 0.5 },
  { t: 3.0, s: 1.0, u: 0.5, v: 0.5 },
  { t: 4.6, s: 1.7, u: 0.89, v: 0.45 },
  { t: 7.0, s: 1.8, u: 0.89, v: 0.3 },
  { t: M.props.marks["geklickt"], s: 1.5, u: 0.5, v: 0.38 },
  { t: M.props.marks["meldung-weg"] + 0.6, s: 1.25, u: 0.5, v: 0.55 },
];

const hoerSegs: Seg[] = [{ from: 1.0, to: M.hoerseite.marks["sortiert"] + 2.3, speed: 1.95 }];
const hoerZoomRaw = [
  { t: 1.0, s: 1.0, u: 0.5, v: 0.5 },
  { t: 2.6, s: 1.0, u: 0.5, v: 0.5 },
  { t: 4.4, s: 1.5, u: 0.5, v: 0.4 },
  { t: M.hoerseite.marks["sortiert"] - 0.6, s: 1.5, u: 0.5, v: 0.4 },
  { t: M.hoerseite.marks["sortiert"] + 0.4, s: 1.9, u: 0.36, v: 0.27 },
  { t: M.hoerseite.marks["sortiert"] + 1.3, s: 1.9, u: 0.36, v: 0.27 },
  { t: M.hoerseite.marks["sortiert"] + 2.3, s: 1.0, u: 0.5, v: 0.5 },
];

const zeitSegs: Seg[] = [{ from: 4.8, to: M.zeitleiste.seconds - 0.6, speed: 1.65 }];
const zeitZoomRaw = [
  { t: 4.8, s: 1.0, u: 0.5, v: 0.5 },
  { t: 6.2, s: 1.0, u: 0.5, v: 0.5 },
  { t: 7.8, s: 1.35, u: 0.5, v: 0.62 },
  { t: M.zeitleiste.marks["sfx-gewaehlt"] - 0.4, s: 1.9, u: 0.88, v: 0.2 },
  { t: M.zeitleiste.marks["spielt"] - 0.3, s: 1.3, u: 0.5, v: 0.52 },
];

const toLocal = (segs: Seg[], keys: { t: number; s: number; u: number; v: number }[]): ZoomKey[] =>
  keys.map((k) => ({ ...k, t: rawToLocal(segs, k.t) }));

// ---------------------------------------------------------------- Terminal-Szenen
const voBuilt = build(voScript, 10, 0.75);
const renderBuilt = build(renderScript, 10, 0.8);
const postBuilt = build(postScript, 10, 0.8);

type Scene = {
  id: string;
  seconds: number;
  title: string;
  tone: "dark" | "light";
  caption: string;
  zoom: ZoomKey[];
  body: React.ReactNode;
  sfx: string;
};

const sceneList: Scene[] = [
  {
    id: "ton", seconds: planSeconds(tonSegs), title: "Tonstudio · localhost:3600", tone: "dark",
    caption: "Skript ablesen und aufnehmen: Jeder Take wird sofort gesichert.",
    zoom: toLocal(tonSegs, tonZoomRaw), body: <CaptureVideo name="tonstudio" segs={tonSegs} />, sfx: "page1",
  },
  {
    id: "vo", seconds: (voBuilt.end + 62) / FPS, title: "Terminal", tone: "dark",
    caption: "Ein Befehl macht aus dem Take das Voiceover und die Tabelle der Wortzeiten.",
    zoom: [
      { t: 0, s: 1.0, u: 0.5, v: 0.5 },
      { t: 0.7, s: 1.0, u: 0.5, v: 0.5 },
      { t: 1.7, s: 1.34, u: 0.5, v: 0.2 },
      { t: (voBuilt.end + 50) / FPS, s: 1.42, u: 0.5, v: 0.2 },
    ],
    body: <Terminal rows={voBuilt.rows} cues={voBuilt.cues} />, sfx: "page3",
  },
  {
    id: "props", seconds: planSeconds(propsSegs), title: "Remotion Studio · localhost:3000", tone: "dark",
    caption: "Clips in die Slots eintragen: Datei und Startsekunde, ohne Code anzufassen.",
    zoom: toLocal(propsSegs, propsZoomRaw), body: <CaptureVideo name="props" segs={propsSegs} />, sfx: "page1",
  },
  {
    id: "hoer", seconds: planSeconds(hoerSegs), title: "Hörseite · localhost:3700", tone: "light",
    caption: "Sounds mit der Tastatur sortieren: Pfeile wechseln, B behält, X sortiert aus.",
    zoom: toLocal(hoerSegs, hoerZoomRaw), body: <CaptureVideo name="hoerseite" segs={hoerSegs} />, sfx: "page3",
  },
  {
    id: "zeit", seconds: planSeconds(zeitSegs), title: "Remotion Studio · localhost:3000", tone: "dark",
    caption: "Jeder Effekt ist eine benannte Sequenz „SFX · …“ und hängt an einer Wortzeit.",
    zoom: toLocal(zeitSegs, zeitZoomRaw), body: <CaptureVideo name="zeitleiste" segs={zeitSegs} />, sfx: "page1",
  },
  {
    id: "render", seconds: (renderBuilt.end + 60) / FPS, title: "Terminal", tone: "dark",
    caption: "Zwei Dateien, mit und ohne Musik, Lautheit höchstens −14 LUFS.",
    zoom: [
      { t: 0, s: 1.0, u: 0.5, v: 0.5 },
      { t: 0.7, s: 1.0, u: 0.5, v: 0.5 },
      { t: 1.7, s: 1.34, u: 0.5, v: 0.2 },
      { t: (renderBuilt.end + 46) / FPS, s: 1.42, u: 0.5, v: 0.2 },
    ],
    body: <Terminal rows={renderBuilt.rows} cues={renderBuilt.cues} />, sfx: "page3",
  },
  {
    id: "post", seconds: (postBuilt.end + 84) / FPS, title: "Terminal", tone: "dark",
    caption: "Ohne --publish entsteht höchstens ein Entwurf, im Trockenlauf gar nichts.",
    zoom: [
      { t: 0, s: 1.0, u: 0.5, v: 0.5 },
      { t: 0.7, s: 1.0, u: 0.5, v: 0.5 },
      { t: 1.7, s: 1.34, u: 0.5, v: 0.2 },
      { t: (postBuilt.end + 84) / FPS, s: 1.42, u: 0.5, v: 0.2 },
    ],
    body: <Terminal rows={postBuilt.rows} cues={postBuilt.cues} />, sfx: "page1",
  },
];

// Kapitel über mehrere Szenen
const chapters = [
  { n: 1, title: "Skript und Voiceover", ids: ["ton", "vo"] },
  { n: 2, title: "Clips reindroppen", ids: ["props"] },
  { n: 3, title: "Sound-Design", ids: ["hoer", "zeit"] },
  { n: 4, title: "Fertig machen", ids: ["render"] },
  { n: 5, title: "Posten", ids: ["post"] },
];

const INTRO = f(2.6);
const END = f(8.8);
const starts: Record<string, number> = {};
const lens: Record<string, number> = {};
{
  let t = INTRO - OVERLAP;
  for (const s of sceneList) {
    starts[s.id] = t;
    lens[s.id] = f(s.seconds) + OVERLAP;
    t += f(s.seconds);
  }
  starts["end"] = t;
}
export const TOTAL_FRAMES = starts["end"] + END;
if (typeof process !== "undefined" && process.env.RUNDGANG_DEBUG) console.log("SZENEN " + JSON.stringify(sceneList.map((s) => [s.id, +s.seconds.toFixed(1)])));

// ---------------------------------------------------------------- Einleitung und Schluss
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 14, INTRO - 16, INTRO], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const steps = ["Skript und Voiceover", "Clips reindroppen", "Sound-Design", "Fertig machen", "Posten"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: a }}>
      <div style={{ textAlign: "center", transform: `translateY(${(1 - a) * 14}px)` }}>
        <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -3, color: COLORS.ink }}>shortform-edit-kit</div>
        <div style={{ marginTop: 14, fontSize: 38, fontWeight: 500, color: COLORS.inkSoft }}>Rundgang durch die Werkzeuge</div>
        <div style={{ marginTop: 44, display: "flex", gap: 14, justifyContent: "center" }}>
          {steps.map((s, i) => {
            const p = interpolate(frame, [18 + i * 5, 30 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 20px 0 8px", borderRadius: 23, background: "rgba(255,255,255,0.7)", color: COLORS.ink, fontSize: 22, fontWeight: 600, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
                <span style={{ width: 30, height: 30, borderRadius: 15, background: COLORS.accent, color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                {s}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const a = Easing.out(Easing.cubic)(Math.min(1, frame / 16));
  const out = interpolate(frame, [END - 14, END], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const items = ["Skript und Voiceover", "Clips reindroppen", "Sound-Design", "Fertig machen", "Posten"];
  return (
    <AbsoluteFill style={{ opacity: a * out }}>
      <div style={{ position: "absolute", left: 360, top: 100, width: 496, height: 880, borderRadius: 44, background: "#12141c", padding: 10, boxShadow: "0 60px 120px -30px rgba(38,40,100,0.5), 0 28px 56px -24px rgba(20,20,50,0.5)", transform: `translateY(${(1 - a) * 24}px)` }}>
        <div style={{ width: 476, height: 860, borderRadius: 34, overflow: "hidden", background: "#000" }}>
          <Sequence from={f(0.5)} layout="none">
            <OffthreadVideo src={staticFile("demo.mp4")} volume={(fr) => 1.2 * interpolate(fr, [f(7.4), f(8.1)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>
        </div>
      </div>
      <div style={{ position: "absolute", left: 990, top: 250, width: 700, color: COLORS.ink }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 3, color: COLORS.accent, textTransform: "uppercase" }}>Das Ergebnis</div>
        <div style={{ marginTop: 10, fontSize: 82, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.02 }}>shortform-edit-kit</div>
        <div style={{ marginTop: 18, fontSize: 30, fontWeight: 500, color: COLORS.inkSoft, lineHeight: 1.35 }}>Das Demo-Video aus dem Ordner <span style={{ fontFamily: MONO, fontSize: 27 }}>beispiel/</span>, gebaut mit Remotion.</div>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((s, i) => {
            const p = interpolate(frame, [30 + i * 7, 44 + i * 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 600, opacity: p, transform: `translateX(${(1 - p) * 16}px)` }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, background: COLORS.accent, color: "#fff", fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                {s}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 40, fontSize: 30, fontWeight: 600, color: COLORS.accent, opacity: interpolate(frame, [80, 96], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>Ein Mensch gibt frei.</div>
      </div>
    </AbsoluteFill>
  );
};

/** Regel am Ende des letzten Terminals. */
const Rule: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const start = total - f(2.7);
  const a = interpolate(frame, [start, start + 14, total - 14, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 98, display: "flex", justifyContent: "center", opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
      <div style={{ padding: "16px 40px", borderRadius: 18, background: COLORS.accent, color: "#fff", fontSize: 40, fontWeight: 700, letterSpacing: -0.5, boxShadow: "0 16px 40px rgba(60,70,220,0.4)" }}>Ein Mensch gibt frei.</div>
    </div>
  );
};

export const Rundgang: React.FC = () => (
  <Stage>
    <Sequence from={0} durationInFrames={INTRO}>
      <Intro />
      <Audio src={staticFile("sfx/page2.wav")} volume={0.16} />
    </Sequence>
    {sceneList.map((s) => (
      <Sequence key={s.id} from={starts[s.id]} durationInFrames={lens[s.id]} name={s.id}>
        <Frame title={s.title} tone={s.tone} zoom={s.zoom} total={lens[s.id]}>
          {s.body}
        </Frame>
        <Caption text={s.caption} total={lens[s.id]} />
        {s.id === "post" ? <Rule total={lens[s.id]} /> : null}
        <Audio src={staticFile(`sfx/${s.sfx}.wav`)} volume={0.15} />
      </Sequence>
    ))}
    {chapters.map((c) => {
      const from = starts[c.ids[0]];
      const to = starts[c.ids[c.ids.length - 1]] + lens[c.ids[c.ids.length - 1]];
      return (
        <Sequence key={c.n} from={from} durationInFrames={to - from} name={`Kapitel ${c.n}`}>
          <Chapter n={c.n} title={c.title} total={to - from} />
        </Sequence>
      );
    })}
    <Sequence from={starts["end"]} durationInFrames={END} name="Schluss">
      <Ending />
      <Audio src={staticFile("sfx/shutter3.wav")} volume={0.14} />
    </Sequence>
  </Stage>
);
