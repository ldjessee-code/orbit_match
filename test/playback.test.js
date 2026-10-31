const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

async function playback() {
  return import('../site/js/playback.js');
}

function playing(speed, direction) {
  return { playing: true, direction: direction == null ? 1 : direction, speed: speed };
}

function memoryStorage() {
  const memory = {};
  return {
    memory: memory,
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem: function (key, value) {
      memory[key] = String(value);
    }
  };
}

function storedDays(storage, systemId) {
  const raw = storage.getItem('orbit-match-viewer-state');
  assert.ok(raw, 'shared clock was written');
  const parsed = JSON.parse(raw);
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
      assert.ok(item, 'expected a scheduled frame at ' + t);
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
  Object.keys(attrs || {}).forEach(function (key) {
    node.setAttribute(key, attrs[key]);
  });
  return node;
}

function matches(node, sel) {
  if (!node || !node.tagName) return false;
  if (sel.charAt(0) === '#') return node.id === sel.slice(1);
  if (sel === 'option') return node.tagName === 'OPTION';
  if (sel === 'button[data-days]') return node.tagName === 'BUTTON' && node.getAttribute('data-days') != null;
  return false;
}

function queryAll(root, sel) {
  const out = [];
  (root.children || []).forEach(function (child) {
    if (matches(child, sel)) out.push(child);
    queryAll(child, sel).forEach(function (hit) { out.push(hit); });
  });
  return out;
}

function click(node) {
  let current = node;
  const event = { target: node };
  while (current) {
    const list = (current.listeners && current.listeners.click) || [];
    list.forEach(function (fn) { fn(event); });
    current = current.parent;
  }
}

function fakeDocument() {
  return {
    createElement: function (tag) { return el(tag); }
  };
}

function optionNodes(select) {
  return select.querySelectorAll('option').map(function (option) {
    return { value: option.value, text: option.textContent };
  });
}

function dockFixture() {
  const dock = el('div', { id: 'dock' });
  const reverse = el('button', { id: 'play-reverse', type: 'button', 'aria-pressed': 'false' });
  const pause = el('button', { id: 'play-pause', type: 'button', 'aria-pressed': 'true' });
  const forward = el('button', { id: 'play-forward', type: 'button', 'aria-pressed': 'false' });
  const select = el('select', { id: 'play-speed' });
  [
    ['d1', '1 day/sec'],
    ['d10', '10 days/sec'],
    ['d100', '100 days/sec']
  ].forEach(function (pair) {
    const option = el('option', { value: pair[0] });
    option.textContent = pair[1];
    select.appendChild(option);
  });
  select.value = 'd1';
  [-10, -1, 1, 10].forEach(function (days) {
    dock.appendChild(el('button', { type: 'button', 'data-days': String(days) }));
  });
  [reverse, pause, forward, select].forEach(function (node) { dock.appendChild(node); });
  return { dock: dock, reverse: reverse, pause: pause, forward: forward, select: select };
}

function runOneSecond(clock) {
  clock.pump(0);
  clock.pump(250);
  clock.pump(500);
  clock.pump(750);
  clock.pump(1000);
}

test('default playback is paused, forward, at 1 day per second', async function () {
  const clock = await playback();
  const first = clock.defaultPlayback();
  const second = clock.defaultPlayback();
  assert.deepEqual(first, { playing: false, direction: 1, speed: 'd1' });
  assert.equal(first.playing, false);
  assert.equal(first.direction, 1);
  assert.equal(first.speed, 'd1');
  const rates = clock.speedsFor(false);
  const one = rates.find(function (row) { return row.id === 'd1'; });
  assert.equal(one.daysPerSecond, 1);
  first.playing = true;
  assert.equal(second.playing, false);
  assert.equal(clock.defaultPlayback().playing, false);
});

