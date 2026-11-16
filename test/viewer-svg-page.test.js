// Boots the SVG viewer module against a fake document. This locks the wiring
// that viewer-common.test.js cannot see: the clock controls, the body list,
// the trip selects, and the file picker on the page.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const viewerHref = pathToFileURL(path.join(root, 'site/viewer/viewer.js')).href;

function el(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    attrs: {},
    children: [],
    parent: null,
    parentNode: null,
    listeners: {},
    textContent: '',
    value: '',
    files: null,
    innerHTML: '',
    style: {},
    hidden: false,
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
    addEventListener: function (type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
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
    remove: function () {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    get firstChild() {
      return this.children[0] || null;
    },
    querySelector: function (sel) {
      const found = queryAll(this, sel);
      return found[0] || null;
    },
    querySelectorAll: function (sel) {
      return queryAll(this, sel);
    },
    closest: function (sel) {
      let current = this;
      while (current) {
        if (matches(current, sel)) return current;
        current = current.parent;
      }
      return null;
    },
    contains: function (other) {
      let current = other;
      while (current) {
        if (current === this) return true;
        current = current.parent;
      }
      return false;
    },
    getBoundingClientRect: function () {
      return { top: 80, bottom: 100, left: 0, right: 10, width: 10, height: 20 };
    }
  };
  return node;
}

function matches(node, sel) {
  if (!node || !node.tagName) return false;
  if (sel.charAt(0) === '#') return node.id === sel.slice(1);
  if (sel.charAt(0) === '.') {
    return (' ' + node.className + ' ').indexOf(' ' + sel.slice(1) + ' ') >= 0;
  }
  if (sel === 'option') return node.tagName === 'OPTION';
  if (sel === 'button') return node.tagName === 'BUTTON';
  if (sel === 'button[data-days]') return node.tagName === 'BUTTON' && node.getAttribute('data-days') != null;
  if (sel === 'a[href*="viewer"]') {
    return node.tagName === 'A' && String(node.getAttribute('href') || '').indexOf('viewer') >= 0;
  }
  if (sel === 'svg') return node.tagName === 'SVG';
  return node.tagName === String(sel).toUpperCase();
}

function queryAll(rootNode, sel) {
  const out = [];
  (rootNode.children || []).forEach(function (child) {
    if (matches(child, sel)) out.push(child);
    queryAll(child, sel).forEach(function (hit) { out.push(hit); });
  });
  return out;
}

function add(parent, tag, attrs) {
  const node = el(tag);
  Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
  parent.appendChild(node);
  return node;
}

function createDom() {
  const doc = el('document');
  doc.baseURI = 'http://127.0.0.1:8144/viewer/?view=svg';
  doc.title = '';
  doc.createElement = function (tag) { return el(tag); };
  doc.getElementById = function (id) { return queryAll(doc, '#' + id)[0] || null; };
  const body = add(doc, 'body');
  const header = add(body, 'header');
  const nav = add(header, 'nav');
  add(nav, 'a', { href: '../' });
  add(nav, 'a', { href: '../manual/' });
  add(nav, 'a', { href: '../viewer3d/?view=3d' });
  add(nav, 'a', { id: 'star-map', href: 'https://example.invalid/map' });
  add(nav, 'a', { id: 'setting', href: 'https://example.invalid/lore' });
  const main = add(body, 'main');
  const dock = add(main, 'div', { class: 'dock' });
  add(dock, 'p', { id: 'crumbs' });
  add(add(dock, 'label'), 'input', { id: 'system-file', type: 'file' });
  add(dock, 'input', { id: 'zoom', type: 'range', value: '1' });
  add(dock, 'input', { id: 'elev', type: 'range', value: '20' });
  add(dock, 'span', { id: 'elev-value' });
  add(dock, 'select', { id: 'trip-from' });
  add(dock, 'select', { id: 'trip-to' });
  add(dock, 'button', { id: 'play-reverse', type: 'button' });
  add(dock, 'button', { id: 'play-pause', type: 'button' });
  add(dock, 'button', { id: 'play-forward', type: 'button' });
  add(dock, 'select', { id: 'play-speed' });
  [['time-back-10', '-10'], ['time-back', '-1'], ['time-fwd', '1'], ['time-fwd-10', '10']].forEach(function (pair) {
    add(dock, 'button', { id: pair[0], type: 'button', 'data-days': pair[1] });
  });
  add(dock, 'input', { id: 'goto-day', type: 'number' });
  add(dock, 'button', { id: 'goto-day-go', type: 'button' });
  add(dock, 'button', { id: 'reset-epoch', type: 'button' });
  add(dock, 'button', { id: 'resource-toggle', type: 'button' });
  add(dock, 'p', { id: 'clock-day' });
  add(dock, 'p', { id: 'readout' });
  add(main, 'p', { id: 'load-status' });
  const viewerBody = add(main, 'div');
  add(viewerBody, 'div', { id: 'sky' });
  add(viewerBody, 'ul', { id: 'body-list' });
  return doc;
}

function memoryStorage() {
  const memory = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem: function (key, value) {
      memory[key] = String(value);
    }
  };
}

