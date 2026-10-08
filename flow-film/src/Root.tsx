import { Composition } from "remotion";
import { z } from "zod";
import { Flow } from "./Flow";
import { FPS, FRAMES, H, W } from "./plan";

const schema = z.object({
  /** volume of all sound effects together (0 = silent, 1 = the levels from plan.ts) */
  sfxVolume: z.number().min(0).max(2),
  /** volume of the real voice and of the real video's sound (0 = silent, 1 = the levels from Flow.tsx) */
  videoVolume: z.number().min(0).max(2),
});

export const RemotionRoot: React.FC = () => (
  <Composition id="Flow" component={Flow} durationInFrames={FRAMES} fps={FPS} width={W} height={H} schema={schema} defaultProps={{ sfxVolume: 1, videoVolume: 1 }} />
);
