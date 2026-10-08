# Abläufe und Werkzeuge

Fünf Abläufe, die sich beim Bau kurzer Hochkant-Videos mit Remotion und einem KI-Agenten bewährt haben: das Voiceover aufnehmen und
vermessen, Clips ins Projekt bringen, Sounds unterlegen, die Datei für den Post fertig machen und posten. Dazu: worauf man bei
Skript und Schnitt achtet.

Den Einstieg für einen Agenten (Ordnerkarte, Checkliste, Hausregeln) gibt [`../AGENTS.md`](../AGENTS.md). Das Voiceover-Werkzeug
beschreibt [`../tonstudio/README.md`](../tonstudio/README.md), das Posten [`POSTEN.md`](POSTEN.md).

Annahme: ein Rechner, auf dem das Remotion-Projekt und das Studio laufen („Schnitt-Mac“), und optional ein zweiter, auf dem
der Agent arbeitet. Wo beides derselbe Rechner ist, entfallen `ssh` und `rsync`.

## Was schon automatisiert ist

Die Skripte stehen ohne Pfad, sie liegen in `edit-tools/` (Hörseite und Sound-Kit mit `../`). `npm run …` läuft im Projektordner
(im Repo `beispiel/`).

| Aufgabe | Befehl |
|---|---|
| Voiceover aufnehmen (Aufnahme-Seite mit Teleprompter unter http://localhost:3600) | `npm run tonstudio` |
| Take aufbereiten, Wortzeiten messen, `src/timing.ts` neu schreiben | `npm run vo -- recordings/<take>.wav` |
| Welche WhatsApp-Chats haben neue Videos? | `whatsapp_clips.py chats --days 7` |
| Videos eines Chats in einen Ordner und in die Fotomediathek | `whatsapp_clips.py export "<Name>" --date JJJJ-MM-TT --fotos` |
| Kontaktbogen eines Ordners (Clip zu einem Standbild finden) | `kontaktbogen.py <ordner>` |
| Wortzeiten eines Clips | `whisper-cli -m ggml-medium.en.bin -f clip.wav -ml 1 -sow -oj` ([whisper.cpp](https://github.com/ggerganov/whisper.cpp)) |
| Datei sicher ändern, wenn mehrere Agenten am selben Projekt schreiben | `patch_lines.py <datei> <md5> <swaps.json>` |
| Sounds zum Aussortieren zeigen | `../hoerseite.py` → http://localhost:3700, Urteile in `../auswahl.json` |
| Behaltene Sounds aufbereiten | `../sfx-kit/tools/prepare_sfx.py` |
| Kit ins Remotion-Projekt bringen (WAVs + Katalog) | `../sfx-kit/tools/sync_remotion.py <projekt> [md5]` |
| Nur-Effekte-Spur und Mix nachmessen (Pegel je Abschnitt, Lücken, Effekte gegen Musik, Lautheit) | `ton_check.py <sfx.wav> [--musik <song> --musik-start <s> --musik-vol 0.15] [--mix <mix.wav>]` |
| Musik-Einstieg finden, bei dem ein Schlag auf ein Wort fällt | `beat_align.py <song.wav> <src/timing.ts> <wort> [--auch wort,wort]` |
| Fertiger Export für TikTok/Reels | `EDIT_HOST=<ssh-name> post_render.sh <projekt> <Komposition> <Name> [Frames]` |
| Verbundene Konten lesen (nur lesend) | `post_social.py accounts` |
| Beitrag als Entwurf anlegen (TikTok) bzw. prüfen (Instagram); mit `--publish` veröffentlichen | `post_social.py tiktok <video> --caption-file <datei> [--publish]`, `post_social.py instagram <video> --caption-file <datei> [--publish]` |
| Stand eines Beitrags nachlesen | `post_social.py status --tiktok-post <ID>` bzw. `--instagram-media <ID>` |
| Tests des Post-Skripts (ohne Netz; vom Wurzelordner des Repos aus) | `python3 -m unittest discover -s edit-tools/tests` |

Vorsicht beim Ausprobieren: `prepare_sfx.py`, `sync_remotion.py`, `hoerseite.py`, `patch_lines.py` und `post_render.sh` kennen kein
`--help`. Sie führen sofort aus (`prepare_sfx.py` schreibt alle Sounds neu, `hoerseite.py` startet den Server) oder lesen das erste
Argument als Pfad. Hilfe gibt es bei `whatsapp_clips.py`, `kontaktbogen.py`, `post_social.py`, `vo.py`, `ton_check.py` und `beat_align.py`.

Warum die Regeln zu Lautstärke, Text-Vorlauf und Musik so sind und wie man sie nachmisst: [`../docs/ton-und-text-sync.md`](../docs/ton-und-text-sync.md).

## Ablauf 1: Skript und Voiceover

Bild, Text und Sounds hängen an den Wortzeiten, darum kommt das Voiceover zuerst. Das Werkzeug dafür ist das Tonstudio
([`../tonstudio/README.md`](../tonstudio/README.md), dort auch die Voraussetzungen: whisper.cpp, Modelle, `numpy`). Es läuft ganz
lokal, ohne Konto.

1. **Skript festhalten.** `skript.json` im Projektordner enthält die gesprochenen Phrasen und je Phrase einen Schlüssel (`key`), unter
   dem ihr Beginn in `src/timing.ts` landet. Der Code des Videos liest nur diese Schlüssel (`VO.w.<key>`). Steht ein Platzhalter im
   Text (etwa ein Name), spricht man dort gleich viele Wörter. Beispiel: [`../beispiel/skript.json`](../beispiel/skript.json).
2. **Aufnehmen.** `npm run tonstudio`, dann http://localhost:3600. Erst „Pegel testen“ (Spitzen im grünen Bereich), dann aufnehmen.
   Jeder Take liegt sofort unverändert in `recordings/` und wird nie überschrieben.
3. **Take wählen und vermessen.** `npm run vo -- recordings/<take>.wav` bereitet die Aufnahme auf (−14 LUFS) und schreibt sie als
   `public/<datei aus skript.json>`, misst die Wortzeiten und schreibt `src/timing.ts`. Überschrieben wird erst, wenn die Ausrichtung
   gelungen ist; stimmt die Wortzahl nicht, bricht `vo` ab. In der Tabelle am Ende die Zeilen „uneinig“ und „GESCHÄTZT“ ansehen,
   einzelne Zeiten mit `--setze <key>=<ms>` korrigieren. Den Anfang aus einem und den Rest aus einem anderen Take nehmen:
   `npm run vo -- recordings/take-a.wav:0:3800 recordings/take-b.wav:1740:-1`.
4. **Ansehen.** Studio neu laden: Das Voiceover spielt, die Länge folgt der Aufnahme, Text und Sounds sitzen an den neuen Zeiten.
   Einzelbild auf einem betonten Wort rendern und ansehen (Frame = Millisekunden × 0,03).

`vo` überschreibt `src/timing.ts` und die Audiodatei. Wer mehrere Varianten behalten will (siehe „Varianten“), sichert jede fertige
Fassung vorher, etwa in einem eigenen Zweig oder Projektordner.

## Ablauf 2: Clips reindroppen

Material kommt meist als Standbild im Chat („nimm den“), als Hinweis („X hat mir Videos geschickt“) oder als Datei.
Ein Standbild heißt „dieses Video“ – die Datei zu finden ist Aufgabe des Agenten.

1. **Holen.** Aus WhatsApp mit `whatsapp_clips.py export … --fotos` (kopiert nach `~/Movies/WhatsApp-<Name>-<Datum>/` und legt ein
   Album in der Fotomediathek an). Die Datenbank von WhatsApp Desktop wird nur gelesen.
2. **Finden.** `kontaktbogen.py` über den Ordner, Bogen ansehen, Nummer mit dem Standbild vergleichen.
3. **Stelle wählen.** Die Einstellung aus dem Standbild, oder den Ton mit whisper mitschreiben und eine Textstelle suchen, die
   zum Voiceover passt. Ein paar Einzelbilder ziehen und ansehen, wo die Person im Bild steht.
4. **Einbauen.** Datei nach `public/` des Projekts und einen Slot in den Props anlegen (Label, Datei, Startsekunde). So lässt
   sich der Ausschnitt im Studio verschieben, ohne Code anzufassen. Bausteine aus `beispiel/src/Demo.tsx`:
   - `Inset` – abgerundeter 16:9-Clip auf weißer Karte; mit `zoom` wächst er langsam auf die Person zu.
   - `AmbientInset` (`beispiel/src/lib/ambient.tsx`) – dasselbe mit Ambient-Light-Schein: dahinter liegt der Clip noch einmal, weichgezeichnet und aufgehellt, und scheint auf das Weiß. Nur auf hellem Grund, Parameter und Erfahrungen in `beispiel/README.md`.
   - `SafeZoneGuide` und `SAFE` (`beispiel/src/lib/safezone.tsx`) – Freihalte-Bereiche von Instagram und TikTok (oben 250 px, unten 480 px, rechts 160 px ab y = 860, links 60 px) und ein Prüf-Overlay dafür, per Prop `safeZone`. Werte, Quellen und Erfahrungen in `beispiel/README.md`.
   - `Squiggle` – handgezeichneter Kringel-Pfeil als SVG, der sich zeichnet (`pathLength` 1, `strokeDashoffset` läuft von 1 auf 0).
   - Wort-DSL (`Words`) – jedes Wort mit Schrift, Größe, Position in Prozent und Einsatz aus der Wortzeit.
5. **Ansehen, bevor „fertig“.** `npx remotion still <Komposition> bild.png --frame=N` und das Bild wirklich anschauen. Wo Text
   sitzt, über die Farbe ausmessen (farbige Pixel → Rahmen), nicht schätzen. Jede Szene auch mit dem Overlay ansehen
   (`--props='{"safeZone":true}'`): Text, Gesichter und Zeiger bleiben aus den Freihalte-Bereichen.
6. **Qualität nennen.** WhatsApp verkleinert Videos (meist 1024 × 576). Für den fertigen Export das Original beim Absender anfragen.

## Ablauf 3: Sound-Design

Hausregel: jede Bewegung bekommt einen kleinen Sound, aber so leise und passend, dass er nicht eingefügt klingt.
**Nur echte, aufgenommene Geräusche**, nichts Synthetisches. Auslöser, Mausklick, Klapptafel, Papier, Bleistift, Tasten;
Whoosh nur ganz minimal. Effekte nie lauter als die Musik. Das Sound-Kit mit Katalog und Pegel-Regeln: [`../sfx-kit/README.md`](../sfx-kit/README.md).

1. Neue Sounds nur aus echten Aufnahmen sammeln, mit Quelle und Lizenz in `../sfx-kandidaten/manifest.tsv`. Das Präfix im
   Dateinamen (`flap_`, `flutter_`, `riser_`, `click_`, …) bestimmt die Kategorie auf der Hörseite.
2. Auf der Hörseite sortieren (✓ / ✕, Tasten B / X). Die Urteile stehen in `auswahl.json`.
3. Ein Agent wartet nicht auf das Sortieren von hunderten Dateien: nach Beschreibung auswählen, einsetzen, die Cue benennen,
   dann nach Gehör korrigieren lassen.
4. `prepare_sfx.py` (Stille weg, Spitze −1 dBFS, `lead`, `loud`) → `sync_remotion.py` → Cues in die Cue-Liste (`SFX_CUES`), jede an einer
   Wortzeit oder Animations-Konstante, mit Namen für die Studio-Zeitleiste. Weil die Wortzeiten aus dem Voiceover kommen (Ablauf 1),
   wandern die Sounds bei einem neuen Take mit.
5. Pegel über die wirksame Lautheit setzen: `loud + 20·log10(vol)`. Richtwerte (jeweils mal `sfxVolume` 1.3, Musik auf 0.15):
   Tasten auf Textzeilen −45 dB, Bleistift/Karte/Glas −40 bis −42 dB, Auslöser als Übergang −38 bis −40 dB, Riser −34 dB,
   Schlag auf dem Höhepunkt −29 dB, Auslöser auf Fotos −28 bis −32 dB. Die lauteste Stelle der Effekte bleibt auf Musik-Pegel.
6. Nur-Effekte-Render, je Abschnitt den Pegel mit dem Stand davor vergleichen und Lücken über 0,5 s ohne Effekt auflisten. Das sind
   die Stellen, an denen noch etwas unterlegt werden kann. Im Projektordner:

   ```bash
   npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
   ```

   Wichtig ist `voVolume: 0`: Ist ein Voiceover vorhanden (`VO.file` in `src/timing.ts`), fällt die Komposition bei leerem `voiceover`
   auf diese Datei zurück, und die Stimme bliebe in der Spur. Die Prop-Namen sind die der Demo; in einem anderen Projekt die dortigen nehmen.

Was wofür funktioniert: Tastenanschlag je Textzeile, Bleistift auf Schreibschrift-Wörtern und gezeichneten Linien, Auslöser
wenn ein Foto oder Clip erscheint, Filmtransport nach einem Foto, Auslöser-Serie auf einer Fotowand, Klapptafel-Klappe für
Kacheln und laufende Zahlen, Seite blättert auf einen Schnitt, rückwärts gespieltes Becken in ein Musik-Loch vor dem
Höhepunkt, echte Trommel auf dem Höhepunkt. Einschränkung nach späteren Hörrunden: Auslöser als Übergang auf Schnitten und schnelle
Klappen-Folgen sind durchgefallen, siehe [`../docs/kurzvideo-erfahrungen-2026-10.md`](../docs/kurzvideo-erfahrungen-2026-10.md#5-geräusche-was-nach-gehör-durchfiel-und-was-blieb).

## Ablauf 4: Fertig machen für den Post

1. `post_render.sh` liefert zwei Dateien (mit und ohne Musik) und Cover-Bilder:

   ```bash
   EDIT_HOST=<ssh-name> post_render.sh <projektordner> <Komposition> <Name> 60,150,240
   ```

   `<projektordner>` liegt im Home-Ordner von `EDIT_HOST`, die Zahlen sind die Frames der Cover-Bilder. Das Skript prüft zuerst die
   Typen (`tsc`), rendert Bild und beide Tonspuren, senkt jede Fassung auf höchstens −14 LUFS und −1,2 dBTP ab (lauter macht es
   nicht) und druckt je Fassung die gemessene Lautheit vor und nach dem Absenken.
2. Ergebnis in `<projekt>/out/post-<Datum>/`: `<Name>_1080x1920_mit-Musik.mp4`, `<Name>_1080x1920_ohne-Musik.mp4`,
   `cover-bild-<frame>.png`, dazu das Rohbild und beide Tonspuren als WAV.
3. Ziel: 1080 × 1920, 30 fps, H.264 High, bt709, AAC 320 kbit/s. Die Cover-Bilder ansehen, die gedruckten Lautheitswerte lesen.
4. „Mit Musik“ ist die Fassung mit den Standardwerten der Komposition (in der Demo `demoDefaults` in `src/Demo.tsx`, dort ist `music`
   leer). Steht die Musik nur im Props-Feld des Studios und nicht in den Standardwerten, sind beide Dateien gleich: dann die Musik
   in den Standardwerten eintragen, bevor man `post_render.sh` startet.
5. Musikrechte klären, bevor etwas öffentlich wird (siehe `../docs/recherche-2026-10.md`): im Zweifel die Fassung „ohne Musik“ nehmen
   und den Song in der App aus der Bibliothek der Plattform dazulegen.

## Ablauf 5: Posten

Das Skript `post_social.py` lädt die fertige MP4 hoch und legt sie über die Composio-CLI als Entwurf oder Beitrag an. Voraussetzungen,
Konfiguration, alle Befehle und die Fallen stehen in [`POSTEN.md`](POSTEN.md). Die sichere Reihenfolge:

1. **Beschreibung schreiben (lassen) und von einem Menschen freigeben lassen.** Erst danach in die Datei. Hashtags: höchstens 5 bei
   Instagram, 3 bis 4 passende bei TikTok (`../docs/recherche-2026-10.md`).
2. **Trockenlauf.** Nichts wird hochgeladen oder angelegt:

   ```bash
   python3 post_social.py tiktok <video> --caption-file <datei> --dry-run
   ```

   Bei Instagram zeigt schon der Aufruf ohne `--publish` nur die Aufrufe. Ein TikTok-Entwurf (ohne `--publish`) ist dagegen eine echte
   Aktion im Konto: nur nach der Freigabe der Beschreibung anlegen.
3. **Zweite Freigabe, dann veröffentlichen:**

   ```bash
   python3 post_social.py tiktok <video> --caption-file <datei> --publish
   ```

4. **Nachlesen.** Das Skript liest den Beitrag zurück (TikTok: Status und Post-ID, Instagram: Link und die Beschreibung Byte für Byte).
   Bei Zeitüberschreitung oder unklarem Ausgang nicht blind wiederholen, sondern erst im Konto oder mit `status` nachsehen.

Was über diesen Weg nicht geht (TikTok-Titelbild, Instagram-Beitrag ändern oder löschen, Plattform-Musik wählen), steht ebenfalls in `POSTEN.md`.

## Varianten

Ein Video ist eine Vorlage, kein Einzelstück. Wer drei bis vier Varianten testen will (zum Beispiel als Test-Reels), spricht
mehrere ähnliche Skripte ein (Ablauf 1). Jede Variante braucht ihren eigenen Voiceover-Take mit eigenen Wortzeiten; Bild, Sounds und
Schnitte hängen an den Wortzeiten und wandern mit. Was die Plattformen zu fast gleichen Videos und zum erneuten Posten sagen,
steht in `../docs/recherche-2026-10.md`.

## Worauf es bei Skript und Schnitt ankommt

Kurzfassung der Recherche in `../docs/recherche-2026-10.md`:

1. Die ersten 1,5 bis 3 Sekunden entscheiden: mit dem stärksten Bild anfangen, nicht mit einem ruhigen Aufbau.
2. Ein klarer emotionaler Höhepunkt, verbunden mit dem Inhalt. Die Musik kurz davor wegnehmen und auf dem Wort zurückholen.
3. Gesicht groß und früh.
4. Text im Bild, Wort für Wort zum Voiceover.
5. Kein Gesang unter der Stimme.
6. Zügig und engagiert sprechen; Schnitte alle zwei bis drei Sekunden reichen.
7. Sättigung hochdrehen bringt nach Beleglage nichts. Clips in Belichtung, Kontrast und Wärme angleichen.

Ein Skript-Muster für eine Vorstellung in 15 Sekunden und rund 40 Wörtern: Aufbruch → Ort und Schritt → Menschen → was wir
bauen (Höhepunkt auf dem Namen) → Anspruch → Absender und offenes Ende. Jede Zeile bekommt ein eigenes Bild, betonte Wörter
stehen groß oder in Schreibschrift, Bewegungen sind vor dem betonten Wort fertig.

## Zusammenarbeit mehrerer Agenten

- Ein Schreiber pro Datei. Vor jedem Schreiben die Prüfsumme vergleichen (`patch_lines.py`, bei `sync_remotion.py` der optionale
  md5-Parameter), vorher eine Sicherung anlegen (Endung `.bak`, sonst prüft TypeScript die Kopie mit).
- Zwischenstände in einem Satz melden. Am Ende: was gemacht wurde, was geprüft wurde, was offen ist.
- Nichts posten und nichts Öffentliches ändern ohne ausdrückliche Freigabe.
