import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 8767);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4', '.glb':'model/gltf-binary', '.txt':'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path = resolve(root, '.' + pathname);
    if (!path.startsWith(resolve(root) + sep) && path !== resolve(root)) throw Error('Invalid path');
    if (pathname.split('/').some(p => p.startsWith('.') || p === 'node_modules')) { res.writeHead(404); res.end(); return; }
    let info = await stat(path);
    if (info.isDirectory()) { path = resolve(path, 'index.html'); info = await stat(path); }
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + info.size }); res.end(); return; }
      res.writeHead(206, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + info.size, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') res.end(); else createReadStream(path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': info.size });
      if (req.method === 'HEAD') res.end(); else createReadStream(path).pipe(res);
    }
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log('Orbit design preview: http://127.0.0.1:' + port));
