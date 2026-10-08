// Zeitplan, Texte und Ton des Films. Jede Zeit steht genau einmal hier: Bild (Ablauf.tsx) und Ton (CUES unten) lesen dieselben
// Konstanten. Verschiebt man einen Schritt, wandern seine Sounds mit – dasselbe Prinzip wie die Wortzeiten im Kit.
import katalog from "./sounds.json";

export const FPS = 30;
export const W = 1920;
export const H = 1080;
/** Sekunden → Frames */
export const f = (sec: number) => Math.round(sec * FPS);

/** Wortzeiten des Beispielvideos in ms (Szene 1 aus example/src/timing.ts). */
export const WORT = { thisIs: 300, yourHook: 800, hello: 1450 } as const;
/** So lang läuft der Ausschnitt, den das Handy am Ende abspielt (ms). */
export const TAKE_MS = 2600;
/** Die Welle in Karte 1 zeigt die ersten 2100 ms der Aufnahme; ihre drei Stücke beginnen bei den Wortzeiten. */
export const WELLE_MS = 2100;
export const WELLE_STUECKE = [WORT.thisIs, WORT.yourHook, WORT.hello];
/** Text steht zum Wort voll da: Das Einblenden dauert 3 Frames und beginnt deshalb 3 Frames früher. */
export const VORLAUF = 3;

/** Beginn der fünf Schritte (Sekunden). */
const S = [3.0, 9.2, 13.8, 19.2, 24.4];

export const T = {
  /** Titel: zweite Zeile, Ausblenden, Spalten erscheinen */
  titel2: 0.7,
  titelAus: 2.0,
  spalten: 2.3,
  schritt: S,
  /** So lange „spricht“ der Mensch je Schritt (die Wörter der Sprechblase erscheinen in dieser Zeit). */
  sprechen: [1.4, 0.9, 1.0, 0.9, 0.6],
  /** Karte des Schritts wird aktiv / bekommt ihren Haken */
  aktiv: [S[0] + 1.5, S[1] + 1.0, S[2] + 1.1, S[3] + 1.0, S[4] + 0.7],
  fertig: [S[0] + 5.4, S[1] + 3.6, S[2] + 4.3, S[3] + 4.3, S[4] + 3.1],
  // 1 Voiceover: Aufnahme an, Welle wächst, Stopp, drei Wortmarken
  rec: S[0] + 1.6,
  welleVon: S[0] + 1.7,
  welleBis: S[0] + 3.2,
  stopp: S[0] + 3.3,
  marke: [S[0] + 3.8, S[0] + 4.3, S[0] + 4.8],
  // 2 Clips: drei Vorschaubilder, eines wird gewählt und fliegt in den Slot im Handy
  bilder: S[1] + 1.1,
  wahl: S[1] + 1.9,
  flugVon: S[1] + 2.2,
  flugBis: S[1] + 2.8,
  // 3 Sounds: vier Cues fallen nacheinander auf ihre Stelle (Clip, this is, your hook, hello)
  cue: [S[2] + 1.5, S[2] + 2.05, S[2] + 2.6, S[2] + 3.15],
  // 4 Export: das Handy spielt den Ausschnitt ab, der Pegel läuft auf −14 LUFS, zwei Dateien
  abspielen: S[3] + 1.3,
  pegelBis: S[3] + 3.4,
  datei: [S[3] + 3.6, S[3] + 3.8],
  // 5 Post: Entwurf, Freigabe, veröffentlicht
  stufe: [S[4] + 1.0, S[4] + 1.7, S[4] + 2.4],
  /** Schluss */
  schluss: 28.6,
  schluss2: 29.5,
  schluss3: 29.8,
  ende: 32.4,
};
export const FRAMES = f(T.ende);

