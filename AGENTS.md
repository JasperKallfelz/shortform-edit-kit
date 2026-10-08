# AGENTS.md

Einstieg für einen KI-Agenten, der mit diesem Kit ein Kurzvideo bauen oder ändern soll. Menschen finden den Überblick in der
[`README.md`](README.md).

## Was das Kit ist

Ein Werkzeugkasten für kurze Hochkant-Videos (TikTok, Reels) in Remotion. Ein Voiceover liefert die Wortzeiten (`src/timing.ts`);
Bild, Text und Sounds hängen an diesen Zeiten, ein neuer Take verschiebt alles gemeinsam. Für jeden Schritt vom Skript bis zum Post
gibt es ein Werkzeug, und jeder Schritt hat ein Merkmal, an dem man sieht, dass er gelungen ist.

## Ordnerkarte

| Pfad | Wofür |
|---|---|
| `beispiel/` | das Remotion-Projekt (Composition `Demo`): `skript.json`, `src/timing.ts`, `src/Demo.tsx` (Szenen, Props, `SFX_CUES`), `src/lib/` (Wort-DSL, Sound-Spur, `ambient.tsx`: Clip-Karte mit Ambient-Light-Schein), `public/` (Sounds, Clips, Voiceover) |
| `tonstudio/` | Voiceover: `recorder/` (Aufnahme-Seite), `vo/` (aufbereiten, ausrichten, `timing.ts` schreiben), `mikro/` (Eingabegerät umschalten) |
| `edit-tools/` | `whatsapp_clips.py`, `kontaktbogen.py`, `patch_lines.py`, `ton_check.py`, `beat_align.py`, `post_render.sh`, `post_social.py`, dazu `POSTEN.md` und `tests/` |
| `sfx-kit/`, `sfx-kandidaten/`, `hoerseite.py` | 53 fertige Sounds mit Katalog und Werkzeugen; 233 rohe Kandidaten mit Lizenz je Datei; die Hörseite zum Aussortieren |
| `skills/`, `docs/` | zwei Skills (Hermes-Format); die Recherche mit Quellen (`recherche-2026-10.md`), Erfahrungen zu Ton und Text-Sync (`ton-und-text-sync.md`), zu Skript, Stimme, Raumklängen, Bildbausteinen und Formaten kleiner Konten (`kurzvideo-erfahrungen-2026-10.md`) und der Rundgang (`rundgang.mp4`) |

## Die fünf Schritte

Schritt 1 läuft im Ordner `beispiel/`, die übrigen Befehle vom Wurzelordner des Repos (wo vermerkt: wieder in `beispiel/`).
Die ausführliche Fassung: [`edit-tools/README.md`](edit-tools/README.md).

### 1. Skript und Voiceover ([`tonstudio/README.md`](tonstudio/README.md))

