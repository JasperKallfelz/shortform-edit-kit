import { Composition } from "remotion";
import { DEMOS } from "./demos";

/** One composition per effect, id = effect name. Open `npm run dev` and pick one in the sidebar. */
export const RemotionRoot: React.FC = () => (
  <>
    {DEMOS.map((d) => (
      <Composition key={d.id} id={d.id} component={d.Component} durationInFrames={d.frames} fps={30} width={1080} height={1920} />
    ))}
  </>
);
