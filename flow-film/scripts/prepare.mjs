// Puts everything the film needs into public/ and writes src/sounds.json:
//   - the sounds used in src/plan.ts, from ../sfx-kit/sounds, with their catalogue values (length, lead, loudness)
//   - the pictures and the voice line from assets/
//   - the real example video from ../docs/real-example.mp4, plus its sound as a WAV (needs ffmpeg)
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(project, "..");
const kit = join(repo, "sfx-kit");

const plan = readFileSync(join(project, "src", "plan.ts"), "utf8");
const catalogue = JSON.parse(readFileSync(join(kit, "catalogue.json"), "utf8"));
// every catalogue name that appears in quotes in plan.ts
const names = Object.keys(catalogue).filter((n) => plan.includes(`"${n}"`)).sort();

const missing = [...new Set([...plan.matchAll(/\bs: "([A-Za-z0-9]+)"/g)].map((m) => m[1]))].filter((n) => !catalogue[n]);
if (missing.length) {
  console.error(`Not in the catalogue (sfx-kit/catalogue.json): ${missing.join(", ")}`);
  process.exit(1);
}

mkdirSync(join(project, "public", "sfx"), { recursive: true });
const used = {};
for (const n of names) {
  copyFileSync(join(kit, "sounds", `${n}.wav`), join(project, "public", "sfx", `${n}.wav`));
  used[n] = catalogue[n];
}
writeFileSync(join(project, "src", "sounds.json"), JSON.stringify(used, null, 1) + "\n");
console.log(`${names.length} sounds copied to public/sfx, src/sounds.json written`);

for (const file of readdirSync(join(project, "assets"))) copyFileSync(join(project, "assets", file), join(project, "public", file));
copyFileSync(join(repo, "docs", "real-example.mp4"), join(project, "public", "real-example.mp4"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(repo, "docs", "real-example.mp4"), "-vn", "-c:a", "pcm_s16le", "-ar", "48000", join(project, "public", "real-example.wav")], { stdio: "inherit" });
console.log("assets, real-example.mp4 and real-example.wav are in public/");