test('advance moves 1, 10, 100, and 1/24 day per second and caps a huge frame', async function () {
  const clock = await playback();
  assert.equal(clock.advance(playing('d1'), 1), 1);
  assert.equal(clock.advance(playing('d10'), 1), 10);
  assert.equal(clock.advance(playing('d100'), 1), 100);
  assert.equal(clock.advance(playing('d1', -1), 1), -1);
  assert.equal(clock.advance(playing('d10', -1), 1), -10);
  assert.equal(clock.advance(playing('d100', -1), 1), -100);
  assert.equal(clock.advance({ playing: false, direction: 1, speed: 'd100' }, 1), 0);
  assert.equal(clock.advance({ playing: false, direction: -1, speed: 'd1' }, 30), 0);
  assert.equal(clock.advance(playing('h1'), 1), 1 / 24);
  assert.equal(clock.advance(playing('h1', -1), 1), -1 / 24);
  assert.equal(clock.advance(playing('d1'), 0.25), 0.25);
  assert.equal(clock.advance(playing('d1'), 30), clock.FRAME_DT_CAP_SECONDS);
  assert.equal(clock.advance(playing('d100', -1), 30), -100 * clock.FRAME_DT_CAP_SECONDS);
  assert.equal(clock.FRAME_DT_CAP_SECONDS, 0.25);
  assert.equal(clock.advance(playing('d1'), 0), 0);
  assert.equal(clock.advance(playing('d1'), -4), 0);
  assert.equal(clock.advance(null, 1), 0);
  const sample = playing('d10');
  clock.advance(sample, 1);
  assert.deepEqual(sample, playing('d10'));
});

test('speedsFor offers 1 hour per second only in the close view', async function () {
  const clock = await playback();
  const system = clock.speedsFor(false);
  assert.deepEqual(system.map(function (row) { return row.id; }), ['d1', 'd10', 'd100']);
  assert.deepEqual(system.map(function (row) { return row.daysPerSecond; }), [1, 10, 100]);
  assert.equal(system.some(function (row) { return row.id === 'h1'; }), false);
  const close = clock.speedsFor(true);
  assert.deepEqual(close.map(function (row) { return row.id; }), ['d1', 'd10', 'd100', 'h1']);
  assert.equal(close[3].daysPerSecond, 1 / 24);
  assert.equal(close[3].label, '1 hour/sec');
});

test('normalizeForView drops 1 hour per second outside the close view', async function () {
  const clock = await playback();
  const hour = { playing: true, direction: -1, speed: 'h1' };
  const dropped = clock.normalizeForView(hour, false);
  assert.equal(dropped.speed, 'd1');
  assert.equal(dropped.playing, true);
  assert.equal(dropped.direction, -1);
  assert.equal(hour.speed, 'h1');
  const keptFast = clock.normalizeForView({ playing: true, direction: 1, speed: 'd10' }, false);
  assert.equal(keptFast.speed, 'd10');
  assert.equal(keptFast.playing, true);
  assert.equal(keptFast.direction, 1);
  const keptFaster = clock.normalizeForView({ playing: false, direction: -1, speed: 'd100' }, true);
  assert.equal(keptFaster.speed, 'd100');
  assert.equal(keptFaster.playing, false);
  assert.equal(keptFaster.direction, -1);
  const stayed = clock.normalizeForView({ playing: true, direction: 1, speed: 'h1' }, true);
  assert.equal(stayed.speed, 'h1');
  assert.equal(stayed.playing, true);
});

