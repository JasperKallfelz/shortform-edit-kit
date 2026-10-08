# Drehplan: der Rundgang zum Selbstaufnehmen

Ziel: dieselbe Tour wie in [`rundgang.mp4`](rundgang.mp4), nur mit eigener Stimme, in zwei bis drei Minuten, aufgenommen mit
[Cap](https://cap.so), Screen Studio oder dem Bildschirmrekorder von macOS. Ein Durchgang, kleine Versprecher stehen lassen.

## Vorbereitung (etwa 10 Minuten)

- **Saubere Umgebung.** Eigenes Browserprofil ohne Lesezeichenleiste, Erweiterungen und angemeldete Konten (oder ein privates
  Fenster). Mitteilungen aus (Fokus „Nicht stören“), Dock und Menüleiste ausblenden, Desktop leer. Aufgenommen wird nur das
  Browser- beziehungsweise Terminalfenster, nie der ganze Bildschirm.
- **Fenstergröße.** Browser 1600 × 1000 Pixel, Terminal etwa 1400 × 880. Terminalschrift 18 bis 20 Punkt.
- **Neutrale Eingabeaufforderung.** Im Terminal einmal `export PS1='$ '`, damit weder Benutzer- noch Rechnername noch Pfad im Bild stehen.
  Fenstertitel nicht anzeigen oder auf „Terminal“ stellen.
- **Cap-Einstellungen.** Modus „Fenster“, Hintergrund ein ruhiger Verlauf, Ecken abgerundet, Schatten an, automatisches Zoomen auf
  Klicks an, Cursor hervorheben, 1080p mit 30 Bildern pro Sekunde. Vor dem Start eine Probeaufnahme von zehn Sekunden mit Ton.
- **Werkzeuge vorher starten**, je in einem eigenen Terminal, alles im Repo-Ordner:

```bash
cd beispiel && npm run tonstudio
```

```bash
cd beispiel && npm run dev
```

```bash
python3 hoerseite.py
```

- **Ein Take liegt schon bereit** (`beispiel/recordings/`), damit der Befehl `npm run vo` ohne Wartezeit läuft. Ein Beispielclip ohne
  Menschen und ohne Marken liegt in `beispiel/public/`.

## Ablauf

| Zeit | Schritt | Was im Bild passiert | Was du sagst |
|---|---|---|---|
| 0:00 | **Einstieg** | Repo-Name groß, dann die fünf Schritte als Liste | „Das ist das shortform-edit-kit: fünf Schritte vom Skript bis zum Post.“ |
| 0:10 | **1 · Skript und Voiceover** | Tonstudio im Browser: Skript im Teleprompter, „Aufnahme starten“, Countdown, einen Satz lesen, Stopp, Karte mit dem gesicherten Take. Dann Terminal: `npm run vo -- recordings/<take>.wav`, Wortzeit-Tabelle, `tail -14 src/timing.ts` | „Ich lese das Skript vom Teleprompter ab, jeder Take wird sofort gesichert. Ein Befehl macht daraus das Voiceover und die Tabelle der Wortzeiten, an der später alles hängt.“ |
| 0:55 | **2 · Clips reindroppen** | Remotion Studio, Komposition `Demo`, Props rechts: bei `slots` einen Dateinamen eintragen, Startsekunde, Vorschau abspielen | „Clips kommen in die Slots: Dateiname und Startsekunde eintragen, der Ausschnitt lässt sich verschieben, ohne Code anzufassen.“ |
| 1:25 | **3 · Sound-Design** | Hörseite: ein paar Sounds anklicken, mit Pfeiltasten wechseln, B behält, X sortiert aus, Zähler oben. Dann Studio-Zeitleiste: Spur „SFX · …“ anklicken, Wiedergabe | „Sounds sortiere ich mit der Tastatur. Im Video hängt jeder Effekt als benannte Sequenz an einer Wortzeit, ändert sich der Take, wandern sie mit.“ |
| 2:00 | **4 · Fertig machen** | Terminal: `post_render.sh` mit Beispielnamen, die Zeilen mit Lautheit, danach die Dateiliste | „Der Export liefert zwei Dateien, mit und ohne Musik, die Lautheit liegt höchstens bei minus 14 LUFS.“ |
| 2:25 | **5 · Posten** | Terminal: `post_social.py tiktok … --dry-run`, die Ausgabe des Trockenlaufs bis „nichts wurde angelegt“ | „Ohne `--publish` entsteht höchstens ein Entwurf. Gepostet wird nur, wenn ein Mensch freigibt.“ |
| 2:45 | **Schluss** | `beispiel/demo.mp4` abspielen, Repo-Name | „So sieht das Ergebnis aus. Alles Weitere steht in den README-Dateien.“ |

## Was nicht im Bild sein darf

- **Schritt 1:** Gerätename im Mikrofon-Menü, falls er einen Personennamen enthält (vorher ein neutrales Gerät wählen); Benutzername und
  Pfade im Terminal; Takes mit privatem Inhalt (nur Beispieltext lesen).
- **Schritt 2:** eigene oder fremde Clips mit erkennbaren Personen, WhatsApp-Chats und Kontaktnamen, Fotomediathek, Dateinamen mit Namen.
- **Schritt 3:** Finder-Fenster, Adressleiste mit Ordnerpfaden, `auswahl.json` mit eigenen Urteilen im Editor.
- **Schritt 4:** der echte SSH-Name des Schnitt-Rechners (`EDIT_HOST` auf einen neutralen Namen setzen), Home-Pfade, Kundennamen im Projektordner.
- **Schritt 5:** Konto-IDs, `post.config.json`, `post-log.jsonl`, Tokens, die Ausgabe von `composio whoami` (zeigt die Anmeldung), Kontonamen,
  Chats. **Während der Aufnahme nie echt posten**, nur `--dry-run` oder `accounts` mit abgedeckter Ausgabe.
- **Immer:** Benachrichtigungen, andere Fenster und Tabs, Passwortmanager-Popups, Lesezeichen.

## Nach der Aufnahme

- Einmal komplett ansehen und auf Namen, Pfade und Konto-Angaben prüfen, auch im Ton („das ist mein …“ weglassen).
- Lange Wartezeiten (Countdown, Rendern) im Schnitt auf das Doppelte beschleunigen oder kürzen.
- Export auf unter 15 MB bringen, wenn das Video ins Repo soll:

```bash
ffmpeg -i roh.mov -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart rundgang-eigen.mp4
```
