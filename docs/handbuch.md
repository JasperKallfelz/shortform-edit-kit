# Handbuch: alle Befehle Schritt für Schritt

Die Befehle des Kits in der Reihenfolge, in der ein Video entsteht. Den Überblick gibt die [`README.md`](../README.md), die Einrichtung
und alle Stellschrauben stehen in [`einrichtung.md`](einrichtung.md).

## Der Ablauf in fünf Schritten

Ein Video entsteht in dieser Reihenfolge. Zu jedem Schritt gehört ein Merkmal, an dem man sieht, dass er fertig ist; die
ausführliche Fassung steht in [`edit-tools/README.md`](../edit-tools/README.md). Schritt 1 läuft im Ordner `beispiel/`
(dem Projektordner), die Befehle der Schritte 2 bis 5 vom Wurzelordner des Repos aus, wenn nicht anders vermerkt.

**1. Skript und Voiceover** – [`tonstudio/`](../tonstudio/README.md).
Die gesprochenen Sätze stehen in `skript.json`. Man nimmt im Browser mit Teleprompter auf; danach misst `npm run vo` die Wortzeiten
und schreibt `src/timing.ts` neu. Bild, Text und Sounds hängen an diesen Zeiten und wandern mit. Eine Variante des Videos ist ein
weiterer Take eines ähnlichen Skripts. Fertig, wenn die Ausrichtung ohne Abbruch durchläuft und das Studio die neue Länge zeigt.

```bash
npm run tonstudio
```

```bash
npm run vo -- recordings/<take>.wav
```

**2. Clips reindroppen** – [`edit-tools/README.md`](../edit-tools/README.md#ablauf-2-clips-reindroppen).
Videos aus WhatsApp holen, per Kontaktbogen den Clip zum Standbild finden, die Datei nach `public/` legen und im Studio einen Slot
(`slots` in den Props: Label, Datei, Startsekunde) setzen. Fertig, wenn ein gerenderter Einzelframe angesehen wurde.

```bash
python3 edit-tools/whatsapp_clips.py export "<Name>" --date JJJJ-MM-TT --fotos
```

```bash
python3 edit-tools/kontaktbogen.py <ordner>
```

**3. Sound-Design** – [`sfx-kit/README.md`](../sfx-kit/README.md).
Sounds auf der Hörseite aussortieren, in die Cue-Liste `SFX_CUES` eintragen, jede Cue an eine Wortzeit oder Animations-Konstante
gehängt. Fertig, wenn die Nur-Effekte-Spur gerendert und gegen die Musik gemessen ist (Befehl im Ordner `beispiel/`).

```bash
python3 hoerseite.py
```

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
```

**4. Fertig machen** – [`edit-tools/post_render.sh`](../edit-tools/post_render.sh).
Bild in hoher Qualität (H.264, CRF 14), Ton auf höchstens −14 LUFS, einmal mit und einmal ohne Musik, dazu Cover-Bilder der
genannten Frames (hier 60, 150 und 240). Das Ergebnis liegt in `<projekt>/out/post-<Datum>/`; das Skript druckt die gemessene Lautheit je Fassung.

```bash
EDIT_HOST=<ssh-name> edit-tools/post_render.sh <projektordner> <Komposition> <Name> 60,150,240
```

**5. Posten** – [`edit-tools/POSTEN.md`](../edit-tools/POSTEN.md).
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

- Tonstudio: `numpy` und [whisper.cpp](https://github.com/ggerganov/whisper.cpp) mit mindestens einem Modell (Details in [`tonstudio/README.md`](../tonstudio/README.md))
- `prepare_sfx.py`: `numpy`, `soundfile`, `librosa`
- `ton_check.py`, `beat_align.py`: `numpy`, `soundfile`, `librosa`
- Kontaktbogen: `Pillow`; `whatsapp_clips.py`: macOS mit WhatsApp Desktop
- `post_render.sh`: `zsh`, `ssh`, `rsync` (läuft auch auf einem einzigen Rechner, wenn dort die Fernanmeldung an ist)
- Posten: Composio-CLI (angemeldet) und `curl`, siehe [`edit-tools/POSTEN.md`](../edit-tools/POSTEN.md)
