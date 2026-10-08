# Licences of the sound effects

All audio files in `sfx-candidates/` and `sfx-kit/sounds/` come from sources that allow redistribution and commercial use without
attribution. The source of every single file is in `sfx-candidates/manifest.tsv` (columns `source_page_url`,
`licence_name`, `licence_url`) and, for the processed sounds, in `sfx-kit/sources.tsv`.

| Source | Licence | Files | Note |
|---|---|---|---|
| [BigSoundBank.com](https://BigSoundBank.com) (Joseph Sardin) | CC0 1.0 / WTFPL / Public Domain, see https://bigsoundbank.com/licenses.html (checked on 8 Oct 2026) | 151 candidates | Original WAVs. Attribution is not required but is requested: "Additional sounds: Joseph SARDIN - BigSoundBank.com" |
| [Freesound.org](https://freesound.org), only files with CC0 | CC0 1.0 Universal | 65 candidates | From the freely available preview files (lossy, converted to WAV). The originals are available on the respective page with a Freesound account |
| [Kenney.nl](https://kenney.nl/assets/interface-sounds) Interface Sounds | CC0 1.0 Universal | 10 candidates | Mostly synthetic UI sounds, included as candidates; of these only the mouse click `mouse4` is in the kit |
| [Remotion SFX](https://www.remotion.dev/docs/sfx) | CC0 1.0 Universal | 7 candidates | |

The processed files in `sfx-kit/sounds/` are edits of these sources (silence trimmed, normalised, some shortened or slightly changed
in pitch) and are also under CC0.

Not included are sounds whose origin could not be verified, and any kind of music.

If you add new sounds here: only CC0, public domain or explicitly cleared for redistribution, and always with a row in the manifest.
