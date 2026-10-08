// Aufnahme-Bibliothek: nimmt eine Browserseite mit Playwright (headless Chromium) als Video auf.
// Statt Playwrights eingebautem recordVideo (1 MBit/s, matschiger Text) werden die Einzelbilder des Chrome-Screencasts
// in voller Auflösung (Seitenpixel x deviceScaleFactor) gespeichert und danach mit ffmpeg zu einem 30-fps-Video zusammengesetzt.
// Eingeblendet werden nur zwei Hilfen, die der Seite selbst nichts ändern: ein Mauszeiger mit Klick-Ring und eine Tastenanzeige.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const OUT = here;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Zeiger und Tastenanzeige werden per Init-Skript in die Seite gelegt (nur in der Aufnahme, nicht im Repo).
const OVERLAY = `
(() => {
  const start = () => {
    if (document.getElementById("__cur")) return;
    const st = document.createElement("style");
    st.textContent = \`
      #__cur{position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__ring{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid rgba(40,110,255,.85);animation:__r .55s ease-out forwards}
      @keyframes __r{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
      #__keys{position:fixed;right:28px;bottom:26px;z-index:2147483647;display:flex;gap:8px;pointer-events:none}
      .__key{min-width:54px;height:54px;padding:0 14px;border-radius:12px;background:rgba(24,24,27,.92);color:#fff;font:600 24px/54px -apple-system,Helvetica,Arial,sans-serif;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.3),inset 0 -3px 0 rgba(255,255,255,.14);animation:__k .9s ease-out forwards}
      @keyframes __k{0%{transform:translateY(8px);opacity:0}12%{transform:none;opacity:1}78%{opacity:1}100%{opacity:0}}
    \`;
    document.documentElement.appendChild(st);
    const cur = document.createElement("div");
    cur.id = "__cur";
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2 L4 19 L8.6 15 L11.6 21.6 L14.4 20.3 L11.5 13.9 L17.8 13.4 Z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cur);
    const keys = document.createElement("div");
    keys.id = "__keys";
    document.documentElement.appendChild(keys);
    addEventListener("mousemove", (e) => { cur.style.transform = "translate(" + (e.clientX - 5) + "px," + (e.clientY - 3) + "px)"; }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.className = "__ring"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
    const label = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", " ": "Leertaste", Enter: "↵" };
    addEventListener("keydown", (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = document.createElement("div");
      k.className = "__key"; k.textContent = label[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      keys.replaceChildren(k); setTimeout(() => { if (k.parentNode) k.remove(); }, 950);
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", start); else start();
})();
`;

/**
 * Nimmt eine Szene auf.
 *  name        Dateiname der Aufnahme (aufnahmen/<name>.mp4)
 *  url         Startseite
 *  fakeMic     Pfad zu einer WAV, die als Mikrofon dient (optional)
 *  width,height  Seitengröße in CSS-Pixeln (Standard 1600 x 1000), scale = deviceScaleFactor (Standard 2)
 *  run(ctx)    die Handlung; ctx = { page, mark, move, click, key, sleep }
 */
export async function aufnehmen({ name, url, fakeMic, width = 1600, height = 1000, scale = 2, quality = 88, run, warm = 700, colorScheme = "light" }) {
  const dir = path.join(OUT, "frames", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Echte Bildschirmdichte statt Emulation: nur so liefert der Screencast Bilder in voller Auflösung (width*scale), nicht in CSS-Pixeln
  const args = ["--autoplay-policy=no-user-gesture-required", `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`];
  if (fakeMic) args.push("--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${fakeMic}`);
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({ viewport: null, locale: "de-DE", colorScheme, permissions: fakeMic ? ["microphone"] : [] });
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  await sleep(warm);
  const cdp = await context.newCDPSession(page);
  const stamps = [];
  let busy = Promise.resolve();
  cdp.on("Page.screencastFrame", (f) => {
    const i = stamps.length;
    stamps.push(f.metadata.timestamp);
    busy = busy.then(async () => {
      fs.writeFileSync(path.join(dir, String(i).padStart(6, "0") + ".jpg"), Buffer.from(f.data, "base64"));
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame: 2 });
  const t0 = Date.now() / 1000;
  const marks = {};
  const mark = (label) => { marks[label] = +(Date.now() / 1000 - t0).toFixed(2); };
  let mx = width / 2, my = height / 2;
  const move = async (x, y, ms = 700) => {
    const steps = Math.max(8, Math.round(ms / 16));
    // sanfte Kurve (ease in/out), damit der Zeiger nicht mechanisch wirkt
    const sx = mx, sy = my;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await sleep(ms / steps);
    }
    mx = x; my = y;
  };
  const center = async (target) => { const b = await target.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const click = async (target, ms = 700) => {
    const [x, y] = typeof target.boundingBox === "function" ? await center(target) : target;
    await move(x, y, ms);
    await sleep(120);
    await page.mouse.down(); await sleep(70); await page.mouse.up();
  };
  const key = async (k, wait = 0) => { await page.keyboard.press(k); if (wait) await sleep(wait); };
  await page.mouse.move(mx, my);
  try {
    await run({ page, mark, move, click, key, sleep, width, height });
  } finally {
    const tEnd = Date.now() / 1000;
    await cdp.send("Page.stopScreencast").catch(() => {});
    await busy;
    await browser.close();
    const n = stamps.length;
    if (!n) throw new Error("Keine Bilder aufgenommen");
    // Dauer jedes Bildes = Abstand zum nächsten (das letzte reicht bis zum Ende der Handlung)
    let list = "";
    for (let i = 0; i < n; i++) {
      const next = i + 1 < n ? stamps[i + 1] : Math.max(tEnd, stamps[i] + 0.05);
      list += `file '${path.join(dir, String(i).padStart(6, "0") + ".jpg")}'\nduration ${Math.max(0.001, next - stamps[i]).toFixed(4)}\n`;
    }
    list += `file '${path.join(dir, String((n - 1)).padStart(6, "0") + ".jpg")}'\n`;
    fs.writeFileSync(path.join(dir, "list.txt"), list);
    const outFile = path.join(OUT, name + ".mp4");
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "15", "-movflags", "+faststart", outFile], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("ffmpeg fehlgeschlagen");
    fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify({ name, seconds: +(tEnd - stamps[0]).toFixed(2), frames: n, marks }, null, 1));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${name}: ${n} Bilder, ${(tEnd - stamps[0]).toFixed(1)} s -> ${outFile}`);
  }
}
