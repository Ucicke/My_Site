import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, pageGameBundles, projectRoot, siteFiles } from '../scripts/build.mjs';

test('build is self-contained and contains only site files and Pages game bundles', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'ucicke-site-'));
  await build(output);
  assert.deepEqual((await readdir(output)).sort(), [
    'dark_pool', 'deadweed', 'index.html', 'rus_vs_yashcher', 'scroll_hunter', 'site-assets'
  ]);
  for (const file of siteFiles.filter((name) => !['index.html', 'site-assets/styles.css'].includes(name))) {
    assert.equal(await readFile(path.join(output, file), 'utf8'), await readFile(path.join(projectRoot, file), 'utf8'));
  }
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  for (const value of ['Иван Брежнев', '/lifesim/', '/deadweed/', '/scroll_hunter/', 'Scroll Hunter', '/dark_pool/', 'Dark Pool', '/rus_vs_yashcher/', 'Русы против ящеров', 'https://t.me/Ucicke', 'https://vk.ru/ibrezh', 'https://www.youtube.com/@Ucicke', 'https://github.com/Ucicke', 'https://t.me/indiegameforge']) {
    assert.ok(html.includes(value), value);
  }
  for (const { slug } of pageGameBundles) {
    assert.ok((await readdir(path.join(output, slug))).includes('index.html'), slug);
  }
  assert.doesNotMatch(html, /\{#each|\{profile\.|\/_app\/|telegram-web-app|cdn\.tailwindcss|unpkg|jsdelivr/i);
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.match(scripts[0][1], /^\/site-assets\/site\.js\?v=[a-f0-9]{12}$/);
  assert.equal((html.match(/<script\b/g) || []).length, 1);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  const cssVersion = createHash('sha256').update(await readFile(path.join(output, 'site-assets/styles.css'))).digest('hex').slice(0, 12);
  assert.ok(html.includes(`/site-assets/styles.css?v=${cssVersion}`));
  const css = await readFile(path.join(output, 'site-assets/styles.css'), 'utf8');
  assert.doesNotMatch(css, /@import\s*["']tailwindcss|@source\s|@theme\s/);
  assert.ok(css.includes('.flex{display:flex}'));
  for (const asset of siteFiles.filter((name) => name.startsWith('site-assets/'))) {
    const version = createHash('sha256').update(await readFile(path.join(output, asset))).digest('hex').slice(0, 12);
    assert.ok(html.includes(`/${asset}?v=${version}`), asset);
  }
});

test('build publishes static games under the GitHub Pages project URL', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'ucicke-pages-'));
  await build(output, { basePath: '/My_Site/', gameOrigin: 'https://ucicke.ru' });
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const cssVersion = createHash('sha256').update(await readFile(path.join(output, 'site-assets/styles.css'))).digest('hex').slice(0, 12);
  assert.ok(html.includes('href="/My_Site/" aria-label="Ucicke, главная"'));
  assert.ok(html.includes(`href="/My_Site/site-assets/styles.css?v=${cssVersion}"`));
  assert.ok(html.includes('src="/My_Site/site-assets/cover-rus-vs-yashcher.svg?v='));
  assert.ok(html.includes('href="https://ucicke.ru/lifesim/"'));
  for (const { slug } of pageGameBundles) {
    assert.ok(html.includes(`href="/My_Site/${slug}/"`), slug);
    assert.ok((await readdir(path.join(output, slug))).includes('index.html'), slug);
  }
  assert.doesNotMatch(html, /href="https:\/\/ucicke\.ru\/(?:deadweed|scroll_hunter|rus_vs_yashcher)\//);
  assert.doesNotMatch(html, /href="\/(?:lifesim|deadweed|scroll_hunter|dark_pool|rus_vs_yashcher)\//);
});

test('deployment publishes only site-owned links under a shared lock', async () => {
  const script = await readFile(new URL('../deploy/publish.sh', import.meta.url), 'utf8');
  assert.ok(script.includes('flock -x 9'));
  assert.ok(script.includes('"$DOCROOT.deploy.lock"'));
  assert.doesNotMatch(script, /systemctl|\/api\/|\/lifesim\/|\/deadweed\/|rm -rf/);
  assert.ok(script.includes('"$DOCROOT/index.html"'));
  assert.ok(script.includes('"$DOCROOT/site-assets"'));
});
