// Counter: a big number that races upward, accelerating, with a bobbing triangle. It never settles on a round end value.
// Needs: ../lib/fonts.ts
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../lib/fonts";

export type CounterProps = {
  /** Value reached when the count ends. */
  to: number;
  /** Start value. */
  from?: number;
  /** Frame on which the number pops in and starts counting. */
  at?: number;
  /** Frames the count takes (default: until the end of the composition, so it is still climbing at the cut). */
  frames?: number;
  /** Text before the number, e.g. "$". */
  prefix?: string;
  /** Text after the number, e.g. "K". */
  suffix?: string;
  color?: string;
  /** Font size in px. Nine digits at 168 reach the frame edges: shrink it for longer numbers. */
  size?: number;
  /** Top of the number in px (1080 x 1920 canvas). */
  top?: number;
  /** Acceleration: 1 = steady, 2.3 (default) = slow start, fast finish. */
  ease?: number;
  /** Show the bobbing triangle next to the number. */
  arrow?: boolean;
};

/** Racing counter. The number is centred, tabular so digits do not jitter. */
export const Counter: React.FC<CounterProps> = ({ to, from = 0, at = 0, frames, prefix = "", suffix = "", color = "#12b76a", size = 168, top = 800, ease = 2.3, arrow = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const local = frame - at;
  if (local < 0) return null;
  const total = frames ?? Math.max(1, durationInFrames - at);
  const value = from + (to - from) * Math.pow(Math.min(1, local / total), ease);
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  const bob = Math.sin(local / 4) * 7;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 24,
        transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`,
        opacity: interpolate(local, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      <div style={{ color, fontSize: size, lineHeight: 1, ...FONTS.sans, fontWeight: 900, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", textShadow: "0 6px 30px rgba(18,183,106,0.28)" }}>
        {prefix}
        {Math.round(value).toLocaleString("en-US")}
        {suffix}
      </div>
      {arrow ? (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100" style={{ transform: `translateY(${-bob}px)`, overflow: "visible" }}>
          <polygon points="50,12 92,88 8,88" fill={color} stroke={color} strokeWidth="8" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
};
