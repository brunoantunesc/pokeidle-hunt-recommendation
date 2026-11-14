import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const root = new URL('./', import.meta.url);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const allowed = path === '/' || path === '/web.js' || path === '/bast.js' || path === '/recomendacao.js' || /^\/guia\/(?:[\w.-]+\/)*[\w.-]+$/.test(path);
  const parts = path.split('/');
  const file = path === '/' ? '/index.html' : path;
  const type = types[extname(file)];
  if (!allowed || !type || parts.includes('..')) {
    res.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(new URL('.' + file, root));
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }).end(content);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
}).listen(3000, '127.0.0.1', () => console.log('http://127.0.0.1:3000'));