export const TEXT = {
  marke: "shortform-edit-kit",
  titel: ["Ein Kurzvideo bauen,", "indem du mit deinem Agenten sprichst."],
  spalten: ["Du sagst", "Der Agent macht", "Das Video"],
  /** Was der Mensch sagt, je Schritt */
  sagt: ["Hier ist mein Skript. Ich spreche es ein.", "Nimm den Clip von gestern.", "Leg Sounds drunter. Nur echte.", "Mach es fertig für den Post.", "Passt. Poste es."],
  /** Was der Agent zurückmeldet, je Schritt */
  meldet: ["Wortzeiten gemessen → timing.ts", "Clip sitzt im Slot", "4 Sounds, jeder hängt an einem Wort", "−14 LUFS, mit und ohne Musik", "Veröffentlicht und zurückgelesen"],
  /** Karten: Titel und der Ort im Repo */
  karte: [
    { titel: "Voiceover", ort: "voice-studio/" },
    { titel: "Clips", ort: "edit-tools/" },
    { titel: "Sounds", ort: "sfx-kit/" },
    { titel: "Export", ort: "post_render.sh" },
    { titel: "Post", ort: "post_social.py" },
  ],
  aufnahme: "Aufnahme",
  slot: "Clip-Slot",
  slotZeile: ["slots[0]", "clip-02.mp4"],
  cueStelle: ["Clip", "this is", "your hook", "hello"],
  cueName: ["Karte", "Taste", "Taste", "Bleistift"],
  echt: "echte Aufnahme",
  dateien: ["mein-video.mp4", "mein-video-ohne-musik.mp4"],
  stufen: ["Entwurf", "Du gibst frei", "Veröffentlicht"],
  gepostet: "gepostet",
  schluss: "Du sprichst. Der Agent baut.",
  schluss2: "Gib deinem Agenten den Link zu diesem Repo.",
};

// ------------------------------------------------------------ Ton
type Eintrag = { len: number; lead: number; loud: number };
export const SOUNDS = katalog as Record<string, Eintrag>;
export type SoundName = keyof typeof katalog;

/** at = Frame, auf dem der Sound sitzt (Anschlag, bei Papier und Riser die Stelle `lead`). db = Zielpegel des lautesten
 *  50-ms-Stücks; die Lautstärke wird daraus und aus dem Katalogwert `loud` gerechnet, getauschte Sounds bleiben so gleich laut. */
export type Cue = { at: number; s: SoundName; db: number; name: string };
/** Alle Cues zusammen um so viele dB anheben. Der Film hat weder Stimme noch Musik, die Geräusche stehen allein und dürfen deshalb lauter sein als in einem Video. */
const ANHEBEN_DB = 3;
export const vol = (c: Cue) => Math.pow(10, (c.db + ANHEBEN_DB - SOUNDS[c.s].loud) / 20);

const ms = (n: number) => n / 1000;
/** Der Riser endet genau auf „Veröffentlicht“: sein Ende liegt (len − lead) hinter der Stelle, die auf `at` sitzt. */
const RISER_AT = f(T.stufe[2] - ms(SOUNDS.riser1.len - SOUNDS.riser1.lead));
const HAKEN: SoundName[] = ["pen1", "pen2", "pen1", "pen2", "pen1"];

