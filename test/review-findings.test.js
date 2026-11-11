// Failing tests for CODE_REVIEW.md. Each test name starts with its finding id.
// These describe the correct behavior, so they fail until that finding is fixed.
// Browser-only findings are in review-browser.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function byId(system, id) {
  return system.bodies.find(function (body) { return body.id === id; });
}

async function tools() {
  return {
    schema: await import('../site/js/schema.js'),
    link: await import('../site/js/builder-link.js'),
    draw: await import('../site/js/render-svg.js'),
    model: await import('../site/viewer3d/scene-model.js'),
    source: await import('../site/js/system-source.js'),
    kepler: await import('../site/js/kepler.js'),
    quiet: readJson('site/themes/quiet.json'),
    empire: readJson('site/themes/empire.json')
  };
}

// The one place that knows how the builder opens and saves a file. It mirrors
// loadSystem and saveFile in manual.js. When the writer changes, change this.
function builderOpen(link, data) {
  const star = data.star || {};
  const card = data.card || {};
  const text = function (value) { return value == null ? '' : String(value); };
  const header = Object.assign({
    hostname: star.hostname || '',
    setting_name: star.setting_name || '',
    spectype: star.spectype || '',
    mass: text(star.mass_solar),
    lum: text(star.lum_log),
    teff: text(star.teff_k),
    rad: text(star.radius_solar),
    x: text(star.x_ly),
    y: text(star.y_ly),
    z: text(star.z_ly),
    planets: text(data.known_planet_count),
    concept: card.high_concept || '',
    port: card.port || '',
    services: (card.services || []).join(', '),
    holder: card.holder || '',
    fuel: card.fuel || '',
    fuel_unit: card.fuel_unit || '',
    arrivals: (data.arrivals || []).map(function (item) { return item.from_hostname; })
  }, link.manualHeaderFromSystem(data));
  const bodies = (data.bodies || []).map(function (body) { return link.manualCardFromSystem(body); });
  return { header: header, bodies: bodies };
}

function builderSave(link, form) {
  return JSON.parse(JSON.stringify(link.systemRecordFromManual(form.header, form.bodies)));
}

function svgAt(t, system, view, frame) {
  const style = t.quiet;
  return t.draw.renderSvg(system, view, t.empire, style, { frame: frame || 'system' });
}

function tauView(t, extra) {
  return Object.assign(t.schema.loadView(readJson('site/data/tau-ceti.view.json')), extra || {});
}

function pathStart(svg, role) {
  const found = new RegExp('data-role="' + role + '"[^>]* d="M\\s*([-\\d.]+)[ ,]([-\\d.]+)').exec(svg);
  return found ? { x: Number(found[1]), y: Number(found[2]) } : null;
}

function pathEnd(svg, role) {
  const found = new RegExp('data-role="' + role + '"[^>]* d="([^"]+)"').exec(svg);
  if (!found) return null;
  const numbers = found[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
  return { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] };
}

function bodyAt(svg, id) {
  const found = new RegExp('<circle data-id="' + id + '"[^>]* cx="([-\\d.]+)" cy="([-\\d.]+)"').exec(svg);
  return found ? { x: Number(found[1]), y: Number(found[2]) } : null;
}

// ---- Critical ----

test('C1: both viewers offer a way to open a system file', function () {
  ['site/viewer/index.html', 'site/viewer3d/index.html'].forEach(function (page) {
    assert.match(read(page), /type="file"/, page + ' has no file input');
  });
});

test('C1: the builder offers a way to view the system being edited', function () {
  assert.match(read('site/manual/index.html'), /View this system/);
});

test('C2: open then save with no edits gives back the same file', async function () {
  const t = await tools();
  const source = readJson('site/data/tau-ceti.system.json');
  assert.deepEqual(builderSave(t.link, builderOpen(t.link, source)), source);
});

test('C2: the builder writes version 2', async function () {
  const t = await tools();
  const saved = builderSave(t.link, builderOpen(t.link, readJson('site/data/tau-ceti.system.json')));
  assert.equal(saved.orbit_match, 2);
});

test('C2: saved data still has every distance after it is reloaded', async function () {
  const t = await tools();
  const saved = builderSave(t.link, builderOpen(t.link, readJson('site/data/tau-ceti.system.json')));
  const loaded = t.schema.loadSystem(saved);
  assert.deepEqual(loaded.skipped, []);
  assert.equal(byId(loaded, 'tc5').orbit.e, 0.0396);
  assert.equal(byId(loaded, 'tc5a').orbit.a_km, 151060);
  assert.equal(byId(loaded, 'haven').orbit.a_km, 54076);
  assert.equal(byId(loaded, 'b1').orbit.a_inner_au, 1.1);
  assert.equal(byId(loaded, 'b1').orbit.a_outer_au, 1.6);
});

test('C2: top-level, star, and epoch data the form has no field for survive a save', async function () {
  const t = await tools();
  const source = readJson('site/data/tau-ceti.system.json');
  const saved = builderSave(t.link, builderOpen(t.link, source));
  ['lore', 'rings_belts', 'sky'].forEach(function (key) {
    assert.deepEqual(saved[key], source[key], key);
  });
  assert.deepEqual(saved.star, source.star);
});

test('C2: one edit changes that field and nothing else', async function () {
  const t = await tools();
  const source = readJson('site/data/tau-ceti.system.json');
  const form = builderOpen(t.link, source);
  byId(form, 'tc5').name = 'Renamed';
  const expected = readJson('site/data/tau-ceti.system.json');
  byId(expected, 'tc5').name = 'Renamed';
  assert.deepEqual(builderSave(t.link, form), expected);
});

test('C2: migrating version 1 keeps an orbit the body already carried', async function () {
  const t = await tools();
  const loaded = t.schema.loadSystem({
    orbit_match: 1,
    star: { mass_solar: 1 },
    bodies: [{ id: 'm', kind: 'moon', parent: 'p', orbit: { a_km: 151060, e: 0.2 } }, { id: 'p', au: '1', orbit: { a_au: 1, e: 0.04 } }]
  });
  assert.equal(byId(loaded, 'm').orbit.a_km, 151060);
  assert.equal(byId(loaded, 'm').orbit.e, 0.2);
  assert.equal(byId(loaded, 'p').orbit.e, 0.04);
});

test('C3: the viewers have a control for choosing a trip', function () {
  ['site/viewer/index.html', 'site/viewer3d/index.html'].forEach(function (page) {
    assert.match(read(page), /<select[^>]*id="[^"]*(trip|transfer|route)[^"]*"/i, page);
  });
});

test('C3: a drawn Hohmann arc ends where the destination will be on arrival', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const start = svgAt(t, system, tauView(t, { epoch_days: 0 }));
  const end = pathEnd(start, 'hohmann');
  assert.ok(end, 'no arc drawn');
  const days = Number(/data-role="hohmann" data-days="(\d+)"/.exec(start)[1]);
  const target = bodyAt(svgAt(t, system, tauView(t, { epoch_days: days })), 'tc6');
  const miss = Math.hypot(end.x - target.x, end.y - target.y);
  assert.ok(miss < 30, 'arc ends ' + miss.toFixed(0) + ' px from the destination');
});

test('C3: a moon can be the start of a trip', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const svg = svgAt(t, system, tauView(t, { transfer: { from: 'tc5a', to: 'tc6' } }));
  assert.match(svg, /data-role="hohmann"/);
});

