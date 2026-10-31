const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const TAU = Math.PI * 2;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function radDiff(a, b) {
  const d = Math.abs(a - b) % TAU;
  return Math.min(d, TAU - d);
}

function deg(value) {
  return (value * Math.PI) / 180;
}

function storedRadians(body) {
  const orbit = body.orbit || {};
  if (typeof orbit.position_angle_deg === 'number') return deg(orbit.position_angle_deg);
  if (typeof body.angle_deg === 'number') return deg(body.angle_deg);
  if (typeof orbit.mean_anomaly_deg === 'number') return deg(orbit.mean_anomaly_deg);
  return null;
}

// The pre-phase-2 display rule: index among the sorted group, then a Lagrange
// body with no stored angle sits 60 degrees ahead of its partner.
function expectedDisplayMap(system) {
  const angles = new Map();
  const bodies = (system && system.bodies) || [];
  function assign(list) {
    const count = list.length;
    list.forEach(function (body, index) {
      const stored = storedRadians(body);
      angles.set(body.id, stored == null ? (index / count) * TAU : stored);
    });
    list.forEach(function (body) {
      if (storedRadians(body) != null) return;
      const partner = body.lagrange && body.lagrange.of;
      if (!partner || !angles.has(partner)) return;
      angles.set(body.id, angles.get(partner) + Math.PI / 3);
    });
  }
  const worlds = bodies.filter(function (body) {
    return body && body.parent == null && body.kind !== 'belt' && body.orbit && typeof body.orbit.a_au === 'number' && Number.isFinite(body.orbit.a_au);
  }).slice().sort(function (a, b) {
    return a.orbit.a_au - b.orbit.a_au || String(a.id).localeCompare(String(b.id));
  });
  assign(worlds);
  const parents = [];
  bodies.forEach(function (body) {
    if (!body || body.parent == null || parents.indexOf(body.parent) >= 0) return;
    parents.push(body.parent);
  });
  parents.forEach(function (parentId) {
    const children = bodies.filter(function (body) {
      return body && body.parent === parentId && body.kind !== 'belt' && body.orbit && typeof body.orbit.a_km === 'number';
    }).slice().sort(function (a, b) {
      return (a.orbit.a_km || 0) - (b.orbit.a_km || 0) || String(a.id).localeCompare(String(b.id));
    });
    assign(children);
  });
  return angles;
}

function drawnAngle(record) {
  return Math.atan2(-record.position.z, record.position.x);
}

function markerTag(svg, id) {
  const circle = svg.match(new RegExp('<circle\\b[^>]*\\bdata-id="' + id + '"[^>]*>'));
  if (circle) return circle[0];
  const torus = svg.match(new RegExp('<ellipse\\b[^>]*\\bdata-id="' + id + '"[^>]*data-shape="torus"[^>]*>'));
  return torus ? torus[0] : null;
}

function svgAngle(svg, id, cx, cy, elevDeg) {
  const tag = markerTag(svg, id);
  assert.ok(tag, 'marker ' + id);
  const sx = Number(tag.match(/\bcx="([^"]+)"/)[1]);
  const sy = Number(tag.match(/\bcy="([^"]+)"/)[1]);
  const sinE = Math.sin((elevDeg * Math.PI) / 180);
  return Math.atan2((cy - sy) / sinE, sx - cx);
}

function eccentricity(body) {
  const e = body && body.orbit && body.orbit.e;
  return typeof e === 'number' && e > 0 ? e : 0;
}

async function loadStack() {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const draw = await import('../site/js/render-svg.js');
  const kepler = await import('../site/js/kepler.js');
  return {
    schema: schema,
    model: model,
    draw: draw,
    kepler: kepler,
    quiet: readJson('site/themes/quiet.json'),
    empire: readJson('site/themes/empire.json')
  };
}

function assertDrawnAtStart(kepler, record, body, m0) {
  const spot = kepler.pos({ a: 1, e: eccentricity(body), period_days: 10, M0: m0, w: 0 }, 0);
  const expected = Math.atan2(spot.y, spot.x);
  assert.ok(radDiff(drawnAngle(record), expected) < 1e-6, body.id + ' drew ' + drawnAngle(record) + ' expected ' + expected);
}

