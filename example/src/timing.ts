// Times of the (imaginary) voiceover – the only place where times are stored.
// In a real project this file is generated from the voice recording and not maintained by hand: `npm run vo -- recordings/<take>.wav`
// (Voice Studio, see ../voice-studio/README.md). A new take produces a new file, and picture and sound move along by themselves.
// Example values are used here so that the demo runs timed even without a recording. The keys are defined in script.json.
// Each number = start of the word in milliseconds from the start of the audio file.
export const VO = {
  /** Audio file under public/ ("" = no voiceover; Voice Studio enters the mastered recording here) */
  file: "",
  /** Length of the video in ms */
  endMs: 9000,
  w: {
    // Scene 1: "this is your hook, hello"
    thisIs: 300, yourHook: 800, hello: 1450,
    // Scene 2: "look at these numbers"
    look: 3000, numbers: 3400,
    // Scene 3: "I'm Your Name, thanks for watching"
    im: 6000, yourName: 6300, thanks: 7400,
  },
};
