# Sound-Kit für Video-Edits

Aufbereitete Sound-Effekte und der Ablauf, mit dem sie in ein Video kommen.

## Was hier liegt

| Pfad | Inhalt |
|---|---|
| `sounds/` | 53 fertige WAVs (48 kHz, 24 Bit, mono, Spitze −1 dBFS, Anschlag bei 0 ms), nur echte Aufnahmen |
| `catalogue.json` | je Sound `len` (Länge in ms), `lead` (ms bis zur Stelle, die auf dem Bild sitzen soll) und `loud` (lautestes 50-ms-Stück in dB) |
| `quellen.tsv` | Herkunft und Lizenz je Sound |
| `tools/prepare_sfx.py` | macht aus Rohdateien in `../sfx-candidates/` die fertigen Sounds (neue Sounds dort in `SRC` und `GROUPS` ergänzen) |
| `tools/sync_remotion.py` | kopiert die WAVs nach `<projekt>/public/sfx` und schreibt den Katalog `SOUNDS` in `<projekt>/src/lib/sfx.tsx` neu |
| `remotion/sfx.tsx` | Katalog + `SfxTrack` für Remotion, zum Kopieren nach `src/lib/sfx.tsx` |

Die Sounds:
- Kamera: `shutter2`, `shutter3`, `shutterSlr2/3`, `shutterInsta1/2`, `shutterOld`, `shutterDslr`, `shutterBurst2–4` (Serien), `winder1/2` (Filmtransport)
- Maus, Trackpad, Schalter: `mouse1–4`, `trackpad1/2`, `switch`, `switch2`, `switch3`, `pen1–3` (Kugelschreiber)
- Klapptafel wie am Flughafen: `flap` (eine Klappe; `flapLo`/`flapHi` etwas tiefer/höher gegen hörbare Wiederholung), `flapBurst3/5/8` (kurze Salven), `flapEnd1/2` (Auslaufen), `flapRun` (längerer Lauf)
- Papier: `page1–3` (Seite blättern), `tear` (Papier reißt)
- Whooshes, sparsam: `swish`, `whooshShort`, `swishSmall`
- Weitere: `riser1` (rückwärts gespieltes Becken), `tom1` (tiefe Trommel), `riffle1` (Karten-Riffeln), `key1–3` (Tasten), `pencil1/2` (Bleistiftstrich), `cardPlace1` (Karte hinlegen), `clink1` (Glas)
- Thematische Einzelgeräusche: `typeBurst1` (Tippen auf einer Laptop-Tastatur, 2,1 s; gedacht für ein Wort wie „engineer“, auf die Länge des Abschnitts begrenzt) und `coinCup1` (Münze fällt in eine Tasse; gedacht für eine Geldsumme). Einsatz mit `Extra` in [`../docs/shortform-learnings-2026-10.md`](../docs/shortform-learnings-2026-10.md#thematische-einzelgeräusche)

## Hausregel

**Nur echte, aufgenommene Geräusche. Nichts Synthetisches.** Synthetische UI-Sounds (Ticks, Pops, Blips) klingen in einem
ruhigen, typografischen Video „wie ein Raumschiff“. Jede Bewegung im Bild bekommt einen kleinen Sound, aber so leise und
passend, dass er nicht eingefügt klingt. Whooshes nur ganz minimal.

## Der Ablauf

1. **Bildereignisse sammeln.** Im Code nachlesen, auf welchem Frame etwas passiert (Schnitt, Pfeil, Foto erscheint, Kachel
   poppt, Zahl läuft). Jede Cue hängt an derselben Wortzeit oder Animations-Konstante wie das Bild, keine festen Zahlen.
   Kommt ein neuer Voiceover-Take, wandern die Sounds von selbst mit.
2. **Sounds aufbereiten** (`tools/prepare_sfx.py`): Stille vorn weg, damit der Anschlag bei 0 ms sitzt; Spitze auf −1 dBFS;
   bei Whooshes `lead` messen. Tonhöhen-Varianten als eigene Dateien backen, nicht per Abspieltempo im Video (Vorschau und
   Render klingen sonst verschieden).
3. **Platzieren.** Klicks und Auslöser mit dem Anschlag auf das Ereignis. Whooshes mit der lautesten Stelle auf die
   schnellste Stelle der Bewegung (bei einem Pfeil die Flugmitte), nicht auf Anfang oder Ende.
4. **Benennen.** Jede Cue bekommt einen Namen und erscheint in der Studio-Zeitleiste als „SFX · Name“. Korrigiert wird nach
   Gehör, mit dem Namen oder der Kategorie.
5. **Pegel setzen** (Regeln unten).
6. **Nachmessen.** Nur die Effekte rendern (`npx remotion render <Komposition> sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'`; `voVolume: 0` statt
   `voiceover: ""`, denn bei vorhandenem Voiceover fällt die Komposition auf `VO.file` zurück), Pegel je Abschnitt und gegen die Musik
   vergleichen. Vom Gesamtmix Lautheit und Spitze messen. Beides druckt `../edit-tools/ton_check.py`.
7. **Im Studio zeigen, Korrekturen einarbeiten, wieder messen.**

## Pegel-Regeln

- **Musik** liegt etwa 12–13 dB unter der Stimme.
- **Effekte etwa so laut wie die Musik, nicht darüber.** Gemessen wird gegen die Musik, nicht gegen die Stimme (0,4-s-Pegel
  der Nur-Effekte-Spur gegen die Musik). Im Beispielprojekt regelt das `sfxVolume` (1.3 bei Musik auf 0.15); die `vol`-Werte
  der Cues geben nur das Verhältnis untereinander an.
- **Whooshes** dürfen etwas lauter sein.
- **Sehr kurze Sounds** (Auslöser, Klicks) wirken schnell zu laut, vor allem als Übergangseffekt. Dort bewusst leiser.
- **Dichte Folgen ausdünnen.** Poppen viele Elemente innerhalb weniger Frames auf, höchstens alle 4 Frames eines klicken
  lassen (nach Frame sortiert, nicht nach Nummer), sonst rattert es.
- **Keine schnellen mechanischen Wiederholungen.** Nach Gehör durchgefallen sind Auslöser als Übergang (`shutterInsta1/2`) und schnelle
  Klappen-Folgen (`flapBurst3/8`); sie klingen wie ein mehrfacher Auslöser. Ein einzelnes Blättern (`riffle1`) trug.
  Details: [`../docs/shortform-learnings-2026-10.md`](../docs/shortform-learnings-2026-10.md#5-geräusche-was-nach-gehör-durchfiel-und-was-blieb).
- **Wo der Sound zum Bild gehört** (ein Foto erscheint → Auslöser) darf er etwas lauter sein.
- Ziel für den fertigen Mix: −14 LUFS, Spitze −1 dBTP.

Tauscht man einen Sound gegen einen anderen, den `vol`-Wert über `loud` umrechnen
(`vol_neu = vol_alt * 10^((loud_alt - loud_neu) / 20)`), sonst wirkt der neue lauter oder leiser als der alte.

## Musik

- Den Einstieg so wählen, dass ein Schlag des Songs auf das wichtigste Wort fällt. Beats mit librosa bestimmen, den Einstieg
  aus der Wortzeit berechnen (Stelle im Song minus Wortzeit), dann bleibt er bei neuen Takes auf dem Wort.
- Schnitte, die am Voiceover hängen, treffen den Beat nur zufällig. Ehrlich sagen, welche sitzen und welche nicht.
- Kurz vor dem Höhepunkt die Musik wegnehmen, auf dem Wort schlagartig zurück.
- Den Einstieg sucht `../edit-tools/beat_align.py`. Hintergründe und Messwege: `../docs/sound-and-text-sync.md`.
- Musik gehört nicht in dieses Repo. Zu Rechten beim Posten siehe `../docs/research-2026-10.md`.
