import { Composition } from "remotion";
import { AMBIENT_CARD_FRAMES, AmbientCard, ambientCardDefaults, ambientCardSchema } from "./AmbientCard";
import { Demo, DEMO_FRAMES, demoDefaults, demoSchema } from "./Demo";

export const RemotionRoot: React.FC = () => (
  <>
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
    <Composition
      id="AmbientCard"
      component={AmbientCard}
      durationInFrames={AMBIENT_CARD_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      schema={ambientCardSchema}
      defaultProps={ambientCardDefaults}
    />
  </>
);