test('displayAngleMap spreads missing angles and keeps stored angles exact', async function () {
  const mod = await import('../site/js/display-angles.js');
  const shared = read('site/js/display-angles.js');
  const svg = read('site/js/render-svg.js');
  const scene = read('site/viewer3d/scene-model.js');
  assert.match(shared, /index \/ count/);
  assert.doesNotMatch(svg, /index \/ count|index \/ worlds|index \/ children/);
  assert.doesNotMatch(scene, /index \/ count|index \/ worlds|index \/ children/);
  assert.match(mod.ANGLE_MISSING_LINE, /Start angle is not set/);
  assert.match(mod.ANGLE_MISSING_LINE, /spread for reading/);
  assert.match(mod.ANGLE_MISSING_LINE, /not a canon angle/);

  const lone = { bodies: [{ id: 'only', kind: 'planet', parent: null, orbit: { a_au: 1 } }] };
  const loneMap = mod.displayAngleMap(lone);
  assert.equal(loneMap.size, 1);
  assert.ok(radDiff(loneMap.get('only'), 0) < 1e-12);

  assert.equal(mod.displayAngleMap({ bodies: [] }).size, 0);
  assert.equal(mod.displayAngleMap(null).size, 0);

  const belts = {
    bodies: [{ id: 'dust', kind: 'belt', parent: null, orbit: { a_inner_au: 1, a_outer_au: 2, position_angle_deg: 10 } }]
  };
  const beltBefore = JSON.stringify(belts);
  const beltMap = mod.displayAngleMap(belts);
  assert.equal(beltMap.size, 0);
  assert.equal(beltMap.has('dust'), false);
  assert.equal(JSON.stringify(belts), beltBefore);

  const mixed = {
    bodies: [
      { id: 'p0', kind: 'planet', parent: null, orbit: { a_au: 1 } },
      { id: 'p1', kind: 'planet', parent: null, angle_deg: 20, orbit: { a_au: 2, position_angle_deg: 15, mean_anomaly_deg: 90 } },
      { id: 'p2', kind: 'planet', parent: null, angle_deg: 77, orbit: { a_au: 3, mean_anomaly_deg: 10 } },
      { id: 'gate', kind: 'structure', parent: null, orbit: { a_au: 3.5 }, lagrange: { of: 'p2', point: 'L4' } },
      { id: 'held', kind: 'structure', parent: null, orbit: { a_au: 4, position_angle_deg: 80 }, lagrange: { of: 'p0', point: 'L4' } },
      { id: 'dust', kind: 'belt', parent: null, orbit: { a_inner_au: 5, a_outer_au: 6 } },
      { id: 'm0', kind: 'moon', parent: 'p1', orbit: { a_km: 10000, position_angle_deg: 33 } },
      { id: 'm1', kind: 'moon', parent: 'p1', orbit: { a_km: 20000 } },
      { id: 'm2', kind: 'moon', parent: 'p1', angle_deg: 77, orbit: { a_km: 30000, mean_anomaly_deg: 10 } },
      { id: 'm3', kind: 'moon', parent: 'p1', orbit: { a_km: 40000 } }
    ]
  };
  const before = JSON.stringify(mixed);
  const map = mod.displayAngleMap(mixed);
  assert.equal(JSON.stringify(mixed), before);
  assert.equal(map.has('dust'), false);
  assert.ok(radDiff(map.get('p0'), 0) < 1e-12);
  assert.ok(radDiff(map.get('p1'), deg(15)) < 1e-12);
  assert.ok(radDiff(map.get('p2'), deg(77)) < 1e-12);
  assert.ok(radDiff(map.get('gate'), deg(77) + Math.PI / 3) < 1e-12);
  assert.ok(radDiff(map.get('gate'), (3 / 6) * TAU) > 1e-6);
  assert.ok(radDiff(map.get('held'), deg(80)) < 1e-12);
  assert.ok(radDiff(map.get('m0'), deg(33)) < 1e-12);
  assert.ok(radDiff(map.get('m1'), (1 / 4) * TAU) < 1e-12);
  assert.ok(radDiff(map.get('m2'), deg(77)) < 1e-12);
  assert.ok(radDiff(map.get('m3'), (3 / 4) * TAU) < 1e-12);
  assert.deepEqual(map, expectedDisplayMap(mixed));
});

