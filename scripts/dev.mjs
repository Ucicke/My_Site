import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { build, projectRoot, siteFiles } from './build.mjs';

const port = Number(process.env.PORT || 4174);
const output = path.join(projectRoot, 'dist');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
};
await build(output);
let pending = Promise.resolve();
let timer;
const scheduleBuild = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    pending = pending.then(() => build(output)).then(() => console.log('Website updated.')).catch((error) => console.error('Build failed:', error.message));
  }, 100);
};
watch(projectRoot, (_, filename) => { if (filename === 'index.html') scheduleBuild(); });
watch(path.join(projectRoot, 'site-assets'), (_, filename) => {
  if (filename && siteFiles.includes(`site-assets/${filename}`)) scheduleBuild();
});

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!siteFiles.includes(name)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found.');
    return;
  }
  try {
    await pending;
    const data = await readFile(path.join(output, name));
    response.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store' });
    response.end(data);
  } catch {
    response.writeHead(500);
    response.end('Cannot read site file');
  }
}).listen(port, '127.0.0.1', () => console.log(`Website preview: http://127.0.0.1:${port}/`));