test('a scene at clock t is recomputed and no position store survives', async function () {
  const clock = await playback();
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const draw = await import('../site/js/render-svg.js');
  const shared = await import('../site/js/viewer-state.js');
  assert.equal(clock.positions, undefined);
  assert.equal(clock.positionCache, undefined);
  assert.doesNotMatch(read('site/js/playback.js'), /positionCache|cachedPositions|new Map/);
  assert.doesNotMatch(read('site/viewer3d/scene-model.js'), /positionCache|cachedPositions/);
  assert.doesNotMatch(read('site/js/render-svg.js'), /positionCache|cachedPositions/);

  const system = schema.loadSystem({
    orbit_match: 2,
    star: { name: 'Demo', mass_solar: 1 },
    epoch: { t0_days: 0 },
    bodies: [
      { id: 'planet', name: 'Planet', kind: 'planet', parent: null, orbit: { a_au: 1, e: 0, period_days: 40, position_angle_deg: 0 } },
      { id: 'moon', name: 'Moon', kind: 'moon', parent: 'planet', orbit: { a_km: 10000, e: 0, period_days: 4, position_angle_deg: 0 } }
    ]
  });
  const base = {
    elevation_deg: 20,
    azimuth_deg: 0,
    distance_mode: 'linear',
    epoch_days: 0,
    layers: { orbits: false, belts: false, habitable: false, transfers: false, labels: false }
  };
  const theme = { planet: '#9bb0c4', moon: '#d9d3c7' };
  const style = {
    background: '#070b10',
    border: '#2c3848',
    text: '#f2f5f8',
    muted: '#c5ced8',
    orbit: '#d5deea',
    star_radius: 48
  };

  function atDays(days) {
    let state = shared.readViewerState(memoryStorage());
    state = shared.setElapsedDays(state, 'demo', days);
    return shared.viewAtClock(base, system, state, 'demo');
  }

  function planetOf(scene) {
    return scene.bodies.find(function (body) { return body.id === 'planet'; });
  }

  function moonOf(scene) {
    return scene.bodies.find(function (body) { return body.id === 'moon'; });
  }

  const view0 = atDays(0);
  const first = model.buildScene(system, view0);
  const second = model.buildScene(system, view0);
  const firstPlanet = planetOf(first);
  const secondPlanet = planetOf(second);
  assert.equal(secondPlanet.position.x, firstPlanet.position.x);
  assert.equal(secondPlanet.position.z, firstPlanet.position.z);
  assert.notEqual(secondPlanet.position, firstPlanet.position);
  const originalX = firstPlanet.position.x;
  firstPlanet.position.x = 99999;
  const third = model.buildScene(system, view0);
  assert.notEqual(planetOf(third).position.x, 99999);
  assert.equal(planetOf(third).position.x, originalX);

  let days = 0;
  const forward = playing('d10');
  for (let i = 0; i < 4; i++) days += clock.advance(forward, 0.25);
  assert.equal(days, 10);
  const moved = model.buildScene(system, atDays(days));
  assert.notEqual(planetOf(moved).position.x, originalX);
  const close0 = model.buildScene(system, view0, { frame: 'planet' });
  const closeMoved = model.buildScene(system, atDays(days), { frame: 'planet' });
  assert.notEqual(moonOf(closeMoved).position.x, moonOf(close0).position.x);
  let back = days;
  const reverse = playing('d10', -1);
  for (let i = 0; i < 4; i++) back += clock.advance(reverse, 0.25);
  assert.equal(back, 0);
  const returned = model.buildScene(system, atDays(back));
  assert.equal(planetOf(returned).position.x, originalX);
  assert.equal(planetOf(returned).position.z, planetOf(third).position.z);
  assert.notEqual(planetOf(returned).position, firstPlanet.position);
  const closeBack = model.buildScene(system, atDays(back), { frame: 'planet' });
  assert.equal(moonOf(closeBack).position.x, moonOf(close0).position.x);
  assert.equal(moonOf(closeBack).position.z, moonOf(close0).position.z);

  const svg0 = draw.renderSvg(system, view0, theme, style);
  const svg0b = draw.renderSvg(system, view0, theme, style);
  assert.equal(svg0, svg0b);
  const svgMoved = draw.renderSvg(system, atDays(10), theme, style);
  assert.notEqual(svgMoved, svg0);
  assert.equal(draw.renderSvg(system, atDays(0), theme, style), svg0);

  const period = system.bodies.find(function (body) { return body.id === 'planet'; }).orbit.period_days;
  system.bodies.find(function (body) { return body.id === 'planet'; }).orbit.period_days = 80;
  const retimed = model.buildScene(system, atDays(10));
  assert.notEqual(planetOf(retimed).position.x, planetOf(moved).position.x);
  system.bodies.find(function (body) { return body.id === 'planet'; }).orbit.period_days = period;

  const ctrl = clock.createPlaybackController({
    storage: memoryStorage(),
    systemId: 'demo',
    now: function () { return 0; },
    requestFrame: function () { return 0; },
    cancelFrame: function () {}
  });
  assert.deepEqual(Object.keys(ctrl.getState()).sort(), ['direction', 'playing', 'speed']);
  assert.equal(ctrl.viewerState().positions, undefined);
});

