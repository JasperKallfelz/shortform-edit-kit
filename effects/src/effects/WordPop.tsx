// WordPop: words and lines of text that pop in on a cue frame and stay (spring 0.7 -> 1, fade in 3 frames).
// Needs: ../lib/fonts.ts
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS, FontKey } from "../lib/fonts";

/** The pop fades in over this many frames. A word is fully visible on its cue frame, so the pop starts this many frames earlier. */
export const POP_LEAD = 3;

export type PopWord = {
  text: string;
  /** Cue frame: the word is fully visible on this frame (the pop starts POP_LEAD frames before). */
  at: number;
  /** Typeface: sans (bold grotesque), sansLight, serifItalic or script (handwriting). */
  font?: FontKey;
  /** Font size in px (1080 x 1920 canvas). */
  size: number;
  /** Centre of the word, in % of the frame width. */
  x: number;
  /** Centre of the word, in % of the frame height. */
  y: number;
  color?: string;
  weight?: number;
  /** Rotation in degrees. */
  rotate?: number;
  /** Frame on which the word disappears again (default: stays). */
  until?: number;
};

export type WordPopProps = {
  words: PopWord[];
  /** Default colour for words that set none. */
  color?: string;
  /** CSS text-shadow, e.g. for white words over video. */
  shadow?: string;
};

const Pop: React.FC<{ w: PopWord; color: string; shadow?: string }> = ({ w, color, shadow }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - (w.at - POP_LEAD);
  if (t < 0 || (w.until !== undefined && frame >= w.until)) return null;
  const s = spring({ frame: t, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const opacity = interpolate(t, [0, POP_LEAD], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: `${w.x}%`,
        top: `${w.y}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${w.rotate ?? 0}deg)`,
        opacity,
        color: w.color ?? color,
        fontSize: w.size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        textShadow: shadow,
        ...FONTS[w.font ?? "sans"],
        ...(w.weight ? { fontWeight: w.weight } : null),
      }}
    >
      {w.text}
    </div>
  );
};

/** Absolutely positioned words that pop in on their cue frames. Put it over a white card, an inset clip or anything else. */
export const WordPop: React.FC<WordPopProps> = ({ words, color = "#000", shadow }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {words.map((w, i) => (
      <Pop key={`${i}-${w.text}`} w={w} color={color} shadow={shadow} />
    ))}
  </AbsoluteFill>
);
