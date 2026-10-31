const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function angDiff(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

function lcg(seed) {
  let state = seed >>> 0;
  return function () {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test('randomAngleDeg stays on a 0.01 grid, never returns 360, and repeats with the same rng', async function () {
  const { randomAngleDeg } = await import('../site/js/kepler.js');
  const seq = [0, 0.5, 0.25, 0.75, 35999 / 36000, 1];
  let i = 0;
  const rng = function () { return seq[i++]; };
  assert.equal(randomAngleDeg(rng), 0);
  assert.equal(randomAngleDeg(rng), 180);
  assert.equal(randomAngleDeg(rng), 90);
  assert.equal(randomAngleDeg(rng), 270);
  assert.equal(randomAngleDeg(rng), 359.99);
  assert.equal(randomAngleDeg(rng), 359.99);
  const first = [];
  const roll = lcg(20261030);
  for (let n = 0; n < 400; n++) first.push(randomAngleDeg(roll));
  const again = [];
  const roll2 = lcg(20261030);
  for (let n = 0; n < 400; n++) again.push(randomAngleDeg(roll2));
  assert.deepEqual(again, first);
  first.forEach(function (angle) {
    assert.ok(angle >= 0 && angle < 360, String(angle));
    assert.notEqual(angle, 360);
    assert.equal(Math.round(angle * 100) / 100, angle);
  });
});

test('parseAngleDeg accepts a number, wraps 360 to 0, and rejects text', async function () {
  const { parseAngleDeg } = await import('../site/js/kepler.js');
  assert.equal(parseAngleDeg('').empty, true);
  assert.equal(parseAngleDeg(null).empty, true);
  assert.equal(parseAngleDeg('12.34').value, 12.34);
  assert.equal(parseAngleDeg(' 15 ').value, 15);
  assert.equal(parseAngleDeg(360).value, 0);
  assert.equal(parseAngleDeg('360').value, 0);
  assert.equal(parseAngleDeg('0').value, 0);
  assert.equal(parseAngleDeg('359.99').value, 359.99);
  assert.equal(parseAngleDeg('10.004').value, 10);
  assert.equal(parseAngleDeg('10.006').value, 10.01);
  assert.equal(parseAngleDeg('359.996').value, 0);
  assert.equal(parseAngleDeg('nope').ok, false);
  assert.equal(parseAngleDeg('12deg').ok, false);
  assert.equal(parseAngleDeg('-0.01').ok, false);
  assert.equal(parseAngleDeg('360.01').ok, false);
  assert.equal(parseAngleDeg('720').ok, false);
  assert.ok(parseAngleDeg('east').error);
});

test('circular positions match the typed angle, ignore perihelion, and close after one period', async function () {
  const { positionFromAngles } = await import('../site/js/kepler.js');
  const period = 200;
  const cases = [
    { angle: 0, x: 2, y: 0 },
    { angle: 90, x: 0, y: 2 },
    { angle: 180, x: -2, y: 0 },
    { angle: 270, x: 0, y: -2 }
  ];
  cases.forEach(function (item) {
    const at = positionFromAngles({
      a: 2,
      e: 0,
      period_days: period,
      position_angle_deg: item.angle,
      perihelion_longitude_deg: 123.45
    }, 0);
    assert.ok(Math.abs(at.x - item.x) < 1e-8, item.angle + ' x ' + at.x);
    assert.ok(Math.abs(at.y - item.y) < 1e-8, item.angle + ' y ' + at.y);
    assert.ok(angDiff(at.true_longitude_deg, item.angle) < 1e-6, String(at.true_longitude_deg));
    const otherPeri = positionFromAngles({
      a: 2,
      e: 0,
      period_days: period,
      position_angle_deg: item.angle,
      perihelion_longitude_deg: 10
    }, 0);
    assert.ok(Math.abs(otherPeri.x - at.x) < 1e-8);
    assert.ok(Math.abs(otherPeri.y - at.y) < 1e-8);
  });
  const start = positionFromAngles({
    a: 2, e: 0, period_days: period, position_angle_deg: 10, perihelion_longitude_deg: 80
  }, 0);
  const quarter = positionFromAngles({
    a: 2, e: 0, period_days: period, position_angle_deg: 10, perihelion_longitude_deg: 80
  }, period / 4);
  assert.ok(angDiff(quarter.true_longitude_deg, 100) < 1e-4, String(quarter.true_longitude_deg));
  const back = positionFromAngles({
    a: 2, e: 0, period_days: period, position_angle_deg: 10, perihelion_longitude_deg: 80
  }, period);
  assert.ok(Math.abs(back.x - start.x) < 1e-8, String(back.x));
  assert.ok(Math.abs(back.y - start.y) < 1e-8, String(back.y));
});

test('eccentric position matches an independent perihelion and aphelion check', async function () {
  const { positionFromAngles } = await import('../site/js/kepler.js');
  const quarter = positionFromAngles({
    a: 1,
    e: 0.5,
    period_days: 365.25,
    position_angle_deg: 90,
    perihelion_longitude_deg: 0
  }, 0);
  assert.ok(Math.abs(quarter.x) < 1e-8, String(quarter.x));
  assert.ok(Math.abs(quarter.y - 0.75) < 1e-8, String(quarter.y));
  assert.ok(Math.abs(quarter.radius - 0.75) < 1e-8, String(quarter.radius));
  const peri = positionFromAngles({
    a: 5,
    e: 0.2,
    period_days: 1000,
    position_angle_deg: 40,
    perihelion_longitude_deg: 40
  }, 0);
  const closest = 5 * (1 - 0.2);
  assert.ok(Math.abs(peri.radius - closest) < 1e-6, String(peri.radius));
  assert.ok(Math.abs(peri.x - closest * Math.cos(40 * Math.PI / 180)) < 1e-6, String(peri.x));
  assert.ok(Math.abs(peri.y - closest * Math.sin(40 * Math.PI / 180)) < 1e-6, String(peri.y));
  const apo = positionFromAngles({
    a: 2,
    e: 0.3,
    period_days: 400,
    position_angle_deg: 0,
    perihelion_longitude_deg: 0
  }, 200);
  assert.ok(Math.abs(apo.radius - 2 * 1.3) < 1e-6, String(apo.radius));
  assert.ok(Math.abs(apo.x + 2.6) < 1e-6, String(apo.x));
  assert.ok(Math.abs(apo.y) < 1e-6, String(apo.y));
  const epoch = positionFromAngles({
    a: 1.5,
    e: 0.4,
    period_days: 500,
    position_angle_deg: 12.34,
    perihelion_longitude_deg: 200
  }, 0);
  assert.ok(angDiff(epoch.true_longitude_deg, 12.34) < 1e-4, String(epoch.true_longitude_deg));
  const later = positionFromAngles({
    a: 1.5,
    e: 0.4,
    period_days: 500,
    position_angle_deg: 12.34,
    perihelion_longitude_deg: 200
  }, 500);
  assert.ok(Math.abs(later.x - epoch.x) < 1e-6, String(later.x));
  assert.ok(Math.abs(later.y - epoch.y) < 1e-6, String(later.y));
});

test('a reference direction rotates the drawing and leaves true longitude on the typed angle', async function () {
  const { positionFromAngles } = await import('../site/js/kepler.js');
  const turned = positionFromAngles({
    a: 1,
    e: 0,
    period_days: 100,
    position_angle_deg: 0,
    perihelion_longitude_deg: 20,
    reference_deg: 90
  }, 0);
  assert.ok(Math.abs(turned.x) < 1e-8, String(turned.x));
  assert.ok(Math.abs(turned.y - 1) < 1e-8, String(turned.y));
  assert.ok(angDiff(turned.true_longitude_deg, 0) < 1e-6, String(turned.true_longitude_deg));
});

test('old systems load with no new angles and new fields round-trip', async function () {
  const schema = await import('../site/js/schema.js');
  const old = schema.loadSystem({
    orbit_match: 2,
    star: { hostname: 'Old', mass_solar: 1 },
    epoch: { t0_days: 0, label: 'T+0 (circa 1600 yrs hence)', canon: 'placeholder' },
    bodies: [
      { id: 'a', kind: 'planet', name: 'A', orbit: { a_au: 1, e: 0 } },
      { id: 'yard', kind: 'structure', parent: 'a', angle_deg: 110, orbit: { a_km: 54076 } }
    ]
  });
  assert.equal(old.reference_direction, undefined);
  assert.equal(old.epoch.t0_days, 0);
  assert.equal(old.epoch.canon, 'placeholder');
  assert.equal(old.bodies[0].orbit.position_angle_deg, undefined);
  assert.equal(old.bodies[0].orbit.perihelion_longitude_deg, undefined);
  assert.equal(old.bodies[1].angle_deg, 110);
  assert.equal(old.bodies[1].orbit.position_angle_deg, undefined);
  const tau = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  assert.equal(tau.reference_direction, undefined);
  assert.equal(tau.epoch.canon, 'placeholder');
  assert.equal(tau.bodies.some(function (body) {
    return body.orbit && (body.orbit.position_angle_deg != null || body.orbit.perihelion_longitude_deg != null);
  }), false);
  assert.doesNotMatch(read('site/data/tau-ceti.system.json'), /position_angle_deg|perihelion_longitude_deg|reference_direction/);
  const made = schema.loadSystem(readJson('test/fixtures/made-up-angles.system.json'));
  assert.equal(made.note.indexOf('Not Turquenish') >= 0, true);
  assert.equal(made.epoch, '');
  assert.equal(made.reference_direction.deg, 0);
  assert.equal(made.reference_direction.label, 'toward the vernal point / arbitrary');
  assert.equal(made.bodies[0].orbit.position_angle_deg, 90);
  assert.equal(made.bodies[0].orbit.perihelion_longitude_deg, 10);
  const round = schema.loadSystem({
    orbit_match: 2,
    epoch: '2026-10-30',
    reference_direction: { label: 'toward the vernal point / arbitrary', deg: '360' },
    star: { mass_solar: 1 },
    bodies: [{
      id: 'p',
      kind: 'planet',
      orbit: {
        a_au: '1',
        e: '0.2',
        position_angle_deg: '360',
        perihelion_longitude_deg: '12.50'
      }
    }]
  });
  assert.equal(round.epoch, '2026-10-30');
  assert.equal(round.reference_direction.deg, 0);
  assert.equal(round.bodies[0].orbit.position_angle_deg, 0);
  assert.equal(round.bodies[0].orbit.perihelion_longitude_deg, 12.5);
  assert.equal(round.bodies[0].position_angle_deg, undefined);
  const migrated = schema.loadSystem({
    orbit_match: 1,
    epoch: '',
    reference_direction: { label: 'toward the vernal point / arbitrary', deg: 0 },
    star: { mass_solar: '1' },
    bodies: [{
      id: 'host',
      kind: 'planet',
      au: '1',
      period: '1',
      unit: 'years',
      position_angle_deg: 15.25,
      perihelion_longitude_deg: 200,
      moons: [{
        id: 'moon',
        kind: 'moon',
        distanceKm: '400000',
        period: '10',
        unit: 'days',
        position_angle_deg: 360,
        perihelion_longitude_deg: 1
      }]
    }]
  });
  assert.equal(migrated.orbit_match, 2);
  assert.equal(migrated.epoch, '');
  const host = migrated.bodies.find(function (body) { return body.id === 'host'; });
  const moon = migrated.bodies.find(function (body) { return body.id === 'moon'; });
  assert.equal(host.orbit.a_au, 1);
  assert.equal(host.orbit.period_days, 365.25);
  assert.equal(host.orbit.position_angle_deg, 15.25);
  assert.equal(host.orbit.perihelion_longitude_deg, 200);
  assert.equal(host.position_angle_deg, undefined);
  assert.equal(moon.parent, 'host');
  assert.equal(moon.orbit.a_km, 400000);
  assert.equal(moon.orbit.position_angle_deg, 0);
  assert.equal(moon.orbit.perihelion_longitude_deg, 1);
  assert.throws(function () {
    schema.loadSystem({
      orbit_match: 2,
      bodies: [{ id: 'bad', orbit: { a_au: 1, position_angle_deg: 'nope' } }]
    });
  }, /position_angle_deg/);
  assert.throws(function () {
    schema.loadSystem({
      orbit_match: 2,
      bodies: [{ id: 'bad', orbit: { a_au: 1, perihelion_longitude_deg: -2 } }]
    });
  }, /perihelion_longitude_deg/);
  assert.throws(function () {
    schema.loadSystem({
      orbit_match: 2,
      bodies: [{ id: 'bad', orbit: { a_au: 1, position_angle_deg: 360.01 } }]
    });
  }, /position_angle_deg/);
  assert.throws(function () {
    schema.loadSystem({
      orbit_match: 2,
      reference_direction: { label: 'toward the vernal point / arbitrary', deg: 'east' },
      bodies: []
    });
  }, /reference_direction/);
});

test('builder link round-trips epoch, reference direction, and both planet angles', async function () {
  const link = await import('../site/js/builder-link.js');
  const schema = await import('../site/js/schema.js');
  const header = {
    hostname: 'Demo',
    setting_name: '',
    spectype: 'G2V',
    mass: '1',
    lum: '0',
    teff: '5800',
    rad: '1',
    x: '',
    y: '',
    z: '',
    planets: '1',
    concept: 'made up',
    holder: '',
    port: '',
    services: '',
    fuel: '',
    fuel_unit: '',
    arrivals: [],
    epoch: '2026-10-30',
    reference_label: 'toward the vernal point / arbitrary',
    reference_deg: '360'
  };
  const bodies = [{
    id: 'p1',
    kind: 'planet',
    name: 'One',
    period: '365.25',
    unit: 'days',
    au: '1',
    position_angle_deg: '12.34',
    perihelion_longitude_deg: '359.99',
    moons: []
  }];
  const saved = link.systemRecordFromManual(header, bodies);
  assert.equal(saved.epoch, '2026-10-30');
  assert.equal(saved.reference_direction.deg, 0);
  assert.equal(saved.reference_direction.label, 'toward the vernal point / arbitrary');
  assert.equal(saved.bodies[0].position_angle_deg, 12.34);
  assert.equal(saved.bodies[0].perihelion_longitude_deg, 359.99);
  assert.equal(saved.star.mass_solar, 1);
  assert.equal(saved.card.high_concept, 'made up');
  const loaded = schema.loadSystem(saved);
  const backBody = link.manualBodyFromSystem(loaded.bodies[0]);
  const backHeader = link.manualHeaderFromSystem(loaded);
  assert.equal(backBody.position_angle_deg, '12.34');
  assert.equal(backBody.perihelion_longitude_deg, '359.99');
  assert.equal(backBody.au, '1');
  assert.equal(backHeader.epoch, '2026-10-30');
  assert.equal(backHeader.reference_deg, '0');
  assert.equal(backHeader.reference_label, 'toward the vernal point / arbitrary');
  const again = link.systemRecordFromManual(Object.assign({}, header, backHeader), [backBody]);
  assert.equal(again.bodies[0].position_angle_deg, 12.34);
  assert.equal(again.bodies[0].perihelion_longitude_deg, 359.99);
  assert.equal(again.reference_direction.deg, 0);
  assert.throws(function () {
    link.systemRecordFromManual(header, [{ id: 'x', position_angle_deg: 'east', perihelion_longitude_deg: '1' }]);
  }, /position_angle_deg/);
  const kept = link.manualBodyFromSystem({
    id: 'tc5',
    name: 'Kakakiko',
    orbit: { a_au: 0.71, e: 0.0396, period_days: 247.4 }
  });
  assert.equal(kept.position_angle_deg, undefined);
  assert.equal(kept.au, '0.71');
});

test('viewers place a stored angle exactly and spread an old system that has none', async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const draw = await import('../site/js/render-svg.js');
  const quiet = readJson('site/themes/quiet.json');
  const empire = readJson('site/themes/empire.json');
  const view = {
    elevation_deg: 20,
    azimuth_deg: 0,
    distance_mode: 'linear',
    epoch_days: 0,
    theme: 'empire',
    style: 'quiet',
    layers: { orbits: false, belts: false, habitable: false, transfers: false, labels: false }
  };
  const legacy = schema.loadSystem({
    orbit_match: 2,
    star: { name: 'Old', mass_solar: 1 },
    bodies: [
      { id: 'a', name: 'A', kind: 'planet', orbit: { a_au: 1, e: 0, period_days: 365 } },
      { id: 'b', name: 'B', kind: 'planet', orbit: { a_au: 2, e: 0, period_days: 700 } },
      { id: 'gate', name: 'Gate', kind: 'structure', parent: null, orbit: { a_au: 2, e: 0, period_days: 700 }, lagrange: { of: 'b', point: 'L4' } }
    ]
  });
  const oldScene = model.buildScene(legacy, view);
  const a = oldScene.bodies.find(function (body) { return body.id === 'a'; });
  const b = oldScene.bodies.find(function (body) { return body.id === 'b'; });
  const gate = oldScene.bodies.find(function (body) { return body.id === 'gate'; });
  assert.ok(a.position.x > 0, String(a.position.x));
  assert.ok(Math.abs(a.position.z) < 1e-6, String(a.position.z));
  assert.equal(a.angle_missing, true);
  const bAngle = Math.atan2(-b.position.z, b.position.x);
  const bWrap = ((bAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  assert.ok(Math.abs(bWrap - (Math.PI * 2) / 3) < 1e-6, String(bAngle));
  assert.equal(b.angle_missing, true);
  const gateAngle = Math.atan2(-gate.position.z, gate.position.x);
  const gateGap = Math.abs(gateAngle - (bAngle + Math.PI / 3)) % (Math.PI * 2);
  assert.ok(Math.min(gateGap, Math.PI * 2 - gateGap) < 1e-6, String(gateAngle));
  const ra = Math.hypot(a.position.x, a.position.z);
  const rb = Math.hypot(b.position.x, b.position.z);
  assert.ok(Math.abs(rb / ra - 2) < 1e-6, String(rb / ra));
  const svgLegacy = draw.renderSvg(legacy, view, empire, quiet);
  const diskA = svgLegacy.match(/<circle\b[^>]*\bdata-id="a"[^>]*>/);
  const diskB = svgLegacy.match(/<circle\b[^>]*\bdata-id="b"[^>]*>/);
  assert.ok(diskA && diskB, 'legacy disks');
  assert.ok(Number(diskA[0].match(/\bcx="([^"]+)"/)[1]) > 800);
  assert.ok(Number(diskB[0].match(/\bcx="([^"]+)"/)[1]) < 800);
  const fresh = schema.loadSystem(readJson('test/fixtures/made-up-angles.system.json'));
  const scene = model.buildScene(fresh, view);
  const demo = scene.bodies.find(function (body) { return body.id === 'demo'; });
  assert.ok(Math.abs(demo.position.x) < 1e-6, String(demo.position.x));
  assert.ok(demo.position.z < 0, String(demo.position.z));
  assert.equal(scene.epochLabel, 'TBD');
  const moved = model.buildScene(fresh, Object.assign({}, view, { epoch_days: 365.25 / 4 }));
  const later = moved.bodies.find(function (body) { return body.id === 'demo'; });
  assert.ok(later.position.x < 0, String(later.position.x));
  assert.ok(Math.abs(later.position.z) < 1e-4, String(later.position.z));
  const svg = draw.renderSvg(fresh, view, empire, quiet);
  const disk = svg.match(/<circle\b[^>]*\bdata-id="demo"[^>]*>/);
  assert.ok(disk, svg.slice(0, 200));
  const cx = Number(disk[0].match(/\bcx="([^"]+)"/)[1]);
  const cy = Number(disk[0].match(/\bcy="([^"]+)"/)[1]);
  assert.ok(Math.abs(cx - 800) < 1.5, String(cx));
  assert.ok(cy < 530, String(cy));
  const svgLater = draw.renderSvg(fresh, Object.assign({}, view, { epoch_days: 365.25 / 4 }), empire, quiet);
  const diskLater = svgLater.match(/<circle\b[^>]*\bdata-id="demo"[^>]*>/);
  const laterX = Number(diskLater[0].match(/\bcx="([^"]+)"/)[1]);
  assert.ok(laterX < 800, String(laterX));
  assert.doesNotMatch(read('site/viewer/index.html'), /three/i);
  assert.doesNotMatch(read('site/viewer/viewer.js'), /from\s+['"]three['"]/);
  assert.match(model.FALLBACK.body, /SVG system view still works/);
});

test('the builder page can enter or randomize both angles', function () {
  const page = read('site/manual/index.html');
  const manual = read('site/manual/manual.js');
  assert.match(page, /Orbit angles/);
  assert.match(page, /data-header="epoch"/);
  assert.match(page, /data-header="reference_label"/);
  assert.match(page, /data-header="reference_deg"/);
  assert.match(page, /Randomize all planets/);
  assert.match(manual, /position_angle_deg/);
  assert.match(manual, /perihelion_longitude_deg/);
  assert.match(manual, /random-position/);
  assert.match(manual, /random-perihelion/);
  assert.match(manual, /randomize-all/);
  assert.match(manual, /parseAngleDeg/);
  assert.match(manual, /systemRecordFromManual/);
});

test('moon form has both angle inputs', function () {
  const manual = read('site/manual/manual.js');
  const page = read('site/manual/index.html');
  assert.match(manual, /data-moon-field="position_angle_deg"/);
  assert.match(manual, /data-moon-field="perihelion_longitude_deg"/);
  assert.match(manual, /random-moon-position/);
  assert.match(manual, /random-moon-perihelion/);
  assert.match(page, /every moon/);
  assert.match(page, /Belts stay blank/);
});

test('randomize all sets a moon angle and skips a belt', async function () {
  const link = await import('../site/js/builder-link.js');
  const manual = read('site/manual/manual.js');
  assert.equal(typeof link.randomizeManualAngles, 'function');
  assert.match(manual, /randomizeManualAngles/);
  assert.doesNotMatch(manual, /kind === "moon" \|\| body\.kind === "belt"/);
  let n = 0;
  const rolls = [12.5, 40, 70.25, 80, 3, 4];
  const rows = [
    {
      id: 'p',
      kind: 'planet',
      position_angle_deg: '',
      perihelion_longitude_deg: '',
      moons: [{ id: 'm', kind: 'moon', position_angle_deg: '', perihelion_longitude_deg: '' }]
    },
    { id: 'b', kind: 'belt', position_angle_deg: '', perihelion_longitude_deg: '', moons: [] },
    { id: 'lone', kind: 'moon', position_angle_deg: '', perihelion_longitude_deg: '' }
  ];
  const after = link.randomizeManualAngles(rows, function () { return rolls[n++]; });
  assert.equal(after[0].position_angle_deg, '12.50');
  assert.equal(after[0].perihelion_longitude_deg, '40.00');
  assert.equal(after[0].moons[0].position_angle_deg, '70.25');
  assert.equal(after[0].moons[0].perihelion_longitude_deg, '80.00');
  assert.equal(after[1].position_angle_deg, '');
  assert.equal(after[1].perihelion_longitude_deg, '');
  assert.equal(after[2].position_angle_deg, '3.00');
  assert.equal(after[2].perihelion_longitude_deg, '4.00');
  assert.equal(rows[0].position_angle_deg, '');
  assert.equal(rows[0].moons[0].position_angle_deg, '');
  const header = {
    hostname: 'Demo',
    epoch: '',
    reference_label: 'toward the vernal point / arbitrary',
    reference_deg: '0'
  };
  const saved = link.systemRecordFromManual(header, [{
    id: 'p1',
    kind: 'planet',
    name: 'Host',
    period: '10',
    unit: 'days',
    au: '1',
    moons: [{
      id: 'm1',
      kind: 'moon',
      name: 'Pebble',
      period: '2',
      unit: 'days',
      distanceKm: '10000',
      position_angle_deg: '360',
      perihelion_longitude_deg: '15.5'
    }]
  }]);
  assert.equal(saved.bodies[0].moons[0].position_angle_deg, 0);
  assert.equal(saved.bodies[0].moons[0].perihelion_longitude_deg, 15.5);
  const schema = await import('../site/js/schema.js');
  const loaded = schema.loadSystem(saved);
  const moon = loaded.bodies.find(function (body) { return body.id === 'm1'; });
  assert.equal(moon.parent, 'p1');
  assert.equal(moon.orbit.position_angle_deg, 0);
  assert.equal(moon.orbit.perihelion_longitude_deg, 15.5);
  assert.equal(moon.orbit.a_km, 10000);
  const back = link.manualBodyFromSystem(moon);
  assert.equal(back.position_angle_deg, '0');
  assert.equal(back.perihelion_longitude_deg, '15.5');
  assert.throws(function () {
    link.systemRecordFromManual(header, [{
      id: 'p2',
      moons: [{ id: 'bad', position_angle_deg: 'east', perihelion_longitude_deg: '1' }]
    }]);
  }, /position_angle_deg/);
});

test('a missing angle is flagged and is not written', async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const draw = await import('../site/js/render-svg.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const before = JSON.stringify(system);
  const close = model.buildScene(system, view, { frame: 'tc5' });
  const shudder = close.bodies.find(function (body) { return body.id === 'tc5a'; });
  assert.equal(shudder.angle_missing, true);
  const kepler = await import('../site/js/kepler.js');
  const shudderM0 = (3 / 5) * Math.PI * 2;
  const shudderSpot = kepler.pos({ a: 151060, e: 0.2, period_days: 6.607, M0: shudderM0, w: 0 }, 0);
  const shudderDrawn = Math.atan2(-shudder.position.z, shudder.position.x);
  const shudderExpected = Math.atan2(shudderSpot.y, shudderSpot.x);
  const shudderGap = Math.abs(shudderDrawn - shudderExpected) % (Math.PI * 2);
  assert.ok(Math.min(shudderGap, Math.PI * 2 - shudderGap) < 1e-6, String(shudderDrawn));
  assert.equal(JSON.stringify(system), before);
  const stored = system.bodies.find(function (body) { return body.id === 'tc5a'; });
  assert.equal(stored.orbit.position_angle_deg, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, 'angle_deg'), false);
  const half = model.buildScene(system, Object.assign({}, view, { epoch_days: 6.607 / 2 }), { frame: 'tc5' });
  const moved = half.bodies.find(function (body) { return body.id === 'tc5a'; });
  assert.ok(Math.hypot(moved.position.x - shudder.position.x, moved.position.z - shudder.position.z) > 0.05);
  const full = model.buildScene(system, Object.assign({}, view, { epoch_days: 6.607 }), { frame: 'tc5' });
  const back = full.bodies.find(function (body) { return body.id === 'tc5a'; });
  assert.ok(Math.hypot(back.position.x - shudder.position.x, back.position.z - shudder.position.z) < 1e-4);
  assert.match(model.infoLines(system, 'tc5a').join('\n'), /Start angle is not set/);
  assert.match(model.infoLines(system, 'tc5a').join('\n'), /spread for reading/);
  assert.match(model.infoLines(system, 'tc5a').join('\n'), /not a canon angle/);
  assert.doesNotMatch(model.infoLines(system, 'yard').join('\n'), /Start angle is not set/);
  const quiet = readJson('site/themes/quiet.json');
  const empire = readJson('site/themes/empire.json');
  const cardView = Object.assign({}, view, { callouts: ['body:tc5a'] });
  const svg = draw.renderSvg(system, cardView, empire, quiet, { frame: 'tc5' });
  assert.match(svg, /Start angle is not set/);
  assert.match(svg, /spread for reading/);
  assert.match(svg, /not a canon angle/);
});

test("Yard's angle_deg 110 is the start angle", async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const draw = await import('../site/js/render-svg.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const yardBody = system.bodies.find(function (body) { return body.id === 'yard'; });
  assert.equal(yardBody.angle_deg, 110);
  assert.equal(yardBody.canon.angle_deg, 'locked');
  assert.equal(yardBody.orbit.position_angle_deg, undefined);
  const before = JSON.stringify(yardBody);
  const close = model.buildScene(system, view, { frame: 'tc5' });
  const yard = close.bodies.find(function (body) { return body.id === 'yard'; });
  assert.equal(yard.angle_missing, false);
  const angle = Math.atan2(-yard.position.z, yard.position.x);
  assert.ok(Math.abs(angle - (110 * Math.PI) / 180) < 1e-6, String(angle));
  assert.equal(JSON.stringify(yardBody), before);
  const quiet = readJson('site/themes/quiet.json');
  const empire = readJson('site/themes/empire.json');
  const svg = draw.renderSvg(system, view, empire, quiet, { frame: 'tc5' });
  const disk = svg.match(/<circle\b[^>]*\bdata-id="yard"[^>]*>/);
  assert.ok(disk, 'yard disk');
  const cx = Number(disk[0].match(/\bcx="([^"]+)"/)[1]);
  const cy = Number(disk[0].match(/\bcy="([^"]+)"/)[1]);
  assert.ok(cx < 820, String(cx));
  assert.ok(cy < 530, String(cy));
});
