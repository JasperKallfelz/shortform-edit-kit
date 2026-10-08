// Der Ablauf in 30 Sekunden (1920 × 1080): links sagt der Mensch, was er will, in der Mitte arbeitet der Agent die fünf Schritte ab,
// rechts wächst das Video im Handy. Alle Zeiten, Texte und Sounds stehen in plan.ts; hier steht nur, wie es aussieht.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadPinyon } from "@remotion/google-fonts/PinyonScript";
import { CUES, f, FPS, H, SOUNDS, T, TAKE_MS, TEXT, vol, VORLAUF, W, WELLE_MS, WELLE_STUECKE, WORT } from "./plan";

const SANS = loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
const MONO = loadMono("normal", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] }).fontFamily;
const SCRIPT = loadPinyon("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

const C = { ink: "#1d2033", soft: "#5b607c", faint: "#9aa0b8", accent: "#4b5cf0", accentSoft: "#e6e9ff", red: "#e1251b", line: "#d9dcec", card: "#ffffff" };

// ------------------------------------------------------------ Maße
const TOP = 176;
const CHAT = { x: 100, w: 580 };
const PIPE = { x: 748, w: 572 };
const KARTE = { h: 150, gap: 12, padX: 24, kopf: 66 };
/** Zeichenfläche in jeder Karte */
const VW = PIPE.w - 2 * KARTE.padX;
const VH = 68;
const karteTop = (i: number) => TOP + i * (KARTE.h + KARTE.gap);
/** Handy: Außenmaß mit Rand, der Bildschirm ist 9:16. Sein Inhalt ist 1080 × 1920 groß gebaut und um K verkleinert. */
const HANDY = { x: 1412, y: TOP, rand: 10, sw: 400, sh: 711 };
const K = HANDY.sw / 1080;
/** Slot für den Clip im Video (Bildpunkte des 1080 × 1920-Bilds), wie im Beispielprojekt: 86 % breit, 16:9, bei 44 % der Höhe. */
const SLOT = { x: 1080 * 0.07, y: 1920 * 0.44, w: 1080 * 0.86, h: (1080 * 0.86 * 9) / 16 };
/** Zeitachse der Welle in Karte 1: 0 bis WELLE_MS über die ganze Breite */
const xMs = (ms: number) => (ms / WELLE_MS) * VW;
const WORTE = WELLE_STUECKE;

// ------------------------------------------------------------ Helfer
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lin = (fr: number, a: number, b: number) => interpolate(fr, [a, b], [0, 1], CL);
const sanft = Easing.bezier(0.3, 0, 0.1, 1);
const pop = (fr: number, at: number) => (fr < at ? 0 : spring({ frame: fr - at, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.8 } }));
/** Kurzer Puls (1 → 1 + staerke → 1) über 9 Frames ab `at`. */
const puls = (fr: number, at: number, staerke = 0.06) => 1 + staerke * Math.sin(Math.PI * lin(fr, at, at + 9));

const Haken: React.FC<{ size: number; color: string; stroke?: number }> = ({ size, color, stroke = 2.6 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16">
    <path d="M3.2 8.4 L6.6 11.6 L12.8 4.8" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ------------------------------------------------------------ Bühne, Titel, Schluss
const Buehne: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #e6e7ff 0%, #e1edff 45%, #ffeee2 100%)", fontFamily: SANS, color: C.ink }}>{children}</AbsoluteFill>
);

const Marke: React.FC = () => (
  <div style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px", borderRadius: 22, background: "rgba(255,255,255,0.75)", boxShadow: "0 6px 20px rgba(40,40,90,0.10)", fontFamily: MONO, fontSize: 22, fontWeight: 500, color: C.ink }}>{TEXT.marke}</div>
);

const Titel: React.FC = () => {
  const frame = useCurrentFrame();
  const raus = 1 - lin(frame, f(T.titelAus), f(T.titelAus) + 9);
  if (raus <= 0) return null;
  const z2 = pop(frame, f(T.titel2) - VORLAUF);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: raus, transform: `translateY(${(1 - raus) * -18}px)` }}>
      <Marke />
      <div style={{ marginTop: 34, fontSize: 86, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.1, textAlign: "center" }}>
        <div>{TEXT.titel[0]}</div>
        <div style={{ opacity: lin(frame, f(T.titel2) - VORLAUF, f(T.titel2)), transform: `scale(${0.94 + 0.06 * z2})`, color: C.accent }}>{TEXT.titel[1]}</div>
      </div>
    </AbsoluteFill>
  );
};