test('C4: a body name cannot reach innerHTML unescaped', function () {
  assert.doesNotMatch(read('site/manual/manual.js'), /aria-label="Drag ' \+ \(body\.name/);
});

// ---- High ----

test('H4: three.js is vendored, not loaded from a CDN', function () {
  assert.doesNotMatch(read('site/viewer3d/index.html'), /unpkg\.com/);
});

test('H5: the SVG legend does not say the locked angles are not a date', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  assert.doesNotMatch(svgAt(t, system, tauView(t)), /Angles are for reading, not a date/);
});

test('H6: an inward Hohmann arc starts at the origin body', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const svg = svgAt(t, system, tauView(t, { transfer: { from: 'tc6', to: 'tc5' } }));
  const start = pathStart(svg, 'hohmann');
  const origin = bodyAt(svg, 'tc6');
  assert.ok(start && origin);
  const gap = Math.hypot(start.x - origin.x, start.y - origin.y);
  assert.ok(gap < 10, 'arc starts ' + gap.toFixed(0) + ' px from Croquet Ball');
});

test('H7: an eccentricity of 1 or more is stopped or reported, never NaN', async function () {
  const t = await tools();
  let system;
  try {
    system = t.schema.loadSystem({ orbit_match: 2, star: { mass_solar: 1 }, bodies: [{ id: 'a', kind: 'planet', orbit: { a_au: 1, e: 1.5, period_days: 365, position_angle_deg: 10, perihelion_longitude_deg: 0 } }] });
  } catch (err) {
    return;
  }
  const svg = svgAt(t, system, t.schema.loadView({ orbit_match_view: 1 }));
  assert.doesNotMatch(svg, /NaN/);
});

test('H7: validateSystem reports duplicate ids and a missing parent', async function () {
  const t = await tools();
  assert.equal(typeof t.schema.validateSystem, 'function', 'schema.js has no validateSystem');
  const issues = t.schema.validateSystem({ orbit_match: 2, bodies: [{ id: 'a' }, { id: 'a' }, { id: 'b', parent: 'gone' }, { id: 'c', parent: 'c' }] });
  const text = JSON.stringify(issues);
  assert.match(text, /duplicate/i);
  assert.match(text, /parent/i);
});

test('H7: a negative angle is normalized, not fatal', async function () {
  const t = await tools();
  const system = t.schema.loadSystem({ orbit_match: 2, bodies: [{ id: 'a', orbit: { a_au: 1, position_angle_deg: -30 } }] });
  assert.equal(system.bodies[0].orbit.position_angle_deg, 330);
});

test('H8: text and colors from a file cannot leave their SVG attribute', async function () {
  const t = await tools();
  const evil = 'x" onmouseover="alert(1)';
  const system = t.schema.loadSystem({
    orbit_match: 2,
    star: { hostname: evil, name: evil, spectype: evil, mass_solar: 1 },
    bodies: [
      { id: evil, name: evil, kind: 'planet', display: { color: evil }, orbit: { a_au: 1 } },
      { id: 'belt', name: evil, kind: 'belt', display: { color: evil }, orbit: { a_inner_au: 2, a_outer_au: 3 } }
    ]
  });
  const svg = svgAt(t, system, t.schema.loadView({ orbit_match_view: 1, callouts: ['star', 'body:' + evil] }));
  assert.doesNotMatch(svg, /\sonmouseover="/);
});

test('H10: the builder offers kind structure', function () {
  assert.match(read('site/manual/manual.js'), /\["planet",[^\]]*"structure"/);
});

test('H10: a moon opened from a lore file shows its distance and period', async function () {
  const t = await tools();
  const form = builderOpen(t.link, readJson('site/data/tau-ceti.system.json'));
  const moon = byId(form, 'tc5a');
  assert.equal(moon.distanceKm, '151060');
  assert.equal(moon.period, '6.607');
});

test('H10: builder cards have fields for eccentricity and belt edges', function () {
  const manual = read('site/manual/manual.js');
  assert.match(manual, /Eccentricity/);
  assert.match(manual, /Inner edge|Inner \(AU\)|a_inner_au/);
});

test('H11: a CSV with # comment lines loads its rows', function () {
  const orbit = require('../site/manual/orbit.js');
  const rows = orbit.parseCsv('# NASA Exoplanet Archive\n# downloaded today\nhostname,sy_pnum\n55 Cnc,5\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hostname, '55 Cnc');
});

test('H11: a CSV with a byte-order mark loads its rows', function () {
  const orbit = require('../site/manual/orbit.js');
  assert.equal(orbit.parseCsv('\uFEFFhostname,sy_pnum\n55 Cnc,5\n').length, 1);
});

test('H11: NASA planet columns are read', function () {
  const code = read('site/manual/manual.js') + read('site/manual/orbit.js');
  ['pl_orbsmax', 'pl_orbper', 'pl_orbeccen'].forEach(function (column) {
    assert.match(code, new RegExp(column));
  });
});

test('H12: a system with no star name is not called Tau Ceti', async function () {
  const t = await tools();
  const system = t.schema.loadSystem({ orbit_match: 2, star: { mass_solar: 1 }, bodies: [{ id: 'a', kind: 'planet', orbit: { a_au: 1 } }] });
  const scene = t.model.buildScene(system, t.schema.loadView({ orbit_match_view: 1 }), {});
  assert.doesNotMatch(JSON.stringify(scene), /Tau Ceti/);
});

test('H12: another star does not get the Tau Ceti model', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const file = models.modelFileForBody('star', { star: { hostname: 'Other' }, bodies: [] });
  assert.doesNotMatch(String(file), /tau-ceti/);
});

test('H12: an M dwarf does not draw the same color as a G star', async function () {
  const t = await tools();
  assert.notEqual(t.model.starDisplayColor('M5V'), t.model.starDisplayColor('G8V'));
});

test('H12: viewer pages do not load the Tau Ceti view for every system', function () {
  assert.doesNotMatch(read('site/viewer/viewer.js'), /fetchJson\('\.\.\/data\/tau-ceti\.view\.json'\)/);
  assert.doesNotMatch(read('site/viewer3d/viewer3d.js'), /fetchJson\('\.\.\/data\/tau-ceti\.view\.json'\)/);
});

test('H12: 3D cards link to the system on screen', function () {
  assert.doesNotMatch(read('site/viewer3d/viewer3d.js'), /systemId: VIEWER_SYSTEM_ID/);
});

test('H13: a typo in a number stops the save instead of erasing the value', async function () {
  const t = await tools();
  const form = builderOpen(t.link, readJson('site/data/tau-ceti.system.json'));
  form.header.mass = '0.7x';
  assert.throws(function () { builderSave(t.link, form); }, /mass|number/i);
});

// ---- Medium ----

test('M1: an impossible burn says it failed', async function () {
  const t = await tools();
  const circle = function (radius, phase, period) {
    return function (days) {
      const angle = phase + 2 * Math.PI * days / period;
      return [radius * Math.cos(angle), radius * Math.sin(angle), 0];
    };
  };
  const result = t.kepler.fusionMatched(circle(0.71, 0, 247), circle(2, 2, 1100), 0, 0.01 * 9.80665, 10, t.kepler.AU_M);
  assert.ok(result == null || result.ok === false, 'returned a trip on a 10 m/s budget: ' + JSON.stringify(result).slice(0, 120));
});

test('M2: the fusion path follows the clock', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const pick = function (days) {
    const found = /data-role="fusion-coast" d="([^"]+)"/.exec(svgAt(t, system, tauView(t, { epoch_days: days })));
    return found && found[1];
  };
  assert.notEqual(pick(0), pick(500));
});

