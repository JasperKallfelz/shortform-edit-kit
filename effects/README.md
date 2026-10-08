# effects

Every visual effect of the kit as one copy-paste Remotion component, each with an animated demo. The overview with GIFs is [`../EFFECTS.md`](../EFFECTS.md).

- `src/effects/<Name>.tsx`: the effect, one file each, typed props, short doc comment on top. Copy the file into your project (effects that show text also need `src/lib/fonts.ts`).
- `src/demos.tsx`: one demo composition per effect (id = effect name, 1080 x 1920, 30 fps, placeholder content drawn in code).
- `src/placeholders.tsx`: the placeholder art for the demos. The effects never import it.
- `scripts/gifs.mjs`: renders every demo to `../docs/effects/<kebab-name>.gif`.

## Run

```
npm install
npm run dev        # Remotion Studio, pick an effect in the sidebar
npm run typecheck  # tsc --noEmit
npm run gifs       # rebuild all GIFs (needs ffmpeg); npm run gifs -- WordPop for one
```

## Add an effect

1. Write `src/effects/<Name>.tsx`: one exported component, a doc comment, typed props, no randomness at render time (use `random(seed)` from `remotion`), text fully visible on its cue frame.
2. Add a demo component and an entry `{ id: "<Name>", frames, Component }` to `DEMOS` in `src/demos.tsx` (2.5-4 s, end on a held state, placeholder content only).
3. Run `npm run gifs -- <Name>`.
4. Add a cell to the grid and a row to the table in [`../EFFECTS.md`](../EFFECTS.md).
