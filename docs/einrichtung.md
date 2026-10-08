# Einrichtung und Konfiguration

Diese Anleitung ist für einen KI-Agenten geschrieben, der das Kit auf einem fremden Rechner einrichtet. Menschen können denselben
Schritten folgen. Alle Befehle laufen im Wurzelordner des geklonten Repos, wenn nicht anders vermerkt. Jeder Schritt endet mit einem
Merkmal („fertig, wenn …“), das man am Befehl selbst ablesen kann.

Regeln für die Einrichtung:

- Nichts posten, keine Entwürfe anlegen, keine Konten verbinden. Das tut nur der Mensch.
- Aufnehmen, das Mikrofon freigeben und Konten anmelden kann nur der Mensch. Sage ihm, was fehlt, statt es zu überspielen.
- Persönliche Dateien (Konto-IDs, Aufnahmen, Urteile) bleiben außerhalb von Commits; die Liste steht unter [Persönliches](#34-persönliches-wird-nie-eingecheckt).
- Gib keine Konto-IDs, Upload-Adressen oder Beschreibungen in Berichte aus.

## 1. Voraussetzungen prüfen

Geprüft wurde diese Anleitung mit Node 22, Python 3.9 (System) und 3.13, ffmpeg 8 und npm 12 unter macOS.

| Was | Prüfbefehl | Fehlt es | Nötig für |
|---|---|---|---|
| Node 20 oder neuer | `node --version` | von nodejs.org oder `brew install node` | alles mit Remotion, Aufnahme-Seite |
| Python 3.9 oder neuer | `python3 --version` | `brew install python` | alle Skripte |
| ffmpeg und ffprobe | `ffmpeg -version` | `brew install ffmpeg` | `vo`, `post_render.sh`, Kontaktbogen |
| `numpy` | `python3 -c "import numpy"` | `pip install numpy` | Tonstudio (`npm run vo`) |
| `whisper-cli` | `command -v whisper-cli` | `brew install whisper-cpp` | Wortzeiten (`npm run vo`) |
| ein ggml-Modell | `echo "$TONSTUDIO_MODELLE"`, dann `ls -l <pfad>` je Pfad | siehe Schritt 7 | Wortzeiten (`npm run vo`) |
| `soundfile`, `librosa` | `python3 -c "import soundfile, librosa"` | `pip install soundfile librosa` | `prepare_sfx.py`, `ton_check.py`, `beat_align.py` |
| `Pillow` | `python3 -c "import PIL"` | `pip install Pillow` | `kontaktbogen.py` |
| `zsh`, `ssh`, `rsync` | `zsh --version`, `ssh -V`, `rsync --version` | Paketverwaltung des Systems | `post_render.sh` |
| `composio`, `curl` | `composio whoami`, `curl --version` | siehe [`edit-tools/POSTEN.md`](../edit-tools/POSTEN.md) | `post_social.py` (nur Posten) |
| macOS mit WhatsApp Desktop | `ls ~/Library/Group\ Containers \| grep -i whatsapp` | nur auf macOS möglich | `whatsapp_clips.py` (nur Clips aus WhatsApp) |
| Browser mit Mikrofon | (kein Befehl) | der Mensch wählt ihn | Aufnahme-Seite |
| `swiftc` (freiwillig) | `command -v swiftc` | `xcode-select --install` | Eingabegerät umschalten (`setinput`) |

Nur das Beispielprojekt und die Tests brauchen Node, Python und ffmpeg. Alles andere gilt erst, wenn der Mensch den jeweiligen Schritt
braucht: Sage ihm am Ende, was fehlt, und installiere nichts, was er nicht braucht.

Remotion lädt beim ersten Rendern einmalig einen Headless-Chrome (Download rund 95 MB) nach `beispiel/node_modules/.remotion`. Dafür braucht
der Rechner beim ersten Render Netz.

## 2. Einrichten

Schritt 1: ins Repo wechseln und prüfen, dass es vollständig ist.

```bash
ls AGENTS.md beispiel/package.json tonstudio/recorder/server.mjs
```

Fertig, wenn alle drei Dateien aufgelistet werden.

Schritt 2: Beispielprojekt installieren.

```bash
cd beispiel && npm ci
```

Fertig, wenn der Befehl mit Exit-Code 0 endet und `beispiel/node_modules/` existiert. Hinweise zu Schwachstellen (`npm audit`) und
zu einem blockierten Install-Skript von `esbuild` erscheinen bei dieser Version von npm; Lint und Render laufen trotzdem.

Schritt 3: Typen und Stil des Beispielprojekts prüfen (im Ordner `beispiel/`).

```bash
npm run lint
```

Fertig, wenn der Befehl ohne Fehlermeldung endet (Exit-Code 0; er führt `eslint src && tsc` aus).

Schritt 4: Tests des Post-Skripts laufen lassen. Sie brauchen kein Netz und kein Konto.

```bash
python3 -m unittest discover -s edit-tools/tests
```

Fertig, wenn die letzte Zeile `OK` lautet.

Schritt 5: Remotion Studio starten (im Ordner `beispiel/`). Es läuft weiter, bis man es beendet; dem Menschen die gedruckte Adresse nennen.

```bash
npm run dev
```

Fertig, wenn die Ausgabe eine Adresse nennt und die Composition `Demo` im Browser erscheint. Ohne Studio lässt sich dasselbe so
belegen (im Ordner `beispiel/`):

```bash
npx remotion compositions src/index.ts
```

Fertig, wenn eine Zeile mit `Demo`, `30`, `1080x1920` und `270 (9.00 sec)` erscheint (Name, Bilder pro Sekunde, Größe, Länge).

Schritt 6: ein Einzelbild rendern und ansehen (im Ordner `beispiel/`; `out/` ist von Git ausgeschlossen).

```bash
npx remotion still Demo out/bild.png --frame=60
```

Fertig, wenn `out/bild.png` entsteht (1080 × 1920 Pixel) und das Bild angesehen wurde.

Schritt 7: Whisper für die Wortzeiten bereitstellen. Nur nötig, wenn der Mensch ein Voiceover aufnehmen will.

```bash
brew install whisper-cpp
```

Ein Modell laden (im Ordner von whisper.cpp; für andere Sprachen als Englisch ein Modell ohne `.en`):

```bash
sh models/download-ggml-model.sh medium.en
```

Die Pfade bekanntmachen, durch Komma getrennt (mehrere Modelle machen die Zeiten genauer, eines reicht):

```bash
export TONSTUDIO_MODELLE=~/whisper/ggml-medium.en.bin
```

Fertig, wenn `command -v whisper-cli` einen Pfad nennt und jede Modelldatei existiert. Ohne Modell bricht `npm run vo` mit
„Kein Whisper-Modell angegeben“ ab, bevor etwas verändert wird.

Schritt 8: Aufnahme-Seite starten (im Ordner `beispiel/`). Aufnehmen kann nur der Mensch.

```bash
npm run tonstudio
```

Fertig, wenn die Ausgabe `Aufnahme-Seite: http://localhost:3600` nennt und die Seite 200 liefert:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3600/
```

Der Browser fragt dort nach dem Mikrofon; nur über `http://localhost:…` (nicht über eine andere Adresse) ist die Freigabe möglich.

Schritt 9: Hörseite starten, wenn der Mensch Sounds aussortieren will.

```bash
python3 hoerseite.py
```

Fertig, wenn sie unter `http://localhost:3700` antwortet und Kit und Kandidaten zusammen 284 Sounds liefern (51 aufbereitete und 233 Kandidaten):

```bash
curl -s http://localhost:3700/api/sounds | python3 -c "import json,sys; print(len(json.load(sys.stdin)['sounds']))"
```

Die Hörseite legt `auswahl.json` an (von Git ausgeschlossen). Soll nichts im Repo entstehen, `HOERSEITE_STATE` auf eine andere Datei setzen.

Schritt 10: Sounds ändern, nur wenn der Mensch neue Sounds will. `prepare_sfx.py` schreibt **alle** Sounds und den Katalog neu; `sync_remotion.py` kopiert sie
in das Projekt (dort `public/sfx` und `src/lib/sfx.tsx`).

```bash
python3 sfx-kit/tools/prepare_sfx.py
```

```bash
python3 sfx-kit/tools/sync_remotion.py beispiel
```

Fertig, wenn `sync_remotion.py` „51 Sounds im Projekt“ meldet. Mit dem zweiten Argument (md5 von `src/lib/sfx.tsx`) bricht es ab, ohne zu schreiben,
falls ein anderer Agent die Datei inzwischen geändert hat.

Schritt 11: Posten vorbereiten, nur wenn der Mensch posten will. Das Konto verbindet er selbst (siehe [`edit-tools/POSTEN.md`](../edit-tools/POSTEN.md)).

```bash
cp edit-tools/post.config.example.json edit-tools/post.config.json
```

```bash
python3 edit-tools/post_social.py accounts
```

`accounts` liest nur und nennt, welche Werte in die Datei gehören. Fertig, wenn die Datei die Werte enthält, die `accounts` genannt hat.
`post.config.json` steht in `.gitignore`.

Schritt 12: Export vorbereiten, nur wenn ein Video fertig gemacht werden soll. `post_render.sh` braucht `EDIT_HOST`, den SSH-Namen des Rechners, auf dem das
Remotion-Projekt liegt (kann derselbe Rechner sein, wenn dort die Fernanmeldung an ist).

```bash
ssh <ssh-name> true
```

Fertig, wenn der Befehl ohne Passwortabfrage mit Exit-Code 0 endet.

### Was nur der Mensch tun kann

- das Mikrofon im Browser und in den Systemeinstellungen freigeben und die Aufnahme sprechen
- Konten für TikTok und Instagram bei Composio verbinden
- die Beschreibung und danach das Veröffentlichen freigeben
- Musik wählen, deren Rechte geklärt sind (siehe [`recherche-2026-10.md`](recherche-2026-10.md))

## 3. Konfigurations-Referenz

Fundstellen sind `datei:zeile` im Stand dieses Repos. Pfade sind relativ zum Wurzelordner.

### 3.1 Umgebungsvariablen

| Name | Gelesen in | Standard | Wofür |
|---|---|---|---|
| `TONSTUDIO_MODELLE` | `tonstudio/vo/align.py:48` | leer (dann Abbruch) | Pfade der Whisper-Modelle (`ggml-*.bin`), durch Komma getrennt, `~` wird aufgelöst; `--modelle` hat Vorrang |
| `WHISPER_CLI` | `tonstudio/vo/align.py:40` | `whisper-cli` aus dem `PATH` | Pfad zu `whisper-cli` |
| `TONSTUDIO_PORT` | `tonstudio/recorder/server.mjs:31` | `3600` | Port der Aufnahme-Seite (der Server hört nur auf `127.0.0.1`); `--port` hat Vorrang |
| `HOERSEITE_PORT` | `hoerseite.py:22` | `3700` | Port der Hörseite (nur `127.0.0.1`) |
| `HOERSEITE_STATE` | `hoerseite.py:21` | `auswahl.json` neben `hoerseite.py` | Datei für die Urteile (behalten oder aussortieren). **Persönlich** |
| `EDIT_HOST` | `edit-tools/post_render.sh:16` | keiner, **Pflicht** | SSH-Name des Rechners, auf dem das Remotion-Projekt liegt |
| `PORT_TONSTUDIO` | `rundgang/aufnahmen/aufnehmen.mjs:7` | `4732` | Port der Aufnahme-Seite beim Neuaufnehmen des Rundgangs |
| `PORT_STUDIO` | `rundgang/aufnahmen/aufnehmen.mjs:8` | `4733` | Port des Remotion Studios dabei |
| `PORT_HOERSEITE` | `rundgang/aufnahmen/aufnehmen.mjs:9` | `4731` | Port der Hörseite dabei |
| `RUNDGANG_DEBUG` | `rundgang/src/Rundgang.tsx:159` | nicht gesetzt | gesetzt druckt der Rundgang die Länge jeder Szene |
| `PLAYWRIGHT_BROWSERS_PATH` | liest Playwright selbst; gesetzt in den Befehlen von `rundgang/README.md` | Benutzerordner von Playwright | Ordner für den Chromium der Rundgang-Aufnahmen |

### 3.2 Kommandozeilen-Schalter

Hilfe gibt es bei `vo.py`, `server.mjs`, `whatsapp_clips.py`, `kontaktbogen.py`, `post_social.py`, `ton_check.py` und `beat_align.py` mit `--help`.

**Aufnahme-Seite** (`node tonstudio/recorder/server.mjs`, im Projekt als `npm run tonstudio`)

| Schalter | Standard | Wirkung | Fundstelle |
|---|---|---|---|
| `--projekt <ordner>` | aktueller Ordner | Projektordner | `tonstudio/recorder/server.mjs:28` |
| `--skript <datei>` | `skript.json` im Projekt | Skript für den Teleprompter | `tonstudio/recorder/server.mjs:29` |
| `--ordner <ziel>` | `recordings` im Projekt (wird angelegt) | wohin die Takes gesichert werden; nie überschrieben | `tonstudio/recorder/server.mjs:30` |
| `--port <nummer>` | `TONSTUDIO_PORT`, sonst 3600 | Port | `tonstudio/recorder/server.mjs:31` |

**Voiceover** (`python3 tonstudio/vo/vo.py`, im Projekt als `npm run vo -- <take>`)

| Schalter | Standard | Wirkung | Fundstelle |
|---|---|---|---|
| `eingabe` (ein oder mehrere) | Pflicht | `take.wav` oder `take.wav:von_ms:bis_ms[:gain_db]`; mehrere Stücke werden hintereinander gesetzt | `tonstudio/vo/vo.py:110` |
| `--projekt` | `.` | Projektordner | `tonstudio/vo/vo.py:111` |
| `--skript` | `skript.json` | Skript-Datei, relativ zum Projekt | `tonstudio/vo/vo.py:112` |
| `--zeiten` | `src/timing.ts` | Zeit-Tabelle, die geschrieben wird | `tonstudio/vo/vo.py:113` |
| `--public` | `public` | Ordner für die fertige Audiodatei | `tonstudio/vo/vo.py:114` |
| `--kette` | `neutral` | Klang-Variante: `neutral` oder `tief` | `tonstudio/vo/vo.py:115` |
| `--modelle` | leer (dann `TONSTUDIO_MODELLE`) | Whisper-Modelle, durch Komma getrennt | `tonstudio/vo/vo.py:116` |
| `--setze SCHLÜSSEL=MS` | keiner | einen Zeitwert von Hand überschreiben (wiederholbar) | `tonstudio/vo/vo.py:117` |
| `--erlaube-abweichung` | aus | Wörter überspringen, die Whisper anders zählt; ihre Zeiten werden geschätzt | `tonstudio/vo/vo.py:118` |

Einzeln aufrufbar: `align.py <audio> <skript.json> [bericht.json] [--modelle a.bin,b.bin] [--erlaube-abweichung]` (`tonstudio/vo/align.py:355-374`),
`master.py <roh.wav> <ziel.wav> [neutral|tief] [ziel_lufs_je_kanal, Standard -17]` (`tonstudio/vo/master.py:114-116`), `skript.py <skript.json>` prüft eine Skript-Datei (`tonstudio/vo/skript.py:90`).
`setinput` (gebaut aus `tonstudio/mikro/setinput.swift`, Zeile 34-39) schaltet das Eingabegerät um: Argument ist ein Teil des Gerätenamens, ohne Argument werden die Geräte aufgelistet.

**Clips** (`whatsapp_clips.py`, `kontaktbogen.py`)

| Schalter | Standard | Wirkung | Fundstelle |
|---|---|---|---|
| `chats --days N` | 14 | Chats mit neuen Videos der letzten N Tage | `edit-tools/whatsapp_clips.py:113` |
| `export <chat> --date JJJJ-MM-TT` | keiner | nur Dateien dieses Tages | `edit-tools/whatsapp_clips.py:116` |
| `export --days N` | 1 | ohne `--date`: die letzten N Tage | `edit-tools/whatsapp_clips.py:117` |
| `export --bilder` | aus | auch Bilder | `edit-tools/whatsapp_clips.py:118` |
| `export --alle` | aus | auch selbst gesendete Dateien | `edit-tools/whatsapp_clips.py:119` |
| `export --out <ordner>` | `~/Movies/WhatsApp-<Name>-<Datum>` | Zielordner | `edit-tools/whatsapp_clips.py:120` |
| `export --fotos [ALBUM]` | aus | zusätzlich in die Fotomediathek importieren | `edit-tools/whatsapp_clips.py:121` |
| `kontaktbogen.py <ordner> --at S` | 1.0 | Sekunde des Vorschaubilds | `edit-tools/kontaktbogen.py:19` |
| `kontaktbogen.py --out <datei>` | `<ordner>/kontakt.jpg` | Zieldatei | `edit-tools/kontaktbogen.py:20`, `:42` |
| `kontaktbogen.py --spalten N` | 6 | Spalten | `edit-tools/kontaktbogen.py:21` |

`whatsapp_clips.py` liest den Pfad der WhatsApp-Datenbank aus der Konstante `BASE` (`edit-tools/whatsapp_clips.py:24`) und öffnet sie nur lesend.

**Ton** (`ton_check.py`, `beat_align.py`)

| Schalter | Standard | Wirkung | Fundstelle |
|---|---|---|---|
| `ton_check.py <sfx.wav>` | Pflicht | Nur-Effekte-Spur | `edit-tools/ton_check.py:28` |
| `--musik <song>` | keiner | Effekte gegen die Musik messen | `edit-tools/ton_check.py:29` |
| `--musik-start S` | 0.0 | Stelle im Song, an der das Video einsetzt | `edit-tools/ton_check.py:30` |
| `--musik-vol V` | 0.15 | Regler der Musik im Video | `edit-tools/ton_check.py:31` |
| `--mix <mix.wav>` | keiner | Lautheit und Spitze des Gesamtmixes | `edit-tools/ton_check.py:32` |
| `--abschnitt S` | 2.0 | Länge eines Abschnitts für den Pegel | `edit-tools/ton_check.py:33` |
| `--luecke S` | 0.5 | Strecken ohne Effekt ab dieser Länge auflisten | `edit-tools/ton_check.py:34` |
| `beat_align.py <song> <timing.ts> <wort>` | Pflicht | Schlag des Songs auf ein Wort legen | `edit-tools/beat_align.py:27-29` |
| `--auch w1,w2` | leer | weitere Wörter, deren Abstand zum Schlag gezeigt wird | `edit-tools/beat_align.py:30` |
| `--max-start S` | 120.0 | späteste Einstiegsstelle im Song | `edit-tools/beat_align.py:31` |
| `--fps N` | 30 | Bildrate für das Einrasten | `edit-tools/beat_align.py:32` |
| `--top N` | 6 | Anzahl der Kandidaten | `edit-tools/beat_align.py:33` |

**Export und Posten** (`post_render.sh`, `post_social.py`)

| Schalter | Standard | Wirkung | Fundstelle |
|---|---|---|---|
| `post_render.sh <projekt> <komposition> <name> [frames]` | drei Pflichtwerte | Projektordner im Home von `EDIT_HOST`, Komposition, Dateiname, Cover-Frames wie `60,150,240` | `edit-tools/post_render.sh:14-15` |
| `--dry-run` | aus | `post_social.py`: nur zeigen, nichts hochladen oder anlegen (auch zusammen mit `--publish`) | `edit-tools/post_social.py:697` |
| `--config <pfad>` | `post.config.json` neben dem Skript | andere Konfigurationsdatei; das Protokoll liegt dann daneben | `edit-tools/post_social.py:699` |
| `upload --neu` | aus | trotz frischem Upload neu hochladen | `edit-tools/post_social.py:705` |
| `tiktok --caption-file <datei>` | Pflicht | Beschreibung (UTF-8) | `edit-tools/post_social.py:708` |
| `tiktok --publish` | aus (dann Entwurf) | sofort veröffentlichen | `edit-tools/post_social.py:709` |
| `instagram --caption-file <datei>` | Pflicht | Beschreibung (UTF-8) | `edit-tools/post_social.py:712` |
| `instagram --thumb-ms N` | keiner | Titelbild aus dem Video bei N Millisekunden | `edit-tools/post_social.py:713` |
| `instagram --nicht-im-feed` | aus | Reel nur im Reels-Tab | `edit-tools/post_social.py:714` |
| `instagram --publish` | aus (dann nur prüfen) | wirklich veröffentlichen | `edit-tools/post_social.py:715` |
| `status --tiktok-post <id>` oder `--instagram-media <id>` | eines von beiden Pflicht | Stand eines Beitrags nachlesen | `edit-tools/post_social.py:718-719` |

**Sonstige Skripte:** `sync_remotion.py <projekt> [md5]` (`sfx-kit/tools/sync_remotion.py:31-34`; mit md5 bricht es ab, wenn `src/lib/sfx.tsx` sich geändert hat),
`patch_lines.py <datei> <md5> <swaps.json>` (`edit-tools/patch_lines.py:5-7`). `prepare_sfx.py` und `hoerseite.py` nehmen keine Argumente an
(`sfx-kit/tools/prepare_sfx.py:196`, `hoerseite.py:242`).

### 3.3 Konfigurationsdateien und Props

**`beispiel/skript.json`** (Beispiel: `beispiel/skript.json`; geprüft von `tonstudio/vo/skript.py:49-86`)

| Feld | Standard | Wofür |
|---|---|---|
| `sprache` | `en` (`tonstudio/vo/skript.py:67`) | Whisper-Kürzel der Aufnahme: `en`, `de`, … |
| `datei` | `vo.wav` (`tonstudio/vo/skript.py:68`) | Name des fertigen Voiceovers unter `public/` |
| `ausklangMs` | `640` (`tonstudio/vo/skript.py:69`) | Zeit nach dem letzten Wort bis zum Ende des Videos |
| `zeilen[].hinweis` | keiner | steht auf dem Teleprompter und als Kommentar in `timing.ts` |
| `zeilen[].phrasen[].key` | Pflicht | Name in `timing.ts`; Buchstaben, Ziffern, `_`, `$`, nicht mit Ziffer beginnend, je Datei einmalig (`tonstudio/vo/skript.py:27`) |
| `zeilen[].phrasen[].text` | Pflicht | gesprochene Wörter in Sprechreihenfolge |
| `zeilen[].phrasen[].anzeige` | `text` | nur für den Bildschirm: `*betont*`, `\|` Atemzug, `\|\|` Pause, `^` hoch, `~` fällt |

**`beispiel/src/timing.ts`** wird von `npm run vo` erzeugt (`tonstudio/vo/retime.py:44`): `VO.file` (Audiodatei unter `public/`, leer = kein Voiceover),
`VO.endMs` (Länge des Videos in ms) und `VO.w.<key>` (Beginn jeder Phrase in ms). Von Hand geändert hält sie nur bis zum nächsten `vo`-Lauf; eine von Hand
geschriebene Fassung wird einmal nach `recordings/timing-handgeschrieben.ts` gesichert (`tonstudio/vo/retime.py:56-60`).

**Props der Composition `Demo`** (Schema `beispiel/src/Demo.tsx:28-42`, Standardwerte `beispiel/src/Demo.tsx:46-57`; im Remotion Studio rechts im Props-Feld oder mit `--props='{…}'` beim Rendern)

| Prop | Standard | Wofür |
|---|---|---|
| `voiceover` | `""` | Audiodatei unter `public/`; leer = `VO.file` aus `timing.ts` |
| `voVolume` | `1` (0 bis 1) | Lautstärke der Stimme; `0` für die Nur-Effekte-Spur |
| `music` | `""` | Musikdatei unter `public/`; leer = keine Musik |
| `musicVolume` | `0.15` (0 bis 1) | Lautstärke der Musik |
| `sfxVolume` | `1.3` (0 bis 2) | Lautstärke aller Effekte zusammen |
| `counterTo` | `1000000` | Wert, den die Zahl beim Schnitt auf Szene 3 erreicht |
| `slots[]` | zwei Einträge | je Inset ein Eintrag mit `label` (Beschriftung), `clip` (Datei unter `public/`, leer = Platzhalter) und `startSec` (Startstelle im Clip) |

**Konstanten im Code**, die man ändert, um das Video anzupassen:

| Konstante | Fundstelle | Wert | Wofür |
|---|---|---|---|
| Composition `Demo` | `beispiel/src/Root.tsx:6-13` | 30 Bilder/s, 1080 × 1920, Länge aus `VO.endMs` | Format und Länge |
| `TEXT_LEAD_MS` | `beispiel/src/Demo.tsx:125` | `100` | wie viele ms vor dem gesprochenen Wort ein Text voll sichtbar ist |
| `INSET_WIDTH` | `beispiel/src/Demo.tsx:86` | `86` | Breite des Clip-Rahmens in Prozent |
| `SFX_CUES` | `beispiel/src/Demo.tsx:251` | Liste | jede Cue: Frame (aus Wortzeit), Sound, Lautstärke, Name |
| `SOUNDS` | `beispiel/src/lib/sfx.tsx:10` | Katalog | wird von `sync_remotion.py` geschrieben |

**`edit-tools/post.config.json`** (Vorlage `edit-tools/post.config.example.json`; gelesen in `edit-tools/post_social.py:277`; leere Werte zählen als nicht gesetzt). **Persönlich.**

| Schlüssel | Pflicht für | Wofür | Fundstelle |
|---|---|---|---|
| `tiktok_account_id` | `tiktok` | Konto-ID aus der Zernio-Liste (`accounts` nennt sie) | `edit-tools/post_social.py:49`, `:553` |
| `instagram_user_id` | `instagram` | ID des Instagram-Kontos | `edit-tools/post_social.py:49`, `:607` |
| `composio_account_zernio` | nur bei mehreren Zernio-Verbindungen | Verbindung, die das Konto sieht | `edit-tools/post_social.py:49`, `:408` |
| `composio_account_instagram` | nur bei mehreren Instagram-Verbindungen | dasselbe für Instagram | `edit-tools/post_social.py:49`, `:608` |

**Remotion-Einstellungen:** `beispiel/remotion.config.ts:10-12` (Rspack an, Zwischenbilder als JPEG, bestehende Dateien überschreiben);
`rundgang/remotion.config.ts:3-6` (zusätzlich JPEG-Qualität 92). Die Skripte stehen in `beispiel/package.json:25-30` (`dev`, `build`, `render`, `lint`, `tonstudio`, `vo`)
und `rundgang/package.json` (`dev`, `vorbereiten`, `typen`, `render`, `standbild`). Stil und Typen: `beispiel/.prettierrc`, `beispiel/tsconfig.json`, `beispiel/eslint.config.mjs`.

**Feste Werte in den Werkzeugen** (keine Schalter; wer sie ändern will, ändert den Code):

| Wo | Wert | Wofür |
|---|---|---|
| `tonstudio/vo/master.py:36-43` | EQ-Ketten `neutral` und `tief`, Kompressor −18 dB bei 3,5:1, Begrenzer −1,8 dBFS, Spitze höchstens −1,5 dBTP, Toleranz 0,15 LU | Aufbereitung des Voiceovers (Ziel −14 LUFS im Video) |
| `tonstudio/vo/align.py:32-34` | Pause ab 120 ms, Sprache ab 16 dB über der Schwelle, Liste der Modellnamen mit DTW-Zeiten | Wort-Ausrichtung |
| `tonstudio/recorder/server.mjs:32` | 600 MB je Aufnahme | Obergrenze beim Speichern |
| `hoerseite.py:23-44` | Ordner `sfx-kit/sounds` und `sfx-kandidaten`, Kategorien nach Dateiname-Präfix | Hörseite |
| `sfx-kit/tools/prepare_sfx.py:33-37`, `:92` | 48 kHz, Spitze −1 dBFS, Zuordnung Rohdatei → Sound (`SRC`), Gruppen (`GROUPS`) | Aufbereitung der Sounds |
| `edit-tools/post_render.sh:23`, `:37` | CRF 14, Preset `slow`, AAC 320 kbit/s, höchstens −14 LUFS und −1,2 dBTP | Export. Auch der Suchpfad `/opt/homebrew/bin:/usr/local/bin` auf `EDIT_HOST` steht fest (Zeile 20) |
| `edit-tools/post_social.py:42-48` | Upload 45 Minuten wiederverwenden, höchstens 5 Hashtags (Warnung), Instagram-Abfrage alle 5 s bis höchstens 300 s | Posten |

### 3.4 Persönliches, wird nie eingecheckt

Diese Dateien stehen in `.gitignore`. Sie enthalten Konten, Aufnahmen oder Urteile eines Menschen und gehören in keinen Commit, Bericht oder
Chat (siehe auch [`AGENTS.md`](../AGENTS.md)).

| Datei | Inhalt | Fundstelle in `.gitignore` |
|---|---|---|
| `edit-tools/post.config.json` | Konto-IDs zum Posten | `.gitignore:10`, `edit-tools/.gitignore:2` |
| `edit-tools/post-log.jsonl` | Protokoll echter Aktionen (Zeit, Plattform, IDs, Link) | `.gitignore:11`, `edit-tools/.gitignore:3` |
| `<video>.upload.json` | gemerkte temporäre Upload-Adresse | `.gitignore:12`, `edit-tools/.gitignore:4` |
| `auswahl.json`, `auswahl.json.tmp` | Urteile von der Hörseite | `.gitignore:7-8` |
| `recordings/` | aufgenommene Takes | `.gitignore:14`, `beispiel/.gitignore:5` |
| `beispiel/public/vo.wav` | erzeugtes Voiceover | `.gitignore:15`, `beispiel/.gitignore:6` |
| `*.bak` | Sicherungskopien vor Änderungen | `.gitignore:17` |
| `tonstudio/mikro/setinput` | gebautes Programm | `tonstudio/.gitignore:4` |
| `node_modules/`, `out/` | erzeugt, jederzeit neu herstellbar | `.gitignore:1-2` |
| `rundgang/public/`, `rundgang/work/`, `rundgang/aufnahmen/roh/` | Rohaufnahmen und alles daraus | `rundgang/.gitignore`, `rundgang/aufnahmen/.gitignore` |

Nicht in Git, aber ebenfalls persönlich: die Wahl des Mikrofons merkt sich die Aufnahme-Seite im Browser (`localStorage`, `tonstudio/recorder/recorder.html:135-136`);
die Anmeldung der Composio-CLI liegt bei der CLI, nicht im Repo.

## 4. Selbsttest

Mit diesen Befehlen belegt der Agent, dass die Einrichtung steht. Sie laufen ohne Mikrofon, Konto und Anmeldung.

```bash
node --version && python3 --version && ffmpeg -version | head -1
```

Erwartet: Node 20 oder neuer, Python 3.9 oder neuer, eine ffmpeg-Version.

```bash
cd beispiel && npm run lint
```

Erwartet: Exit-Code 0, keine Fehlermeldung.

```bash
cd beispiel && npx remotion compositions src/index.ts
```

Erwartet: eine Zeile mit `Demo`, `30`, `1080x1920` und `270 (9.00 sec)`.

```bash
cd beispiel && npx remotion still Demo out/bild.png --frame=60
```

Erwartet: `out/bild.png` mit 1080 × 1920 Pixeln; das Bild ansehen.

```bash
python3 -m unittest discover -s edit-tools/tests
```

Erwartet: `OK` in der letzten Zeile.

```bash
python3 tonstudio/vo/vo.py --help
```

Erwartet: Exit-Code 0 und die Liste der Schalter aus Abschnitt 3.2.

```bash
python3 edit-tools/post_social.py --help
```

Erwartet: Exit-Code 0; das Skript lädt dabei nichts hoch und legt nichts an.

```bash
git status --short
```

Erwartet: keine Dateien außer denen, die der Mensch gewollt hat. `post.config.json`, `recordings/`, `auswahl.json` und `out/` tauchen nie
in der Liste auf, weil `.gitignore` sie ausschließt.

Sind diese Prüfungen grün, nenne dem Menschen im Bericht, was noch fehlt: Mikrofon und Aufnahme (Schritt 8), Whisper-Modell (Schritt 7),
Konten zum Posten (Schritt 11), `EDIT_HOST` für den Export (Schritt 12). Was du nicht prüfen konntest, schreibe ausdrücklich in den Bericht.