test('the shared clock plays forward and reverse, and pause stops it', async function () {
  const clock = await playback();
  async function run(speed, direction) {
    const storage = memoryStorage();
    const frames = fakeClock();
    let paints = 0;
    const ctrl = clock.createPlaybackController({
      storage: storage,
      systemId: 'tau-ceti',
      now: function () { return frames.now(); },
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      onPaint: function () { paints += 1; }
    });
    assert.deepEqual(ctrl.getState(), { playing: false, direction: 1, speed: 'd1' });
    if (speed === 'h1') ctrl.setClose(true);
    ctrl.setSpeed(speed);
    ctrl.press(direction < 0 ? 'reverse' : 'forward');
    assert.equal(ctrl.getState().playing, true);
    assert.equal(ctrl.getState().direction, direction);
    runOneSecond(frames);
    ctrl.press('pause');
    const expected = direction * (speed === 'd10' ? 10 : speed === 'd100' ? 100 : speed === 'h1' ? 1 / 24 : 1);
    assert.ok(Math.abs(storedDays(storage) - expected) < 1e-9, String(storedDays(storage)));
    assert.ok(Math.abs(ctrl.elapsed() - expected) < 1e-9);
    assert.equal(ctrl.getState().playing, false);
    assert.equal(frames.pending(), 0);
    const settled = ctrl.elapsed();
    assert.equal(paints > 0, true);
    assert.equal(ctrl.elapsed(), settled);
    return ctrl;
  }
  await run('d1', 1);
  await run('d10', 1);
  await run('d100', 1);
  await run('d1', -1);
  await run('h1', 1);
  const backward = await run('d10', -1);
  assert.equal(backward.getState().direction, -1);
});

test('a huge frame is capped, writes are throttled, and pause flushes the clock', async function () {
  const clock = await playback();
  const storage = memoryStorage();
  const frames = fakeClock();
  let writes = 0;
  const counting = {
    getItem: function (key) { return storage.getItem(key); },
    setItem: function (key, value) {
      writes += 1;
      storage.setItem(key, value);
    }
  };
  const ctrl = clock.createPlaybackController({
    storage: counting,
    systemId: 'tau-ceti',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });
  ctrl.press('forward');
  frames.pump(0);
  frames.pump(250);
  const writesAtFirst = writes;
  assert.equal(writesAtFirst, 1);
  assert.ok(Math.abs(storedDays(storage) - 0.25) < 1e-9);
  frames.pump(300);
  assert.equal(writes, writesAtFirst);
  assert.ok(Math.abs(storedDays(storage) - 0.25) < 1e-9);
  assert.ok(Math.abs(ctrl.elapsed() - 0.3) < 1e-9);
  frames.pump(350);
  assert.ok(Math.abs(storedDays(storage) - 0.35) < 1e-9);
  assert.ok(writes < 4);
  ctrl.press('pause');
  assert.equal(frames.pending(), 0);
  const flushed = storedDays(storage);
  assert.ok(Math.abs(flushed - ctrl.elapsed()) < 1e-9);

  const jumpStore = memoryStorage();
  const jumpFrames = fakeClock();
  const jump = clock.createPlaybackController({
    storage: jumpStore,
    systemId: 'tau-ceti',
    now: function () { return jumpFrames.now(); },
    requestFrame: jumpFrames.requestFrame,
    cancelFrame: jumpFrames.cancelFrame
  });
  jump.press('forward');
  jumpFrames.pump(0);
  jumpFrames.pump(30000);
  assert.ok(Math.abs(jump.elapsed() - clock.FRAME_DT_CAP_SECONDS) < 1e-9);
  jump.press('pause');
  assert.ok(Math.abs(storedDays(jumpStore) - 0.25) < 1e-9);
});

