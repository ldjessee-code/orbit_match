const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const fixturePath = path.join(root, 'site', 'data', 'tau-ceti.system.json');
const viewPath = path.join(root, 'site', 'data', 'tau-ceti.view.json');
const stabilityPath = path.join(root, 'site', 'data', 'tau-ceti.stability.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function body(system, id) {
  const found = system.bodies.find(function (item) { return item.id === id; });
  assert.ok(found, 'missing body ' + id);
  return found;
}

function valueAt(system, dotted) {
  const parts = dotted.split('.');
  let cursor = system;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (Array.isArray(cursor)) {
      cursor = cursor.find(function (item) { return item && item.id === part; });
    } else {
      cursor = cursor[part];
    }
    assert.notEqual(cursor, undefined, dotted);
  }
  return cursor;
}

const copied = {
  'star.hostname': 'tau Cet',
  'star.setting_name': 'Turquenish',
  'star.spectype': 'G8V',
  'star.mass_solar': 0.78,
  'star.lum_solar': 0.488,
  'star.lum_log': -0.3116,
  'star.teff_k': 5320,
  'star.radius_solar': 0.793,
  'star.hz_inner_au': 0.68,
  'star.hz_outer_au': 1.22,
  'bodies.tc1.name': 'Gane',
  'bodies.tc1.orbit.a_au': 0.133,
  'bodies.tc1.orbit.period_days': 20.1,
  'bodies.tc1.orbit.e': null,
  'bodies.tc1.physical.mass_earth': 0.06,
  'bodies.tc1.physical.radius_km': 2820,
  'bodies.tc2.name': 'Hornstooth',
  'bodies.tc2.orbit.a_au': 0.243,
  'bodies.tc2.orbit.period_days': 49.5,
  'bodies.tc2.physical.mass_earth': 0.08,
  'bodies.tc2.physical.radius_km': 3110,
  'bodies.tc3.name': 'Husk',
  'bodies.tc3.orbit.a_au': 0.34,
  'bodies.tc3.orbit.period_days': 82,
  'bodies.tc3.physical.mass_earth': 0.1,
  'bodies.tc3.physical.radius_km': 3350,
  'bodies.tc4.name': 'Sable',
  'bodies.tc4.orbit.a_au': 0.538,
  'bodies.tc4.orbit.e': 0,
  'bodies.tc4.orbit.e_max': 0.1,
  'bodies.tc4.orbit.period_days': 163.2,
  'bodies.tc4.physical.mass_earth': 2,
  'bodies.tc4.physical.radius_km': 7900,
  'bodies.tc5.name': 'Kakakiko',
  'bodies.tc5.orbit.a_au': 0.71,
  'bodies.tc5.orbit.e': 0.0396,
  'bodies.tc5.orbit.period_days': 247.4,
  'bodies.tc5.physical.mass_earth': 1.045,
  'bodies.tc5.physical.radius_km': 6628,
  'bodies.tc5.physical.surface_g': 0.967,
  'bodies.tc5.physical.rotation_h': 34,
  'bodies.tc5.physical.tilt_deg': 12,
  'bodies.tc5a.name': 'Shudder',
  'bodies.tc5a.parent': 'tc5',
  'bodies.tc5a.orbit.a_km': 151060,
  'bodies.tc5a.orbit.e': 0.2,
  'bodies.tc5a.orbit.period_days': 6.607,
  'bodies.tc5a.physical.mass_kg': 1.491e22,
  'bodies.tc5a.physical.radius_km': 1083.5,
  'bodies.tc5b.name': 'Der Eindringling',
  'bodies.tc5b.parent': 'tc5',
  'bodies.tc5b.orbit.a_km': 240000,
  'bodies.tc5b.orbit.e': 0.03,
  'bodies.tc5b.orbit.period_days': 13.213,
  'bodies.tc5b.physical.mass_kg': 3.122e22,
  'bodies.tc5b.physical.radius_km': 1012,
  'bodies.haven.name': 'Haven',
  'bodies.haven.parent': 'tc5',
  'bodies.haven.orbit.a_km': 54076,
  'bodies.yard.name': 'Yard',
  'bodies.yard.parent': 'tc5',
  'bodies.yard.orbit.a_km': 54076,
  'bodies.yard.angle_deg': 110,
  'bodies.watch.name': 'Watch station',
  'bodies.watch.parent': 'tc5',
  'bodies.watch.orbit.a_km': 54076,
  'bodies.watch.angle_deg': 155,
  'bodies.tc6.name': 'Croquet Ball',
  'bodies.tc6.orbit.a_au': 2.8,
  'bodies.tc6.physical.mass_earth': 95,
  'bodies.tc6.physical.radius_km': 58200,
  'bodies.tc6gate.parent': null,
  'bodies.tc6gate.lagrange.of': 'tc6',
  'bodies.tc6gate.orbit.a_au': 2.8,
  'bodies.tc7.name': 'Cue Ball',
  'bodies.tc7.orbit.a_au': 5.5,
  'bodies.tc7.physical.mass_earth': 17,
  'bodies.tc7.physical.radius_km': 24600,
  'bodies.tc8.name': 'Eight Ball',
  'bodies.tc8.orbit.a_au': 9.2,
  'bodies.tc8.physical.mass_earth': 13,
  'bodies.tc8.physical.radius_km': 24500,
  'bodies.b1.name': 'The Sombrero',
  'bodies.b1.orbit.a_inner_au': 1.1,
  'bodies.b1.orbit.a_outer_au': 1.6,
  'bodies.b2.name': 'Outer Wall',
  'bodies.b2.orbit.a_inner_au': 10,
  'bodies.b2.orbit.a_outer_au': 52
};

