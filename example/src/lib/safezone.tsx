// Safe zones for Instagram Reels and TikTok: strips at the edge of the frame where the app overlays its own elements (header,
// description, like/comment/share). Nothing important goes there. Meant for 1080 × 1920 (9:16); the values are rules of thumb.
import React from "react";
import { AbsoluteFill } from "remotion";

/** Width and height of the canvas in pixels that `SAFE` is tuned for. */
const W = 1080;
const H = 1920;

/** Safe zones for Instagram Reels and TikTok at 1080×1920 (rules of thumb, as of 10/2026): top 250 px (header, tabs, search),
 *  bottom 480 px (name, description, sound, navigation), right 160 px from `railFrom` downward (profile picture, like, comment, share),
 *  left 60 px. Never put text, faces or pointers there; background, card edges and full-frame video may extend into them.
 *  It follows that important things end at y = 1440 at the bottom and at x = 920 on the right (from y = 860).
 *  Neither app publishes fixed dimensions for regular posts; after a redesign of the app, check again on a real phone. */
export const SAFE = { top: 250, bottom: 480, right: 160, railFrom: 860, left: 60 };

/** Check overlay: tints the safe zones. Switch it on only for checking (prop `safeZone`), and off again before rendering. */
export const SafeZoneGuide: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {[
      { left: 0, top: 0, width: W, height: SAFE.top },
      { left: 0, top: H - SAFE.bottom, width: W, height: SAFE.bottom },
      { left: W - SAFE.right, top: SAFE.railFrom, width: SAFE.right, height: H - SAFE.bottom - SAFE.railFrom },
      { left: 0, top: SAFE.top, width: SAFE.left, height: H - SAFE.top - SAFE.bottom },
    ].map((r, i) => (
      <div key={i} style={{ position: "absolute", ...r, background: "rgba(255,0,80,0.25)", outline: "3px dashed rgba(255,0,80,0.9)", outlineOffset: -3 }} />
    ))}
  </AbsoluteFill>
);
