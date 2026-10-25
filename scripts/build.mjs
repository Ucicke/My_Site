import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const siteFiles = ['index.html', 'site-assets/styles.css', 'site-assets/favicon.svg'];

export async function build(output = path.join(projectRoot, 'dist')) {
  for (const name of siteFiles) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(projectRoot, name), target);
  }
  let html = await readFile(path.join(output, 'index.html'), 'utf8');
  if (html.includes('/_app/') || html.includes('telegram-web-app.js')) {
    throw new Error('The website must not depend on the game build or Telegram SDK');
  }
  // A fresh asset URL on every content change avoids stale CDN/browser CSS.
  for (const asset of siteFiles.filter((name) => name.startsWith('site-assets/'))) {
    const version = createHash('sha256').update(await readFile(path.join(output, asset))).digest('hex').slice(0, 12);
    html = html.replaceAll(`href="/${asset}"`, `href="/${asset}?v=${version}"`);
  }
  await writeFile(path.join(output, 'index.html'), html, 'utf8');
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Website built: ${await build()}`);
}
