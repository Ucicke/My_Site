# Runtime assets

| Directory | Current purpose |
|---|---|
| botanical-horror | Project-generated shared atlas: organs, card icons, resources, buttons, frames, checkboxes. Rebuild via `dev/prepare-botanical-ui.py`; original and prompt in `art/botanical-horror/`. |
| stage1c | Whole generated plant sprites and organic ground; legacy shared rig atlases remain in use for the player, weapons, gore and fallback rendering. Prompts are in `stage1c/WHOLE-SPRITES.md`. |
| driftworks | Utility pictograms for menu, settings and combat indicators. |
| input-prompts | Keyboard, Xbox and PlayStation prompts, including remapped controls. |
| fonts | Two Not Jam font sizes and author/license notices. |
| music | Five used music files: menu/combat intros and loops, defeat track; credits included. |
| sfx | Used IcySoap, Driftworks and Flesh and Fracture audio; credits remain in each pack. |

Only runtime assets and their metadata/notices belong here. Art originals and
generation prompts live in `art/`; playtest videos/JSON live in ignored
`dev/playtests/`. Validate references and orphaned media with `node dev/assets-test.js`.

Removed on 2026-10-25: `biopunk-sample` and `alien-biotech` (24 files,
2499911 bytes). Their icons and GUI were replaced by botanical-horror. Historical
reports and frozen comparison code may still name the old packs; game startup
uses the shared `assets/` root and makes no requests to the removed directories.
