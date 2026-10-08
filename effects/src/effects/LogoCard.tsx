// LogoCard: a logo that is "laid down like a card": spring from 75 % with a fade, plus one soft light sweep across it.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type LogoCardProps = {
  /** The logo: an <Img>, an inline <svg> or any element. */
  children: React.ReactNode;
  /** Frame on which the card lands. */
  at?: number;
  /** Width of the card in px (1080 px canvas). */
  width?: number;
  /** Centre height, in % of the frame height. */
  y?: number;
  /** Draw a white rounded card with shadow behind the logo. false = the bare logo. */
  card?: boolean;
  /** One light sweep across the card right after landing. */
  shine?: boolean;
};

/** Centred logo card. */
export const LogoCard: React.FC<LogoCardProps> = ({ children, at = 0, width = 880, y = 50, card = true, shine = true }) => {
  const frame = useCurrentFrame() - at;
  const { fps } = useVideoConfig();
  if (frame < 0) return null;
  const sp = spring({ frame, fps, config: { damping: 13, stiffness: 150, mass: 0.8 } });
  const sweep = interpolate(frame, [8, 26], [-40, 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: `${y}%`,
        width,
        transform: `translate(-50%, -50%) scale(${interpolate(sp, [0, 1], [0.75, 1])})`,
        opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
        display: "flex",
        justifyContent: "center",
        padding: card ? "90px 60px" : 0,
        boxSizing: "border-box",
        background: card ? "#fff" : undefined,
        borderRadius: card ? 44 : undefined,
        boxShadow: card ? "0 18px 50px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.06)" : undefined,
        overflow: "hidden",
      }}
    >
      {children}
      {card && shine ? (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(105deg, transparent ${sweep - 14}%, rgba(255,255,255,0.75) ${sweep}%, transparent ${sweep + 14}%)`, pointerEvents: "none" }} />
      ) : null}
    </div>
  );
};
