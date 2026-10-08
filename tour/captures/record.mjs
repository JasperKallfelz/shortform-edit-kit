// Scenes for the tour: node record.mjs <scene>   (voice-studio | props | timeline | listen)
// Prerequisite: the tools are running (see ../README.md); the ports come from the environment variables.
import path from "node:path";
import { record, sleep, OUT } from "./cap.mjs";

const P = {
  voiceStudio: process.env.PORT_VOICE_STUDIO || "4732",
  studio: process.env.PORT_STUDIO || "4733",
  listen: process.env.PORT_LISTEN || "4731",
};
const FAKE_MIC = path.join(OUT, "raw", "fake-mic.wav");

// Text dependencies on the pages being recorded (everything else is found by ids, classes or roles):
//  - the listening page: the keys B (keep) and X (drop), see `sequence` in the "listen" scene
//  - the Remotion Studio timeline: sequence names that start with "SFX · " (the example project names them), see SFX_LABEL
const KEEP_KEY = "b";
const DROP_KEY = "x";
const SFX_LABEL = /^SFX · /;

const scenes = {
  // 1 · Script and voiceover: recorder page with teleprompter, one take with the test microphone
  async "voice-studio"() {
    await record({
      name: "voice-studio",
      url: `http://localhost:${P.voiceStudio}`,
      fakeMic: FAKE_MIC,
      colorScheme: "dark",
      async run({ page, mark, move, click, sleep }) {
        await sleep(1600);
        const lines = page.locator(".line");
        await move(...(await centerOf(lines.nth(0))), 900);
        await sleep(500);
        await click(page.locator("#rec"), 1100);
        await page.waitForFunction(() => document.getElementById("rec").classList.contains("stop"), null, { timeout: 15000 });
        const t0 = Date.now();
        mark("recording-started");
        const until = async (s) => { const w = s * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); };
        await move(...(await centerOf(lines.nth(1))), 1000);
        await until(3.0);
        await click(lines.nth(1), 250); // scene 2 begins
        await move(...(await centerOf(lines.nth(2))), 1100);
        await until(5.4);
        await click(lines.nth(2), 250); // scene 3
        await until(8.4);
        await move(...(await centerOf(page.locator("#rec"))), 900);
        await until(9.3);
        mark("stop");
        await click(page.locator("#rec"), 200);
        // the take counts as saved as soon as the page adds the <code> element with the next-step command (independent of the page language)
        await page.waitForFunction(() => document.querySelector("#takes code") !== null, null, { timeout: 15000 });
        mark("saved");
        await move(560, 420, 900);
        await sleep(3200);
      },
    });
  },

  // 2 · Drop in clips: Remotion Studio, composition Demo, props field with the clip slots
  async props() {
    await record({
      name: "props",
      url: `http://localhost:${P.studio}/Demo`,
      colorScheme: "dark",
      warm: 3500,
      async run({ page, mark, move, click, sleep }) {
        await sleep(1400);
        await move(1420, 420, 900);
        // scroll the props field down to the clip slots
        for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 150); await sleep(260); }
        await sleep(600);
        mark("slots-visible");
        const clip = page.locator('input[placeholder="slots.0.clip"]');
        await click(clip, 1000);
        await sleep(300);
        // enter it in one go: character by character, the Studio would already look for a file at every partial name ("e", "ex", …)
        await clip.fill("example-clip.mp4");
        mark("clip-entered");
        await sleep(1300);
        // put the playhead at second 2.3 (hook with clip). When the field is left, the Studio briefly reports that it cannot write the
        // default values back to the file (they live in a variable): these two seconds are skipped in the cut.
        mark("before-click");
        await click([336 + 133 * 2.3, 770], 1300);
        mark("clicked");
        const message = page.getByText("Cannot update default props");
        await message.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
        mark("message-shown");
        await message.waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
        mark("message-gone");
        await sleep(500);
        mark("preview");
        await page.keyboard.press("Space");
        mark("playing");
        await sleep(3600);
        await page.keyboard.press("Space");
        await sleep(900);
      },
    });
  },

  // 3b · Studio timeline with the named sound sequences, a few seconds of playback
  async timeline() {
    const props = encodeURIComponent(JSON.stringify({ slots: [{ label: "your clip", clip: "example-clip.mp4", startSec: 0 }, { label: "your clip", clip: "example-clip.mp4", startSec: 3 }] }));
    await record({
      name: "timeline",
      url: `http://localhost:${P.studio}/Demo?props=${props}`,
      colorScheme: "dark",
      warm: 3500,
      async run({ page, mark, move, click, sleep }) {
        await sleep(1200);
        // drag the timeline taller
        await move(800, 756, 800);
        await page.mouse.down();
        await move(800, 500, 1000);
        await page.mouse.up();
        await sleep(700);
        mark("timeline-enlarged");
        // click the sound track: the inspector shows "27 instances" (the first "SFX · …" sequence is the hook clip's shutter)
        await click(page.getByText(SFX_LABEL).first(), 1000);
        await sleep(1500);
        mark("sfx-selected");
        await click([336 + 133 * 0.2, 530], 900);
        await page.keyboard.press("Space");
        mark("playing");
        await sleep(6500);
        await page.keyboard.press("Space");
        await sleep(700);
      },
    });
  },

  // 3a · Listening page: sort with the keyboard
  async listen() {
    await record({
      name: "listen",
      url: `http://127.0.0.1:${P.listen}`,
      colorScheme: "light",
      async run({ page, mark, move, click, sleep, key }) {
        await sleep(1500);
        const first = page.locator("button.play").first();
        await click(first, 1100);
        await sleep(900);
        mark("first-sound");
        // right arrow: next sound; B keeps, X drops (the next one plays afterwards)
        const sequence = [["ArrowRight", 1100], [KEEP_KEY, 1200], [KEEP_KEY, 1200], [DROP_KEY, 1200], ["ArrowRight", 1000], [KEEP_KEY, 1200], [DROP_KEY, 1200], [KEEP_KEY, 1200], ["ArrowLeft", 1000], [DROP_KEY, 1300]];
        for (const [k, w] of sequence) { await key(k); await sleep(w); }
        mark("sorted");
        await move(520, 262, 900);
        await sleep(1800);
      },
    });
  },
};

async function centerOf(loc) {
  const b = await loc.boundingBox();
  return [b.x + Math.min(b.width * 0.5, 420), b.y + b.height / 2];
}

const name = process.argv[2];
if (!scenes[name]) {
  console.error("Choose a scene:", Object.keys(scenes).join(" | "));
  process.exit(1);
}
await scenes[name]();
