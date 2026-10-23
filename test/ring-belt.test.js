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

function copySamples(samples) {
  return {
    count: samples.count,
    positions: Array.from(samples.positions),
    palette: Array.from(samples.palette),
    jitter: Array.from(samples.jitter)
  };
}

function sceneRadius(scene, id) {
  const body = scene.bodies.find(function (item) { return item.id === id; });
  assert.ok(body, id);
  return Math.hypot(body.position.x, body.position.z);
}

test('per-belt density and dustiness stay independent', async function () {
  const rings = await import('../site/viewer3d/ring-belt.js');
  const sombrero = rings.createRingBelt({
    id: 'b1',
    name: 'The Sombrero',
    center: { x: 0, y: 0, z: 0 },
    innerRadius: 4,
    outerRadius: 6,
    thickness: 1,
    inclination: 0,
    seed: 20261024,
    density: 2,
    dustiness: 40,
    follow: 'star'
  });
  const wall = rings.createRingBelt({
    id: 'b2',
    name: 'Outer Wall',
    center: { x: 0, y: 0, z: 0 },
    innerRadius: 12,
    outerRadius: 20,
    thickness: 2,
    inclination: 0,
    seed: 20261118,
    density: 2,
    dustiness: 40,
    follow: 'star'
  });
  assert.equal(sombrero.count, 4200);
  assert.equal(wall.count, 2800);
  assert.equal(sombrero.density, 2);
  assert.equal(wall.density, 2);
  assert.equal(sombrero.dustiness, 40);
  assert.equal(wall.dustiness, 40);
  const wallBefore = {
    density: wall.density,
    dustiness: wall.dustiness,
    count: wall.count,
    style: Object.assign({}, wall.style),
    samples: copySamples(wall.local)
  };
  const dustier = rings.withDustiness(sombrero, 90);
  const changed = rings.withDensity(dustier, 4);
  assert.equal(sombrero.density, 2);
  assert.equal(sombrero.dustiness, 40);
  assert.equal(sombrero.count, 4200);
  assert.equal(changed.id, 'b1');
  assert.equal(changed.density, 4);
  assert.equal(changed.dustiness, 90);
  assert.equal(changed.count, 14400);
  assert.notEqual(changed.count, sombrero.count);
  assert.notDeepEqual(Array.from(changed.local.positions), Array.from(sombrero.local.positions));
  assert.equal(wall.density, wallBefore.density);
  assert.equal(wall.dustiness, wallBefore.dustiness);
  assert.equal(wall.count, wallBefore.count);
  assert.deepEqual(wall.style, wallBefore.style);
  assert.deepEqual(copySamples(wall.local), wallBefore.samples);
  const quieter = rings.withDustiness(sombrero, 10);
  assert.equal(quieter.dustiness, 10);
  assert.equal(quieter.count, sombrero.count);
  assert.deepEqual(Array.from(quieter.local.positions), Array.from(sombrero.local.positions));
  assert.deepEqual(Array.from(quieter.local.palette), Array.from(sombrero.local.palette));
  assert.deepEqual(Array.from(quieter.local.jitter), Array.from(sombrero.local.jitter));
  assert.notEqual(quieter.style.size, sombrero.style.size);
  assert.notEqual(quieter.style.opacity, sombrero.style.opacity);
  assert.equal(wall.count, 2800);
});

test('ring samples are deterministic per seed', async function () {
  const rings = await import('../site/viewer3d/ring-belt.js');
  const config = {
    id: 'probe-ring',
    name: 'Probe',
    center: { x: 1, y: 2, z: 3 },
    innerRadius: 0.4,
    outerRadius: 0.9,
    thickness: 0.2,
    inclination: 0.3,
    seed: 99,
    density: 1,
    dustiness: 20,
    follow: 'planet',
    countShare: 0.1,
    parentId: 'tc7'
  };
  const first = rings.createRingBelt(config);
  const second = rings.createRingBelt(config);
  assert.equal(first.count, second.count);
  assert.ok(first.count > 0);
  assert.deepEqual(Array.from(first.local.positions), Array.from(second.local.positions));
  assert.deepEqual(Array.from(first.local.palette), Array.from(second.local.palette));
  assert.deepEqual(Array.from(first.local.jitter), Array.from(second.local.jitter));
  assert.deepEqual(Array.from(first.world.positions), Array.from(second.world.positions));
  const other = rings.createRingBelt(Object.assign({}, config, { seed: 100 }));
  assert.equal(other.count, first.count);
  assert.equal(other.density, first.density);
  assert.equal(other.dustiness, first.dustiness);
  assert.notDeepEqual(Array.from(first.local.positions), Array.from(other.local.positions));
  assert.notDeepEqual(Array.from(first.world.positions), Array.from(other.world.positions));
});

