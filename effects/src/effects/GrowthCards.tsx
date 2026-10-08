// GrowthCards: four dashboard cards (line, bars, ring, metrics) that fly up one after the other while their charts grow upward.
// Needs: ../lib/fonts.ts
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../lib/fonts";

const GREEN = "#12b76a";
const GREEN_DARK = "#0a8f50";
const GREEN_SOFT = "#d9f5e6";
const CW = 455; // card width
const CH = 420; // card height
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type GrowthCardsProps = {
  /** Frame on which the first card flies in. */
  at?: number;
  /** Card titles: line chart, bar chart, ring, metric rows. */
  titles?: [string, string, string, string];
  /** Labels of the three metric rows in the fourth card. */
  rows?: [string, string, string];
  /** Top of the grid in px (1080 x 1920 canvas). The grid is 940 px wide and centred. */
  top?: number;
};

/** Deterministic rising series with a little wobble (no randomness: frames are rendered one by one). */
const series = (n: number, k: number, seed: number) =>
  Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    const base = (Math.exp(k * u) - 1) / (Math.exp(k) - 1);
    return Math.max(0.04, Math.min(1, base * 0.9 + 0.06 + Math.sin(i * 2.7 + seed) * 0.03));
  });

const Up: React.FC<{ x: number; y: number; size: number; color?: string; opacity?: number }> = ({ x, y, size, color = GREEN_DARK, opacity = 1 }) => (
  <polygon points={`${x},${y - size} ${x + size * 0.9},${y + size * 0.7} ${x - size * 0.9},${y + size * 0.7}`} fill={color} stroke={color} strokeWidth={size * 0.2} strokeLinejoin="round" opacity={opacity} />
);

const Card: React.FC<{ x: number; y: number; title: string; badge?: boolean; delay: number; children: (local: number) => React.ReactNode }> = ({ x, y, title, badge, delay, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;
  if (local < 0) return null;
  const p = spring({ frame: local, fps, config: { damping: 14, stiffness: 150, mass: 0.9 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: CW, height: CH, background: "#fff", borderRadius: 30, boxShadow: "0 14px 40px rgba(0,0,0,0.14)", border: "1px solid #ececec", transform: `translateY(${(1 - p) * 90}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`, opacity: p, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 28, top: 24, fontSize: 32, color: "#111", ...FONTS.sans, letterSpacing: "-0.02em" }}>{title}</div>
      <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} style={{ position: "absolute", inset: 0 }}>
        {badge ? <Up x={CW - 40} y={44} size={11} /> : null}
        {children(local)}
      </svg>
    </div>
  );
};

const Grid: React.FC = () => (
  <>
    {[0, 1, 2].map((i) => (
      <line key={i} x1={28} x2={CW - 28} y1={100 + (284 * i) / 2} y2={100 + (284 * i) / 2} stroke="#eee" strokeWidth={2} />
    ))}
  </>
);

