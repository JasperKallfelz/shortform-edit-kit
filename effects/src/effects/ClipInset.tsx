// ClipInset: a rounded clip card on white that pops in (spring) and zooms slowly while it stays.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type ClipInsetProps = {
  /** The media: an <OffthreadVideo>, an <Img> or any element. Fills the card (use objectFit: "cover"). */
  children?: React.ReactNode;
  /** Frame on which the card pops in. */
  at?: number;
  /** Distance from the top, in % of the frame height. */
  top?: number;
  /** Card width, in % of the frame width. */
  width?: number;
  /** Aspect ratio as a CSS value. */
  aspect?: string;
  /** Corner radius in px. */
  radius?: number;
  /** Scale of the media at the end of the zoom (1 = no zoom). */
  zoomTo?: number;
  /** Point the zoom grows around, as CSS transform-origin inside the clip (e.g. "57% 42%" to push in on a face). */
  zoomOrigin?: string;
  /** Frames the zoom takes (default: until the end of the composition). */
  zoomFrames?: number;
};

/** Rounded 16:9 inset with soft shadow. The outer box carries the pop-in and fade, the media inside carries the slow zoom. */
export const ClipInset: React.FC<ClipInsetProps> = ({ children, at = 0, top = 37, width = 86, aspect = "16 / 9", radius = 28, zoomTo = 1.12, zoomOrigin = "50% 50%", zoomFrames }) => {
  const frame = useCurrentFrame() - at;
  const { fps, durationInFrames } = useVideoConfig();
  if (frame < 0) return null;
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const zoom = interpolate(frame, [0, zoomFrames ?? Math.max(1, durationInFrames - at)], [1, zoomTo], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: `${(100 - width) / 2}%`,
        top: `${top}%`,
        width: `${width}%`,
        aspectRatio: aspect,
        transform: `scale(${interpolate(sp, [0, 1], [0.92, 1])})`,
        opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        borderRadius: radius,
        overflow: "hidden",
        background: "#dfe3ea",
      }}
    >
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: zoomOrigin }}>{children}</AbsoluteFill>
    </div>
  );
};
