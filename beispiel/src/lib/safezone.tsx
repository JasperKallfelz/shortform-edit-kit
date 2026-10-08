// Freihalte-Bereiche für Instagram Reels und TikTok: Streifen am Bildrand, in denen die App ihre eigenen Elemente einblendet (Kopfzeile,
// Beschreibung, Like/Kommentar/Teilen). Dort liegt nie etwas Wichtiges. Gedacht für 1080 × 1920 (9:16); die Werte sind Richtwerte.
import React from "react";
import { AbsoluteFill } from "remotion";

/** Breite und Höhe der Fläche in Bildpunkten, auf die `SAFE` abgestimmt ist. */
const W = 1080;
const H = 1920;

/** Freihalte-Bereiche für Instagram Reels und TikTok auf 1080×1920 (Richtwerte, Stand 10/2026): oben 250 px (Kopfzeile, Tabs, Suche),
 *  unten 480 px (Name, Beschreibung, Ton, Navigation), rechts 160 px ab `railFrom` abwärts (Profilbild, Like, Kommentar, Teilen),
 *  links 60 px. Dort nie Text, Gesichter oder Zeiger; Hintergrund, Kartenränder und Vollbild-Video dürfen hinein.
 *  Daraus folgt: Wichtiges endet unten bei y = 1440 und rechts (ab y = 860) bei x = 920.
 *  Keine der beiden Apps veröffentlicht feste Maße für normale Beiträge; nach einem Redesign der App am echten Handy neu prüfen. */
export const SAFE = { top: 250, bottom: 480, right: 160, railFrom: 860, left: 60 };

/** Prüf-Overlay: färbt die Freihalte-Bereiche ein. Nur zum Prüfen einschalten (Prop `safeZone`), vor dem Rendern wieder aus. */
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
