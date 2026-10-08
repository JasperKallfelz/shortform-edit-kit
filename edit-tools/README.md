# Abläufe und Werkzeuge

Vier Abläufe, die sich beim Bau kurzer Hochkant-Videos mit Remotion und einem KI-Agenten bewährt haben: Clips ins Projekt
bringen, Sounds unterlegen, die Datei für den Post fertig machen, und worauf man bei Skript und Schnitt achtet.

Annahme: ein Rechner, auf dem das Remotion-Projekt und das Studio laufen („Schnitt-Mac“), und optional ein zweiter, auf dem
der Agent arbeitet. Wo beides derselbe Rechner ist, entfallen `ssh` und `rsync`.

## Was schon automatisiert ist

| Aufgabe | Befehl |
|---|---|
| Welche WhatsApp-Chats haben neue Videos? | `whatsapp_clips.py chats --days 7` |
| Videos eines Chats in einen Ordner und in die Fotomediathek | `whatsapp_clips.py export "<Name>" --date JJJJ-MM-TT --fotos` |
| Kontaktbogen eines Ordners (Clip zu einem Standbild finden) | `kontaktbogen.py <ordner>` |
| Wortzeiten eines Clips | `whisper-cli -m ggml-medium.en.bin -f clip.wav -ml 1 -sow -oj` ([whisper.cpp](https://github.com/ggerganov/whisper.cpp)) |
| Datei sicher ändern, wenn mehrere Agenten am selben Projekt schreiben | `patch_lines.py <datei> <md5> <swaps.json>` |
| Sounds zum Aussortieren zeigen | `../hoerseite.py` → http://localhost:3700, Urteile in `../auswahl.json` |
| Behaltene Sounds aufbereiten | `../sfx-kit/tools/prepare_sfx.py` |
| Kit ins Remotion-Projekt bringen (WAVs + Katalog) | `../sfx-kit/tools/sync_remotion.py <projekt> [md5]` |
| Fertiger Export für TikTok/Reels | `EDIT_HOST=<ssh-name> post_render.sh <projekt> <Komposition> <Name> [Frames]` |

## Ablauf 1: Clips reindroppen

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
   - `Squiggle` – handgezeichneter Kringel-Pfeil als SVG, der sich zeichnet (`pathLength` 1, `strokeDashoffset` läuft von 1 auf 0).
   - Wort-DSL (`Words`) – jedes Wort mit Schrift, Größe, Position in Prozent und Einsatz aus der Wortzeit.
5. **Ansehen, bevor „fertig“.** `npx remotion still <Komposition> bild.png --frame=N` und das Bild wirklich anschauen. Wo Text
   sitzt, über die Farbe ausmessen (farbige Pixel → Rahmen), nicht schätzen.
6. **Qualität nennen.** WhatsApp verkleinert Videos (meist 1024 × 576). Für den fertigen Export das Original beim Absender anfragen.

## Ablauf 2: Sound-Design

Hausregel: jede Bewegung bekommt einen kleinen Sound, aber so leise und passend, dass er nicht eingefügt klingt.
**Nur echte, aufgenommene Geräusche**, nichts Synthetisches. Auslöser, Mausklick, Klapptafel, Papier, Bleistift, Tasten;
Whoosh nur ganz minimal. Effekte nie lauter als die Musik.

1. Neue Sounds nur aus echten Aufnahmen sammeln, mit Quelle und Lizenz in `../sfx-kandidaten/manifest.tsv`. Das Präfix im
   Dateinamen (`flap_`, `flutter_`, `riser_`, `click_`, …) bestimmt die Kategorie auf der Hörseite.
2. Auf der Hörseite sortieren (✓ / ✕, Tasten B / X). Die Urteile stehen in `auswahl.json`.
3. Ein Agent wartet nicht auf das Sortieren von hunderten Dateien: nach Beschreibung auswählen, einsetzen, die Cue benennen,
   dann nach Gehör korrigieren lassen.
4. `prepare_sfx.py` (Stille weg, Spitze −1 dBFS, `lead`, `loud`) → `sync_remotion.py` → Cues in die Cue-Liste, jede an einer
   Wortzeit oder Animations-Konstante, mit Namen für die Studio-Zeitleiste.
5. Pegel über die wirksame Lautheit setzen: `loud + 20·log10(vol)`. Richtwerte (jeweils mal `sfxVolume` 1.3, Musik auf 0.15):
   Tasten auf Textzeilen −45 dB, Bleistift/Karte/Glas −40 bis −42 dB, Auslöser als Übergang −38 bis −40 dB, Riser −34 dB,
   Schlag auf dem Höhepunkt −29 dB, Auslöser auf Fotos −28 bis −32 dB. Die lauteste Stelle der Effekte bleibt auf Musik-Pegel.
6. Nur-Effekte-Render (`--props '{"voiceover":"","music":""}'`), je Abschnitt den Pegel mit dem Stand davor vergleichen und
   Lücken über 0,5 s ohne Effekt auflisten. Das sind die Stellen, an denen noch etwas unterlegt werden kann.

Was wofür funktioniert: Tastenanschlag je Textzeile, Bleistift auf Schreibschrift-Wörtern und gezeichneten Linien, Auslöser
wenn ein Foto oder Clip erscheint, Filmtransport nach einem Foto, Auslöser-Serie auf einer Fotowand, Klapptafel-Klappe für
Kacheln und laufende Zahlen, Seite blättert auf einen Schnitt, rückwärts gespieltes Becken in ein Musik-Loch vor dem
Höhepunkt, echte Trommel auf dem Höhepunkt.

## Ablauf 3: Fertig machen für den Post

1. `post_render.sh` liefert zwei Dateien (mit und ohne Musik) und Cover-Bilder.
2. Ziel: 1080 × 1920, 30 fps, H.264 High, bt709, AAC 320 kbit/s, höchstens −14 LUFS und −1 dBTP.
3. Musikrechte klären, bevor etwas öffentlich wird (siehe `../docs/recherche-2026-10.md`).
4. Beschreibung und Hashtags vorschlagen, ein Mensch gibt frei. Erst dann als Entwurf hochladen, erst nach zweiter Freigabe
   veröffentlichen.

## Varianten

Ein Video ist eine Vorlage, kein Einzelstück. Wer drei bis vier Varianten testen will (zum Beispiel als Test-Reels), spricht
mehrere ähnliche Skripte ein. Jede Variante braucht ihren eigenen Voiceover-Take mit eigenen Wortzeiten; Bild, Sounds und
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

- Ein Schreiber pro Datei. Vor jedem Schreiben die Prüfsumme vergleichen (`patch_lines.py`), vorher eine Sicherung anlegen
  (Endung `.bak`, sonst prüft TypeScript die Kopie mit).
- Zwischenstände in einem Satz melden. Am Ende: was gemacht wurde, was geprüft wurde, was offen ist.
- Nichts posten und nichts Öffentliches ändern ohne ausdrückliche Freigabe.
