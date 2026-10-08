// Legt den gerenderten Film nach ../docs und baut daraus die Vorschau fürs README:
//   docs/ablauf.mp4   der Film mit Ton
//   docs/ablauf.gif   stumme Vorschau (GitHub spielt GIFs im README von selbst ab, Videos aus dem Repo nicht)
//   docs/demo.gif     das Beispielvideo aus ../beispiel/demo.mp4 als kleine Vorschau
// Braucht ffmpeg. Vorher: npm run render
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projekt = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(projekt, "..", "docs");
const film = join(projekt, "out", "ablauf.mp4");
if (!existsSync(film)) {
  console.error("out/ablauf.mp4 fehlt – zuerst: npm run render");
  process.exit(1);
}
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
/** GIF mit eigener Farbpalette; „diff“ gewichtet die Palette auf das, was sich bewegt, der Hintergrund steht still. */
const gif = (quelle, ziel, fps, breite) =>
  ffmpeg("-i", quelle, "-vf", `fps=${fps},scale=${breite}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, "-loop", "0", ziel);

copyFileSync(film, join(docs, "ablauf.mp4"));
gif(film, join(docs, "ablauf.gif"), 12, 900);
gif(join(projekt, "..", "beispiel", "demo.mp4"), join(docs, "demo.gif"), 15, 300);

for (const n of ["ablauf.mp4", "ablauf.gif", "demo.gif"]) console.log(`${(statSync(join(docs, n)).size / 1e6).toFixed(1).padStart(5)} MB  docs/${n}`);
