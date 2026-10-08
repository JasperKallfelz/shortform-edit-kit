---
name: clip-sound-post-flow
description: "Kurze Hochkant-Videos in Remotion von Skript bis Post: Voiceover aufnehmen und Wortzeiten messen (Tonstudio), neue Clips reindroppen (WhatsApp, Fotomediathek, Standbild im Chat), Sound-Design mit echten Geräuschen, fertiger Export für TikTok/Reels und das Posten auf TikTok und Instagram (Entwurf, Freigabe, Veröffentlichen, Nachlesen), dazu die Psychologie für Skript und Schnitt (Einstieg, Höhepunkt, Gesicht, Text). Nutzen, wenn jemand ein Voiceover aufnehmen oder neu einsprechen will, Clips schickt oder nennt („X hat mir Videos geschickt“, „nimm den“), Sounds unterlegen oder aussortieren will, ein Video für den Post vorbereiten oder posten lässt oder ein neues Skript für ein Kurzvideo plant."
version: 1.1.0
platforms: [macos]
metadata:
  hermes:
    tags: [Remotion, Edit, Voiceover, Tonstudio, Clips, WhatsApp, Fotos, Sound-Design, SFX, Export, Posten, TikTok, Reels, Skript, Retention]
    related_skills: [reference-to-social-post-flow]
---

# Skript, Voiceover, Clips, Sound, Post

Einstieg mit Ordnerkarte, Checkliste und Hausregeln: `AGENTS.md` im Wurzelordner dieses Repos. Volle Fassung aller Abläufe mit Befehlen
und Begründungen: `edit-tools/README.md`. Voiceover-Werkzeug: `tonstudio/README.md`. Posten: `edit-tools/POSTEN.md`. Sound-Kit und
Pegel-Regeln: `sfx-kit/README.md`. Beispielprojekt mit allen Bausteinen: `beispiel/`.

Der Mensch tippt keine Befehle. Er sagt in kurzen Sätzen, was er will, oft mehrere Aufträge hintereinander, und will einen
Vorschlag im Studio sehen oder hören, den er dann korrigiert. Große Auswahl-Aufgaben nicht an ihn zurückgeben.

Reihenfolge: 1 Skript und Voiceover, 2 Clips, 3 Sound-Design, 4 Fertig machen, 5 Posten.

## Was schon automatisiert ist