test('Tau Ceti at T+0 spreads planets and keeps the tc5 station angles', async function () {
  const bag = await loadStack();
  const fileBefore = read('site/data/tau-ceti.system.json');
  const system = bag.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = bag.schema.loadView(readJson('site/data/tau-ceti.view.json'));
  assert.equal(view.epoch_days, 0);
  assert.equal(view.azimuth_deg, 0);
  const loadedBefore = JSON.stringify(system);
  const expectMap = expectedDisplayMap(system);
  const scene = bag.model.buildScene(system, view);
  const svg = bag.draw.renderSvg(system, view, bag.empire, bag.quiet);
  const planets = ['tc1', 'tc2', 'tc3', 'tc4', 'tc5', 'tc6', 'tc7', 'tc8'];
  const planetAngles = planets.map(function (id) {
    const record = scene.bodies.find(function (body) { return body.id === id; });
    assert.ok(record, id);
    assert.equal(record.angle_missing, true);
    return drawnAngle(record);
  });
  for (let i = 0; i < planetAngles.length; i++) {
    for (let j = i + 1; j < planetAngles.length; j++) {
      assert.ok(radDiff(planetAngles[i], planetAngles[j]) > 1e-3, planets[i] + ' vs ' + planets[j]);
    }
  }
  const lineDirs = planetAngles.map(function (angle) {
    let dir = angle % Math.PI;
    if (dir < 0) dir += Math.PI;
    return dir;
  });
  const span = Math.max.apply(null, lineDirs) - Math.min.apply(null, lineDirs);
  assert.ok(span > 0.4, String(span));
  scene.bodies.forEach(function (record) {
    const body = system.bodies.find(function (item) { return item.id === record.id; });
    assertDrawnAtStart(bag.kepler, record, body, expectMap.get(record.id));
    const fromSvg = svgAngle(svg, record.id, 800, 530, view.elevation_deg);
    assert.ok(radDiff(fromSvg, drawnAngle(record)) < 0.02, record.id + ' svg ' + fromSvg);
  });
  const tc6 = drawnAngle(scene.bodies.find(function (body) { return body.id === 'tc6'; }));
  const gate = drawnAngle(scene.bodies.find(function (body) { return body.id === 'tc6gate'; }));
  assert.ok(radDiff(gate, tc6 + Math.PI / 3) < 1e-6, String(gate));
  assert.equal(scene.bodies.find(function (body) { return body.id === 'tc6gate'; }).angle_missing, true);

  const close = bag.model.buildScene(system, view, { frame: 'tc5' });
  const closeSvg = bag.draw.renderSvg(system, view, bag.empire, bag.quiet, { frame: 'tc5' });
  const stations = { haven: 0, yard: 110, watch: 155 };
  Object.keys(stations).forEach(function (id) {
    const record = close.bodies.find(function (body) { return body.id === id; });
    assert.equal(record.angle_missing, false);
    assert.ok(radDiff(drawnAngle(record), deg(stations[id])) < 1e-6, id + ' ' + drawnAngle(record));
    const fromSvg = svgAngle(closeSvg, id, 820, 530, view.elevation_deg);
    assert.ok(radDiff(fromSvg, drawnAngle(record)) < 0.02, id);
  });
  ['tc5a', 'tc5b'].forEach(function (id) {
    const record = close.bodies.find(function (body) { return body.id === id; });
    const body = system.bodies.find(function (item) { return item.id === id; });
    assert.equal(record.angle_missing, true);
    assertDrawnAtStart(bag.kepler, record, body, expectMap.get(id));
    assert.ok(radDiff(drawnAngle(record), 0) > 0.2, id);
    const fromSvg = svgAngle(closeSvg, id, 820, 530, view.elevation_deg);
    assert.ok(radDiff(fromSvg, drawnAngle(record)) < 0.02, id);
  });
  assert.equal(JSON.stringify(system), loadedBefore);
  assert.equal(read('site/data/tau-ceti.system.json'), fileBefore);
  const tc1 = system.bodies.find(function (body) { return body.id === 'tc1'; });
  assert.equal(tc1.orbit.position_angle_deg, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(tc1, 'angle_deg'), false);
  assert.equal(tc1.orbit.mean_anomaly_deg, undefined);
  const lines = bag.model.infoLines(system, 'tc1').join('\n');
  assert.match(lines, /Start angle is not set/);
  assert.match(lines, /spread for reading/);
  assert.match(lines, /not a canon angle/);
  assert.equal(bag.model.infoLines(system, 'yard').join('\n').indexOf('Start angle is not set'), -1);
});