test('M3: a moon with no period gets one from its distance and parent mass', async function () {
  const t = await tools();
  const system = t.schema.loadSystem({
    orbit_match: 2,
    star: { mass_solar: 1 },
    bodies: [
      { id: 'p', kind: 'planet', physical: { mass_earth: 1 }, orbit: { a_au: 1 } },
      { id: 'm', kind: 'moon', parent: 'p', orbit: { a_km: 384400 } }
    ]
  });
  const days = byId(system, 'm').orbit.period_days;
  assert.ok(days > 26 && days < 29, String(days));
});

test('M4: a blank catalog value stays blank, and calculated_x is used', async function () {
  const t = await tools();
  const system = t.source.systemFromCatalog({ hostname: 'X', st_mass: null, dist_pc: '', calculated_x: 10 });
  assert.notEqual(system.star.mass_solar, 0);
  assert.notEqual(system.star.dist_pc, 0);
  assert.ok(Math.abs(system.star.x_ly - 10) < 0.001, String(system.star.x_ly));
});

test('M5: an eccentric orbit does not draw the same ring as a circle', async function () {
  const t = await tools();
  const ring = function (e) {
    const system = t.schema.loadSystem({ orbit_match: 2, star: { mass_solar: 1 }, bodies: [{ id: 'a', kind: 'planet', orbit: { a_au: 1, e: e, period_days: 365.25 } }] });
    const svg = svgAt(t, system, t.schema.loadView({ orbit_match_view: 1 }));
    return /data-role="orbit" data-id="a"[^>]*/.exec(svg)[0];
  };
  assert.notEqual(ring(0), ring(0.5));
});

test('M6: a body with no stored angle still turns with reference_direction', async function () {
  const t = await tools();
  const at = function (deg) {
    const system = t.schema.loadSystem({ orbit_match: 2, reference_direction: { label: 'x', deg: deg }, star: { mass_solar: 1 }, bodies: [{ id: 'a', kind: 'planet', angle_deg: 10, orbit: { a_au: 1, period_days: 365.25 } }] });
    return bodyAt(svgAt(t, system, t.schema.loadView({ orbit_match_view: 1 })), 'a');
  };
  assert.notDeepEqual(at(0), at(90));
});

test('M7: the jumpgate holds 60 degrees from its partner a century later', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const gap = function (days) {
    const scene = t.model.buildScene(system, tauView(t, { epoch_days: days }), {});
    const angle = function (id) {
      const body = scene.bodies.find(function (item) { return item.id === id; });
      return Math.atan2(body.position.z, body.position.x) * 180 / Math.PI;
    };
    return ((angle('tc6gate') - angle('tc6')) % 360 + 540) % 360 - 180;
  };
  const drift = Math.abs(Math.abs(gap(36525)) - Math.abs(gap(0)));
  assert.ok(drift < 1, 'drifted ' + drift.toFixed(1) + ' degrees');
});

test('M8: the builder keeps significant figures for a close planet', function () {
  assert.doesNotMatch(read('site/manual/manual.js'), /Math\.round\(au \* 1000\) \/ 1000/);
});

test('M9: SVG zoom and elevation are not left disabled', function () {
  assert.doesNotMatch(read('site/viewer/index.html'), /id="(zoom|elev)"[^>]*disabled/);
});

test('M13: documented ?jumpgate= peer URL has a reader', function () {
  const code = ['site/js/shell.js', 'site/js/site.js', 'site/manual/manual.js'].map(read).join('\n');
  assert.match(code, /get\(['"]jumpgate['"]\)/);
});

test('M14: the dev server survives a malformed URL', { timeout: 20000 }, async function () {
  const port = 8143;
  const server = spawn(process.execPath, [path.join(root, 'tools/serve-site.mjs'), String(port)], { stdio: 'ignore' });
  let exited = false;
  server.on('exit', function () { exited = true; });
  try {
    await new Promise(function (done) { setTimeout(done, 800); });
    await new Promise(function (done) {
      http.get({ host: '127.0.0.1', port: port, path: '/%E0%A4%A' }, function (res) { res.resume(); res.on('end', done); }).on('error', done);
    });
    await new Promise(function (done) { setTimeout(done, 300); });
    assert.equal(exited, false, 'the server process exited');
  } finally {
    server.kill();
  }
});

test('M15: published data holds no personal paths', function () {
  ['site/data/tau-ceti.system.json', 'site/data/tau-ceti.stability.json'].forEach(function (file) {
    assert.doesNotMatch(read(file), /[A-Z]:\\\\(Dropbox|Users)|F:\\\\Dropbox/, file);
  });
});

test('M16: the launcher does not point at a fixed machine path', function () {
  assert.doesNotMatch(read('launch-tau-ceti.ps1'), /C:\\Users\\DougJ\\Documents\\GitHub\\orbit_match/);
});

test('M17: the armed guard denies every way of writing to main', { timeout: 60000 }, function (t) {
  const found = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0']);
  if (found.error) return t.skip('pwsh is not installed');
  const job = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'orbit-guard-'));
  const env = Object.assign({}, process.env, { ORBIT_JOB_DIR: job, ORBIT_REPO: root });
  const run = function (input) {
    const result = spawnSync('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/hooks/orbit-guard.ps1')], { input: input, env: env, encoding: 'utf8' });
    return (result.stdout || '').includes('"deny"');
  };
  const event = function (command) {
    return JSON.stringify({ toolName: 'bash', toolInput: { command: command }, cwd: root });
  };
  const allowed = ['git --no-pager push origin main', 'git update-ref refs/heads/main HEAD', 'Set-Content C:\\Windows\\x.txt hi', 'echo hi > C:\\outside.txt'].filter(function (command) {
    return !run(event(command));
  });
  if (!run('not json')) allowed.push('malformed event');
  fs.rmSync(job, { recursive: true, force: true });
  assert.deepEqual(allowed, []);
});

