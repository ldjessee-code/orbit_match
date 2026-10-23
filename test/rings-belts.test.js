const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const handoffPath = 'F:\\Dropbox\\TheCourt\\research\\_jobs\\orbit-match-viewer-proto\\ringsbelts_20261020\\inputs\\rings_belts_orbitwatch_data_20261020.md';

const SOURCE_SHA = '9057b24cb2d095b30e96a1a4d8a2f4093b6ae19844c86b3b1dc7a3d1bdc15502';
const HANDOFF_SHA = 'B3F9ABB14F8CB5B37727A6E7DA6173D47FA42DBA5BEF0DF31EBF650A6BB427CE';
const ALLOWED_TAGS = ['real', 'est.', 'est', 'fiction', 'derived', 'locked', 'setting', 'tbd'];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function body(system, id) {
  const found = (system.bodies || []).find(function (item) { return item.id === id; });
  assert.ok(found, 'missing body ' + id);
  return found;
}

function taggedNumber(node) {
  assert.ok(node && typeof node === 'object', 'tagged node');
  assert.ok(ALLOWED_TAGS.indexOf(node.tag) >= 0, 'tag ' + node.tag);
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    assert.equal(typeof node.value === 'number' || typeof node.value === 'string', true, JSON.stringify(node));
    return node;
  }
  assert.equal(typeof node.min === 'number', true, JSON.stringify(node));
  assert.equal(typeof node.max === 'number', true, JSON.stringify(node));
  return node;
}

function walkTagged(node, path, out) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(function (item, index) {
      walkTagged(item, path + '[' + index + ']', out);
    });
    return;
  }
  const hasValue = Object.prototype.hasOwnProperty.call(node, 'value');
  const hasRange = Object.prototype.hasOwnProperty.call(node, 'min') || Object.prototype.hasOwnProperty.call(node, 'max');
  if (hasValue || hasRange) {
    taggedNumber(node);
    out.push(path);
  }
  Object.keys(node).forEach(function (key) {
    if (key === 'tag' || key === 'note' || key === 'name' || key === 'role' || key === 'value' || key === 'min' || key === 'max' || key === 'resonance' || key === 'draw' || key === 'optional' || key === 'unit') return;
    walkTagged(node[key], path ? path + '.' + key : key, out);
  });
}

function glbJson(fileName) {
  const buf = fs.readFileSync(path.join(root, 'site', 'viewer3d', 'models', fileName));
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

function glbNodeNames(fileName) {
  return (glbJson(fileName).nodes || []).map(function (node) { return node.name; });
}

function countInRadiusBin(positions, count, center, half) {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    const radius = Math.hypot(x, z);
    if (Math.abs(radius - center) <= half) n += 1;
  }
  return n;
}

function countInRadiusAndAngle(positions, count, center, half, angle0, angleHalf) {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    const radius = Math.hypot(x, z);
    if (Math.abs(radius - center) > half) continue;
    const angle = Math.atan2(-z, x);
    const delta = Math.atan2(Math.sin(angle - angle0), Math.cos(angle - angle0));
    if (Math.abs(delta) <= angleHalf) n += 1;
  }
  return n;
}

