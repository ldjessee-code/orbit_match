const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
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

function storedDays(storage) {
  const parsed = JSON.parse(storage.getItem('orbit-match-viewer-state'));
  return parsed.systems['tau-ceti'].elapsed_days;
}

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const queue = [];
  return {
    now: function () { return now; },
    requestFrame: function (fn) {
      const id = nextId++;
      queue.push({ id: id, fn: fn });
      return id;
    },
    cancelFrame: function (id) {
      const at = queue.findIndex(function (item) { return item.id === id; });
      if (at >= 0) queue.splice(at, 1);
    },
    pump: function (t) {
      now = t;
      const item = queue.shift();
      assert.ok(item, 'expected a frame');
      item.fn(t);
    },
    pending: function () { return queue.length; }
  };
}

function el(tag, attrs) {
  const node = {
    tagName: String(tag).toUpperCase(),
    attrs: {},
    children: [],
    parent: null,
    listeners: {},
    textContent: '',
    value: '',
    id: '',
    getAttribute: function (name) {
      if (name === 'id') return this.id || null;
      return this.attrs[name] == null ? null : String(this.attrs[name]);
    },
    setAttribute: function (name, value) {
      this.attrs[name] = String(value);
      if (name === 'id') this.id = String(value);
      if (name === 'value') this.value = String(value);
    },
    addEventListener: function (type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    appendChild: function (child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    remove: function () {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter(function (child) { return child !== node; });
      this.parent = null;
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
    }
  };
  Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
  return node;
}

function matches(node, sel) {
  if (!node || !node.tagName) return false;
  if (sel.charAt(0) === '#') return node.id === sel.slice(1);
  if (sel === 'option') return node.tagName === 'OPTION';
  if (sel === 'button[data-days]') return node.tagName === 'BUTTON' && node.getAttribute('data-days') != null;
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

function click(node) {
  let current = node;
  const event = { target: node };
  while (current) {
    ((current.listeners && current.listeners.click) || []).forEach(function (fn) { fn(event); });
    current = current.parent;
  }
}

function dockFixture() {
  const dock = el('div', { class: 'dock' });
  const reverse = el('button', { id: 'play-reverse', type: 'button' });
  const pause = el('button', { id: 'play-pause', type: 'button' });
  const forward = el('button', { id: 'play-forward', type: 'button' });
  const select = el('select', { id: 'play-speed' });
  [-10, -1, 1, 10].forEach(function (days) {
    dock.appendChild(el('button', { type: 'button', 'data-days': String(days) }));
  });
  [reverse, pause, forward, select].forEach(function (node) { dock.appendChild(node); });
  return { dock: dock, reverse: reverse, pause: pause, forward: forward, select: select };
}

function optionValues(select) {
  return select.querySelectorAll('option').map(function (option) { return option.value; });
}

test('SVG dock markup is paused at 1 day per second and hides the hour speed', function () {
  const page = read('site/viewer/index.html');
  assert.match(page, /id="play-reverse"/);
  assert.match(page, /id="play-pause"/);
  assert.match(page, /id="play-forward"/);
  assert.match(page, /id="play-speed"/);
  assert.match(page, /id="time-back-10"/);
  assert.match(page, /id="time-back"/);
  assert.match(page, /id="time-fwd"/);
  assert.match(page, /id="time-fwd-10"/);
  assert.match(page, /data-days="-10"/);
  assert.match(page, /data-days="-1"/);
  assert.match(page, /data-days="1"/);
  assert.match(page, /data-days="10"/);
  assert.match(page, /id="play-pause"[^>]*aria-pressed="true"/);
  assert.match(page, /id="play-forward"[^>]*aria-pressed="false"/);
  assert.match(page, /id="play-reverse"[^>]*aria-pressed="false"/);
  assert.match(page, /<option value="d1" selected>1 day\/sec<\/option>/);
  assert.doesNotMatch(page, /value="h1"/);
  assert.doesNotMatch(page, /1 hour\/sec/);
  assert.doesNotMatch(page, /paused/i);
});

test('SVG viewer plays, reverses, pauses, and still steps the shared clock', async function () {
  const viewer = await import('../site/viewer/viewer.js');
  const storage = memoryStorage();
  const frames = fakeClock();
  const ui = dockFixture();
  let paints = 0;
  const ctrl = viewer.bindTimeDock({
    document: { createElement: function (tag) { return el(tag); } },
    dock: ui.dock,
    window: { addEventListener: function () {} },
    storage: storage,
    systemId: 'tau-ceti',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    onPaint: function () { paints += 1; }
  });
  assert.equal(ctrl.getState().playing, false);
  assert.equal(ctrl.getState().direction, 1);
  assert.equal(ctrl.getState().speed, 'd1');
  assert.equal(ui.pause.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.forward.getAttribute('aria-pressed'), 'false');

  click(ui.forward);
  frames.pump(0);
  frames.pump(250);
  frames.pump(500);
  frames.pump(750);
  frames.pump(1000);
  assert.ok(Math.abs(storedDays(storage) - 1) < 1e-9);
  assert.ok(paints > 0);
  assert.equal(ui.forward.getAttribute('aria-pressed'), 'true');

  click(ui.reverse);
  frames.pump(1250);
  frames.pump(1500);
  frames.pump(1750);
  frames.pump(2000);
  assert.ok(Math.abs(ctrl.elapsed() - 0) < 1e-9, String(ctrl.elapsed()));
  click(ui.pause);
  assert.equal(ctrl.getState().playing, false);
  assert.equal(frames.pending(), 0);
  const parked = storedDays(storage);

  const steps = {};
  ui.dock.querySelectorAll('button[data-days]').forEach(function (button) {
    steps[button.getAttribute('data-days')] = button;
  });
  let expectDays = parked;
  ['-10', '-1', '1', '10'].forEach(function (days) {
    click(steps[days]);
    expectDays += Number(days);
    assert.equal(storedDays(storage), expectDays);
  });

  click(ui.forward);
  frames.pump(3000);
  frames.pump(3250);
  const before = ctrl.elapsed();
  ['-10', '-1', '1', '10'].forEach(function (days) { click(steps[days]); });
  assert.ok(Math.abs(ctrl.elapsed() - before) < 1e-9);
  assert.equal(ctrl.getState().playing, true);
  click(ui.pause);
  const client = read('site/viewer/viewer.js');
  assert.match(client, /playback\.js/);
  assert.match(client, /viewAtClock/);
  assert.match(client, /viewerState\(\)/);
  assert.match(client, /requestAnimationFrame/);
  assert.match(client, /function showFrame[\s\S]*setClose\(frame !== 'system'\)/);
});

test('SVG hour speed returns to 1 day per second when the close view closes', async function () {
  const viewer = await import('../site/viewer/viewer.js');
  const frames = fakeClock();
  const ui = dockFixture();
  const ctrl = viewer.bindTimeDock({
    document: { createElement: function (tag) { return el(tag); } },
    dock: ui.dock,
    storage: memoryStorage(),
    systemId: 'tau-ceti',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });
  assert.equal(optionValues(ui.select).indexOf('h1'), -1);
  ctrl.setClose(true);
  assert.ok(optionValues(ui.select).indexOf('h1') >= 0);
  ui.select.value = 'h1';
  ui.select.listeners.change.forEach(function (fn) { fn(); });
  click(ui.reverse);
  assert.equal(ctrl.getState().speed, 'h1');
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, -1);
  ctrl.setClose(false);
  assert.equal(ctrl.getState().speed, 'd1');
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, -1);
  assert.equal(ui.select.value, 'd1');
  assert.equal(optionValues(ui.select).indexOf('h1'), -1);
  assert.equal(ui.reverse.getAttribute('aria-pressed'), 'true');
});
