# Rundgang: Video durch das shortform-edit-kit

Dieses Projekt baut `docs/rundgang.mp4`: eine Tour in fünf Schritten (Skript und Voiceover, Clips reindroppen, Sound-Design, Fertig machen,
Posten), 1920 × 1080, 30 fps, rund 80 Sekunden. Die Browser-Werkzeuge sind **echte Aufnahmen** (headless Chromium, scharf in doppelter
Auflösung), die Terminal-Szenen sind **nachgebaut** (kein echtes Terminal, damit kein Benutzer-, Rechner- oder Pfadname ins Bild kommt).
Gesetzt wird mit Remotion: Fenster mit runden Ecken und Schatten auf einem ruhigen Verlauf, sanfte Zooms, Kapitelmarke oben,
eine Bildunterzeile unten. Ton: nur leise Effekte aus `sfx-kit/sounds/` (Seite blättern, Auslöser, Tasten) und der Ton von `beispiel/demo.mp4`.

| Ordner/Datei | Inhalt |
|---|---|
| `aufnahmen/cap.mjs` | Aufnahme-Bibliothek: Chrome-Screencast in voller Auflösung, Mauszeiger, Klick-Ring, Tastenanzeige |
| `aufnahmen/aufnehmen.mjs` | die vier Browser-Szenen: `tonstudio`, `props`, `zeitleiste`, `hoerseite` |
| `scripts/vorbereiten.mjs` | skaliert die Aufnahmen, kopiert Demo-Video und Sounds nach `public/`, schreibt `src/marks.json` |
| `src/Rundgang.tsx` | Schnitt: Szenen, Zooms, Bildunterzeilen, Kapitel, Ton |
| `src/Terminal.tsx`, `src/scripts.ts` | das gezeichnete Terminal und sein Text |
| `src/marks.json` | Zeitmarken der Aufnahmen (klein, wird eingecheckt, damit `tsc` ohne Rohaufnahmen läuft) |

Nicht eingecheckt (siehe `.gitignore`): `node_modules/`, `public/`, `out/`, `work/` und alles Große in `aufnahmen/` (Rohvideos, Browser, Testmikrofon).

## Voraussetzungen

Node 20 oder neuer, Python 3, ffmpeg, unter macOS der Befehl `say` (für die Testsprecherstimme). Für Schritt 1 außerdem whisper.cpp mit einem Modell
(siehe `tonstudio/README.md`).

```bash
cd rundgang && npm install
```

```bash
cd rundgang/aufnahmen && npm install
```

Chromium kommt in einen Ordner neben den Aufnahmeskripten (das Repo bleibt sauber, nichts landet im Benutzerordner):

```bash
cd rundgang/aufnahmen && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers npx playwright install chromium-headless-shell
```

## Neu aufnehmen

Die Werkzeuge laufen auf eigenen Ports, damit nichts mit einer laufenden Sitzung kollidiert. Damit `npm run vo` und das Studio nichts im Repo
verändern, arbeiten sie in einer Kopie von `beispiel/` und `tonstudio/` unter `rundgang/work/` (APFS-Klon, kostet kaum Platz).

```bash
cd rundgang && mkdir -p work aufnahmen/roh aufnahmen/logs && cp -Rc ../beispiel work/beispiel && cp -Rc ../tonstudio work/tonstudio && rm -rf work/beispiel/out
```

Testmikrofon: eine Stimme per `say`, mit vier Sekunden Stille vorn (so lange läuft der Countdown der Aufnahme-Seite), auf etwa −9 dBFS.
Der Satz ist der Text aus `beispiel/skript.json`.

```bash
cd rundgang/aufnahmen/roh && say -v Daniel -r 150 -o u.aiff "this is your hook, [[slnc 250]] hello. [[slnc 700]] look at these numbers. [[slnc 700]] I'm Your Name, [[slnc 150]] thanks [[slnc 120]] for watching."
```

```bash
cd rundgang/aufnahmen/roh && ffmpeg -y -i u.aiff -af "adelay=3900|3900,apad=pad_dur=3,volume=-8dB" -ar 48000 -ac 1 -c:a pcm_s16le fake-mic.wav
```

Ein neutraler Beispielclip für das Props-Feld (ein ruhiger Farbverlauf, kein Material von Menschen):

```bash
cd rundgang/work/beispiel/public && ffmpeg -y -f lavfi -i "gradients=s=1280x720:d=14:r=30:speed=0.018:c0=0x1d4ed8:c1=0xf59e0b:c2=0xec4899:c3=0x10b981:nb_colors=4" -c:v libx264 -pix_fmt yuv420p -crf 20 beispiel-clip.mp4
```