test('a made-up mix keeps stored angles exact and does not write the spread', async function () {
  const bag = await loadStack();
  const fileBefore = read('test/fixtures/made-up-spread.system.json');
  const system = bag.schema.loadSystem(readJson('test/fixtures/made-up-spread.system.json'));
  const view = {
    elevation_deg: 20,
    azimuth_deg: 0,
    distance_mode: 'schematic',
    epoch_days: 0,
    layers: { orbits: false, belts: false, habitable: false, transfers: false, labels: false, structures: true }
  };
  const before = JSON.stringify(system);
  const expectMap = expectedDisplayMap(system);
  const scene = bag.model.buildScene(system, view);
  const svg = bag.draw.renderSvg(system, view, bag.empire, bag.quiet);
  ['p0', 'p1', 'p2', 'gate'].forEach(function (id) {
    const record = scene.bodies.find(function (body) { return body.id === id; });
    const body = system.bodies.find(function (item) { return item.id === id; });
    assertDrawnAtStart(bag.kepler, record, body, expectMap.get(id));
    assert.ok(radDiff(svgAngle(svg, id, 800, 530, 20), drawnAngle(record)) < 0.02, id);
  });
  assert.equal(scene.bodies.find(function (body) { return body.id === 'p0'; }).angle_missing, true);
  assert.equal(scene.bodies.find(function (body) { return body.id === 'p1'; }).angle_missing, false);
  assert.equal(scene.bodies.find(function (body) { return body.id === 'p2'; }).angle_missing, false);
  assert.equal(scene.bodies.find(function (body) { return body.id === 'gate'; }).angle_missing, true);
  assert.ok(radDiff(expectMap.get('p1'), deg(15)) < 1e-12);
  assert.ok(radDiff(expectMap.get('p2'), deg(200)) < 1e-12);
  assert.ok(radDiff(expectMap.get('gate'), deg(200) + Math.PI / 3) < 1e-12);
  const close = bag.model.buildScene(system, view, { frame: 'p1' });
  const closeSvg = bag.draw.renderSvg(system, view, bag.empire, bag.quiet, { frame: 'p1' });
  ['mStored', 'mMiss', 'mAngle', 'mMiss2'].forEach(function (id) {
    const record = close.bodies.find(function (body) { return body.id === id; });
    const body = system.bodies.find(function (item) { return item.id === id; });
    assertDrawnAtStart(bag.kepler, record, body, expectMap.get(id));
    assert.ok(radDiff(svgAngle(closeSvg, id, 820, 530, 20), drawnAngle(record)) < 0.02, id);
  });
  assert.equal(close.bodies.find(function (body) { return body.id === 'mMiss'; }).angle_missing, true);
  assert.equal(close.bodies.find(function (body) { return body.id === 'mMiss2'; }).angle_missing, true);
  assert.equal(close.bodies.find(function (body) { return body.id === 'mStored'; }).angle_missing, false);
  assert.equal(close.bodies.find(function (body) { return body.id === 'mAngle'; }).angle_missing, false);
  assert.ok(radDiff(expectMap.get('mMiss'), TAU / 4) < 1e-12);
  assert.ok(radDiff(expectMap.get('mAngle'), deg(77)) < 1e-12);
  assert.ok(radDiff(expectMap.get('mMiss2'), (3 / 4) * TAU) < 1e-12);
  assert.equal(scene.bodies.some(function (body) { return body.id === 'dust'; }), false);
  const dust = system.bodies.find(function (body) { return body.id === 'dust'; });
  assert.equal(bag.model.angleIsMissing(dust), false);
  assert.equal(JSON.stringify(system), before);
  assert.equal(read('test/fixtures/made-up-spread.system.json'), fileBefore);
  const plain = system.bodies.find(function (body) { return body.id === 'p0'; });
  assert.equal(plain.orbit.position_angle_deg, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(plain, 'angle_deg'), false);
  const later = bag.model.buildScene(system, Object.assign({}, view, { epoch_days: 25 }));
  const back = bag.model.buildScene(system, view);
  later.bodies.forEach(function (record) {
    const start = scene.bodies.find(function (body) { return body.id === record.id; });
    assert.ok(radDiff(drawnAngle(record), drawnAngle(start)) > 1e-3, record.id);
  });
  back.bodies.forEach(function (record) {
    const start = scene.bodies.find(function (body) { return body.id === record.id; });
    assert.ok(radDiff(drawnAngle(record), drawnAngle(start)) < 1e-9, record.id);
  });
  assert.equal(JSON.stringify(system), before);
});

