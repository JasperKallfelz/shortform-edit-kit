# Tonstudio

Lokale Werkzeuge für das Voiceover eines Kurzvideos: im Browser aufnehmen, die Aufnahme aufbereiten, die Wortzeiten messen und
daraus die Zeit-Tabelle `src/timing.ts` des Remotion-Projekts erzeugen. Bild, Text und Sounds hängen an dieser Tabelle und
wandern mit, wenn ein neuer Take kommt. **Alles läuft auf dem eigenen Rechner**: kein Konto, keine Cloud, die Aufnahme-Seite
hört nur auf `127.0.0.1`, die Spracherkennung (whisper.cpp) rechnet lokal.

```
skript.json ──► Aufnahme-Seite ──► recordings/take-….wav ──► npm run vo ──► public/vo.wav
 (Sätze + Schlüssel)  (Teleprompter)                          (aufbereiten,     src/timing.ts
                                                               Wörter messen)   (Bild, Text, Ton folgen)
```

## Voraussetzungen

- Node 20+ (die Aufnahme-Seite braucht keine Pakete), ein aktueller Browser
- Python 3.9+ mit `numpy`, ffmpeg
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`whisper-cli`) und mindestens ein ggml-Modell. Mehrere Modelle machen die
  Zeiten genauer (Median), eines reicht zum Anfangen. Für Englisch z. B. `medium.en` und `medium`; für andere Sprachen ein Modell ohne `.en`.
- Optional macOS: Swift, um das Eingabegerät umzuschalten (`mikro/setinput.swift`)

```bash
brew install whisper-cpp ffmpeg
```

```bash
pip install numpy
```

Modelle laden (im Ordner von whisper.cpp) und die Pfade bekanntmachen, durch Komma getrennt. Alternativ bei jedem Aufruf `--modelle`:

```bash
sh models/download-ggml-model.sh medium.en
```

```bash
export TONSTUDIO_MODELLE=~/whisper/ggml-medium.en.bin,~/whisper/ggml-medium.bin
```

Fehlt `whisper-cli` im `PATH`, den Pfad in `WHISPER_CLI` angeben. Fehlt ein Modell, bricht `vo` mit einer Meldung ab, bevor etwas geändert wird.

## Schritt 0: Skript-Datei im Videoprojekt

`skript.json` sagt, was gesprochen wird und unter welchem Schlüssel jede Phrase in `src/timing.ts` landet (die Schlüssel, die der Code
des Videos benutzt). Der Wert eines Schlüssels ist der Beginn des **ersten Wortes** seiner Phrase.

```json
{
  "sprache": "en",
  "datei": "vo.wav",
  "ausklangMs": 640,
  "zeilen": [
    {
      "hinweis": "Szene 1",
      "phrasen": [
        { "key": "thisIs", "text": "this is" },
        { "key": "yourHook", "text": "your hook,", "anzeige": "your *hook* |" }
      ]
    }
  ]
}
```

| Feld | Bedeutung |
|---|---|
| `sprache` | Sprache der Aufnahme (Whisper-Kürzel: `en`, `de`, …) |
| `datei` | Name des fertigen Voiceovers unter `public/` |
| `ausklangMs` | Zeit nach dem letzten Wort bis zum Ende des Videos (`endMs`) |
| `zeilen[].hinweis` | optional: steht links auf dem Teleprompter und als Kommentar in `timing.ts` |
| `phrasen[].key` | Name in `timing.ts` (Buchstaben, Ziffern, `_`; je Datei einmalig) |
| `phrasen[].text` | die gesprochenen Wörter, in Sprechreihenfolge; Satzzeichen sind erlaubt |
| `phrasen[].anzeige` | optional, nur für den Bildschirm: `*betont*`, `\|` Atemzug, `\|\|` Pause, `^` Stimme hoch, `~` Stimme fällt |

Steht im Skript ein Platzhalter (etwa „Your Name“), spricht man dort seinen eigenen Namen mit **gleicher Wortzahl**.

Ein neues Video braucht nur eine neue `skript.json` und passende Schlüssel im Code. Die zwei Befehle kommen in die `package.json`
des Projekts (Pfad zu `tonstudio/` anpassen):

