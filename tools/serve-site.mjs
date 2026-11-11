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
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch (err) {
    // A malformed escape such as %E0%A4%A. Refuse it; do not exit.
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('no');
    return;
  }
  // A folder without its trailing slash goes to the slash form, as GitHub
  // Pages does, so relative links on that page still resolve.
  if (!rel.endsWith('index.html') && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    res.writeHead(301, { location: url.pathname + '/' + url.search });
    res.end();
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
