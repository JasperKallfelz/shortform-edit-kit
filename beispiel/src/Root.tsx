import { Composition } from "remotion";
import { Demo, DEMO_FRAMES, demoDefaults, demoSchema } from "./Demo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Demo"
    component={Demo}
    durationInFrames={DEMO_FRAMES}
    fps={30}
    width={1080}
    height={1920}
    schema={demoSchema}
    defaultProps={demoDefaults}
  />
);
