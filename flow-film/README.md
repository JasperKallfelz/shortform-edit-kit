# Ablauf-Film: das Kit in 30 Sekunden

Dieses Projekt baut `docs/flow.mp4` und die stumme Vorschau `docs/flow.gif` für das README: links sagt ein Mensch, was er will,
in der Mitte arbeitet der Agent die fünf Schritte ab (Voiceover, Clips, Sounds, Export, Post), rechts wächst das Video im Handy.
1920 × 1080, 30 Bilder pro Sekunde, 32 Sekunden, alles in Remotion gezeichnet, keine Bildschirmaufnahmen.

Der Ton besteht nur aus Sounds aus `sfx-kit/sounds/` (echte Aufnahmen). Es gibt keine Stimme und keine Musik: Für beides liegt
nichts im Repo, das man frei weitergeben dürfte.

| Datei | Inhalt |
|---|---|
| `src/plan.ts` | Zeitplan, alle Texte und die Liste der Sounds (`CUES`). Jede Zeit steht hier genau einmal, Bild und Ton lesen dieselben Konstanten |
| `src/Ablauf.tsx` | das Bild: Sprechblasen, die fünf Karten, das Handy |
| `src/sounds.json` | Länge, Einsatzpunkt und Lautheit der benutzten Sounds, von `npm run vorbereiten` aus dem Katalog des Kits geschrieben |
| `scripts/vorbereiten.mjs` | kopiert die benutzten Sounds nach `public/sfx/` |
| `scripts/vorschau.mjs` | legt den Film nach `docs/` und baut die GIF-Vorschauen (`flow.gif`, `demo.gif`) |

Nicht eingecheckt (siehe `.gitignore`): `node_modules/`, `public/`, `out/`.

## Bauen

Voraussetzungen: Node 20 oder neuer, ffmpeg. Alle Befehle im Ordner `flow-film/`.

```bash
npm install
```

```bash
npm run vorbereiten
```

Ansehen und ändern im Remotion Studio (Komposition `Ablauf`):

```bash
npm run dev
```

Typen prüfen:

```bash
npm run typen
```

Rendern (H.264, yuv420p, AAC) nach `out/flow.mp4`:

```bash
npm run render
```

Film und GIF-Vorschauen nach `docs/` legen:

```bash
npm run vorschau
```

## Ändern

- **Texte:** `TEXT` in `src/plan.ts` (Sprechblasen, Rückmeldungen des Agenten, Titel, Schluss).
- **Tempo:** `S` (Beginn der fünf Schritte) und `T` in `src/plan.ts`. Die Sounds hängen an denselben Konstanten und wandern mit.
- **Sounds:** `CUES` in `src/plan.ts`. `at` ist der Frame, auf dem der Sound sitzt, `db` der Zielpegel seiner lautesten Stelle; die
  Lautstärke wird aus dem Katalogwert `loud` gerechnet. Nach einem neuen Soundnamen einmal `npm run vorbereiten`.
- **Gesamtlautstärke:** Prop `sfxVolume` (im Studio rechts, beim Rendern `--props='{"sfxVolume":0.8}'`).

## Prüfen

Nur den Ton rendern und Lautheit und Spitze messen:

```bash
npm run ton
```

```bash
ffmpeg -hide_banner -i out/ton.wav -af ebur128=peak=true -f null -
```

Gemessen am 08.10.2026: −33,0 LUFS über den ganzen Film, Spitze −4,5 dBFS. Der Wert über den ganzen Film ist niedrig, weil zwischen den
Geräuschen Stille liegt. Pegel je Abschnitt und Strecken ohne Effekt zeigt das Werkzeug aus dem Kit:

```bash
python3 ../edit-tools/ton_check.py out/ton.wav --abschnitt 4 --luecke 1.2
```
