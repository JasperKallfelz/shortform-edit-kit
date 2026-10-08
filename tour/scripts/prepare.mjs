// Prepares public/ for Remotion: scales the captures to display size, copies the demo video and the sounds that are used,
// and writes the time marks of the captures to src/marks.json. Run in the tour/ folder:  npm run prepare-media
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const kit = path.resolve(root, "..");
const pub = path.join(root, "public");
fs.mkdirSync(path.join(pub, "captures"), { recursive: true });
fs.mkdirSync(path.join(pub, "sfx"), { recursive: true });

const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) { console.error(`${cmd} failed`); process.exit(1); }
};

const names = ["voice-studio", "props", "timeline", "listen"];
const marks = {};
for (const n of names) {
  const raw = path.join(root, "captures", `${n}.mp4`);
  if (!fs.existsSync(raw)) { console.error(`Missing: ${raw} (see README.md, section "Re-record")`); process.exit(1); }
  // 2720 x 1700 = twice the display size of the window content: sharp up to zoom 2, much lighter to render than 3200 x 2000
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", "scale=2720:1700:flags=lanczos", "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", path.join(pub, "captures", `${n}.mp4`)]);
  marks[n] = JSON.parse(fs.readFileSync(path.join(root, "captures", `${n}.json`), "utf8"));
}
fs.writeFileSync(path.join(root, "src", "marks.json"), JSON.stringify(marks, null, 1) + "\n");

fs.copyFileSync(path.join(kit, "example", "demo.mp4"), path.join(pub, "demo.mp4"));
for (const s of ["page1", "page2", "page3", "shutter3", "key1", "key2", "key3", "switch2"]) {
  fs.copyFileSync(path.join(kit, "sfx-kit", "sounds", `${s}.wav`), path.join(pub, "sfx", `${s}.wav`));
}
console.log("public/ and src/marks.json are ready.");
