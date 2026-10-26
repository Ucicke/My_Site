import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, projectRoot, siteFiles } from '../scripts/build.mjs';

test('build is self-contained and only owns portfolio files', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'ucicke-site-'));
  await build(output);
  assert.deepEqual((await readdir(output)).sort(), ['index.html', 'site-assets']);
  for (const file of siteFiles.filter((name) => !['index.html', 'site-assets/styles.css'].includes(name))) {
    assert.equal(await readFile(path.join(output, file), 'utf8'), await readFile(path.join(projectRoot, file), 'utf8'));
  }
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  for (const value of ['Иван Брежнев', '/lifesim/', '/deadweed', '/scroll_hunter/', 'Scroll Hunter', 'https://t.me/Ucicke', 'https://vk.ru/ibrezh', 'https://www.youtube.com/@Ucicke', 'https://github.com/Ucicke', 'https://t.me/indiegameforge']) {
    assert.ok(html.includes(value), value);
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

test('deployment publishes only site-owned links under a shared lock', async () => {
  const script = await readFile(new URL('../deploy/publish.sh', import.meta.url), 'utf8');
  assert.ok(script.includes('flock -x 9'));
  assert.ok(script.includes('"$DOCROOT.deploy.lock"'));
  assert.doesNotMatch(script, /systemctl|\/api\/|\/lifesim\/|\/deadweed\/|rm -rf/);
  assert.ok(script.includes('"$DOCROOT/index.html"'));
  assert.ok(script.includes('"$DOCROOT/site-assets"'));
});
