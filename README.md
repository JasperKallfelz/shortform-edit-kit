# shortform-edit-kit

Werkzeuge, Sound-Effekte und Abläufe für kurze Hochkant-Videos (TikTok, Reels), gebaut mit [Remotion](https://www.remotion.dev)
und KI-Agenten (Claude Code, Hermes). Der Ordner ist so aufgebaut, dass ein Agent damit ein Video von „hier ist das Skript“
bis „veröffentlicht und nachgelesen“ begleiten kann, und dass man die Handgriffe nicht jedes Mal neu erfindet.

*English in one line: a voiceover studio, tools, 233 CC0 sound-effect candidates (51 of them prepared), agent skills, a posting
script and a Remotion demo for building short vertical videos with natural-sounding sound design. Docs are in German.*

[![Rundgang durch das Kit](docs/rundgang.jpg)](docs/rundgang.mp4)

Der Rundgang zeigt, wo im Kit was liegt und wie aus einem Skript ein fertiges Video wird; ein Klick aufs Bild spielt ihn ab.

**Für KI-Agenten:** Einstieg, Regeln und die Checkliste stehen in [`AGENTS.md`](AGENTS.md).

## Was drin ist

| Pfad | Inhalt |
|---|---|
| `AGENTS.md` | Einstieg für einen KI-Agenten, der mit dem Kit ein Video baut oder ändert: Ordnerkarte, fünf Schritte als Checkliste, Hausregeln |
| `tonstudio/` | Voiceover: im Browser aufnehmen (Teleprompter), aufbereiten, Wortzeiten messen und die Zeit-Tabelle `src/timing.ts` erzeugen. Läuft ganz lokal |
| `beispiel/` | Remotion-Demo ohne eigenes Material: Text, der zum Sprechtakt aufpoppt, Clip-Karte mit Zoom, gezeichneter Pfeil, laufende Zahl, Sound-Spur, dazu `skript.json` für das Tonstudio. `demo.mp4` zeigt das Ergebnis |
| `sfx-kit/` | 51 aufbereitete Sound-Effekte (echte Aufnahmen), Katalog mit Länge, Einsatzpunkt und Lautheit, Skripte zum Aufbereiten und zum Einspielen in ein Remotion-Projekt |
| `sfx-kandidaten/` | 233 rohe Kandidaten mit Quelle und Lizenz je Datei (`manifest.tsv`) |
| `hoerseite.py`, `index.html` | Hörseite im Browser: alle Sounds durchhören, behalten oder aussortieren, auch nur mit der Tastatur |
| `edit-tools/` | Skripte: Videos aus WhatsApp holen, Kontaktbogen, Dateien sicher ändern, fertiger Export mit Lautheitsprüfung, Posten auf TikTok und Instagram (`post_social.py`). Das README dort beschreibt die Abläufe, `POSTEN.md` das Posten |
| `skills/` | Zwei Skills für Agenten (Hermes-Format, als Anleitung auch für Claude Code brauchbar) |
| `docs/` | Was die Forschung zu Zuschauerbindung, Beschreibung, Hashtags und Musikrechten sagt, mit Quellen; dazu der Rundgang (`rundgang.mp4`) |

## Der Ablauf in fünf Schritten

Ein Video entsteht in dieser Reihenfolge. Zu jedem Schritt gehört ein Merkmal, an dem man sieht, dass er fertig ist; die
ausführliche Fassung steht in [`edit-tools/README.md`](edit-tools/README.md). Schritt 1 läuft im Ordner `beispiel/`
(dem Projektordner), die Befehle der Schritte 2 bis 5 vom Wurzelordner des Repos aus, wenn nicht anders vermerkt.

**1. Skript und Voiceover** – [`tonstudio/`](tonstudio/README.md).
Die gesprochenen Sätze stehen in `skript.json`. Man nimmt im Browser mit Teleprompter auf; danach misst `npm run vo` die Wortzeiten
und schreibt `src/timing.ts` neu. Bild, Text und Sounds hängen an diesen Zeiten und wandern mit. Eine Variante des Videos ist ein
weiterer Take eines ähnlichen Skripts. Fertig, wenn die Ausrichtung ohne Abbruch durchläuft und das Studio die neue Länge zeigt.

```bash
npm run tonstudio
```

```bash
npm run vo -- recordings/<take>.wav
```

**2. Clips reindroppen** – [`edit-tools/README.md`](edit-tools/README.md#ablauf-2-clips-reindroppen).
Videos aus WhatsApp holen, per Kontaktbogen den Clip zum Standbild finden, die Datei nach `public/` legen und im Studio einen Slot
(`slots` in den Props: Label, Datei, Startsekunde) setzen. Fertig, wenn ein gerenderter Einzelframe angesehen wurde.

```bash
python3 edit-tools/whatsapp_clips.py export "<Name>" --date JJJJ-MM-TT --fotos
```

```bash
python3 edit-tools/kontaktbogen.py <ordner>
```

**3. Sound-Design** – [`sfx-kit/README.md`](sfx-kit/README.md).
Sounds auf der Hörseite aussortieren, in die Cue-Liste `SFX_CUES` eintragen, jede Cue an eine Wortzeit oder Animations-Konstante
gehängt. Fertig, wenn die Nur-Effekte-Spur gerendert und gegen die Musik gemessen ist (Befehl im Ordner `beispiel/`).

```bash
python3 hoerseite.py
```

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
```

**4. Fertig machen** – [`edit-tools/post_render.sh`](edit-tools/post_render.sh).
Bild in hoher Qualität (H.264, CRF 14), Ton auf höchstens −14 LUFS, einmal mit und einmal ohne Musik, dazu Cover-Bilder der
genannten Frames (hier 60, 150 und 240). Das Ergebnis liegt in `<projekt>/out/post-<Datum>/`; das Skript druckt die gemessene Lautheit je Fassung.

```bash
EDIT_HOST=<ssh-name> edit-tools/post_render.sh <projektordner> <Komposition> <Name> 60,150,240
```

**5. Posten** – [`edit-tools/POSTEN.md`](edit-tools/POSTEN.md).
Ein Mensch gibt die Beschreibung frei. Dann erst Trockenlauf oder Entwurf, nach einer zweiten Freigabe `--publish`, danach liest das
Skript den Beitrag zurück (Post-ID, Link, bei Instagram die Beschreibung Byte für Byte). Ohne `--publish` wird nichts veröffentlicht.

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <beschreibung.txt> --dry-run
```

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <beschreibung.txt> --publish
```

## Schnellstart

Beispielprojekt starten (Remotion Studio, Composition `Demo`), im Ordner `beispiel/`:

```bash
npm install
```

```bash
npm run dev
```

Hörseite starten (läuft unter http://localhost:3700, Urteile landen in `auswahl.json`, die nicht eingecheckt wird):

```bash
python3 hoerseite.py
```

Neue Sounds ins Kit und ins Projekt:

```bash
python3 sfx-kit/tools/prepare_sfx.py
```

```bash
python3 sfx-kit/tools/sync_remotion.py beispiel
```

Prüfen, ob alles noch zusammenpasst: Lint und Typen des Beispielprojekts (im Ordner `beispiel/`) und die Tests des Post-Skripts
(ohne Netz):

```bash
npm run lint
```

```bash
python3 -m unittest discover -s edit-tools/tests
```

Voraussetzungen: Node 20+, Python 3.9+, ffmpeg. Je nach Schritt zusätzlich:

- Tonstudio: `numpy` und [whisper.cpp](https://github.com/ggerganov/whisper.cpp) mit mindestens einem Modell (Details in [`tonstudio/README.md`](tonstudio/README.md))
- `prepare_sfx.py`: `numpy`, `soundfile`, `librosa`
- `ton_check.py`, `beat_align.py`: `numpy`, `soundfile`, `librosa`
- Kontaktbogen: `Pillow`; `whatsapp_clips.py`: macOS mit WhatsApp Desktop
- `post_render.sh`: `zsh`, `ssh`, `rsync` (läuft auch auf einem einzigen Rechner, wenn dort die Fernanmeldung an ist)
- Posten: Composio-CLI (angemeldet) und `curl`, siehe [`edit-tools/POSTEN.md`](edit-tools/POSTEN.md)

## Was die Forschung dazu sagt

Zusammenfassung von [`docs/recherche-2026-10.md`](docs/recherche-2026-10.md) (Stand 08.10.2026, mit Beleglage je Aussage; vor dem
Zitieren einer Zahl die Quelle selbst prüfen):

- Die ersten 1,5 bis 3 Sekunden entscheiden: mit dem stärksten Bild beginnen, einen klaren Höhepunkt setzen, das Gesicht früh zeigen,
  Text im Bild. Sättigung hochdrehen bringt nach Beleglage nichts.
- Beschreibung und Hashtags sind Nebensache gegenüber Sehdauer und Weiterleitungen. Instagram erlaubt seit Dezember 2025 höchstens 5
  Hashtags, für TikTok reichen 3 bis 4 passende.
- Musik: Die Fassung ohne Musik hochladen und den Song in der App aus der Bibliothek der Plattform dazulegen.
- Varianten und Test-Reels: je Runde nur eine Sache ändern, zuerst die ersten 1,5 Sekunden, und mindestens 72 Stunden warten.

## Die Grundsätze dahinter

- **Alles hängt an Wortzeiten.** Bild, Text und Sounds beziehen ihre Einsätze aus einer Tabelle mit den Wortzeiten des
  Voiceovers (`src/timing.ts`, vom Tonstudio erzeugt). Ein neuer Take verschiebt alles gemeinsam. So werden Varianten eines
  Videos billig.
- **Nur echte, aufgenommene Geräusche.** Auslöser, Mausklick, Klapptafel, Papier, Bleistift, Tasten. Keine synthetischen
  UI-Pakete. Jede Bewegung bekommt einen kleinen Sound, leise genug, dass er nicht eingefügt klingt.
- **Erst ansehen und messen, dann „fertig“ sagen.** Einzelbild rendern und anschauen, Nur-Effekte-Spur rendern und Pegel
  vergleichen, Lautheit des Exports prüfen, den veröffentlichten Beitrag zurücklesen.
- **Die Werkzeuge brechen lieber ab, als zu raten.** Das Tonstudio liefert keine Zeiten, wenn die Wortzahl nicht stimmt; das
  Post-Skript legt ohne `--publish` nichts Öffentliches an.
- **Der Mensch gibt frei.** Agenten schlagen vor und bauen; gepostet wird erst nach ausdrücklicher Freigabe der Beschreibung und
  der Veröffentlichung.

## Lizenzen und Dank

Die Sounds sind CC0 bzw. gemeinfrei, Details und Quellen in [`SOUNDS-LIZENZEN.md`](SOUNDS-LIZENZEN.md).
Additional sounds: Joseph SARDIN – [BigSoundBank.com](https://BigSoundBank.com).
Für Code und Texte ist noch keine Lizenz festgelegt.

## Was bewusst fehlt

Eigenes Videomaterial, Aufnahmen und Voiceover, Musik und alles Kontospezifische (Konten-IDs, Konfiguration, Protokolle). Musik
gehört nicht ins Repo; siehe [`docs/recherche-2026-10.md`](docs/recherche-2026-10.md) zu Musikrechten beim Posten. Welche Dateien nie
eingecheckt werden, steht in [`AGENTS.md`](AGENTS.md).
