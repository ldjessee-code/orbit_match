// Unit contracts for the shared SVG and 3D loader. The page tests cover what
// a visitor sees. These cover the branches a page load does not hit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const madeUp = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/made-up-angles.system.json'), 'utf8'));
const handoff55 = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/55-cnc.handoff.json'), 'utf8'));

let common;

test.before(async function () {
  common = await import('../site/js/viewer-common.js');
});

function memoryStorage(seed) {
  const memory = Object.assign({}, seed || {});
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem: function (key, value) {
      memory[key] = String(value);
    }
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: async function () { return body; }
  };
}

async function withFetch(routes, fn) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async function (url) {
    const text = String(url);
    calls.push(text);
    const route = routes.find(function (item) { return item.match(text); });
    if (!route) return jsonResponse(404, {});
    return jsonResponse(route.status || 200, route.body);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = previous;
  }
}

function el(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    attrs: {},
    children: [],
    parent: null,
    parentNode: null,
    textContent: '',
    value: '',
    getAttribute: function (name) {
      if (name === 'id') return this.id || null;
      if (name === 'class') return this.className || null;
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute: function (name, value) {
      const text = String(value);
      if (name === 'id') this.id = text;
      else if (name === 'class') this.className = text;
      else this.attrs[name] = text;
      if (name === 'value') this.value = text;
    },
    appendChild: function (child) {
      child.parent = this;
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild: function (child) {
      this.children = this.children.filter(function (item) { return item !== child; });
      child.parent = null;
      child.parentNode = null;
      return child;
    },
    get firstChild() {
      return this.children[0] || null;
    },
    querySelectorAll: function (sel) {
      return queryAll(this, sel);
    }
  };
  return node;
}

function matches(node, sel) {
  if (!node || !node.tagName) return false;
  if (sel === 'option') return node.tagName === 'OPTION';
  if (sel === 'a[href*="viewer"]') {
    return node.tagName === 'A' && String(node.getAttribute('href') || '').indexOf('viewer') >= 0;
  }
  return false;
}

function queryAll(rootNode, sel) {
  const out = [];
  (rootNode.children || []).forEach(function (child) {
    if (matches(child, sel)) out.push(child);
    queryAll(child, sel).forEach(function (hit) { out.push(hit); });
  });
  return out;
}

test('dayText names the epoch and the days since it', function () {
  assert.equal(common.dayText(0), 'Day 0 (the epoch)');
  assert.equal(common.dayText(10), 'Day +10 since the epoch');
  assert.equal(common.dayText(-2), 'Day -2 since the epoch');
  assert.equal(common.dayText(1.5), 'Day +1.50 since the epoch');
  assert.equal(common.dayText(Number.NaN), 'Day 0 (the epoch)');
});

test('systemFromText opens a system file and says why a bad file failed', function () {
  const opened = common.systemFromText(JSON.stringify(madeUp), 'made-up.system.json');
  assert.equal(opened.star.name, 'Made Up');
  assert.equal(opened.bodies[0].id, 'demo');

  assert.throws(function () { common.systemFromText('{', 'notes.json'); }, function (err) {
    assert.equal(err.forVisitor, true);
    assert.match(err.message, /notes\.json is not valid JSON/);
    return true;
  });

  assert.throws(function () { common.systemFromText('{}', 'notes.json'); }, function (err) {
    assert.equal(err.forVisitor, true);
    assert.match(err.message, /notes\.json was not opened/);
    assert.match(err.message, /not an Orbit Match system file or a star map handoff/);
    return true;
  });
});

test('systemFromRecord accepts a star map handoff', function () {
  const opened = common.systemFromRecord(handoff55);
  assert.equal(opened.star.name, '55 Cnc');
  assert.equal(opened.source, 'handoff');
});

test('systemFromBuilder reads the system the builder stored', function () {
  const key = common.VIEW_SYSTEM_KEY;
  const storage = memoryStorage();
  storage.setItem(key, JSON.stringify(madeUp));
  const opened = common.systemFromBuilder(storage);
  assert.equal(opened.star.name, 'Made Up');

  assert.throws(function () { common.systemFromBuilder(memoryStorage()); }, function (err) {
    assert.equal(err.forVisitor, true);
    assert.match(err.message, /View this system/);
    assert.match(err.message, /open a system file/i);
    return true;
  });

  assert.throws(function () {
    common.systemFromBuilder({ getItem: function () { throw new Error('blocked'); } });
  }, /View this system/);
});

test('loadRequestedSystem uses the system file and does not ask for a handoff', async function () {
  await withFetch([
    { match: function (url) { return url.indexOf('tau-ceti.system.json') >= 0; }, body: madeUp },
    { match: function (url) { return url.indexOf('tau-ceti.view.json') >= 0; }, status: 404 }
  ], async function (calls) {
    const loaded = await common.loadRequestedSystem('?view=svg', memoryStorage(), 'tau-ceti.system.json');
    assert.equal(loaded.stem, 'tau-ceti');
    assert.equal(loaded.system.star.name, 'Made Up');
    assert.equal(loaded.view.orbit_match_view, 1);
    assert.equal(loaded.view.theme, 'empire');
    assert.deepEqual(calls, ['../data/tau-ceti.system.json', '../data/tau-ceti.view.json']);
  });
});

test('loadRequestedSystem reads a view file when the system has one', async function () {
  const view = { orbit_match_view: 1, theme: 'mardat', style: 'holo', elevation_deg: 40 };
  await withFetch([
    { match: function (url) { return url.indexOf('made-up.system.json') >= 0; }, body: madeUp },
    { match: function (url) { return url.indexOf('made-up.view.json') >= 0; }, body: view }
  ], async function (calls) {
    const loaded = await common.loadRequestedSystem('?system=made-up', null, 'tau-ceti.system.json');
    assert.equal(loaded.stem, 'made-up');
    assert.equal(loaded.view.theme, 'mardat');
    assert.equal(loaded.view.style, 'holo');
    assert.equal(loaded.view.elevation_deg, 40);
    assert.equal(calls.some(function (url) { return /handoff/.test(url); }), false);
  });
});

test('loadRequestedSystem uses a handoff only when the system file is missing', async function () {
  await withFetch([
    { match: function (url) { return url.indexOf('nope.system.json') >= 0; }, status: 404 },
    { match: function (url) { return url.indexOf('nope.handoff.json') >= 0; }, body: handoff55 },
    { match: function (url) { return url.indexOf('nope.view.json') >= 0; }, status: 404 }
  ], async function (calls) {
    const loaded = await common.loadRequestedSystem('?system=nope', null, 'tau-ceti.system.json');
    assert.equal(loaded.system.star.name, '55 Cnc');
    assert.equal(loaded.stem, 'nope');
    assert.deepEqual(calls, [
      '../data/nope.system.json',
      '../data/nope.handoff.json',
      '../data/nope.view.json'
    ]);
  });
});

test('loadRequestedSystem tells the visitor when neither file exists', async function () {
  await withFetch([], async function (calls) {
    await assert.rejects(function () {
      return common.loadRequestedSystem('?system=missing-world', null, 'tau-ceti.system.json');
    }, function (err) {
      assert.equal(err.forVisitor, true);
      assert.match(err.message, /no system file named missing-world\.system\.json/);
      assert.match(err.message, /Open a system file/);
      assert.doesNotMatch(err.message, /static server/);
      return true;
    });
    assert.deepEqual(calls, [
      '../data/missing-world.system.json',
      '../data/missing-world.handoff.json'
    ]);
  });
});

test('loadRequestedSystem refuses a system name that is not a file name', async function () {
  await withFetch([], async function (calls) {
    await assert.rejects(function () {
      return common.loadRequestedSystem('?system=../secret', null, 'tau-ceti.system.json');
    }, function (err) {
      assert.equal(err.forVisitor, true);
      assert.match(err.message, /"\.\.\/secret"/);
      assert.match(err.message, /not a system this page can open/);
      assert.doesNotMatch(err.message, /static server/);
      return true;
    });
    assert.deepEqual(calls, []);
  });
});

test('loadRequestedSystem does not treat a handoff as the system file', async function () {
  await withFetch([
    { match: function (url) { return url.indexOf('odd.system.json') >= 0; }, body: handoff55 }
  ], async function (calls) {
    await assert.rejects(function () {
      return common.loadRequestedSystem('?system=odd', null, 'tau-ceti.system.json');
    }, function (err) {
      assert.equal(err.forVisitor, true);
      assert.match(err.message, /odd\.system\.json is not an Orbit Match system file/);
      return true;
    });
    assert.deepEqual(calls, ['../data/odd.system.json']);
  });
});

test('loadRequestedSystem prefers the builder handoff over a named file', async function () {
  const storage = memoryStorage();
  storage.setItem(common.VIEW_SYSTEM_KEY, JSON.stringify(madeUp));
  await withFetch([], async function (calls) {
    const loaded = await common.loadRequestedSystem('?source=builder&system=tau-ceti', storage, 'tau-ceti.system.json');
    assert.equal(loaded.stem, 'builder');
    assert.equal(loaded.system.star.name, 'Made Up');
    assert.equal(loaded.view.theme, 'empire');
    assert.deepEqual(calls, []);
  });
});

test('loadFailText keeps a visitor message and wraps any other error', function () {
  const visitor = new Error('Use "Open a system file".');
  visitor.forVisitor = true;
  assert.equal(common.loadFailText(visitor), 'Use "Open a system file".');
  assert.equal(common.loadFailText(new Error('boom')), 'The system did not load: boom.');
});

test('tripChoices lists planets and moons and skips belts', function () {
  const rows = common.tripChoices({
    bodies: [
      { id: 'a', name: 'Alpha', kind: 'planet' },
      { id: 'belt', name: 'Dust', kind: 'belt' },
      { id: 'm', kind: 'moon' },
      { id: null, name: 'Gone', kind: 'planet' },
      null
    ]
  });
  assert.deepEqual(rows, [
    { id: 'a', name: 'Alpha' },
    { id: 'm', name: 'm' }
  ]);
  assert.deepEqual(common.tripChoices({}), []);
});

test('fillSelect writes names as text and keeps the chosen id', function () {
  const doc = { createElement: function (tag) { return el(tag); } };
  const select = el('select');
  select.appendChild(el('option'));
  common.fillSelect(doc, select, [
    { id: 'a', name: 'Alpha <b>' },
    { id: 'b', name: 'Beta' }
  ], 'b', 'No trip');
  assert.equal(select.children.length, 3);
  assert.equal(select.children[0].value, '');
  assert.equal(select.children[0].textContent, 'No trip');
  assert.equal(select.children[1].textContent, 'Alpha <b>');
  assert.equal(select.children[1].value, 'a');
  assert.equal(select.value, 'b');
  assert.doesNotThrow(function () { common.fillSelect(doc, null, [], '', ''); });
});

test('keepSystemInLinks copies system and source onto viewer links', function () {
  const doc = el('document');
  doc.baseURI = 'http://127.0.0.1:8144/viewer/?view=svg&system=tau-ceti';
  const svg = el('a');
  svg.setAttribute('href', '../viewer/?view=svg#picture');
  const three = el('a');
  three.setAttribute('href', '../viewer3d/?view=3d');
  const map = el('a');
  map.setAttribute('href', 'https://ldjessee-code.github.io/jumpgate_starroute/app.html');
  const home = el('a');
  home.setAttribute('href', '../');
  [svg, three, map, home].forEach(function (link) { doc.appendChild(link); });

  common.keepSystemInLinks(doc, '?view=svg&system=tau-ceti&source=builder');
  assert.equal(svg.getAttribute('href'), '/viewer/?view=svg&system=tau-ceti&source=builder#picture');
  assert.equal(three.getAttribute('href'), '/viewer3d/?view=3d&system=tau-ceti&source=builder');
  assert.equal(map.getAttribute('href'), 'https://ldjessee-code.github.io/jumpgate_starroute/app.html');
  assert.equal(home.getAttribute('href'), '../');

  const plain = el('a');
  plain.setAttribute('href', '../viewer3d/?view=3d');
  const quiet = el('document');
  quiet.baseURI = 'http://127.0.0.1:8144/viewer/';
  quiet.appendChild(plain);
  common.keepSystemInLinks(quiet, '?view=svg');
  assert.equal(plain.getAttribute('href'), '../viewer3d/?view=3d');
});
