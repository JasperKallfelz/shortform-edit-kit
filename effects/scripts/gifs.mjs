#!/usr/bin/env node
// Renders every demo composition and writes docs/effects/<kebab-name>.gif (about 270 px wide, 12-15 fps, palette GIF via ffmpeg).
//
//   npm run gifs                    all effects
//   npm run gifs -- WordPop MapRoute   only these
//
// Needs ffmpeg on the PATH. Budget: each GIF under ~700 KB, the whole set under ~7 MB; the script re-encodes with fewer colours /
// frames per second until a GIF fits and prints a table at the end.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderFrames } from "@remotion/renderer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, "../docs/effects");
const workDir = path.join(root, "out", "gif-frames");
const WIDTH = Number(process.env.GIF_WIDTH ?? 270);
const MAX_BYTES = 700 * 1024;
const MAX_TOTAL = 7 * 1024 * 1024;
// encoder settings, best quality first; the first one that fits the size budget wins
// (error-diffusion dithering looks best on gradients but blows up the size of busy scenes, so "none" is the fallback)
const ATTEMPTS = [
  { fps: 15, colors: 128, dither: "sierra2_4a" },
  { fps: 15, colors: 128, dither: "none" },
  { fps: 15, colors: 96, dither: "none" },
  { fps: 12, colors: 96, dither: "none" },
  { fps: 12, colors: 64, dither: "none" },
];

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const encode = (framesGlob, target, a) => {
  const filter = `fps=${a.fps},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${a.colors}:stats_mode=diff[p];[s1][p]paletteuse=dither=${a.dither}:diff_mode=rectangle`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "15", "-pattern_type", "glob", "-i", framesGlob, "-filter_complex", filter, "-loop", "0", target], { stdio: "inherit" });
  return fs.statSync(target).size;
};

const only = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(workDir, { recursive: true, force: true });

console.log("bundling ...");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const comps = (await getCompositions(serveUrl)).filter((c) => only.length === 0 || only.includes(c.id));
if (comps.length === 0) throw new Error(`no composition matches ${only.join(", ")}`);

const rows = [];
for (const composition of comps) {
  const dir = path.join(workDir, composition.id);
  fs.mkdirSync(dir, { recursive: true });
  // render at half size (540 x 960), every second frame = 15 fps; ffmpeg then shrinks with lanczos, which keeps the text crisp
  await renderFrames({
    composition,
    serveUrl,
    outputDir: dir,
    imageFormat: "png",
    scale: 0.5,
    everyNthFrame: 2,
    onStart: () => undefined,
    onFrameUpdate: () => undefined,
  });
  const target = path.join(outDir, `${kebab(composition.id)}.gif`);
  let size = 0;
  let used = ATTEMPTS[0];
  for (const a of ATTEMPTS) {
    used = a;
    size = encode(path.join(dir, "element-*.png"), target, a);
    if (size <= MAX_BYTES) break;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  rows.push({ id: composition.id, file: path.relative(path.resolve(root, ".."), target), kb: Math.round(size / 1024), fps: used.fps, colors: used.colors, ok: size <= MAX_BYTES });
  console.log(`${composition.id.padEnd(14)} ${String(Math.round(size / 1024)).padStart(4)} KB  ${used.fps} fps  ${used.colors} colours${size <= MAX_BYTES ? "" : "  (OVER BUDGET)"}`);
}
fs.rmSync(workDir, { recursive: true, force: true });

const total = rows.reduce((s, r) => s + r.kb * 1024, 0);
console.log(`\n${rows.length} GIFs, ${(total / 1024 / 1024).toFixed(2)} MB total in ${path.relative(process.cwd(), outDir) || "."}`);
if (rows.some((r) => !r.ok)) console.warn("warning: some GIFs are over 700 KB");
if (only.length === 0 && total > MAX_TOTAL) console.warn("warning: the set is over 7 MB");
