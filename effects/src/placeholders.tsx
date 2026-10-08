// Neutral placeholder imagery for the demo compositions: everything is drawn in code (gradients, simple SVG shapes).
// The effects themselves never import this file – you pass your own clips, photos and logos as children.
import React from "react";
import { useCurrentFrame } from "remotion";
import { FONTS } from "./lib/fonts";

/** Landscape scene (sky, sun, clouds, hills, a small figure). The clouds drift with time so zooms and glows are visible. */
export const SceneArt: React.FC<{ hue?: number }> = ({ hue = 210 }) => {
  const t = useCurrentFrame();
  const sky = `sky-${hue}`;
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 85% 58%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 30} 90% 84%)`} />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${sky})`} />
      <circle cx="1180" cy="280" r="120" fill="#fff3c4" />
      <g fill="#fff" opacity="0.92">
        <ellipse cx={300 + t * 2.4} cy="220" rx="170" ry="48" />
        <ellipse cx={420 + t * 2.4} cy="190" rx="120" ry="44" />
        <ellipse cx={900 - t * 1.6} cy="330" rx="150" ry="40" />
      </g>
      <path d="M0 640 C 300 520, 600 560, 900 640 S 1400 560, 1600 620 L1600 900 L0 900 Z" fill="hsl(138 40% 46%)" />
      <path d="M0 740 C 400 650, 800 770, 1200 700 S 1500 690, 1600 720 L1600 900 L0 900 Z" fill="hsl(146 46% 31%)" />
      <circle cx="760" cy="600" r="30" fill="#2b2f3a" />
      <path d="M718 760 C 718 660, 802 660, 802 760 Z" fill="#2b2f3a" />
    </svg>
  );
};

/** Portrait placeholder: soft gradient with a person silhouette. */
export const PortraitArt: React.FC<{ hue?: number }> = ({ hue = 200 }) => (
  <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
    <defs>
      <linearGradient id={`portrait-${hue}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={`hsl(${hue} 70% 78%)`} />
        <stop offset="1" stopColor={`hsl(${hue + 40} 65% 58%)`} />
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill={`url(#portrait-${hue})`} />
    <circle cx="150" cy="155" r="62" fill="rgba(255,255,255,0.88)" />
    <path d="M30 400 C 30 270, 270 270, 270 400 Z" fill="rgba(255,255,255,0.88)" />
  </svg>
);

/** Generic logo: a geometric mark plus a wordmark. */
export const LogoMark: React.FC<{ color?: string }> = ({ color = "#111" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r="58" fill="none" stroke={color} strokeWidth="14" />
      <path d="M40 82 L65 36 L90 82 Z" fill={color} />
    </svg>
    <div style={{ color, fontSize: 118, lineHeight: 1, ...FONTS.sans }}>Your Logo</div>
  </div>
);

/** Section background used by several demos: plain white. */
export const White: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", inset: 0, background: "#fff", overflow: "hidden" }}>{children}</div>
);