test('a flat thin planet ring follows its parent each frame', async function () {
  const rings = await import('../site/viewer3d/ring-belt.js');
  const thickness = 0.02;
  const inner = 0.25;
  const outer = 0.6;
  let ring = rings.createRingBelt({
    id: 'tc7-ring',
    name: 'Cue Ball ring',
    center: { x: 0, y: 0, z: 0 },
    innerRadius: inner,
    outerRadius: outer,
    thickness: thickness,
    inclination: 0,
    seed: 5150,
    density: 1,
    dustiness: 15,
    follow: 'planet',
    countShare: 0.05,
    parentId: 'tc7'
  });
  assert.equal(ring.follow, 'planet');
  assert.equal(ring.parentId, 'tc7');
  assert.equal(ring.thickness, thickness);
  assert.ok(thickness < (outer - inner));
  assert.ok(ring.count > 0);
  assert.deepEqual(ring.center, { x: 0, y: 0, z: 0 });
  const parentA = { x: 5, y: 1.25, z: -3 };
  ring = rings.updateRingBeltFrame(ring, parentA);
  assert.deepEqual(ring.center, { x: 5, y: 1.25, z: -3 });
  const local = Array.from(ring.local.positions);
  function assertInside(belt) {
    const half = belt.thickness / 2;
    for (let i = 0; i < belt.count; i++) {
      const x = belt.world.positions[i * 3] - belt.center.x;
      const y = belt.world.positions[i * 3 + 1] - belt.center.y;
      const z = belt.world.positions[i * 3 + 2] - belt.center.z;
      const radius = Math.hypot(x, z);
      assert.ok(radius >= inner - 1e-6 && radius <= outer + 1e-6, String(radius));
      assert.ok(Math.abs(y) <= half + 1e-6, String(y));
    }
  }
  assertInside(ring);
  const parentB = { x: -8, y: 0.5, z: 4 };
  const moved = rings.updateRingBeltFrame(ring, parentB);
  assert.deepEqual(moved.center, { x: -8, y: 0.5, z: 4 });
  assert.deepEqual(Array.from(moved.local.positions), local);
  assert.equal(moved.density, ring.density);
  assert.equal(moved.dustiness, ring.dustiness);
  assert.equal(moved.count, ring.count);
  assert.equal(moved.seed, ring.seed);
  assertInside(moved);
  for (let i = 0; i < moved.count; i++) {
    const dx = (moved.world.positions[i * 3] - parentB.x) - (ring.world.positions[i * 3] - parentA.x);
    const dy = (moved.world.positions[i * 3 + 1] - parentB.y) - (ring.world.positions[i * 3 + 1] - parentA.y);
    const dz = (moved.world.positions[i * 3 + 2] - parentB.z) - (ring.world.positions[i * 3 + 2] - parentA.z);
    assert.ok(Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6 && Math.abs(dz) < 1e-6);
  }
});

