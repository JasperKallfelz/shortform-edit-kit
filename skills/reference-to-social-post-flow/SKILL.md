---
name: reference-to-social-post-flow
description: "Ablauf, um ein Referenz-Video (Instagram/TikTok) mit eigenem Material in Remotion nachzubauen und danach auf TikTok und Instagram zu posten. Nutzen, wenn jemand ein Vorbild-Video zeigt und es nachgebaut haben will, Clips aus der Fotomediathek für einen Edit sucht, einen Remotion-Edit zeigen, rendern oder veröffentlichen will."
version: 1.0.0
platforms: [macos]
metadata:
  hermes:
    tags: [Remotion, Edit, TikTok, Instagram, Fotos]
    related_skills: [clip-sound-post-flow]
---

# Referenz → Remotion-Edit → Post

## Ablauf in Kürze

1. **Referenz analysieren, frame-genau.** Einsatz-Frames und Rechtecke neuer Elemente mit Frame-Differenz bei 30 fps messen
   (OpenCV: Differenz benachbarter Frames, Schwelle, Bounding-Box), nicht aus 4-fps-Kontaktbögen schätzen. Marken, Handles und
   Wasserzeichen der Referenz weglassen, fremde Namen durch die eigenen ersetzen.
2. **Material.** Clip-Liste aus der Fotos-Datenbank (sqlite, Tabelle `ZASSET`; `ZKIND=1` = Video). Originale über die Fotos-App
   exportieren (`osascript … export … with using originals`). Ein Video zu einem Standbild findet man mit Vision-Feature-Prints
   gegen die Vorschaubilder der Mediathek oder mit einem Kontaktbogen. iPhone-Clips sind oft gedreht gespeichert und in HDR:
   für Proxys nach SDR wandeln und die Drehung beachten.
3. **Remotion.** Jeder Clip ist ein Slot im Props-Panel (Datei, Startsekunde). Wort-DSL für Text. Hochformat in 16:9 mit
   unscharfer Kopie als Hintergrund.
4. **Prüfen.** Lint und Typprüfung, Frames neben die Referenz legen, erst dann „fertig“ sagen.
5. **Zeigen.** Im Studio zeigen statt Render-Dateien zu schicken, außer ein Render ist ausdrücklich gewünscht.
6. **Posten** nur mit ausdrücklicher Freigabe für Text, Hashtags und Konto.

## Posten über eine API (Scheduler, Graph-API)

- Immer zuerst als **Entwurf** anlegen, Freigabe abwarten, dann veröffentlichen. Manche Werkzeuge planen einen Post automatisch
  ein, wenn weder „Entwurf“ noch „sofort“ gesetzt ist: die Parameter vorher lesen.
- Große Dateien nicht über ein Browser-Upload-Feld schicken (oft auf wenige MB begrenzt), sondern über den Upload-Endpunkt des
  Dienstes (vorab signierte Adresse anfordern, Datei per PUT hochladen, Upload abschließen).
- Instagram Reels über die Graph-API: Container anlegen (Typ REELS, öffentliche Video-URL) → Status abfragen, bis er fertig
  ist → veröffentlichen → Beitrag zurücklesen und Text prüfen.
- **Beschreibung als Rohtext übergeben**, mit echtem `#` und echten Zeilenumbrüchen. URL-kodierter Text wird nicht dekodiert
  und steht dann wörtlich im Beitrag. Veröffentlichte Texte lassen sich über viele Werkzeuge nicht mehr ändern.
- Sichtbarkeit, Duett und Stitch lassen sich über Dritt-Werkzeuge oft nicht setzen; in der App nachsehen.
- Was die Plattformen zu Beschreibung, Hashtags, Cover, Musik und Test-Reels sagen: `docs/recherche-2026-10.md`.

## Regeln

- „Warte, mach nichts“ heißt wirklich nichts tun, bis Material kommt.
- Nicht schneiden, bevor Skript und Beispielvideos da sind.
- Immer Originale in höchster Qualität, keine Vorschauen.
- Posten und jede Änderung an öffentlichem Inhalt nur nach ausdrücklicher Freigabe, auch wenn die Technik es kann.