function click(node) {
  let current = node;
  const event = { target: node };
  while (current) {
    ((current.listeners && current.listeners.click) || []).forEach(function (fn) { fn(event); });
    current = current.parent;
  }
}

function fire(node, type) {
  const event = { target: node };
  ((node.listeners && node.listeners[type]) || []).forEach(function (fn) { fn(event); });
}

function buttonNames(doc) {
  return doc.getElementById('body-list').querySelectorAll('button').map(function (button) {
    return button.textContent;
  });
}

function optionNames(select) {
  return select.querySelectorAll('option').map(function (option) { return option.textContent; });
}

function systemFile(name, starName, bodyName) {
  return {
    orbit_match: 2,
    kind: 'system',
    star: { name: starName, hostname: starName, mass_solar: 1 },
    bodies: [
      { id: 'demo', name: bodyName, kind: 'planet', orbit: { a_au: 1, e: 0, period_days: 365 } },
      { id: 'dust', name: 'Dust', kind: 'belt', orbit: { a_inner_au: 2, a_outer_au: 3 } }
    ],
    note: name
  };
}

function fetchFor(files) {
  const calls = [];
  const impl = async function (url) {
    const text = String(url);
    calls.push(text);
    const name = Object.keys(files).find(function (key) { return text.indexOf(key) >= 0; });
    if (!name) return { ok: false, status: 404, json: async function () { return {}; } };
    return { ok: true, status: 200, json: async function () { return files[name]; } };
  };
  impl.calls = calls;
  return impl;
}

let bootCount = 0;

async function boot(search, fetchImpl) {
  bootCount += 1;
  const doc = createDom();
  const storage = memoryStorage();
  globalThis.document = doc;
  globalThis.localStorage = storage;
  globalThis.location = {
    search: search,
    href: 'http://127.0.0.1:8144/viewer/' + search,
    replace: function () { throw new Error('the SVG page left for ' + search); },
    assign: function () { throw new Error('the SVG page left for ' + search); }
  };
  globalThis.window = {
    addEventListener: function () {},
    innerHeight: 900,
    location: globalThis.location,
    localStorage: storage
  };
  globalThis.fetch = fetchImpl;
  await import(viewerHref + '?svg-page=' + bootCount);
  return doc;
}

async function waitFor(read, label) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < 4000) {
    last = read() || '';
    if (last) return last;
    await new Promise(function (done) { setTimeout(done, 15); });
  }
  const status = globalThis.document.getElementById('load-status');
  throw new Error(label + ' stayed empty. status=' + (status ? status.textContent : ''));
}

