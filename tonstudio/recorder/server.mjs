// Kleiner lokaler Server für die Aufnahme-Seite (nur auf diesem Rechner erreichbar: 127.0.0.1, Standard-Port 3600).
//   GET  /            → recorder.html
//   GET  /skript      → skript.json des Projekts (die Zeilen für den Teleprompter); 404, wenn es keine gibt
//   GET  /takes       → vorhandene Aufnahmen im Zielordner
//   POST /save?name=  → speichert <ordner>/<name>.wav (überschreibt nie: ist der Name vergeben, wird hochgezählt)
//
// Aufruf:  node server.mjs [--projekt <ordner>] [--skript <datei>] [--ordner <zielordner>] [--port <nummer>]
//   --projekt  Projektordner (Standard: aktueller Ordner)
//   --skript   Skript-Datei (Standard: <projekt>/skript.json)
//   --ordner   wohin die Aufnahmen gespeichert werden (Standard: <projekt>/recordings, wird angelegt)
//   --port     Standard 3600 (oder Umgebungsvariable TONSTUDIO_PORT)
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
  const kopf = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n"); // der Kommentar am Dateianfang ist die Hilfe
  console.log(kopf.slice(0, kopf.findIndex((l) => !l.startsWith("//"))).map((l) => l.slice(3)).join("\n"));
  process.exit(0);
}

const projekt = path.resolve(arg("projekt", process.cwd()));
const skriptPfad = path.resolve(projekt, arg("skript", "skript.json"));
const recDir = path.resolve(projekt, arg("ordner", "recordings"));
const port = Number(arg("port", process.env.TONSTUDIO_PORT || 3600));
const MAX_BYTES = 600 * 1024 * 1024; // 24 Bit / 48 kHz Mono sind rund 8,6 MB pro Minute, das reicht für über eine Stunde
fs.mkdirSync(recDir, { recursive: true });

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const rel = (p) => path.relative(projekt, p).split(path.sep).join("/");

// Schutz vor fremden Webseiten: Der Server hört nur auf dem eigenen Rechner, aber auch eine geöffnete fremde Seite könnte
// Anfragen an localhost schicken. Deshalb nur Anfragen mit passendem Host und (falls vorhanden) passendem Origin annehmen.
const erlaubt = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const herkunftOk = (req) => {
  if (!erlaubt.has(req.headers.host || "")) return false;
  const o = req.headers.origin;
  return !o || erlaubt.has(o.replace(/^https?:\/\//, ""));
};

const server = http.createServer((req, res) => {
  if (!herkunftOk(req)) return send(res, 403, { error: "nicht erlaubt" });
  const u = new URL(req.url, "http://localhost");
  if (req.method === "GET" && (u.pathname === "/" || u.pathname === "/recorder.html")) {
    return send(res, 200, fs.readFileSync(path.join(here, "recorder.html")), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && u.pathname === "/skript") {
    try {
      return send(res, 200, fs.readFileSync(skriptPfad)); // bei jedem Aufruf frisch gelesen: Skript ändern, Seite neu laden
    } catch {
      return send(res, 404, { error: `Keine Skript-Datei gefunden (${rel(skriptPfad)}). Die Aufnahme geht trotzdem.` });
    }
  }
  if (req.method === "GET" && u.pathname === "/takes") {
    return send(res, 200, { files: fs.readdirSync(recDir).filter((f) => f.endsWith(".wav")) });
  }
  if (req.method === "POST" && u.pathname === "/save") {
    const base = (u.searchParams.get("name") || "take").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "take";
    let name = base;
    for (let i = 2; fs.existsSync(path.join(recDir, `${name}.wav`)); i++) name = `${base}-${i}`; // nie überschreiben
    const chunks = [];
    let bytes = 0;
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes > MAX_BYTES) {
        send(res, 413, { ok: false, error: "Aufnahme zu groß" });
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      const body = Buffer.concat(chunks);
      if (body.length < 44 || body.toString("latin1", 0, 4) !== "RIFF" || body.toString("latin1", 8, 12) !== "WAVE") {
        return send(res, 400, { ok: false, error: "Das ist keine WAV-Datei" });
      }
      const wav = path.join(recDir, `${name}.wav`);
      fs.writeFileSync(wav, body);
      send(res, 200, { ok: true, name, datei: rel(wav), befehl: `npm run vo -- ${rel(wav)}` });
    });
    return;
  }
  send(res, 404, { error: "nicht gefunden" });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`FEHLER: Port ${port} ist belegt. Läuft die Aufnahme-Seite schon? Sonst eine andere Nummer wählen: --port ${port + 1}`);
  else console.error(`FEHLER: ${e.message}`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Aufnahme-Seite: http://localhost:${port}`);
  console.log(`  Skript:     ${fs.existsSync(skriptPfad) ? rel(skriptPfad) : "(keins gefunden: " + rel(skriptPfad) + ")"}`);
  console.log(`  Aufnahmen:  ${rel(recDir) || "."}/   (beenden mit Strg+C)`);
});
