// The flow in 30 seconds (1920 × 1080): on the left a person says what they want, in the middle the agent works through the five
// steps, on the right the video grows inside a phone. The phone shows a real video built with the kit (docs/real-example.mp4).
// All times, texts and sounds live in plan.ts; this file only says what it looks like.
import React from "react";
import { AbsoluteFill, Audio, Easing, Freeze, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { CUES, f, FPS, H, LEAD, LINE_MS, PLAY_MS, REAL_FRAMES, SOUNDS, T, TEXT, vol, W, WAVE, WORDS } from "./plan";

const SANS = loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }).fontFamily;
const MONO = loadMono("normal", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] }).fontFamily;

const C = { ink: "#1d2033", soft: "#5b607c", faint: "#9aa0b8", accent: "#4b5cf0", accentSoft: "#e6e9ff", red: "#e1251b", line: "#d9dcec" };

// ------------------------------------------------------------ layout
const TOP = 176;
const CHAT = { x: 100, w: 580 };
const PIPE = { x: 748, w: 572 };
const CARD = { h: 150, gap: 12, padX: 24, head: 66 };
/** drawing area inside every card */
const VW = PIPE.w - 2 * CARD.padX;
const VH = 68;
const cardTop = (i: number) => TOP + i * (CARD.h + CARD.gap);
/** Phone: outer size including the bezel, the screen is 9:16. Its content is laid out at 1080 × 1920 and scaled down by K. */
const PHONE = { x: 1412, y: TOP, bezel: 10, sw: 400, sh: 711 };
const K = PHONE.sw / 1080;
/** Where the clip sits in the first scene of the real video (pixels of the 1080 × 1920 picture, measured in a frame). */
const CLIP = { x: 76, y: 845, w: 930, h: 526, r: 28 };
/** The video's background is not pure white after encoding; covers must match it. */
const PAPER = "rgb(253,253,253)";
/** The handwriting word of the first scene hangs this far (px) into the clip; see RedOnly below. */
const OVERHANG = 52;
/** time axis of the waveform in card 1: 0 to LINE_MS across the full width */
const xMs = (ms: number) => (ms / LINE_MS) * VW;

// ------------------------------------------------------------ helpers
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lin = (fr: number, a: number, b: number) => interpolate(fr, [a, b], [0, 1], CL);
const smooth = Easing.bezier(0.3, 0, 0.1, 1);
const pop = (fr: number, at: number) => (fr < at ? 0 : spring({ frame: fr - at, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.8 } }));
/** short pulse (1 → 1 + amount → 1) over 9 frames from `at` */
const pulse = (fr: number, at: number, amount = 0.06) => 1 + amount * Math.sin(Math.PI * lin(fr, at, at + 9));

const Check: React.FC<{ size: number; color: string; stroke?: number }> = ({ size, color, stroke = 2.6 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16">
    <path d="M3.2 8.4 L6.6 11.6 L12.8 4.8" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ------------------------------------------------------------ stage, title, closing
const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #e6e7ff 0%, #e1edff 45%, #ffeee2 100%)", fontFamily: SANS, color: C.ink }}>{children}</AbsoluteFill>
);

const Brand: React.FC = () => (
  <div style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px", borderRadius: 22, background: "rgba(255,255,255,0.75)", boxShadow: "0 6px 20px rgba(40,40,90,0.10)", fontFamily: MONO, fontSize: 22, fontWeight: 500, color: C.ink }}>{TEXT.brand}</div>
);

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const out = 1 - lin(frame, f(T.titleOut), f(T.titleOut) + 9);
  if (out <= 0) return null;
  const z2 = pop(frame, f(T.title2) - LEAD);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out, transform: `translateY(${(1 - out) * -18}px)` }}>
      <Brand />
      <div style={{ marginTop: 34, fontSize: 96, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.1, textAlign: "center" }}>
        <div>{TEXT.title[0]}</div>
        <div style={{ opacity: lin(frame, f(T.title2) - LEAD, f(T.title2)), transform: `scale(${0.94 + 0.06 * z2})`, color: C.accent }}>{TEXT.title[1]}</div>
      </div>
    </AbsoluteFill>
  );
};

