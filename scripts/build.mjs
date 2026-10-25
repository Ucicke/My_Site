import { copyFile, mkdir, readFile } from 'node:fs/promises';
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
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  if (html.includes('/_app/') || html.includes('telegram-web-app.js')) {
    throw new Error('The website must not depend on the game build or Telegram SDK');
  }
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Website built: ${await build()}`);
}