test('M18: the stylesheets cover keyboard focus and reduced motion', function () {
  const css = read('site/css/site.css') + read('site/viewer/viewer.css') + read('site/viewer3d/viewer3d.css') + read('site/manual/manual.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

// ---- Low, tests, CI, repository ----

test('L1: a blank oxygen field does not report a lethal atmosphere', function () {
  const orbit = require('../site/manual/orbit.js');
  const advice = orbit.airAdvice('1', '', '');
  assert.ok(advice == null || !/scarce/.test(advice.lines.join(' ')), JSON.stringify(advice));
});

test('L2: a system with a non-zero t0 opens at its own epoch', async function () {
  const state = await import('../site/js/viewer-state.js');
  const view = state.viewAtClock({}, { epoch: { t0_days: 100 } }, { orbit_match_viewer_state: 1, systems: {} }, 'other');
  assert.equal(view.epoch_days, 0);
});

test('R1: a workflow runs the tests', function () {
  const dir = path.join(root, '.github/workflows');
  const text = fs.readdirSync(dir).map(function (file) { return fs.readFileSync(path.join(dir, file), 'utf8'); }).join('\n');
  assert.match(text, /node --test/);
});

test('R2: .gitignore covers Python caches and node_modules', function () {
  const ignore = read('.gitignore');
  assert.match(ignore, /__pycache__/);
  assert.match(ignore, /node_modules/);
});

// ---- Second pass, 2026-11-05 ----

function tinySystem(bodies, star) {
  return { orbit_match: 2, kind: 'system', star: star || { name: 'S', mass_solar: 1 }, bodies: bodies };
}

function planet(id, a, extra) {
  return { id: id, name: id, kind: 'planet', orbit: Object.assign({ a_au: a }, extra || {}) };
}

function plainView(t, extra) {
  return Object.assign(t.schema.loadView({ orbit_match_view: 1, elevation_deg: 75 }), extra || {});
}

function planetFn(t, body) {
  return function (days) {
    const spot = t.kepler.positionFromAngles({
      a: body.orbit.a_au,
      e: body.orbit.e || 0,
      period_days: body.orbit.period_days,
      position_angle_deg: body.orbit.position_angle_deg,
      perihelion_longitude_deg: body.orbit.perihelion_longitude_deg || 0
    }, days);
    return [spot.x, spot.y];
  };
}

// The thrust a matched trip of this length needs, from the formula in kepler.js.
function thrustNeeded(t, dep, tgt, t0, seconds, acc, budget) {
  const S = t.kepler.AU_M;
  const speed = function (fn, day) {
    const h = 1e-4;
    const a = fn(day - h);
    const b = fn(day + h);
    return [0, 1].map(function (k) { return ((b[k] - a[k]) / (2 * h)) * S / 86400; });
  };
  const r0 = dep(t0).map(function (x) { return x * S; });
  const v0 = speed(dep, t0);
  const end = t0 + seconds / 86400;
  const rT = tgt(end).map(function (x) { return x * S; });
  const vT = speed(tgt, end);
  const tb = Math.min(seconds / 2, budget / (2 * acc));
  const dr = [0, 1].map(function (k) { return rT[k] - r0[k] - v0[k] * seconds; });
  const dv = [0, 1].map(function (k) { return vT[k] - v0[k]; });
  const a1 = [0, 1].map(function (k) { return (dr[k] / tb - dv[k] / 2) / (seconds - tb); });
  const a2 = [0, 1].map(function (k) { return dv[k] / tb - a1[k]; });
  return Math.max(Math.hypot(a1[0], a1[1]), Math.hypot(a2[0], a2[1]));
}

test('M20: a planet with only a period is drawn, or reported as skipped', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([planet('a', 1), { id: 'p', name: 'p', kind: 'planet', orbit: { period_days: 100 } }]));
  const drawn = t.model.buildScene(system, plainView(t), {}).bodies.some(function (body) { return body.id === 'p'; });
  const reported = system.skipped.some(function (row) { return row.id === 'p'; });
  assert.ok(drawn || reported, 'the planet vanished, and skipped is empty');
});

test('M21: a body at L5 trails its partner by 60 degrees', async function () {
  const angles = await import('../site/js/display-angles.js');
  const map = angles.displayAngleMap({ bodies: [
    planet('p', 1, { position_angle_deg: 100 }),
    { id: 'g', kind: 'structure', lagrange: { of: 'p', point: 'L5' }, orbit: { a_au: 1 } }
  ] });
  assert.equal(Math.round(map.get('g') * 180 / Math.PI), 40);
});

test('M22: fusionMatched returns the shortest trip the thrust allows', async function () {
  const t = await tools();
  const system = readJson('site/data/tau-ceti.system.json');
  const dep = planetFn(t, byId(system, 'tc7'));
  const tgt = planetFn(t, byId(system, 'tc1'));
  const acc = 0.01 * 9.80665;
  const budget = 150000;
  const shorter = 140.25;
  assert.ok(thrustNeeded(t, dep, tgt, 1000, shorter * 86400, acc, budget) <= acc, 'the shorter trip must be possible');
  const flown = t.kepler.fusionMatched(dep, tgt, 1000, acc, budget, t.kepler.AU_M);
  assert.ok(flown.days <= shorter + 1, 'reported ' + flown.days.toFixed(1) + ' days, but ' + shorter + ' days also works');
});

test('M23: the periapsis label sits at the periapsis of the orbit', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const svg = svgAt(t, system, tauView(t, { elevation_deg: 75, azimuth_deg: 0, callouts: [] }), 'tc5');
  const label = svg.split('\n').find(function (line) { return />120848 km</.test(line); });
  assert.ok(label, 'no periapsis label');
  const orbit = svg.split('\n').find(function (line) { return /data-id="tc5a"/.test(line) && line.includes('<path'); });
  const points = Array.from(orbit.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)).map(function (m) { return [Number(m[1]), Number(m[2])]; });
  let near = points[0];
  points.forEach(function (p) {
    if (Math.hypot(p[0] - 820, p[1] - 530) < Math.hypot(near[0] - 820, near[1] - 530)) near = p;
  });
  const x = Number(/ x="([\d.]+)"/.exec(label)[1]) - 8;
  const y = Number(/ y="([\d.]+)"/.exec(label)[1]) - 16;
  const gap = Math.hypot(x - near[0], y - near[1]);
  assert.ok(gap < 40, 'the label is ' + gap.toFixed(0) + ' px from the periapsis');
});

test('M24: a moon period with no unit means days, as the builder shows it', async function () {
  const t = await tools();
  const data = t.schema.migrateV1toV2({ orbit_match: 1, bodies: [{ id: 'p', au: '1', moons: [{ id: 'm', period: '6.6', distanceKm: '1000' }] }] });
  assert.equal(byId(data, 'm').orbit.period_days, 6.6);
});

test('M24: changing the unit of a moon with no stored unit converts the number', function () {
  const orbit = require('../site/manual/orbit.js');
  assert.notEqual(orbit.convertPeriod('6.6', undefined, 'years'), '6.6');
});

test('M25: rewording the epoch keeps its date', async function () {
  const t = await tools();
  const form = builderOpen(t.link, readJson('site/data/tau-ceti.system.json'));
  form.header.epoch = 'Start of the campaign';
  const saved = builderSave(t.link, form);
  assert.equal(saved.epoch && saved.epoch.game_datetime, '3629-01-01 00:00:01');
});

test('M26: a sky image must be a local path', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  assert.equal(sky.skyReference({ sky: { equirect: 'https://example.com/x.png' } }).url, null);
});

test('M26: a body model must be a local path', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  assert.equal(models.modelFileForBody('p', { bodies: [{ id: 'p', model: 'https://example.com/x.glb' }] }), null);
});

test('M27: orbital inclination lifts a planet out of the plane', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([planet('p', 1, { i_deg: 30, position_angle_deg: 90, period_days: 365 })]));
  const body = t.model.buildScene(system, plainView(t), {}).bodies[0];
  assert.notEqual(Math.round(body.position.y * 1000), 0);
});

test('M27: axial tilt tilts the rings', async function () {
  const t = await tools();
  const ring = await import('../site/viewer3d/ring-belt.js');
  const body = planet('p', 1, { position_angle_deg: 0 });
  body.physical = { radius_km: 60000, tilt_deg: 27 };
  body.ring_system = { bands: [{ name: 'main', r_in_km: { value: 80000 }, r_out_km: { value: 120000 } }] };
  const system = t.schema.loadSystem(tinySystem([body]));
  const rows = ring.planetRingsFromScene(system, t.model.buildScene(system, plainView(t), {}));
  assert.notEqual(rows[0].inclination, 0);
});