const Schluss: React.FC = () => {
  const frame = useCurrentFrame();
  const a = f(T.schluss) + 8;
  if (frame < a) return null;
  const p = pop(frame, a);
  const z2 = pop(frame, f(T.schluss2) - VORLAUF);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: lin(frame, a, a + 4) }}>
      <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: "-0.045em", transform: `scale(${0.94 + 0.06 * p})` }}>{TEXT.schluss}</div>
      <div style={{ marginTop: 26, fontSize: 38, fontWeight: 500, color: C.soft, opacity: lin(frame, f(T.schluss2) - VORLAUF, f(T.schluss2)), transform: `translateY(${(1 - z2) * 10}px)` }}>{TEXT.schluss2}</div>
      <div style={{ marginTop: 44, opacity: lin(frame, f(T.schluss3), f(T.schluss3) + 5), transform: `scale(${0.9 + 0.1 * pop(frame, f(T.schluss3))})` }}>
        <Marke />
      </div>
    </AbsoluteFill>
  );
};

const Spaltenkopf: React.FC<{ x: number; text: string }> = ({ x, text }) => (
  <div style={{ position: "absolute", left: x, top: 118, fontSize: 21, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.soft }}>{text}</div>
);

// ------------------------------------------------------------ links: Du sagst
const Mikro: React.FC<{ spricht: number; frame: number }> = ({ spricht, frame }) => (
  <div style={{ width: 46, height: 46, borderRadius: 23, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
    {[0, 1, 2, 3].map((i) => {
      // vier Pegelbalken: schlagen aus, solange gesprochen wird, und ruhen danach als Punkte
      const h = 5 + spricht * (9 + 9 * Math.abs(Math.sin(frame * 0.55 + i * 1.7)));
      return <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: "#fff" }} />;
    })}
  </div>
);