function FileReaderShim() {}
FileReaderShim.prototype.readAsText = function (file) {
  this.result = file.body;
  if (typeof this.onload === 'function') this.onload();
};
FileReaderShim.prototype.onerror = null;
FileReaderShim.prototype.onload = null;

test('SVG page clock, trips, body list, links, and file picker', { timeout: 20000 }, async function () {
  globalThis.FileReader = FileReaderShim;
  const loaded = systemFile('made-up.system.json', 'Made Up', 'Demo');
  const opened = {
    orbit_match: 2,
    kind: 'system',
    star: { name: 'Opened Star', hostname: 'Opened Star', mass_solar: 1 },
    bodies: [{ id: 'only', name: 'Only', kind: 'planet', orbit: { a_au: 2, e: 0, period_days: 700 } }]
  };
  const fetchImpl = fetchFor({
    'made-up.system.json': loaded,
    'empire.json': {},
    'quiet.json': {}
  });
  const doc = await boot('?view=svg&system=made-up', fetchImpl);
  const clock = doc.getElementById('clock-day');
  await waitFor(function () { return clock.textContent; }, 'clock');

  assert.equal(clock.textContent, 'Day 0 (the epoch)');
  assert.equal(fetchImpl.calls.some(function (url) { return /handoff/.test(url); }), false);
  assert.deepEqual(buttonNames(doc), ['Made Up', 'Demo', 'Dust']);
  const from = optionNames(doc.getElementById('trip-from'));
  const to = optionNames(doc.getElementById('trip-to'));
  assert.deepEqual(from, ['No trip', 'Demo']);
  assert.deepEqual(to, ['No trip', 'Demo']);
  const three = doc.querySelectorAll('a[href*="viewer"]').filter(function (link) {
    return String(link.getAttribute('href')).indexOf('viewer3d') >= 0;
  })[0];
  assert.equal(three.getAttribute('href'), '/viewer3d/?view=3d&system=made-up');
  assert.equal(doc.getElementById('star-map').getAttribute('href'), 'https://example.invalid/map');

  click(doc.getElementById('time-fwd-10'));
  assert.equal(clock.textContent, 'Day +10 since the epoch');
  doc.getElementById('goto-day').value = '4';
  click(doc.getElementById('goto-day-go'));
  assert.equal(clock.textContent, 'Day +4 since the epoch');
  click(doc.getElementById('reset-epoch'));
  assert.equal(clock.textContent, 'Day 0 (the epoch)');

  const picker = doc.getElementById('system-file');
  picker.files = [{ name: 'bad.json', body: '{' }];
  fire(picker, 'change');
  assert.match(doc.getElementById('load-status').textContent, /bad\.json is not valid JSON/);
  assert.match(doc.getElementById('load-status').textContent, /did not change/);
  assert.deepEqual(buttonNames(doc), ['Made Up', 'Demo', 'Dust']);

  picker.files = [{ name: 'opened.system.json', body: JSON.stringify(opened) }];
  fire(picker, 'change');
  assert.match(doc.getElementById('load-status').textContent, /Opened opened\.system\.json/);
  assert.equal(doc.title, 'Opened Star — Orbit Match');
  assert.deepEqual(buttonNames(doc), ['Opened Star', 'Only']);
  assert.deepEqual(optionNames(doc.getElementById('trip-from')), ['No trip', 'Only']);
});

test('SVG page says a missing system is missing and does not blame the server', { timeout: 20000 }, async function () {
  const fetchImpl = fetchFor({});
  const doc = await boot('?view=svg&system=missing-world', fetchImpl);
  const status = await waitFor(function () { return doc.getElementById('load-status').textContent; }, 'status');
  assert.match(status, /no system file named missing-world\.system\.json/);
  assert.match(status, /Open a system file/);
  assert.doesNotMatch(status, /static server/);
  assert.ok(fetchImpl.calls.some(function (url) { return /missing-world\.handoff\.json/.test(url); }));
});
