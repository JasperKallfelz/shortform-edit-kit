// PhotoCollage: a wall of photo tiles in a packed grid. The tiles drop in one after the other (spring, slight tilt) and float a little.
import React, { useMemo } from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type CollageTile = {
  /** Height / width of the tile (4/3 = portrait photo, 1.66 = tall video, 9/16 = landscape). */
  ratio: number;
  /** Number of grid columns the tile spans (default 1). */
  span?: number;
  /** The photo or clip (any element, fills the tile). Default: a coloured placeholder. */
  content?: React.ReactNode;
};

export type PhotoCollageProps = {
  /** Tiles in placement order: each goes into the currently lowest column. Default: one wide tile plus 28 placeholders. */
  tiles?: CollageTile[];
  /** Frame on which the first tile drops in. */
  at?: number;
  /** Where the wall sits in px of the 1080 x 1920 canvas. Columns are stretched so the wall ends flush at `bottom`. */
  area?: { left: number; right: number; top: number; bottom: number };
  cols?: number;
  /** Gap between tiles in px. */
  gap?: number;
  /** Frames between two tiles dropping in. */
  stagger?: number;
};

/** Art for a placeholder tile: a hue by index and one of four simple scenes. */
const TileArt: React.FC<{ i: number }> = ({ i }) => {
  const hue = (i * 47 + 200) % 360;
  const bg = `hsl(${hue} 70% 72%)`;
  const dark = `hsl(${(hue + 25) % 360} 55% 38%)`;
  const light = `hsl(${(hue + 50) % 360} 80% 88%)`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="100" height="100" fill={bg} />
      {i % 4 === 0 ? <circle cx="68" cy="30" r="14" fill={light} /> : null}
      {i % 4 === 1 ? <path d="M-10 30 L110 70 L110 100 L-10 100 Z" fill={light} opacity="0.7" /> : null}
      {i % 4 === 2 ? (
        <>
          <circle cx="35" cy="45" r="22" fill={light} opacity="0.8" />
          <circle cx="60" cy="55" r="22" fill={dark} opacity="0.5" />
        </>
      ) : null}
      {i % 4 === 3 ? <rect x="18" y="18" width="64" height="40" rx="6" fill={light} opacity="0.85" /> : null}
      <path d="M-10 78 C 20 58, 50 88, 110 66 L110 110 L-10 110 Z" fill={dark} />
    </svg>
  );
};

const RATIOS = [1.66, 4 / 3, 1.66, 4 / 3, 4 / 3, 1.66, 3 / 4, 4 / 3, 1.66];
/** Default tiles: a wide 16:9 tile first, one two-column tile, then a mix of tall and portrait tiles. */
export const DEFAULT_TILES: CollageTile[] = [
  { ratio: 9 / 16, span: 3 },
  { ratio: 9 / 16, span: 2 },
  ...Array.from({ length: 27 }, (_, k): CollageTile => ({ ratio: RATIOS[k % RATIOS.length] })),
];

const DEFAULT_AREA = { left: 12, right: 1068, top: 476, bottom: 1890 };

type Spec = { cx: number; cy: number; w: number; h: number; rot: number; delay: number; z: number };

