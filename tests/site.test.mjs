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
    'dark_pool', 'deadweed', 'index.html', 'merge_rpg', 'rus_vs_yashcher', 'scroll_hunter', 'site-assets'
  ]);
  for (const file of siteFiles.filter((name) => !['index.html', 'site-assets/styles.css'].includes(name))) {
    assert.equal(await readFile(path.join(output, file), 'utf8'), await readFile(path.join(projectRoot, file), 'utf8'));
  }
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  for (const value of ['Иван Брежнев', '/lifesim/', '/deadweed/', '/scroll_hunter/', 'Scroll Hunter', '/dark_pool/', 'Dark Pool', '/rus_vs_yashcher/', 'Русы против ящеров', '/merge_rpg/', 'Merge RPG', 'В РАЗРАБОТКЕ', 'https://t.me/Ucicke', 'https://vk.ru/ibrezh', 'https://www.youtube.com/@Ucicke', 'https://github.com/Ucicke', 'https://t.me/indiegameforge']) {
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
  await build(output, { basePath: '/indie-game-forge/', gameOrigin: 'https://ucicke.ru' });
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  const cssVersion = createHash('sha256').update(await readFile(path.join(output, 'site-assets/styles.css'))).digest('hex').slice(0, 12);
  assert.ok(html.includes('href="/indie-game-forge/" aria-label="Indie Game Forge — главная"'));
  assert.ok(html.includes(`href="/indie-game-forge/site-assets/styles.css?v=${cssVersion}"`));
  assert.ok(html.includes('src="/indie-game-forge/site-assets/cover-rus-vs-yashcher.svg?v='));
  assert.ok(html.includes('src="/indie-game-forge/site-assets/cover-merge-rpg.svg?v='));
  assert.ok(html.includes('href="https://ucicke.ru/lifesim/"'));
  for (const { slug } of pageGameBundles) {
    assert.ok(html.includes(`href="/indie-game-forge/${slug}/"`), slug);
    assert.ok((await readdir(path.join(output, slug))).includes('index.html'), slug);
  }
  assert.doesNotMatch(html, /href="https:\/\/ucicke\.ru\/(?:deadweed|scroll_hunter|rus_vs_yashcher|merge_rpg)\//);
  assert.doesNotMatch(html, /href="\/(?:lifesim|deadweed|scroll_hunter|dark_pool|rus_vs_yashcher|merge_rpg)\//);
});

test('deployment publishes only site-owned links under a shared lock', async () => {
  const script = await readFile(new URL('../deploy/publish.sh', import.meta.url), 'utf8');
  assert.ok(script.includes('flock -x 9'));
  assert.ok(script.includes('"$DOCROOT.deploy.lock"'));
  assert.doesNotMatch(script, /systemctl|\/api\/|\/lifesim\/|\/deadweed\/|rm -rf/);
  assert.ok(script.includes('"$DOCROOT/index.html"'));
  assert.ok(script.includes('"$DOCROOT/site-assets"'));
});

test('root and GitHub Pages builds publish the accessible Indie Game Forge lockup', async () => {
  const rootOutput = await mkdtemp(path.join(os.tmpdir(), 'ifg-root-brand-'));
  await build(rootOutput);
  assert.ok(siteFiles.includes('site-assets/brand-mark.svg'), 'brand SVG must be in the explicit site allowlist');

  const rootHtml = await readFile(path.join(rootOutput, 'index.html'), 'utf8');
  assert.equal((rootHtml.match(/class="wordmark-label"/g) || []).length, 2);
  assert.match(rootHtml, /aria-label="Indie Game Forge — главная"/);
  assert.match(rootHtml, /aria-label="Indie Game Forge, в начало страницы"/);
  assert.match(rootHtml, /property="og:site_name" content="Indie Game Forge"/);
  assert.match(rootHtml, /Indie Game Forge/);
  assert.match(rootHtml, /Иван Брежнев/);
  assert.match(rootHtml, /https:\/\/ucicke\.ru\//);
  assert.match(rootHtml, /Игры\s*<span[^>]*>\(06\)<\/span>/);
  assert.match(rootHtml, /aria-label="Написать в Telegram"/);
  for (const route of ['/lifesim/', '/deadweed/', '/scroll_hunter/', '/dark_pool/', '/rus_vs_yashcher/', '/merge_rpg/']) {
    assert.ok(rootHtml.includes(route), route);
  }
  const mark = await readFile(path.join(rootOutput, 'site-assets', 'brand-mark.svg'), 'utf8');
  assert.equal(mark, await readFile(path.join(projectRoot, 'site-assets', 'brand-mark.svg'), 'utf8'));

  const pagesOutput = await mkdtemp(path.join(os.tmpdir(), 'ifg-pages-brand-'));
  await build(pagesOutput, { basePath: '/indie-game-forge/', gameOrigin: 'https://ucicke.ru' });
  const pagesHtml = await readFile(path.join(pagesOutput, 'index.html'), 'utf8');
  assert.ok(pagesHtml.includes('href="/indie-game-forge/" aria-label="Indie Game Forge — главная"'));
  assert.ok(pagesHtml.includes('/indie-game-forge/site-assets/brand-mark.svg?v='));
  assert.equal(await readFile(path.join(pagesOutput, 'site-assets', 'brand-mark.svg'), 'utf8'), mark);
});

test('four static game bundles carry their source brand mark and preserve the two hosting exclusions', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'ifg-game-brand-packages-'));
  await build(output);

  const expected = ['dark_pool', 'deadweed', 'rus_vs_yashcher', 'scroll_hunter'];
  const bundleSlugs = pageGameBundles.map(({ slug }) => slug).sort();
  assert.deepEqual(bundleSlugs, ['dark_pool', 'deadweed', 'merge_rpg', 'rus_vs_yashcher', 'scroll_hunter']);
  assert.ok(!bundleSlugs.includes('lifesim'));

  for (const slug of expected) {
    const packagedMark = await readFile(path.join(output, slug, 'assets', 'brand-mark.svg'));
    const sourceMark = await readFile(path.join(projectRoot, 'pages-games', slug, 'assets', 'brand-mark.svg'));
    const packagedHtml = await readFile(path.join(output, slug, 'index.html'), 'utf8');
    assert.ok(packagedHtml.includes('assets/brand-mark.svg'), slug);
    assert.deepEqual(packagedMark, sourceMark, slug);
  }

  const mergePackage = path.join(output, 'merge_rpg');
  const mergeEntries = new Set(await readdir(mergePackage));
  const mergeIndex = await readFile(path.join(mergePackage, 'index.html'));
  const isPortfolioPlaceholder = createHash('sha256').update(mergeIndex).digest('hex') ===
    '40107c77bde077cff748efe7773d44acd76579294a0aff95cde9edd82325ce7b';
  const isAlreadyPublishedPackage = ['assets', 'src', 'styles'].every((entry) => mergeEntries.has(entry));
  assert.ok(isPortfolioPlaceholder || isAlreadyPublishedPackage, 'preserve the placeholder or an already-published Merge RPG package');
  await assert.rejects(readFile(path.join(output, 'lifesim', 'index.html')), { code: 'ENOENT' });
});