test('handoff YAML and system data keep v2.41j radii, tags, and provenance', async function () {
  const schema = await import('../site/js/schema.js');
  const raw = readJson('site/data/tau-ceti.system.json');
  const loaded = schema.loadSystem(raw);
  const md = fs.readFileSync(handoffPath, 'utf8');
  assert.match(md, /version: v2\.41j/);
  assert.match(md, /a_au: \[1\.1, 1\.6\]/);
  assert.match(md, /a_au: \[10, 52\]/);
  assert.match(md, /gaps_au: \[1\.346, 1\.520, 1\.592\]/);
  assert.match(md, /"3:2": 12\.06/);
  assert.match(md, /"2:1": 14\.60/);
  assert.equal(loaded.lore.version, 'v2.41c');
  const provenance = loaded.rings_belts.provenance;
  assert.equal(provenance.version, 'v2.41j');
  assert.equal(provenance.source_sha256, SOURCE_SHA);
  assert.equal(provenance.handoff_sha256, HANDOFF_SHA);
  assert.equal(body(loaded, 'b1').orbit.a_inner_au, 1.1);
  assert.equal(body(loaded, 'b1').orbit.a_outer_au, 1.6);
  assert.equal(body(loaded, 'b2').orbit.a_inner_au, 10);
  assert.equal(body(loaded, 'b2').orbit.a_outer_au, 52);
  assert.equal(body(loaded, 'b1').canon['orbit.a_inner_au'], 'fiction');
  assert.equal(body(loaded, 'b1').canon['orbit.a_outer_au'], 'fiction');
  assert.equal(body(loaded, 'b2').canon['orbit.a_inner_au'], 'real');
  assert.equal(body(loaded, 'b2').canon['orbit.a_outer_au'], 'est');
  const sombrero = body(loaded, 'b1').belt_structure;
  const wall = body(loaded, 'b2').belt_structure;
  assert.deepEqual(sombrero.gaps_au.map(function (item) { return item.value; }), [1.346, 1.520, 1.592]);
  sombrero.gaps_au.forEach(function (item) { taggedNumber(item); });
  assert.equal(sombrero.resonances_with_croquet_au['3:1'].value, 1.346);
  assert.equal(sombrero.resonances_with_croquet_au['4:1'].value, 1.111);
  assert.equal(sombrero.resonances_with_croquet_au['2:1'].value, 1.764);
  assert.equal(wall.resonant_clumps_with_eight_ball_au['3:2'].value, 12.06);
  assert.equal(wall.resonant_clumps_with_eight_ball_au['2:1'].value, 14.60);
  assert.equal(wall.resonant_clumps_with_eight_ball_au['5:3'].value, 12.93);
  taggedNumber(body(loaded, 'tc6').ring_system.bands[0].r_in_km);
  taggedNumber(body(loaded, 'tc7').ring_system.bands[0].r_in_km);
  taggedNumber(body(loaded, 'tc8').ring_system.bands[0].r_in_km);
  const taggedPaths = [];
  walkTagged(loaded.rings_belts, 'rings_belts', taggedPaths);
  walkTagged(body(loaded, 'tc6').ring_system, 'tc6.ring_system', taggedPaths);
  walkTagged(body(loaded, 'tc7').ring_system, 'tc7.ring_system', taggedPaths);
  walkTagged(body(loaded, 'tc8').ring_system, 'tc8.ring_system', taggedPaths);
  walkTagged(sombrero, 'b1.belt_structure', taggedPaths);
  walkTagged(wall, 'b2.belt_structure', taggedPaths);
  assert.ok(taggedPaths.length >= 40, 'tagged leaves ' + taggedPaths.length);
  assert.equal(body(loaded, 'tc6').ring_system.bands[0].r_in_km.value, 75700);
  assert.equal(body(loaded, 'tc6').ring_system.bands[0].r_out_km.value, 87300);
  assert.equal(body(loaded, 'tc7').ring_system.planet_radius_km.value, 24600);
  assert.equal(body(loaded, 'tc8').ring_system.planet_radius_km.value, 24500);
  const phoebe = body(loaded, 'tc8').ring_system.bands.find(function (band) { return band.name === 'phoebe_like'; });
  assert.equal(phoebe.r_in_km.value, 7300000);
  assert.equal(phoebe.r_out_km.value, 13700000);
  assert.equal(phoebe.draw, false);
  const cueA = body(loaded, 'tc7').ring_system.bands.find(function (band) { return band.name === 'A'; });
  assert.deepEqual(cueA.gap_km.map(function (item) { return item.value; }), [61350, 61650]);
  const dust = loaded.rings_belts.dust_level_x_sol;
  assert.equal(dust[0].level.value, 10);
  assert.equal(dust[1].level.min, 10);
  assert.equal(dust[1].level.max, 20);
  assert.equal(dust[4].level.value, 100);
  dust.forEach(function (row) {
    taggedNumber(row.level);
    taggedNumber(row.a_au);
  });
});

