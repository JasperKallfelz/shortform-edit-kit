import { Composition } from "remotion";
import { Tour, TOTAL_FRAMES } from "./Tour";
import { FPS, H, W } from "./lib";

export const RemotionRoot: React.FC = () => <Composition id="Tour" component={Tour} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />;
