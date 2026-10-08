// Three fonts that carry the look:
// - sans: tight, bold grotesque (Inter, negative letter-spacing)
// - serifItalic: Didone italic (Playfair Display Italic)
// - script: handwriting script (Pinyon Script)
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadPinyon } from "@remotion/google-fonts/PinyonScript";

const inter = loadInter("normal", { weights: ["400", "500", "700", "800", "900"], subsets: ["latin"] });
const playfair = loadPlayfair("italic", { weights: ["400", "500"], subsets: ["latin"] });
const pinyon = loadPinyon("normal", { weights: ["400"], subsets: ["latin"] });

export type FontKey = "sans" | "sansLight" | "serifItalic" | "script";

export const FONTS: Record<FontKey, React.CSSProperties> = {
  sans: { fontFamily: inter.fontFamily, fontWeight: 800, letterSpacing: "-0.05em" },
  sansLight: { fontFamily: inter.fontFamily, fontWeight: 500, letterSpacing: "-0.03em" },
  serifItalic: { fontFamily: playfair.fontFamily, fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.01em" },
  script: { fontFamily: pinyon.fontFamily, fontWeight: 400, letterSpacing: "0" },
};

export const fontsReady = Promise.all([inter.waitUntilDone(), playfair.waitUntilDone(), pinyon.waitUntilDone()]);
