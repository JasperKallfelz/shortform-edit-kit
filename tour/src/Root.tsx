import { Composition } from "remotion";
import { Rundgang, TOTAL_FRAMES } from "./Rundgang";
import { FPS, H, W } from "./lib";

export const RemotionRoot: React.FC = () => <Composition id="Rundgang" component={Rundgang} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />;
