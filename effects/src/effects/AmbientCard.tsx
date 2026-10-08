// AmbientCard: a clip card on white with an ambient-light glow (the same media again behind it, blown up, blurred and brightened).
// Made for 1080 x 1920 at 30 fps on a light background; on dark the glow is not visible.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** The glow behind the card: reach (scale), softness (blur in px, tuned for 1080 x 1920), brightness, colour strength (saturate) and opacity.
 *  On white a glow can only tint, not lighten: without brightness > 1 dark footage looks like a dirty shadow instead of light. */
export const AMBIENT = { scale: 1.07, blur: 58, brightness: 1.3, saturate: 1.8, opacity: 0.85 };

export type AmbientCardProps = {
  /** The media (video, image, any element). It is rendered twice – once for the card, once for the glow – so a video should be muted. */
  children: React.ReactNode;
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
  /** Scale of the media at the end of the slow zoom (1 = no zoom). */
  zoomTo?: number;
  /** Frames the zoom takes (default: until the end of the composition). */
  zoomFrames?: number;
  /** false = card without glow (saves the second media layer). */
  glow?: boolean;
};

/** Clip card with ambient light. The outer box carries position, pop-in and fade, so glow and card move together. The glow sits UNDER the card as a sibling. */
export const AmbientCard: React.FC<AmbientCardProps> = ({ children, at = 0, top = 37, width = 86, aspect = "16 / 9", radius = 28, zoomTo = 1.08, zoomFrames, glow = true }) => {
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
      }}
    >
      {glow ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${AMBIENT.scale})`,
            filter: `blur(${AMBIENT.blur}px) brightness(${AMBIENT.brightness}) saturate(${AMBIENT.saturate})`,
            opacity: AMBIENT.opacity,
            borderRadius: radius,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      ) : null}
      {/* the shadow is smaller and paler than ClipInset's so it does not dirty the glow */}
      <div style={{ position: "absolute", inset: 0, boxShadow: "0 8px 22px rgba(0,0,0,0.10)", borderRadius: radius, overflow: "hidden", background: "#dfe3ea" }}>
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>{children}</AbsoluteFill>
      </div>
    </div>
  );
};