test('M28: two bodies may share a layer key and keep their own defaults', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const layers = [{ key: 'clouds', node: 'A_clouds', default: true }, { key: 'clouds', node: 'B_clouds', default: false }];
  const state = models.defaultLayerState(layers);
  assert.equal(models.layerVisibleForNode('A_clouds', state, layers), true);
  assert.equal(models.layerVisibleForNode('B_clouds', state, layers), false);
});

test('M31: a belt with no edges does not print NaN in the legend', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([planet('a', 1), { id: 'b', name: 'b', kind: 'belt', orbit: { a_au: 2 } }]));
  assert.doesNotMatch(svgAt(t, system, plainView(t)), /NaN/);
});

test('M31: a negative distance does not produce a NaN period', async function () {
  const t = await tools();
  let system;
  try { system = t.schema.loadSystem(tinySystem([planet('a', -1)])); } catch (err) { return; }
  assert.equal(Number.isNaN(system.bodies[0].orbit.period_days), false);
});

test('M31: a negative star mass does not produce a NaN trip', async function () {
  const t = await tools();
  let system;
  try {
    system = t.schema.loadSystem(tinySystem([planet('a', 1), planet('b', 2)], { name: 'S', mass_solar: -1 }));
  } catch (err) { return; }
  const scene = t.model.buildScene(system, plainView(t, { transfer: { from: 'a', to: 'b' } }), {});
  assert.equal(Number.isNaN(scene.transfers[0].days), false);
});

test('M31: impossible file versions are rejected', async function () {
  const t = await tools();
  [0, -3, 1.5].forEach(function (version) {
    assert.throws(function () { t.schema.loadSystem({ orbit_match: version, bodies: [] }); }, undefined, 'version ' + version + ' was accepted');
  });
});

test('M31: one empty entry in bodies does not reject the whole file', async function () {
  const t = await tools();
  assert.doesNotThrow(function () { t.schema.loadSystem(tinySystem([null, planet('a', 1)])); });
});

test('M32: a belt listed in a handoff bodies array is kept', async function () {
  const t = await tools();
  const system = t.source.systemFromHandoff({ kind: 'system_handoff', hostname: 'x', bodies: [{ id: 'b', kind: 'belt', orbit: { a_inner_au: 1, a_outer_au: 2 } }] });
  assert.ok(byId(system, 'b'), 'the belt was dropped');
});

test('M32: a planet listed twice in a handoff appears once', async function () {
  const t = await tools();
  const row = { id: 'p', orbit: { a_au: 1 } };
  const system = t.source.systemFromHandoff({ kind: 'system_handoff', hostname: 'x', planets: [row], bodies: [row] });
  assert.equal(system.bodies.length, 1);
});

test('L3: the fallback starfield does not bunch at the poles', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  const width = 1024;
  const height = 512;
  const rgba = sky.starfieldRgba(width, height, sky.SKY_SEED);
  let polar = 0;
  let equator = 0;
  for (let y = 0; y < height; y++) {
    const lat = Math.abs(90 - 180 * (y + 0.5) / height);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i] + rgba[i + 1] + rgba[i + 2] <= 60) continue;
      if (lat >= 75) polar += 1;
      if (lat <= 15) equator += 1;
    }
  }
  const perArea = (polar / (1 - Math.sin(75 * Math.PI / 180))) / (equator / Math.sin(15 * Math.PI / 180));
  assert.ok(perArea < 2, 'stars per area are ' + perArea.toFixed(1) + ' times denser at the poles');
});

test('L4: only real ring nodes are hidden in a model', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  assert.equal(models.shouldHideGlbRingNode('SM_spring_tree', 'p'), false);
});

test('L5: a moon with no period is in the same place in both viewers', async function () {
  const t = await tools();
  const moon = { id: 'm', name: 'm', kind: 'moon', parent: 'p', orbit: { a_km: 1000, position_angle_deg: 0 } };
  const system = t.schema.loadSystem(tinySystem([planet('p', 1), moon]));
  const view = plainView(t, { epoch_days: 30.25 });
  const spot = t.model.buildScene(system, view, { frame: 'p' }).bodies.find(function (body) { return body.id === 'm'; }).position;
  const deg3d = Math.atan2(-spot.z, spot.x) * 180 / Math.PI;
  const drawn = bodyAt(svgAt(t, system, view, 'p'), 'm');
  const lift = Math.sin(75 * Math.PI / 180);
  const degSvg = Math.atan2((530 - drawn.y) / lift, drawn.x - 820) * 180 / Math.PI;
  assert.ok(Math.abs(deg3d - degSvg) < 1, '3D has ' + deg3d.toFixed(1) + ' degrees, SVG has ' + degSvg.toFixed(1));
});

test('L6: the legend fits the picture for a large system', async function () {
  const t = await tools();
  const bodies = [];
  for (let i = 0; i < 60; i++) bodies.push(planet('p' + i, 0.1 + i * 0.1));
  const svg = svgAt(t, t.schema.loadSystem(tinySystem(bodies)), plainView(t));
  const height = Number(/id="legend">\s*<rect[^>]*height="(\d+)"/.exec(svg)[1]);
  assert.ok(24 + height <= 1000, 'the legend is ' + height + ' px tall on a 1000 px picture');
});

test('L7: a null belt density uses the default, not zero', async function () {
  const ring = await import('../site/viewer3d/ring-belt.js');
  assert.ok(ring.createRingBelt({ innerRadius: 1, outerRadius: 2, density: null }).count > 0);
});

test('L8: a moon of a moon survives migration', async function () {
  const t = await tools();
  const data = t.schema.migrateV1toV2({ orbit_match: 1, bodies: [{ id: 'p', au: '1', moons: [{ id: 'm', distanceKm: '1000', moons: [{ id: 'mm', distanceKm: '10' }] }] }] });
  assert.ok(byId(data, 'mm'), 'the nested moon was dropped');
});

test('L10: a moon does not get a period from the mass of the star', async function () {
  const t = await tools();
  const moon = { id: 'm', name: 'm', kind: 'moon', parent: 'p', orbit: { a_au: 0.0026 } };
  const system = t.schema.loadSystem(tinySystem([planet('p', 1), moon]));
  assert.equal(byId(system, 'm').orbit.period_days, undefined);
});

test('L11: an unknown spectral type is not read as a K star', function () {
  const orbit = require('../site/manual/orbit.js');
  assert.equal(orbit.starColor('unknown', null), orbit.starColor('', null));
});

test('L12: every page has an icon', function () {
  ['site/index.html', 'site/viewer/index.html', 'site/viewer3d/index.html', 'site/manual/index.html', 'site/help/index.html'].forEach(function (page) {
    assert.match(read(page), /rel="icon"/, page);
  });
});