export const CUES: Cue[] = [
  // Titel und Aufbau
  { at: f(T.titel2), s: "key2", db: -31, name: "Titel, zweite Zeile (Taste)" },
  { at: f(T.spalten) + 4, s: "page1", db: -29, name: "Spalten erscheinen (Seite blättert)" },
  // je Schritt: ein leiser Tipp aufs Trackpad, wenn der Mensch zu sprechen beginnt; ein Kugelschreiber-Klick auf dem Haken
  ...S.map((t, i): Cue => ({ at: f(t), s: "trackpad2", db: -33, name: `${i + 1} · du sprichst (Trackpad)` })),
  ...T.fertig.map((t, i): Cue => ({ at: f(t), s: HAKEN[i], db: -31, name: `${i + 1} · Haken (Kugelschreiber)` })),
  // 1 Voiceover
  { at: f(T.rec), s: "switch2", db: -29, name: "1 · Aufnahme an (Schalter)" },
  // die Welle zeichnet sich in drei Stücken (eines je Wortgruppe): je ein leiser Bleistiftstrich, wenn ein Stück beginnt
  ...WELLE_STUECKE.map((msStart, i): Cue => ({ at: f(T.welleVon + (msStart / WELLE_MS) * (T.welleBis - T.welleVon)), s: i === 1 ? "pencil1" : "pencil2", db: -37, name: `1 · Welle, Stück ${i + 1} (Bleistift)` })),
  { at: f(T.stopp), s: "switch", db: -31, name: "1 · Aufnahme aus (Schalter)" },
  { at: f(T.marke[0]), s: "flapLo", db: -30, name: "1 · Wortzeit this is (Klappe)" },
  { at: f(T.marke[1]), s: "flap", db: -30, name: "1 · Wortzeit your hook (Klappe)" },
  { at: f(T.marke[2]), s: "flapHi", db: -30, name: "1 · Wortzeit hello (Klappe)" },
  // 2 Clips
  { at: f(T.bilder), s: "riffle1", db: -30, name: "2 · Clips fächern auf (Karten)" },
  { at: f(T.wahl), s: "mouse1", db: -29, name: "2 · Clip gewählt (Maus)" },
  { at: f((T.flugVon + T.flugBis) / 2), s: "swishSmall", db: -37, name: "2 · Clip fliegt (Luftzug)" },
  { at: f(T.flugBis), s: "cardPlace1", db: -26, name: "2 · Clip landet im Slot (Karte)" },
  // 3 Sounds: jede Cue ist beim Einsetzen einmal zu hören
  { at: f(T.aktiv[2]), s: "trackpad1", db: -33, name: "3 · Karte aktiv (Trackpad)" },
  { at: f(T.cue[0]), s: "cardPlace1", db: -28, name: "3 · Cue Clip (Karte)" },
  { at: f(T.cue[1]), s: "key1", db: -28, name: "3 · Cue this is (Taste)" },
  { at: f(T.cue[2]), s: "key2", db: -28, name: "3 · Cue your hook (Taste)" },
  { at: f(T.cue[3]), s: "pencil1", db: -28, name: "3 · Cue hello (Bleistift)" },
  // 4 Export: der Ausschnitt läuft im Takt der Wortzeiten, mit denselben vier Sounds
  { at: f(T.aktiv[3]), s: "switch2", db: -31, name: "4 · Karte aktiv (Schalter)" },
  { at: f(T.abspielen), s: "cardPlace1", db: -28, name: "4 · Video: Clip (Karte)" },
  { at: f(T.abspielen + ms(WORT.thisIs)), s: "key1", db: -28, name: "4 · Video: this is (Taste)" },
  { at: f(T.abspielen + ms(WORT.yourHook)), s: "key2", db: -28, name: "4 · Video: your hook (Taste)" },
  { at: f(T.abspielen + ms(WORT.hello)), s: "pencil1", db: -28, name: "4 · Video: hello (Bleistift)" },
  { at: f(T.datei[0]), s: "mouse4", db: -32, name: "4 · Datei mit Musik (Maus)" },
  { at: f(T.datei[1]), s: "mouse4", db: -32, name: "4 · Datei ohne Musik (Maus)" },
  // 5 Post
  { at: f(T.aktiv[4]), s: "trackpad1", db: -33, name: "5 · Karte aktiv (Trackpad)" },
  { at: f(T.stufe[0]), s: "mouse3", db: -31, name: "5 · Entwurf (Maus)" },
  { at: f(T.stufe[1]), s: "mouse2", db: -29, name: "5 · Freigabe (Maus)" },
  { at: RISER_AT, s: "riser1", db: -34, name: "5 · Riser bis veröffentlicht" },
  { at: f(T.stufe[2]), s: "tom1", db: -25, name: "5 · Veröffentlicht (Trommel)" },
  // Schluss
  { at: f(T.schluss) + 6, s: "page3", db: -29, name: "Schluss (Seite blättert)" },
  { at: f(T.schluss2), s: "key3", db: -31, name: "Schluss, zweite Zeile (Taste)" },
  { at: f(T.schluss3), s: "cardPlace1", db: -33, name: "Schluss, Name des Repos (Karte)" },
];