test('step buttons add -10, -1, +1, and +10 while paused and while playing', async function () {
  const clock = await playback();
  const storage = memoryStorage();
  const frames = fakeClock();
  const ctrl = clock.createPlaybackController({
    storage: storage,
    systemId: 'tau-ceti',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });
  assert.equal(ctrl.step(-10), -10);
  assert.equal(ctrl.step(-1), -11);
  assert.equal(ctrl.step(1), -10);
  assert.equal(ctrl.step(10), 0);
  assert.equal(storedDays(storage), 0);
  assert.equal(ctrl.getState().playing, false);

  ctrl.press('forward');
  frames.pump(0);
  frames.pump(250);
  assert.ok(Math.abs(ctrl.elapsed() - 0.25) < 1e-9);
  assert.equal(ctrl.step(10), 10.25);
  assert.equal(storedDays(storage), 10.25);
  assert.equal(ctrl.getState().playing, true);
  frames.pump(500);
  assert.ok(Math.abs(ctrl.elapsed() - 10.5) < 1e-9);
  assert.equal(ctrl.step(-1), 9.5);
  assert.equal(ctrl.step(-10), -0.5);
  assert.equal(storedDays(storage), -0.5);
  ctrl.press('pause');
  assert.equal(storedDays(storage), -0.5);
  assert.equal(frames.pending(), 0);
});

test('hour speed falls back to 1 day per second when the close view closes', async function () {
  const clock = await playback();
  const frames = fakeClock();
  const ctrl = clock.createPlaybackController({
    storage: memoryStorage(),
    systemId: 'tau-ceti',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });
  assert.equal(ctrl.setSpeed('h1').speed, 'd1');
  ctrl.press('reverse');
  ctrl.setClose(true);
  assert.equal(ctrl.isClose(), true);
  assert.equal(ctrl.setSpeed('h1').speed, 'h1');
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, -1);
  const dropped = ctrl.setClose(false);
  assert.equal(dropped.speed, 'd1');
  assert.equal(dropped.playing, true);
  assert.equal(dropped.direction, -1);
  assert.equal(ctrl.setSpeed('d100').speed, 'd100');
  ctrl.setClose(true);
  assert.equal(ctrl.getState().speed, 'd100');
});

test('paused playback adopts another page clock and a playing page does not', async function () {
  const clock = await playback();
  const storage = memoryStorage();
  const frames = fakeClock();
  function make() {
    return clock.createPlaybackController({
      storage: storage,
      systemId: 'tau-ceti',
      now: function () { return frames.now(); },
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame
    });
  }
  const writer = make();
  const reader = make();
  writer.step(10);
  assert.equal(reader.elapsed(), 0);
  assert.equal(reader.syncFromStorage(), true);
  assert.equal(reader.elapsed(), 10);
  reader.press('forward');
  writer.step(3);
  assert.equal(reader.syncFromStorage(), false);
  assert.equal(reader.elapsed(), 10);
  assert.equal(writer.elapsed(), 13);
});