test('L13: the builder page links to the viewers', function () {
  const page = read('site/manual/index.html');
  assert.match(page, /href="\.\.\/viewer3d\//);
  assert.match(page, /href="\.\.\/viewer\//);
});

test('L14: a bad angle error names the body', async function () {
  const t = await tools();
  const body = { id: 'a', name: 'Kakakiko', position_angle_deg: 'abc' };
  assert.throws(function () { t.link.systemRecordFromManual({}, [body]); }, /Kakakiko/);
});

test('L15: a trip from a body to itself draws nothing', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const scene = t.model.buildScene(system, tauView(t, { transfer: { from: 'tc5', to: 'tc5' } }), {});
  assert.equal(scene.transfers.length, 0);
});

test('L16: the 3D view offers a way to change the distance mode', function () {
  assert.match(read('site/viewer3d/index.html'), /distance-mode|True AU|true distances/i);
});

// ---- Third pass, 2026-11-06: outstanding items that had no test ----

function leaderGap(t, system, days) {
  const svg = svgAt(t, system, tauView(t, { epoch_days: days, callouts: ['transfer:hohmann'] }));
  const leader = /data-role="leader" x1="[^"]+" y1="[^"]+" x2="([^"]+)" y2="([^"]+)"/.exec(svg);
  const arc = /data-role="hohmann"[^>]* d="([^"]+)"/.exec(svg)[1].match(/-?\d+\.\d/g).map(Number);
  let best = Infinity;
  for (let i = 0; i < arc.length; i += 2) {
    best = Math.min(best, Math.hypot(arc[i] - Number(leader[1]), arc[i + 1] - Number(leader[2])));
  }
  return best;
}

function fusionCardLine(t, system, days) {
  const svg = svgAt(t, system, tauView(t, { epoch_days: days, callouts: ['transfer:fusion'] }));
  return (/>([^<]*at this spacing)</.exec(svg) || [])[1];
}

function contrast(a, b) {
  const light = function (hex) {
    const parts = [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; }).map(function (v) {
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  };
  const x = light(a);
  const y = light(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Passes today. It guards the C2 fix: merging into the stored orbit must not undo an edit.
test('C2 guard: an edited distance and angle win over the stored orbit', async function () {
  const t = await tools();
  const form = builderOpen(t.link, readJson('site/data/tau-ceti.system.json'));
  byId(form, 'tc5').au = '0.8';
  byId(form, 'tc5').position_angle_deg = '50';
  const orbit = byId(t.schema.loadSystem(builderSave(t.link, form)), 'tc5').orbit;
  assert.equal(orbit.a_au, 0.8);
  assert.equal(orbit.position_angle_deg, 50);
});

test('C3: the fusion thrust and budget are not fixed in the renderer', function () {
  assert.doesNotMatch(read('site/js/render-svg.js'), /0\.01 \* G0, 150000/);
});

test('C4: esc() also escapes > and single quotes', function () {
  const found = /function esc\(value\) \{[\s\S]*?\n  \}/.exec(read('site/manual/manual.js'));
  if (!found) return;
  assert.match(found[0], /&gt;/);
  assert.match(found[0], /&#39;|&#x27;|&apos;/);
});

test('H4: the unused CDN address is gone', async function () {
  const t = await tools();
  assert.equal(t.model.THREE_MODULE_URL, undefined);
});

test('H5: the 3D legend changes with the clock', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const label = function (days) { return t.model.buildScene(system, tauView(t, { epoch_days: days }), {}).epochLabel; };
  assert.notEqual(label(10), label(0));
});

test('H5: both viewers offer go-to-date and return-to-epoch controls', function () {
  ['site/viewer/index.html', 'site/viewer3d/index.html'].forEach(function (page) {
    const html = read(page);
    assert.match(html, /id="[^"]*(go-?to|date)[^"]*"/i, page + ' has no date control');
    assert.match(html, /id="[^"]*(reset|epoch)[^"]*"/i, page + ' has no return to epoch');
  });
});

test('H9: the builder has a New system control', function () {
  assert.match(read('site/manual/index.html'), /New system/i);
});

test('H9: the builder has an undo', function () {
  assert.match(read('site/manual/index.html') + read('site/manual/manual.js'), /\bundo\b/i);
});

test('H10: surface gravity from a file shows in the Gravity field', async function () {
  const t = await tools();
  const form = builderOpen(t.link, readJson('site/data/tau-ceti.system.json'));
  assert.ok(byId(form, 'tc5').gravity, 'Kakakiko has a surface_g and a blank Gravity field');
});

test('H10: builder cards have mass and radius fields', function () {
  assert.match(read('site/manual/manual.js'), /data-field="(mass|mass_earth)"/);
  assert.match(read('site/manual/manual.js'), /data-field="(radius|radius_km)"/);
});

test('H12: a star with only a hostname keeps that name in 3D', async function () {
  const t = await tools();
  const system = t.schema.loadSystem({ orbit_match: 2, star: { hostname: 'Other' }, bodies: [] });
  assert.equal(t.model.buildScene(system, t.schema.loadView({ orbit_match_view: 1 }), {}).star.name, 'Other');
  assert.equal(t.model.infoLines(system, 'star')[0], 'Other');
});

test('H12: the 55 Cnc fixture opens with no Tau Ceti text or assets', async function () {
  const t = await tools();
  const models = await import('../site/viewer3d/body-models.js');
  const system = t.source.resolveSystem({ handoff: readJson('test/fixtures/55-cnc.handoff.json') });
  const view = t.schema.loadView({ orbit_match_view: 1 });
  const shown = JSON.stringify(t.model.buildScene(system, view, {})) + svgAt(t, system, view);
  assert.doesNotMatch(shown, /Tau Ceti|Kakakiko/);
  assert.doesNotMatch(String(models.modelFileForBody('star', system)), /tau-ceti/);
});

test('H12: a body id does not pick a Tau Ceti model in another system', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  assert.equal(models.modelFileForBody('tc5', { star: { hostname: 'Other' }, bodies: [{ id: 'tc5' }] }), null);
});

test('H12: Kakakiko layers are not the default for every system', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  assert.deepEqual(models.defaultLayerState(), {});
});

test('H12: starlight comes from the star on screen', function () {
  assert.doesNotMatch(read('site/viewer3d/viewer3d.js'), /blackbodySrgb\(TAU_CETI_LIGHT_K\)/);
});

test('H12: Mardat and Empire palettes are not in the renderer', function () {
  assert.doesNotMatch(read('site/viewer3d/scene-model.js'), /#17143e|#EEF1F5/i);
});

test('H12: the SVG viewer uses the theme the view names', function () {
  assert.doesNotMatch(read('site/viewer/viewer.js'), /clockedView\(\), bag\.empire/);
});

test('H12: a belt key does not name a Tau Ceti planet', function () {
  assert.doesNotMatch(read('site/viewer3d/scene-model.js'), /resonant_clumps_with_eight_ball_au/);
});

test('H12: a band name alone does not hide a band', async function () {
  const t = await tools();
  assert.equal(t.model.isDrawableBand({ name: 'phoebe_like', r_in_km: { value: 1 }, r_out_km: { value: 2 } }), true);
});

test('H12: a system with no epoch label is not given a Turquenish date', async function () {
  const t = await tools();
  const system = t.schema.loadSystem({ orbit_match: 2, epoch: {}, star: {}, bodies: [] });
  const label = t.model.buildScene(system, t.schema.loadView({ orbit_match_view: 1 }), {}).epochLabel;
  assert.doesNotMatch(label, /1600/);
});

test('H12: the Pencil note does not name a Tau Ceti file', async function () {
  const t = await tools();
  assert.doesNotMatch(t.model.pencilNote(), /Tau_Cet/);
});

test('H12: ring code does not name Tau Ceti ids', function () {
  assert.doesNotMatch(read('site/viewer3d/ring-belt.js'), /'tc[678]'/);
});

test('H12: viewer page titles do not name Tau Ceti', function () {
  ['site/viewer/index.html', 'site/viewer3d/index.html'].forEach(function (page) {
    assert.doesNotMatch(/<title>[^<]*<\/title>/.exec(read(page))[0], /Tau Ceti/, page);
  });
});

test('H13: a typo in a body number stops the save', async function () {
  const t = await tools();
  assert.throws(function () { t.link.systemRecordFromManual({}, [{ id: 'a', name: 'Kakakiko', au: '0.7x' }]); }, /Kakakiko|au|number/i);
  assert.throws(function () { t.link.systemRecordFromManual({}, [{ id: 'a', name: 'Kakakiko', period: '24x' }]); }, /Kakakiko|period|number/i);
});

test('M2: the fusion card follows the clock', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  assert.notEqual(fusionCardLine(t, system, 0), fusionCardLine(t, system, 300));
});

test('M6: in 3D a body with no stored angle turns with reference_direction', async function () {
  const t = await tools();
  const at = function (deg) {
    const system = t.schema.loadSystem({ orbit_match: 2, reference_direction: { label: 'x', deg: deg }, star: { mass_solar: 1 }, bodies: [{ id: 'a', kind: 'planet', angle_deg: 10, orbit: { a_au: 1, period_days: 365.25 } }] });
    return t.model.buildScene(system, t.schema.loadView({ orbit_match_view: 1 }), {}).bodies[0].position;
  };
  assert.notDeepEqual(at(0), at(90));
});

test('M10: planet labels do not overlap at the epoch', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const svg = svgAt(t, system, tauView(t, { epoch_days: 0 }));
  const labels = Array.from(svg.matchAll(/<text data-name="[^"]+"[^>]* x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)).map(function (m) {
    return { x: Number(m[1]), y: Number(m[2]), w: m[3].length * 7.2, name: m[3] };
  });
  const hits = [];
  labels.forEach(function (a, i) {
    labels.slice(i + 1).forEach(function (b) {
      if (a.x < b.x + b.w && b.x < a.x + a.w && Math.abs(a.y - b.y) < 14) hits.push(a.name + ' and ' + b.name);
    });
  });
  assert.deepEqual(hits, []);
});

