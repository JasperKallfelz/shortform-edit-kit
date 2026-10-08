# shortform-edit-kit

Werkzeuge, Sound-Effekte und Abläufe für kurze Hochkant-Videos (TikTok, Reels), gebaut mit [Remotion](https://www.remotion.dev)
und KI-Agenten (Claude Code, Hermes). Der Ordner ist so aufgebaut, dass ein Agent damit einen Schnitt von „hier sind meine Clips“
bis „fertige Datei für den Post“ begleiten kann, und dass man die Handgriffe nicht jedes Mal neu erfindet.

*English in one line: tools, 280+ CC0 sound effects, agent skills and a Remotion demo for building short vertical videos with
natural-sounding sound design. Docs are in German.*

## Was drin ist

| Pfad | Inhalt |
|---|---|
| `beispiel/` | Remotion-Demo ohne eigenes Material: Text, der zum Sprechtakt aufpoppt, Clip-Karte mit Zoom, gezeichneter Pfeil, laufende Zahl, Sound-Spur. `demo.mp4` zeigt das Ergebnis |
| `sfx-kit/` | 51 aufbereitete Sound-Effekte (echte Aufnahmen), Katalog mit Länge, Einsatzpunkt und Lautheit, Skripte zum Aufbereiten und zum Einspielen in ein Remotion-Projekt |
| `sfx-kandidaten/` | 233 rohe Kandidaten mit Quelle und Lizenz je Datei (`manifest.tsv`) |
| `hoerseite.py`, `index.html` | Hörseite im Browser: alle Sounds durchhören, behalten oder aussortieren, auch nur mit der Tastatur |
| `edit-tools/` | Skripte: Videos aus WhatsApp holen, Kontaktbogen, Dateien sicher ändern, fertiger Export mit Lautheitsprüfung. Das README dort beschreibt die Abläufe |
| `skills/` | Zwei Skills für Agenten (Hermes-Format, als Anleitung auch für Claude Code brauchbar) |
| `docs/` | Was die Forschung zu Zuschauerbindung, Beschreibung, Hashtags und Musikrechten sagt, mit Quellen |

## Schnellstart

```bash
cd beispiel && npm install && npm run dev
```

```bash
python3 hoerseite.py
```

Die Hörseite läuft dann unter http://localhost:3700. Urteile landen in `auswahl.json` (wird nicht eingecheckt).

Neue Sounds ins Kit und ins Projekt:

```bash
python3 sfx-kit/tools/prepare_sfx.py
python3 sfx-kit/tools/sync_remotion.py beispiel
```

Fertiger Export (Bild in hoher Qualität, Ton auf höchstens −14 LUFS, einmal mit und einmal ohne Musik, Cover-Bilder):

```bash
EDIT_HOST=<ssh-name> edit-tools/post_render.sh <projektordner> <Komposition> <Name> 60,150,240
```

Voraussetzungen: Node 20+, Python 3.9+, ffmpeg. Für `prepare_sfx.py` zusätzlich `numpy`, `soundfile`, `librosa`, für den
Kontaktbogen `Pillow`. `whatsapp_clips.py` braucht macOS mit WhatsApp Desktop.

## Die Grundsätze dahinter

- **Alles hängt an Wortzeiten.** Bild, Text und Sounds beziehen ihre Einsätze aus einer Tabelle mit den Wortzeiten des
  Voiceovers. Ein neuer Take verschiebt alles gemeinsam. So werden Varianten eines Videos billig.
- **Nur echte, aufgenommene Geräusche.** Auslöser, Mausklick, Klapptafel, Papier, Bleistift, Tasten. Keine synthetischen
  UI-Pakete. Jede Bewegung bekommt einen kleinen Sound, leise genug, dass er nicht eingefügt klingt.
- **Erst ansehen und messen, dann „fertig“ sagen.** Einzelbild rendern und anschauen, Nur-Effekte-Spur rendern und Pegel
  vergleichen, Lautheit des Exports prüfen.
- **Der Mensch gibt frei.** Agenten schlagen vor und bauen; gepostet wird erst nach ausdrücklicher Freigabe.

## Lizenzen und Dank

Die Sounds sind CC0 bzw. gemeinfrei, Details und Quellen in [`SOUNDS-LIZENZEN.md`](SOUNDS-LIZENZEN.md).
Additional sounds: Joseph SARDIN – [BigSoundBank.com](https://BigSoundBank.com).
Für Code und Texte ist noch keine Lizenz festgelegt.

## Was bewusst fehlt

Eigenes Videomaterial, Voiceover, Musik und alles Kontospezifische. Musik gehört nicht ins Repo; siehe
[`docs/recherche-2026-10.md`](docs/recherche-2026-10.md) zu Musikrechten beim Posten.
