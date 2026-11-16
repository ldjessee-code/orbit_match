'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const serveScript = path.join(repo, 'tools', 'serve-site.mjs');
const site = path.join(repo, 'site');

function freePort() {
  return new Promise(function (resolve, reject) {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', function () {
      const port = server.address().port;
      server.close(function () { resolve(port); });
    });
  });
}

function request(port, hostHeader, reqPath) {
  return new Promise(function (resolve, reject) {
    const req = http.request({
      host: '127.0.0.1',
      port: port,
      path: reqPath || '/',
      method: 'GET',
      headers: { Host: hostHeader },
      timeout: 3000
    }, function (res) {
      const chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.end();
  });
}

function startServe(port) {
  const child = spawn(process.execPath, [serveScript, String(port)], {
    cwd: repo,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let err = '';
  child.stdout.on('data', function (buf) { out += buf.toString('utf8'); });
  child.stderr.on('data', function (buf) { err += buf.toString('utf8'); });
  return {
    child: child,
    text: function () { return out; },
    err: function () { return err; }
  };
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve();
  return new Promise(function (resolve) {
    child.once('exit', function () { resolve(); });
    child.kill();
    setTimeout(function () {
      if (child.exitCode === null) {
        try { child.kill(); } catch (err) { /* already gone */ }
      }
      resolve();
    }, 500);
  });
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error('timed out waiting for exit'));
    }, timeoutMs);
    child.once('exit', function (code) {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function waitUntilUp(port) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < 4000) {
    try {
      await request(port, '127.0.0.1', '/');
      return;
    } catch (err) {
      last = err;
      await new Promise(function (resolve) { setTimeout(resolve, 40); });
    }
  }
  throw last || new Error('server did not listen');
}

function listenStub(handler) {
  return new Promise(function (resolve, reject) {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

function closeServer(server) {
  return new Promise(function (resolve) { server.close(function () { resolve(); }); });
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

test('TS31 serve-site binds 127.0.0.1 only', async function () {
  const source = fs.readFileSync(serveScript, 'utf8');
  assert.match(source, /listen\(\s*port\s*,\s*'127\.0\.0\.1'/);
  assert.equal(source.includes('0.0.0.0'), false);
  assert.equal(source.includes('100.115.211.45'), false);
  const port = await freePort();
  const running = startServe(port);
  try {
    await waitUntilUp(port);
    assert.match(running.text(), /127\.0\.0\.1/);
    const res = await request(port, '127.0.0.1', '/');
    assert.equal(res.status, 200);
  } finally {
    await stopChild(running.child);
  }
});

test('TS32 serve-site accepts the tailnet Host', async function () {
  const port = await freePort();
  const running = startServe(port);
  try {
    await waitUntilUp(port);
    const res = await request(port, 'pc.tail67a118.ts.net:8443', '/');
    assert.equal(res.status, 200);
  } finally {
    await stopChild(running.child);
  }
});

test('TS33 serve-site accepts localhost and 127.0.0.1', async function () {
  const port = await freePort();
  const running = startServe(port);
  try {
    await waitUntilUp(port);
    const byName = await request(port, 'localhost', '/');
    const byAddr = await request(port, '127.0.0.1:' + port, '/');
    assert.equal(byName.status, 200);
    assert.equal(byAddr.status, 200);
  } finally {
    await stopChild(running.child);
  }
});

test('TS34 serve-site refuses a foreign Host', async function () {
  const port = await freePort();
  const running = startServe(port);
  try {
    await waitUntilUp(port);
    const foreign = await request(port, 'evil.example', '/');
    const lookalike = await request(port, 'pc.tail67a118.ts.net.evil.com', '/');
    assert.equal(foreign.status, 403, 'NOT IMPLEMENTED: foreign Host must be 403, got ' + foreign.status);
    assert.equal(lookalike.status, 403, 'NOT IMPLEMENTED: lookalike Host must be 403, got ' + lookalike.status);
  } finally {
    await stopChild(running.child);
  }
});

test('TS35 serve-site answers /healthz', async function () {
  const port = await freePort();
  const running = startServe(port);
  try {
    await waitUntilUp(port);
    const res = await request(port, '127.0.0.1', '/healthz');
    assert.equal(res.status, 200, 'NOT IMPLEMENTED: /healthz got ' + res.status);
    assert.match(res.body, /orbit-match/);
  } finally {
    await stopChild(running.child);
  }
});

test('TS36 a second start exits 0 when orbit-match healthz answers', async function () {
  const stub = await listenStub(function (req, res) {
    if ((req.url || '').split('?')[0] === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true,"app":"orbit-match"}');
      return;
    }
    res.writeHead(404);
    res.end('no');
  });
  const port = stub.address().port;
  const running = startServe(port);
  try {
    const code = await waitForExit(running.child, 4000);
    assert.equal(code, 0, 'NOT IMPLEMENTED: second start exit ' + code + ' ' + running.err());
    assert.match(running.text(), /already running/i);
  } finally {
    await stopChild(running.child);
    await closeServer(stub);
  }
});

test('TS37 site pages use no absolute loopback or file urls', function () {
  const files = walk(site, []);
  const bad = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.html', '.js', '.css', '.svg', '.json', '.mjs'].includes(ext)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (/https?:\/\/127\.0\.0\.1/i.test(text) || /file:\/\//i.test(text)) {
      bad.push(path.relative(repo, file));
    }
  }
  assert.deepEqual(bad, []);
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.match(home, /href="css\/site\.css"/);
});

test('TS38 localhost reaches a server bound to 127.0.0.1', async function () {
  const listed = await dns.promises.lookup('localhost', { all: true });
  assert.ok(listed.length > 0);
  const server = http.createServer(function (req, res) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('pong');
  });
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  try {
    assert.equal(server.address().address, '127.0.0.1');
    const res = await new Promise(function (resolve, reject) {
      const req = http.get('http://localhost:' + port + '/probe', function (incoming) {
        const chunks = [];
        incoming.on('data', function (chunk) { chunks.push(chunk); });
        incoming.on('end', function () {
          resolve({ status: incoming.statusCode, body: Buffer.concat(chunks).toString('utf8') });
        });
      });
      req.on('error', reject);
      req.setTimeout(3000, function () { req.destroy(new Error('timeout')); });
    });
    assert.equal(res.status, 200);
    assert.equal(res.body, 'pong');
  } finally {
    await closeServer(server);
  }
});

test('TS39 start-orbit-match.ps1 stays on its configured port', function () {
  const script = path.join(repo, 'tools', 'start-orbit-match.ps1');
  assert.equal(fs.existsSync(script), true, 'NOT IMPLEMENTED: tools/start-orbit-match.ps1');
  const text = fs.readFileSync(script, 'utf8');
  assert.match(text, /serve-site\.mjs/, 'NOT IMPLEMENTED: start script must run serve-site.mjs');
  assert.match(text, /8131/, 'NOT IMPLEMENTED: start script must name port 8131');
  assert.match(text, /healthz/, 'NOT IMPLEMENTED: start script must probe /healthz');
  assert.match(text, /ORBIT_MATCH_PORT/);
  assert.doesNotMatch(text, /next free port/i, 'NOT IMPLEMENTED: service start must not move ports');
});

test('TS40 a foreign holder is not treated as orbit-match', async function () {
  const stub = await listenStub(function (req, res) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('something else');
  });
  const port = stub.address().port;
  const running = startServe(port);
  try {
    const code = await waitForExit(running.child, 4000);
    const combined = running.err() + running.text();
    assert.notEqual(code, 0, 'NOT IMPLEMENTED: foreign holder must exit non-zero');
    assert.match(combined, /not Orbit Match/, 'NOT IMPLEMENTED: foreign holder message missing: ' + combined);
  } finally {
    await stopChild(running.child);
    await closeServer(stub);
  }
});