test('version 1 nested moon migrates to a flat body', async function () {
  const schema = await import('../site/js/schema.js');
  const loaded = schema.loadSystem({
    orbit_match: 1,
    kind: 'system',
    star: { hostname: 'Example', mass_solar: '1', lum_log: '0' },
    bodies: [{
      id: 'b1234567',
      kind: 'planet',
      name: 'Host',
      au: '1',
      period: '1',
      unit: 'years',
      extra_note: 'kept',
      moons: [{
        id: 'bmoon1',
        kind: 'moon',
        name: 'Moon',
        distanceKm: '400000',
        period: '28',
        unit: 'days'
      }]
    }]
  });
  assert.equal(loaded.orbit_match, 2);
  const host = body(loaded, 'b1234567');
  const moon = body(loaded, 'bmoon1');
  assert.equal(host.orbit.a_au, 1);
  assert.equal(host.orbit.period_days, 365.25);
  assert.equal(host.extra_note, 'kept');
  assert.equal(host.moons, undefined);
  assert.equal(moon.parent, 'b1234567');
  assert.equal(moon.orbit.a_km, 400000);
  assert.equal(moon.orbit.period_days, 28);
  assert.equal(moon.id, 'bmoon1');
});

test('a numeric string becomes a number and a period can be derived', async function () {
  const schema = await import('../site/js/schema.js');
  const loaded = schema.loadSystem({
    orbit_match: 2,
    star: { mass_solar: 1 },
    bodies: [
      { id: 'near', kind: 'planet', orbit: { a_au: '0.71' } },
      { id: 'one', kind: 'planet', orbit: { a_au: 1 } },
      { id: 'blank', kind: 'planet', name: 'No orbit' }
    ]
  });
  assert.equal(body(loaded, 'near').orbit.a_au, 0.71);
  assert.equal(body(loaded, 'one').orbit.period_days, 365.25);
  assert.deepEqual(loaded.skipped.map(function (item) { return item.id; }), ['blank']);
});

test('version 3 is rejected and a foreign id is kept', async function () {
  const schema = await import('../site/js/schema.js');
  assert.throws(function () { schema.loadSystem({ orbit_match: 3, bodies: [] }); }, /3/);
  assert.throws(function () { schema.loadSystem({ kind: 'system' }); }, /orbit_match/);
  const loaded = schema.loadSystem({
    orbit_match: 2,
    star: { hostname: 'Elsewhere', mass_solar: 1 },
    nickname: 'kept',
    bodies: [{ id: 'alpha', kind: 'planet', orbit: { a_au: 1 } }]
  });
  assert.equal(body(loaded, 'alpha').id, 'alpha');
  assert.equal(loaded.nickname, 'kept');
});

test('tau ceti fixture matches the v2.41c copy list', async function () {
  const schema = await import('../site/js/schema.js');
  const raw = readJson(fixturePath);
  const loaded = schema.loadSystem(raw);
  assert.equal(loaded.lore.version, 'v2.41c');
  assert.equal(loaded.lore.source, 'F:\\Dropbox\\Projects\\Turquenish\\systems\\tauCet\\Tau_Cet_system_v2.md');
  assert.deepEqual(loaded.lore.copied, Object.keys(copied));
  for (const dotted of loaded.lore.copied) {
    assert.equal(valueAt(loaded, dotted), copied[dotted], dotted);
  }
  assert.equal(body(loaded, 'tc5a').id, 'tc5a');
  assert.notEqual(body(loaded, 'tc8').name, 'tC 8');
  assert.equal(body(loaded, 'tc5a').orbit.a_km * (1 - body(loaded, 'tc5a').orbit.e), 120848);
  assert.equal(loaded.bodies.some(function (item) { return item.id === 'l4' || item.id === 'l5'; }), false);
  assert.equal(body(loaded, 'tc6gate').lagrange.point, 'L4 or L5');
});

test('the view file accepts quiet, holo, empire, and mardat', async function () {
  const schema = await import('../site/js/schema.js');
  const view = schema.loadView(readJson(viewPath));
  assert.equal(view.orbit_match_view, 1);
  assert.equal(view.style, 'quiet');
  assert.equal(view.theme, 'empire');
  assert.equal(view.elevation_deg, 20);
  assert.equal(view.azimuth_deg, 0);
  assert.equal(schema.loadView({ orbit_match_view: 1, style: 'holo', theme: 'mardat' }).theme, 'mardat');
  assert.equal(schema.loadView({ orbit_match_view: 1, style: 'quiet', theme: 'desert-court', elevation_deg: 10, azimuth_deg: 90 }).theme, 'desert-court');
  assert.equal(schema.loadView({ orbit_match_view: 1, elevation_deg: 10 }).elevation_deg, 15);
  assert.equal(schema.loadView({ orbit_match_view: 1, elevation_deg: 80 }).elevation_deg, 75);
});

test('stability note is the v2.41c moon run', function () {
  const note = readJson(stabilityPath);
  const text = JSON.stringify(note);
  assert.match(text, /20,000/);
  assert.match(text, /2:1/);
  assert.doesNotMatch(text, /4\.5 year/);
  assert.equal(note.moons.drawn.a_km.shudder, 151060);
  assert.equal(note.moons.drawn.a_km.der, 240000);
});
