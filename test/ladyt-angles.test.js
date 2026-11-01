const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const systemRel = 'site/data/tau-ceti.system.json';
const startRel = 'test/fixtures/tau-ceti.system.start.json';
const TAU = Math.PI * 2;

const ROWS = [
  { id: 'tc1', position_angle_deg: 202.29, perihelion_longitude_deg: 182.31, canon: 'locked' },
  { id: 'tc2', position_angle_deg: 300.41, perihelion_longitude_deg: 211.47, canon: 'locked' },
  { id: 'tc3', position_angle_deg: 12.68, perihelion_longitude_deg: 100.66, canon: 'locked' },
  { id: 'tc4', position_angle_deg: 184.69, perihelion_longitude_deg: 65.57, canon: 'locked' },
  { id: 'tc5', position_angle_deg: 8.13, perihelion_longitude_deg: 327.55, canon: 'locked' },
  { id: 'tc5a', position_angle_deg: 319.24, perihelion_longitude_deg: 196.87, canon: 'est' },
  { id: 'tc5b', position_angle_deg: 64.99, perihelion_longitude_deg: 196.87, canon: 'est' },
  { id: 'tc6', position_angle_deg: 3.94, perihelion_longitude_deg: 64.96, canon: 'locked' },
  { id: 'tc7', position_angle_deg: 8.04, perihelion_longitude_deg: 207.18, canon: 'locked' },
  { id: 'tc8', position_angle_deg: 253.57, perihelion_longitude_deg: 78.44, canon: 'locked' }
];

const CANON_TAGS = ['locked', 'est', 'derived', 'real', 'fiction', 'narrative', 'tbd', 'placeholder'];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function bodyById(data, id) {
  const found = (data.bodies || []).find(function (body) { return body.id === id; });
  assert.ok(found, id);
  return found;
}

function radDiff(a, b) {
  const d = Math.abs(a - b) % TAU;
  return Math.min(d, TAU - d);
}

function deg(value) {
  return (value * Math.PI) / 180;
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

function withoutAngleEdits(data) {
  const copy = JSON.parse(JSON.stringify(data));
  delete copy.reference_direction;
  delete copy.epoch;
  if (copy.lore && typeof copy.lore === 'object') delete copy.lore.angles;
  (copy.bodies || []).forEach(function (body) {
    if (body.orbit) {
      delete body.orbit.position_angle_deg;
      delete body.orbit.perihelion_longitude_deg;
    }
    if (body.canon) {
      delete body.canon['orbit.position_angle_deg'];
      delete body.canon['orbit.perihelion_longitude_deg'];
    }
  });
  return copy;
}

function zeroPerihelion(system) {
  const copy = JSON.parse(JSON.stringify(system));
  (copy.bodies || []).forEach(function (body) {
    if (body.orbit && typeof body.orbit.perihelion_longitude_deg === 'number') {
      body.orbit.perihelion_longitude_deg = 0;
    }
  });
  return copy;
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
    empire: readJson('site/themes/empire.json'),
    view: schema.loadView(readJson('site/data/tau-ceti.view.json'))
  };
}

