// PathRun: a dot runs a drawn path past markers, with a green trail, a tracking box that locks on and a dashed "ghost" trailing behind.
// Needs: ../lib/fonts.ts
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../lib/fonts";

type XY = [number, number];

export type PathRunProps = {
  /** Points the path bends through, in px of the 1080 x 1920 canvas (a smooth curve is drawn through them). Default: a slalom. */
  waypoints?: XY[];
  /** Cones / markers the path passes. Default: six cones along the slalom. */
  markers?: XY[];
  /** Playing field rectangle in px. */
  lane?: { x: number; y: number; w: number; h: number };
  /** Text in the tracking tag, e.g. "ID 01". */
  label?: string;
  /** Small title top left of the field. */
  title?: string;
  /** Frame on which the field draws in. */
  at?: number;
  /** Frames the run takes (default: until the end of the composition, minus the finish pulse). */
  frames?: number;
  /** Accent colour of trail, tracking box and finish pulse. */
  accent?: string;
};

const DEFAULT_LANE = { x: 150, y: 420, w: 780, h: 1180 };
const DEFAULT_MARKERS: XY[] = [
  [420, 1380],
  [660, 1230],
  [420, 1080],
  [660, 930],
  [420, 780],
  [660, 630],
];
const DEFAULT_WAYPOINTS: XY[] = [
  [540, 1540],
  [635, 1385],
  [445, 1230],
  [635, 1080],
  [445, 930],
  [635, 780],
  [445, 630],
  [540, 545],
];

/** Catmull-Rom spline through the points, sampled evenly. */
const spline = (pts: XY[], per = 24): XY[] => {
  const out: XY[] = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Top-down field with markers, a running dot and tracking. Black and white with one accent colour. */
export const PathRun: React.FC<PathRunProps> = ({ waypoints = DEFAULT_WAYPOINTS, markers = DEFAULT_MARKERS, lane = DEFAULT_LANE, label = "ID 01", title = "TRACKING", at = 0, frames, accent = "#12b76a" }) => {
  const frame = useCurrentFrame() - at;
  const { fps, width: W, height: H, durationInFrames } = useVideoConfig();
  const path = useMemo(() => spline(waypoints), [waypoints]);
  if (frame < 0) return null;
  const total = frames ?? Math.max(20, durationInFrames - at - 16);

  const laneIn = interpolate(frame, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const run = interpolate(frame, [6, total - 6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const idx = Math.min(path.length - 1, Math.round(run * (path.length - 1)));
  const pos = path[idx];
  const prev = path[Math.max(0, idx - 3)];
  const trailD = path
    .slice(0, idx + 1)
    .map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const ghost = path[Math.max(0, idx - 10)];

  const tag = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 180, mass: 0.7 } });
  const finish = run >= 1 ? spring({ frame: frame - (total - 6), fps, config: { damping: 9, stiffness: 170, mass: 0.7 } }) : 0;
  const speed = Math.min(1, Math.hypot(pos[0] - prev[0], pos[1] - prev[1]) / 10);
  const bottom = lane.y + lane.h;

  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <rect x={lane.x} y={lane.y} width={lane.w} height={lane.h} rx={36} fill="#f6f8f6" stroke="#111" strokeWidth={5} opacity={laneIn} />
        {[0.25, 0.5, 0.75].map((u) => (
          <line key={u} x1={lane.x + 30} x2={lane.x + lane.w - 30} y1={lane.y + lane.h * u} y2={lane.y + lane.h * u} stroke="#dfe6e0" strokeWidth={3} strokeDasharray="14 16" opacity={laneIn} />
        ))}
        <line x1={lane.x} x2={lane.x + lane.w} y1={bottom - 40} y2={bottom - 40} stroke="#111" strokeWidth={5} opacity={laneIn} />
        <line x1={lane.x} x2={lane.x + lane.w} y1={lane.y + 40} y2={lane.y + 40} stroke={accent} strokeWidth={8} opacity={laneIn} />

        {markers.map((c, i) => {
          const s = spring({ frame: frame - 2 - i * 1.5, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });
          return (
            <g key={i} transform={`translate(${c[0]} ${c[1]}) scale(${s})`}>
              <ellipse cx={0} cy={18} rx={34} ry={12} fill="rgba(0,0,0,0.12)" />
              <polygon points="0,-34 24,16 -24,16" fill="#111" />
              <rect x={-30} y={14} width={60} height={9} rx={4} fill="#111" />
            </g>
          );
        })}

        <path d={trailD} fill="none" stroke={accent} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <circle cx={ghost[0]} cy={ghost[1]} r={24} fill="none" stroke={accent} strokeWidth={5} strokeDasharray="8 8" opacity={Math.max(0, Math.min(1, tag)) * 0.8} />
        <circle cx={pos[0]} cy={pos[1]} r={30} fill="#111" stroke="#fff" strokeWidth={6} />
        <circle cx={pos[0]} cy={pos[1]} r={9} fill={accent} />

        {tag > 0 ? (
          <g transform={`translate(${pos[0]} ${pos[1]}) scale(${tag})`}>
            {(
              [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [1, 1],
              ] as const
            ).map(([sx, sy], i) => (
              <path key={i} d={`M ${sx * 78} ${sy * 78 - sy * 34} L ${sx * 78} ${sy * 78} L ${sx * 78 - sx * 34} ${sy * 78}`} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            <rect x={-78} y={-128} width={150} height={44} rx={10} fill="#111" />
            <text x={-64} y={-97} fontSize={26} fill="#fff" style={{ ...FONTS.sans, fontWeight: 700, letterSpacing: "0.02em" }}>
              {label}
            </text>
          </g>
        ) : null}

        {finish > 0 ? <circle cx={pos[0]} cy={pos[1]} r={40 + finish * 70} fill="none" stroke={accent} strokeWidth={8 * (1 - Math.min(1, finish) * 0.6)} opacity={Math.max(0, 1 - finish * 0.8)} /> : null}
      </svg>

      <div style={{ position: "absolute", left: lane.x, top: lane.y - 120, fontSize: 38, color: "#111", ...FONTS.sans, letterSpacing: "0.12em", opacity: laneIn }}>{title}</div>
      <div style={{ position: "absolute", right: W - lane.x - lane.w, top: lane.y - 116, width: 180, height: 34, borderRadius: 17, background: "#e8f6ee", overflow: "hidden", opacity: laneIn }}>
        <div style={{ width: `${14 + speed * 86}%`, height: "100%", background: accent, borderRadius: 17 }} />
      </div>
    </AbsoluteFill>
  );
};