test('catalog belts keep their radii and dust stays out of the raycaster', async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const sky = await import('../site/viewer3d/sky.js');
  const rings = await import('../site/viewer3d/ring-belt.js');
  assert.equal(rings.dustIsPickable(), false);
  assert.doesNotMatch(read('site/viewer3d/ring-belt.js'), /from\s+['"]three/);
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  function check(mode) {
    const scene = model.buildScene(system, view, { distance_mode: mode });
    const bands = sky.dustBands(scene.belts);
    const belts = rings.ringBeltsFromBands(bands);
    assert.equal(belts.length, 2, mode);
    const sombrero = belts[0];
    const wall = belts[1];
    assert.equal(sombrero.id, 'b1');
    assert.equal(sombrero.name, 'The Sombrero');
    assert.equal(sombrero.seed, 20261024);
    assert.equal(sombrero.follow, 'star');
    assert.equal(sombrero.density, 2);
    assert.equal(sombrero.dustiness, 40);
    assert.equal(sombrero.count, 4200);
    assert.equal(sombrero.innerAu, 1.1);
    assert.equal(sombrero.outerAu, 1.6);
    assert.deepEqual(sombrero.center, { x: 0, y: 0, z: 0 });
    assert.equal(wall.id, 'b2');
    assert.equal(wall.name, 'Outer Wall');
    assert.equal(wall.seed, 20261118);
    assert.equal(wall.follow, 'star');
    assert.equal(wall.density, 2);
    assert.equal(wall.dustiness, 40);
    assert.equal(wall.count, 2800);
    assert.equal(wall.innerAu, 10);
    assert.equal(wall.outerAu, 52);
    assert.ok(sombrero.innerRadius > sceneRadius(scene, 'tc5'), mode);
    assert.ok(sombrero.outerRadius < sceneRadius(scene, 'tc6'), mode);
    assert.ok(wall.innerRadius > sceneRadius(scene, 'tc8'), mode);
    assert.ok(wall.outerRadius > wall.innerRadius);
    [sombrero, wall].forEach(function (belt) {
      const half = belt.thickness / 2;
      for (let i = 0; i < belt.count; i++) {
        const x = belt.local.positions[i * 3];
        const y = belt.local.positions[i * 3 + 1];
        const z = belt.local.positions[i * 3 + 2];
        const radius = Math.hypot(x, z);
        assert.ok(radius >= belt.innerRadius - 1e-6 && radius <= belt.outerRadius + 1e-6, belt.id);
        assert.ok(Math.abs(y) <= half + 1e-6, belt.id + ' y ' + y);
      }
    });
    scene.bodies.forEach(function (body) {
      const radius = Math.hypot(body.position.x, body.position.z);
      const inSombrero = radius > sombrero.innerRadius && radius < sombrero.outerRadius;
      const inWall = radius > wall.innerRadius && radius < wall.outerRadius;
      assert.equal(inSombrero, false, body.id + ' sombrero ' + mode);
      assert.equal(inWall, false, body.id + ' wall ' + mode);
    });
  }
  check('schematic');
  check('linear');
  const close = model.buildScene(system, view, { frame: 'tc5' });
  assert.equal(close.belts.length, 0);
  assert.equal(rings.ringBeltsFromBands(sky.dustBands(close.belts)).length, 0);
  const page = read('site/viewer3d/index.html');
  const client = read('site/viewer3d/viewer3d.js');
  const css = read('site/viewer3d/viewer3d.css');
  assert.doesNotMatch(page, /id="dust-density"/);
  assert.doesNotMatch(page, /id="dust-dustiness"/);
  assert.doesNotMatch(page, /id="distance-mode"/);
  assert.match(page, /id="lore-settings"/);
  assert.match(page, /Lore based settings/);
  assert.doesNotMatch(page, /<details id="lore-settings"[^>]*\sopen/);
  const lore = await import('../site/viewer3d/lore-settings.js');
  const markup = lore.loreSettingsMarkup(lore.loreSettingsFromSystem(system));
  assert.match(markup, /id="belt-b1-density"[^>]*min="0"/);
  assert.match(markup, /id="belt-b1-density"[^>]*max="4"/);
  assert.match(markup, /id="belt-b1-density"[^>]*value="2"/);
  assert.match(markup, /id="belt-b1-dustiness"[^>]*min="0"/);
  assert.match(markup, /id="belt-b1-dustiness"[^>]*max="100"/);
  assert.match(markup, /id="belt-b1-dustiness"[^>]*value="40"/);
  assert.match(markup, /id="belt-b2-density"[^>]*value="2"/);
  assert.match(markup, /id="belt-b2-dustiness"[^>]*value="40"/);
  assert.match(markup, /aria-label="The Sombrero Density"/);
  assert.match(markup, /aria-label="The Sombrero Dustiness"/);
  assert.match(markup, /aria-label="Outer Wall Density"/);
  assert.match(markup, /aria-label="Outer Wall Dustiness"/);
  assert.match(css, /\.belt-controls/);
  assert.match(css, /\.belt-controls summary/);
  assert.match(client, /from '\.\/ring-belt\.js'/);
  assert.match(client, /ringBeltsFromBands/);
  assert.match(client, /updateRingBeltFrame/);
  assert.match(client, /withDensity/);
  assert.match(client, /withDustiness/);
  assert.match(client, /data-belt-density/);
  assert.match(client, /loreSettingsFromSystem/);
  assert.doesNotMatch(client, /getElementById\('belt-b1-density'\)/);
  assert.match(client, /function emptyRaycast\(\) \{\s*\}/);
  const mount = client.match(/function mountDustBelts\([\s\S]*?\n\}/);
  assert.ok(mount, 'mountDustBelts');
  assert.match(mount[0], /emptyRaycast/);
  assert.match(mount[0], /pickable = false/);
  assert.doesNotMatch(mount[0], /pickables/);
  assert.doesNotMatch(mount[0], /userData\.id/);
});
