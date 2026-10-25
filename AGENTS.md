# Ucicke personal website

This is an independent, dependency-free HTML/CSS website for https://ucicke.ru/.
- Edit `index.html` for content and `site-assets/styles.css` for design.
- `npm run dev` serves http://127.0.0.1:4174; `npm test` validates project isolation; `npm run build` prepares dist.
- Never modify LifeSim or Deadweed from this repository. Game links are external deployments at /lifesim/ and /deadweed/.
- Deploy only root index.html and /site-assets/. Do not upload the whole domain docroot.
- Use deploy/deploy_site.ps1; it acquires the shared domain lock and preserves previous site files for rollback.
- Never commit deploy/deploy.env or credentials. Use the configured SSH key and normal host verification.
- Back up existing files before editing; use UTF-8 without BOM. Do not delete project files outright; use .recycle-bin/.
- Verify with npm test and npm run build. After layout changes inspect desktop and mobile widths.
