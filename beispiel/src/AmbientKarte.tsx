// AmbientKarte (3 s, 9:16): Probe für den Ambient-Light-Schein aus lib/ambient.tsx – nur eine Clip-Karte auf weißem Grund, ohne Text und Ton.
// Im Studio die Composition `AmbientKarte` wählen und rechts bei `clip` eine Datei aus public/ eintragen (Video oder Bild); leer = bunter Verlauf.
import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { AmbientInset } from "./lib/ambient";
import { SafeZoneGuide } from "./lib/safezone";

export const AMBIENT_KARTE_FRAMES = 90;

export const ambientKarteSchema = z.object({
  /** Dateiname unter public/ (z. B. "clip.mp4" oder "foto.jpg"); leer = bunter Verlauf als Platzhalter. */
  clip: z.string(),
  startSec: z.number().min(0),
  /** false = dieselbe Karte ohne Schein, zum Vergleichen. */
  glow: z.boolean(),
  /** true = färbt die Freihalte-Bereiche für Instagram/TikTok ein (lib/safezone.tsx). Nur zum Prüfen, vor dem Rendern aus. */
  safeZone: z.boolean(),
});
export type AmbientKarteProps = z.infer<typeof ambientKarteSchema>;

export const ambientKarteDefaults: AmbientKarteProps = { clip: "", startSec: 0, glow: true, safeZone: false };

export const AmbientKarte: React.FC<AmbientKarteProps> = ({ clip, startSec, glow, safeZone }) => (
  <AbsoluteFill style={{ background: "#fff" }}>
    <AmbientInset clip={clip} startSec={startSec} frames={AMBIENT_KARTE_FRAMES} glow={glow} />
    {safeZone ? <SafeZoneGuide /> : null}
  </AbsoluteFill>
);
