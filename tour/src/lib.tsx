// Gemeinsame Bausteine: Farben, Maße, Hintergrund, Fenster mit abgerundeten Ecken, sanfter Zoom, Kapitel- und Bildunterzeile.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const SANS = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin", "latin-ext"] }).fontFamily;

export const W = 1920;
export const H = 1080;
export const FPS = 30;

/** Fenster: Außenmaße samt Titelleiste; der Inhalt hat das Seitenverhältnis der Aufnahme (16:10). */
export const WIN = { x: 280, y: 84, w: 1360, h: 888 };
export const BAR = 38;
export const CONTENT = { x: WIN.x, y: WIN.y + BAR, w: WIN.w, h: WIN.h - BAR };

export const COLORS = {
  ink: "#1d2033",
  inkSoft: "#4a4f6a",
  accent: "#4b5cf0",
  captionBg: "rgba(24, 26, 42, 0.86)",
};

/** Ruhiger Verlauf mit zwei weichen Lichtflecken, die sich sehr langsam bewegen. */
export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #dfe0ff 0%, #d3e6ff 42%, #ffe6d6 100%)", fontFamily: SANS }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${28 + Math.sin(t / 7) * 6}% ${30 + Math.cos(t / 9) * 6}%, rgba(255,255,255,0.55), transparent 70%), radial-gradient(1000px 800px at ${78 + Math.cos(t / 8) * 5}% ${80 + Math.sin(t / 6) * 5}%, rgba(255,210,190,0.45), transparent 70%)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export type ZoomKey = { t: number; s: number; u: number; v: number };
const ease = Easing.bezier(0.45, 0, 0.2, 1);

/** Zoom-Verlauf aus Schlüsselpunkten (Sekunden, Maßstab, Zielpunkt als Anteil des Fensterinhalts). Gibt translate/scale zurück. */
export function zoomAt(sec: number, keys: ZoomKey[]) {
  let s = 1, u = 0.5, v = 0.5;
  if (keys.length) {
    if (sec <= keys[0].t) ({ s, u, v } = keys[0]);
    else if (sec >= keys[keys.length - 1].t) ({ s, u, v } = keys[keys.length - 1]);
    else {
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (sec >= a.t && sec <= b.t) {
          const p = ease((sec - a.t) / (b.t - a.t || 1));
          s = a.s + (b.s - a.s) * p; u = a.u + (b.u - a.u) * p; v = a.v + (b.v - a.v) * p;
          break;
        }
      }
    }
  }
  const fx = CONTENT.x + u * CONTENT.w, fy = CONTENT.y + v * CONTENT.h;
  const cx = WIN.x + WIN.w / 2, cy = WIN.y + WIN.h / 2;
  const m = Math.min(1, Math.max(0, (s - 1) * 2));
  let tx = fx * (1 - s) + (cx - fx) * m, ty = fy * (1 - s) + (cy - fy) * m;
  // Das Fenster soll nie so verrutschen, dass daneben ein unnatürlicher Streifen Hintergrund entsteht
  const clamp = (val: number, a: number, b: number) => Math.min(Math.max(val, Math.min(a, b)), Math.max(a, b));
  tx = clamp(tx, -s * WIN.x, W - s * (WIN.x + WIN.w));
  ty = clamp(ty, -s * WIN.y, H - s * (WIN.y + WIN.h));
  return { tx, ty, s };
}

/** Das Fenster auf der Bühne: Schatten, Titelleiste, Ein- und Ausblenden, Zoom. */
export const Frame: React.FC<{
  title: string;
  tone: "dark" | "light";
  zoom: ZoomKey[];
  total: number; // Länge der Szene in Frames
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}> = ({ title, tone, zoom, total, fadeIn = 14, fadeOut = 12, children }) => {
  const frame = useCurrentFrame();
  const { tx, ty, s } = zoomAt(frame / FPS, zoom);
  const inP = Easing.out(Easing.cubic)(Math.min(1, frame / fadeIn));
  const outP = interpolate(frame, [total - fadeOut, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dark = tone === "dark";
  return (
    <AbsoluteFill style={{ opacity: inP * outP }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <div
          style={{
            position: "absolute", left: WIN.x, top: WIN.y + (1 - inP) * 18, width: WIN.w, height: WIN.h, borderRadius: 16, overflow: "hidden",
            background: dark ? "#14161d" : "#f4f3f0",
            boxShadow: "0 60px 120px -30px rgba(38, 40, 100, 0.45), 0 28px 56px -24px rgba(20, 20, 50, 0.5), 0 0 0 1px rgba(255,255,255,0.35)",
          }}
        >
          <div style={{ height: BAR, display: "flex", alignItems: "center", padding: "0 16px", background: dark ? "#1b1e27" : "#e9e7ee", borderBottom: dark ? "1px solid #262a35" : "1px solid #d9d6e0", position: "relative" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {["#ff6b62", "#f5bd4f", "#4cc764"].map((c) => (
                <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.9 }} />
              ))}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 15, fontWeight: 500, color: dark ? "#9aa1b5" : "#6b6980", letterSpacing: 0.2 }}>{title}</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: BAR, width: WIN.w, height: WIN.h - BAR, overflow: "hidden", background: dark ? "#14161d" : "#f4f3f0" }}>{children}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Kapitelmarke oben über dem Fenster. */
export const Chapter: React.FC<{ n: number; title: string; total: number }> = ({ n, title, total }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 12, total - 12, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", right: 56, top: 22, display: "flex", justifyContent: "flex-end", opacity: a, transform: `translateY(${(1 - a) * -8}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 22px 0 8px", borderRadius: 22, background: "rgba(255,255,255,0.72)", boxShadow: "0 6px 20px rgba(40,40,90,0.12)", color: COLORS.ink, fontSize: 24, fontWeight: 600, letterSpacing: -0.2 }}>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: COLORS.accent, color: "#fff", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
        {title}
      </div>
    </div>
  );
};

/** Eine Bildunterzeile unter dem Fenster. */
export const Caption: React.FC<{ text: string; total: number; delay?: number }> = ({ text, total, delay = 8 }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [delay, delay + 12, total - 14, total - 2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center", opacity: a, transform: `translateY(${(1 - a) * 10}px)` }}>
      <div style={{ maxWidth: 1560, padding: "13px 30px", borderRadius: 14, background: COLORS.captionBg, color: "#fff", fontSize: 29, fontWeight: 500, letterSpacing: -0.1, boxShadow: "0 10px 30px rgba(20,20,50,0.28)" }}>{text}</div>
    </div>
  );
};
