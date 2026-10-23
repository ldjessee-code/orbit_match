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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('lore system wins, handoff fallback draws no counted planets, and extras are kept', async function () {
  const source = await import('../site/js/system-source.js');
  const lore = readJson('site/data/tau-ceti.system.json');
  const tauHandoff = readJson('test/fixtures/tau-ceti.handoff.json');
  const cnc = readJson('test/fixtures/55-cnc.handoff.json');

  assert.equal(source.PC_TO_LY, 3.26156);
  assert.equal(source.safeSystemFile('tau-ceti.system.json'), 'tau-ceti.system.json');
  assert.equal(source.safeSystemFile('55-cnc.system.json'), '55-cnc.system.json');
  assert.equal(source.safeSystemFile('../tau-ceti.system.json'), null);
  assert.equal(source.safeSystemFile('tau-ceti.handoff.json'), null);
  assert.equal(source.safeSystemFile(''), null);

  const handoff = clone(tauHandoff);
  handoff.st_mass = 0.9;
  handoff.calculated_luminosity = 0.55;
  handoff.planets = [{ id: 'invented', name: 'Nope', kind: 'planet', orbit: { a_au: 1 } }];
  const preferred = source.resolveSystem({ lore: lore, handoff: handoff });
  assert.equal(preferred.source, 'lore');
  assert.equal(preferred.star.mass_solar, 0.78);
  assert.equal(preferred.star.setting_name, 'Turquenish');
  assert.equal(preferred.bodies.some(function (body) { return body.id === 'invented'; }), false);
  assert.equal(preferred.bodies.some(function (body) { return body.id === 'tc1'; }), true);
  const cue = preferred.bodies.find(function (body) { return body.id === 'tc7'; });
  assert.equal(cue.rings, true);
  assert.equal(cue.ring_system.draw_source, 'data-belt');
  assert.ok(cue.ring_system.bands.length > 1);

  const bareLore = clone(lore);
  bareLore.star.setting_name = null;
  bareLore.tier = null;
  const filled = source.resolveSystem({ lore: bareLore, handoff: tauHandoff });
  assert.equal(filled.star.setting_name, 'Turquenish');
  assert.equal(filled.star.mass_solar, 0.78);
  assert.equal(filled.tier, 'gate_candidate');

  const tauOnly = source.resolveSystem({ handoff: tauHandoff });
  assert.equal(tauOnly.source, 'handoff');
  assert.equal(tauOnly.exoplanet_count, 3);
  assert.equal(tauOnly.bodies.filter(function (body) { return body.kind !== 'belt'; }).length, 0);
  assert.deepEqual(tauOnly.bodies.map(function (body) { return body.id; }), ['b1', 'b2']);
  assert.equal(tauOnly.star.lum_solar, undefined);
  assert.equal(tauOnly.star.hz_inner_au, undefined);
  assert.equal(tauOnly.star.spectype, 'G8V');
  assert.equal(tauOnly.star.render_mag, tauHandoff.mag);
  assert.ok(Math.abs(tauOnly.star.x_ly - tauHandoff.x * source.PC_TO_LY) < 1e-9);

  const cncOnly = source.resolveSystem({ handoff: cnc });
  assert.equal(cncOnly.star.hostname, '55 Cnc');
  assert.equal(cncOnly.star.name, '55 Cnc');
  assert.equal(cncOnly.exoplanet_count, 5);
  assert.equal(cncOnly.bodies.length, 0);
  assert.equal(cncOnly.star.mass_solar, undefined);
  assert.ok(Math.abs(cncOnly.star.x_ly - (-7.576799 * source.PC_TO_LY)) < 1e-9);
  assert.ok(Math.abs(cncOnly.star.y_ly - (8.083511 * source.PC_TO_LY)) < 1e-9);
  assert.ok(Math.abs(cncOnly.star.z_ly - (5.973023 * source.PC_TO_LY)) < 1e-9);

  const extra = clone(cnc);
  delete extra.tier;
  extra.mass_known = false;
  extra.st_mass = 1.1;
  extra.calculated_luminosity = 0.6;
  extra.exoplanet_count = 5;
  const unknown = source.resolveSystem({ handoff: extra });
  assert.equal(unknown.tier, null);
  assert.notEqual(unknown.tier, 'gate_candidate');
  assert.equal(unknown.star.mass_known, false);
  assert.equal(unknown.star.mass_solar, undefined);
  assert.equal(unknown.unmapped.calculated_luminosity, 0.6);
  assert.equal(unknown.bodies.length, 0);

  const counted = source.systemFromCatalog({
    hostname: 'Bare',
    name: 'Bare',
    spect: 'G2V',
    mag: 4.2,
    x: 1,
    y: 2,
    z: 3,
    exoplanet_count: 7,
    sy_pnum: 7,
    has_known_exoplanets: true
  });
  assert.equal(counted.source, 'catalog');
  assert.equal(counted.exoplanet_count, 7);
  assert.equal(counted.bodies.length, 0);
  assert.equal(counted.star.hostname, 'Bare');
  assert.equal(counted.star.lum_solar, undefined);

  const explicit = source.systemFromCatalog({
    hostname: 'Bare',
    name: 'Bare',
    exoplanet_count: 7,
    planets: [{ id: 'p1', name: 'Only', kind: 'planet', orbit: { a_au: 1.2 } }],
    belts: [{ id: 'ring-a', name: 'Listed belt', a_inner_au: 2, a_outer_au: 3, display: { density: 3, dustiness: 15 } }]
  });
  assert.deepEqual(explicit.bodies.map(function (body) { return body.id; }), ['p1', 'ring-a']);
  assert.equal(explicit.bodies[0].kind, 'planet');
  assert.equal(explicit.bodies[1].kind, 'belt');
  assert.equal(explicit.bodies[1].display.density, 3);

  assert.throws(function () { source.resolveSystem({}); });
});

