// Bereitet public/ für Remotion vor: Aufnahmen auf Anzeigegröße bringen, Demo-Video und die benutzten Sounds kopieren,
// Zeitmarken der Aufnahmen nach src/marks.json schreiben. Aufruf im Ordner tour/:  npm run vorbereiten
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const kit = path.resolve(root, "..");
const pub = path.join(root, "public");
fs.mkdirSync(path.join(pub, "aufnahmen"), { recursive: true });
fs.mkdirSync(path.join(pub, "sfx"), { recursive: true });

const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) { console.error(`${cmd} fehlgeschlagen`); process.exit(1); }
};

const namen = ["tonstudio", "props", "zeitleiste", "hoerseite"];
const marks = {};
for (const n of namen) {
  const roh = path.join(root, "aufnahmen", `${n}.mp4`);
  if (!fs.existsSync(roh)) { console.error(`Fehlt: ${roh} (siehe README.md, Abschnitt Aufnehmen)`); process.exit(1); }
  // 2720 x 1700 = doppelte Anzeigegröße des Fensterinhalts: scharf bis Zoom 2, deutlich leichter zu rendern als 3200 x 2000
  sh("ffmpeg", ["-v", "error", "-y", "-i", roh, "-vf", "scale=2720:1700:flags=lanczos", "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", path.join(pub, "aufnahmen", `${n}.mp4`)]);
  marks[n] = JSON.parse(fs.readFileSync(path.join(root, "aufnahmen", `${n}.json`), "utf8"));
}
fs.writeFileSync(path.join(root, "src", "marks.json"), JSON.stringify(marks, null, 1) + "\n");

fs.copyFileSync(path.join(kit, "example", "demo.mp4"), path.join(pub, "demo.mp4"));
for (const s of ["page1", "page2", "page3", "shutter3", "key1", "key2", "key3", "switch2"]) {
  fs.copyFileSync(path.join(kit, "sfx-kit", "sounds", `${s}.wav`), path.join(pub, "sfx", `${s}.wav`));
}
console.log("public/ und src/marks.json sind fertig.");
