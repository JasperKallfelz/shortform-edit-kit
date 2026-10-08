# Posten auf TikTok und Instagram Reels

`post_social.py` ist der letzte Schritt nach `post_render.sh`: die fertige MP4 hochladen und über die Composio-CLI als Entwurf oder
Beitrag anlegen. Nur Standardbibliothek, Python 3.9+. Der Mensch gibt vorher die Beschreibung frei (siehe „Sichere Reihenfolge“).

## Voraussetzungen

- **Composio-CLI** (`composio`), angemeldet. Prüfen mit `composio whoami`.
- **Verbundene Toolkits** in Composio: `zernio_mcp` (Upload und TikTok; im Zernio-Konto muss das TikTok-Konto angebunden sein) und
  `instagram` (Instagram-Business- oder Creator-Konto). Fehlendes verbinden mit `composio link zernio_mcp` bzw. `composio link instagram`.
- `curl` (ist auf macOS dabei).

## Konfiguration

`post.config.json` liegt neben dem Skript und wird nie eingecheckt (steht in `.gitignore`). Daneben liegen `post-log.jsonl`
(eine Zeile je echter Aktion: Zeit, Plattform, IDs, Link) und die gemerkten Uploads `<video>.upload.json`.

```bash
cp edit-tools/post.config.example.json edit-tools/post.config.json
```

```bash
python3 edit-tools/post_social.py accounts
```

`accounts` liest nur und druckt, welche Werte in die Datei gehören:

| Schlüssel | Bedeutung |
|---|---|
| `tiktok_account_id` | Konto-ID aus der Zernio-Liste |
| `instagram_user_id` | ID des Instagram-Kontos |
| `composio_account_zernio` | nur nötig, wenn Composio mehrere Zernio-Verbindungen hat und die Standardverbindung kein Konto sieht |
| `composio_account_instagram` | dasselbe für Instagram |

Mit `--config PFAD` (vor oder nach dem Befehl) lässt sich eine andere Datei nehmen; das Protokoll liegt dann neben ihr.

## Befehle

Hochladen (temporärer Medienspeicher; prüft die Dateigröße auf dem Server und merkt sich die URL 45 Minuten):

```bash
python3 edit-tools/post_social.py upload out/post-2026-10-08/Mein-Video_1080x1920_ohne-Musik.mp4
```

TikTok als Entwurf (ohne `--publish` entsteht nur ein Entwurf, nichts ist öffentlich):

```bash
python3 edit-tools/post_social.py tiktok out/Mein-Video.mp4 --caption-file beschreibung-tiktok.txt
```

TikTok veröffentlichen (sofort live; liest danach Status und Post-ID nach):

```bash
python3 edit-tools/post_social.py tiktok out/Mein-Video.mp4 --caption-file beschreibung-tiktok.txt --publish
```

Instagram prüfen (legt nichts an, zeigt die Aufrufe per `composio --dry-run`):

```bash
python3 edit-tools/post_social.py instagram out/Mein-Video.mp4 --caption-file beschreibung-instagram.txt --thumb-ms 1500
```

Instagram veröffentlichen (Container, warten auf „FINISHED“, veröffentlichen, nachlesen, Beschreibung Byte für Byte vergleichen, Link ausgeben; Exit-Code ungleich 0 bei Abweichung oder Fehler):

```bash
python3 edit-tools/post_social.py instagram out/Mein-Video.mp4 --caption-file beschreibung-instagram.txt --publish
```

Stand nachlesen:

```bash
python3 edit-tools/post_social.py status --tiktok-post <POST-ID>
```

```bash
python3 edit-tools/post_social.py status --instagram-media <MEDIA-ID>
```

Nur ansehen, was passieren würde (kein Upload, nichts angelegt), auch zusammen mit `--publish`:

```bash
python3 edit-tools/post_social.py tiktok out/Mein-Video.mp4 --caption-file beschreibung-tiktok.txt --publish --dry-run
```

Weitere Schalter: `upload --neu` lädt trotz frischem Upload neu hoch; `instagram --nicht-im-feed` zeigt das Reel nur im Reels-Tab.

## Beschreibungsdatei

UTF-8-Text. Nachgestellte Zeilenumbrüche werden entfernt, innere bleiben. Echtes `#`, echte Umlaute und Emojis. Mehr als 5 Hashtags
warnt das Skript (Instagram erlaubt seit Dezember 2025 höchstens 5; für TikTok bringt mehr nichts), blockiert aber nicht.
Hashtags, Länge und Musikrechte: [`../docs/research-2026-10.md`](../docs/research-2026-10.md).

## Sichere Reihenfolge

1. Beschreibung schreiben (lassen) und **von einem Menschen freigeben lassen**. Erst dann in die Datei.
2. TikTok: als Entwurf anlegen. Instagram: ohne `--publish` laufen lassen (zeigt die Aufrufe). Im Zweifel zusätzlich `--dry-run`.
3. Zweite Freigabe, dann `--publish`.
4. Ergebnis ansehen: Link bzw. Post-ID aus der Ausgabe, Eintrag in `post-log.jsonl`.

## Fallen

- **Zernio plant still ein.** `ZERNIO_MCP_POSTS_CREATE` ohne `is_draft` und ohne `publish_now` legt den Beitrag **in 60 Minuten**
  an. Das Skript sendet immer genau eines von beiden und meldet es, wenn der Beitrag danach „scheduled“ ist.
- **„# als %23“ ist falsch.** Die Werkzeugbeschreibung von Instagram verlangt URL-Kodierung der Hashtags. Die Beschreibung wird nicht
  dekodiert, `%23` stünde wörtlich im Beitrag. Das Skript sendet rohen Text; eine Beschreibung mit `%23` bricht es vor dem
  Veröffentlichen ab.
- **Mehrere Zernio-Verbindungen:** Sieht die Standardverbindung keine Konten („No accounts connected“), `accounts` zeigen lassen
  und `composio_account_zernio` setzen.
- **Der Upload ist temporär.** Die URL gilt nur kurz; das Skript lädt neu hoch, wenn sie nicht mehr abrufbar ist.
- **Nichts wird automatisch wiederholt.** Läuft ein Veröffentlichen in eine Zeitüberschreitung, ist der Ausgang unklar: erst im Konto
  nachsehen oder `status` nutzen, nicht blind noch einmal starten.

## Was so nicht geht

- **TikTok: kein Titelbild.** Über diesen Weg lässt sich kein Cover setzen. Auch die Cover-Bilder aus `post_render.sh` setzt das Skript
  nirgends; bei Instagram wählt `--thumb-ms` ein Standbild aus dem Video, sonst bleibt nur die App.
- **Instagram: Beiträge lassen sich über Composio weder ändern noch löschen.** Darum prüft das Skript vor dem Veröffentlichen alles
  Prüfbare und vergleicht danach die Beschreibung. Korrekturen nur in der Instagram-App.
- **Keine Musikauswahl aus der Plattform-Bibliothek.** Die Werkzeuge haben dafür keinen Parameter (bei Instagram nur einen Namen für die
  Tonspur). Für Plattform-Musik die Fassung „ohne Musik“ nehmen und in der App Musik wählen; Rechte siehe Recherche.