```json
"tonstudio": "node ../tonstudio/recorder/server.mjs",
"vo": "python3 ../tonstudio/vo/vo.py"
```

## Schritt 1: Aufnehmen

```bash
npm run tonstudio
```

Dann http://localhost:3600 öffnen. Links Pegelanzeige und Aufnahme-Knopf, rechts das Skript zum Ablesen (Schriftgröße mit A−/A+, „Marken“
blendet die Betonungszeichen aus). Zuerst „Pegel testen“: Die Spitzen sollen im grünen Bereich liegen (−12 bis −6 dBFS). Nach dem Start
läuft ein Countdown von 3 Sekunden. **Jeder Take wird sofort in `recordings/` gesichert** (24 Bit, 48 kHz, nie überschrieben), und die
Seite zeigt den Befehl für den nächsten Schritt. Optionen: `--port`, `--ordner`, `--skript`, `--projekt` (`node ../tonstudio/recorder/server.mjs --help`).

## Schritt 2: Take wählen, aufbereiten, Zeiten messen

```bash
npm run vo -- recordings/take-20261008-141530-1.wav
```

Das Werkzeug (`tonstudio/vo/vo.py`) macht vier Dinge und überschreibt `public/` und `src/timing.ts` erst, wenn die Ausrichtung gelungen ist:

1. **Aufbereiten** (`master.py`): Klang, Kompressor, Pegel auf −14 LUFS im Video, Begrenzer. Ergebnis `public/<datei aus skript.json>`
   als Zweikanal-WAV. Wird ein Ziel verfehlt, bricht es ab.
2. **Hören**: Jedes Whisper-Modell hört die Aufnahme frei ab und liefert für jedes Wort eine DTW-Zeit (Dynamic Time Warping: wo das
   Modell das Ende des Stückes hört). Das Ende des vorigen Wortes ist der Beginn des nächsten, über die Modelle gilt der Median.
3. **Zuordnen**: Gehörte Wörter und Skript werden verglichen. Stimmt die Wortzahl nicht, bricht das Werkzeug ab, statt falsche Zeiten zu liefern.
4. **Einrasten**: Aus der Lautstärke werden die Sprechpausen gemessen. Das Wort direkt nach einer Pause beginnt exakt am gemessenen Einsatz,
   das ist die verlässlichste Zeitangabe. Danach schreibt `retime.py` die `timing.ts` (`file`, `endMs` und je Schlüssel ein Wert in ms).

Zuletzt steht eine Tabelle mit Schlüssel, Beginn, Pause (●), Streuung zwischen den Modellen und den Zeiten je Modell da. Zeilen mit
„uneinig“ oder „GESCHÄTZT“ sind die, die man sich ansehen sollte. Ein Bericht liegt als `<take>.ausrichtung.json` neben dem Take.

Weitere Optionen:

| Option | Wirkung |
|---|---|
| `--kette tief` | Klang-Variante: `neutral` (Standard) nimmt nur Trittschall und Mulm weg, `tief` gibt dünnen Stimmen mehr Körper (Details in `master.py`) |
| `--modelle a.bin,b.bin` | Whisper-Modelle statt `TONSTUDIO_MODELLE` |
| `--setze hello=1500` | einen Zeitwert von Hand überschreiben (wiederholbar) |
| `--erlaube-abweichung` | Wörter überspringen, die Whisper anders zählt als das Skript; ihre Zeiten werden geschätzt |
| `--skript`, `--zeiten`, `--public`, `--projekt` | andere Pfade, falls das Projekt anders aufgebaut ist |

Den Anfang aus einem Take und den Rest aus einem anderen nehmen (Schnitte in eine Sprechpause legen, kurze Blenden sind drin; `bis_ms` = -1 heißt bis zum Ende, optional folgt ein Gain in dB):

```bash
npm run vo -- recordings/take-a.wav:0:3800 recordings/take-b.wav:1740:-1:1.5
```

Eine von Hand geschriebene `timing.ts` wird beim ersten Überschreiben nach `recordings/timing-handgeschrieben.ts` gesichert.

## Schritt 3: Ansehen

```bash
npm run dev
```

