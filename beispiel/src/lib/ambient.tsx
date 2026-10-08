// Ambient Light: eine Clip-Karte auf weißem Grund, hinter der dasselbe Medium noch einmal liegt – vergrößert, stark weichgezeichnet,
// aufgehellt und kräftiger gefärbt. So scheint das Video auf das Weiß, wie beim Ambient-Modus von YouTube.
// Gedacht für 1080 × 1920 bei 30 fps und einen hellen Hintergrund; auf Dunkel ist der Schein nicht zu sehen.
import React from "react";
import { Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** Der Schein hinter der Karte: wie weit er reicht (scale), wie weich (blur in Bildpunkten, abgestimmt auf 1080 × 1920), wie hell
 *  (brightness), wie kräftig die Farben (saturate) und wie deckend (opacity). Auf Weiß kann ein Schein nur färben, nicht aufhellen:
 *  ohne brightness > 1 wirkt dunkles Material wie ein schmutziger Schatten statt wie Licht. */
export const AMBIENT = { scale: 1.07, blur: 58, brightness: 1.3, saturate: 1.8, opacity: 0.85 };

/** Platzhalter, solange kein Clip gesetzt ist: ein bunter Verlauf, damit man den Schein im Studio ohne eigenes Material sieht. */
const PLACEHOLDER = "linear-gradient(135deg, #2f6df6 0%, #12b76a 55%, #f5b301 100%)";

const isImage = (file: string) => /\.(jpe?g|png|webp)$/i.test(file);

export type AmbientInsetProps = {
  /** Datei unter public/ (Video oder Bild: jpg, png, webp). Leer = bunter Verlauf als Platzhalter. */
  clip: string;
  /** Startstelle im Video in Sekunden (bei Bildern ohne Wirkung). */
  startSec?: number;
  /** Länge der Szene in Frames: über diese Dauer läuft der langsame Zoom. */
  frames: number;
  /** Abstand von oben in % der Bildhöhe. */
  top?: number;
  /** Breite der Karte in % der Bildbreite. */
  width?: number;
  /** Seitenverhältnis der Karte, als CSS-Wert. */
  aspect?: string;
  /** Eckenradius in Bildpunkten. */
  radius?: number;
  /** Bildausschnitt im Clip (CSS object-position), z. B. "50% 30%" für eine Person im oberen Drittel. */
  focus?: string;
  /** Maßstab am Ende des Zooms (1 = kein Zoom). */
  zoomTo?: number;
  /** Abspielgeschwindigkeit des Videos (gilt für Karte und Schein gleichermaßen). */
  rate?: number;
  /** false = Karte ohne Schein (spart die zweite Videoebene). */
  glow?: boolean;
};

/** Abgerundetes Inset auf weißer Karte, optional mit Ambient-Light-Schein. Der äußere Rahmen trägt Lage, Einpoppen (Spring) und Einblenden,
 *  Schein und Karte bewegen sich also zusammen. Der Schein liegt als Geschwister UNTER der Karte und bekommt dieselben `startSec`
 *  und `rate`, sonst laufen die Farben dem Bild hinterher. */
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
      {/* Der Schatten ist kleiner und blasser als beim Inset der Demo (0 10px 30px / 0.12), damit er den Schein nicht verschmutzt. */}
      <div style={{ position: "absolute", inset: 0, boxShadow: "0 8px 22px rgba(0,0,0,0.10)", borderRadius: radius, overflow: "hidden", background: "#dfe3ea" }}>
        {media({ ...fill, transform: `scale(${zoom})` })}
      </div>
    </div>
  );
};