test('M12: the handoff format in BRIEF.md is one the code reads', async function () {
  const t = await tools();
  if (!/"handoff": 1/.test(read('BRIEF.md'))) return;
  assert.equal(t.source.isHandoff({ handoff: 1, star: { hostname: 'x' } }), true);
});

test('M12: tag, imp, and exp link values are kept', function () {
  assert.match(read('site/manual/manual.js'), /get(All)?\("(tag|imp|exp)"\)/);
});

test('M13: the saved peer URL has a reader', function () {
  const code = ['site/js/shell.js', 'site/js/site.js', 'site/manual/manual.js'].map(read).join('\n');
  assert.match(code, /localStorage[^\n]*jumpgate|jumpgate[^\n]*localStorage/i);
});

test('M14: /viewer without a slash reaches the page', { timeout: 20000 }, async function () {
  const port = 8145;
  const server = spawn(process.execPath, [path.join(root, 'tools/serve-site.mjs'), String(port)], { stdio: 'ignore' });
  try {
    await new Promise(function (done) { setTimeout(done, 800); });
    const code = await new Promise(function (done, fail) {
      http.get({ host: '127.0.0.1', port: port, path: '/viewer' }, function (res) { res.resume(); done(res.statusCode); }).on('error', fail);
    });
    assert.notEqual(code, 404);
  } finally {
    server.kill();
  }
});

test('M17: the armed guard denies a shell move out of the repo', { timeout: 60000 }, function (t) {
  const found = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0']);
  if (found.error) return t.skip('pwsh is not installed');
  const job = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'orbit-guard-'));
  const env = Object.assign({}, process.env, { ORBIT_JOB_DIR: job, ORBIT_REPO: root });
  const input = JSON.stringify({ toolName: 'bash', toolInput: { command: 'Move-Item site\\config.json C:\\outside.json' }, cwd: root });
  const result = spawnSync('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/hooks/orbit-guard.ps1')], { input: input, env: env, encoding: 'utf8' });
  fs.rmSync(job, { recursive: true, force: true });
  assert.match(result.stdout || '', /"deny"/);
});

test('M18: SVG bodies can be reached by keyboard, or a body list stands in', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const page = read('site/viewer/index.html') + read('site/viewer/viewer.js');
  assert.ok(/tabindex="0"/.test(svgAt(t, system, tauView(t))) || /body-list|role="listbox"/.test(page));
});

test('M19: the license says what MIT does not cover', function () {
  const text = ['LICENSE', 'README.md'].map(read).join('\n') + (fs.existsSync(path.join(root, 'NOTICE')) ? read('NOTICE') : '');
  assert.match(text, /(models?|art|lore|setting|fiction)[^\n]*(not covered|separate|excluded|reserved|not MIT)/i);
});

test('M20: a moon with only a_au is drawn, or reported as skipped', async function () {
  const t = await tools();
  const moon = { id: 'm', name: 'm', kind: 'moon', parent: 'p', orbit: { a_au: 0.002 } };
  const system = t.schema.loadSystem(tinySystem([planet('p', 1), moon]));
  const drawn = t.model.buildScene(system, plainView(t), { frame: 'p' }).bodies.some(function (body) { return body.id === 'm'; });
  assert.ok(drawn || system.skipped.some(function (row) { return row.id === 'm'; }), 'the moon vanished, and skipped is empty');
});

test('M20: a planet with only a_km is drawn, or reported as skipped', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([{ id: 'x', name: 'x', kind: 'planet', orbit: { a_km: 150000000 } }]));
  const drawn = t.model.buildScene(system, plainView(t), {}).bodies.length > 0;
  assert.ok(drawn || system.skipped.some(function (row) { return row.id === 'x'; }), 'the planet vanished, and skipped is empty');
});

test('M33: a CSV row with only sy_name is kept', function () {
  const orbit = require('../site/manual/orbit.js');
  assert.equal(orbit.parseCsv('sy_name,sy_pnum\n55 Cnc,5\n').length, 1);
});

test('L9: a stored angle keeps the precision it was given', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([planet('a', 1, { position_angle_deg: 12.3456 })]));
  assert.equal(system.bodies[0].orbit.position_angle_deg, 12.3456);
});

test('L20: the SVG viewer honors legend_corner', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const at = /id="legend">\s*<rect x="(\d+)" y="(\d+)"/.exec(svgAt(t, system, tauView(t, { legend_corner: 'br' })));
  assert.ok(Number(at[1]) > 800 && Number(at[2]) > 100, 'the legend stayed at ' + at[1] + ', ' + at[2]);
});

test('L20: the SVG viewer honors distance_mode', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  assert.notEqual(svgAt(t, system, tauView(t, { distance_mode: 'linear' })), svgAt(t, system, tauView(t, { distance_mode: 'schematic' })));
});

test('L20: the grid layer does something', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const on = tauView(t);
  on.layers = Object.assign({}, on.layers, { grid: true });
  assert.notEqual(svgAt(t, system, on), svgAt(t, system, tauView(t)));
});

test('L21: every structure orbit in a close view gets its own ring', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([
    planet('p', 1),
    { id: 's1', name: 's1', kind: 'structure', parent: 'p', orbit: { a_km: 1000 } },
    { id: 's2', name: 's2', kind: 'structure', parent: 'p', orbit: { a_km: 5000 } }
  ]));
  const rings = Array.from(svgAt(t, system, plainView(t), 'p').matchAll(/data-role="orbit" data-id="([^"]+)"/g)).map(function (m) { return m[1]; });
  assert.deepEqual(rings.sort(), ['s1', 's2']);
});

