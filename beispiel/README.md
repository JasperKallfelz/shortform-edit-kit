# Beispiel: Kurzvideo mit Wort-Timing und Sound-Cues

Ein kleines Remotion-Projekt (9 s, 1080×1920, 30 fps, Composition `Demo`), das die Bausteine eines Kurzvideos zeigt, ohne eigenen Inhalt. Das fertige Beispiel liegt als `demo.mp4` daneben; dort sind die Effekte zum Anhören 14 dB lauter als im Projekt, wo sie unter Stimme und Musik liegen.

## Was die Demo zeigt

1. **Hook** (0–3 s): ein leeres Inset („your clip“) mit langsamem Zoom, drei Textzeilen, die wortgenau einpoppen, das rote Schreibschrift-Wort liegt leicht über dem Inset. Dazu Auslöser, Tastenanschläge und ein Bleistiftstrich.
2. **Zahl** (3–6 s): eine grüne Zahl, die bis zum Schnitt immer weiter steigt, mit einer Klappe der Flughafen-Tafel alle 3 Frames (wird lauter), vorneweg eine umgeblätterte Seite und am Ende ein Riser, der genau auf dem Schnitt endet.
3. **Schluss** (6–9 s): Name über einem zweiten Inset, ein Kringel-Pfeil, der sich vom Namen in den Clip zeichnet, eine Textzeile darunter. Trommel auf dem Schnitt.

Alle Zeiten stehen an einer Stelle: `src/timing.ts` (Wortzeiten in ms, so wie eine Sprachaufnahme sie nach der Wort-Ausrichtung liefert). Szenen, Texte und Sounds hängen an denselben Konstanten, ändert man eine Zeit, wandern Bild und Ton zusammen. In einem echten Projekt wird diese Datei aus dem Voiceover erzeugt.

| Datei | Inhalt |
| --- | --- |
| `src/timing.ts` | Wortzeiten, Videolänge und Name des Voiceovers (`VO.file`, im Auslieferungszustand leer) |
| `skript.json` | gesprochene Sätze und die Schlüssel, unter denen sie in `timing.ts` stehen (für das Tonstudio) |
| `src/Demo.tsx` | Szenen, `Inset`, Zahl, Kringel-Pfeil, Props-Schema und `SFX_CUES` |
| `src/lib/words.tsx` | Wort-DSL: Schrift, Größe, Position und Einsatz-Frame je Wort |
| `src/lib/ambient.tsx` | `AmbientInset`: Clip-Karte mit Ambient-Light-Schein, dazu die Werte `AMBIENT` (siehe unten) |
| `src/AmbientKarte.tsx` | Probe für den Schein: Composition `AmbientKarte` (3 s), nur die Karte auf Weiß, ohne Text und Ton |
| `src/lib/fonts.ts` | Schriften über `@remotion/google-fonts` |
| `src/lib/sfx.tsx` | Katalog `SOUNDS` und die Spur `SfxTrack`, die eine Cue-Liste abspielt |
| `public/sfx/` | 53 aufbereitete Sounds (48 kHz, normalisiert) |

## Starten

```
npm install
npm run dev
```

Das öffnet das Remotion Studio. Dort die Composition `Demo` wählen. Jeder Sound steht in der Zeitleiste als „SFX · Name“.

## Eigenen Clip, Voiceover und Musik einsetzen

Dateien in den Ordner `public/` legen, dann im Studio rechts im Props-Feld auswählen:

- **Clip:** `slots` → Eintrag 1 ist das Inset im Hook, Eintrag 2 das im Schluss. Bei `clip` den Dateinamen eintragen (z. B. `mein-clip.mp4`), mit `startSec` die Startstelle im Clip wählen. Leer bleibt der graue Platzhalter.
- **Voiceover:** am besten mit dem Tonstudio (siehe unten): Es nimmt auf, bereitet auf und schreibt Datei und Wortzeiten nach `src/timing.ts`; die Demo spielt `VO.file` dann von selbst. Von Hand: bei `voiceover` einen Dateinamen eintragen und die Zeiten in `src/timing.ts` anpassen.
- **Musik:** bei `music` den Dateinamen eintragen, `musicVolume` regelt die Lautstärke. Leer = keine Musik.
- `sfxVolume` regelt alle Effekte zusammen (Standard 1.3), `counterTo` den Wert, den die Zahl beim Schnitt erreicht.

## Ambient Light: Clip-Karte mit Schein

Eine abgerundete Karte (Video oder Foto) auf weißem Grund, hinter der dasselbe Medium noch einmal liegt: etwas größer, stark weichgezeichnet, aufgehellt und kräftiger gefärbt. So scheint der Clip auf das Weiß, wie beim Ambient-Modus von YouTube. Der Baustein ist `AmbientInset` in `src/lib/ambient.tsx`, unabhängig von `Demo.tsx` und ein Ersatz für `Inset` dort, wenn der Hintergrund hell ist.

Einbauen (`len(0)` steht für die Länge der Szene in Frames, wie in `Demo.tsx`):