Die Werkzeuge starten, jedes in einem eigenen Terminal, ausgehend vom Repo-Ordner (Ports 4731 bis 4733; die Adressen in den Titelleisten des Videos sind die Standardports aus den README-Dateien). Die Hörseite läuft aus dem Repo selbst, ihre Urteile gehen über `HOERSEITE_STATE` in die Kopie, `auswahl.json` im Repo bleibt unberührt:

```bash
HOERSEITE_PORT=4731 HOERSEITE_STATE=$PWD/rundgang/work/auswahl.json python3 hoerseite.py
```

```bash
cd rundgang/work/beispiel && npm run tonstudio -- --port 4732
```

Zuerst die Tonstudio-Szene aufnehmen (sie legt einen Take in `work/beispiel/recordings/` ab) und danach den echten `vo`-Lauf machen, dessen Ausgabe das
Terminal im Video zeigt. Whisper lässt „thanks for watching“ am Ende gern weg (bekannte Eigenheit); mit dieser Stimme und der kurzen Pause nach „thanks“ wird es erkannt, sonst hilft `--erlaube-abweichung`.

```bash
cd rundgang/aufnahmen && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node aufnehmen.mjs tonstudio
```

```bash
cd rundgang/work/beispiel && TONSTUDIO_MODELLE=<pfad>/ggml-large-v3-turbo.bin npm run vo -- recordings/<take>.wav
```

Danach das Studio in der Kopie starten (es liest die neue `timing.ts` und `public/vo.wav`):

```bash
cd rundgang/work/beispiel && npx remotion studio --port 4733 --no-open
```

Die übrigen drei Szenen aufnehmen:

```bash
cd rundgang/aufnahmen && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node aufnehmen.mjs props
```

```bash
cd rundgang/aufnahmen && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node aufnehmen.mjs zeitleiste
```

```bash
cd rundgang/aufnahmen && PLAYWRIGHT_BROWSERS_PATH=$PWD/.browsers node aufnehmen.mjs hoerseite
```

Ports anders wählen: `PORT_TONSTUDIO`, `PORT_STUDIO`, `PORT_HOERSEITE`. Danach alle Server beenden und `work/auswahl.json` löschen.

Hinweis: Beim Verlassen eines Props-Feldes zeigt das Studio kurz „Cannot update default props“ (die Standardwerte stehen in einer Variablen, nicht
in der Datei). Die Szene `props` wartet die Meldung ab, der Schnitt in `Rundgang.tsx` überspringt genau diese Sekunden.

## Rendern

Aufnahmen und Ton für Remotion bereitstellen (ruft ffmpeg auf, schreibt `public/` und `src/marks.json`):

```bash
cd rundgang && npm run vorbereiten
```

Typen prüfen:

```bash
cd rundgang && npx tsc --noEmit
```

Rendern (H.264, yuv420p, AAC; mit PNG-Einzelbildern, sonst meldet ffmpeg das Video als `yuvj420p` mit vollem Wertebereich):

```bash
cd rundgang && npx remotion render Rundgang out/rundgang.mp4 --image-format=png --codec=h264 --crf=23 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=192k
```

Standbild für die Vorschau (Bild 1004 ist der Einstieg in Kapitel 3, das Fenster steht ganz auf dem Verlauf):

```bash
cd rundgang && npx remotion still Rundgang ../docs/rundgang.jpg --frame=1004 --image-format=jpeg --jpeg-quality=85
```

Das Video nach `docs/` legen (rund 11 MB; das Standbild liegt dort schon):

```bash
cp rundgang/out/rundgang.mp4 docs/rundgang.mp4
```

## Anpassen

- Texte der Terminal-Szenen: `src/scripts.ts`. Die Ausgabe von `npm run vo` stammt aus einem echten Lauf (lange Zeilen mit „…“ gekürzt);
  `post_render.sh` und `post_social.py` folgen dem Ausgabeformat der Skripte, die Zahlen (Lautheit, Dateigrößen) sind Beispielwerte.
- Zooms und Tempo je Szene: oben in `src/Rundgang.tsx` (Abschnitte `*Segs` in Rohzeit der Aufnahme, `*ZoomRaw` mit Maßstab und Zielpunkt als Anteil des Fensters).
- Eine Selbstaufnahme mit eigener Stimme: `../docs/drehplan-cap.md`.