Im Studio die Komposition neu laden: Das Voiceover spielt (aus `VO.file`), die Länge folgt der Aufnahme, Text und Sounds sitzen an den neuen Zeiten.

```bash
npx remotion render Demo out/video.mp4
```

## Typische Probleme

- **Der Browser fragt nicht nach dem Mikrofon / „Freigabe fehlt“.** Die Seite muss über `http://localhost:3600` laufen. Im Browser auf das Schloss
  in der Adressleiste klicken, das Mikrofon erlauben, Seite neu laden. Unter macOS zusätzlich: Systemeinstellungen → Datenschutz → Mikrofon → Browser.
- **Falsches Gerät, „KEIN SIGNAL“, zu leise.** Oben rechts in der Seite das Mikrofon wählen (die Seite merkt sich die Wahl). Reicht das nicht: macOS
  Systemeinstellungen → Ton → Eingabe prüfen, den Pegel dort und am Audio-Interface (Gain) einstellen. Das Standard-Eingabegerät lässt sich auch umschalten:
  ```bash
  swiftc -O tonstudio/mikro/setinput.swift -o tonstudio/mikro/setinput
  ```
  ```bash
  tonstudio/mikro/setinput "Teil des Gerätenamens"
  ```
  Ohne Argument listet `setinput` alle Eingabegeräte auf.
- **Whisper hört ein Wort falsch.** Bei **gleicher Wortzahl** (Eigennamen, „Your Name“ → echter Name) ist das unkritisch: Die Zuordnung geht Stelle für Stelle,
  die Meldung „Anders gehört“ ist nur ein Hinweis. Weicht die **Wortzahl** ab (Zahlen wie „2026“ statt „twenty twenty-six“, zusammen- oder getrennt gesprochene Wörter,
  verschluckte Wörter), bricht `vo` mit „Skript: … gehört: …“ ab. Dann das Skript an das Gesprochene anpassen oder neu aufnehmen. Geht beides nicht,
  `--erlaube-abweichung` setzen und die geschätzten Zeiten prüfen.
- **Eine einzelne Zeit stimmt nicht.** Take mit `--setze` neu verarbeiten, z. B. `npm run vo -- recordings/take.wav --setze hello=1500`. Die Zahl aus dem
  Studio ablesen (Zeitleiste, Millisekunden = Bild ÷ 30 × 1000). Von Hand in `timing.ts` ändern geht auch, hält aber nur bis zum nächsten `vo`-Lauf.
  Die Werte gelten für genau diesen Take; bei einem neuen Take neu prüfen.
- **Meldung „Modell versteht nur Englisch“.** Modelle mit `.en` im Namen sind englisch. Für `"sprache": "de"` ein Modell ohne `.en` (z. B. `medium`) angeben.
- **Modellname unbekannt.** Die DTW-Zeiten brauchen den Standardnamen (`ggml-medium.en.bin`, `ggml-small.bin`, …). Bei anderen Dateinamen weist das Werkzeug darauf hin
  und nimmt die ungenaueren Wortstempel von Whisper; die Dateien besser nicht umbenennen.

## Dateien

| Pfad | Inhalt |
|---|---|
| `recorder/server.mjs`, `recorder/recorder.html` | Aufnahme-Seite und ihr kleiner lokaler Server (Aufnahme per AudioWorklet, Teleprompter aus `skript.json`) |
| `vo/vo.py` | der Befehl hinter `npm run vo`: Stücke zusammensetzen, aufbereiten, ausrichten, schreiben |
| `vo/master.py` | Aufbereitung, auch einzeln aufrufbar: `master.py roh.wav ziel.wav [neutral\|tief]` |
| `vo/align.py` | Wort-Ausrichtung (Modelle, Zuordnung, Einrasten auf Pausen), auch einzeln aufrufbar |
| `vo/retime.py`, `vo/skript.py` | schreibt `timing.ts`; liest und prüft `skript.json` |
| `mikro/setinput.swift` | Quelltext zum Umschalten des Standard-Eingabegeräts unter macOS (das gebaute Programm wird nicht eingecheckt) |

Aufnahmen (`recordings/`) und das erzeugte Voiceover gehören nicht ins Repository; die `.gitignore` des Beispielprojekts schließt sie aus.
