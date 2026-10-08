// Small local server for the recorder page (reachable only on this computer: 127.0.0.1, default port 3600).
//   GET  /            → recorder.html
//   GET  /script      → the project's script.json (the lines for the teleprompter); 404 if there is none
//   GET  /takes       → existing recordings in the target folder
//   POST /save?name=  → saves <dir>/<name>.wav (never overwrites: if the name is taken, a counter is added)
//
// Usage:  node server.mjs [--project <folder>] [--script <file>] [--dir <target folder>] [--port <number>]
//   --project  project folder (default: current folder)
//   --script   script file (default: <project>/script.json)
//   --dir      where the recordings are saved (default: <project>/recordings, created if missing)
//   --port     default 3600 (or environment variable VOICE_STUDIO_PORT)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  const head = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n"); // the comment at the top of the file is the help
  console.log(head.slice(0, head.findIndex((l) => !l.startsWith("//"))).map((l) => l.slice(3)).join("\n"));
  process.exit(0);
}

const project = path.resolve(arg("project", process.cwd()));
const scriptPath = path.resolve(project, arg("script", "script.json"));
const recDir = path.resolve(project, arg("dir", "recordings"));
const port = Number(arg("port", process.env.VOICE_STUDIO_PORT || 3600));
const MAX_BYTES = 600 * 1024 * 1024; // 24 bit / 48 kHz mono is about 8.6 MB per minute, enough for over an hour
fs.mkdirSync(recDir, { recursive: true });

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const rel = (p) => path.relative(project, p).split(path.sep).join("/");

// Protection against foreign web pages: the server listens only on this computer, but a foreign page that is open could also
// send requests to localhost. So only requests with a matching Host and (if present) a matching Origin are accepted.
const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const originOk = (req) => {
  if (!allowed.has(req.headers.host || "")) return false;
  const o = req.headers.origin;
  return !o || allowed.has(o.replace(/^https?:\/\//, ""));
};

const server = http.createServer((req, res) => {
  if (!originOk(req)) return send(res, 403, { error: "not allowed" });
  const u = new URL(req.url, "http://localhost");
  if (req.method === "GET" && (u.pathname === "/" || u.pathname === "/recorder.html")) {
    return send(res, 200, fs.readFileSync(path.join(here, "recorder.html")), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && u.pathname === "/script") {
    try {
      return send(res, 200, fs.readFileSync(scriptPath)); // read fresh on every request: change the script, reload the page
    } catch {
      return send(res, 404, { error: `No script file found (${rel(scriptPath)}). Recording still works.` });
    }
  }
  if (req.method === "GET" && u.pathname === "/takes") {
    return send(res, 200, { files: fs.readdirSync(recDir).filter((f) => f.endsWith(".wav")) });
  }
  if (req.method === "POST" && u.pathname === "/save") {
    const base = (u.searchParams.get("name") || "take").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "take";
    let name = base;
    for (let i = 2; fs.existsSync(path.join(recDir, `${name}.wav`)); i++) name = `${base}-${i}`; // never overwrite
    const chunks = [];
    let bytes = 0;
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes > MAX_BYTES) {
        send(res, 413, { ok: false, error: "Recording too large" });
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      const body = Buffer.concat(chunks);
      if (body.length < 44 || body.toString("latin1", 0, 4) !== "RIFF" || body.toString("latin1", 8, 12) !== "WAVE") {
        return send(res, 400, { ok: false, error: "That is not a WAV file" });
      }
      const wav = path.join(recDir, `${name}.wav`);
      fs.writeFileSync(wav, body);
      send(res, 200, { ok: true, name, file: rel(wav), command: `npm run vo -- ${rel(wav)}` });
    });
    return;
  }
  send(res, 404, { error: "not found" });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`ERROR: Port ${port} is in use. Is the recorder page already running? Otherwise choose another number: --port ${port + 1}`);
  else console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Recorder page: http://localhost:${port}`);
  console.log(`  Script:      ${fs.existsSync(scriptPath) ? rel(scriptPath) : "(none found: " + rel(scriptPath) + ")"}`);
  console.log(`  Recordings:  ${rel(recDir) || "."}/   (stop with Ctrl+C)`);
});