const LINE = series(26, 2.7, 1);
const LineChart: React.FC<{ local: number }> = ({ local }) => {
  const X0 = 28, X1 = CW - 28, Y0 = 100, Y1 = CH - 36;
  const g = interpolate(local, [6, 46], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const n = Math.max(2, Math.round(g * (LINE.length - 1)) + 1);
  const pts = LINE.slice(0, n).map((v, i) => [X0 + ((X1 - X0) * i) / (LINE.length - 1), Y1 - v * (Y1 - Y0)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const tip = pts[pts.length - 1];
  return (
    <>
      <defs>
        <linearGradient id="growth-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GREEN} stopOpacity="0.35" />
          <stop offset="1" stopColor={GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Grid />
      <path d={`${d} L ${tip[0]} ${Y1} L ${X0} ${Y1} Z`} fill="url(#growth-line-fill)" />
      <path d={d} fill="none" stroke={GREEN_DARK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={tip[0]} cy={tip[1]} r={10} fill={GREEN_DARK} stroke="#fff" strokeWidth={4} />
    </>
  );
};

const BARS = series(9, 2.2, 3);
const BarChart: React.FC<{ local: number }> = ({ local }) => {
  const X0 = 30, X1 = CW - 30, Y0 = 100, Y1 = CH - 36;
  const bw = (X1 - X0) / BARS.length;
  return (
    <>
      <Grid />
      {BARS.map((v, i) => {
        const g = interpolate(local, [6 + i * 3, 6 + i * 3 + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const h = v * (Y1 - Y0) * g;
        const last = i === BARS.length - 1;
        return <rect key={i} x={X0 + i * bw + bw * 0.14} y={Y1 - h} width={bw * 0.72} height={h} rx={7} fill={last ? GREEN_DARK : GREEN} opacity={last ? 1 : 0.3 + 0.5 * (i / BARS.length)} />;
      })}
      <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="#222" strokeWidth={3} strokeLinecap="round" />
    </>
  );
};

const Ring: React.FC<{ local: number }> = ({ local }) => {
  const R = 100, CX = CW / 2, CY = 230;
  const g = interpolate(local, [6, 48], [0, 0.84], { ...clamp, easing: Easing.out(Easing.cubic) });
  const C = 2 * Math.PI * R;
  return (
    <>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={GREEN_SOFT} strokeWidth={30} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={GREEN} strokeWidth={30} strokeLinecap="round" strokeDasharray={`${C * g} ${C}`} transform={`rotate(-90 ${CX} ${CY})`} />
      <Up x={CX} y={CY - 4} size={34} />
    </>
  );
};

const SERIES_ROWS = [
  { seed: 5, k: 2.3 },
  { seed: 8, k: 2.8 },
  { seed: 11, k: 2.0 },
];
const Metrics: React.FC<{ local: number; rows: [string, string, string] }> = ({ local, rows }) => (
  <>
    {SERIES_ROWS.map((r, ri) => {
      const data = series(12, r.k, r.seed);
      const y0 = 100 + ri * 100;
      const g = interpolate(local, [8 + ri * 6, 8 + ri * 6 + 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
      const n = Math.max(2, Math.round(g * (data.length - 1)) + 1);
      const pts = data.slice(0, n).map((v, i) => [150 + (200 * i) / (data.length - 1), y0 + 64 - v * 56] as const);
      const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
      return (
        <g key={ri}>
          <text x={28} y={y0 + 42} fontSize={26} fill="#333" style={{ ...FONTS.sansLight, fontWeight: 600 }}>
            {rows[ri]}
          </text>
          <path d={d} fill="none" stroke={GREEN} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <rect x={CW - 80} y={y0 + 18} width={52} height={40} rx={20} fill={GREEN_SOFT} opacity={g} />
          <Up x={CW - 54} y={y0 + 37} size={8} opacity={g} />
        </g>
      );
    })}
  </>
);

/** 2 x 2 grid of cards, 940 px wide, centred. Pair it with a Counter above for the "numbers go up" look. */
export const GrowthCards: React.FC<GrowthCardsProps> = ({ at = 0, titles = ["Views", "Growth", "Goal", "Metrics"], rows = ["Reach", "Saves", "Shares"], top = 770 }) => {
  const GAP = 30;
  const x0 = (1080 - (2 * CW + GAP)) / 2;
  return (
    <>
      <Card x={x0} y={top} title={titles[0]} badge delay={at + 4}>
        {(l) => <LineChart local={l} />}
      </Card>
      <Card x={x0 + CW + GAP} y={top} title={titles[1]} badge delay={at + 9}>
        {(l) => <BarChart local={l} />}
      </Card>
      <Card x={x0} y={top + CH + GAP} title={titles[2]} badge delay={at + 14}>
        {(l) => <Ring local={l} />}
      </Card>
      <Card x={x0 + CW + GAP} y={top + CH + GAP} title={titles[3]} delay={at + 19}>
        {(l) => <Metrics local={l} rows={rows} />}
      </Card>
    </>
  );
};