const Sprechblase: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const a = f(T.schritt[i]);
  const e = a + f(T.sprechen[i]);
  const p = pop(frame, a);
  const woerter = TEXT.sagt[i].split(" ");
  const spricht = lin(frame, a, a + 4) * (1 - lin(frame, e, e + 6));
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: CHAT.w, display: "flex", alignItems: "center", gap: 14, padding: "15px 24px 15px 15px", borderRadius: 26, background: C.accent, color: "#fff", boxShadow: "0 14px 30px -12px rgba(75,92,240,0.55)", opacity: lin(frame, a, a + 3), transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: "100% 50%" }}>
      <Mikro spricht={spricht} frame={frame} />
      <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.28 }}>
        {woerter.map((w, j) => (
          <span key={j} style={{ opacity: lin(frame, a + 3 + (j * (e - a - 6)) / woerter.length, a + 6 + (j * (e - a - 6)) / woerter.length) }}>
            {w}
            {j < woerter.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

const Meldung: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const a = f(T.fertig[i]);
  const p = pop(frame, a);
  return (
    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 21, fontWeight: 500, color: C.soft, opacity: lin(frame, a, a + 4), transform: `translateX(${(1 - p) * -10}px)` }}>
      <div style={{ width: 26, height: 26, borderRadius: 13, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Haken size={16} color="#fff" />
      </div>
      {TEXT.meldet[i]}
    </div>
  );
};

const Chat: React.FC = () => (
  <div style={{ position: "absolute", left: CHAT.x, top: TOP, width: CHAT.w, display: "flex", flexDirection: "column" }}>
    {TEXT.sagt.map((_, i) => (
      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
        <Sprechblase i={i} />
        <Meldung i={i} />
      </div>
    ))}
  </div>
);

// ------------------------------------------------------------ Mitte: Der Agent macht
/** Stellvertreter für einen Clip: eine gezeichnete Landschaft in einer von drei Stimmungen. Skaliert auf jede Größe. */
const STIMMUNG = [
  { oben: "#bcd9ff", unten: "#eef6ff", sonne: "#ffffff", berg1: "#8fb1dc", berg2: "#5d82b6" },
  { oben: "#ffae94", unten: "#ffe6bd", sonne: "#fff4d2", berg1: "#cc6f6a", berg2: "#803f5a" },
  { oben: "#b4ecd6", unten: "#f2fff6", sonne: "#ffffff", berg1: "#7ac4a6", berg2: "#3e8f77" },
];
const Motiv: React.FC<{ n: number; zoom?: number }> = ({ n, zoom = 1 }) => {
  const s = STIMMUNG[n];
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block", transform: `scale(${zoom})` }}>
      <defs>
        <linearGradient id={`himmel${n}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.oben} />
          <stop offset="1" stopColor={s.unten} />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill={`url(#himmel${n})`} />
      <circle cx="112" cy="36" r="13" fill={s.sonne} opacity="0.95" />
      <path d="M0 62 Q 30 40 62 58 T 120 52 T 160 60 V 90 H 0 Z" fill={s.berg1} />
      <path d="M0 74 Q 40 56 84 72 T 160 68 V 90 H 0 Z" fill={s.berg2} />
    </svg>
  );
};

const BILD = { w: 112, h: 63, gap: 12 };
/** Das mittlere Vorschaubild wird gewählt. */
const GEWAEHLT = 1;

const Karte: React.FC<{ i: number; children: React.ReactNode; rechts?: React.ReactNode }> = ({ i, children, rechts }) => {
  const frame = useCurrentFrame();
  const an = Math.min(1, pop(frame, f(T.aktiv[i])));
  const fertig = lin(frame, f(T.fertig[i]), f(T.fertig[i]) + 5);
  const ring = an * (1 - lin(frame, f(T.fertig[i]) + 12, f(T.fertig[i]) + 24));
  return (
    <div
      style={{
        position: "absolute", left: PIPE.x, top: karteTop(i), width: PIPE.w, height: KARTE.h, borderRadius: 22, boxSizing: "border-box", padding: `18px ${KARTE.padX}px`,
        background: `rgba(255,255,255,${0.42 + 0.58 * an})`,
        boxShadow: `0 ${22 * an}px ${44 * an}px -22px rgba(38,40,100,${0.38 * an}), 0 0 0 ${2.5 * ring}px rgba(75,92,240,${ring})`,
        transform: `scale(${0.985 + 0.015 * an})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, height: 34, opacity: 0.5 + 0.5 * an }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, boxSizing: "border-box", background: an > 0.5 ? C.accent : "transparent", border: an > 0.5 ? "none" : `2px solid ${C.faint}`, color: an > 0.5 ? "#fff" : C.faint, fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${puls(frame, f(T.fertig[i]), 0.18)})` }}>
          {fertig > 0.5 ? <Haken size={20} color="#fff" /> : i + 1}
        </div>
        <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em" }}>{TEXT.karte[i].titel}</div>
        <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 18, color: C.soft }}>{rechts ?? TEXT.karte[i].ort}</div>
      </div>
      <div style={{ position: "absolute", left: KARTE.padX, top: KARTE.kopf, width: VW, height: VH, opacity: an }}>{children}</div>
    </div>
  );
};

/** Hüllkurve der Welle: drei Sprech-Stücke, die bei den Wortzeiten beginnen, dazwischen fast Stille. */
const WELLE_N = 66;
const huelle = (ms: number) => {
  const stuecke: [number, number][] = [[WORT.thisIs, 640], [WORT.yourHook, 1300], [WORT.hello, 1950]];
  for (const [von, bis] of stuecke) {
    if (ms >= von && ms <= bis) {
      const p = (ms - von) / (bis - von);
      return 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, p * 1.25)) * (0.62 + 0.38 * Math.abs(Math.sin(ms * 0.031)));
    }
  }
  return 0.06;
};

