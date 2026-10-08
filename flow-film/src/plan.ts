// Schedule, texts and sound of the film. Every time lives here exactly once: picture (Flow.tsx) and sound (CUES below) read the
// same constants. Move a step and its sounds move with it – the same principle as the word timings in the kit.
import catalogue from "./sounds.json";

export const FPS = 30;
export const W = 1920;
export const H = 1080;
/** seconds → frames */
export const f = (sec: number) => Math.round(sec * FPS);

/** The first spoken line of the real example video ("I left my hometown to live my dream"): length of the excerpt and the word
 *  timings in ms, taken from the video's own timing table. The phone shows the real video, so its text pops on exactly these words. */
export const LINE_MS = 2200;
export const WORDS = [
  { ms: 150, text: "I left my" },
  { ms: 580, text: "hometown" },
  { ms: 1280, text: "to live my" },
  { ms: 1740, text: "dream" },
];
/** Loudness of that line across LINE_MS, 66 values from 0 to 1 (RMS per slice of assets/voice-line.wav, raised to the power 0.6). */
export const WAVE = [
  0.044, 0.042, 0.04, 0.04, 0.037, 0.776, 0.808, 0.904, 0.913, 1.0, 0.958, 0.556, 0.298, 0.141, 0.439, 0.797, 0.82, 0.777, 0.578, 0.638, 0.811, 0.774,
  0.657, 0.656, 0.517, 0.463, 0.401, 0.843, 0.739, 0.785, 0.713, 0.716, 0.743, 0.641, 0.557, 0.387, 0.168, 0.082, 0.063, 0.142, 0.457, 0.61, 0.889, 0.726,
  0.796, 0.907, 0.694, 0.395, 0.432, 0.801, 0.918, 0.821, 0.499, 0.523, 0.664, 0.703, 0.583, 0.445, 0.384, 0.362, 0.246, 0.167, 0.086, 0.077, 0.062, 0.055,
];
/** The real example video (docs/real-example.mp4): length in frames, and how much of it the phone plays at the end (ms).
 *  8.7 s is the pause after "... and now my co-founders". */
export const REAL_FRAMES = 492;
export const PLAY_MS = 8700;
/** Text is fully visible on its cue: a fade-in takes 3 frames, so it starts 3 frames early. */
export const LEAD = 3;

/** Start of the five steps (seconds). */
const S = [3.0, 8.3, 12.8, 18.2, 23.8];
/** Step 1: the recording starts here; voice, waveform and the phone run in real time from this moment. */
const REC = S[0] + 1.7;
/** Step 4: the phone plays the finished video from here. */
const PLAY = S[3] + 1.4;

export const T = {
  /** title: second line, fade-out, columns appear */
  title2: 0.7,
  titleOut: 2.0,
  columns: 2.3,
  step: S,
  /** how long the person "speaks" per step (the bubble's words appear during this time) */
  speak: [1.3, 0.9, 1.0, 0.9, 0.7],
  /** the step's card becomes active / the agent starts typing its report / the card gets its check mark */
  active: [S[0] + 1.5, S[1] + 1.1, S[2] + 1.2, S[3] + 1.1, S[4] + 0.9],
  typing: [REC + 2.5, S[1] + 3.2, S[2] + 4.1, S[3] + 4.3, S[4] + 3.0],
  done: [REC + 3.0, S[1] + 3.7, S[2] + 4.6, S[3] + 4.8, S[4] + 3.5],
  // 1 voiceover
  recClick: REC - 0.1,
  rec: REC,
  recStop: REC + LINE_MS / 1000 + 0.1,
  // 2 clips: three thumbnails, one is picked and flies into the slot in the phone
  thumbs: S[1] + 1.2,
  pick: S[1] + 1.9,
  flightFrom: S[1] + 2.2,
  flightTo: S[1] + 2.8,
  slotLabel: S[1] + 2.95,
  // 3 sounds: five cues land one after another (clip, then the four word groups)
  cue: [S[2] + 1.6, S[2] + 2.1, S[2] + 2.6, S[2] + 3.1, S[2] + 3.6],
  // 4 export: the phone plays the real video, the meter settles on −14 LUFS, two files
  play: PLAY,
  meterTo: PLAY + 2.2,
  file: [PLAY + 2.45, PLAY + 2.65],
  // 5 post: draft, approval, published
  stage: [S[4] + 1.2, S[4] + 1.9, S[4] + 2.6],
  /** closing */
  closing: PLAY + PLAY_MS / 1000,
  closing2: PLAY + PLAY_MS / 1000 + 0.9,
  closing3: PLAY + PLAY_MS / 1000 + 1.2,
  end: PLAY + PLAY_MS / 1000 + 3.6,
};
export const FRAMES = f(T.end);