```tsx
import { AmbientInset } from "./lib/ambient";

<AbsoluteFill style={{ background: "#fff" }}>
  <AmbientInset clip="mein-clip.mp4" startSec={2} frames={len(0)} top={44} />
</AbsoluteFill>
```

Ansehen: im Studio die Composition `AmbientKarte` wählen und rechts bei `clip` eine Datei aus `public/` eintragen (`glow` aus und an zeigt den Unterschied). Bleibt `clip` leer, liegt ein bunter Verlauf in der Karte, damit man den Schein auch ohne Material sieht. Als Einzelbild mit einem bunten Testvideo (nicht einchecken):

```
ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30:duration=4 -pix_fmt yuv420p public/test.mp4
npx remotion still AmbientKarte ambient.png --frame=45 --props='{"clip":"test.mp4"}'
```

Parameter von `AmbientInset`:

| Parameter | Standard | Bedeutung |
| --- | --- | --- |
| `clip` | – | Datei unter `public/` (mp4, jpg, png, webp); leer = bunter Verlauf |
| `startSec` | 0 | Startstelle im Video in Sekunden |
| `frames` | – | Länge der Szene in Frames; über diese Dauer läuft der Zoom |
| `top`, `width` | 37, 86 | Lage: Abstand von oben (% der Höhe) und Breite (% der Breite) |
| `aspect`, `radius` | `"16 / 9"`, 28 | Seitenverhältnis und Eckenradius in Bildpunkten |
| `focus` | `"50% 50%"` | Ausschnitt im Clip (`object-position`), z. B. `"50% 30%"` für eine Person im oberen Drittel |
| `zoomTo` | 1.08 | Maßstab am Ende des Zooms, 1 = kein Zoom |
| `rate` | 1 | Abspielgeschwindigkeit des Videos |
| `glow` | `true` | `false` = Karte ohne Schein |

Den Schein selbst stellt `AMBIENT` oben in `ambient.tsx` ein: `scale` 1.07 (wie weit er über die Karte hinausreicht), `blur` 58 (wie weich, in Bildpunkten), `brightness` 1.3, `saturate` 1.8 (wie hell und kräftig) und `opacity` 0.85. Der Blur ist auf 1080 × 1920 abgestimmt; bei einer anderen Auflösung mitskalieren.

Was man dabei wissen sollte:

- **Ein Rahmen trägt alles.** Lage, Einpoppen (Spring) und Einblenden sitzen am äußeren Rahmen, Schein und Karte bewegen sich also zusammen.
- **Gleicher Ausschnitt für beide.** Der Schein ist ein Geschwister *unter* der Karte und braucht dieselben `startSec` und `rate` wie das Video der Karte, sonst laufen die Farben dem Bild hinterher. `AmbientInset` setzt beides gemeinsam; wer den Baustein umbaut, muss das erhalten.
- **`brightness` über 1 ist Absicht.** Auf Weiß kann ein Schein nur färben, nicht aufhellen. Bei dunklem Material wirkt eine nicht aufgehellte Kopie wie ein schmutziger Schatten statt wie Licht.
- **Bunte Aufnahmen leuchten am besten** (blauer Himmel, grünes Gras). Graues Material bleibt dezent.
- **Nur auf hellem Hintergrund.** Auf Dunkel ist der Schein nicht zu sehen.
- **Der Schatten der Karte ist reduziert** (kleiner und blasser als beim `Inset` der Demo), damit er den Schein nicht verschmutzt.
- **Kosten:** eine zweite Videoebene je Karte, der Render dauert entsprechend länger. Für Karten ohne Schein `glow={false}`.

## Eigenes Voiceover aufnehmen (Tonstudio)

Die Wortzeiten in `src/timing.ts` sind Beispielwerte. Mit dem [Tonstudio](../tonstudio/README.md) entstehen sie aus einer echten Aufnahme:
Aufnahme-Seite mit Teleprompter (Skript aus `skript.json`), Aufbereitung, Wort-Ausrichtung mit Whisper (lokal) und eine neue `timing.ts`.
Voraussetzungen (whisper.cpp, Modelle, `numpy`) stehen dort.

```
npm run tonstudio
```

Das startet die Aufnahme-Seite unter http://localhost:3600 und sichert jeden Take in `recordings/` (nicht eingecheckt). Dann einen Take wählen:

```
npm run vo -- recordings/take-….wav
```

Das schreibt `public/vo.wav` (nicht eingecheckt) und überschreibt `src/timing.ts`; die Länge der Demo folgt der Aufnahme. Zurück zum Beispielzustand:
`git checkout src/timing.ts` und `public/vo.wav` löschen (die handgeschriebene Fassung liegt außerdem in `recordings/timing-handgeschrieben.ts`).
Für einen Render nur mit Effekten (Pegel der Sounds prüfen) `--props '{"voVolume":0,"music":""}'` übergeben.

## Rendern

```
npx remotion render Demo out/demo.mp4
```

## Sounds

Die Sounds in `public/sfx` sind CC0 bzw. CC0-ähnlich (BigSoundBank „CC0 1.0 / WTFPL“, Freesound-CC0, Remotion-SFX, Kenney). Herkunft und Lizenz je Datei stehen in `../sfx-kit/quellen.tsv`.