| Aufgabe | Befehl |
|---|---|
| Voiceover aufnehmen (Aufnahme-Seite mit Teleprompter, http://localhost:3600) | `npm run tonstudio` (im Projektordner) |
| Take aufbereiten, Wortzeiten messen, `src/timing.ts` neu schreiben | `npm run vo -- recordings/<take>.wav` (im Projektordner) |
| Chats mit neuen Videos | `whatsapp_clips.py chats --days 7` |
| Videos eines Chats holen + in die Fotomediathek | `whatsapp_clips.py export "<Name>" --date JJJJ-MM-TT --fotos` |
| Clip zu einem Standbild finden | `kontaktbogen.py <ordner>`, Bogen ansehen |
| Wortzeiten eines Clips | `whisper-cli -m ggml-medium.en.bin -f clip.wav -ml 1 -sow -oj` |
| Datei im Projekt sicher ändern | `patch_lines.py <datei> <md5> <swaps.json>` (bricht ab, wenn die Datei sich geändert hat) |
| Sounds zum Aussortieren zeigen | `hoerseite.py` → http://localhost:3700; Urteile in `auswahl.json` |
| Behaltene Sounds aufbereiten und ins Projekt bringen | `sfx-kit/tools/prepare_sfx.py`, dann `sfx-kit/tools/sync_remotion.py <projekt> [md5]` |
| Export für TikTok/Reels (mit und ohne Musik, Lautheit, Cover) | `EDIT_HOST=<ssh-name> post_render.sh <projekt> <Komposition> <Name> [Frames]` |
| Konten lesen (nur lesend) | `post_social.py accounts` |
| Beitrag prüfen, als Entwurf anlegen, veröffentlichen | `post_social.py tiktok <video> --caption-file <datei> [--dry-run] [--publish]`, `post_social.py instagram <video> --caption-file <datei> [--dry-run] [--publish]` |
| Stand eines Beitrags nachlesen | `post_social.py status --tiktok-post <ID>` bzw. `--instagram-media <ID>` |

Kein `--help` bei `prepare_sfx.py`, `sync_remotion.py`, `hoerseite.py`, `patch_lines.py` und `post_render.sh`: sie führen sofort aus
oder lesen das erste Argument als Pfad.

## Skript und Voiceover

Alles hängt an den Wortzeiten, darum zuerst.

1. `skript.json` im Projektordner: gesprochene Phrasen, je Phrase ein Schlüssel, unter dem ihr Beginn in `src/timing.ts` landet.
2. `npm run tonstudio`, aufnehmen (Pegel testen, jeder Take liegt unverändert in `recordings/`).
3. `npm run vo -- recordings/<take>.wav`. Stimmt die Wortzahl nicht, bricht es ab, statt falsche Zeiten zu liefern. Zeilen „uneinig“
   und „GESCHÄTZT“ in der Tabelle ansehen, einzelne Zeiten mit `--setze <key>=<ms>`.
4. Studio neu laden, Einzelbild auf einem betonten Wort rendern und ansehen. Fertig gesagt wird erst danach.

`vo` überschreibt `src/timing.ts` und die Audiodatei: eine fertige Variante vorher sichern. Das Tonstudio läuft lokal, ohne Konto;
Aufnahmen und das erzeugte Voiceover gehören nicht ins Repo.

## Clips reindroppen

1. Holen (WhatsApp-Skript oder Fotomediathek). Ein Standbild im Chat heißt „dieses Video“: Datei selbst suchen, per Kontaktbogen.
2. Stelle wählen: die Einstellung aus dem Standbild, oder per whisper eine Textstelle, die zum Voiceover passt.
3. Datei nach `public/`, Slot in den Props (Label, Datei, Startsekunde), damit sich der Ausschnitt im Studio verschieben lässt.
   Bausteine: `Inset` (Clip auf weißer Karte, optional langsamer Zoom auf die Person), `Squiggle` (handgezeichneter
   Kringel-Pfeil), Wort-DSL `Words`.
4. Einzelbild rendern (`npx remotion still`) und wirklich ansehen, bevor „fertig“ gesagt wird.
5. WhatsApp-Clips sind verkleinert (meist 1024 × 576): im Bericht sagen, Original beim Absender anfragen.

## Sound-Design

- **Nur echte, aufgenommene Geräusche.** Nichts Synthetisches (keine Spiele-/UI-Pakete, keine Ticks, Pops, Blips).
- Jede Bewegung bekommt einen kleinen Sound, leise genug, dass er nicht eingefügt klingt. Auslöser, Mausklick, Klapptafel,
  Papier, Bleistift, Tasten; Whoosh nur ganz minimal. Effekte nie lauter als die Musik.
- Bewährt: Taste je Textzeile, Bleistift auf Schreibschrift und gezeichneten Linien, Auslöser wenn ein Foto oder Clip erscheint,
  Auslöser-Serie auf einer Fotowand, Klapptafel für Kacheln und laufende Zahlen, Seite blättert auf einen Schnitt, rückwärts
  gespieltes Becken ins Musik-Loch vor dem Höhepunkt, echte Trommel auf dem Höhepunkt.
- Jede Cue (`SFX_CUES`) hängt an einer Wortzeit oder Animations-Konstante und hat einen Namen für die Studio-Zeitleiste. Pegel über
  `loud + 20·log10(vol)` setzen (Richtwerte im README). Danach Nur-Effekte-Render und Lücken über 0,5 s auflisten:
  `npx remotion render <Komposition> sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'`. `voVolume: 0` statt `voiceover: ""`, denn
  bei vorhandenem Voiceover fällt die Komposition auf `VO.file` zurück.
- Nicht auf das Sortieren von hunderten Kandidaten warten: nach Beschreibung auswählen, einsetzen, benennen, korrigieren lassen.

## Fertig machen für den Post

- `post_render.sh` liefert 1080 × 1920, 30 fps, H.264 High, AAC 320 kbit/s, höchstens −14 LUFS / −1,2 dBTP, einmal mit und einmal ohne
  Musik (Standardwerte der Komposition entscheiden, was „mit Musik“ enthält), dazu Cover-Bilder. Die gedruckte Lautheit und die Cover lesen.
- Vor einem öffentlichen Post die Musik-Frage ansprechen (`docs/recherche-2026-10.md`): im Zweifel die Fassung ohne Musik nehmen.

## Posten

Details und Fallen: `edit-tools/POSTEN.md`. Sichere Reihenfolge, jede Stufe einzeln:

1. Beschreibung vorschlagen, **der Mensch gibt sie frei**, erst dann in eine Datei (echtes `#`, höchstens 5 Hashtags bei Instagram).
2. Probe: `post_social.py tiktok <video> --caption-file <datei> --dry-run` (lädt nichts hoch, legt nichts an). Instagram ohne
   `--publish` zeigt ebenfalls nur die Aufrufe. Ein TikTok-Entwurf ist schon eine echte Aktion im Konto: nur nach Freigabe.
3. Zweite Freigabe, dann `--publish`.
4. Nachlesen: Link bzw. Post-ID aus der Ausgabe, `status`. Unklarer Ausgang (Zeitüberschreitung): nicht wiederholen, erst im Konto
   nachsehen. Nie zum Ausprobieren veröffentlichen oder Entwürfe anlegen.

## Varianten

Ein Video ist eine Vorlage. Für drei bis vier Varianten (zum Beispiel als Test-Reels) bekommt jede ihren eigenen Voiceover-Take
mit eigenen Wortzeiten (`npm run vo`); Bild und Sounds hängen an den Wortzeiten und wandern mit. Zwischen Varianten nur eine Sache
ändern, zuerst die ersten 1,5 Sekunden.

## Psychologie für Skript und Schnitt

1. Die ersten 1,5 bis 3 Sekunden entscheiden: mit dem stärksten Bild anfangen.
2. Ein klarer emotionaler Höhepunkt, verbunden mit dem Inhalt; die Musik setzt davor kurz aus.
3. Gesicht groß und früh.
4. Text im Bild, Wort für Wort zum Voiceover.
5. Kein Gesang unter der Stimme.
6. Zügig und engagiert sprechen; Schnitte alle zwei bis drei Sekunden reichen.
7. Sättigung hochdrehen bringt nach Beleglage nichts; Belichtung, Kontrast und Wärme angleichen.

Skript-Muster für 15 Sekunden und rund 40 Wörter: Aufbruch → Ort und Schritt → Menschen → was wir bauen (Höhepunkt auf dem
Namen) → Anspruch → Absender und offenes Ende. Jede Zeile ein eigenes Bild; Bewegungen sind vor dem betonten Wort fertig.

## Regeln

- Mehrere Agenten am selben Projekt: vor jedem Schreiben md5 vergleichen, vorher Sicherung mit Endung `.bak`.
- Fotos und Videos als Originale, wo es sie gibt; Ersatz ausdrücklich nennen.
- Nichts posten und nichts Öffentliches ändern ohne ausdrückliche Freigabe.
- Im Bericht sagen, was geprüft wurde (Einzelbild angesehen, Nur-Effekte-Spur gemessen, Lautheit gelesen, Beitrag zurückgelesen) und was nicht.