test('the playback clock returns every body to its T+0 angle', async function () {
  const bag = await loadStack();
  const clock = await import('../site/js/viewer-state.js');
  const playback = await import('../site/js/playback.js');
  const fileBefore = read('site/data/tau-ceti.system.json');
  const system = bag.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = bag.schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const fieldsBefore = JSON.stringify(system.bodies.map(function (body) {
    const orbit = body.orbit || {};
    return {
      id: body.id,
      angle_deg: body.angle_deg,
      position_angle_deg: orbit.position_angle_deg,
      mean_anomaly_deg: orbit.mean_anomaly_deg
    };
  }));
  const expectMap = expectedDisplayMap(system);
  const memory = {};
  const storage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
    setItem: function (key, value) { memory[key] = String(value); }
  };
  const frames = [];
  let now = 0;
  const play = playback.createPlaybackController({
    storage: storage,
    systemId: 'tau-ceti',
    now: function () { return now; },
    requestFrame: function (fn) {
      frames.push(fn);
      return frames.length;
    },
    cancelFrame: function () {},
    onPaint: function () {
      const stamped = clock.viewAtClock(view, system, play.viewerState(), 'tau-ceti');
      bag.model.buildScene(system, stamped);
      bag.model.buildScene(system, stamped, { frame: 'tc5' });
      bag.draw.renderSvg(system, stamped, bag.empire, bag.quiet);
      bag.draw.renderSvg(system, stamped, bag.empire, bag.quiet, { frame: 'tc5' });
    },
    isClose: function () { return false; }
  });
  const atStart = bag.model.buildScene(system, view);
  play.press('forward');
  assert.equal(frames.length >= 1, true);
  frames[0](0);
  assert.equal(frames.length >= 2, true);
  frames[1](1000);
  assert.ok(Math.abs(play.elapsed() - 1) < 1e-9, String(play.elapsed()));
  const movedView = clock.viewAtClock(view, system, play.viewerState(), 'tau-ceti');
  assert.equal(movedView.epoch_days, 1);
  const moved = bag.model.buildScene(system, movedView);
  const tc1Start = atStart.bodies.find(function (body) { return body.id === 'tc1'; });
  const tc1Moved = moved.bodies.find(function (body) { return body.id === 'tc1'; });
  assert.ok(Math.hypot(tc1Moved.position.x - tc1Start.position.x, tc1Moved.position.z - tc1Start.position.z) > 0.01);
  play.step(-play.elapsed());
  assert.equal(play.elapsed(), 0);
  play.step(15);
  play.step(-15);
  assert.equal(play.elapsed(), 0);
  const backView = clock.viewAtClock(view, system, play.viewerState(), 'tau-ceti');
  assert.equal(backView.epoch_days, 0);
  assert.equal(view.epoch_days, 0);
  const back = bag.model.buildScene(system, backView);
  const backClose = bag.model.buildScene(system, backView, { frame: 'tc5' });
  back.bodies.forEach(function (record) {
    const start = atStart.bodies.find(function (body) { return body.id === record.id; });
    const body = system.bodies.find(function (item) { return item.id === record.id; });
    assert.ok(radDiff(drawnAngle(record), drawnAngle(start)) < 1e-9, record.id);
    assertDrawnAtStart(bag.kepler, record, body, expectMap.get(record.id));
  });
  backClose.bodies.forEach(function (record) {
    if (record.id === 'tc5') return;
    const body = system.bodies.find(function (item) { return item.id === record.id; });
    assertDrawnAtStart(bag.kepler, record, body, expectMap.get(record.id));
  });
  const svgBack = bag.draw.renderSvg(system, backView, bag.empire, bag.quiet);
  const svgStart = bag.draw.renderSvg(system, view, bag.empire, bag.quiet);
  back.bodies.forEach(function (record) {
    assert.ok(radDiff(svgAngle(svgBack, record.id, 800, 530, view.elevation_deg), svgAngle(svgStart, record.id, 800, 530, view.elevation_deg)) < 0.02, record.id);
  });
  assert.equal(JSON.stringify(system.bodies.map(function (body) {
    const orbit = body.orbit || {};
    return {
      id: body.id,
      angle_deg: body.angle_deg,
      position_angle_deg: orbit.position_angle_deg,
      mean_anomaly_deg: orbit.mean_anomaly_deg
    };
  })), fieldsBefore);
  assert.equal(read('site/data/tau-ceti.system.json'), fileBefore);
});
