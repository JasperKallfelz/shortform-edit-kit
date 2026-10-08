// Plays a capture in segments (time-lapse in idle phases, jumps over messages), all given in raw time.
import React from "react";
import { OffthreadVideo, Sequence, staticFile } from "remotion";
import { FPS } from "./lib";

export type Seg = { from: number; to: number; speed?: number };
export type SegPlan = (Seg & { start: number; dur: number })[];

export function plan(segs: Seg[]): SegPlan {
  let acc = 0;
  return segs.map((sg) => {
    const dur = (sg.to - sg.from) / (sg.speed ?? 1);
    const o = { ...sg, start: acc, dur };
    acc += dur;
    return o;
  });
}
export const planSeconds = (segs: Seg[]) => plan(segs).reduce((a, b) => a + b.dur, 0);

/** Raw time (seconds in the capture) → time in the scene; if it falls into a skipped part, the start of the next segment applies. */
export function rawToLocal(segs: Seg[], raw: number): number {
  const p = plan(segs);
  for (const sg of p) {
    if (raw <= sg.from) return sg.start;
    if (raw <= sg.to) return sg.start + (raw - sg.from) / (sg.speed ?? 1);
  }
  const last = p[p.length - 1];
  return last.start + last.dur;
}

export const CaptureVideo: React.FC<{ name: string; segs: Seg[] }> = ({ name, segs }) => (
  <>
    {plan(segs).map((sg, i) => (
      <Sequence key={i} from={Math.round(sg.start * FPS)} durationInFrames={Math.max(1, Math.round(sg.dur * FPS))} layout="none">
        <OffthreadVideo
          src={staticFile(`captures/${name}.mp4`)}
          muted
          trimBefore={Math.round(sg.from * FPS)}
          playbackRate={sg.speed ?? 1}
          style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Sequence>
    ))}
  </>
);
