// Ambient light: a clip card on a white background, with the same media behind it once more – enlarged, heavily blurred,
// brightened and more strongly colored. This way the video glows onto the white, like YouTube's ambient mode.
// Meant for 1080 × 1920 at 30 fps and a light background; on dark the glow is not visible.
import React from "react";
import { Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** The glow behind the card: how far it reaches (scale), how soft (blur in pixels, tuned to 1080 × 1920), how bright
 *  (brightness), how strong the colors are (saturate) and how opaque (opacity). On white, a glow can only tint, not brighten:
 *  without brightness > 1, dark material looks like a dirty shadow instead of light. */
export const AMBIENT = { scale: 1.07, blur: 58, brightness: 1.3, saturate: 1.8, opacity: 0.85 };

/** Placeholder while no clip is set: a colorful gradient, so that you can see the glow in the studio without material of your own. */
const PLACEHOLDER = "linear-gradient(135deg, #2f6df6 0%, #12b76a 55%, #f5b301 100%)";

const isImage = (file: string) => /\.(jpe?g|png|webp)$/i.test(file);

export type AmbientInsetProps = {
  /** File under public/ (video or image: jpg, png, webp). Empty = colorful gradient as a placeholder. */
  clip: string;
  /** Start point in the video in seconds (no effect for images). */
  startSec?: number;
  /** Length of the scene in frames: the slow zoom runs over this duration. */
  frames: number;
  /** Distance from the top in % of the frame height. */
  top?: number;
  /** Width of the card in % of the frame width. */
  width?: number;
  /** Aspect ratio of the card, as a CSS value. */
  aspect?: string;
  /** Corner radius in pixels. */
  radius?: number;
  /** Crop within the clip (CSS object-position), e.g. "50% 30%" for a person in the upper third. */
  focus?: string;
  /** Scale at the end of the zoom (1 = no zoom). */
  zoomTo?: number;
  /** Playback speed of the video (applies to card and glow alike). */
  rate?: number;
  /** false = card without glow (saves the second video layer). */
  glow?: boolean;
};

/** Rounded inset on a white card, optionally with an ambient-light glow. The outer frame carries position, pop-in (spring) and fade-in,
 *  so glow and card move together. The glow sits as a sibling UNDER the card and gets the same `startSec`
 *  and `rate`, otherwise the colors lag behind the picture. */
export const AmbientInset: React.FC<AmbientInsetProps> = ({ clip, startSec = 0, frames, top = 37, width = 86, aspect = "16 / 9", radius = 28, focus = "50% 50%", zoomTo = 1.08, rate = 1, glow = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const zoom = interpolate(frame, [0, frames], [1, zoomTo], { extrapolateRight: "clamp" });
  const fill: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: focus };
  const media = (style: React.CSSProperties) =>
    !clip ? (
      <div style={{ ...style, background: PLACEHOLDER }} />
    ) : isImage(clip) ? (
      <Img src={staticFile(clip)} style={style} />
    ) : (
      <OffthreadVideo src={staticFile(clip)} muted trimBefore={Math.round(startSec * fps)} playbackRate={rate} style={style} />
    );
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
          {media(fill)}
        </div>
      ) : null}
      {/* The shadow is smaller and paler than on the demo inset (0 10px 30px / 0.12), so that it does not dirty the glow. */}
      <div style={{ position: "absolute", inset: 0, boxShadow: "0 8px 22px rgba(0,0,0,0.10)", borderRadius: radius, overflow: "hidden", background: "#dfe3ea" }}>
        {media({ ...fill, transform: `scale(${zoom})` })}
      </div>
    </div>
  );
};
