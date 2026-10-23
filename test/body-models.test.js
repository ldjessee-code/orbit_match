const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const modelDir = path.join(root, 'site', 'viewer3d', 'models');

const EXPECTED_FILES = {
  star: 'tau-ceti.glb',
  tc1: 'gane.glb',
  tc2: 'hornstooth.glb',
  tc3: 'husk.glb',
  tc4: 'sable.glb',
  tc5: 'kakakiko.glb',
  tc5a: 'shudder.glb',
  tc5b: 'der-eindringling.glb',
  tc6: 'croquet-ball.glb',
  tc7: 'cue-ball.glb',
  tc8: 'eight-ball.glb'
};

const SPHERE_ONLY = ['haven', 'yard', 'watch', 'tc6gate', 'b1', 'b2'];

const KAKAKIKO_NODES = [
  'SM_kakakiko_clouds',
  'SM_kakakiko_seaice_north_winter',
  'SM_kakakiko_seaice_south_winter',
  'SM_kakakiko_atmosphere_PLACEHOLDER',
  'SM_kakakiko'
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function glbDocument(fileName) {
  const buf = fs.readFileSync(path.join(modelDir, fileName));
  assert.equal(buf.toString('utf8', 0, 4), 'glTF', fileName);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  return { bytes: buf.length, json: json };
}

function nodeExtras(json) {
  const found = [];
  (json.nodes || []).forEach(function (node) {
    if (node.extras && typeof node.extras.radius_km === 'number') found.push(node);
  });
  return found;
}

test('shipped body glbs are unit-radius and name the Kakakiko layers', function () {
  const listed = Object.keys(EXPECTED_FILES).map(function (id) { return EXPECTED_FILES[id]; }).sort();
  const onDisk = fs.readdirSync(modelDir).filter(function (name) { return name.endsWith('.glb'); }).sort();
  assert.deepEqual(onDisk, listed);
  onDisk.forEach(function (fileName) {
    const doc = glbDocument(fileName);
    const carriers = nodeExtras(doc.json);
    assert.ok(carriers.length >= 1, fileName + ' extras');
    carriers.forEach(function (node) {
      assert.equal(node.extras.mesh_radius_units, 1, fileName + ' ' + node.name);
      assert.ok(node.extras.radius_km > 0, fileName);
    });
  });
  const kakakiko = glbDocument('kakakiko.glb');
  const names = (kakakiko.json.nodes || []).map(function (node) { return node.name; });
  KAKAKIKO_NODES.forEach(function (name) {
    assert.ok(names.indexOf(name) >= 0, name);
  });
});

test('model manifest maps every system body and the star onto models/<id>.glb', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const schema = await import('../site/js/schema.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  assert.deepEqual(models.BODY_MODEL_FILE, EXPECTED_FILES);
  Object.keys(EXPECTED_FILES).forEach(function (id) {
    const rel = models.modelFileForBody(id);
    assert.equal(rel, 'models/' + EXPECTED_FILES[id], id);
    assert.equal(fs.existsSync(path.join(root, 'site', 'viewer3d', rel)), true, rel);
  });
  const ids = system.bodies.map(function (body) { return body.id; });
  ids.push('star');
  ids.forEach(function (id) {
    const rel = models.modelFileForBody(id);
    if (SPHERE_ONLY.indexOf(id) >= 0) {
      assert.equal(rel, null, id);
      return;
    }
    assert.equal(rel, 'models/' + EXPECTED_FILES[id], id);
  });
  assert.doesNotMatch(read('site/viewer3d/body-models.js'), /from\s+['"]three/);
});

test('model scale matches the display radius and a failed load keeps the sphere', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const schema = await import('../site/js/schema.js');
  const sceneModel = await import('../site/viewer3d/scene-model.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const scene = sceneModel.buildScene(system, view);
  const close = sceneModel.buildScene(system, view, { frame: 'tc5' });
  assert.equal(models.modelScale(scene.star.radius), scene.star.radius);
  assert.equal(models.modelScale(0), null);
  assert.equal(models.modelScale(NaN), null);
  scene.bodies.forEach(function (body) {
    if (!models.modelFileForBody(body.id)) return;
    assert.equal(models.modelScale(body.radius), body.radius, body.id);
    const plan = models.modelMountPlan({ ok: true }, body.id, body.radius);
    assert.equal(plan.fallback, false, body.id);
    assert.equal(plan.hideSphere, true, body.id);
    assert.equal(plan.scale, body.radius, body.id);
    assert.equal(plan.pickId, body.id, body.id);
  });
  const starPlan = models.modelMountPlan({ ok: true }, 'star', scene.star.radius);
  assert.equal(starPlan.scale, scene.star.radius);
  assert.equal(starPlan.pickId, 'star');
  assert.equal(starPlan.hideSphere, true);
  const rejected = models.modelMountPlan({ ok: false }, 'tc5', 0.31);
  assert.equal(rejected.fallback, true);
  assert.equal(rejected.hideSphere, false);
  assert.equal(rejected.scale, null);
  assert.equal(rejected.pickId, 'tc5');
  const missing = models.modelMountPlan(null, 'tc1', 0.2);
  assert.equal(missing.fallback, true);
  assert.equal(missing.hideSphere, false);
  assert.equal(missing.pickId, 'tc1');
  const structure = models.modelMountPlan({ ok: true }, 'tc6gate', 0.2);
  assert.equal(structure.fallback, true);
  assert.equal(structure.file, null);
  const focus = close.bodies.find(function (body) { return body.id === 'tc5'; });
  const moon = close.bodies.find(function (body) { return body.id === 'tc5a'; });
  assert.equal(models.modelMountPlan({ ok: true }, 'tc5', focus.radius).scale, focus.radius);
  assert.equal(models.modelMountPlan({ ok: true }, 'tc5a', moon.radius).scale, moon.radius);
  const der = close.bodies.find(function (body) { return body.id === 'tc5b'; });
  assert.equal(models.modelMountPlan({ ok: true }, 'tc5b', der.radius).scale, der.radius);
});

test('Kakakiko layer defaults hide south winter ice and toggles flip one layer', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const state = models.defaultLayerState();
  assert.equal(state.clouds, true);
  assert.equal(state['seaice-north'], true);
  assert.equal(state['seaice-south'], false);
  assert.equal(state.atmosphere, true);
  const nodes = [
    { name: 'SM_kakakiko_clouds', visible: true },
    { name: 'SM_kakakiko_seaice_north_winter', visible: true },
    { name: 'SM_kakakiko_seaice_south_winter', visible: true },
    { name: 'SM_kakakiko_atmosphere_PLACEHOLDER', visible: true },
    { name: 'SM_kakakiko', visible: true },
    { name: 'EMPTY_Haven_longitude', visible: true }
  ];
  const applied = models.applyLayerList(nodes, state);
  function visible(list, name) {
    return list.find(function (node) { return node.name === name; }).visible;
  }
  assert.equal(visible(applied, 'SM_kakakiko_clouds'), true);
  assert.equal(visible(applied, 'SM_kakakiko_seaice_north_winter'), true);
  assert.equal(visible(applied, 'SM_kakakiko_seaice_south_winter'), false);
  assert.equal(visible(applied, 'SM_kakakiko_atmosphere_PLACEHOLDER'), true);
  assert.equal(visible(applied, 'SM_kakakiko'), true);
  assert.equal(visible(applied, 'EMPTY_Haven_longitude'), true);
  const cloudsOff = models.setLayerVisible(state, 'clouds', false);
  assert.equal(cloudsOff.clouds, false);
  assert.equal(cloudsOff['seaice-north'], true);
  assert.equal(models.applyLayerList(nodes, cloudsOff).find(function (node) {
    return node.name === 'SM_kakakiko_clouds';
  }).visible, false);
  const southOn = models.setLayerVisible(state, 'seaice-south', true);
  assert.equal(models.layerVisibleForNode('SM_kakakiko_seaice_south_winter', southOn), true);
  assert.equal(models.layerVisibleForNode('SM_kakakiko', southOn), null);
  const page = read('site/viewer3d/index.html');
  const client = read('site/viewer3d/viewer3d.js');
  const lore = await import('../site/viewer3d/lore-settings.js');
  const system = readJson('site/data/tau-ceti.system.json');
  const plan = lore.loreSettingsFromSystem(system);
  const markup = lore.loreSettingsMarkup(plan);
  assert.match(page, /id="lore-settings"/);
  assert.match(page, /Lore based settings/);
  assert.doesNotMatch(page, /id="kakakiko-layers"/);
  assert.match(markup, /data-layer-key="clouds"[^>]*checked/);
  assert.match(markup, /data-layer-key="seaice-north"[^>]*checked/);
  assert.match(markup, /data-layer-key="atmosphere"[^>]*checked/);
  const south = markup.match(/<input id="layer-tc5-seaice-south"[^>]*>/);
  assert.ok(south, 'south ice toggle');
  assert.doesNotMatch(south[0], /checked/);
  assert.match(markup, /Clouds/);
  assert.match(markup, /N winter sea ice/);
  assert.match(markup, /S winter sea ice/);
  assert.match(markup, /Atmosphere glow/);
  assert.match(client, /data-layer-key/);
  assert.match(client, /three\/addons\/loaders\/GLTFLoader\.js/);
  assert.match(client, /GLTFLoader/);
  assert.match(client, /modelMountPlan/);
  assert.match(client, /scheduleBodyModels/);
  assert.match(client, /SphereGeometry/);
  assert.match(client, /RingGeometry/);
  const rebuild = client.match(/function rebuild\([\s\S]*?\n\}/);
  assert.ok(rebuild, 'rebuild');
  assert.match(rebuild[0], /SphereGeometry/);
  assert.match(rebuild[0], /scheduleBodyModels/);
  assert.match(client, /modelGeneration/);
  assert.match(client, /colorWrite = false/);
  assert.match(client, /needsUpdate = true/);
  assert.doesNotMatch(client, /import\s+[^;]*from\s+['"]three['"]/);
});
