# Ton und Text-Sync: was sich beim Bauen gezeigt hat

Erfahrungen aus einem 16-Sekunden-Video mit Voiceover, Musik und rund 50 Sound-Cues, das in mehreren Runden nach Gehör
korrigiert wurde. Die Regeln selbst stehen in [`../sfx-kit/README.md`](../sfx-kit/README.md) und
[`../AGENTS.md`](../AGENTS.md); hier steht, warum sie so sind und wie man sie nachmisst.

## Text muss zum Wort voll da sein

Ein Text gilt erst dann als synchron, wenn er **beim Wortbeginn fertig sichtbar** ist, nicht wenn er dort erst startet.

- Die Wortzeiten können stimmen (±20–40 ms) und der Text wirkt trotzdem zu spät: Das Einblenden dauert 3 Frames, der Text ist
  also erst 1–3 Frames nach dem Wort voll zu sehen. Am Videoanfang waren es 100 ms.
- Deshalb startet jeder Wort-Text um die Dauer seines Einblendens früher (`TEXT_LEAD_MS = 100` in `beispiel/src/Demo.tsx`).
  2–4 Frames Vorlauf lesen sich wie „gleichzeitig“; mehr als etwa 5 Frames wirken wie ein Spoiler.
- Beginnt eine Szene genau auf einem Wort, kann der Text nicht vor dem Schnitt kommen. Dann den Einsatz negativ werden lassen
  (nicht bei 0 klemmen): Der Text steht im ersten Frame der Szene schon deckend da.
- Zeilen, die ohne Einblenden hart wechseln (Untertitel), sind sofort voll da, aber gleichzeitig mit der Stimme, nicht davor.
  Ob auch sie 2–3 Frames früher kommen sollen, ist eine eigene Entscheidung.

**Nachmessen, nicht aus dem Code schließen.** Die Frames wirklich rendern und je Textzeile zählen, ab welchem Frame sie deckend
ist; den Spracheinsatz aus dem Spektrogramm der Aufnahme lesen und beides vergleichen.

```bash
npx remotion render Demo /tmp/seq --frames=0-70 --sequence --scale=0.25
```

Die Vorschau im Studio ist beim Ton nicht frame-genau, vor allem direkt nach dem Start. Wirkt dort etwas minimal versetzt,
zählt der Render.

## Lautstärke: gegen die Musik messen

- Der häufigste Fehler: die Effekte an der Stimme ausrichten. Dann sind sie viel zu laut. Maßstab ist die Musik.
- In drei Hörrunden pendelte sich das Ziel ein: zuerst zu laut, 2 dB unter der Musik dann zu leise, am Ende **die lauteste
  0,4-s-Stelle der Effekte so laut wie die Musik, nicht darüber**.
- Zwei Ebenen trennen: Die `vol`-Werte der Cues legen das Verhältnis der Sounds untereinander fest, ein Gesamtregler
  (`sfxVolume`) die Lautstärke aller zusammen. Dann ändert „alles etwas lauter“ eine Zahl statt fünfzig.
- Korrekturen kommen nach Gehör in Kategorien („die Whooshes“, „die kurzen Sounds an Übergängen“, „bei der Stelle mit den
  Fotos“), selten pro Cue. Deshalb jede Cue benennen und Änderungen als kurze Namensliste zurückmelden.
- Kurze Sounds (Auslöser, Klicks) wirken als Übergang schnell zu laut; wo der Sound zum Bild gehört (ein Foto erscheint),
  darf er kräftiger sein. Whooshes vertragen etwas mehr.

Messen:

```bash
python3 edit-tools/ton_check.py sfx.wav --musik <song.wav> --musik-start <s> --musik-vol 0.15 --mix mix.wav
```

Das zeigt den Pegel je Abschnitt, Lücken ohne Effekt, die lauteste Stelle der Effekte gegen die Musik und Lautheit und Spitze
des Gesamtmixes. Ein lauter Schlag auf einem betonten Wort kann die Spitze des Mixes bis an die Vollaussteuerung treiben,
obwohl jede Spur für sich Luft hat: nach jeder Pegeländerung die Spitze neu messen.