test('Sombrero gaps lower sampled density and Outer Wall clumps raise it', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  assert.equal(typeof sky.beltSampleWeight, 'function');
  const gapFeatures = [
    { type: 'gap', radius: 1.346, halfWidth: 0.018, depth: 0.9 },
    { type: 'gap', radius: 1.520, halfWidth: 0.014, depth: 0.85 },
    { type: 'gap', radius: 1.592, halfWidth: 0.012, depth: 0.8 }
  ];
  assert.ok(sky.beltSampleWeight(1.346, 0, gapFeatures) < 0.25);
  assert.ok(sky.beltSampleWeight(1.42, 0, gapFeatures) > 0.9);
  const sombrero = sky.generateBeltSamples({
    innerR: 1.1,
    outerR: 1.6,
    halfHeight: 0.04,
    count: 9000,
    seed: 20261020,
    features: gapFeatures
  });
  const gapCount = countInRadiusBin(sombrero.positions, sombrero.count, 1.346, 0.008);
  const controlCount = countInRadiusBin(sombrero.positions, sombrero.count, 1.42, 0.008);
  assert.ok(controlCount > 20, 'control ' + controlCount);
  assert.ok(gapCount < controlCount * 0.55, 'gap ' + gapCount + ' control ' + controlCount);
  const clumpFeatures = [
    { type: 'clump', radius: 12.06, halfWidth: 0.35, gain: 1.8, azimuthal: { n: 2, phase: 0, gain: 0.7 } },
    { type: 'clump', radius: 14.60, halfWidth: 0.45, gain: 1.6 }
  ];
  assert.ok(sky.beltSampleWeight(12.06, 0, clumpFeatures) > 1.5);
  assert.ok(sky.beltSampleWeight(11.0, 0, clumpFeatures) < 1.05);
  const wall = sky.generateBeltSamples({
    innerR: 10,
    outerR: 20,
    halfHeight: 0.2,
    count: 12000,
    seed: 20261020,
    features: clumpFeatures
  });
  const clumpCount = countInRadiusBin(wall.positions, wall.count, 12.06, 0.12);
  const quietCount = countInRadiusBin(wall.positions, wall.count, 11.0, 0.12);
  assert.ok(quietCount > 5, 'quiet ' + quietCount);
  assert.ok(clumpCount > quietCount * 1.35, 'clump ' + clumpCount + ' quiet ' + quietCount);
  const lobe = countInRadiusAndAngle(wall.positions, wall.count, 12.06, 0.12, 0, 0.4);
  const away = countInRadiusAndAngle(wall.positions, wall.count, 12.06, 0.12, Math.PI / 2, 0.4);
  assert.ok(lobe > away, 'azimuthal lobe ' + lobe + ' away ' + away);
  const again = sky.generateBeltSamples({
    innerR: 1.1,
    outerR: 1.6,
    halfHeight: 0.04,
    count: 9000,
    seed: 20261020,
    features: gapFeatures
  });
  assert.deepEqual(Array.from(again.positions), Array.from(sombrero.positions));
});

