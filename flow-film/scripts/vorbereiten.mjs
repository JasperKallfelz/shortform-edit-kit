// Legt die Sounds, die der Film benutzt, aus ../sfx-kit/sounds nach public/sfx und schreibt ihre Katalogwerte nach src/sounds.json.
// Welche Sounds das sind, steht in src/plan.ts (alle Namen, die dort als s: "…" vorkommen).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const projekt = join(hier, "..");
const kit = join(projekt, "..", "sfx-kit");

const plan = readFileSync(join(projekt, "src", "plan.ts"), "utf8");
const katalog = JSON.parse(readFileSync(join(kit, "catalogue.json"), "utf8"));
// jeder Katalogname, der in plan.ts in Anführungszeichen steht
const namen = Object.keys(katalog).filter((n) => plan.includes(`"${n}"`)).sort();

const fehlend = [...new Set([...plan.matchAll(/\bs: "([A-Za-z0-9]+)"/g)].map((m) => m[1]))].filter((n) => !katalog[n]);
if (fehlend.length) {
  console.error(`Nicht im Katalog (sfx-kit/catalogue.json): ${fehlend.join(", ")}`);
  process.exit(1);
}

mkdirSync(join(projekt, "public", "sfx"), { recursive: true });
const auswahl = {};
for (const n of namen) {
  copyFileSync(join(kit, "sounds", `${n}.wav`), join(projekt, "public", "sfx", `${n}.wav`));
  auswahl[n] = katalog[n];
}
writeFileSync(join(projekt, "src", "sounds.json"), JSON.stringify(auswahl, null, 1) + "\n");
console.log(`${namen.length} Sounds nach public/sfx kopiert, src/sounds.json geschrieben: ${namen.join(", ")}`);
