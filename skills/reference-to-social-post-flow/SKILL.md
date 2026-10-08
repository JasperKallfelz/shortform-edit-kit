---
name: reference-to-social-post-flow
description: "Ablauf, um ein Referenz-Video (Instagram/TikTok) mit eigenem Material in Remotion nachzubauen und danach auf TikTok und Instagram zu posten (mit edit-tools/post_social.py: Beschreibung freigeben lassen, Trockenlauf oder Entwurf, veröffentlichen, nachlesen). Nutzen, wenn jemand ein Vorbild-Video zeigt und es nachgebaut haben will, Clips aus der Fotomediathek für einen Edit sucht, einen Remotion-Edit zeigen, rendern oder veröffentlichen will."
version: 1.1.0
platforms: [macos]
metadata:
  hermes:
    tags: [Remotion, Edit, TikTok, Instagram, Fotos, Posten]
    related_skills: [clip-sound-post-flow]
---

# Referenz → Remotion-Edit → Post

Den Ablauf von Skript und Voiceover bis zum fertigen Export beschreibt `clip-sound-post-flow` (und `AGENTS.md` im Wurzelordner dieses
Repos). Dieser Skill ergänzt, wie man eine Referenz nachbaut und wie man am Ende postet.

## Ablauf in Kürze

1. **Referenz analysieren, frame-genau.** Einsatz-Frames und Rechtecke neuer Elemente mit Frame-Differenz bei 30 fps messen
   (OpenCV: Differenz benachbarter Frames, Schwelle, Bounding-Box), nicht aus 4-fps-Kontaktbögen schätzen. Marken, Handles und
   Wasserzeichen der Referenz weglassen, fremde Namen durch die eigenen ersetzen.
2. **Material.** Clip-Liste aus der Fotos-Datenbank (sqlite, Tabelle `ZASSET`; `ZKIND=1` = Video). Originale über die Fotos-App
   exportieren (`osascript … export … with using originals`). Ein Video zu einem Standbild findet man mit Vision-Feature-Prints
   gegen die Vorschaubilder der Mediathek oder mit einem Kontaktbogen (`edit-tools/kontaktbogen.py`). iPhone-Clips sind oft gedreht
   gespeichert und in HDR: für Proxys nach SDR wandeln und die Drehung beachten.
3. **Remotion.** Jeder Clip ist ein Slot im Props-Panel (Datei, Startsekunde). Wort-DSL für Text. Hochformat in 16:9 mit
   unscharfer Kopie als Hintergrund.
4. **Prüfen.** Lint und Typprüfung, Frames neben die Referenz legen, erst dann „fertig“ sagen.
5. **Zeigen.** Im Studio zeigen statt Render-Dateien zu schicken, außer ein Render ist ausdrücklich gewünscht.
6. **Posten** nur mit ausdrücklicher Freigabe für Text, Hashtags und Konto, mit `edit-tools/post_social.py` (nächster Abschnitt).

## Posten mit post_social.py

Das Skript lädt die fertige MP4 hoch und legt sie über die Composio-CLI auf TikTok (über Zernio) und Instagram (Graph-API) an. Alle
Befehle, die Konfiguration und die Fallen: `edit-tools/POSTEN.md`. Vorher einmalig `post.config.json` aus `post.config.example.json`
anlegen (wird nie eingecheckt); `accounts` nennt die Werte, die hineingehören:

```bash
python3 edit-tools/post_social.py accounts
```

Die sichere Reihenfolge, jede Stufe einzeln:

1. **Beschreibung schreiben und von einem Menschen freigeben lassen.** Erst dann in eine Datei (UTF-8, echtes `#`, höchstens 5
   Hashtags bei Instagram, 3 bis 4 passende bei TikTok).
2. **Trockenlauf.** Lädt nichts hoch und legt nichts an, zeigt die Aufrufe:

   ```bash
   python3 edit-tools/post_social.py tiktok <video> --caption-file <datei> --dry-run
   ```

   Instagram ohne `--publish` zeigt ebenfalls nur die Aufrufe. Ein TikTok-Entwurf (Aufruf ohne `--publish` und ohne `--dry-run`) ist
   schon eine echte Aktion im Konto: nur nach der Freigabe der Beschreibung.
3. **Zweite Freigabe, dann veröffentlichen:**

   ```bash
   python3 edit-tools/post_social.py instagram <video> --caption-file <datei> --publish
   ```

4. **Nachlesen.** TikTok: Status und Post-ID. Instagram: Link, und die veröffentlichte Beschreibung wird Byte für Byte mit der Datei
   verglichen (Exit-Code ungleich 0 bei Abweichung). Später jederzeit:

   ```bash
   python3 edit-tools/post_social.py status --instagram-media <MEDIA-ID>
   ```

Nie zum Ausprobieren veröffentlichen oder Entwürfe anlegen: dafür gibt es `--dry-run`.

## Allgemeine Fallen beim Posten über eine API (Scheduler, Graph-API)

- Immer zuerst als **Entwurf** anlegen, Freigabe abwarten, dann veröffentlichen. Manche Werkzeuge planen einen Post automatisch
  ein, wenn weder „Entwurf“ noch „sofort“ gesetzt ist (Zernio: in 60 Minuten): die Parameter vorher lesen. `post_social.py` sendet
  immer genau eines von beiden.
- Große Dateien nicht über ein Browser-Upload-Feld schicken (oft auf wenige MB begrenzt), sondern über den Upload-Endpunkt des
  Dienstes (vorab signierte Adresse anfordern, Datei per PUT hochladen, Upload abschließen). Das Skript macht das und prüft die
  Dateigröße auf dem Server.
- Instagram Reels über die Graph-API: Container anlegen (Typ REELS, öffentliche Video-URL) → Status abfragen, bis er fertig
  ist → veröffentlichen → Beitrag zurücklesen und Text prüfen.
- **Beschreibung als Rohtext übergeben**, mit echtem `#` und echten Zeilenumbrüchen. URL-kodierter Text wird nicht dekodiert
  und steht dann wörtlich im Beitrag. Veröffentlichte Texte lassen sich über viele Werkzeuge nicht mehr ändern.
- Nichts automatisch wiederholen: nach einer Zeitüberschreitung ist unklar, ob der Beitrag existiert. Erst im Konto nachsehen.
- Sichtbarkeit, Duett und Stitch lassen sich über Dritt-Werkzeuge oft nicht setzen; in der App nachsehen. Ein eigenes Titelbild lässt
  sich bei TikTok über diesen Weg nicht setzen.
- Was die Plattformen zu Beschreibung, Hashtags, Cover, Musik und Test-Reels sagen: `docs/research-2026-10.md`.

## Regeln

- „Warte, mach nichts“ heißt wirklich nichts tun, bis Material kommt.
- Nicht schneiden, bevor Skript und Beispielvideos da sind.
- Immer Originale in höchster Qualität, keine Vorschauen.
- Posten und jede Änderung an öffentlichem Inhalt nur nach ausdrücklicher Freigabe, auch wenn die Technik es kann.