const Voiceover: React.FC = () => {
  const frame = useCurrentFrame();
  const welle = lin(frame, f(T.welleVon), f(T.welleBis));
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: VW, height: 40, display: "flex", alignItems: "center", gap: 3 }}>
        {Array.from({ length: WELLE_N }, (_, n) => {
          const da = lin(welle * WELLE_N, n, n + 1.5);
          const h = 3 + 37 * huelle(((n + 0.5) / WELLE_N) * WELLE_MS) * da;
          return <div key={n} style={{ width: (VW - 3 * (WELLE_N - 1)) / WELLE_N, height: h, borderRadius: 2, background: C.ink, opacity: 0.16 + 0.6 * da }} />;
        })}
      </div>
      {WORTE.map((ms, n) => {
        const a = f(T.marke[n]);
        const p = pop(frame, a - VORLAUF);
        return (
          <div key={n} style={{ position: "absolute", left: xMs(ms), top: 0, opacity: lin(frame, a - VORLAUF, a) }}>
            <div style={{ position: "absolute", left: -1.5, top: -3 + (1 - p) * -10, width: 3, height: 46, borderRadius: 2, background: C.accent }} />
            <div style={{ position: "absolute", left: -1.5, top: 48, height: 20, padding: "0 8px", borderRadius: 6, background: C.accentSoft, color: C.accent, fontFamily: MONO, fontSize: 15, fontWeight: 500, lineHeight: "20px", whiteSpace: "nowrap" }}>{(ms / 1000).toFixed(2).replace(".", ",")} s</div>
          </div>
        );
      })}
    </>
  );
};

const AufnahmeLicht: React.FC = () => {
  const frame = useCurrentFrame();
  const laeuft = frame >= f(T.rec) && frame < f(T.stopp);
  if (!laeuft) return <>{TEXT.karte[0].ort}</>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.red }}>
      <span style={{ width: 11, height: 11, borderRadius: 6, background: C.red, opacity: 0.45 + 0.55 * Math.abs(Math.sin((frame - f(T.rec)) * 0.2)) }} />
      {TEXT.aufnahme}
    </span>
  );
};

