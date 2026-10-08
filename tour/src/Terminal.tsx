// Ein selbst gezeichnetes Terminal: Befehle werden Zeichen für Zeichen getippt, die Ausgabe erscheint Zeile für Zeile.
// Es ist keine echte Terminal-Aufnahme: Text und Zeiten stehen in scripts.ts.
import React from "react";
import { Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FPS, MONO } from "./lib";

export type Item =
  | { k: "cmd"; lines: string[]; cps?: number }
  | { k: "out"; text: string; cls?: Cls; wait?: number; ts?: boolean }
  | { k: "gap"; frames: number }
  | { k: "clear" }
  | { k: "prompt" };
export type Cls = "dim" | "ok" | "head" | "key" | "warn" | "plain";

export type Row = { text: string; kind: "cmd" | "cont" | "out" | "prompt"; cls: Cls; ts: boolean; screen: number; start: number; cps: number };
export type Cue = { frame: number; s: string; vol: number };

export function build(items: Item[], startFrame = 10, pace = 1): { rows: Row[]; cues: Cue[]; end: number } {
  const rows: Row[] = [], cues: Cue[] = [];
  let t = startFrame, screen = 0, keyN = 0;
  const keys = ["key1", "key2", "key3", "key2"];
  for (const it of items) {
    if (it.k === "gap") t += it.frames * pace;
    else if (it.k === "clear") { screen++; t += 6; }
    else if (it.k === "prompt") { rows.push({ text: "", kind: "prompt", cls: "plain", ts: false, screen, start: t, cps: 0 }); }
    else if (it.k === "out") {
      t += (it.wait ?? 3) * pace;
      rows.push({ text: it.text, kind: "out", cls: it.cls ?? "plain", ts: !!it.ts, screen, start: t, cps: 0 });
    } else {
      const cps = (it.cps ?? 24) * 1.25;
      const per = FPS / cps;
      it.lines.forEach((ln, li) => {
        rows.push({ text: ln, kind: li === 0 ? "cmd" : "cont", cls: "plain", ts: false, screen, start: Math.round(t), cps });
        for (let i = 0; i < ln.length; i++) {
          if (ln[i] !== " " && i % 3 === 0) cues.push({ frame: Math.round(t + i * per), s: keys[keyN++ % keys.length], vol: 0.1 });
        }
        t += ln.length * per + 2;
      });
      cues.push({ frame: Math.round(t + 4), s: "key3", vol: 0.14 }); // Eingabetaste
      t += 12;
    }
  }
  return { rows, cues, end: t };
}

const COL: Record<Cls, string> = { plain: "#dfe3ee", dim: "#7f879d", ok: "#7fe3a9", head: "#8db6ff", key: "#ffd37a", warn: "#ffb26b" };

// sehr einfache Einfärbung für TypeScript-Zeilen
function tsSpans(line: string): React.ReactNode {
  const m = line.match(/^(\s*)(\/\/.*|\/\*\*.*\*\/)$/);
  if (m) return <><span>{m[1]}</span><span style={{ color: "#6f7790" }}>{m[2]}</span></>;
  const parts = line.split(/("[^"]*"|\b\d+\b|\bexport\b|\bconst\b)/g);
  return parts.map((p, i) => {
    if (/^"/.test(p)) return <span key={i} style={{ color: "#8be0a8" }}>{p}</span>;
    if (/^\d+$/.test(p)) return <span key={i} style={{ color: "#ffd37a" }}>{p}</span>;
    if (p === "export" || p === "const") return <span key={i} style={{ color: "#c4a4ff" }}>{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

const LINE = 31;
export const Terminal: React.FC<{ rows: Row[]; cues: Cue[]; fontSize?: number; visibleRows?: number }> = ({ rows, cues, fontSize = 21, visibleRows = 25 }) => {
  const frame = useCurrentFrame();
  const shown = rows.filter((r) => frame >= r.start);
  const screen = shown.length ? shown[shown.length - 1].screen : 0;
  const cur = shown.filter((r) => r.screen === screen);
  const offset = Math.max(0, cur.length - visibleRows);
  const last = cur[cur.length - 1];
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#12141b", fontFamily: MONO, fontSize, lineHeight: `${LINE}px`, color: COL.plain, padding: "26px 40px", whiteSpace: "pre", overflow: "hidden" }}>
      <div style={{ transform: `translateY(${-offset * LINE}px)` }}>
        {cur.map((r, i) => {
          const n = r.kind === "out" || r.kind === "prompt" ? r.text.length : Math.min(r.text.length, Math.floor(((frame - r.start) * r.cps) / FPS) + 1);
          const text = r.text.slice(0, n);
          const isLast = r === last;
          const cursor = isLast && blink ? <span style={{ display: "inline-block", width: Math.round(fontSize * 0.58), height: fontSize + 2, background: "#cfd5e6", verticalAlign: -3, marginLeft: 1 }} /> : null;
          if (r.kind === "cmd" || r.kind === "prompt")
            return (
              <div key={i}>
                <span style={{ color: "#7fe3a9" }}>$ </span>
                <span>{text}</span>
                {cursor}
              </div>
            );
          if (r.kind === "cont")
            return (
              <div key={i}>
                <span>{"  "}</span>
                <span>{text}</span>
                {cursor}
              </div>
            );
          return (
            <div key={i} style={{ color: COL[r.cls], fontWeight: r.cls === "head" ? 500 : 400 }}>
              {r.ts ? tsSpans(text) : text || " "}
              {cursor}
            </div>
          );
        })}
      </div>
      {cues.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={30} layout="none">
          <Audio src={staticFile(`sfx/${c.s}.wav`)} volume={c.vol} />
        </Sequence>
      ))}
    </div>
  );
};