test('the system file stores LadyT\'s ten rows, the epoch, and the fixed axis', function () {
  const raw = readJson(systemRel);
  assert.deepEqual(raw.reference_direction, {
    label: 'fixed system axis (arbitrary direction); angles increase prograde',
    deg: 0
  });
  assert.deepEqual(raw.epoch, {
    t0_days: 0,
    label: 'T+0 (epoch)',
    game_datetime: '3629-01-01 00:00:01',
    canon: 'locked'
  });
  assert.equal(raw.lore.version, 'v2.41c');
  assert.equal(raw.lore.angles.version, 'v2.41o');
  assert.equal(raw.lore.angles.locked, '2026-10-31');
  assert.equal(raw.lore.angles.epoch, '3629-01-01 00:00:01');
  assert.equal(raw.lore.angles.prepared_by, 'LadyT');
  assert.equal(raw.lore.angles.source, 'F:\\Dropbox\\Projects\\Turquenish\\review\\tau_ceti_angles_for_viewer_20261031.md');
  const stations = { haven: 0, yard: 110, watch: 155 };
  Object.keys(stations).forEach(function (id) {
    const body = bodyById(raw, id);
    assert.equal(body.angle_deg, stations[id], id);
    assert.equal(body.orbit.position_angle_deg, undefined, id);
    assert.equal(body.orbit.perihelion_longitude_deg, undefined, id);
  });
  const gate = bodyById(raw, 'tc6gate');
  assert.equal(gate.orbit.position_angle_deg, undefined);
  assert.equal(gate.lagrange.of, 'tc6');
  assert.equal(gate.lagrange.point, 'L4 or L5');
  ['b1', 'b2'].forEach(function (id) {
    const body = bodyById(raw, id);
    assert.equal(body.orbit.position_angle_deg, undefined, id);
    assert.equal(body.kind, 'belt');
  });
  ROWS.forEach(function (row) {
    const body = bodyById(raw, row.id);
    assert.equal(body.orbit.position_angle_deg, row.position_angle_deg, row.id);
    assert.equal(body.orbit.perihelion_longitude_deg, row.perihelion_longitude_deg, row.id);
    assert.equal(body.canon['orbit.position_angle_deg'], row.canon, row.id);
    assert.equal(body.canon['orbit.perihelion_longitude_deg'], row.canon, row.id);
    assert.ok(CANON_TAGS.indexOf(row.canon) >= 0, row.canon);
  });
  const tc1 = bodyById(raw, 'tc1');
  assert.equal(tc1.orbit.e, null);
  assert.equal(tc1.canon['orbit.e'], 'tbd');
  const yard = bodyById(raw, 'yard');
  const watch = bodyById(raw, 'watch');
  assert.equal(yard.canon.angle_deg, 'locked');
  assert.equal(watch.canon.angle_deg, 'est');
});

test('every field except the new angles, epoch, axis, and provenance matches the start snapshot', function () {
  const start = readJson(startRel);
  const current = readJson(systemRel);
  assert.equal(start.epoch.canon, 'placeholder');
  assert.equal(start.epoch.label, 'T+0 (circa 1600 yrs hence)');
  assert.equal(start.epoch.game_datetime, undefined);
  assert.doesNotMatch(read(startRel), /position_angle_deg|perihelion_longitude_deg|reference_direction|3629-01-01/);
  assert.deepEqual(withoutAngleEdits(current), withoutAngleEdits(start));
});

