import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const siteFiles = [
  'index.html',
  'site-assets/styles.css',
  'site-assets/site.js',
  'site-assets/favicon.svg',
  'site-assets/cover-lifesim.svg',
  'site-assets/cover-deadweed.svg',
  'site-assets/cover-scroll-hunter.svg',
  'site-assets/cover-dark-pool.svg',
];
const execute = promisify(execFile);

export async function build(output = path.join(projectRoot, 'dist')) {
  for (const name of siteFiles.filter((file) => file !== 'site-assets/styles.css')) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(projectRoot, name), target);
  }
  await execute(process.execPath, [
    path.join(projectRoot, 'node_modules/@tailwindcss/cli/dist/index.mjs'),
    '--input', path.join(projectRoot, 'site-assets/styles.css'),
    '--output', path.join(output, 'site-assets/styles.css'),
    '--minify',
  ], { cwd: projectRoot, windowsHide: true });
  let html = await readFile(path.join(output, 'index.html'), 'utf8');
  if (html.includes('/_app/') || html.includes('telegram-web-app.js')) {
    throw new Error('The website must not depend on the game build or Telegram SDK');
  }
  // Version every local asset so a release cannot mix old CSS, JS, or covers.
  for (const asset of siteFiles.filter((name) => name.startsWith('site-assets/'))) {
    const version = createHash('sha256').update(await readFile(path.join(output, asset))).digest('hex').slice(0, 12);
    html = html.replaceAll(`href="/${asset}"`, `href="/${asset}?v=${version}"`);
    html = html.replaceAll(`src="/${asset}"`, `src="/${asset}?v=${version}"`);
  }
  await writeFile(path.join(output, 'index.html'), html, 'utf8');
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Website built: ${await build()}`);
}
