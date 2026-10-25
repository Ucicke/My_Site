import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot, siteFiles } from './build.mjs';

const port = Number(process.env.PORT || 4174);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!siteFiles.includes(name)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found. Games run at https://ucicke.ru/lifesim/ and /deadweed/.');
    return;
  }
  try {
    const data = await readFile(path.join(projectRoot, name));
    response.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store' });
    response.end(data);
  } catch {
    response.writeHead(500);
    response.end('Cannot read site file');
  }
}).listen(port, '127.0.0.1', () => console.log(`Website preview: http://127.0.0.1:${port}/`));