test('both viewers draw the ten bodies at the stored angle at T+0', async function () {
  const bag = await loadStack();
  const system = bag.schema.loadSystem(readJson(systemRel));
  const before = JSON.stringify(system);
  const scene = bag.model.buildScene(system, bag.view);
  const svg = bag.draw.renderSvg(system, bag.view, bag.empire, bag.quiet);
  const close = bag.model.buildScene(system, bag.view, { frame: 'tc5' });
  const closeSvg = bag.draw.renderSvg(system, bag.view, bag.empire, bag.quiet, { frame: 'tc5' });
  const kakakiko = deg(8.13);

  ROWS.forEach(function (row) {
    const loaded = bodyById(system, row.id);
    const sceneSet = loaded.parent == null ? scene : close;
    const picture = loaded.parent == null ? svg : closeSvg;
    const cx = loaded.parent == null ? 800 : 820;
    const cy = 530;
    const record = sceneSet.bodies.find(function (body) { return body.id === row.id; });
    assert.ok(record, row.id);
    assert.equal(record.angle_missing, false, row.id);
    assert.ok(radDiff(drawnAngle(record), deg(row.position_angle_deg)) < 1e-6, row.id + ' ' + drawnAngle(record));
    const fromSvg = svgAngle(picture, row.id, cx, cy, bag.view.elevation_deg);
    assert.ok(radDiff(fromSvg, drawnAngle(record)) < 0.02, row.id + ' svg ' + fromSvg);
    assert.doesNotMatch(bag.model.infoLines(system, row.id).join('\n'), /Start angle is not set/);
    if (loaded.parent != null) {
      assert.ok(radDiff(drawnAngle(record), deg(row.position_angle_deg) + kakakiko) > 0.05, row.id);
      assert.ok(radDiff(drawnAngle(record), kakakiko + Math.PI) > 0.05, row.id);
    }
  });

  const gate = scene.bodies.find(function (body) { return body.id === 'tc6gate'; });
  const tc6 = scene.bodies.find(function (body) { return body.id === 'tc6'; });
  assert.equal(gate.angle_missing, true);
  assert.ok(radDiff(drawnAngle(gate), drawnAngle(tc6) + Math.PI / 3) < 1e-6);
  assert.ok(radDiff(drawnAngle(gate), deg(63.94)) < 1e-6, String(drawnAngle(gate)));
  assert.match(bag.model.infoLines(system, 'tc6gate').join('\n'), /Start angle is not set/);
  const gateCard = Object.assign({}, bag.view, { callouts: ['body:tc6gate'] });
  const gateSvg = bag.draw.renderSvg(system, gateCard, bag.empire, bag.quiet);
  assert.match(gateSvg, /Start angle is not set/);
  assert.match(gateSvg, /spread for reading/);

  const stations = { haven: 0, yard: 110, watch: 155 };
  Object.keys(stations).forEach(function (id) {
    const record = close.bodies.find(function (body) { return body.id === id; });
    assert.equal(record.angle_missing, false, id);
    assert.ok(radDiff(drawnAngle(record), deg(stations[id])) < 1e-6, id);
    const fromSvg = svgAngle(closeSvg, id, 820, 530, bag.view.elevation_deg);
    assert.ok(radDiff(fromSvg, drawnAngle(record)) < 0.02, id);
  });

  ['b1', 'b2'].forEach(function (id) {
    assert.equal(bag.model.angleIsMissing(bodyById(system, id)), false, id);
    assert.doesNotMatch(bag.model.infoLines(system, id).join('\n'), /Start angle is not set/);
  });

  const tc1 = bodyById(system, 'tc1');
  assert.equal(tc1.orbit.e, null);
  const gane = scene.bodies.find(function (body) { return body.id === 'tc1'; });
  assert.ok(radDiff(drawnAngle(gane), deg(202.29)) < 1e-6);
  assert.equal(JSON.stringify(system), before);
});

