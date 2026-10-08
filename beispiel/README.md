# Beispiel: Kurzvideo mit Wort-Timing und Sound-Cues

Ein kleines Remotion-Projekt (9 s, 1080×1920, 30 fps, Composition `Demo`), das die Bausteine eines Kurzvideos zeigt, ohne eigenen Inhalt. Das fertige Beispiel liegt als `demo.mp4` daneben; dort sind die Effekte zum Anhören 14 dB lauter als im Projekt, wo sie unter Stimme und Musik liegen.

## Was die Demo zeigt

1. **Hook** (0–3 s): ein leeres Inset („your clip“) mit langsamem Zoom, drei Textzeilen, die wortgenau einpoppen, das rote Schreibschrift-Wort liegt leicht über dem Inset. Dazu Auslöser, Tastenanschläge und ein Bleistiftstrich.
2. **Zahl** (3–6 s): eine grüne Zahl, die bis zum Schnitt immer weiter steigt, mit einer Klappe der Flughafen-Tafel alle 3 Frames (wird lauter), vorneweg eine umgeblätterte Seite und am Ende ein Riser, der genau auf dem Schnitt endet.
3. **Schluss** (6–9 s): Name über einem zweiten Inset, ein Kringel-Pfeil, der sich vom Namen in den Clip zeichnet, eine Textzeile darunter. Trommel auf dem Schnitt.

Alle Zeiten stehen an einer Stelle: `src/timing.ts` (Wortzeiten in ms, so wie eine Sprachaufnahme sie nach der Wort-Ausrichtung liefert). Szenen, Texte und Sounds hängen an denselben Konstanten, ändert man eine Zeit, wandern Bild und Ton zusammen. In einem echten Projekt wird diese Datei aus dem Voiceover erzeugt.

| Datei | Inhalt |
| --- | --- |
| `src/timing.ts` | Wortzeiten und Videolänge |
| `src/Demo.tsx` | Szenen, `Inset`, Zahl, Kringel-Pfeil, Props-Schema und `SFX_CUES` |
| `src/lib/words.tsx` | Wort-DSL: Schrift, Größe, Position und Einsatz-Frame je Wort |
| `src/lib/fonts.ts` | Schriften über `@remotion/google-fonts` |
| `src/lib/sfx.tsx` | Katalog `SOUNDS` und die Spur `SfxTrack`, die eine Cue-Liste abspielt |
| `public/sfx/` | 51 aufbereitete Sounds (48 kHz, normalisiert) |

## Starten

```
npm install
npm run dev
```

Das öffnet das Remotion Studio. Dort die Composition `Demo` wählen. Jeder Sound steht in der Zeitleiste als „SFX · Name“.

## Eigenen Clip, Voiceover und Musik einsetzen

Dateien in den Ordner `public/` legen, dann im Studio rechts im Props-Feld auswählen:

- **Clip:** `slots` → Eintrag 1 ist das Inset im Hook, Eintrag 2 das im Schluss. Bei `clip` den Dateinamen eintragen (z. B. `mein-clip.mp4`), mit `startSec` die Startstelle im Clip wählen. Leer bleibt der graue Platzhalter.
- **Voiceover:** bei `voiceover` den Dateinamen eintragen. Die Schnitte gehören zu den Wortzeiten in `src/timing.ts`; für eine andere Aufnahme die Zeiten dort anpassen.
- **Musik:** bei `music` den Dateinamen eintragen, `musicVolume` regelt die Lautstärke. Leer = keine Musik.
- `sfxVolume` regelt alle Effekte zusammen (Standard 1.3), `counterTo` den Wert, den die Zahl beim Schnitt erreicht.

## Rendern

```
npx remotion render Demo out/demo.mp4
```

## Sounds

Die Sounds in `public/sfx` sind CC0 bzw. CC0-ähnlich (BigSoundBank „CC0 1.0 / WTFPL“, Freesound-CC0, Remotion-SFX, Kenney). Herkunft und Lizenz je Datei stehen in `../sfx-kit/quellen.tsv`.