/** Packed layout: every tile goes into the lowest column (group of columns), then each column is stretched to the full wall height. */
const layout = (tiles: CollageTile[], area: { left: number; right: number; top: number; bottom: number }, cols: number, gap: number, stagger: number): Spec[] => {
  const pitch = (area.right - area.left) / cols;
  const colH: number[] = new Array(cols).fill(0);
  type Box = { col: number; span: number; y0: number; w: number; h: number };
  const place = (spanIn: number, ratio: number): Box => {
    const span = Math.min(cols, Math.max(1, spanIn));
    let col = 0;
    let y0 = Infinity;
    for (let c = 0; c + span <= cols; c++) {
      const m = Math.max(...colH.slice(c, c + span));
      if (m < y0 - 0.5) {
        y0 = m;
        col = c;
      }
    }
    const w = pitch * span - gap;
    const h = w * ratio;
    for (let c = col; c < col + span; c++) colH[c] = y0 + h + gap;
    return { col, span, y0, w, h };
  };
  const boxes = tiles.map((t) => place(t.span ?? 1, t.ratio));
  // stretch or squeeze every column to the full wall height: only one-column tiles change height, so the wall closes flush at the bottom
  const total = area.bottom - area.top;
  for (let c = 0; c < cols; c++) {
    const inCol = boxes.filter((b) => b.col <= c && c < b.col + b.span).sort((a, b) => a.y0 - b.y0);
    const flex = inCol.filter((b) => b.span === 1);
    if (flex.length === 0) continue;
    const fixed = inCol.filter((b) => b.span > 1).reduce((s, b) => s + b.h + gap, 0);
    const k = (total - fixed - gap * (flex.length - 1)) / flex.reduce((s, b) => s + b.h, 0);
    let y = 0;
    for (const b of inCol) {
      if (b.span > 1) {
        y = Math.max(y, b.y0 + b.h + gap);
        continue;
      }
      b.y0 = y;
      b.h *= k;
      y += b.h + gap;
    }
  }
  // drop order: first tile first, the others shuffled (deterministic)
  const order = tiles
    .map((_, k) => k)
    .slice(1)
    .map((k) => ({ k, r: random(`collage-order-${k}`) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.k);
  const rank: number[] = [];
  order.forEach((k, n) => (rank[k] = n));
  return boxes.map((b, i) => ({
    cx: area.left + pitch * b.col + (pitch * b.span) / 2 + (i === 0 ? 0 : (random(`collage-x-${i}`) - 0.5) * 6),
    cy: area.top + b.y0 + b.h / 2,
    w: b.w,
    h: b.h,
    rot: i === 0 ? -1.5 : (random(`collage-r-${i}`) - 0.5) * 5,
    delay: i === 0 ? 0 : 1 + Math.round(rank[i] * stagger),
    z: i === 0 ? 60 : 20 + Math.floor(random(`collage-z-${i}`) * 30),
  }));
};

const Tile: React.FC<{ spec: Spec; i: number; at: number; children: React.ReactNode }> = ({ spec, i, at, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - at - spec.delay;
  if (local < 0) return null;
  const sp = spring({ frame: local, fps, config: { damping: 12, stiffness: 170, mass: 0.8 } });
  const big = spec.w > 300;
  const float = Math.sin((frame + i * 9) / 20) * (big ? 4 : 2.5);
  return (
    <div
      style={{
        position: "absolute",
        left: spec.cx - spec.w / 2,
        top: spec.cy - spec.h / 2,
        width: spec.w,
        height: spec.h,
        zIndex: spec.z,
        transform: `translateY(${float + (1 - sp) * -140}px) rotate(${spec.rot + (1 - sp) * -8}deg) scale(${interpolate(sp, [0, 1], [0.55, 1])})`,
        opacity: interpolate(local, [0, 5], [0, 1], { extrapolateRight: "clamp" }),
        border: `${big ? 7 : 4}px solid #fff`,
        borderRadius: big ? 16 : 10,
        boxShadow: big ? "0 14px 34px rgba(0,0,0,0.22)" : "0 6px 16px rgba(0,0,0,0.22)",
        overflow: "hidden",
        background: "#dfe3ea",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
};

/** The wall. Leave the top of the frame free for a headline (default `area.top` is 476 px). */
export const PhotoCollage: React.FC<PhotoCollageProps> = ({ tiles = DEFAULT_TILES, at = 0, area = DEFAULT_AREA, cols = 6, gap = 8, stagger = 1.1 }) => {
  const specs = useMemo(() => layout(tiles, area, cols, gap, stagger), [tiles, area, cols, gap, stagger]);
  return (
    <>
      {tiles.map((t, i) => (
        <Tile key={i} spec={specs[i]} i={i} at={at}>
          {t.content ?? <TileArt i={i} />}
        </Tile>
      ))}
    </>
  );
};