test('L22: calloutBlock has no unused kind variable', function () {
  assert.doesNotMatch(read('site/js/render-svg.js'), /const kind = split\[0\];/);
});

test('L24: pointermove does not raycast on every event', function () {
  assert.doesNotMatch(read('site/viewer3d/viewer3d.js'), /addEventListener\('pointermove', function \(event\) \{\s*const hit = pick\(event\);/);
});

test('L28: a playing tab does not erase the clock of another system', async function () {
  const play = await import('../site/js/playback.js');
  const clock = await import('../site/js/viewer-state.js');
  const kept = new Map();
  const storage = {
    getItem: function (key) { return kept.has(key) ? kept.get(key) : null; },
    setItem: function (key, value) { kept.set(key, value); }
  };
  let frame = null;
  const tab = play.createPlaybackController({
    storage: storage,
    systemId: 'a',
    now: function () { return 0; },
    requestFrame: function (fn) { frame = fn; return 1; },
    cancelFrame: function () {}
  });
  tab.press('forward');
  clock.writeViewerState(clock.setElapsedDays(clock.readViewerState(storage), 'b', 42), storage);
  frame(1000);
  frame(1500);
  assert.equal(clock.elapsedDays(clock.readViewerState(storage), 'b'), 42);
});

test('L30: both viewers have the site footer', function () {
  ['site/viewer/index.html', 'site/viewer3d/index.html'].forEach(function (page) {
    assert.match(read(page), /<footer/, page);
  });
});

test('L31: the 3D page says how the mouse moves the view', function () {
  assert.match(read('site/viewer3d/index.html'), /drag/i);
});

test('L32: the Help page explains the viewers and transfers', function () {
  const help = read('site/help/index.html');
  assert.match(help, /viewer|3D/i);
  assert.match(help, /transfer/i);
});

test('L33: a trip with no star mass says the mass is assumed', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([planet('a', 1), planet('b', 2)], { name: 'S' }));
  const svg = svgAt(t, system, plainView(t, { transfer: { from: 'a', to: 'b' }, callouts: ['transfer:hohmann'] }));
  assert.match(svg, /assumed/i);
});

test('L34: an unnamed body still has a label and a card title', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(tinySystem([{ id: 'a', kind: 'planet', orbit: { a_au: 1 } }]));
  assert.ok(t.model.infoLines(system, 'a')[0], 'the first card line is empty');
  assert.doesNotMatch(svgAt(t, system, plainView(t)), /data-name="a"[^>]*><\/text>/);
});

test('L35: a transfer card kept open in a close view does not read unknown', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const close = t.model.buildScene(system, tauView(t), { frame: 'tc5' });
  assert.notDeepEqual(t.model.calloutLines(system, 'transfer:hohmann', close.transfers), ['unknown']);
});

test('L36: moonlets move with the clock', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const at = function (days) { return t.model.buildScene(system, tauView(t, { epoch_days: days }), { frame: 'tc7' }).moonlets[0].position; };
  assert.notDeepEqual(at(0), at(0.3));
});

test('L37: the burn is drawn at its true share of the path', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const svg = svgAt(t, system, tauView(t, { epoch_days: 0, callouts: ['transfer:fusion'] }));
  const days = Number(/>(\d+) d at this spacing</.exec(svg)[1]);
  const burnDays = 150000 / (2 * 0.01 * 9.80665) / 86400;
  const steps = /data-role="fusion-coast" d="([^"]+)"/.exec(svg)[1].match(/L/g).length;
  const drawn = /data-role="fusion-burn" d="([^"]+)"/.exec(svg)[1].match(/L/g).length;
  const expected = steps * burnDays / days;
  assert.ok(Math.abs(drawn - expected) < 1, 'drawn over ' + drawn + ' steps, the burn needs ' + expected.toFixed(1));
});

test('L39: the 3D page recovers from a lost WebGL context', function () {
  assert.match(read('site/viewer3d/viewer3d.js'), /webglcontextlost/);
});

test('L44: oxygen over 100% is not given normal advice', function () {
  const orbit = require('../site/manual/orbit.js');
  const advice = orbit.airAdvice('1', '150', '');
  assert.ok(advice == null || /100|not possible|more than/i.test(advice.lines.join(' ')), JSON.stringify(advice));
});

test('L44: oxygen and carbon dioxide over 100% together are caught', function () {
  const orbit = require('../site/manual/orbit.js');
  const advice = orbit.airAdvice('1', '60', '60');
  assert.ok(advice == null || /100|not possible|more than/i.test(advice.lines.join(' ')), JSON.stringify(advice));
});

test('L47: theme accents can be seen against their panels', async function () {
  const t = await tools();
  ['empire', 'mardat'].forEach(function (name) {
    const chrome = t.model.themeChrome(name);
    const ratio = contrast(chrome.accent, chrome.panel);
    assert.ok(ratio >= 3, name + ' accent contrast is ' + ratio.toFixed(2) + ':1');
  });
});

test('L48: the Hohmann card leader stays on the arc as the clock moves', async function () {
  const t = await tools();
  const system = t.schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const gap = leaderGap(t, system, 120);
  assert.ok(gap < 5, 'the leader ends ' + gap.toFixed(0) + ' px from the arc');
});

test('R3: deploy waits for the tests, and review is tested', function () {
  const dir = path.join(root, '.github/workflows');
  const all = fs.readdirSync(dir).map(function (file) { return fs.readFileSync(path.join(dir, file), 'utf8'); }).join('\n');
  assert.match(read('.github/workflows/pages.yml'), /needs:/);
  assert.match(all, /branches:\s*\[[^\]]*review/);
});

test('R4: no Python cache files are tracked', function () {
  const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 1e8 }).stdout.split('\n');
  const caches = tracked.filter(function (file) { return /__pycache__|\.pyc$/.test(file); });
  assert.equal(caches.length, 0, caches.length + ' tracked, for example ' + caches[0]);
});

test('R5: the 3D check scripts are not pinned to one job folder', function () {
  ['tests/viewer3d/edge-check.ps1', 'tests/viewer3d/shoot-viewer3d.ps1'].forEach(function (file) {
    assert.doesNotMatch(read(file), /Dropbox/, file);
  });
});

test('R6: workflow actions are pinned to commits', function () {
  const uses = read('.github/workflows/pages.yml').match(/uses: \S+/g);
  const loose = uses.filter(function (line) { return !/@[0-9a-f]{40}$/.test(line); });
  assert.deepEqual(loose, []);
});

test('D1: the phase status matches what shipped', function () {
  assert.doesNotMatch(read('docs/PHASE_STATUS_20261008.md'), /\| [34] [^|]*\| not started/);
});

test('D2: README promises only fidelities the code has', function () {
  if (!/\| Accurate \|/.test(read('README.md'))) return;
  const code = read('site/js/render-svg.js') + read('site/viewer/index.html') + read('site/viewer3d/index.html');
  assert.match(code, /Accurate/);
});

test('D3: BRIEF.md does not promise that pages open from disk', function () {
  if (!/type="module"/.test(read('site/viewer/index.html'))) return;
  assert.doesNotMatch(read('BRIEF.md'), /opens from disk/);
});