test('planet rings use display-radius km mapping and follow their planet', async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const rings = await import('../site/viewer3d/ring-belt.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const scene = model.buildScene(system, view);
  assert.equal(typeof rings.ringKmToScene, 'function');
  assert.equal(typeof rings.planetRingsFromScene, 'function');
  const cueBody = scene.bodies.find(function (item) { return item.id === 'tc7'; });
  const mapped = rings.ringKmToScene(25830, 24600, cueBody.radius);
  assert.ok(Math.abs(mapped - cueBody.radius * (25830 / 24600)) < 1e-9);
  const configs = rings.planetRingsFromScene(system, scene);
  const byParent = {};
  configs.forEach(function (item) {
    byParent[item.parentId] = (byParent[item.parentId] || 0) + 1;
    assert.equal(item.follow, 'planet');
    assert.ok(item.thickness < 0.08, item.id);
    assert.ok(item.innerRadius > 0, item.id);
    assert.ok(item.outerRadius > item.innerRadius, item.id);
    assert.equal(item.drawSolid, false);
  });
  assert.ok(byParent.tc6 >= 3, 'croquet bands');
  assert.ok(byParent.tc7 >= 6, 'cue bands');
  assert.ok(byParent.tc8 >= 2, 'eight bands');
  assert.equal(configs.some(function (item) { return item.name === 'phoebe_like'; }), false);
  const haze = configs.find(function (item) { return item.id === 'tc7-haze'; });
  assert.ok(haze, 'cue haze');
  assert.equal(haze.parentId, 'tc7');
  assert.ok(Math.abs(haze.innerRadius - mapped) < 1e-9);
  let ring = rings.createRingBelt(haze);
  assert.equal(ring.follow, 'planet');
  const parentA = { x: 4, y: 0.2, z: -2 };
  ring = rings.updateRingBeltFrame(ring, parentA);
  assert.deepEqual(ring.center, parentA);
  for (let i = 0; i < ring.count; i++) {
    const x = ring.world.positions[i * 3] - parentA.x;
    const y = ring.world.positions[i * 3 + 1] - parentA.y;
    const z = ring.world.positions[i * 3 + 2] - parentA.z;
    const radius = Math.hypot(x, z);
    assert.ok(radius >= ring.innerRadius - 1e-6 && radius <= ring.outerRadius + 1e-6);
    assert.ok(Math.abs(y) <= ring.thickness / 2 + 1e-6);
  }
  const parentB = { x: -3, y: 1, z: 5 };
  const moved = rings.updateRingBeltFrame(ring, parentB);
  assert.deepEqual(moved.center, parentB);
  const catalog = rings.ringBeltsFromBands(
    (await import('../site/viewer3d/sky.js')).dustBands(scene.belts)
  );
  const sombrero = catalog.find(function (item) { return item.id === 'b1'; });
  const wall = catalog.find(function (item) { return item.id === 'b2'; });
  assert.equal(sombrero.innerAu, 1.1);
  assert.equal(sombrero.outerAu, 1.6);
  assert.equal(wall.innerAu, 10);
  assert.equal(wall.outerAu, 52);
  assert.ok((sombrero.features || []).some(function (item) { return item.type === 'gap' && Math.abs(item.au - 1.346) < 1e-9; }));
  assert.ok((wall.features || []).some(function (item) { return item.type === 'clump' && Math.abs(item.au - 12.06) < 1e-9; }));
  assert.ok((wall.features || []).some(function (item) { return item.type === 'clump' && Math.abs(item.au - 14.60) < 1e-9; }));
});

test('Cue Ball has exactly one ring source: the data-driven ring-belt', async function () {
  const schema = await import('../site/js/schema.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const rings = await import('../site/viewer3d/ring-belt.js');
  const models = await import('../site/viewer3d/body-models.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const scene = model.buildScene(system, view);
  const cue = scene.bodies.find(function (item) { return item.id === 'tc7'; });
  assert.equal(cue.rings, true);
  assert.equal(rings.cueBallRingSource(system), 'data-belt');
  assert.equal(rings.solidRingForBody(system, 'tc7'), false);
  assert.equal(rings.solidRingForBody(system, 'tc6'), false);
  assert.equal(rings.solidRingForBody(system, 'tc8'), false);
  const planetRings = rings.planetRingsFromScene(system, scene).filter(function (item) {
    return item.parentId === 'tc7';
  });
  assert.ok(planetRings.length >= 6);
  planetRings.forEach(function (item) {
    assert.equal(item.follow, 'planet');
    assert.equal(item.drawSolid, false);
  });
  const cueNames = glbNodeNames('cue-ball.glb');
  const ringNodes = cueNames.filter(function (name) { return /ring/i.test(name); });
  assert.ok(ringNodes.length >= 1, 'cue glb ring node');
  ringNodes.forEach(function (name) {
    assert.equal(models.isGlbRingNode(name), true, name);
  });
  const eightNames = glbNodeNames('eight-ball.glb');
  eightNames.filter(function (name) { return /ring/i.test(name); }).forEach(function (name) {
    assert.equal(models.isGlbRingNode(name), true, name);
  });
  const client = read('site/viewer3d/viewer3d.js');
  assert.match(client, /solidRingForBody/);
  assert.match(client, /planetRingsFromScene/);
  assert.match(client, /isGlbRingNode/);
  const rebuild = client.match(/function rebuild\([\s\S]*?\n\}/);
  assert.ok(rebuild, 'rebuild');
  assert.match(rebuild[0], /solidRingForBody/);
  assert.doesNotMatch(rebuild[0], /if \(body\.rings\) \{\s*const ring = new THREE\.Mesh\(\s*new THREE\.RingGeometry/);
});
