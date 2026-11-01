const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const modelDir = path.join(root, 'site', 'viewer3d', 'models');
const ringFile = 'jumpgate-ring-v4.glb';
const ringPath = path.join(modelDir, ringFile);
const svgFixtureRel = 'test/fixtures/tau-ceti-system.svg';
const svgFixturePath = path.join(root, svgFixtureRel);
const jobDir = 'F:\\Dropbox\\TheCourt\\research\\_jobs\\orbit_match\\jumpgate_ring_20261031';

const RING_TRUE_OUTER_RADIUS_M = 515.625;
const RING_TRUE_OUTER_DIAMETER_M = 1031.25;
const RING_TRUE_DEPTH_M = 328.125;
const RING_SHA256 = 'E29165FF3C31A277AE9359EBE4FE8E42B390C49AE1F6C32DBC858A7C508D8857';
const RING_BYTES = 6084904;

const PLANET_FILES = {
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function orbitalAngle(point) {
  return Math.atan2(-point.z, point.x);
}

function wrappedDelta(fromAngle, toAngle) {
  const d = toAngle - fromAngle;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  assert.equal(buf.toString('utf8', 0, 4), 'glTF');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  return { buf: buf, json: json };
}

function matIdentity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function matMul(a, b) {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function nodeLocalMatrix(node) {
  if (node.matrix && node.matrix.length === 16) return node.matrix.slice();
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const x = r[0];
  const y = r[1];
  const z = r[2];
  const w = r[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const yx = y * x2;
  const yy = y * y2;
  const zx = z * x2;
  const zy = z * y2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (yx + wz) * s[0], (zx - wy) * s[0], 0,
    (yx - wz) * s[1], (1 - (xx + zz)) * s[1], (zy + wx) * s[1], 0,
    (zx + wy) * s[2], (zy - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1
  ];
}

function transformPoint(m, x, y, z) {
  return {
    x: m[0] * x + m[4] * y + m[8] * z + m[12],
    y: m[1] * x + m[5] * y + m[9] * z + m[13],
    z: m[2] * x + m[6] * y + m[10] * z + m[14]
  };
}

function worldAabb(json) {
  const nodes = json.nodes || [];
  const meshes = json.meshes || [];
  const accessors = json.accessors || [];
  const world = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  function walk(index, parent) {
    const node = nodes[index];
    if (!node) return;
    const local = nodeLocalMatrix(node);
    const matrix = parent ? matMul(parent, local) : local;
    world[index] = matrix;
    if (node.mesh != null && meshes[node.mesh]) {
      (meshes[node.mesh].primitives || []).forEach(function (prim) {
        const pos = prim.attributes && prim.attributes.POSITION;
        const accessor = accessors[pos];
        if (!accessor || !Array.isArray(accessor.min) || !Array.isArray(accessor.max)) return;
        const corners = [];
        for (let i = 0; i < 8; i++) {
          corners.push([
            (i & 1) ? accessor.max[0] : accessor.min[0],
            (i & 2) ? accessor.max[1] : accessor.min[1],
            (i & 4) ? accessor.max[2] : accessor.min[2]
          ]);
        }
        corners.forEach(function (p) {
          const w = transformPoint(matrix, p[0], p[1], p[2]);
          if (w.x < min[0]) min[0] = w.x;
          if (w.y < min[1]) min[1] = w.y;
          if (w.z < min[2]) min[2] = w.z;
          if (w.x > max[0]) max[0] = w.x;
          if (w.y > max[1]) max[1] = w.y;
          if (w.z > max[2]) max[2] = w.z;
        });
      });
    }
    (node.children || []).forEach(function (child) { walk(child, matrix); });
  }
  const scene = json.scenes[json.scene];
  (scene.nodes || []).forEach(function (index) { walk(index, null); });
  return { min: min, max: max };
}

test('models directory lists the v4 jumpgate ring glb next to the body models', function () {
  const listed = Object.keys(PLANET_FILES).map(function (id) { return PLANET_FILES[id]; });
  listed.push(ringFile);
  listed.sort();
  const onDisk = fs.readdirSync(modelDir).filter(function (name) { return name.endsWith('.glb'); }).sort();
  assert.deepEqual(onDisk, listed);
  assert.equal(onDisk.indexOf('jumpgate_ring_v4_with_gate_effect.glb'), -1);
  assert.equal(fs.existsSync(path.join(modelDir, 'jumpgate_ring_v4_with_gate_effect.glb')), false);
});

test('jumpgate ring glb is the ring-only v4 file with Hero_1600 default scene and metre bounds', function () {
  assert.equal(fs.existsSync(ringPath), true);
  const stat = fs.statSync(ringPath);
  assert.equal(stat.size, RING_BYTES);
  const { buf, json } = parseGlb(ringPath);
  const sha = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  assert.equal(sha, RING_SHA256);
  assert.equal(json.scene, 1);
  const defaultScene = json.scenes[json.scene];
  assert.equal(defaultScene.name, 'Hero_1600');
  const nodes = json.nodes || [];
  const rootIndex = defaultScene.nodes[0];
  assert.equal(nodes[rootIndex].name, 'Jumpgate_Ring_Root');
  assert.equal((nodes[rootIndex].children || []).length, 64);
  const meshNodes = nodes.filter(function (node) { return node.mesh != null; });
  assert.equal(meshNodes.length, 192);
  assert.equal((json.cameras || []).length, 0);
  nodes.forEach(function (node) {
    assert.equal(Object.prototype.hasOwnProperty.call(node, 'camera'), false, node.name);
  });
  const aabb = worldAabb(json);
  const spanX = aabb.max[0] - aabb.min[0];
  const spanY = aabb.max[1] - aabb.min[1];
  const spanZ = aabb.max[2] - aabb.min[2];
  fs.writeFileSync(path.join(jobDir, '_glb_aabb.json'), JSON.stringify({
    min: aabb.min,
    max: aabb.max,
    spanX: spanX,
    spanY: spanY,
    spanZ: spanZ
  }, null, 2));
  const outerDiameter = Math.max(spanX, spanY);
  const depth = Math.min(spanX, spanY, spanZ);
  assert.ok(
    Math.abs(outerDiameter - RING_TRUE_OUTER_DIAMETER_M) / RING_TRUE_OUTER_DIAMETER_M <= 0.001,
    'diameter ' + outerDiameter
  );
  assert.ok(
    Math.abs(depth - RING_TRUE_DEPTH_M) / RING_TRUE_DEPTH_M <= 0.01,
    'depth ' + depth
  );
});

test('modelFileForBody maps only tc6gate onto the v4 ring and keeps the planet table', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const schema = await import('../site/js/schema.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  assert.equal(models.modelFileForBody('tc6gate'), 'models/jumpgate-ring-v4.glb');
  assert.equal(models.modelFileForBody('tc6gate', system), 'models/jumpgate-ring-v4.glb');
  Object.keys(PLANET_FILES).forEach(function (id) {
    assert.equal(models.modelFileForBody(id), 'models/' + PLANET_FILES[id], id);
    assert.equal(models.modelFileForBody(id, system), 'models/' + PLANET_FILES[id], id);
  });
  ['haven', 'yard', 'watch', 'b1', 'b2'].forEach(function (id) {
    assert.equal(models.modelFileForBody(id, system), null, id);
  });
  const override = {
    bodies: [{ id: 'tc6gate', model: 'models/croquet-ball.glb' }]
  };
  assert.equal(models.modelFileForBody('tc6gate', override), 'models/croquet-ball.glb');
  const missingRel = 'models/no-such-jumpgate-ring.glb';
  const missingSystem = {
    bodies: [{ id: 'tc6gate', model: missingRel }]
  };
  assert.equal(models.modelFileForBody('tc6gate', missingSystem), missingRel);
  assert.equal(fs.existsSync(path.join(root, 'site', 'viewer3d', missingRel)), false);
});

test('ring scale puts the outer radius on the display radius and rejects a bad radius', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const schema = await import('../site/js/schema.js');
  const sceneModel = await import('../site/viewer3d/scene-model.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const scene = sceneModel.buildScene(system, view);
  const gate = scene.bodies.find(function (body) { return body.id === 'tc6gate'; });
  const tc6 = scene.bodies.find(function (body) { return body.id === 'tc6'; });
  assert.ok(gate);
  assert.ok(tc6);
  const display = models.JUMPGATE_RING_DISPLAY_OUTER_RADIUS;
  assert.equal(typeof display, 'number');
  assert.ok(display > gate.radius, 'display ' + display + ' marker ' + gate.radius);
  assert.ok(display <= tc6.radius, 'display ' + display + ' tc6 ' + tc6.radius);
  const scale = models.ringModelScale(display);
  assert.ok(scale != null);
  assert.ok(Math.abs(scale * RING_TRUE_OUTER_RADIUS_M - display) < 1e-12);
  assert.equal(models.ringModelScale(0), null);
  assert.equal(models.ringModelScale(NaN), null);
  assert.equal(models.ringModelScale(-1), null);
  const okPlan = models.modelMountPlan({ ok: true }, 'tc6gate', display);
  assert.equal(okPlan.fallback, false);
  assert.equal(okPlan.hideSphere, true);
  assert.equal(okPlan.file, 'models/jumpgate-ring-v4.glb');
  assert.equal(okPlan.scale, scale);
  const badPlan = models.modelMountPlan({ ok: true }, 'tc6gate', 0);
  assert.equal(badPlan.fallback, true);
  assert.equal(badPlan.hideSphere, false);
  assert.equal(badPlan.scale, null);
});

test('a failed ring load is a fallback plan and a rejecting loader leaves the sphere', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const display = models.JUMPGATE_RING_DISPLAY_OUTER_RADIUS;
  const failed = models.modelMountPlan({ ok: false }, 'tc6gate', display);
  assert.equal(failed.fallback, true);
  assert.equal(failed.hideSphere, false);
  assert.equal(failed.pickId, 'tc6gate');
  const missingRel = 'models/no-such-jumpgate-ring.glb';
  const missingPlan = models.modelMountPlan({ ok: false }, 'tc6gate', display, missingRel);
  assert.equal(missingPlan.fallback, true);
  assert.equal(missingPlan.hideSphere, false);
  assert.equal(missingPlan.file, missingRel);

  const host = { userData: {}, material: { colorWrite: true, opacity: 1, visible: true } };
  function rejectLoader() {
    return Promise.reject(new Error('404'));
  }
  await rejectLoader().then(function () {
    assert.fail('loader should reject');
  }).catch(function () {
    const plan = models.applyBodyModelLoadResult(host, false, 'tc6gate', display, missingRel);
    assert.equal(plan.fallback, true);
    assert.equal(host.userData.modelFallback, true);
    assert.equal(host.material.colorWrite, true);
    assert.equal(host.material.opacity, 1);
  });
});

test('gate position and angle at T+0 and T+100 stay on the start-commit values, 60 deg ahead of tc6', async function () {
  const schema = await import('../site/js/schema.js');
  const sceneModel = await import('../site/viewer3d/scene-model.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const scene0 = sceneModel.buildScene(system, view);
  const sceneN = sceneModel.buildScene(system, Object.assign({}, view, { epoch_days: 100 }));
  const gate0 = scene0.bodies.find(function (body) { return body.id === 'tc6gate'; });
  const tc60 = scene0.bodies.find(function (body) { return body.id === 'tc6'; });
  const gateN = sceneN.bodies.find(function (body) { return body.id === 'tc6gate'; });
  const tc6N = sceneN.bodies.find(function (body) { return body.id === 'tc6'; });
  const pose = {
    t0: {
      gate: gate0.position,
      tc6: tc60.position,
      gateAngle: orbitalAngle(gate0.position),
      tc6Angle: orbitalAngle(tc60.position),
      gateRadius: gate0.radius,
      tc6Radius: tc60.radius
    },
    t100: {
      gate: gateN.position,
      tc6: tc6N.position,
      gateAngle: orbitalAngle(gateN.position),
      tc6Angle: orbitalAngle(tc6N.position)
    }
  };
  fs.writeFileSync(path.join(jobDir, '_gate_poses.json'), JSON.stringify(pose, null, 2));
  assert.ok(Math.abs(wrappedDelta(pose.t0.tc6Angle, pose.t0.gateAngle) - Math.PI / 3) < 1e-9);
  assert.ok(Math.abs(wrappedDelta(pose.t100.tc6Angle, pose.t100.gateAngle) - Math.PI / 3) < 5e-4);
  assert.deepEqual(gate0.position, {
    x: -1.5639745225570287,
    y: 0,
    z: 8.869740276122965
  });
  assert.deepEqual(tc60.position, {
    x: -8.463407665371005,
    y: 0,
    z: 3.0804284706554523
  });
  assert.deepEqual(gateN.position, {
    x: 1.3435378325824996,
    y: 0,
    z: 8.905796705826205
  });
  assert.deepEqual(tc6N.position, {
    x: -7.042573584640971,
    y: 0,
    z: 5.614309056153088
  });
  assert.equal(gate0.radius, 0.23578582832551992);
  assert.equal(tc60.radius, 0.40226247616196276);
});

test('jumpgate label and card say not to scale in the normal view', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  const sceneModel = await import('../site/viewer3d/scene-model.js');
  const schema = await import('../site/js/schema.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const note = models.jumpgateRingScaleNote(false);
  assert.match(note, /not to scale/i);
  assert.match(note, /Jumpgate ring: drawn about 100000 times its true size so it can be seen/);
  const trueNote = models.jumpgateRingScaleNote(true);
  assert.equal(trueNote, '');
  assert.doesNotMatch(String(trueNote), /not to scale/i);
  const label = models.jumpgateRingBodyLabel('Jumpgate', false);
  assert.match(label, /not to scale/);
  assert.match(label, /Jumpgate/);
  assert.equal(models.jumpgateRingBodyLabel('Jumpgate', true), 'Jumpgate');
  assert.equal(sceneModel.hasSubmap(system, 'tc6gate'), false);
  const client = read('site/viewer3d/viewer3d.js');
  assert.match(client, /jumpgateRingBodyLabel/);
  assert.match(client, /jumpgateRingScaleNote/);
});

test('the jumpgate uses the display radius, keeps ring nodes, and a rejecting loader leaves the sphere', async function () {
  const models = await import('../site/viewer3d/body-models.js');
  assert.equal(models.modelDisplayRadius('tc6gate', 0.23578582832551992), models.JUMPGATE_RING_DISPLAY_OUTER_RADIUS);
  assert.equal(models.modelDisplayRadius('tc6', 0.40226247616196276), 0.40226247616196276);
  assert.equal(models.isGlbRingNode('Jumpgate_Ring_Root'), true);
  assert.equal(models.shouldHideGlbRingNode('Jumpgate_Ring_Root', 'tc6gate'), false);
  assert.equal(models.shouldHideGlbRingNode('SM_planet_ring', 'tc6'), true);
  const client = read('site/viewer3d/viewer3d.js');
  assert.match(client, /modelDisplayRadius/);
  assert.match(client, /shouldHideGlbRingNode/);
  assert.match(client, /applyBodyModelLoadResult/);
  const host = {
    userData: {},
    material: { colorWrite: true, opacity: 1, transparent: false, depthWrite: true, needsUpdate: false }
  };
  function rejectLoader() {
    return Promise.reject(new Error('404'));
  }
  await rejectLoader().then(function () {
    assert.fail('loader should reject');
  }).catch(function () {
    const plan = models.applyBodyModelLoadResult(
      host,
      false,
      'tc6gate',
      models.JUMPGATE_RING_DISPLAY_OUTER_RADIUS,
      'models/jumpgate-ring-v4.glb'
    );
    assert.equal(plan.fallback, true);
    assert.equal(plan.hideSphere, false);
    assert.equal(host.userData.modelFallback, true);
    assert.equal(host.material.colorWrite, true);
    assert.equal(host.material.opacity, 1);
  });
});

test('SVG output for Tau Ceti matches the snapshot taken from the start commit', async function () {
  const schema = await import('../site/js/schema.js');
  const draw = await import('../site/js/render-svg.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const empire = readJson('site/themes/empire.json');
  const quiet = readJson('site/themes/quiet.json');
  const svg = draw.renderSvg(system, view, empire, quiet);
  if (!fs.existsSync(svgFixturePath)) {
    fs.mkdirSync(path.dirname(svgFixturePath), { recursive: true });
    fs.writeFileSync(svgFixturePath, svg);
  }
  const fixture = fs.readFileSync(svgFixturePath, 'utf8');
  assert.equal(svg, fixture);
});