export const TEXT = {
  brand: "shortform-edit-kit",
  title: ["Build a short video", "by talking to your agent."],
  columns: ["You say", "The agent does", "The video"],
  /** what the person says, per step */
  says: ["Here's my script. I'll record it.", "Use the clip from the beach.", "Add sounds. Real ones only.", "Get it ready to post.", "Looks good. Post it."],
  /** what the agent reports back, per step */
  reports: ["Word timings measured → timing.ts", "Clip is in the slot", "5 sounds, each tied to a word", "−14 LUFS, with and without music", "Published and read back"],
  /** cards: title and where it lives in the repo */
  card: [
    { title: "Voiceover", where: "voice-studio/" },
    { title: "Clips", where: "edit-tools/" },
    { title: "Sounds", where: "sfx-kit/" },
    { title: "Export", where: "post_render.sh" },
    { title: "Post", where: "post_social.py" },
  ],
  recording: "Recording",
  slot: "Clip slot",
  slotLines: ["slots[0]", "beach.mp4"],
  cueStop: ["Clip", ...WORDS.map((w) => w.text)],
  cueName: ["Shutter", "Key", "Key", "Key", "Pencil"],
  real: "real recording",
  files: ["my-video.mp4", "my-video-no-music.mp4"],
  stages: ["Draft", "You approve", "Published"],
  posted: "posted",
  closing: "You talk. The agent builds.",
  closing2: "Give your agent the link to this repo.",
};

// ------------------------------------------------------------ sound
type Entry = { len: number; lead: number; loud: number };
export const SOUNDS = catalogue as Record<string, Entry>;
export type SoundName = keyof typeof catalogue;

/** at = frame the sound sits on (the attack; for paper and the riser the point `lead`). db = target level of its loudest 50 ms;
 *  the volume is computed from that and the catalogue value `loud`, so a swapped sound stays equally loud.
 *  from/dur (ms) play only a part of the file, with a short fade at the end. */
export type Cue = { at: number; s: SoundName; db: number; name: string; from?: number; dur?: number };
/** Raise all cues together by this many dB. */
const LIFT_DB = 3;
export const vol = (c: Cue) => Math.pow(10, (c.db + LIFT_DB - SOUNDS[c.s].loud) / 20);

const ms = (n: number) => n / 1000;
/** The riser ends exactly on "Published": its end lies (len − lead) after the point that sits on `at`. */
const RISER_AT = f(T.stage[2] - ms(SOUNDS.riser1.len - SOUNDS.riser1.lead));
const CHECK: SoundName[] = ["pen1", "pen2", "pen1", "pen2", "pen1"];
const FLAPS: SoundName[] = ["flapLo", "flap", "flapHi", "flap"];
const CUE_SOUND: SoundName[] = ["shutterSlr3", "key1", "key2", "key3", "pencil1"];
/** Each typing burst is a different part of the same recording, so no two sound alike. The offsets (ms) sit just before a key hit
 *  in typeBurst1.wav (hits at 0, 100, 440, 520, 1080, 1180, 1460, 1580, 1850 and 1980 ms). */
const TYPE_FROM = [0, 1065, 430, 1435, 1835];

