// One demo composition per effect: neutral placeholder content, 1080 x 1920, 30 fps, 2.5-4 s, ending on a held final state.
// To add an effect: write src/effects/<Name>.tsx, add a demo below and an entry in DEMOS.
import React from "react";
import { WordPop } from "./effects/WordPop";
import { ScriptWord } from "./effects/ScriptWord";
import { ClipInset } from "./effects/ClipInset";
import { AmbientCard } from "./effects/AmbientCard";
import { Counter } from "./effects/Counter";
import { SquiggleArrow } from "./effects/SquiggleArrow";
import { MapRoute } from "./effects/MapRoute";
import { LogoCard } from "./effects/LogoCard";
import { NameCard } from "./effects/NameCard";
import { CrowdWall } from "./effects/CrowdWall";
import { PhotoCollage } from "./effects/PhotoCollage";
import { GrowthCards } from "./effects/GrowthCards";
import { PathRun } from "./effects/PathRun";
import { LogoMark, PortraitArt, SceneArt, White } from "./placeholders";

const RED = "#e1251b";
const GREEN_DARK = "#0a8f50";

const WordPopDemo: React.FC = () => (
  <White>
    <WordPop
      words={[
        { text: "this is", font: "sansLight", size: 84, x: 30, y: 37, at: 10 },
        { text: "WordPop", font: "sans", size: 200, x: 50, y: 44, at: 22 },
        { text: "every word", font: "serifItalic", size: 130, x: 50, y: 54, at: 36 },
        { text: "on its cue", font: "script", size: 230, x: 50, y: 64, at: 50, color: RED },
      ]}
    />
  </White>
);

const ScriptWordDemo: React.FC = () => (
  <White>
    <ClipInset top={44} zoomTo={1.1}>
      <SceneArt hue={210} />
    </ClipInset>
    <WordPop
      words={[
        { text: "this is", font: "sansLight", size: 76, x: 28, y: 11, at: 8 },
        { text: "your hook", font: "sans", size: 176, x: 50, y: 17.5, at: 18 },
      ]}
    />
    <ScriptWord text="hello" at={44} size={480} x={48.5} y={40} />
  </White>
);

const ClipInsetDemo: React.FC = () => (
  <White>
    <ClipInset top={37} zoomTo={1.3} zoomOrigin="47% 72%">
      <SceneArt hue={205} />
    </ClipInset>
  </White>
);

const AmbientCardDemo: React.FC = () => (
  <White>
    <AmbientCard top={37} zoomTo={1.1}>
      <SceneArt hue={14} />
    </AmbientCard>
  </White>
);

const CounterDemo: React.FC = () => (
  <White>
    <Counter to={1248730} at={8} frames={80} />
    <WordPop
      words={[
        { text: "look at these", font: "sansLight", size: 84, x: 50, y: 31, at: 4 },
        { text: "views", font: "serifItalic", size: 130, x: 50, y: 60, at: 14, color: GREEN_DARK },
      ]}
    />
  </White>
);

const ARROW_FROM = { x: 880, y: 532 };
const ARROW_TO = { x: 650, y: 991 };
const SquiggleArrowDemo: React.FC = () => (
  <White>
    <ClipInset top={38} zoomTo={1.1}>
      <SceneArt hue={190} />
    </ClipInset>
    <WordPop
      words={[
        { text: "I'm", font: "sansLight", size: 84, x: 22, y: 14.5, at: 8 },
        { text: "Your Name", font: "sans", size: 160, x: 52, y: 22, at: 14 },
        { text: "thanks for watching", font: "sansLight", size: 84, x: 50, y: 75, at: 60 },
      ]}
    />
    <SquiggleArrow from={ARROW_FROM} to={ARROW_TO} at={34} />
  </White>
);

const MapRouteDemo: React.FC = () => (
  <White>
    <MapRoute zoomTo={2.4} />
  </White>
);

const LogoCardDemo: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: "#eef0f3" }}>
    <LogoCard at={6}>
      <LogoMark />
    </LogoCard>
  </div>
);

const NameCardDemo: React.FC = () => (
  <White>
    <NameCard lead="there I met" name="Name" also="& Friend" at={0}>
      <PortraitArt hue={200} />
    </NameCard>
  </White>
);

const CrowdWallDemo: React.FC = () => (
  <White>
    <CrowdWall />
  </White>
);

const PhotoCollageDemo: React.FC = () => (
  <White>
    <PhotoCollage at={6} />
    <WordPop
      words={[
        { text: "together", font: "serifItalic", size: 140, x: 26, y: 9, at: 4 },
        { text: "we are building", font: "sansLight", size: 74, x: 74, y: 12, at: 12 },
        { text: "something", font: "sans", size: 176, x: 50, y: 19, at: 20 },
      ]}
    />
  </White>
);

const GrowthCardsDemo: React.FC = () => (
  <White>
    <Counter to={2403650} prefix="$" at={4} top={520} frames={84} />
    <GrowthCards at={4} />
  </White>
);

const PathRunDemo: React.FC = () => (
  <White>
    <PathRun />
  </White>
);

/** id = effect name. `frames` at 30 fps. */
export const DEMOS: { id: string; frames: number; Component: React.FC }[] = [
  { id: "WordPop", frames: 90, Component: WordPopDemo },
  { id: "ScriptWord", frames: 90, Component: ScriptWordDemo },
  { id: "ClipInset", frames: 90, Component: ClipInsetDemo },
  { id: "AmbientCard", frames: 90, Component: AmbientCardDemo },
  { id: "Counter", frames: 105, Component: CounterDemo },
  { id: "SquiggleArrow", frames: 90, Component: SquiggleArrowDemo },
  { id: "MapRoute", frames: 120, Component: MapRouteDemo },
  { id: "LogoCard", frames: 75, Component: LogoCardDemo },
  { id: "NameCard", frames: 90, Component: NameCardDemo },
  { id: "CrowdWall", frames: 105, Component: CrowdWallDemo },
  { id: "PhotoCollage", frames: 90, Component: PhotoCollageDemo },
  { id: "GrowthCards", frames: 105, Component: GrowthCardsDemo },
  { id: "PathRun", frames: 105, Component: PathRunDemo },
];
