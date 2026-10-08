# Kurzvideo-Erfahrungen: Skript, Stimme, Raumklänge, Bildbausteine, Formate

Erfahrungen vom 08.10.2026 aus der Arbeit an Kurzvideos von rund 13 Sekunden: Voiceover, Musik, rund 25 Sound-Cues und
Raumklänge, an einem Tag mehrfach nach Gehör korrigiert. Das Dokument ergänzt
[`ton-und-text-sync.md`](ton-und-text-sync.md) (Text-Vorlauf, Lautstärke gegen die Musik, Sitz der Cues), das hier nicht
wiederholt wird. Zu jedem Punkt steht, was sich bewährt hat, warum, und woran man es prüft. „Nach Gehör“ heißt: Der Mensch,
der das Video abnimmt, hat gehört und entschieden. Messwerte zeigen, dass sich etwas verändert hat, nicht dass es besser klingt.

## 1. Erst das Skript, dann der Schnitt

Beim Einsprechen ändert sich der Wortlaut mehrfach: Wörter fallen weg, ein Halbsatz wird besser, eine Zahl wird anders genannt.
Alles, was am Wortlaut hängt, muss mitziehen. Wer vorher schneidet, schneidet mehrfach.

- **Den Teleprompter nach jeder Änderung sofort nachziehen.** `skript.json` ist Teleprompter-Text und Zuordnung der Schlüssel
  zugleich. Wird anders gesprochen, als dort steht, bricht `npm run vo` bei abweichender Wortzahl ab; das ist der Schutz, kein
  Fehler. Steht der neue Wortlaut sofort im Skript, liest der Mensch beim nächsten Durchgang ihn ab.
- **Einen Take immer erst mitschreiben, bevor er eingesetzt wird.** Der gesprochene Wortlaut gilt, nicht das Skript. Eine
  Mitschrift per Spracherkennung zeigt, was wirklich auf der Aufnahme steht:

  ```bash
  whisper-cli -m <modell> -f recordings/<take>.wav -l de -otxt
  ```

- **Der Text im Bild folgt dem gesprochenen Wortlaut.** Das gilt für Wörter genauso wie für Zahlen: Die Zahl, auf die ein
  Zähler im Bild läuft, ist ein Prop (`counterTo`) und kein fester Wert im Code, damit sie mit dem Take wandert.

**Prüfen:** Jeden Wort-Text im Bild neben die Mitschrift des eingesetzten Takes legen (Einzelbild rendern und ablesen), dazu die
Zeilen „uneinig“ und „GESCHÄTZT“ der `vo`-Tabelle ansehen.

## 2. Aufnahme: ganze Stücke, dann zusammensetzen

- **Den ganzen Text mehrmals in einem Stück sprechen.** Bei einem Versprecher nicht anhalten und korrigieren, sondern neu
  ansetzen und weitersprechen. Der Fluss bleibt erhalten, und am Ende gibt es mehrere vollständige Durchgänge.
- **Aus den sauberen Stücken zusammensetzen.** Etwa die Zeilen 1 bis 2 aus dem zweiten und die Zeilen 3 bis 4 aus dem ersten
  Durchgang. Die Schnitte gehören in Sprechpausen, dort stört kein Wortanfang, und die Wortzeiten rasten an Pausen ein:

  ```bash
  npm run vo -- recordings/take-a.wav:0:3800 recordings/take-b.wav:1740:-1
  ```

- **Lange Einzelaufnahmen im Browser vermeiden.** Die Aufnahme-Seite hält den Take im Arbeitsspeicher des Tabs und schreibt ihn erst
  beim Stopp nach `recordings/`. Stürzt der Tab ab oder lädt er neu, bevor gestoppt wurde, ist alles weg. Besser viele kurze
  Durchgänge, jeder mit Stopp.

**Prüfen:** Nach jedem Durchgang liegt eine neue Datei in `recordings/`. Nach dem Zusammensetzen die Übergänge anhören (kein
abgeschnittener Atem, kein halbes Wort) und festhalten, welcher Take für welche Zeilen verwendet wurde.

## 3. Tempo: Sprechpausen kürzen