const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const a = f(T.closing) + 8;
  if (frame < a) return null;
  const p = pop(frame, a);
  const z2 = pop(frame, f(T.closing2) - LEAD);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: lin(frame, a, a + 4) }}>
      <div style={{ fontSize: 108, fontWeight: 800, letterSpacing: "-0.045em", transform: `scale(${0.94 + 0.06 * p})` }}>{TEXT.closing}</div>
      <div style={{ marginTop: 26, fontSize: 38, fontWeight: 500, color: C.soft, opacity: lin(frame, f(T.closing2) - LEAD, f(T.closing2)), transform: `translateY(${(1 - z2) * 10}px)` }}>{TEXT.closing2}</div>
      <div style={{ marginTop: 44, opacity: lin(frame, f(T.closing3), f(T.closing3) + 5), transform: `scale(${0.9 + 0.1 * pop(frame, f(T.closing3))})` }}>
        <Brand />
      </div>
    </AbsoluteFill>
  );
};

const ColumnHead: React.FC<{ x: number; text: string }> = ({ x, text }) => (
  <div style={{ position: "absolute", left: x, top: 118, fontSize: 21, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.soft }}>{text}</div>
);

// ------------------------------------------------------------ left: you say
const Mic: React.FC<{ talking: number; frame: number }> = ({ talking, frame }) => (
  <div style={{ width: 46, height: 46, borderRadius: 23, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
    {[0, 1, 2, 3].map((i) => {
      // four level bars: they swing while the person talks and rest as dots afterwards
      const h = 5 + talking * (9 + 9 * Math.abs(Math.sin(frame * 0.55 + i * 1.7)));
      return <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: "#fff" }} />;
    })}
  </div>
);

const Bubble: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const a = f(T.step[i]);
  const e = a + f(T.speak[i]);
  const p = pop(frame, a);
  const words = TEXT.says[i].split(" ");
  const talking = lin(frame, a, a + 4) * (1 - lin(frame, e, e + 6));
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: CHAT.w, display: "flex", alignItems: "center", gap: 14, padding: "15px 24px 15px 15px", borderRadius: 26, background: C.accent, color: "#fff", boxShadow: "0 14px 30px -12px rgba(75,92,240,0.55)", opacity: lin(frame, a, a + 3), transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: "100% 50%" }}>
      <Mic talking={talking} frame={frame} />
      <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.28 }}>
        {words.map((w, j) => (
          <span key={j} style={{ opacity: lin(frame, a + 3 + (j * (e - a - 6)) / words.length, a + 6 + (j * (e - a - 6)) / words.length) }}>
            {w}
            {j < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

/** The agent's report: typed out while the keyboard is heard, the check mark lands with the pen click. */
const Report: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const a = f(T.typing[i]);
  const d = f(T.done[i]);
  const text = TEXT.reports[i];
  const shown = Math.round(text.length * lin(frame, a, d - 2));
  return (
    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 21, fontWeight: 500, color: C.soft, opacity: lin(frame, a, a + 2) }}>
      <div style={{ width: 26, height: 26, borderRadius: 13, boxSizing: "border-box", background: frame >= d ? C.accent : "transparent", border: frame >= d ? "none" : `2px solid ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pulse(frame, d, 0.2)})` }}>{frame >= d ? <Check size={16} color="#fff" /> : null}</div>
      <span>
        {text.slice(0, shown)}
        <span style={{ opacity: 0 }}>{text.slice(shown)}</span>
      </span>
    </div>
  );
};

const Chat: React.FC = () => (
  <div style={{ position: "absolute", left: CHAT.x, top: TOP, width: CHAT.w, display: "flex", flexDirection: "column" }}>
    {TEXT.says.map((_, i) => (
      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
        <Bubble i={i} />
        <Report i={i} />
      </div>
    ))}
  </div>
);

// ------------------------------------------------------------ middle: the agent does
const THUMB = { w: 112, h: 63, gap: 12 };
/** The first thumbnail is the clip of the video's first scene; it gets picked. */
const PICKED = 0;
const thumbSrc = (n: number) => staticFile(`clip-${n + 1}.jpg`);

const Card: React.FC<{ i: number; children: React.ReactNode; right?: React.ReactNode }> = ({ i, children, right }) => {
  const frame = useCurrentFrame();
  const on = Math.min(1, pop(frame, f(T.active[i])));
  const done = frame >= f(T.done[i]);
  const ring = on * (1 - lin(frame, f(T.done[i]) + 12, f(T.done[i]) + 24));
  return (
    <div
      style={{
        position: "absolute", left: PIPE.x, top: cardTop(i), width: PIPE.w, height: CARD.h, borderRadius: 22, boxSizing: "border-box", padding: `18px ${CARD.padX}px`,
        background: `rgba(255,255,255,${0.42 + 0.58 * on})`,
        boxShadow: `0 ${22 * on}px ${44 * on}px -22px rgba(38,40,100,${0.38 * on}), 0 0 0 ${2.5 * ring}px rgba(75,92,240,${ring})`,
        transform: `scale(${0.985 + 0.015 * on})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, height: 34, opacity: 0.5 + 0.5 * on }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, boxSizing: "border-box", background: on > 0.5 ? C.accent : "transparent", border: on > 0.5 ? "none" : `2px solid ${C.faint}`, color: on > 0.5 ? "#fff" : C.faint, fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pulse(frame, f(T.done[i]), 0.18)})` }}>
          {done ? <Check size={20} color="#fff" /> : i + 1}
        </div>
        <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em" }}>{TEXT.card[i].title}</div>
        <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 18, color: C.soft }}>{right ?? TEXT.card[i].where}</div>
      </div>
      <div style={{ position: "absolute", left: CARD.padX, top: CARD.head, width: VW, height: VH, opacity: on }}>{children}</div>
    </div>
  );
};