export const CUES: Cue[] = [
  // title and layout
  { at: 2, s: "cardPlace1", db: -33, name: "Title (card)" },
  { at: f(T.title2), s: "key2", db: -31, name: "Title, second line (key)" },
  { at: f(T.titleOut) + 4, s: "swishSmall", db: -39, name: "Title leaves (air)" },
  { at: f(T.columns) + 4, s: "page1", db: -29, name: "Columns appear (page turn)" },
  // per step: a tap when the person starts talking and a soft click when they stop, the agent typing its report, a pen click on the check mark
  ...S.map((t, i): Cue => ({ at: f(t), s: "trackpad2", db: -33, name: `${i + 1} · you start talking (trackpad)` })),
  ...S.map((t, i): Cue => ({ at: f(t + T.speak[i]) + 2, s: "pen3", db: -36, name: `${i + 1} · you stop talking (soft click)` })),
  ...T.typing.map((t, i): Cue => ({ at: f(t), s: "typeBurst1", db: -34, name: `${i + 1} · agent types its report (keyboard)`, from: TYPE_FROM[i], dur: 480 })),
  ...T.done.map((t, i): Cue => ({ at: f(t), s: CHECK[i], db: -31, name: `${i + 1} · check mark (pen click)` })),
  // 1 voiceover: record on, one flap per word timing (on the spoken word), record off
  { at: f(T.recClick), s: "switch2", db: -29, name: "1 · record on (switch)" },
  ...WORDS.map((w, i): Cue => ({ at: f(T.rec + ms(w.ms)), s: FLAPS[i], db: -34, name: `1 · word timing "${w.text}" (flap)` })),
  { at: f(T.recStop), s: "switch", db: -31, name: "1 · record off (switch)" },
  // 2 clips
  { at: f(T.thumbs), s: "riffle1", db: -30, name: "2 · clips fan out (cards)" },
  { at: f(T.pick), s: "mouse1", db: -29, name: "2 · clip picked (mouse)" },
  { at: f((T.flightFrom + T.flightTo) / 2), s: "swishSmall", db: -37, name: "2 · clip flies (air)" },
  { at: f(T.flightTo), s: "cardPlace1", db: -26, name: "2 · clip lands in the slot (card)" },
  { at: f(T.slotLabel), s: "key3", db: -34, name: "2 · slot entry (key)" },
  // 3 sounds: every cue is heard once as it lands
  { at: f(T.active[2]), s: "trackpad1", db: -33, name: "3 · card active (trackpad)" },
  ...T.cue.map((t, i): Cue => ({ at: f(t), s: CUE_SOUND[i], db: i === 0 ? -29 : -28, name: `3 · cue ${TEXT.cueStop[i]} (${TEXT.cueName[i].toLowerCase()})` })),
  // 4 export: the real video plays with its own sound; the meter winds up and locks
  { at: f(T.active[3]), s: "switch2", db: -31, name: "4 · card active (switch)" },
  { at: f(T.play) + 3, s: "winder1", db: -35, name: "4 · meter runs (film winder)" },
  { at: f(T.play + 1.1), s: "winder2", db: -35, name: "4 · meter runs on (film winder)" },
  { at: f(T.meterTo), s: "switch", db: -32, name: "4 · meter locks on −14 LUFS (switch)" },
  { at: f(T.file[0]), s: "mouse4", db: -32, name: "4 · file with music (mouse)" },
  { at: f(T.file[1]), s: "mouse4", db: -32, name: "4 · file without music (mouse)" },
  // 5 post
  { at: f(T.active[4]), s: "trackpad1", db: -33, name: "5 · card active (trackpad)" },
  { at: f(T.stage[0]), s: "mouse3", db: -31, name: "5 · draft (mouse)" },
  { at: f(T.stage[1]), s: "mouse2", db: -29, name: "5 · approval (mouse)" },
  { at: RISER_AT, s: "riser1", db: -34, name: "5 · riser up to published" },
  { at: f(T.stage[2]), s: "tom1", db: -25, name: "5 · published (drum)" },
  // closing
  { at: f(T.closing) + 3, s: "swishSmall", db: -39, name: "Columns leave (air)" },
  { at: f(T.closing) + 8, s: "page3", db: -29, name: "Closing (page turn)" },
  { at: f(T.closing2), s: "key3", db: -31, name: "Closing, second line (key)" },
  { at: f(T.closing3), s: "cardPlace1", db: -33, name: "Closing, repo name (card)" },
];
