# DEADWEED — botanical horror atlas

Generated for this project with the built-in OpenAI imagegen tool on 2026-10-25.
Botanical material language: bark, woody thorns, torn vascular fibers, resin,
scarred seed chambers and chlorophyll membranes. No third-party sample artwork
was used as an input to generation.

- Original: `art/botanical-horror/source-atlas.png` (1122 × 1402, RGBA).
- Full generation prompt: `art/botanical-horror/prompt.txt`.
- Rebuild: `python dev/prepare-botanical-ui.py` (Pillow).
- Runtime: `atlas.png` (1024 × 384, RGBA), 20 sprites, 1.5 MiB decoded.
- Coordinates and extraction audit: `atlas.json`; generated constants in `js/ui.js`.
- Processing: isolate cutouts, trim padding and near-invisible alpha skirts,
  downsample, pack. Source artwork is preserved unchanged.
- Preview: `/dev/botanical-preview.html` (menu, cards, settings, gore, all icons).

The replaced BALOOD and StationSupply sample files were removed on 2026-10-25.
Their former artwork and notices remain recoverable from Git history. Input
prompts, utility pictograms, audio and fonts keep their existing authors and licenses.

Plant sap and procedural tissue palettes live in `js/biology.js`. Red interior
pixels of the existing Sprout/Snapper art are mapped to olive vascular tissue
once at load time in `cachePlantTissueArt`, preserving source alpha, shading,
rig rectangles, pivots and collider geometry. Twelve cached cutouts add
356160 bytes; world art remains below its existing 3 MiB budget. No per-frame
pixel reads, recoloring, additional particles or new gameplay entities.

Verification: 15 art, 10 gore and 19 readability regression groups passed.
Browser review covered 1280 × 720, 960 × 540 and 390 × 720 fixture canvases.
Screenshots: `art/botanical-horror/screens/` (cards, narrow cards, menu,
settings and green gore). These are static art fixtures, not balance evidence.