/** The waveform is the real loudness of the spoken line and grows in real time while the line is heard. */
const Voiceover: React.FC = () => {
  const frame = useCurrentFrame();
  const drawn = lin(frame, f(T.rec), f(T.rec + LINE_MS / 1000));
  const n = WAVE.length;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: VW, height: 40, display: "flex", alignItems: "center", gap: 3 }}>
        {WAVE.map((v, i) => {
          const there = lin(drawn * n, i, i + 1.5);
          return <div key={i} style={{ width: (VW - 3 * (n - 1)) / n, height: 3 + 37 * v * there, borderRadius: 2, background: C.ink, opacity: 0.16 + 0.6 * there }} />;
        })}
      </div>
      {WORDS.map((w, i) => {
        const a = f(T.rec + w.ms / 1000);
        const p = pop(frame, a - LEAD);
        return (
          <div key={i} style={{ position: "absolute", left: xMs(w.ms), top: 0, opacity: lin(frame, a - LEAD, a) }}>
            <div style={{ position: "absolute", left: -1.5, top: -3 + (1 - p) * -10, width: 3, height: 46, borderRadius: 2, background: C.accent }} />
            <div style={{ position: "absolute", left: -1.5, top: 48, height: 20, padding: "0 8px", borderRadius: 6, background: C.accentSoft, color: C.accent, fontFamily: MONO, fontSize: 15, fontWeight: 500, lineHeight: "20px", whiteSpace: "nowrap" }}>{(w.ms / 1000).toFixed(2)} s</div>
          </div>
        );
      })}
    </>
  );
};

const RecLight: React.FC = () => {
  const frame = useCurrentFrame();
  const running = frame >= f(T.recClick) && frame < f(T.recStop);
  if (!running) return <>{TEXT.card[0].where}</>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.red }}>
      <span style={{ width: 11, height: 11, borderRadius: 6, background: C.red, opacity: 0.45 + 0.55 * Math.abs(Math.sin((frame - f(T.recClick)) * 0.2)) }} />
      {TEXT.recording}
    </span>
  );
};

