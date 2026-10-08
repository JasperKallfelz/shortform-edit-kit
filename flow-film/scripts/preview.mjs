// Puts the rendered film into ../docs and builds the previews for the README:
//   docs/flow.mp4   the film with sound
//   docs/flow.gif   silent preview (GitHub plays GIFs in a README by itself, but not videos from the repo)
//   docs/demo.gif   the template video from ../example/demo.mp4 as a small preview
//   docs/steps/*.png  the five cards of the film as single pictures ("How it works" in the README)
// Needs ffmpeg. Before: npm run render
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(project, "..", "docs");
const film = join(project, "out", "flow.mp4");
if (!existsSync(film)) {
  console.error("out/flow.mp4 is missing - run first: npm run render");
  process.exit(1);
}
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
/** GIF with its own colour palette; "diff" weights the palette towards what moves, the background stands still. */
const gif = (source, target, fps, width) =>
  ffmpeg("-i", source, "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, "-loop", "0", target);

copyFileSync(film, join(docs, "flow.mp4"));
gif(film, join(docs, "flow.gif"), 12, 900);
gif(join(project, "..", "example", "demo.mp4"), join(docs, "demo.gif"), 15, 300);

// The five cards: one still shortly before the closing, when every card has its check mark, cut into five pictures.
// Card i sits at x 748, y 176 + i * 162, 572 x 150 px (CARD and PIPE in src/Flow.tsx); 6 px of stage around it.
const still = join(project, "out", "steps.png");
execFileSync("npx", ["remotion", "still", "Flow", still, "--frame=845", "--log=error"], { cwd: project, stdio: "inherit" });
mkdirSync(join(docs, "steps"), { recursive: true });
["voiceover", "clips", "sounds", "export", "post"].forEach((name, i) => ffmpeg("-i", still, "-vf", `crop=584:162:742:${170 + i * 162}`, join(docs, "steps", `${i + 1}-${name}.png`)));

for (const n of ["flow.mp4", "flow.gif", "demo.gif"]) console.log(`${(statSync(join(docs, n)).size / 1e6).toFixed(1).padStart(5)} MB  docs/${n}`);
