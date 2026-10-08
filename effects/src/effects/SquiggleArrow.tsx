// SquiggleArrow: a hand-drawn arrow with a loop that draws itself from one point to another, then two strokes for the head.
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type Point = { x: number; y: number };

export type SquiggleArrowProps = {
  /** Where the line starts, in px of the 1080 x 1920 canvas (e.g. just under the end of a name). */
  from: Point;
  /** Where the arrow head points (e.g. the middle of a clip). Keep it at least ~350 px away from `from`, the loop needs room. */
  to: Point;
  /** Frame on which drawing starts. */
  at?: number;
  /** Frames the line takes to draw (the head follows 3 frames later). */
  frames?: number;
  color?: string;
  strokeWidth?: number;
  /** Size of the loop (1 = default, 0.6 = a small curl). */
  loop?: number;
  /** 1 or -1: which side the loop bulges to. */
  side?: 1 | -1;
};

// Loop shape in local coordinates: x runs sideways, y runs toward the target (px, relative to the start point).
const LOOP = [
  [85, 2, 129, 60, 97, 116],
  [71, 162, 1, 156, 1, 111],
  [1, 66, 71, 62, 85, 128],
] as const;

const build = (from: Point, to: Point, loop: number, side: 1 | -1) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const f = { x: dx / len, y: dy / len }; // forward: toward the target
  const n = { x: f.y * side, y: -f.x * side }; // sideways
  const P = (ox: number, oy: number): string => `${(from.x + n.x * ox + f.x * oy).toFixed(1)} ${(from.y + n.y * ox + f.y * oy).toFixed(1)}`;
  let d = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)}`;
  for (const [a, b, c, e, g, h] of LOOP) d += ` C ${P(a * loop, b * loop)} ${P(c * loop, e * loop)} ${P(g * loop, h * loop)}`;
  // last swoop: leaves the loop heading forward, arrives at the target coming in from the side
  const exit = LOOP[2];
  const approach = { x: to.x + n.x * 182, y: to.y + n.y * 182 };
  d += ` C ${P(99 * loop, exit[5] * loop + 70)} ${approach.x.toFixed(1)} ${approach.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  // head: two strokes opening backwards from the target, 35 degrees either side of the arrival direction
  const ax = to.x - approach.x;
  const ay = to.y - approach.y;
  const al = Math.hypot(ax, ay) || 1;
  const back = { x: -ax / al, y: -ay / al };
  const rot = (deg: number): Point => ({ x: back.x * Math.cos((deg * Math.PI) / 180) - back.y * Math.sin((deg * Math.PI) / 180), y: back.x * Math.sin((deg * Math.PI) / 180) + back.y * Math.cos((deg * Math.PI) / 180) });
  const head = [35, -35].map((deg) => {
    const r = rot(deg);
    return `M ${to.x.toFixed(1)} ${to.y.toFixed(1)} L ${(to.x + r.x * 42).toFixed(1)} ${(to.y + r.y * 42).toFixed(1)}`;
  });
  return { d, head };
};

/** Full-frame SVG overlay with the drawing arrow. Put it above the clip and the text it points from. */
export const SquiggleArrow: React.FC<SquiggleArrowProps> = ({ from, to, at = 0, frames = 12, color = "#e1251b", strokeWidth = 9, loop = 1, side = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { d, head } = useMemo(() => build(from, to, loop, side), [from, to, loop, side]);
  if (frame < at) return null;
  const line = interpolate(frame, [at, at + frames], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const tip = interpolate(frame, [at + frames, at + frames + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // pathLength 1 + dash pattern 1: strokeDashoffset 1 = nothing drawn, 0 = the whole line
  const pen = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {line > 0 ? <path d={d} {...pen} strokeDashoffset={1 - line} /> : null}
      {tip > 0 ? head.map((h) => <path key={h} d={h} {...pen} strokeDashoffset={1 - tip} />) : null}
    </svg>
  );
};
