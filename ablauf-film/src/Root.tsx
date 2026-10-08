import { Composition } from "remotion";
import { z } from "zod";
import { Ablauf } from "./Ablauf";
import { FPS, FRAMES, H, W } from "./plan";

const schema = z.object({
  /** Lautstärke aller Sound-Effekte zusammen (0 = stumm, 1 = die Pegel aus plan.ts). */
  sfxVolume: z.number().min(0).max(2),
});

export const RemotionRoot: React.FC = () => (
  <Composition id="Ablauf" component={Ablauf} durationInFrames={FRAMES} fps={FPS} width={W} height={H} schema={schema} defaultProps={{ sfxVolume: 1 }} />
);