const Clips: React.FC = () => {
  const frame = useCurrentFrame();
  const gelandet = frame >= f(T.flugBis);
  return (
    <>
      {[0, 1, 2].map((n) => {
        const p = pop(frame, f(T.bilder) + n * 3);
        const wahl = n === GEWAEHLT ? lin(frame, f(T.wahl), f(T.wahl) + 4) : 0;
        return (
          <div key={n} style={{ position: "absolute", left: n * (BILD.w + BILD.gap), top: 2, width: BILD.w, height: BILD.h, borderRadius: 8, overflow: "hidden", opacity: Math.min(1, p * 1.4) * (n === GEWAEHLT ? 1 : 1 - 0.45 * lin(frame, f(T.wahl), f(T.wahl) + 8)), transform: `translateY(${(1 - p) * 12}px) scale(${n === GEWAEHLT ? puls(frame, f(T.wahl), 0.07) : 1})`, boxShadow: `0 0 0 ${3 * wahl}px ${C.accent}` }}>
            <Motiv n={n} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 3 * (BILD.w + BILD.gap) + 14, top: 9, fontFamily: MONO, fontSize: 17, lineHeight: "24px", color: C.soft, opacity: gelandet ? lin(frame, f(T.flugBis) + 2, f(T.flugBis) + 8) : 0 }}>
        <div>{TEXT.slotZeile[0]}</div>
        <div style={{ color: C.accent }}>{TEXT.slotZeile[1]}</div>
      </div>
    </>
  );
};

/** Stellen der vier Cues auf der Zeitachse (ms): der Clip am Anfang, dann die drei Wortzeiten. */
const CUE_MS = [25, ...WORTE];
/** Zeitachse der Karte 3: schmaler als die Welle, rechts daneben steht der Name des Sounds. */
const ACHSE = VW - 178;
const xCue = (ms: number) => 15 + (ms / WORT.hello) * (ACHSE - 30);
const CueZeichen: React.FC<{ n: number }> = ({ n }) => {
  const s = { fill: "none", stroke: "#fff", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (n === 0) return <rect x="3.5" y="5" width="11" height="8" rx="1.8" {...s} />;
  if (n === 3) return <path d="M4 14 L5 10.6 L11.6 4 L14 6.4 L7.4 13 Z" {...s} />;
  return (
    <>
      <rect x="3.5" y="4" width="11" height="10" rx="2.4" {...s} />
      <path d="M7 10.6 H11" {...s} />
    </>
  );
};

const Sounds: React.FC = () => {
  const frame = useCurrentFrame();
  const jetzt = T.cue.reduce((letzte, t, n) => (frame >= f(t) ? n : letzte), -1);
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 43, width: ACHSE, height: 2, borderRadius: 1, background: C.line }} />
      {CUE_MS.map((ms, n) => {
        const a = f(T.cue[n]);
        const p = pop(frame, a - VORLAUF);
        return (
          <div key={n} style={{ position: "absolute", left: xCue(ms), top: 0 }}>
            <div style={{ position: "absolute", left: -1, top: 35, width: 2, height: 18, background: frame >= a ? C.accent : C.faint }} />
            <div style={{ position: "absolute", left: 0, top: 54, fontSize: 14, fontWeight: 500, color: C.soft, whiteSpace: "nowrap", transform: "translateX(-50%)" }}>{TEXT.cueStelle[n]}</div>
            <div style={{ position: "absolute", left: -15, top: 2 + (1 - p) * -16, width: 30, height: 30, borderRadius: 15, background: C.accent, opacity: lin(frame, a - VORLAUF, a), transform: `scale(${puls(frame, a, 0.2)})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 18 18">
                <CueZeichen n={n} />
              </svg>
            </div>
          </div>
        );
      })}
      {jetzt >= 0 ? (
        <div style={{ position: "absolute", right: 0, top: 8, textAlign: "right", opacity: lin(frame, f(T.cue[jetzt]), f(T.cue[jetzt]) + 3) }}>
          <div style={{ fontSize: 21, fontWeight: 600 }}>{TEXT.cueName[jetzt]}</div>
          <div style={{ fontFamily: MONO, fontSize: 15, color: C.soft, marginTop: 3 }}>{TEXT.echt}</div>
        </div>
      ) : null}
    </>
  );
};

const ZIEL = 0.72; // Stelle der −14 LUFS auf dem Balken
const Export: React.FC = () => {
  const frame = useCurrentFrame();
  const p = sanft(lin(frame, f(T.abspielen), f(T.pegelBis)));
  // der Pegel pendelt sich ein: kleine Ausschläge, die bis zum Ziel abklingen
  const wackeln = (1 - p) * 0.05 * Math.sin(frame * 0.9);
  const breite = Math.max(0, ZIEL * p + wackeln);
  const lufs = -30 + 16 * p;
  const mw = VW - 170;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 8, width: mw, height: 14, borderRadius: 7, background: C.line, overflow: "hidden" }}>
        <div style={{ width: `${breite * 100}%`, height: "100%", borderRadius: 7, background: C.accent }} />
      </div>
      <div style={{ position: "absolute", left: mw * ZIEL - 1, top: 2, width: 2, height: 26, background: C.ink, opacity: 0.55 }} />
      <div style={{ position: "absolute", right: 0, top: 0, fontFamily: MONO, fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: p >= 1 ? C.accent : C.ink }}>{lufs.toFixed(1).replace(".", ",").replace("-", "−")} LUFS</div>
      {TEXT.dateien.map((name, n) => {
        const a = f(T.datei[n]);
        const q = pop(frame, a);
        return (
          <div key={n} style={{ position: "absolute", left: n === 0 ? 0 : 196, top: 38, height: 28, padding: "0 12px", borderRadius: 8, background: C.accentSoft, color: C.accent, fontFamily: MONO, fontSize: 16, fontWeight: 500, lineHeight: "28px", whiteSpace: "nowrap", opacity: lin(frame, a, a + 3), transform: `scale(${0.9 + 0.1 * q})`, transformOrigin: "0 50%" }}>{name}</div>
        );
      })}
    </>
  );
};

const Post: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, top: 10, display: "flex", alignItems: "center" }}>
      {TEXT.stufen.map((name, n) => {
        const a = f(T.stufe[n]);
        const an = lin(frame, a, a + 3);
        const letzte = n === TEXT.stufen.length - 1;
        return (
          <React.Fragment key={n}>
            {n > 0 ? <div style={{ width: 26, height: 2, background: an > 0.5 ? C.accent : C.line }} /> : null}
            <div style={{ height: 42, padding: "0 16px", borderRadius: 21, display: "flex", alignItems: "center", gap: 7, fontSize: 19, fontWeight: 600, whiteSpace: "nowrap", color: an > 0.5 ? (letzte ? "#fff" : C.accent) : C.faint, background: an > 0.5 ? (letzte ? C.accent : C.accentSoft) : "transparent", boxShadow: an > 0.5 ? "none" : `inset 0 0 0 2px ${C.line}`, transform: `scale(${puls(frame, a, letzte ? 0.14 : 0.08)})` }}>
              {an > 0.5 && n > 0 ? <Haken size={16} color={letzte ? "#fff" : C.accent} /> : null}
              {name}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Pipeline: React.FC = () => (
  <>
    <Karte i={0} rechts={<AufnahmeLicht />}>
      <Voiceover />
    </Karte>
    <Karte i={1}>
      <Clips />
    </Karte>
    <Karte i={2}>
      <Sounds />
    </Karte>
    <Karte i={3}>
      <Export />
    </Karte>
    <Karte i={4}>
      <Post />
    </Karte>
  </>
);

// ------------------------------------------------------------ rechts: Das Video
/** Die drei Zeilen des Beispielvideos (Lage in % der Bildfläche, Größe in Bildpunkten des 1080er-Bilds). */
const ZEILEN = [
  { text: "this is", x: 28, y: 11, size: 76, stil: { fontWeight: 500, letterSpacing: "-0.03em" } },
  { text: "your hook", x: 50, y: 17.5, size: 176, stil: { fontWeight: 800, letterSpacing: "-0.05em" } },
  { text: "hello", x: 48.5, y: 38.5, size: 520, stil: { fontFamily: SCRIPT, fontWeight: 700, color: C.red } },
];

const Handy: React.FC = () => {
  const frame = useCurrentFrame();
  const spielt = frame >= f(T.abspielen);
  const start = f(T.abspielen);
  // Bis zum Abspielen entsteht das Video Stück für Stück; ab dann läuft es von vorn, im Takt der Wortzeiten.
  const wortAt = (n: number) => (spielt ? start + f(WORTE[n] / 1000) : f(T.marke[n])) - VORLAUF;
  const clipAt = spielt ? start : f(T.flugBis);
  const clipDa = frame >= clipAt;
  const clipPop = spielt ? pop(frame, start) : 1;
  const zoom = 1 + 0.12 * lin(frame, clipAt, clipAt + 6 * FPS);
  const fortschritt = lin(frame, start, start + f(TAKE_MS / 1000));
  const gepostet = pop(frame, f(T.stufe[2]));
  return (
    <>
      <div style={{ position: "absolute", left: HANDY.x, top: HANDY.y, width: HANDY.sw + 2 * HANDY.rand, height: HANDY.sh + 2 * HANDY.rand, borderRadius: 46, background: "#15171f", boxShadow: "0 50px 90px -30px rgba(38,40,100,0.5), 0 24px 44px -24px rgba(20,20,50,0.5)" }}>
        <div style={{ position: "absolute", left: HANDY.rand, top: HANDY.rand, width: HANDY.sw, height: HANDY.sh, borderRadius: 36, overflow: "hidden", background: "#fff" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0", transform: `scale(${K})`, color: "#000" }}>
            {/* Slot: gestrichelt, solange noch kein Clip darin liegt */}
            {!clipDa && !spielt ? (
              <div style={{ position: "absolute", left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, borderRadius: 28, boxSizing: "border-box", border: `5px dashed ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 44, color: C.faint }}>{TEXT.slot}</div>
            ) : null}
            {clipDa ? (
              <div style={{ position: "absolute", left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, borderRadius: 28, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.14)", opacity: spielt ? lin(frame, start, start + 3) : 1, transform: `scale(${(0.92 + 0.08 * clipPop) * puls(frame, f(T.cue[0]), 0.035)})` }}>
                <Motiv n={GEWAEHLT} zoom={zoom} />
              </div>
            ) : null}
            {ZEILEN.map((z, n) => {
              const a = wortAt(n);
              if (frame < a) return null;
              const p = pop(frame, a);
              return (
                <div key={n} style={{ position: "absolute", left: `${z.x}%`, top: `${z.y}%`, fontSize: z.size, lineHeight: 1, whiteSpace: "nowrap", opacity: lin(frame, a, a + 3), transform: `translate(-50%, -50%) scale(${(0.7 + 0.3 * p) * puls(frame, f(T.cue[n + 1]), 0.07)})`, ...z.stil }}>{z.text}</div>
              );
            })}
            {spielt ? <div style={{ position: "absolute", left: 60, bottom: 54, width: (1080 - 120) * fortschritt, height: 12, borderRadius: 6, background: C.accent }} /> : null}
            {spielt ? <div style={{ position: "absolute", left: 60, bottom: 54, width: 1080 - 120, height: 12, borderRadius: 6, background: "rgba(0,0,0,0.08)" }} /> : null}
          </div>
        </div>
        <div style={{ position: "absolute", left: "50%", top: HANDY.rand + 12, width: 96, height: 24, marginLeft: -48, borderRadius: 12, background: "#15171f" }} />
      </div>
      <div style={{ position: "absolute", left: HANDY.x, top: HANDY.y + HANDY.sh + 2 * HANDY.rand + 18, width: HANDY.sw + 2 * HANDY.rand, display: "flex", justifyContent: "center", opacity: Math.min(1, gepostet * 1.5), transform: `scale(${0.85 + 0.15 * gepostet})` }}>
        <div style={{ height: 44, padding: "0 20px 0 14px", borderRadius: 22, background: C.accent, color: "#fff", display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 600, boxShadow: "0 12px 26px -10px rgba(75,92,240,0.6)" }}>
          <Haken size={20} color="#fff" />
          {TEXT.gepostet}
        </div>
      </div>
    </>
  );
};

/** Der gewählte Clip fliegt aus der Karte in den Slot im Handy: dasselbe Bild, von der Größe des Vorschaubilds auf die des Slots. */
const Flug: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < f(T.flugVon) || frame >= f(T.flugBis)) return null;
  const p = sanft(lin(frame, f(T.flugVon), f(T.flugBis)));
  const von = { x: PIPE.x + KARTE.padX + GEWAEHLT * (BILD.w + BILD.gap), y: karteTop(1) + KARTE.kopf + 2, w: BILD.w, h: BILD.h, r: 8 };
  const nach = { x: HANDY.x + HANDY.rand + SLOT.x * K, y: HANDY.y + HANDY.rand + SLOT.y * K, w: SLOT.w * K, h: SLOT.h * K, r: 28 * K };
  const m = (a: number, b: number) => a + (b - a) * p;
  // leichter Bogen nach oben
  const bogen = -46 * Math.sin(Math.PI * p);
  return (
    <div style={{ position: "absolute", left: m(von.x, nach.x), top: m(von.y, nach.y) + bogen, width: m(von.w, nach.w), height: m(von.h, nach.h), borderRadius: m(von.r, nach.r), overflow: "hidden", boxShadow: "0 24px 44px -14px rgba(38,40,100,0.45)" }}>
      <Motiv n={GEWAEHLT} />
    </div>
  );
};

// ------------------------------------------------------------ Ton
/** Jede Cue als eigene, benannte Sequenz (in der Studio-Zeitleiste „SFX · …“), wie SfxTrack im Kit. */
const Ton: React.FC<{ volume: number }> = ({ volume }) => (
  <>
    {CUES.map((c, i) => {
      const s = SOUNDS[c.s];
      return (
        <Sequence key={i} from={Math.max(0, c.at - Math.round(s.lead * 0.03))} durationInFrames={Math.ceil(s.len * 0.03) + 2} layout="none" name={`SFX · ${c.name}`}>
          <Audio src={staticFile(`sfx/${c.s}.wav`)} volume={Math.min(1, vol(c) * volume)} />
        </Sequence>
      );
    })}
  </>
);

// ------------------------------------------------------------ Komposition
export const Ablauf: React.FC<{ sfxVolume: number }> = ({ sfxVolume }) => {
  const frame = useCurrentFrame();
  const rein = sanft(lin(frame, f(T.spalten), f(T.spalten) + 14));
  const raus = 1 - lin(frame, f(T.schluss), f(T.schluss) + 9);
  return (
    <Buehne>
      <Titel />
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: Math.min(rein, raus), transform: `translateY(${(1 - rein) * 18 - (1 - raus) * 14}px)` }}>
        <div style={{ position: "absolute", left: CHAT.x, top: 56, fontFamily: MONO, fontSize: 21, fontWeight: 500, color: C.soft }}>{TEXT.marke}</div>
        <Spaltenkopf x={CHAT.x} text={TEXT.spalten[0]} />
        <Spaltenkopf x={PIPE.x} text={TEXT.spalten[1]} />
        <Spaltenkopf x={HANDY.x} text={TEXT.spalten[2]} />
        <Chat />
        <Pipeline />
        <Handy />
        <Flug />
      </div>
      <Schluss />
      <Ton volume={sfxVolume} />
    </Buehne>
  );
};
