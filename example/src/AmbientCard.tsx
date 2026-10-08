// AmbientCard (3 s, 9:16): test for the ambient-light glow from lib/ambient.tsx – just one clip card on a white background, without text and sound.
// In the studio, choose the composition `AmbientCard` and enter a file from public/ at `clip` on the right (video or image); empty = colorful gradient.
import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { AmbientInset } from "./lib/ambient";
import { SafeZoneGuide } from "./lib/safezone";

export const AMBIENT_CARD_FRAMES = 90;

export const ambientCardSchema = z.object({
  /** File name under public/ (e.g. "clip.mp4" or "photo.jpg"); empty = colorful gradient as a placeholder. */
  clip: z.string(),
  startSec: z.number().min(0),
  /** false = the same card without glow, for comparison. */
  glow: z.boolean(),
  /** true = tints the safe zones for Instagram/TikTok (lib/safezone.tsx). Only for checking, off before rendering. */
  safeZone: z.boolean(),
});
export type AmbientCardProps = z.infer<typeof ambientCardSchema>;

export const ambientCardDefaults: AmbientCardProps = { clip: "", startSec: 0, glow: true, safeZone: false };

export const AmbientCard: React.FC<AmbientCardProps> = ({ clip, startSec, glow, safeZone }) => (
  <AbsoluteFill style={{ background: "#fff" }}>
    <AmbientInset clip={clip} startSec={startSec} frames={AMBIENT_CARD_FRAMES} glow={glow} />
    {safeZone ? <SafeZoneGuide /> : null}
  </AbsoluteFill>
);
