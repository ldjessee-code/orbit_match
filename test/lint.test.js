const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function javascriptFiles(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) javascriptFiles(full, out);
    else if (name.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('node --check passes for every site javascript file', function () {
  const site = path.join(__dirname, '..', 'site');
  const files = javascriptFiles(site, []);
  assert.ok(files.length > 0, 'expected javascript under site/');
  const failures = [];
  for (const file of files) {
    const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (run.status !== 0) {
      failures.push(path.relative(path.join(__dirname, '..'), file) + ': ' + (run.stderr || run.stdout || run.status));
    }
  }
  assert.deepEqual(failures, []);
});
