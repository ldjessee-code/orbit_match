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

function storedDays(storage, systemId) {
  const parsed = JSON.parse(storage.getItem('orbit-match-viewer-state'));
  return parsed.systems[systemId || 'tau-ceti'].elapsed_days;
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

function fakeWindow() {
  const listeners = {};
  return {
    addEventListener: function (type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    emit: function (type, event) {
      (listeners[type] || []).forEach(function (fn) { fn(event); });
    }
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

function bind(viewer, storage, frames, ui, extra) {
  return viewer.bindTimeDock(Object.assign({
    document: { createElement: function (tag) { return el(tag); } },
    dock: ui.dock,
    storage: storage,
    systemId: 'demo',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  }, extra || {}));
}

test('3D dock markup is paused at 1 day per second and hides the hour speed', function () {
  const page = read('site/viewer3d/index.html');
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

test('3D viewer plays, reverses, pauses, and still steps the shared clock', async function () {
  const viewer = await import('../site/viewer3d/viewer3d.js');
  const storage = memoryStorage();
  const frames = fakeClock();
  const ui = dockFixture();
  let paints = 0;
  const ctrl = bind(viewer, storage, frames, ui, {
    onPaint: function () { paints += 1; }
  });
  assert.equal(ctrl.getState().playing, false);
  assert.equal(ctrl.getState().speed, 'd1');
  assert.equal(ui.pause.getAttribute('aria-pressed'), 'true');

  click(ui.forward);
  frames.pump(0);
  frames.pump(250);
  frames.pump(500);
  frames.pump(750);
  frames.pump(1000);
  assert.ok(Math.abs(storedDays(storage, 'demo') - 1) < 1e-9);
  assert.ok(paints > 0);

  click(ui.reverse);
  frames.pump(1250);
  frames.pump(1500);
  frames.pump(1750);
  frames.pump(2000);
  assert.ok(Math.abs(ctrl.elapsed() - 0) < 1e-9, String(ctrl.elapsed()));
  click(ui.pause);
  assert.equal(frames.pending(), 0);

  const steps = {};
  ui.dock.querySelectorAll('button[data-days]').forEach(function (button) {
    steps[button.getAttribute('data-days')] = button;
  });
  let expectDays = ctrl.elapsed();
  ['-10', '-1', '1', '10'].forEach(function (days) {
    click(steps[days]);
    expectDays += Number(days);
    assert.equal(storedDays(storage, 'demo'), expectDays);
  });
  click(ui.forward);
  frames.pump(3000);
  frames.pump(3250);
  const before = ctrl.elapsed();
  ['-10', '-1', '1', '10'].forEach(function (days) { click(steps[days]); });
  assert.ok(Math.abs(ctrl.elapsed() - before) < 1e-9);
  assert.equal(ctrl.getState().playing, true);
  click(ui.pause);

  const client = read('site/viewer3d/viewer3d.js');
  assert.match(client, /playback\.js/);
  assert.match(client, /viewAtClock/);
  assert.match(client, /viewerState\(\)/);
  assert.match(client, /requestAnimationFrame/);
  assert.match(client, /setClose\(frame !== 'system'\)/);
  assert.doesNotMatch(client, /positionCache|cachedPositions/);
});

test('3D hour speed returns to 1 day per second when the close view closes', async function () {
  const viewer = await import('../site/viewer3d/viewer3d.js');
  const frames = fakeClock();
  const ui = dockFixture();
  const ctrl = bind(viewer, memoryStorage(), frames, ui);
  assert.equal(optionValues(ui.select).indexOf('h1'), -1);
  ctrl.setClose(true);
  ui.select.value = 'h1';
  ui.select.listeners.change.forEach(function (fn) { fn(); });
  click(ui.forward);
  assert.equal(ctrl.getState().speed, 'h1');
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, 1);
  ctrl.setClose(false);
  assert.equal(ctrl.getState().speed, 'd1');
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, 1);
  assert.equal(ui.select.value, 'd1');
  assert.equal(optionValues(ui.select).indexOf('h1'), -1);
});

test('a clock write on one page repaints the other at the same angles', async function () {
  const svg = await import('../site/viewer/viewer.js');
  const three = await import('../site/viewer3d/viewer3d.js');
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const draw = await import('../site/js/render-svg.js');
  const shared = await import('../site/js/viewer-state.js');
  const storage = memoryStorage();
  const frames = fakeClock();
  const svgUi = dockFixture();
  const threeUi = dockFixture();
  const svgWin = fakeWindow();
  const threeWin = fakeWindow();
  const svgCtrl = bind(svg, storage, frames, svgUi, { window: svgWin });
  const threeCtrl = bind(three, storage, frames, threeUi, { window: threeWin });
  const system = schema.loadSystem({
    orbit_match: 2,
    star: { name: 'Demo', mass_solar: 1 },
    epoch: { t0_days: 0 },
    bodies: [
      { id: 'planet', name: 'Planet', kind: 'planet', parent: null, orbit: { a_au: 1, e: 0, period_days: 4, position_angle_deg: 0 } }
    ]
  });
  const base = {
    elevation_deg: 20,
    azimuth_deg: 0,
    distance_mode: 'linear',
    epoch_days: 0,
    layers: { orbits: false, belts: false, habitable: false, transfers: false, labels: false }
  };
  const theme = { planet: '#9bb0c4' };
  const style = {
    background: '#070b10',
    border: '#2c3848',
    text: '#f2f5f8',
    muted: '#c5ced8',
    orbit: '#d5deea',
    star_radius: 48
  };

  function planet(scene) {
    return scene.bodies.find(function (body) { return body.id === 'planet'; });
  }

  function picture(state) {
    const view = shared.viewAtClock(base, system, state, 'demo');
    const scene = model.buildScene(system, view);
    const again = model.buildScene(system, view);
    const markup = draw.renderSvg(system, view, theme, style);
    const disk = markup.match(/<circle\b[^>]*\bdata-id="planet"[^>]*>/);
    assert.ok(disk, 'planet disk');
    return {
      days: shared.elapsedDays(state, 'demo'),
      x: planet(scene).position.x,
      z: planet(scene).position.z,
      cx: Number(disk[0].match(/\bcx="([^"]+)"/)[1]),
      cy: Number(disk[0].match(/\bcy="([^"]+)"/)[1]),
      markup: markup,
      sameObject: planet(scene).position === planet(again).position
    };
  }

  threeCtrl.step(1);
  svgWin.emit('storage', { key: shared.VIEWER_STATE_KEY });
  assert.equal(svgCtrl.elapsed(), 1);
  assert.equal(threeCtrl.elapsed(), 1);
  const fromThree = picture(threeCtrl.viewerState());
  const fromSvg = picture(svgCtrl.viewerState());
  assert.equal(fromSvg.days, fromThree.days);
  assert.equal(fromSvg.x, fromThree.x);
  assert.equal(fromSvg.z, fromThree.z);
  assert.equal(fromSvg.markup, fromThree.markup);
  assert.equal(fromSvg.sameObject, false);
  assert.ok(Math.abs(fromSvg.x) < Math.abs(fromSvg.z), 'quarter turn leaves the x axis');
  assert.ok(fromSvg.z < 0, String(fromSvg.z));
  assert.ok(fromSvg.cy < 530, String(fromSvg.cy));

  svgCtrl.step(1);
  threeWin.emit('storage', { key: shared.VIEWER_STATE_KEY });
  assert.equal(threeCtrl.elapsed(), 2);
  assert.equal(svgCtrl.elapsed(), 2);
  const laterSvg = picture(svgCtrl.viewerState());
  const laterThree = picture(threeCtrl.viewerState());
  assert.equal(laterSvg.x, laterThree.x);
  assert.equal(laterSvg.z, laterThree.z);
  assert.equal(laterSvg.markup, laterThree.markup);
  assert.ok(laterSvg.x < 0, String(laterSvg.x));
  assert.notEqual(laterSvg.markup, fromSvg.markup);
});