test('sky path and tilt come from system data and default to identity', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  const lore = readJson('site/data/tau-ceti.system.json');
  const ref = sky.skyReference(lore);
  assert.equal(ref.mode, 'equirect');
  assert.equal(ref.url, 'sky/tauceti_sky_equirect_4k.png');
  assert.equal(ref.mapping, 'EquirectangularReflectionMapping');
  assert.equal(ref.colorSpace, 'srgb');
  assert.equal(ref.poleRotationApplied, false);
  assert.deepEqual(ref.rotation, { x: 0, y: 0, z: 0 });
  assert.deepEqual(sky.skyBackgroundRotation(null), { x: 0, y: 0, z: 0 });
  assert.deepEqual(sky.skyBackgroundRotation({ rotation_deg: null }), { x: 0, y: 0, z: 0 });
  const tilt = sky.skyReference({ sky: { equirect: 'sky/tauceti_sky_equirect_4k.png', rotation_deg: 90 } });
  assert.ok(Math.abs(tilt.rotation.x - Math.PI / 2) < 1e-12);
  assert.equal(tilt.rotation.y, 0);
  const axes = sky.skyBackgroundRotation({ rotation_deg: { x: 0, y: 90, z: 0 } });
  assert.ok(Math.abs(axes.y - Math.PI / 2) < 1e-12);
  assert.deepEqual(sky.skyBackgroundRotation({ background_rotation: [0, 0, 1] }), { x: 0, y: 0, z: 1 });
  assert.equal(sky.skyReference({ star: { name: 'Plain' } }).mode, 'procedural');
  assert.equal(sky.skyReference({ star: { name: 'Plain' } }).url, null);
  assert.equal(sky.skyReference({ sky: { equirect: '../secret.png' } }).mode, 'procedural');

  const page = read('site/viewer3d/index.html');
  const client = read('site/viewer3d/viewer3d.js');
  assert.doesNotMatch(page, /TEMP skybox A\/B/);
  assert.doesNotMatch(client, /TEMP skybox A\/B/);
  assert.doesNotMatch(page, /id="sky-ab-temp"/);
  assert.doesNotMatch(page, /id="sky-ab-equirect-temp"/);
  assert.doesNotMatch(client, /sky-ab-temp/);
  assert.doesNotMatch(client, /skyToggleFromKey/);
  assert.doesNotMatch(client, /CubeTextureLoader/);
  assert.doesNotMatch(page, /id="distance-mode"/);
  assert.doesNotMatch(page, />Schematic</);
  assert.match(client, /skyReference/);
  assert.match(client, /backgroundRotation/);
  assert.match(client, /EquirectangularReflectionMapping/);
  assert.equal(fs.existsSync(path.join(root, 'site/viewer3d/sky-ab-temp.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'site/viewer3d/sky/cube')), true);
});

test('low-resource choice is URL, then storage, then heuristics', async function () {
  const gate = await import('../site/js/low-resource.js');
  assert.equal(gate.RESOURCE_STORAGE_KEY, 'orbit-match-viewer-mode');
  assert.equal(gate.chooseViewer({ search: '?view=svg', stored: '3d', signals: {} }).mode, 'svg');
  assert.equal(gate.chooseViewer({ search: '?view=svg', stored: '3d', signals: {} }).source, 'url');
  assert.equal(gate.chooseViewer({ search: 'low=0', stored: 'svg', signals: { webgl: false } }).mode, '3d');
  assert.equal(gate.chooseViewer({ search: '?view=2d' }).mode, 'svg');
  assert.equal(gate.chooseViewer({ search: '', stored: 'svg', signals: { webgl: true, deviceMemory: 8 } }).source, 'storage');
  assert.equal(gate.chooseViewer({ search: '', stored: 'svg' }).mode, 'svg');
  assert.equal(gate.chooseViewer({ signals: {} }).mode, '3d');
  assert.equal(gate.chooseViewer({ signals: {} }).source, 'auto');
  assert.equal(gate.detectLowResource({}), false);
  assert.equal(gate.detectLowResource({ webgl: false }), true);
  assert.equal(gate.detectLowResource({ saveData: true }), true);
  assert.equal(gate.detectLowResource({ deviceMemory: 2 }), true);
  assert.equal(gate.detectLowResource({ deviceMemory: 0 }), false);
  assert.equal(gate.detectLowResource({ deviceMemory: 2.1 }), false);
  assert.equal(gate.detectLowResource({ hardwareConcurrency: 2 }), true);
  assert.equal(gate.detectLowResource({ hardwareConcurrency: 0 }), false);
  assert.equal(gate.detectLowResource({ prefersReducedMotion: true }), true);
  assert.equal(gate.detectLowResource({ maxTextureSize: 2048 }), true);
  assert.equal(gate.detectLowResource({ maxTextureSize: 4096 }), false);
  assert.equal(gate.detectLowResource({ maxTextureSize: 0 }), false);

  let probed = false;
  const forced = gate.decideViewer({
    search: '?view=3d',
    stored: 'svg',
    signals: { saveData: true },
    probe: function () { probed = true; return { webgl: false }; }
  });
  assert.equal(forced.mode, '3d');
  assert.equal(forced.source, 'url');
  assert.equal(probed, false);

  probed = false;
  const early = gate.decideViewer({
    search: '',
    signals: { saveData: true },
    probe: function () { probed = true; return { webgl: true, maxTextureSize: 8192 }; }
  });
  assert.equal(early.mode, 'svg');
  assert.equal(probed, false);

  const probedChoice = gate.decideViewer({
    search: '',
    signals: { hardwareConcurrency: 8, deviceMemory: 8 },
    probe: function () { return { webgl: false, maxTextureSize: 8192 }; }
  });
  assert.equal(probedChoice.mode, 'svg');
  assert.equal(probedChoice.source, 'auto');

  const dest = gate.resourceDestination('3d', { mode: 'svg' }, 'system=tau-ceti.system.json&low=1');
  assert.equal(dest, '../viewer/?system=tau-ceti.system.json&view=svg');
  assert.equal(gate.resourceDestination('svg', { mode: 'svg' }, ''), null);
  assert.equal(gate.resourceDestination('svg', { mode: '3d' }, 'view=svg'), '../viewer3d/?view=3d');

  const memory = {};
  const store = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
    setItem: function (key, value) { memory[key] = value; }
  };
  assert.equal(gate.writeResourceStorage('svg', store), true);
  assert.equal(gate.readResourceStorage(store), 'svg');
  assert.equal(memory[gate.RESOURCE_STORAGE_KEY], 'svg');
  assert.equal(gate.writeResourceStorage('nope', store), false);

  const page3d = read('site/viewer3d/index.html');
  const pageSvg = read('site/viewer/index.html');
  const client3d = read('site/viewer3d/viewer3d.js');
  const clientSvg = read('site/viewer/viewer.js');
  assert.match(page3d, /id="resource-toggle"/);
  assert.match(pageSvg, /id="resource-toggle"/);
  assert.match(client3d, /writeResourceStorage\('svg'\)/);
  assert.match(clientSvg, /writeResourceStorage\('3d'\)/);
  assert.match(client3d, /decideViewer/);
  assert.match(clientSvg, /decideViewer/);
  assert.match(clientSvg, /probed\.webgl === false/);
  assert.match(read('site/index.html'), /viewer\/\?view=svg/);
  assert.match(page3d, /href="\.\.\/viewer\/\?view=svg"/);
});

test('lore settings are built from data, collapsed, and belts stay data-driven', async function () {
  const lore = await import('../site/viewer3d/lore-settings.js');
  const sky = await import('../site/viewer3d/sky.js');
  const rings = await import('../site/viewer3d/ring-belt.js');
  const system = readJson('site/data/tau-ceti.system.json');
  const plan = lore.loreSettingsFromSystem(system);
  assert.equal(plan.title, 'Lore based settings');
  assert.equal(plan.collapsed, true);
  assert.deepEqual(plan.belts.map(function (belt) { return belt.id; }), ['b1', 'b2']);
  assert.equal(plan.belts[0].density, 2);
  assert.equal(plan.belts[0].dustiness, 40);
  assert.equal(plan.layers.some(function (layer) { return layer.bodyId === 'tc5' && layer.key === 'clouds'; }), true);
  assert.equal(plan.layers.find(function (layer) { return layer.key === 'seaice-south'; }).defaultVisible, false);

  const custom = lore.loreSettingsFromSystem({
    bodies: [
      { id: 'z9', name: 'Zed Belt', kind: 'belt', display: { density: 3, dustiness: 11 } },
      { id: 'p9', name: 'Pebble', kind: 'planet', layers: [{ key: 'haze', label: 'Haze', node: 'SM_haze', default: false }] }
    ]
  });
  assert.equal(custom.belts.length, 1);
  assert.equal(custom.belts[0].id, 'z9');
  assert.equal(custom.belts[0].density, 3);
  assert.equal(custom.layers[0].defaultVisible, false);
  const markup = lore.loreSettingsMarkup(custom);
  assert.match(markup, /id="belt-z9-density"/);
  assert.match(markup, /id="layer-p9-haze"/);
  assert.doesNotMatch(read('site/viewer3d/lore-settings.js'), /Sombrero|Kakakiko/);

  const page = read('site/viewer3d/index.html');
  assert.match(page, /<details id="lore-settings"/);
  assert.doesNotMatch(page, /<details id="lore-settings"[^>]*\sopen/);
  assert.match(page, /Lore based settings/);

  const bands = sky.dustBands([
    { id: 'b1', innerR: 2, outerR: 3, features: [{ type: 'gap' }] },
    { id: 'b2', innerR: 4, outerR: 5 },
    { id: 'z9', name: 'Zed Belt', innerR: 6, outerR: 8, density: 4, dustiness: 80, features: [{ type: 'clump', radius: 7 }] }
  ]);
  assert.equal(bands.length, 3);
  assert.equal(bands[2].density, 4);
  assert.equal(bands[2].dustiness, 80);
  assert.equal(bands[2].features[0].type, 'clump');
  const drawn = rings.ringBeltsFromBands(bands, { z9: { density: 1 } });
  assert.equal(drawn[2].density, 1);
  assert.equal(drawn[2].dustiness, 80);
  assert.equal(drawn[2].features.length, 1);
});

test('controls give the stage 78vh, schematic button is gone, and GLB paths live in the system file', async function () {
  const css = read('site/viewer3d/viewer3d.css');
  const page = read('site/viewer3d/index.html');
  assert.match(css, /min-height:\s*78vh/);
  assert.doesNotMatch(css, /70vh/);
  assert.match(css, /header\.site-head\s*\{[^}]*padding:\s*0\.35rem 0\.75rem/);
  assert.match(css, /flex:\s*1 1 auto/);
  assert.match(page, /class="dock-row"/);
  assert.doesNotMatch(page, /id="distance-mode"/);

  const models = await import('../site/viewer3d/body-models.js');
  const system = readJson('site/data/tau-ceti.system.json');
  Object.keys(models.BODY_MODEL_FILE).forEach(function (id) {
    const expected = 'models/' + models.BODY_MODEL_FILE[id];
    if (id === 'star') assert.equal(system.star.model, expected);
    else {
      const body = system.bodies.find(function (item) { return item.id === id; });
      assert.equal(body.model, expected, id);
    }
    assert.equal(models.modelFileForBody(id, system), expected);
  });
  ['haven', 'yard', 'watch', 'tc6gate', 'b1', 'b2'].forEach(function (id) {
    const body = system.bodies.find(function (item) { return item.id === id; });
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'model'), false, id);
    assert.equal(models.modelFileForBody(id, system), null);
  });
  const broken = clone(system);
  broken.star.model = '../tau-ceti.glb';
  assert.equal(models.modelFileForBody('star', broken), null);

  const crosswalk = read('site/data/CROSSWALK.md');
  assert.match(crosswalk, /3\.26156/);
  assert.match(crosswalk, /spectype/);
  assert.match(crosswalk, /render_mag/);
  assert.match(crosswalk, /rotation_deg/);
});