const Clips: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {[0, 1, 2].map((n) => {
        const p = pop(frame, f(T.thumbs) + n * 3);
        const picked = n === PICKED ? lin(frame, f(T.pick), f(T.pick) + 4) : 0;
        return (
          <div key={n} style={{ position: "absolute", left: n * (THUMB.w + THUMB.gap), top: 2, width: THUMB.w, height: THUMB.h, borderRadius: 8, overflow: "hidden", opacity: Math.min(1, p * 1.4) * (n === PICKED ? 1 : 1 - 0.45 * lin(frame, f(T.pick), f(T.pick) + 8)), transform: `translateY(${(1 - p) * 12}px) scale(${n === PICKED ? pulse(frame, f(T.pick), 0.07) : 1})`, boxShadow: `0 0 0 ${3 * picked}px ${C.accent}` }}>
            <Img src={thumbSrc(n)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 3 * (THUMB.w + THUMB.gap) + 14, top: 9, fontFamily: MONO, fontSize: 17, lineHeight: "24px", color: C.soft, opacity: lin(frame, f(T.slotLabel), f(T.slotLabel) + 4) }}>
        <div>{TEXT.slotLines[0]}</div>
        <div style={{ color: C.accent }}>{TEXT.slotLines[1]}</div>
      </div>
    </>
  );
};

/** axis of card 3: five stops at equal distances, the sound's name stands to the right of it */
const AXIS = VW - 150;
const xStop = (n: number) => 22 + (n * (AXIS - 50)) / (TEXT.cueStop.length - 1);
const CueIcon: React.FC<{ n: number }> = ({ n }) => {
  const s = { fill: "none", stroke: "#fff", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  // camera for the shutter, pencil for the handwriting word, a key cap for the text lines
  if (n === 0)
    return (
      <>
        <rect x="2.6" y="5.4" width="12.8" height="8.6" rx="2" {...s} />
        <circle cx="9" cy="9.7" r="2.3" {...s} />
        <path d="M6.4 5.2 L7.4 3.6 H10.6 L11.6 5.2" {...s} />
      </>
    );
  if (n === 4) return <path d="M4 14 L5 10.6 L11.6 4 L14 6.4 L7.4 13 Z" {...s} />;
  return (
    <>
      <rect x="3.5" y="4" width="11" height="10" rx="2.4" {...s} />
      <path d="M7 10.6 H11" {...s} />
    </>
  );
};

const Sounds: React.FC = () => {
  const frame = useCurrentFrame();
  const now = T.cue.reduce((last, t, n) => (frame >= f(t) ? n : last), -1);
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 43, width: AXIS, height: 2, borderRadius: 1, background: C.line }} />
      {TEXT.cueStop.map((label, n) => {
        const a = f(T.cue[n]);
        const p = pop(frame, a - LEAD);
        return (
          <div key={n} style={{ position: "absolute", left: xStop(n), top: 0 }}>
            <div style={{ position: "absolute", left: -1, top: 35, width: 2, height: 18, background: frame >= a ? C.accent : C.faint }} />
            <div style={{ position: "absolute", left: 0, top: 54, fontSize: 14, fontWeight: 500, color: C.soft, whiteSpace: "nowrap", transform: "translateX(-50%)" }}>{label}</div>
            <div style={{ position: "absolute", left: -15, top: 2 + (1 - p) * -16, width: 30, height: 30, borderRadius: 15, background: C.accent, opacity: lin(frame, a - LEAD, a), transform: `scale(${pulse(frame, a, 0.2)})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 18 18">
                <CueIcon n={n} />
              </svg>
            </div>
          </div>
        );
      })}
      {now >= 0 ? (
        <div style={{ position: "absolute", right: 0, top: 8, textAlign: "right", opacity: lin(frame, f(T.cue[now]), f(T.cue[now]) + 3) }}>
          <div style={{ fontSize: 21, fontWeight: 600 }}>{TEXT.cueName[now]}</div>
          <div style={{ fontFamily: MONO, fontSize: 15, color: C.soft, marginTop: 3 }}>{TEXT.real}</div>
        </div>
      ) : null}
    </>
  );
};

const TARGET = 0.72; // where −14 LUFS sits on the bar
const Export: React.FC = () => {
  const frame = useCurrentFrame();
  const p = smooth(lin(frame, f(T.play), f(T.meterTo)));
  // the level settles: small swings that die away towards the target
  const wobble = (1 - p) * 0.05 * Math.sin(frame * 0.9);
  const width = Math.max(0, TARGET * p + wobble);
  const lufs = -30 + 16 * p;
  const mw = VW - 170;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 8, width: mw, height: 14, borderRadius: 7, background: C.line, overflow: "hidden" }}>
        <div style={{ width: `${width * 100}%`, height: "100%", borderRadius: 7, background: C.accent }} />
      </div>
      <div style={{ position: "absolute", left: mw * TARGET - 1, top: 2, width: 2, height: 26, background: C.ink, opacity: 0.55 }} />
      <div style={{ position: "absolute", right: 0, top: 0, fontFamily: MONO, fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: p >= 1 ? C.accent : C.ink, transform: `scale(${pulse(frame, f(T.meterTo), 0.08)})`, transformOrigin: "100% 50%" }}>{lufs.toFixed(1).replace("-", "−")} LUFS</div>
      {TEXT.files.map((name, n) => {
        const a = f(T.file[n]);
        const q = pop(frame, a);
        return (
          <div key={n} style={{ position: "absolute", left: n === 0 ? 0 : 180, top: 38, height: 28, padding: "0 12px", borderRadius: 8, background: C.accentSoft, color: C.accent, fontFamily: MONO, fontSize: 16, fontWeight: 500, lineHeight: "28px", whiteSpace: "nowrap", opacity: lin(frame, a, a + 3), transform: `scale(${0.9 + 0.1 * q})`, transformOrigin: "0 50%" }}>{name}</div>
        );
      })}
    </>
  );
};

const Post: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, top: 10, display: "flex", alignItems: "center" }}>
      {TEXT.stages.map((name, n) => {
        const a = f(T.stage[n]);
        const on = lin(frame, a, a + 3);
        const last = n === TEXT.stages.length - 1;
        return (
          <React.Fragment key={n}>
            {n > 0 ? <div style={{ width: 26, height: 2, background: on > 0.5 ? C.accent : C.line }} /> : null}
            <div style={{ height: 42, padding: "0 16px", borderRadius: 21, display: "flex", alignItems: "center", gap: 7, fontSize: 19, fontWeight: 600, whiteSpace: "nowrap", color: on > 0.5 ? (last ? "#fff" : C.accent) : C.faint, background: on > 0.5 ? (last ? C.accent : C.accentSoft) : "transparent", boxShadow: on > 0.5 ? "none" : `inset 0 0 0 2px ${C.line}`, transform: `scale(${pulse(frame, a, last ? 0.14 : 0.08)})` }}>
              {on > 0.5 && n > 0 ? <Check size={16} color={last ? "#fff" : C.accent} /> : null}
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
    <Card i={0} right={<RecLight />}>
      <Voiceover />
    </Card>
    <Card i={1}>
      <Clips />
    </Card>
    <Card i={2}>
      <Sounds />
    </Card>
    <Card i={3}>
      <Export />
    </Card>
    <Card i={4}>
      <Post />
    </Card>
  </>
);

// ------------------------------------------------------------ right: the video
/** One frame of the real video, laid out at 1080 × 1920. `at` is the video frame to show. */
const RealFrame: React.FC<{ at: number }> = ({ at }) => (
  <Freeze frame={at}>
    <OffthreadVideo src={staticFile("real-example.mp4")} muted style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }} />
  </Freeze>
);

/** Where the five cues of step 3 sit in the picture (clip, then the four word groups): a ring spreads from there as the sound plays. */
const RING_AT: [number, number][] = [[540, 1108], [250, 182], [545, 302], [285, 472], [545, 742]];

const Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const rec = f(T.rec);
  const play = f(T.play);
  // Three phases: while the line is recorded the video runs in real time (its words pop as they are spoken), then it holds on the
  // last frame of the line, and from `play` it runs from the start with its own sound.
  const at = frame >= play ? Math.min(frame - play, REAL_FRAMES - 1) : Math.min(Math.max(frame - rec, 0), f(LINE_MS / 1000) - 2);
  // Until the clip has landed, its place in the video is covered by an empty slot.
  const empty = 1 - lin(frame, f(T.flightTo) - 1, f(T.flightTo) + 2);
  const posted = pop(frame, f(T.stage[2]));
  const pad = 46;
  return (
    <>
      <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y, width: PHONE.sw + 2 * PHONE.bezel, height: PHONE.sh + 2 * PHONE.bezel, borderRadius: 46, background: "#15171f", boxShadow: "0 50px 90px -30px rgba(38,40,100,0.5), 0 24px 44px -24px rgba(20,20,50,0.5)" }}>
        <div style={{ position: "absolute", left: PHONE.bezel, top: PHONE.bezel, width: PHONE.sw, height: PHONE.sh, borderRadius: 36, overflow: "hidden", background: PAPER }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0", transform: `scale(${K})` }}>
            <RealFrame at={at} />
            {empty > 0 ? (
              <div style={{ opacity: empty }}>
                {/* cover the clip and its shadow, then draw the empty slot */}
                <div style={{ position: "absolute", left: CLIP.x - pad, top: CLIP.y - pad, width: CLIP.w + 2 * pad, height: CLIP.h + pad + 70, background: PAPER }} />
                <div style={{ position: "absolute", left: CLIP.x, top: CLIP.y, width: CLIP.w, height: CLIP.h, borderRadius: CLIP.r, boxSizing: "border-box", border: `5px dashed ${C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 44, color: C.faint }}>{TEXT.slot}</div>
                {/* the handwriting word hangs into the clip: bring back only its red pixels from that strip */}
                <div style={{ position: "absolute", left: 0, top: CLIP.y - pad, width: 1080, height: pad + OVERHANG, overflow: "hidden", filter: "url(#red-only)" }}>
                  <div style={{ position: "absolute", left: 0, top: -(CLIP.y - pad), width: 1080, height: 1920 }}>
                    <RealFrame at={at} />
                  </div>
                </div>
              </div>
            ) : null}
            {T.cue.map((t, n) => {
              const p = lin(frame, f(t), f(t) + 13);
              if (p <= 0 || p >= 1) return null;
              const r = 50 + 170 * smooth(p);
              return <div key={n} style={{ position: "absolute", left: RING_AT[n][0] - r, top: RING_AT[n][1] - r, width: 2 * r, height: 2 * r, borderRadius: "50%", boxSizing: "border-box", border: `${14 * (1 - p) + 3}px solid ${C.accent}`, opacity: 0.8 * (1 - p) }} />;
            })}
          </div>
        </div>
        <div style={{ position: "absolute", left: "50%", top: PHONE.bezel + 12, width: 96, height: 24, marginLeft: -48, borderRadius: 12, background: "#15171f" }} />
      </div>
      <div style={{ position: "absolute", left: PHONE.x, top: PHONE.y + PHONE.sh + 2 * PHONE.bezel + 18, width: PHONE.sw + 2 * PHONE.bezel, display: "flex", justifyContent: "center", opacity: Math.min(1, posted * 1.5), transform: `scale(${0.85 + 0.15 * posted})` }}>
        <div style={{ height: 44, padding: "0 20px 0 14px", borderRadius: 22, background: C.accent, color: "#fff", display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 600, boxShadow: "0 12px 26px -10px rgba(75,92,240,0.6)" }}>
          <Check size={20} color="#fff" />
          {TEXT.posted}
        </div>
      </div>
    </>
  );
};

/** Keeps only red pixels (alpha = 4R − 2G − 2B − 0.6): the handwriting word survives, sky and paper become transparent. */
const RedOnly: React.FC = () => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <filter id="red-only" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  4 -2 -2 0 -0.6" />
    </filter>
  </svg>
);

/** The picked clip flies from its card into the slot in the phone: the same picture, growing from thumbnail size to slot size. */
const Flight: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < f(T.flightFrom) || frame >= f(T.flightTo) + 2) return null;
  const p = smooth(lin(frame, f(T.flightFrom), f(T.flightTo)));
  const from = { x: PIPE.x + CARD.padX + PICKED * (THUMB.w + THUMB.gap), y: cardTop(1) + CARD.head + 2, w: THUMB.w, h: THUMB.h, r: 8 };
  const to = { x: PHONE.x + PHONE.bezel + CLIP.x * K, y: PHONE.y + PHONE.bezel + CLIP.y * K, w: CLIP.w * K, h: CLIP.h * K, r: CLIP.r * K };
  const m = (a: number, b: number) => a + (b - a) * p;
  // a slight arc upwards; the copy fades into the real video as it lands
  const arc = -46 * Math.sin(Math.PI * p);
  return (
    <div style={{ position: "absolute", left: m(from.x, to.x), top: m(from.y, to.y) + arc, width: m(from.w, to.w), height: m(from.h, to.h), borderRadius: m(from.r, to.r), overflow: "hidden", boxShadow: `0 24px 44px -14px rgba(38,40,100,${0.45 * (1 - p)})`, opacity: 1 - lin(frame, f(T.flightTo), f(T.flightTo) + 2) }}>
      <Img src={thumbSrc(PICKED)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
};

// ------------------------------------------------------------ sound
/** Every cue as its own named sequence ("SFX · …" in the Studio timeline), like SfxTrack in the kit. */
const Sfx: React.FC<{ volume: number }> = ({ volume }) => (
  <>
    {CUES.map((c, i) => {
      const s = SOUNDS[c.s];
      const frames = Math.ceil((c.dur ?? s.len) * 0.03) + (c.dur ? 0 : 2);
      const level = Math.min(1, vol(c) * volume);
      return (
        <Sequence key={i} from={Math.max(0, c.at - Math.round(s.lead * 0.03))} durationInFrames={frames} layout="none" name={`SFX · ${c.name}`}>
          <Audio src={staticFile(`sfx/${c.s}.wav`)} trimBefore={Math.round((c.from ?? 0) * 0.03)} volume={c.dur ? (fr) => level * interpolate(fr, [frames - 4, frames], [1, 0], CL) : level} />
        </Sequence>
      );
    })}
  </>
);

/** The real voice: once alone while it is "recorded" in step 1, then the whole mix of the finished video from step 4 on. */
const RealSound: React.FC<{ volume: number }> = ({ volume }) => {
  const playFrames = f(PLAY_MS / 1000);
  return (
    <>
      <Sequence from={f(T.rec)} durationInFrames={f(LINE_MS / 1000)} layout="none" name="Voice · the line being recorded">
        <Audio src={staticFile("voice-line.wav")} volume={0.5 * volume} />
      </Sequence>
      <Sequence from={f(T.play)} durationInFrames={playFrames} layout="none" name="Video · the finished video plays">
        {/* a little quieter once the person speaks again in step 5, and out before the closing */}
        <Audio src={staticFile("real-example.wav")} volume={(fr) => volume * interpolate(fr + f(T.play), [f(T.step[4]) - 6, f(T.step[4]) + 6], [0.55, 0.42], CL) * interpolate(fr, [playFrames - 10, playFrames - 1], [1, 0], CL)} />
      </Sequence>
    </>
  );
};

// ------------------------------------------------------------ composition
export const Flow: React.FC<{ sfxVolume: number; videoVolume: number }> = ({ sfxVolume, videoVolume }) => {
  const frame = useCurrentFrame();
  const inP = smooth(lin(frame, f(T.columns), f(T.columns) + 14));
  const outP = 1 - lin(frame, f(T.closing), f(T.closing) + 9);
  return (
    <Stage>
      <RedOnly />
      <Title />
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: Math.min(inP, outP), transform: `translateY(${(1 - inP) * 18 - (1 - outP) * 14}px)` }}>
        <div style={{ position: "absolute", left: CHAT.x, top: 56, fontFamily: MONO, fontSize: 21, fontWeight: 500, color: C.soft }}>{TEXT.brand}</div>
        <ColumnHead x={CHAT.x} text={TEXT.columns[0]} />
        <ColumnHead x={PIPE.x} text={TEXT.columns[1]} />
        <ColumnHead x={PHONE.x} text={TEXT.columns[2]} />
        <Chat />
        <Pipeline />
        <Phone />
        <Flight />
      </div>
      <Closing />
      <Sfx volume={sfxVolume} />
      <RealSound volume={videoVolume} />
    </Stage>
  );
};
