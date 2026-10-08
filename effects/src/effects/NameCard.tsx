// NameCard: a photo card with a lead-in line, a big name overlapping the top and a serif-italic extra ("& Someone").
// Needs: ../lib/fonts.ts
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../lib/fonts";

export type NameCardProps = {
  /** The photo (an <Img> or any element, objectFit: "cover"). */
  children: React.ReactNode;
  /** Small line above the name, e.g. "there I met". */
  lead?: string;
  /** The big name. */
  name: string;
  /** Serif-italic extra beside the name, e.g. "& Second Person". */
  also?: string;
  /** Frame on which the card pops in. */
  at?: number;
  /** Frames after `at` on which lead / name / extra are fully visible. */
  cues?: { lead: number; name: number; also: number };
  /** Card top in % of the frame height, card width in % of the frame width (3:4 portrait). */
  top?: number;
  width?: number;
  /** Scale of the photo at the end of the slow drift (1 = still). */
  drift?: number;
};

const POP_LEAD = 3;

/** Spring pop for one text. `cue` = frame on which it is fully visible. */
const useText = (cue: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - (cue - POP_LEAD);
  if (t < 0) return null;
  const s = spring({ frame: t, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  return { scale: interpolate(s, [0, 1], [0.7, 1]), opacity: interpolate(t, [0, POP_LEAD], [0, 1], { extrapolateRight: "clamp" }) };
};

const Text: React.FC<{ cue: number; text: string; x: number; y: number; size: number; font: "sans" | "sansLight" | "serifItalic" }> = ({ cue, text, x, y, size, font }) => {
  const p = useText(cue);
  if (!p) return null;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${p.scale})`, opacity: p.opacity, color: "#000", fontSize: size, lineHeight: 1, whiteSpace: "nowrap", ...FONTS[font] }}>
      {text}
    </div>
  );
};

/** Photo card plus its texts. Texts are placed for a 1080 x 1920 frame with a short name (about 4-6 letters at the default size). */
export const NameCard: React.FC<NameCardProps> = ({ children, lead, name, also, at = 0, cues = { lead: 3, name: 12, also: 26 }, top = 36, width = 64, drift = 1.05 }) => {
  const frame = useCurrentFrame() - at;
  const { fps, durationInFrames } = useVideoConfig();
  if (frame < 0) return null;
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const z = interpolate(frame, [0, Math.max(1, durationInFrames - at)], [1, drift], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${(100 - width) / 2}%`,
          top: `${top}%`,
          width: `${width}%`,
          aspectRatio: "3 / 4",
          transform: `scale(${interpolate(sp, [0, 1], [0.92, 1])})`,
          opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" }),
          boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
          borderRadius: 28,
          overflow: "hidden",
          background: "#dfe3ea",
        }}
      >
        <AbsoluteFill style={{ transform: `scale(${z})` }}>{children}</AbsoluteFill>
      </div>
      {lead ? <Text cue={at + cues.lead} text={lead} x={21} y={top - 19.5} size={76} font="sansLight" /> : null}
      <Text cue={at + cues.name} text={name} x={40} y={top - 12} size={200} font="sans" />
      {also ? <Text cue={at + cues.also} text={also} x={74} y={top - 5} size={110} font="serifItalic" /> : null}
    </AbsoluteFill>
  );
};
