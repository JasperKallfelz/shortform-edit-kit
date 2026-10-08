// ScriptWord: one huge handwriting word that writes itself on (left-to-right wipe) and may overlap a clip.
// Needs: ../lib/fonts.ts
import React from "react";
import { interpolate, Easing, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../lib/fonts";

export type ScriptWordProps = {
  text: string;
  /** Cue frame: the word is completely written on this frame (the writing starts `writeFrames` earlier). */
  at: number;
  /** Font size in px. 450-520 spans the full width of a 1080 px frame for a word like "hello". */
  size?: number;
  /** Centre of the word, in % of the frame width / height. */
  x?: number;
  y?: number;
  color?: string;
  /** Pinyon Script only has one weight; 700 fakes a bolder pen. */
  weight?: number;
  /** Rotation in degrees. */
  rotate?: number;
  /** "write" = wipe from left to right, "pop" = spring scale like WordPop. */
  reveal?: "write" | "pop";
  /** Frames the writing takes. */
  writeFrames?: number;
};

/** Handwriting word. Put it after the clip in z-order so it lies over the clip's edge. */
export const ScriptWord: React.FC<ScriptWordProps> = ({ text, at, size = 480, x = 50, y = 50, color = "#e1251b", weight = 700, rotate = -3, reveal = "write", writeFrames = 12 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - (at - writeFrames);
  if (t < 0) return null;
  const p = reveal === "write" ? interpolate(t, [0, writeFrames], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }) : 1;
  const pop = reveal === "pop" ? spring({ frame: t, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } }) : 1;
  // soft-edged wipe: fully drawn left of `edge`, fading out over 10 % to the right of it
  const edge = p * 112 - 12;
  const mask = p >= 1 ? undefined : `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 12}%)`;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        // padding keeps the swashes of the script inside the mask box
        padding: "0.3em 0.4em",
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${reveal === "pop" ? interpolate(pop, [0, 1], [0.7, 1]) : 1})`,
        opacity: reveal === "pop" ? interpolate(t, [0, 3], [0, 1], { extrapolateRight: "clamp" }) : 1,
        color,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        maskImage: mask,
        WebkitMaskImage: mask,
        ...FONTS.script,
        fontWeight: weight,
      }}
    >
      {text}
    </div>
  );
};