## Viele Ereignisse dicht hintereinander

Poppen 30 Kacheln innerhalb von 22 Frames auf, wird ein Klick je Kachel zum Rattern. Nach Zeit ausdünnen, nicht nach Nummer:
die Ereignisse nach ihrem Frame sortieren und höchstens alle 4 Frames eines klicken lassen. Das bleibt richtig, wenn sich
Anzahl oder Reihenfolge der Kacheln ändert.

## Sitzt jede Cue auf ihrem Frame?

Die Nur-Effekte-Spur rendern und für jede Cue die aufbereitete Datei per Kreuzkorrelation im Render suchen (Fenster ±80 ms um
die erwartete Stelle). Liegt der Treffer innerhalb ±2 ms, sitzt die Cue. Zwei Fallen:

- Sehr leise Cues fallen unter jede Schwelle. Das ist dann eine Grenze der Messung, kein Positionsfehler: die gefundene Stelle
  prüfen, nicht nur „gefunden/nicht gefunden“.
- Direkt neben einem lauten Sound (ein Schlag, ein Auslöser mit Ausklang) trifft die Korrelation den lauten Nachbarn. Solche
  Cues im Bericht als „nicht einzeln nachweisbar“ nennen statt als Fehler oder als bestanden.

## Musik

- Den Einstieg so wählen, dass ein Schlag auf das wichtigste Wort fällt, und ihn aus der Wortzeit berechnen (Songstelle minus
  Wortzeit). Kommt ein neuer Take, bleibt der Schlag auf dem Wort.

```bash
python3 edit-tools/beat_align.py <song.wav> beispiel/src/timing.ts <wort> --auch <wort>,<wort>
```

- Bei 172 BPM liegen die Schläge 348 ms auseinander; ein beliebiger Schnitt liegt im Mittel knapp 90 ms daneben. Schnitte, die
  am Voiceover hängen, treffen den Beat nur zufällig. Sagen, welche sitzen und welche nicht, statt „beatgenau“ zu behaupten.
- Bewährtes Muster aus Werbefilmen: kurz vor dem Höhepunkt die Musik wegnehmen und sie genau auf einem Schnitt zurückbringen.
  In einem vermessenen 4-Minuten-Spot waren das rund 7 Sekunden Stille (etwa 3 % der Länge), direkt gefolgt vom lautesten
  10-Sekunden-Block. Auf 16 Sekunden übertragen ist das etwa eine halbe Sekunde.
- Eine Tonhöhen-Variante als eigene Datei backen, nicht über das Abspieltempo im Video: Vorschau und Render behandeln die
  Tonhöhe verschieden, die gebackene Datei klingt in beiden gleich.

## Fallen beim Messen fremder Videos

- Ein Detektor für hohe Impulse („Klick auf dem Schnitt?“) schlägt auch bei Sprachkonsonanten an. Bei anderthalb Treffern pro
  Sekunde und ±120 ms Fenster liegen schon aus Zufall rund 30 % der Schnitte „auf einem Impuls“. Ein Wert von 40–50 % belegt
  dann nichts. Erst Stimme, Musik und Rest trennen, dann zählen.
- Wortzeiten aus einer Spracherkennung können mehrere hundert Millisekunden danebenliegen. Wörter nach einer Sprechpause am
  gemessenen Einsatz ausrichten (das macht `tonstudio/vo/`), den Rest am Spektrogramm stichprobenartig prüfen.

## Zwei Agenten an einer Datei

Was in der Praxis einen Beinahe-Verlust verhindert hat: Jede Änderung prüft direkt vor dem Schreiben die Prüfsumme und bricht
ab, wenn sie nicht passt. Danach geht die neue Prüfsumme mit zwei Sätzen an die andere Session (was geändert wurde, was
unberührt blieb). Wer einen größeren Umbau vorhat, kündigt ihn an und nennt die Namen, an denen fremde Teile hängen.