- [ ] `skript.json` enthält den gesprochenen Text; die Schlüssel sind die, die der Code liest (`VO.w.<key>`).
- [ ] Aufnahme-Seite starten und dem Menschen die Adresse nennen (http://localhost:3600). Aufnehmen kann nur er.

```bash
npm run tonstudio
```

```bash
npm run vo -- recordings/<take>.wav
```

Fertig, wenn `vo` ohne Abbruch durchläuft (falsche Wortzahl bricht ab: Skript anpassen oder neu aufnehmen, nicht raten), die Zeilen
„uneinig“ und „GESCHÄTZT“ der Tabelle angesehen sind, das Studio die neue Länge zeigt und ein Einzelbild auf einem betonten Wort
stimmt. `vo` überschreibt `src/timing.ts` und `public/vo.wav`: eine fertige Variante vorher sichern.

### 2. Clips reindroppen

- [ ] Datei finden (Standbild im Chat heißt „dieses Video“), nach `public/` legen, Slot in den Props setzen (`slots`: Label, Datei, Startsekunde).

```bash
python3 edit-tools/whatsapp_clips.py export "<Name>" --date JJJJ-MM-TT --fotos
```

```bash
python3 edit-tools/kontaktbogen.py <ordner>
```

Fertig, wenn ein Einzelbild (`npx remotion still Demo bild.png --frame=N`, in `beispiel/`) gerendert und angesehen ist. WhatsApp-Clips
sind verkleinert (meist 1024 × 576): im Bericht sagen, Original beim Absender anfragen.

### 3. Sound-Design ([`sfx-kit/README.md`](sfx-kit/README.md))

- [ ] Jede Bewegung bekommt eine Cue in `SFX_CUES` (`beispiel/src/Demo.tsx`), an eine Wortzeit oder Animations-Konstante gehängt und benannt.
- [ ] Neue Sounds: `hoerseite.py` zum Aussortieren, `prepare_sfx.py`, dann `sync_remotion.py beispiel [md5]` (schreibt `src/lib/sfx.tsx`
  neu und verschiebt nicht mehr vorhandene WAVs nach `unused/sfx-verworfen`).

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
```

```bash
python3 edit-tools/ton_check.py beispiel/sfx.wav --musik <song.wav> --musik-start <s> --musik-vol 0.15
```

Fertig, wenn die Nur-Effekte-Spur (in `beispiel/`; `voVolume: 0`, nicht `voiceover: ""`, sonst bleibt die Stimme drin) gerendert, je
Abschnitt gegen die Musik gemessen und Lücken über 0,5 s ohne Effekt aufgelistet sind (`ton_check.py` druckt beides; ohne Musik
entfällt der Vergleich). Wort-Texte stehen zum Wortbeginn voll da (`TEXT_LEAD_MS`); nachgemessen wird an gerenderten Frames,
siehe [`docs/ton-und-text-sync.md`](docs/ton-und-text-sync.md). Mit Musik: `beat_align.py` legt einen Schlag auf das wichtigste Wort.

### 4. Fertig machen ([`edit-tools/post_render.sh`](edit-tools/post_render.sh))

```bash
EDIT_HOST=<ssh-name> edit-tools/post_render.sh <projektordner> <Komposition> <Name> 60,150,240
```

Fertig, wenn in `<projekt>/out/post-<Datum>/` beide Dateien (`…_mit-Musik.mp4`, `…_ohne-Musik.mp4`) und die Cover-Bilder liegen, die
gedruckte Lautheit je Fassung höchstens −14 LUFS zeigt und die Cover angesehen sind. „Mit Musik“ heißt: Standardwerte der Komposition
(in der Demo ist `music` leer). Die Musikrechte ansprechen ([`docs/recherche-2026-10.md`](docs/recherche-2026-10.md)).

### 5. Posten ([`edit-tools/POSTEN.md`](edit-tools/POSTEN.md))

- [ ] Beschreibung vorschlagen, der Mensch gibt sie frei, erst dann in eine Datei. Danach `--dry-run`, nach der zweiten Freigabe `--publish`.

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <beschreibung.txt> --dry-run
```

```bash
python3 edit-tools/post_social.py tiktok <video> --caption-file <beschreibung.txt> --publish
```

Fertig, wenn Link bzw. Post-ID aus der Ausgabe gelesen sind (Instagram: „Beschreibung Byte für Byte geprüft“; sonst `status`). Bei
Zeitüberschreitung oder unklarem Ausgang nicht wiederholen, erst im Konto nachsehen.

## Hausregeln

- **Nur echte, aufgenommene Geräusche.** Nichts Synthetisches. Neue Sounds nur CC0, gemeinfrei oder ausdrücklich freigegeben, mit Zeile
  in `sfx-kandidaten/manifest.tsv` ([`SOUNDS-LIZENZEN.md`](SOUNDS-LIZENZEN.md)). Effekte nie lauter als die Musik.
- **Jede Cue hängt an einer Wortzeit oder Animations-Konstante**, nie an einer festen Zahl, und hat einen Namen für die Zeitleiste.
- **Ein Mensch gibt Beschreibungen und das Posten frei.** Nie veröffentlichen oder Entwürfe anlegen, um etwas auszuprobieren: dafür
  gibt es `--dry-run`. Ein TikTok-Entwurf ist schon eine echte Aktion im Konto.
- **Originale statt Vorschauen** bei Fotos und Videos. Gibt es nur eine Vorschau, sagen.
- **Erst ansehen und messen, dann „fertig“.** Im Bericht stehen die echte Ausgabe der Prüfungen (Einzelbild, Nur-Effekte-Spur,
  Lautheit, Rücklesen) und was nicht geprüft wurde.
- **Abbruch nicht überspielen.** Optionen wie `--erlaube-abweichung` erst nach Rückfrage; geschätzte Zeiten im Bericht nennen.
- **Kein `--help` bei Skripten ohne Hilfe.** `prepare_sfx.py`, `sync_remotion.py`, `hoerseite.py`, `patch_lines.py` und `post_render.sh`
  führen sofort aus (`prepare_sfx.py` schreibt alle Sounds neu, `hoerseite.py` startet den Server) oder lesen das erste Argument als
  Pfad. Den Kopf der Datei lesen statt aufrufen. Hilfe gibt es bei `whatsapp_clips.py`, `kontaktbogen.py`, `post_social.py`, `vo.py`,
  `ton_check.py`, `beat_align.py`.
- **Nichts Kontospezifisches ausgeben:** Konto-IDs, Upload-Adressen und Beschreibungen nicht in Berichte, Commits oder Dokumente kopieren.

## Mehrere Agenten an einem Projekt

- Ein Schreiber pro Datei. Prüfsumme vor dem Schreiben (`md5 -q <datei>`): `patch_lines.py <datei> <md5> <swaps.json>` ändert nur, wenn
  die Datei noch diesen md5 hat und jede Stelle genau einmal vorkommt, sonst schreibt es nichts. `sync_remotion.py` nimmt den md5 von
  `sfx.tsx` als zweites Argument.
- Vor größeren Änderungen eine Sicherung mit Endung `.bak` (nicht `.ts`/`.tsx`, sonst prüft TypeScript die Kopie mit).
- Zwischenstände in einem Satz melden. Am Ende: was gemacht wurde, was geprüft wurde, was offen ist.

## Was nie in dieses Repo gehört

- eigenes Videomaterial, Standbilder aus Chats, Fotos; Aufnahmen (`recordings/`) und das erzeugte Voiceover (`public/vo.wav`)
- Namen von Personen oder Firmen, Konto-Namen und -IDs, echte Beschreibungen, Rechnernamen und Pfade aus dem eigenen Home-Ordner
- `edit-tools/post.config.json`, `post-log.jsonl`, `*.upload.json`, `auswahl.json` (stehen in `.gitignore`, ebenso `*.bak`)
- Musik und Sounds ohne dokumentierte Lizenz

Vor dem Einchecken die Dateiliste und alle neuen Texte danach durchsehen. Die Beispiele (Skript, Namen, Beschreibungen) bleiben
erfundene Platzhalter.

## Wo die Vorlieben des Menschen stehen

Nicht hier: Dieses Repo ist neutral. Sprache, Tonfall, Arbeitsweise und Konten gehören in die eigenen Notizen oder die Konfiguration
des Menschen und seines Agenten. Fehlt eine Angabe, fragen statt erfinden.