Bei rund 13 Sekunden zählt jede Pause. Gekürzt wurde so:

- Sprechpausen zwischen den Phrasen auf **0,08 bis 0,12 s**.
- Vorlauf vor dem ersten Wort **2 Bilder** (67 ms), der Ausklang nach dem letzten Wort kurz (`ausklangMs` in `skript.json`).
- Beispiel in Zahlen: **13,3 s → 11,4 s**, rund 14 % kürzer.

Ein eigenes Werkzeug zum Kürzen liegt im Kit nicht. Geschnitten wird an den gemessenen Pausen, jeweils mit kurzen Blenden; die
Pausen misst `tonstudio/vo/align.py` (ab 120 ms), grob geht es auch mit ffmpeg:

```bash
ffmpeg -i voiceover.wav -af silencedetect=n=-45dB:d=0.05 -f null - 2>&1 | grep silence_duration
```

Jede Zeile ist eine Pause mit Dauer; die erste ist der Vorlauf, die letzte der Ausklang. Die Schwelle (−45 dB) hängt vom
Raumrauschen der Aufnahme ab und gehört einmal nach Gehör eingestellt.

**Beachten:** `align.py` zählt Lücken erst ab 120 ms als Sprechpause. Pausen von 0,08 bis 0,12 s liegen an dieser Grenze, das Einrasten
auf gemessene Einsätze hat danach weniger Anker. In der `vo`-Tabelle die Zeilen ohne ● und mit „GESCHÄTZT“ oder „uneinig“ ansehen.

**Danach neu ausrichten.** Mit dem Kürzen verschieben sich alle Wortzeiten. Die alte `timing.ts` passt nicht mehr zur neuen
Aufnahme: `npm run vo` mit dem gekürzten Take noch einmal laufen lassen. Bild, Text und Cues hängen an dieser Tabelle und wandern
mit, sobald sie stimmt. Behält man mehrere Fassungen der Stimme, gehören Datei und Zeit-Tabelle paarweise zusammen: Ein
Kommentar neben dem Prop `voiceover` sagt, welche Datei zu welcher Tabelle passt. Eine Fassung mit den alten, längeren Pausen
passt nur zur gesicherten alten Tabelle.

**Prüfen:** Länge vor und nach (`ffprobe -v error -show_entries format=duration -of csv=p=0 <datei>`), Pausenliste mit
`silencedetect`, im Studio die neue Länge, ein Einzelbild auf einem betonten Wort (Frame = Millisekunden × 0,03).

## 4. Stimme: drei Wünsche nacheinander

Die Stimme wurde in drei Runden nach Gehör verändert, immer aus denselben Stücken neu aufbereitet:

| Wunsch | Eingriff | erwartete Wirkung |
|---|---|---|
| „tiefer“ | Anhebung um 140 Hz (im Kit: `--kette tief`, +5 dB bei 140 Hz, siehe `tonstudio/vo/master.py`) | mehr Körper |
| „glatter, sauberer“ | Rauschminderung; Absenkung bei 4 kHz und 6,5 kHz; Höhen insgesamt leicht zurück | weniger Zischeln und Rauheit, die Stimme wird dumpfer |
| „mehr Klarheit“ | untere Mitten um 280 Hz −3 dB; Präsenz um 2,8 kHz +2,5 dB; schmale Absenkung bei 4,2 kHz; Höhen leicht +1,5 dB | Sprache wird verständlicher, aber wieder heller |

**Ehrlich dazu:** Glätten und Klarheit ziehen in entgegengesetzte Richtungen. Das Glätten nimmt Höhe weg, die Klarheit gibt sie
(teils) wieder her. Es gibt keine Einstellung, die beides ganz erfüllt; die Fassung wählt der Mensch nach Gehör. Die Ketten
„glatter“ und „klarer“ sind nicht im Kit, nur die Werte oben.

**Messbar machen:** Mittlere Pegel je Frequenzband vorher und nachher vergleichen, und zwar bei **gleicher Lautheit**
(−14 LUFS, wie `master.py` sie herstellt). Sonst wirkt jede lautere Fassung „klarer“. Ein Messwerkzeug in zwanzig Zeilen
(numpy und ffmpeg), getestet an Rauschen mit bekannter Anhebung:

```python
import subprocess
import numpy as np

SR = 48000
BAENDER = [(100, 200), (200, 400), (400, 800), (800, 1600), (1600, 3200), (3200, 6400), (6400, 12800)]


def lade(pfad):
    """Datei als Mono-Folge von Abtastwerten (ffmpeg dekodiert beliebige Formate)."""
    roh = subprocess.run(["ffmpeg", "-v", "error", "-i", pfad, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.float32).astype(np.float64)


def baender_db(y):
    """Mittlerer Pegel je Frequenzband in dB (50-ms-Blöcke, leise Blöcke ausgelassen)."""
    n = SR // 20
    blocks = y[: len(y) // n * n].reshape(-1, n) * np.hanning(n)
    blocks = blocks[(blocks ** 2).mean(axis=1) > 1e-6]  # Pausen und Rauschteppich zählen nicht mit
    p = (np.abs(np.fft.rfft(blocks, axis=1)) ** 2).mean(axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    return [10 * np.log10(p[(f >= a) & (f < b)].sum() + 1e-20) for a, b in BAENDER]


vor, nach = baender_db(lade("vor.wav")), baender_db(lade("nach.wav"))
for (lo, hi), x, y in zip(BAENDER, vor, nach):
    print(f"{lo:>5}-{hi:<5} Hz  {y - x:+5.1f} dB")
```

Eine breite Anhebung verteilt sich über Nachbarbänder: Bei +6 dB bei 2,8 kHz und −6 dB bei 280 Hz (beide Q = 1) zeigte die Messung
+4,7 dB im Band 1,6 bis 3,2 kHz und −5,0 dB im Band 200 bis 400 Hz. Die Richtung stimmt, die Höhe nicht auf das dB.

## 5. Geräusche: was nach Gehör durchfiel und was blieb

| Geräusch | Einsatz | Urteil |
|---|---|---|
| Kamera-Auslöser (`shutterInsta1/2`) | als Übergang auf Schnitten und beim Erscheinen eines Clips | **durchgefallen**: „passt nirgendwo rein“. Auf Schnitten liegt jetzt Papier (`page1`, `page3`) |
| schnelle Klappen-Folgen (`flapBurst3`, `flapBurst8`, Klapptafel-Serien) | auf Zahlen und Fragezeichen | **durchgefallen**: Die Reihe klingt wie ein mehrfacher Auslöser („Shutter, Shutter, Shutter“). Entfernt; bei einer wachsenden Mauer genügt ein einzelnes Blättern statt einer Klappe je Reihe |
| ein einzelnes Blättern (`riffle1`) | auf einem durchblätternden Kalender | **bestätigt**: „sehr clean“ |