test('perihelion does not move T+0, and the clock returns every body to that angle', async function () {
  const bag = await loadStack();
  const system = bag.schema.loadSystem(readJson(systemRel));
  const bare = zeroPerihelion(system);
  const scene = bag.model.buildScene(system, bag.view);
  const bareScene = bag.model.buildScene(bare, bag.view);
  const close = bag.model.buildScene(system, bag.view, { frame: 'tc5' });
  const bareClose = bag.model.buildScene(bare, bag.view, { frame: 'tc5' });
  scene.bodies.forEach(function (record) {
    const other = bareScene.bodies.find(function (body) { return body.id === record.id; });
    assert.ok(radDiff(drawnAngle(record), drawnAngle(other)) < 1e-6, record.id);
  });
  close.bodies.forEach(function (record) {
    const other = bareClose.bodies.find(function (body) { return body.id === record.id; });
    assert.ok(radDiff(drawnAngle(record), drawnAngle(other)) < 1e-6, record.id);
  });

  ROWS.forEach(function (row) {
    const body = bodyById(system, row.id);
    const orbit = body.orbit;
    const a = typeof orbit.a_au === 'number' ? orbit.a_au : orbit.a_km;
    const spot = bag.kepler.positionFromAngles({
      a: a,
      e: orbit.e > 0 ? orbit.e : 0,
      period_days: orbit.period_days > 0 ? orbit.period_days : 365.25,
      position_angle_deg: orbit.position_angle_deg,
      perihelion_longitude_deg: orbit.perihelion_longitude_deg,
      reference_deg: 0
    }, 0);
    const gap = Math.abs(spot.true_longitude_deg - row.position_angle_deg);
    assert.ok(Math.min(gap, 360 - gap) < 1e-6, row.id + ' ' + spot.true_longitude_deg);
    const cartesian = Math.atan2(spot.y, spot.x);
    assert.ok(radDiff(cartesian, deg(row.position_angle_deg)) < 1e-6, row.id);
  });

  const day = 40.5;
  const movedView = Object.assign({}, bag.view, { epoch_days: day });
  const moved = bag.model.buildScene(system, movedView);
  const movedSvg = bag.draw.renderSvg(system, movedView, bag.empire, bag.quiet);
  const back = bag.model.buildScene(system, bag.view);
  const backSvg = bag.draw.renderSvg(system, bag.view, bag.empire, bag.quiet);
  const movedClose = bag.model.buildScene(system, movedView, { frame: 'tc5' });
  const backClose = bag.model.buildScene(system, bag.view, { frame: 'tc5' });
  scene.bodies.forEach(function (record) {
    const later = moved.bodies.find(function (body) { return body.id === record.id; });
    const again = back.bodies.find(function (body) { return body.id === record.id; });
    const fromSvg = svgAngle(movedSvg, record.id, 800, 530, bag.view.elevation_deg);
    const fromBack = svgAngle(backSvg, record.id, 800, 530, bag.view.elevation_deg);
    assert.ok(radDiff(fromSvg, drawnAngle(later)) < 0.02, record.id);
    assert.ok(radDiff(drawnAngle(again), drawnAngle(record)) < 1e-9, record.id);
    assert.ok(radDiff(fromBack, drawnAngle(record)) < 0.02, record.id);
  });
  close.bodies.forEach(function (record) {
    if (record.id === 'tc5') return;
    const again = backClose.bodies.find(function (body) { return body.id === record.id; });
    const later = movedClose.bodies.find(function (body) { return body.id === record.id; });
    assert.ok(radDiff(drawnAngle(again), drawnAngle(record)) < 1e-9, record.id);
    assert.ok(radDiff(drawnAngle(later), drawnAngle(record)) > 1e-4, record.id);
  });
  const gane = scene.bodies.find(function (body) { return body.id === 'tc1'; });
  const ganeLater = moved.bodies.find(function (body) { return body.id === 'tc1'; });
  assert.ok(radDiff(drawnAngle(ganeLater), drawnAngle(gane)) > 1e-3);
});

test('the loader accepts the file and the epoch line shows the game date-time', async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const warnings = [];
  const orig = console.warn;
  console.warn = function () {
    warnings.push(Array.prototype.join.call(arguments, ' '));
  };
  let loaded;
  try {
    loaded = schema.loadSystem(readJson(systemRel));
  } finally {
    console.warn = orig;
  }
  assert.deepEqual(warnings, []);
  assert.equal(loaded.orbit_match, 2);
  assert.equal(loaded.lore.version, 'v2.41c');
  assert.equal(loaded.epoch.game_datetime, '3629-01-01 00:00:01');
  assert.equal(loaded.reference_direction.deg, 0);
  ROWS.forEach(function (row) {
    const body = bodyById(loaded, row.id);
    assert.equal(body.orbit.position_angle_deg, row.position_angle_deg, row.id);
    assert.equal(loaded.skipped.some(function (item) { return item.id === row.id; }), false, row.id);
  });
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const scene = model.buildScene(loaded, view);
  const close = model.buildScene(loaded, view, { frame: 'tc5' });
  const expected = 'T+0 (epoch) · 3629-01-01 00:00:01';
  assert.equal(scene.epochLabel, expected);
  assert.equal(close.epochLabel, expected);
});
