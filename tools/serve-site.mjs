import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] || process.env.ORBIT_MATCH_PORT || 8131);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(function (req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('no');
    return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const type = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

server.listen(port, '127.0.0.1', function () {
  process.stdout.write('orbit match site http://127.0.0.1:' + port + '/\n');
});
