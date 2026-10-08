// Szenen für den Rundgang: node aufnehmen.mjs <szene>   (tonstudio | props | zeitleiste | hoerseite)
// Voraussetzung: die Werkzeuge laufen (siehe ../README.md), Ports kommen aus den Umgebungsvariablen.
import path from "node:path";
import { aufnehmen, sleep, OUT } from "./cap.mjs";

const P = {
  tonstudio: process.env.PORT_TONSTUDIO || "4732",
  studio: process.env.PORT_STUDIO || "4733",
  hoerseite: process.env.PORT_HOERSEITE || "4731",
};
const FAKE_MIC = path.join(OUT, "roh", "fake-mic.wav");

const szenen = {
  // 1 · Skript und Voiceover: Aufnahme-Seite mit Teleprompter, ein Take mit Testmikrofon
  async tonstudio() {
    await aufnehmen({
      name: "tonstudio",
      url: `http://localhost:${P.tonstudio}`,
      fakeMic: FAKE_MIC,
      colorScheme: "dark",
      async run({ page, mark, move, click, sleep }) {
        await sleep(1600);
        const lines = page.locator(".line");
        await move(...(await centerOf(lines.nth(0))), 900);
        await sleep(500);
        await click(page.locator("#rec"), 1100);
        await page.waitForFunction(() => document.getElementById("rec").classList.contains("stop"), null, { timeout: 15000 });
        const t0 = Date.now();
        mark("aufnahme-laeuft");
        const bis = async (s) => { const w = s * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); };
        await move(...(await centerOf(lines.nth(1))), 1000);
        await bis(3.0);
        await click(lines.nth(1), 250); // Szene 2 beginnt
        await move(...(await centerOf(lines.nth(2))), 1100);
        await bis(5.4);
        await click(lines.nth(2), 250); // Szene 3
        await bis(8.4);
        await move(...(await centerOf(page.locator("#rec"))), 900);
        await bis(9.3);
        mark("stopp");
        await click(page.locator("#rec"), 200);
        await page.waitForFunction(() => /Gesichert/.test(document.getElementById("takes").textContent), null, { timeout: 15000 });
        mark("gesichert");
        await move(560, 420, 900);
        await sleep(3200);
      },
    });
  },

  // 2 · Clips reindroppen: Remotion Studio, Komposition Demo, Props-Feld mit den Clip-Plätzen
  async props() {
    await aufnehmen({
      name: "props",
      url: `http://localhost:${P.studio}/Demo`,
      colorScheme: "dark",
      warm: 3500,
      async run({ page, mark, move, click, sleep }) {
        await sleep(1400);
        await move(1420, 420, 900);
        // das Props-Feld nach unten zu den Clip-Plätzen (slots) scrollen
        for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 150); await sleep(260); }
        await sleep(600);
        mark("slots-sichtbar");
        const clip = page.locator('input[placeholder="slots.0.clip"]');
        await click(clip, 1000);
        await sleep(300);
        // in einem Zug eintragen: Zeichen für Zeichen würde das Studio bei jedem Teilnamen ("b", "be", …) schon als Datei suchen
        await clip.fill("example-clip.mp4");
        mark("clip-eingetragen");
        await sleep(1300);
        // Wiedergabekopf auf Sekunde 2,3 setzen (Hook mit Clip). Beim Verlassen des Feldes meldet das Studio kurz, dass es die
        // Standardwerte nicht in die Datei zurückschreiben kann (sie stehen in einer Variablen): diese zwei Sekunden werden im Schnitt übersprungen.
        mark("vor-klick");
        await click([336 + 133 * 2.3, 770], 1300);
        mark("geklickt");
        const meldung = page.getByText("Cannot update default props");
        await meldung.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
        mark("meldung-da");
        await meldung.waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
        mark("meldung-weg");
        await sleep(500);
        mark("vorschau");
        await page.keyboard.press("Space");
        mark("spielt");
        await sleep(3600);
        await page.keyboard.press("Space");
        await sleep(900);
      },
    });
  },

  // 3b · Studio-Zeitleiste mit den benannten Sound-Sequenzen, ein paar Sekunden Wiedergabe
  async zeitleiste() {
    const props = encodeURIComponent(JSON.stringify({ slots: [{ label: "your clip", clip: "example-clip.mp4", startSec: 0 }, { label: "your clip", clip: "example-clip.mp4", startSec: 3 }] }));
    await aufnehmen({
      name: "zeitleiste",
      url: `http://localhost:${P.studio}/Demo?props=${props}`,
      colorScheme: "dark",
      warm: 3500,
      async run({ page, mark, move, click, sleep }) {
        await sleep(1200);
        // Zeitleiste größer ziehen
        await move(800, 756, 800);
        await page.mouse.down();
        await move(800, 500, 1000);
        await page.mouse.up();
        await sleep(700);
        mark("zeitleiste-gross");
        // die Sound-Spur anklicken: der Inspektor zeigt "27 instances"
        await click(page.getByText("SFX · Hook-Clip (Auslöser)").first(), 1000);
        await sleep(1500);
        mark("sfx-gewaehlt");
        await click([336 + 133 * 0.2, 530], 900);
        await page.keyboard.press("Space");
        mark("spielt");
        await sleep(6500);
        await page.keyboard.press("Space");
        await sleep(700);
      },
    });
  },

  // 3a · Hörseite: mit der Tastatur sortieren
  async hoerseite() {
    await aufnehmen({
      name: "hoerseite",
      url: `http://127.0.0.1:${P.hoerseite}`,
      colorScheme: "light",
      async run({ page, mark, move, click, sleep, key }) {
        await sleep(1500);
        const first = page.locator("button.play").first();
        await click(first, 1100);
        await sleep(900);
        mark("erster-sound");
        // Pfeil rechts: nächster Sound; B behalten, X raus (danach läuft der nächste)
        const folge = [["ArrowRight", 1100], ["b", 1200], ["b", 1200], ["x", 1200], ["ArrowRight", 1000], ["b", 1200], ["x", 1200], ["b", 1200], ["ArrowLeft", 1000], ["x", 1300]];
        for (const [k, w] of folge) { await key(k); await sleep(w); }
        mark("sortiert");
        await move(520, 262, 900);
        await sleep(1800);
      },
    });
  },
};

async function centerOf(loc) {
  const b = await loc.boundingBox();
  return [b.x + Math.min(b.width * 0.5, 420), b.y + b.height / 2];
}

const name = process.argv[2];
if (!szenen[name]) {
  console.error("Szene wählen:", Object.keys(szenen).join(" | "));
  process.exit(1);
}
await szenen[name]();