**Regel:** keine schnellen mechanischen Wiederholungen. Viele gleiche Einzelklänge in kurzer Folge hört das Ohr als Maschine
(Auslöser-Serie, Klappen-Reihe), nicht als Bewegung. Läuft im Bild etwas weiter, lieber **einen** durchgehenden Klang darunter
legen als einen je Schritt. Der Auslöser bleibt ein Geräusch für ein Foto, das erscheint; als Übergang und beim Einblenden eines
Videoclips hat er nicht getragen. Das schränkt die Liste „Was wofür funktioniert“ in
[`../edit-tools/README.md`](../edit-tools/README.md#ablauf-3-sound-design) ein.

**Prüfen:** Die Cue-Liste hat Namen („Papier · Schnitt auf die Blase“): Rückmeldungen nach Gehör kommen als Namen oder
Kategorien und lassen sich so ohne Suchen umsetzen. Nach dem Entfernen die Nur-Effekte-Spur neu rendern und die Lücken ansehen
(`ton_check.py`), damit an der Stelle nicht plötzlich Stille ist.

## 6. „Immersiv“, ohne aufdringlich zu werden

Das fertige Ergebnis wurde als „super super gut“ bestätigt. Zwei Schichten tragen es: **leise Raumklänge unter jeder Szene** und
**thematische Einzelgeräusche** an einzelnen Wörtern oder Bildern.

### Raumklänge aus dem eigenen Material

- Wind unter Außenaufnahmen, Stimmengewirr unter einer Menschenmenge. Die Klänge stammen aus den **eigenen Clips** des Projekts:
  Das passt zum Bild und braucht keine Lizenz. Eben deshalb liegen sie nicht im Sound-Kit und nicht in diesem Repo; die Bausteine
  zum Abspielen (unten) schon.
- **Ruhige Stellen per Pegel suchen**, nicht nach Gefühl: den Pegel je halbe Sekunde berechnen und Abschnitte nehmen, in denen er
  kaum schwankt (keine Sprache, kein Schlag):

  ```python
  def ruhige_stuecke(y, min_halbsek=4, max_schwankung_db=3.0):
      """Startzeiten (s) und Pegel (dBFS) von Abschnitten, in denen der RMS-Pegel je halbe Sekunde kaum schwankt."""
      n = SR // 2
      blocks = y[: len(y) // n * n].reshape(-1, n)
      pegel = 20 * np.log10(np.sqrt((blocks ** 2).mean(axis=1)) + 1e-9)
      out = []
      for i in range(len(pegel) - min_halbsek + 1):
          w = pegel[i : i + min_halbsek]
          if w.max() - w.min() <= max_schwankung_db:
              out.append((i / 2, round(float(w.mean()), 1)))
      return out
  ```

  (`SR`, `lade` und `np` wie im Beispiel oben; getestet an Rauschen mit einem eingefügten Knall: Die Fenster mit dem Knall fehlen.)
- **Mit Spracherkennung prüfen, dass kein Wort verständlich ist.** Eine Menschenmenge darf nach Stimmen klingen, aber niemand soll
  zu verstehen sein. Die Mitschrift des Stücks (`whisper-cli … -otxt`) sollte leer sein. Spracherkennung erfindet bei Rauschen
  manchmal Wörter: Ein „Treffer“ heißt dann Nachhören, nicht automatisch Verwerfen.

### Thematische Einzelgeräusche

| Bild oder Wort | Geräusch |
|---|---|
| Tippen unter dem Wort „engineer“ | `typeBurst1` (Tastatur, 2,1 s), auf die Länge des Abschnitts begrenzt |
| Münze auf einer Geldsumme | `coinCup1` (Münze fällt in eine Tasse) |
| Aufzieh-Ton, der endet, wenn die hochlaufende Zahl ankommt | `riser1`, die lauteste Stelle (`lead`) auf dem Frame, auf dem die Zahl ihr Ziel erreicht |
| Eine Karte erscheint | `cardPlace1`, die Karte „landet“ auf dem Geräusch |
| kleine Bewegung (etwa ein Sprung) | `swishSmall`, sehr leise: ein Luftzug, kein Whoosh |

Die beiden neuen Kit-Sounds `typeBurst1` und `coinCup1` sind aus den Kandidaten `type_burst_macbook_01.wav` und
`sparkle_coin_cup_01.wav` entstanden (Quelle und Lizenz in `sfx-kandidaten/manifest.tsv`).

### Bausteine und ein eigener Regler

Raumklänge sind Dauerklänge und verhalten sich im Mix anders als Einzelschläge. Sie bekommen deshalb einen **eigenen
Lautstärke-Regler** (`atmoVolume`, 0 = aus), getrennt von `sfxVolume`. „Alle Geräusche etwas lauter“ hebt dann nicht den Wind, und
mit 0 lässt sich Vorher und Nachher direkt hören.

```tsx
const TON = "ton/"; // Ordner unter public/ mit den Raumklängen und Zusatz-Geräuschen
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Leiser Raumklang unter einem Abschnitt, mit kurzer Ein- und Ausblende. startSec = Stelle in der Datei. */
const Bed: React.FC<{ from: number; frames: number; file: string; startSec: number; vol: number; fade?: number; name: string }> = ({ from, frames, file, startSec, vol, fade = 4, name }) => (
  <Sequence from={from} durationInFrames={frames} layout="none" name={`Atmo · ${name}`}>
    <Audio src={staticFile(TON + file)} trimBefore={Math.round(startSec * 30)} volume={(fr) => vol * interpolate(fr, [0, fade, frames - fade, frames], [0, 1, 1, 0], clamp)} />
  </Sequence>
);

/** Einzelnes Geräusch; frames begrenzt die Länge, die letzten 3 Frames blenden aus (auch für Kit-Sounds, z. B. "sfx/typeBurst1.wav"). */
const Extra: React.FC<{ at: number; frames: number; file: string; vol: number; name: string }> = ({ at, frames, file, vol, name }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={frames} layout="none" name={`Ton · ${name}`}>
    <Audio src={staticFile(file)} volume={(fr) => vol * interpolate(fr, [frames - 3, frames], [1, 0], clamp)} />
  </Sequence>
);
```

Eingesetzt wird beides hinter der Cue-Spur, jeweils nur bei `atmoVolume > 0`:

```tsx
{atmoVolume > 0 ? (
  <>
    <Bed from={start(0)} frames={len(0)} file="wind.wav" startSec={1} vol={0.75 * atmoVolume} name="draußen (Szene 1)" />
    <Extra at={pop(w.sum)} frames={19} file="sfx/coinCup1.wav" vol={0.07 * atmoVolume} name="Münze · Summe" />
  </>
) : null}
```

### Prüfung

Geräusche allein und Musik allein rendern und **je Szene vergleichen**, dazu der Gesamtmix:

```bash
npx remotion render Demo sfx.wav --codec=wav --props='{"voVolume":0,"music":""}'
npx remotion render Demo musik.wav --codec=wav --props='{"voVolume":0,"sfxVolume":0,"music":"<song.wav>"}'
python3 edit-tools/ton_check.py sfx.wav --musik <song.wav> --musik-start <s> --musik-vol 0.15 --mix mix.wav
```

Die Raumklänge zählen in der Geräusch-Spur mit, solange `atmoVolume` nicht 0 ist. Gemessen im Projekt: Die Geräusche blieben in
jeder Szene **4 bis 21 dB unter der Musik**; zusammen lagen sie bei etwa **−34,6 LUFS**, die Musik bei **−25,8 LUFS**, der Gesamtmix
bei **−14,5 LUFS**. Das passt zur Regel „Effekte nie lauter als die Musik“ ([`../sfx-kit/README.md`](../sfx-kit/README.md)); die Lücke
von rund 9 dB zwischen Geräuschen und Musik im Ganzen passt dazu, dass nichts aufdringlich klang.

## 7. Bild-Bausteine, die sich bewährt haben

Gleicher Look in allen Szenen (weiße Fläche, große Schrift, ein Rot), jede Bewegung an eine Wortzeit gehängt (`pop()` und
`start()` wie in [`../beispiel/src/Demo.tsx`](../beispiel/src/Demo.tsx)). Der Text steht 3 Bilder (100 ms) vor dem Wort voll da,
siehe [`ton-und-text-sync.md`](ton-und-text-sync.md).

- **Eine Zahl, groß und rot.** Die Wort-DSL genügt: `{ ms: w.sum, text: "€100", font: "sans", size: 350, weight: 900, color: RED }`. Die Zahl
  in extrafetter Schrift ist der Blickfang der Szene.
- **„Welt“-Fläche, aus der die Kamera herausfährt.** Erst ein Detail in voller Größe (ein Kreis, gefüllt mit Kacheln), dann fährt
  die Kamera heraus und zeigt die Menge ringsum. Erst Detail, dann Menge: Das Detail ist lesbar, solange es groß ist, und die Menge zeigt danach, wie viele es sind.
- **Hochlaufende Zahl mit Plus am Ziel**, schnell los und langsam an.
- **Abreißkalender**, der Monate durchblättert (ein Zeitsprung in einem Bild).
- **Handgezeichneter Pfeil.** Der Pfad zeichnet sich über `strokeDashoffset`, ein leichtes Zittern kommt von einem
  SVG-Filter mit wechselndem `seed`, ein weißer Rand hält den Strich über Video lesbar.

Alle Zeitangaben in den Ausschnitten sind Frames bei 30 fps; `RED` und `FONTS` kommen aus dem Projekt. Die Ausschnitte sind
verallgemeinert (ohne die Texte, Bilder und Namen des Originals) und mit `tsc` gegen Remotion 4.0.532 geprüft.

### Zufall ohne `Math.random`

Remotion rendert jeden Frame einzeln. `Math.random()` liefert dann in jedem Frame andere Werte, die Menge ringsum würde flimmern.
Ein kleiner Zufallsgenerator mit festem Startwert (`seed`) liefert dieselbe Folge in jedem Frame:

```tsx
const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
```

### Welt mit Zoom-out

```tsx
/** Eine große Fläche, deren Nullpunkt die Mitte des Details ist. Die Kamera zeigt sie erst in voller Größe und fährt ab `zoomAt` heraus;
 *  danach driftet sie noch langsam weiter, damit das Bild nicht einfriert. */
const World: React.FC<{ zoomAt: number; frames: number; centre: { x: number; y: number }; detail: React.ReactNode; crowd: React.ReactNode }> = ({ zoomAt, frames, centre, detail, crowd }) => {
  const frame = useCurrentFrame();
  const ZOOM = { to: 0.5, drift: 0.45, frames: 24 };
  const out = interpolate(frame, [zoomAt, zoomAt + ZOOM.frames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drift = interpolate(frame, [zoomAt + ZOOM.frames, frames], [0, 1], clamp);
  const scale = 1 + (ZOOM.to - 1) * out + (ZOOM.drift - ZOOM.to) * drift;
  const crowdOpacity = interpolate(frame, [zoomAt - 2, zoomAt + 5], [0, 1], clamp); // die Menge erscheint kurz vor der Fahrt
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: centre.x, top: centre.y, width: 0, height: 0, transform: `scale(${scale})` }}>
        <div style={{ opacity: crowdOpacity }}>{crowd}</div>
        {detail}
      </div>
    </div>
  );
};
```

Die Menge ringsum ist ein Raster (jede zweite Reihe um eine halbe Zelle versetzt), in dem alle Zellen im Detail ausgelassen
werden. Sie wird einmal beim Laden mit `rng` erzeugt:

```tsx
const CELL = 150;
const CROWD_CELLS = (() => {
  const r = rng(11);
  const out: { x: number; y: number; ask: number | null }[] = [];
  for (let gy = -12; gy <= 13; gy++)
    for (let gx = -10; gx <= 10; gx++) {
      const x = gx * CELL + (gy % 2 ? CELL / 2 : 0);
      const y = gy * CELL;
      const ask = r() < 0.45 ? 6 + Math.floor(r() * 20) : null; // Frame (nach dem Zoom-Start), an dem ein Fragezeichen aufpoppt
      if (Math.hypot(x, y) < 425 + 90) continue; // nichts im Detail und nichts direkt am Rand
      out.push({ x, y, ask });
    }
  return out;
})();
```

Eine Kachel im Detail blendet in 5 Frames ein und bleibt dann ruhig. Fehlt die Bilddatei, steht der Name als Text da, damit das
Video auch mit unvollständigem Material baut:

```tsx
const Cell: React.FC<{ name: string; file?: string; x: number; y: number; w: number; h: number; at: number }> = ({ name, file, x, y, w, h, at }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", opacity: t, transform: `scale(${0.86 + 0.14 * t})` }}>
      {file ? <Img src={staticFile(file)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ whiteSpace: "nowrap", fontSize: 30 }}>{name}</span>}
    </div>
  );
};
```

### Hochlaufende Zahl und Kalender

```tsx
/** Zahl, die zwischen den Frames `from` und `to` von a auf b läuft (schnell los, langsam an) und am Ziel ein Plus bekommt. */
const Counter: React.FC<{ from: number; to: number; a: number; b: number }> = ({ from, to, a, b }) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const t = interpolate(frame, [from, to], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const value = Math.round((a + (b - a) * t) / 10) * 10; // in Zehnerschritten: Einer wären zu schnell zum Lesen
  return (
    <div style={{ color: RED, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
      €{value.toLocaleString("en-US")}
      {frame >= to ? "+" : ""}
    </div>
  );
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** Abreißkalender: blättert in `frames` Frames `steps` Monate weiter, ab Monat `startMonth` (0 = Januar) im Jahr `startYear`. */
const Calendar: React.FC<{ frames: number; steps: number; startMonth: number; startYear: number }> = ({ frames, steps, startMonth, startYear }) => {
  const frame = useCurrentFrame();
  const step = Math.floor(interpolate(frame, [2, Math.max(3, frames - 4)], [0, steps], clamp));
  const month = (startMonth + step) % 12;
  const year = startYear + Math.floor((startMonth + step) / 12);
  const tilt = step > 0 && step < steps ? (frame % 2 === 0 ? -7 : 5) : 0; // jedes Blatt kippt kurz nach vorn, solange geblättert wird
  return (
    <div style={{ perspective: 1200 }}>
      <div style={{ transform: `rotateX(${tilt}deg)`, transformOrigin: "50% 0%" }}>
        <div style={{ background: RED, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{year}</div>
        <div>{MONTHS[month]}</div>
      </div>
    </div>
  );
};
```

Der Ton dazu: **ein** Blättern (`riffle1`) unter dem ganzen Durchlauf, nicht ein Klick je Monat (siehe Abschnitt 5). Der Zähler hat
sein Ziel auf dem Frame `to`; dorthin gehört die lauteste Stelle des Aufzieh-Tons (`riser1` mit `lead`).

### Handgezeichneter Pfeil

```tsx
/** Die Linie zeichnet sich ab Frame `at` in `draw` Frames (pathLength 1, strokeDashoffset 1 → 0), danach die Spitze.
 *  Der Filter lässt den Strich zittern: feTurbulence + feDisplacementMap, der seed wechselt alle 4 Frames.
 *  Der weiße Rand (breiterer Strich darunter) hält den Pfeil über einem Clip lesbar. */
const HandArrow: React.FC<{ at: number; path: string; head: string; draw?: number }> = ({ at, path, head, draw = 13 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const line = interpolate(frame, [at, at + draw], [1, 0], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const tip = interpolate(frame, [at + draw - 1, at + draw + 4], [1, 0], clamp);
  const seed = Math.floor(frame / 4) % 3;
  const stroke = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <defs>
          <filter id="hand" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={seed + 3} />
            <feDisplacementMap in="SourceGraphic" scale="9" />
          </filter>
        </defs>
        <g filter="url(#hand)">
          <path d={path} stroke="#fff" strokeWidth={22} strokeDashoffset={line} {...stroke} />
          <path d={head} stroke="#fff" strokeWidth={22} strokeDashoffset={tip} {...stroke} />
          <path d={path} stroke={RED} strokeWidth={11} strokeDashoffset={line} {...stroke} />
          <path d={head} stroke={RED} strokeWidth={11} strokeDashoffset={tip} {...stroke} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
```

Der Pfeil beginnt, sobald das Wort steht, auf das er zeigt (`at` aus der Wortzeit plus ein paar Frames). Der Pfad führt an Text vorbei,
der darüber liegt, und endet im Bild, auf das er zeigt; im Beispielprojekt liegt die einfachere Fassung ohne Zittern als `Squiggle`.

**Prüfen:** Pro Baustein Einzelbilder an Anfang, Mitte und Ende der Bewegung rendern und ansehen (`npx remotion still … --frame=N`).
Beim Zoom-out auf Ränder achten (leerer Bereich am Bildrand), beim Pfeil auf Lesbarkeit über dem Clip, beim Zähler darauf, dass
die Endzahl die gesprochene ist.

## 8. Formate, die bei kleinen Konten weit über die Followerzahl liefen

Aus einer Auswertung von Instagram-Reels (Stand 08.10.2026): Gesucht waren Reels, die bei kleinen Konten weit über die
Followerzahl hinaus liefen, um ihre Bauart zu übernehmen. Ein Beispiel für die Größenordnung: ein Konto mit **rund 1.400 Followern
und 1,9 Mio. Aufrufen** bei einem Reel von 11 Sekunden. Als Muster, ohne Konten:

| Muster | Bauart (knapp) |
|---|---|
| ein Bild, eine Zeile, lange Beschreibung | ein einzelnes Bild, eine Zeile Text im Bild, dazu eine lange Beschreibung |
| Uhrzeiten über Clips | Uhrzeiten als Text über kurzen Clips |
| Liste in schnellen Schnitten | eine Liste, deren Punkte in schnellen Schnitten nacheinander kommen |
| „Tag 1“-Serien | der erste Teil einer Serie, die mit „Tag 1“ beginnt |
| Alter und Geständnis | eine Altersangabe und ein persönliches Eingeständnis im Text |

Die Spalte „Bauart“ fasst die Muster knapp zusammen; wie sie im Einzelnen aussehen, zeigt erst ein Blick auf die Videos selbst.

Gemeinsam war fast allen: **6 bis 16 Sekunden und kein Sprecher**. Das Kit baut auf Voiceover und Wortzeiten; diese Formate kommen
ohne Sprecher aus. Ob ein Voiceover bei ihnen hilft oder schadet, zeigt die Auswertung nicht.

**Grenzen der Auswertung, ehrlich:**

- **Gerundete Zahlen.** Die Plattform zeigt Aufrufe und Follower gerundet („307K“); Verhältnisse sind Größenordnungen.
- **Followerzahl von heute.** Wie viele Follower das Konto beim Posten hatte, ist unbekannt. Bei seither gewachsenen Konten war das
  Verhältnis damals höher als berechnet.
- **Auswahl der Plattform.** Die Reels kamen aus Themenseiten und einer Suche, also aus dem, was die Plattform zeigt. Konten mit
  geringer Reichweite fehlen zwangsläufig: Das ist eine Auswahl der Erfolgreichen, kein Vergleich mit den Erfolglosen.
- **Kleine Stichprobe, nur Instagram.** Angesehen und mitgeschrieben wurde rund ein Dutzend Reels, die Bauart wurde an
  Kontaktbögen und Mitschriften abgelesen. Zusammenhang ist kein Beweis, dass das Format die Reichweite verursacht hat.
- **Aufrufe sind keine Follower.** Wie viele neue Follower ein solches Reel brachte, ist nicht erhoben.
- **Folgeteile einer Serie** wurden nicht untersucht, nur der erste Teil.

Daraus folgt: als Ausgangspunkt für eigene Tests nehmen, nicht als Rezept. Je Runde eine Sache ändern und mindestens 72 Stunden
warten ([`recherche-2026-10.md`](recherche-2026-10.md), Abschnitt 5).

## 9. Zusammenarbeit mehrerer Agenten an einem Projekt

Die Regeln zu Prüfsumme und Meldung stehen in [`ton-und-text-sync.md`](ton-und-text-sync.md) und [`../AGENTS.md`](../AGENTS.md).
Dazu kam an diesem Tag:

- **Ein Schreiber je Datei, md5 vor dem Schreiben** (`md5 -q <datei>`, dann `patch_lines.py` oder `sync_remotion.py` mit dem md5).
- **Geteilte Bausteine nur nach Absprache ändern.** Importiert eine zweite Komposition Bausteine, Konstanten oder Props-Typen aus
  der Datei der ersten (hier etwa Clip-Rahmen, Rot und Text-Vorlauf), verschiebt jede Änderung dort auch das andere Video. Wer so
  eine Datei anfassen will, sagt es vorher und nennt die Namen, an denen Fremdes hängt.
- **Zusammengehörige Dateien in einem Schritt übertragen.** Zeit-Tabelle und Voiceover-Datei, Cue-Liste und Sound-Dateien,
  Komposition und Props gehören zusammen. Kommt die neue Tabelle vor der neuen Aufnahme an (oder umgekehrt), zeigt das Studio
  falsch ausgerichtete Wörter, und niemand sieht gleich, warum. Ein `rsync` über alle betroffenen Pfade in **einem** Aufruf, danach
  die Prüfsummen auf beiden Seiten vergleichen.

**Prüfen:** Nach der Übertragung `md5 -q` der Dateien auf beiden Rechnern, Studio neu laden, Einzelbild auf einem betonten Wort.
