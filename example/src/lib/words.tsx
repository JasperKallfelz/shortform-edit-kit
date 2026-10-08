// Word DSL: every word has a font, size, position (% of the canvas) and an onset frame.
// Words pop in (spring 0.7 → 1, opacity over 3 frames) and stay.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { FONTS, FontKey } from "./fonts";

export const wordSchema = z.object({
  text: z.string(),
  at: z.number().int().nonnegative(),
  font: z.enum(["sans", "sansLight", "serifItalic", "script"]).default("sans"),
  size: z.number().positive(),
  x: z.number(),
  y: z.number(),
  weight: z.number().optional(),
  color: z.string().optional(),
  until: z.number().int().optional(),
  rotate: z.number().optional(),
});
export type Word = z.infer<typeof wordSchema>;

export const useWordPop = (at: number, until?: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0 || (until !== undefined && frame >= until)) return { opacity: 0, scale: 0.7, visible: false };
  const s = spring({ frame: t, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const opacity = interpolate(t, [0, 3], [0, 1], { extrapolateRight: "clamp" });
  return { opacity, scale, visible: true };
};

const WordItem: React.FC<{ w: Word; color: string; shadow?: string }> = ({ w, color, shadow }) => {
  const { opacity, scale, visible } = useWordPop(w.at, w.until);
  if (!visible) return null;
  const font = FONTS[w.font as FontKey];
  return (
    <div
      style={{
        position: "absolute",
        left: `${w.x}%`,
        top: `${w.y}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${w.rotate ?? 0}deg)`,
        transformOrigin: "center",
        opacity,
        color: w.color ?? color,
        fontSize: w.size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        textShadow: shadow,
        ...font,
        ...(w.weight ? { fontWeight: w.weight } : null),
      }}
    >
      {w.text}
    </div>
  );
};

/** Absolutely positioned words. `shadow` e.g. for white words over video. */
export const Words: React.FC<{ words: Word[]; color?: string; shadow?: string }> = ({ words, color = "#000", shadow }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {words.map((w, i) => (
      <WordItem key={`${i}-${w.text}`} w={w} color={color} shadow={shadow} />
    ))}
  </AbsoluteFill>
);

export const WHITE_SHADOW = "0 2px 18px rgba(0,0,0,0.45), 0 0 2px rgba(0,0,0,0.6)";

/** Helper: frames from seconds at 30 fps. */
export const s = (sec: number) => Math.round(sec * 30);