test('dock controls play, pause, step, and hide the hour speed until close', async function () {
  const clock = await playback();
  const storage = memoryStorage();
  const frames = fakeClock();
  const ui = dockFixture();
  const win = {
    listeners: {},
    addEventListener: function (type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    emit: function (type, event) {
      (this.listeners[type] || []).forEach(function (fn) { fn(event); });
    }
  };
  let paints = 0;
  const ctrl = clock.mountPlaybackDock({
    document: fakeDocument(),
    dock: ui.dock,
    window: win,
    storage: storage,
    systemId: 'tau-ceti',
    now: function () { return frames.now(); },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    onPaint: function () { paints += 1; }
  });
  assert.equal(ui.pause.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.forward.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.reverse.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.select.value, 'd1');
  assert.equal(optionNodes(ui.select).some(function (option) { return option.value === 'h1'; }), false);
  assert.deepEqual(optionNodes(ui.select).map(function (option) { return option.value; }), ['d1', 'd10', 'd100']);

  click(ui.forward);
  assert.equal(ui.forward.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.pause.getAttribute('aria-pressed'), 'false');
  runOneSecond(frames);
  assert.ok(Math.abs(storedDays(storage) - 1) < 1e-9);

  click(ui.reverse);
  assert.equal(ui.reverse.getAttribute('aria-pressed'), 'true');
  assert.equal(ctrl.getState().direction, -1);
  frames.pump(1250);
  frames.pump(1500);
  frames.pump(1750);
  frames.pump(2000);
  assert.ok(Math.abs(ctrl.elapsed() - 0) < 1e-9, String(ctrl.elapsed()));

  click(ui.pause);
  assert.equal(ui.pause.getAttribute('aria-pressed'), 'true');
  assert.equal(frames.pending(), 0);
  const steps = {};
  ui.dock.querySelectorAll('button[data-days]').forEach(function (button) {
    steps[button.getAttribute('data-days')] = button;
  });
  let expectDays = ctrl.elapsed();
  ['-10', '-1', '1', '10'].forEach(function (days) {
    click(steps[days]);
    expectDays += Number(days);
    assert.equal(storedDays(storage), expectDays);
  });
  assert.equal(ctrl.getState().playing, false);

  click(ui.forward);
  frames.pump(3000);
  frames.pump(3250);
  const before = ctrl.elapsed();
  click(steps['-10']);
  click(steps['-1']);
  click(steps['1']);
  click(steps['10']);
  assert.ok(Math.abs(ctrl.elapsed() - before) < 1e-9);
  assert.equal(storedDays(storage), ctrl.elapsed());
  assert.equal(ctrl.getState().playing, true);
  click(ui.pause);

  ui.select.value = 'd100';
  ui.select.listeners.change.forEach(function (fn) { fn(); });
  assert.equal(ctrl.getState().speed, 'd100');
  ctrl.setClose(true);
  assert.equal(optionNodes(ui.select).some(function (option) { return option.value === 'h1' && option.text === '1 hour/sec'; }), true);
  ui.select.value = 'h1';
  ui.select.listeners.change.forEach(function (fn) { fn(); });
  assert.equal(ctrl.getState().speed, 'h1');
  click(ui.reverse);
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, -1);
  ctrl.setClose(false);
  assert.equal(ctrl.getState().speed, 'd1');
  assert.equal(ctrl.getState().playing, true);
  assert.equal(ctrl.getState().direction, -1);
  assert.equal(ui.select.value, 'd1');
  assert.equal(optionNodes(ui.select).some(function (option) { return option.value === 'h1'; }), false);
  assert.equal(ui.reverse.getAttribute('aria-pressed'), 'true');
  click(ui.pause);
  assert.equal(ctrl.getState().playing, false);

  const other = clock.createPlaybackController({
    storage: storage,
    systemId: 'tau-ceti',
    now: function () { return 0; },
    requestFrame: function () { return 0; },
    cancelFrame: function () {}
  });
  const seen = paints;
  const parked = ctrl.elapsed();
  other.step(4);
  win.emit('storage', { key: 'orbit-match-viewer-state' });
  assert.equal(ctrl.elapsed(), parked + 4);
  assert.equal(ctrl.elapsed(), other.elapsed());
  assert.ok(paints > seen);
});
