// CrowdWall: a wall of grey profile placeholders. The camera zooms out from one person, then a few light up (ring wave, sparkles) while the rest dims.
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

const COLS = 8;
const ROWS = 13;
const CELL = 125;
const DIAM = 100;
const BG = ["#ececec", "#dedede", "#d2d2d2", "#f2f2f2", "#e4e4e4"];
const FG = ["#a3a3a3", "#8c8c8c", "#b4b4b4", "#7a7a7a"];

export type CrowdHighlight = {
  /** Grid cell of the person (col 0-7, row 0-12). */
  col: number;
  row: number;
  /** Avatar shown when they light up (e.g. an <Img>). Default: a coloured silhouette. */
  face?: React.ReactNode;
};

export type CrowdWallProps = {
  /** The people who light up. The camera starts zoomed in on the first. */
  highlights?: CrowdHighlight[];
  /** Frames the zoom-out takes, counted from `at`. */
  zoomFrames?: number;
  /** Zoom factor at the start (1 = no zoom-out). */
  zoomFrom?: number;
  /** Frame on which the highlighted people light up and the wall dims. */
  highlightAt?: number;
  /** Opacity of the wall after the highlight. */
  dimTo?: number;
  /** Frame on which the effect starts. */
  at?: number;
};

const DEFAULT_HIGHLIGHTS: CrowdHighlight[] = [
  { col: 2, row: 5 },
  { col: 5, row: 8 },
];
const HUES = [212, 150, 28, 330];

const centerOf = (col: number, row: number): [number, number] => [(1080 - COLS * CELL) / 2 + col * CELL + CELL / 2, 62 + row * CELL + CELL / 2];

const Silhouette: React.FC<{ bg: string; fg: string; head?: number; shoulders?: number }> = ({ bg, fg, head = 17, shoulders = 30 }) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block" }}>
    <rect width="100" height="100" fill={bg} />
    <circle cx="50" cy="40" r={head} fill={fg} />
    <ellipse cx="50" cy="96" rx={shoulders + 6} ry="26" fill={fg} />
  </svg>
);

/** 4-pointed sparkle. */
const Sparkle: React.FC<{ x: number; y: number; size: number; p: number }> = ({ x, y, size, p }) => {
  if (p <= 0) return null;
  const s = size * p;
  return <path d={`M 0 ${-s} Q 0 0 ${s} 0 Q 0 0 0 ${s} Q 0 0 ${-s} 0 Q 0 0 0 ${-s} Z`} fill="#000" transform={`translate(${x} ${y})`} />;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Wall + zoom-out + highlight. Transparent where there is no wall: put it on white. */
export const CrowdWall: React.FC<CrowdWallProps> = ({ highlights = DEFAULT_HIGHLIGHTS, zoomFrames = 28, zoomFrom = 4.5, highlightAt = 36, dimTo = 0.14, at = 0 }) => {
  const frame = useCurrentFrame() - at;
  const { fps, width: W, height: H } = useVideoConfig();
  const cells = React.useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const [x, y] = centerOf(col, row);
        const pick = (k: string, n: number) => Math.floor(random(`wall-${k}-${i}`) * n);
        return { x, y, bg: BG[pick("bg", BG.length)], fg: FG[pick("fg", FG.length)], head: 15 + random(`wall-h-${i}`) * 5, shoulders: 26 + random(`wall-s-${i}`) * 8 };
      }),
    [],
  );
  const focus = centerOf(highlights[0].col, highlights[0].row);
  // camera: zoom out; the focus point travels from the frame centre to the first person's own cell
  const e = interpolate(frame, [0, zoomFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const S = Math.pow(zoomFrom, 1 - e);
  const anchor: [number, number] = [lerp(W / 2, focus[0], e), lerp(H / 2, focus[1], e)];
  const tx = anchor[0] - S * focus[0];
  const ty = anchor[1] - S * focus[1];
  const fade = interpolate(frame, [0, 4], [0, 1], clamp);
  const wallOpacity = interpolate(frame, [highlightAt, highlightAt + 8], [1, dimTo], clamp) * fade;
  const lit = (k: number) => (frame >= highlightAt + k * 5 ? spring({ frame: frame - highlightAt - k * 5, fps, config: { damping: 8, stiffness: 150, mass: 0.9 } }) : 0);

  return (
    <AbsoluteFill style={{ overflow: "hidden", isolation: "isolate" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${S})`, opacity: wallOpacity }}>
        {cells.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: c.x - DIAM / 2, top: c.y - DIAM / 2, width: DIAM, height: DIAM, borderRadius: "50%", overflow: "hidden" }}>
            <Silhouette bg={c.bg} fg={c.fg} head={c.head} shoulders={c.shoulders} />
          </div>
        ))}
      </div>
      {highlights.map((h, k) => {
        const [cx0, cy0] = centerOf(h.col, h.row);
        const cx = tx + S * cx0;
        const cy = ty + S * cy0;
        const hl = lit(k);
        const ring = Math.min(1, hl);
        const d = DIAM * S * (1 + hl * 1.15);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: cx - d / 2,
              top: cy - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: `0 10px 30px rgba(0,0,0,${0.14 + 0.1 * ring}), 0 0 0 ${5 * ring}px #fff, 0 0 0 ${9 * ring}px #000`,
              opacity: fade,
              zIndex: 10 - k,
            }}
          >
            {h.face ?? <Silhouette bg={`hsl(${HUES[k % HUES.length]} 70% 78%)`} fg={`hsl(${HUES[k % HUES.length]} 55% 38%)`} />}
          </div>
        );
      })}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, zIndex: 11, pointerEvents: "none", opacity: fade }}>
        {highlights.map((h, k) => {
          const [cx0, cy0] = centerOf(h.col, h.row);
          const x = tx + S * cx0;
          const y = ty + S * cy0;
          const hl = lit(k);
          const burst = interpolate(frame - highlightAt - k * 5, [0, 14], [0, 1], clamp);
          const pulse = (ph: number, sp: number) => Math.min(1, hl) * (0.75 + 0.25 * Math.sin((frame - highlightAt) / sp + ph + k));
          return (
            <React.Fragment key={k}>
              {burst > 0 && burst < 1 ? <circle cx={x} cy={y} r={DIAM / 2 + burst * 170} fill="none" stroke="#000" strokeWidth={6 * (1 - burst)} opacity={1 - burst} /> : null}
              {hl > 0.2 ? (
                <g>
                  <Sparkle x={x + 128} y={y - 126} size={40} p={pulse(0, 3)} />
                  <Sparkle x={x - 140} y={y - 80} size={26} p={pulse(2, 2.5)} />
                  <Sparkle x={x + 146} y={y + 96} size={24} p={pulse(4, 3.4)} />
                </g>
              ) : null}
            </React.Fragment>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
