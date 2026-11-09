import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const siteFiles = [
  'index.html',
  'site-assets/styles.css',
  'site-assets/site.js',
  'site-assets/brand-mark.svg',
  'site-assets/favicon.svg',
  'site-assets/cover-deadweed.svg',
  'site-assets/cover-scroll-hunter.svg',
  'site-assets/cover-dark-pool.svg',
  'site-assets/cover-rus-vs-yashcher.svg',
  'site-assets/cover-merge-rpg.svg',
];
const execute = promisify(execFile);
const gameRoutes = ['/deadweed/', '/scroll_hunter/', '/dark_pool/', '/rus_vs_yashcher/', '/merge_rpg/'];
export const pageGameBundles = [
  { slug: 'deadweed', source: 'pages-games/deadweed' },
  { slug: 'scroll_hunter', source: 'pages-games/scroll_hunter' },
  { slug: 'dark_pool', source: 'pages-games/dark_pool' },
  { slug: 'rus_vs_yashcher', source: 'pages-games/rus_vs_yashcher' },
  { slug: 'merge_rpg', source: 'pages-games/merge_rpg' },
];

function normalizeBasePath(value) {
  const basePath = value || '/';
  if (basePath === './') return basePath;
  if (!basePath.startsWith('/') || basePath.startsWith('//') || /[?#\s]/.test(basePath)) {
    throw new Error('SITE_BASE_PATH must be /, ./, or an absolute URL path ending in a slash');
  }
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

export async function build(output = path.join(projectRoot, 'dist'), options = {}) {
  const basePath = normalizeBasePath(options.basePath ?? process.env.SITE_BASE_PATH);
  const gameOrigin = (options.gameOrigin ?? process.env.SITE_GAME_ORIGIN ?? '').replace(/\/+$/, '');
  if (basePath !== '/' && !gameOrigin) {
    throw new Error('SITE_GAME_ORIGIN is required when building under a project subpath');
  }
  if (gameOrigin && !/^https:\/\/[^/]+$/.test(gameOrigin)) {
    throw new Error('SITE_GAME_ORIGIN must be an HTTPS origin without a path');
  }
  for (const name of siteFiles.filter((file) => file !== 'site-assets/styles.css')) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(projectRoot, name), target);
  }
  for (const { slug, source } of pageGameBundles) {
    await cp(path.join(projectRoot, source), path.join(output, slug), { recursive: true });
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
  if (basePath !== '/') html = html.replaceAll('href="/"', `href="${basePath}"`);
  for (const route of gameRoutes) {
    if (gameOrigin) html = html.replaceAll(`href="${route}"`, `href="${gameOrigin}${route}"`);
  }
  for (const { slug } of pageGameBundles) {
    const route = `/${slug}/`;
    const hostedRoute = `${basePath}${slug}/`;
    html = html.replaceAll(`href="${gameOrigin ? `${gameOrigin}${route}` : route}"`, `href="${hostedRoute}"`);
  }
  for (const asset of siteFiles.filter((name) => name.startsWith('site-assets/'))) {
    const version = createHash('sha256').update(await readFile(path.join(output, asset))).digest('hex').slice(0, 12);
    html = html.replaceAll(`href="/${asset}"`, `href="${basePath}${asset}?v=${version}"`);
    html = html.replaceAll(`src="/${asset}"`, `src="${basePath}${asset}?v=${version}"`);
  }
  await writeFile(path.join(output, 'index.html'), html, 'utf8');
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Website built: ${await build()}`);
}
