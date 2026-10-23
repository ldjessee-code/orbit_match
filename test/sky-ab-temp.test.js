const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const MARKER = 'TEMP skybox A/B (Doug 10/20) - remove after sky integration';
const FACES = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('TEMP skybox module lists cube faces in three.js order with no mirror or flip', async function () {
  const ab = await import('../site/viewer3d/sky-ab-temp.js');
  assert.equal(ab.TEMP_SKYBOX_MARKER, MARKER);
  assert.equal(ab.CUBE_PATH, 'sky/cube/');
  assert.deepEqual(ab.CUBE_FACE_FILES, FACES);
  const plan = ab.cubeLoadPlan();
  assert.equal(plan.path, 'sky/cube/');
  assert.deepEqual(plan.files, FACES);
  assert.equal(plan.mirror, false);
  assert.equal(plan.flip, false);
  assert.equal(plan.colorSpace, 'SRGBColorSpace');
  const src = read('site/viewer3d/sky-ab-temp.js');
  assert.match(src, new RegExp(MARKER.replace(/[()]/g, '\\$&')));
  assert.doesNotMatch(src, /flipY/);
  assert.doesNotMatch(src, /scale\.x\s*=\s*-1/);
  assert.doesNotMatch(src, /repeat\.x\s*=\s*-1/);
  const eq = ab.equirectLoadPlan();
  assert.equal(eq.url, 'sky/tauceti_sky_equirect_4k.png');
  assert.equal(eq.mapping, 'EquirectangularReflectionMapping');
  assert.equal(eq.colorSpace, 'SRGBColorSpace');
  assert.equal(eq.flip, false);
});

test('TEMP skybox toggle swaps two background refs and defaults to the old sky', async function () {
  const ab = await import('../site/viewer3d/sky-ab-temp.js');
  assert.equal(ab.DEFAULT_SKY, 'procedural');
  const oldSky = { name: 'procedural' };
  const cube = { name: 'cube' };
  const equirect = { name: 'equirect' };
  const scene = { background: null };
  assert.equal(ab.swapBackground(scene, oldSky, cube, false), oldSky);
  assert.equal(scene.background, oldSky);
  assert.equal(ab.swapBackground(scene, oldSky, cube, true), cube);
  assert.equal(scene.background, cube);
  assert.equal(ab.swapBackground(scene, oldSky, cube, false), oldSky);
  assert.equal(scene.background, oldSky);

  const state = ab.createSkyAb(oldSky);
  assert.equal(state.mode, 'procedural');
  assert.equal(ab.backgroundFor(state), oldSky);
  state.cube = cube;
  state.equirect = equirect;
  ab.toggleCube(state);
  assert.equal(state.mode, 'cube');
  assert.equal(ab.backgroundFor(state), cube);
  ab.toggleCube(state);
  assert.equal(state.mode, 'procedural');
  assert.equal(ab.backgroundFor(state), oldSky);
  ab.setSkyMode(state, 'cube');
  state.cube = null;
  assert.equal(ab.backgroundFor(state), oldSky);
  ab.setSkyMode(state, 'equirect');
  assert.equal(ab.backgroundFor(state), equirect);
  ab.setSkyMode(state, 'procedural');
  assert.equal(ab.backgroundFor(state), oldSky);
  ab.setSkyMode(state, 'nope');
  assert.equal(state.mode, 'procedural');
});

test('TEMP skybox B key ignores input and textarea focus', async function () {
  const ab = await import('../site/viewer3d/sky-ab-temp.js');
  assert.equal(ab.skyToggleFromKey({ key: 'b', target: { tagName: 'INPUT' } }), false);
  assert.equal(ab.skyToggleFromKey({ key: 'B', target: { tagName: 'TEXTAREA' } }), false);
  assert.equal(ab.skyToggleFromKey({ key: 'b', target: { tagName: 'input' } }), false);
  assert.equal(ab.skyToggleFromKey({ key: 'b', target: { tagName: 'DIV' } }), true);
  assert.equal(ab.skyToggleFromKey({ key: 'b', target: { tagName: 'CANVAS' } }), true);
  assert.equal(ab.skyToggleFromKey({ key: 'B', target: { tagName: 'BODY' } }), true);
  assert.equal(ab.skyToggleFromKey({ key: 'a', target: { tagName: 'BODY' } }), false);
  assert.equal(ab.skyToggleFromKey({ key: 'b', target: { tagName: 'DIV', isContentEditable: true } }), false);
  assert.equal(ab.skyToggleFromKey({ key: 'b', repeat: true, target: { tagName: 'BODY' } }), false);
  assert.equal(ab.skyToggleFromKey(null), false);
});

test('TEMP skybox files, marker, dock checkbox, and loader wiring', function () {
  FACES.forEach(function (face) {
    const file = path.join(root, 'site', 'viewer3d', 'sky', 'cube', face);
    assert.equal(fs.existsSync(file), true, face);
    assert.ok(fs.statSync(file).size > 1000, face);
  });
  const equirect = path.join(root, 'site', 'viewer3d', 'sky', 'tauceti_sky_equirect_4k.png');
  assert.equal(fs.existsSync(equirect), true);
  assert.ok(fs.statSync(equirect).size > 1000);

  const page = read('site/viewer3d/index.html');
  const client = read('site/viewer3d/viewer3d.js');
  const marker = new RegExp(MARKER.replace(/[()]/g, '\\$&'));
  assert.doesNotMatch(page, marker);
  assert.doesNotMatch(client, marker);
  assert.doesNotMatch(page, /id="sky-ab-temp"/);
  assert.doesNotMatch(page, /id="sky-ab-equirect-temp"/);
  assert.doesNotMatch(page, /TEMP A\/B/);
  assert.doesNotMatch(client, /from '\.\/sky-ab-temp\.js'/);
  assert.doesNotMatch(client, /createSkyAb\(/);
  assert.doesNotMatch(client, /skyToggleFromKey/);
  assert.doesNotMatch(client, /CubeTextureLoader/);
  assert.match(client, /skyReference/);
  assert.match(client, /backgroundRotation/);
  assert.match(client, /EquirectangularReflectionMapping/);
  assert.match(client, /scene\.background\s*=\s*ensureStarfield\(THREE\)/);
  assert.doesNotMatch(client, /flipY/);
  assert.doesNotMatch(client, /scale\.x\s*=\s*-1/);
  assert.doesNotMatch(client, /repeat\.x\s*=\s*-1/);
});
