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

async function loaded() {
  const schema = await import('../site/js/schema.js');
  const frame = await import('../site/viewer3d/frame.js');
  const model = await import('../site/viewer3d/scene-model.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  return { frame: frame, model: model, system: system, view: view };
}

function sceneRadius(scene, id) {
  const body = scene.bodies.find(function (item) { return item.id === id; });
  assert.ok(body, id);
  return Math.hypot(body.position.x, body.position.z);
}

function orbitalAngle(point) {
  return Math.atan2(-point.z, point.x);
}

function wrappedDelta(fromAngle, toAngle) {
  const d = toAngle - fromAngle;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

function tangentCos(point, other) {
  const sx = other.x - point.x;
  const sz = other.z - point.z;
  const dot = point.x * sx + point.z * sz;
  return Math.abs(dot) / (Math.hypot(point.x, point.z) * Math.hypot(sx, sz));
}

test('frame maps orbital XY onto Y-up and clamps the camera', async function () {
  const { frame } = await loaded();
  assert.deepEqual(frame.toThree(1, 0), { x: 1, y: 0, z: 0 });
  assert.deepEqual(frame.toThree(0, 1), { x: 0, y: 0, z: -1 });
  const pose = frame.cameraPose(20, 0, 10);
  assert.ok(Math.abs(pose.x) < 1e-9, String(pose.x));
  assert.ok(pose.z > 0, String(pose.z));
  assert.ok(Math.abs(pose.y / pose.distance - Math.sin((20 * Math.PI) / 180)) < 1e-9, String(pose.y));
  assert.equal(pose.elevation_deg, 20);
  assert.equal(pose.azimuth_deg, 0);
  assert.equal(pose.distance, 10);
  assert.equal(frame.cameraPose(20, 0, 0).distance, 1);
  assert.equal(frame.cameraPose(20, 0, -4).distance, 1);
  assert.equal(frame.cameraPose(20, NaN, 10).azimuth_deg, 0);
  const limits = frame.polarLimits();
  assert.ok(limits.minPolarAngle < limits.maxPolarAngle);
  assert.ok(Math.abs(limits.minPolarAngle - (15 * Math.PI) / 180) < 1e-12);
  assert.ok(Math.abs(limits.maxPolarAngle - (75 * Math.PI) / 180) < 1e-12);
  assert.equal(frame.clampElevation(10), 15);
  assert.equal(frame.clampElevation(90), 75);
  assert.equal(frame.clampElevation(null), 20);
  assert.equal(frame.clampElevation(20), 20);
});

test('pure modules do not import three and the page points at the pinned build', async function () {
  const { model } = await loaded();
  assert.doesNotMatch(read('site/viewer3d/scene-model.js'), /from\s+['"]three/);
  assert.doesNotMatch(read('site/viewer3d/frame.js'), /from\s+['"]three/);
  const page = read('site/viewer3d/index.html');
  assert.match(page, /https:\/\/unpkg\.com\/three@0\.170\.0\/build\/three\.module\.js/);
  assert.equal(model.THREE_MODULE_URL, 'https://unpkg.com/three@0.170.0/build/three.module.js');
  assert.match(page, /three\/addons\//);
  assert.match(page, /WebGL is not available/);
  assert.match(page, /href="\.\.\/viewer\/"/);
  assert.match(page, /<nav>[\s\S]*href="\.\.\/viewer\/"/);
  assert.equal(model.FALLBACK.heading, 'WebGL is not available');
  assert.equal(model.FALLBACK.href, '../viewer/');
  assert.equal(model.FALLBACK.link, 'Open the SVG system view');
  const client = read('site/viewer3d/viewer3d.js');
  assert.match(client, /OrbitControls/);
  assert.match(client, /webgl/i);
  assert.match(client, /showFallback/);
  assert.match(client, /getContext/);
  assert.doesNotMatch(client, /import\s+[^;]*from\s+['"]three['"]/);
  assert.match(read('site/index.html'), /viewer3d\//);
  assert.match(read('site/index.html'), /3D view/);
  assert.match(read('site/viewer3d/viewer3d.css'), /70vh/);
});

test('system scene names Tau Ceti bodies and keeps schematic spacing wider than linear', async function () {
  const bag = await loaded();
  const scene = bag.model.buildScene(bag.system, bag.view);
  assert.equal(scene.star.name, 'Tau Ceti');
  assert.equal(scene.star.spectype, 'G8V');
  assert.equal(scene.star.color, '#ffe0a0');
  assert.equal(scene.star.radius, 0.7);
  assert.equal(scene.frame, 'system');
  assert.equal(scene.focusId, null);
  assert.equal(scene.theme, 'empire');
  assert.equal(scene.distanceMode, 'schematic');
  assert.equal(scene.camera.distance, 28);
  assert.match(scene.epochLabel, /T\+0/);
  const names = scene.bodies.map(function (body) { return body.name; });
  ['Gane', 'Hornstooth', 'Husk', 'Sable', 'Kakakiko', 'Croquet Ball', 'Cue Ball', 'Eight Ball'].forEach(function (name) {
    assert.ok(names.indexOf(name) >= 0, name);
  });
  assert.ok(names.indexOf('Jumpgate') >= 0);
  assert.doesNotMatch(scene.star.name, /proposed/i);
  assert.notEqual(scene.star.name, 'TBD');
  scene.bodies.forEach(function (body) {
    assert.doesNotMatch(body.name, /proposed/i);
    assert.notEqual(body.name, 'TBD');
    assert.ok(Number.isFinite(body.radius) && body.radius > 0, body.id);
    assert.ok(body.radius < scene.star.radius, body.id);
    assert.equal(body.position.y, 0);
  });
  const cue = scene.bodies.find(function (body) { return body.id === 'tc7'; });
  const croquet = scene.bodies.find(function (body) { return body.id === 'tc6'; });
  assert.equal(cue.rings, true);
  assert.equal(croquet.stripes, true);
  assert.equal(scene.orbits.length, 8);
  assert.equal(scene.orbits.some(function (orbit) { return orbit.id === 'tc6gate'; }), false);
  scene.orbits.forEach(function (orbit) {
    assert.equal(orbit.points.length, 96);
    orbit.points.forEach(function (point) { assert.equal(point.y, 0); });
  });
  assert.ok(scene.habitable);
  assert.equal(scene.habitable.innerAu, 0.68);
  assert.equal(scene.habitable.outerAu, 1.22);
  assert.ok(scene.habitable.innerR < scene.habitable.outerR);
  assert.equal(scene.transfers.length, 1);
  assert.equal(scene.transfers[0].id, 'hohmann');
  assert.equal(scene.transfers[0].from, 'tc5');
  assert.equal(scene.transfers[0].to, 'tc6');
  assert.ok(Math.abs(scene.transfers[0].days - 481) < 1, String(scene.transfers[0].days));
  assert.ok(scene.transfers[0].points.length >= 24);
  const from = scene.bodies.find(function (body) { return body.id === 'tc5'; });
  const to = scene.bodies.find(function (body) { return body.id === 'tc6'; });
  const hop = scene.transfers[0].points;
  const transfer = scene.transfers[0];
  hop.forEach(function (point) { assert.equal(point.y, 0); });
  const startR = Math.hypot(hop[0].x, hop[0].z);
  const endR = Math.hypot(hop[hop.length - 1].x, hop[hop.length - 1].z);
  assert.ok(Math.abs(startR - transfer.r1) < 1e-6, String(startR));
  assert.ok(Math.abs(endR - transfer.r2) < 1e-6, String(endR));
  const span = wrappedDelta(orbitalAngle(hop[0]), orbitalAngle(hop[hop.length - 1]));
  assert.ok(Math.abs(Math.abs(span) - Math.PI) < 1e-6, String(span));
  assert.ok(Math.hypot(hop[0].x - hop[hop.length - 1].x, hop[0].z - hop[hop.length - 1].z) > 1);
  const low = Math.min(transfer.r1, transfer.r2) - 1e-6;
  const high = Math.max(transfer.r1, transfer.r2) + 1e-6;
  hop.forEach(function (point) {
    const radius = Math.hypot(point.x, point.z);
    assert.ok(radius >= low && radius <= high, String(radius));
  });
  assert.ok(tangentCos(hop[0], hop[1]) < 0.08);
  assert.ok(tangentCos(hop[hop.length - 1], hop[hop.length - 2]) < 0.08);
  const startGap = wrappedDelta(orbitalAngle(from.position), orbitalAngle(hop[0]));
  assert.ok(Math.abs(startGap) < 1e-4, String(startGap));
  const endGap = Math.hypot(hop[hop.length - 1].x - to.position.x, hop[hop.length - 1].z - to.position.z);
  assert.ok(endGap > 0.5, String(endGap));
  assert.ok(Math.abs(transfer.r2 - Math.hypot(to.position.x, to.position.z)) < 1e-6);
  const order = ['tc1', 'tc2', 'tc3', 'tc4', 'tc5', 'tc6', 'tc7', 'tc8'];
  let prev = 0;
  order.forEach(function (id) {
    const radius = sceneRadius(scene, id);
    assert.ok(radius > prev, id + ' ' + radius);
    prev = radius;
  });
  const linear = bag.model.buildScene(bag.system, bag.view, { distance_mode: 'linear' });
  const ratioS = sceneRadius(scene, 'tc1') / sceneRadius(scene, 'tc8');
  const ratioL = sceneRadius(linear, 'tc1') / sceneRadius(linear, 'tc8');
  assert.ok(ratioS > ratioL, ratioS + ' vs ' + ratioL);
  assert.equal(linear.distanceMode, 'linear');
  assert.equal(bag.model.buildScene(bag.system, bag.view, { distance_mode: 'true' }).distanceMode, 'linear');
  assert.equal(bag.model.buildScene(bag.system, bag.view, { distance_mode: 'log' }).distanceMode, 'schematic');
  const mardat = bag.model.buildScene(bag.system, Object.assign({}, bag.view, { theme: 'mardat' }));
  assert.equal(mardat.star.color, '#ffcf6e');
  assert.equal(mardat.theme, 'mardat');
  const quiet = JSON.parse(JSON.stringify(bag.view));
  quiet.layers.orbits = false;
  const bare = bag.model.buildScene(bag.system, quiet);
  assert.deepEqual(bare.orbits, []);
  assert.equal(bag.view.layers.orbits, true);
  assert.ok(sceneRadius(scene, 'tc1') < sceneRadius(scene, 'tc8'));
});

test('close frame puts Kakakiko at the origin and Shudder inside Der', async function () {
  const bag = await loaded();
  const close = bag.model.buildScene(bag.system, bag.view, { frame: 'tc5' });
  assert.equal(close.frame, 'tc5');
  assert.equal(close.focusId, 'tc5');
  assert.equal(close.star, null);
  assert.equal(close.camera.distance, 18);
  const focus = close.bodies.find(function (body) { return body.id === 'tc5'; });
  assert.ok(focus);
  assert.ok(Math.hypot(focus.position.x, focus.position.y, focus.position.z) < 1e-9);
  ['Shudder', 'Der Eindringling', 'Haven', 'Yard', 'Watch station'].forEach(function (name) {
    assert.ok(close.bodies.some(function (body) { return body.name === name; }), name);
  });
  const shudder = close.bodies.find(function (body) { return body.id === 'tc5a'; });
  const der = close.bodies.find(function (body) { return body.id === 'tc5b'; });
  const shudderR = Math.hypot(shudder.position.x, shudder.position.z);
  const derR = Math.hypot(der.position.x, der.position.z);
  assert.ok(shudderR > 1e-6, String(shudderR));
  assert.ok(shudderR < derR, shudderR + ' vs ' + derR);
  close.bodies.forEach(function (body) {
    assert.ok(Number.isFinite(body.radius) && body.radius > 0, body.id);
    assert.equal(body.position.y, 0);
  });
  close.orbits.forEach(function (orbit) {
    orbit.points.forEach(function (point) { assert.equal(point.y, 0); });
  });
});

test('session cards stay at three and do not move the camera', async function () {
  const bag = await loaded();
  const session = bag.model.initialSession(bag.view);
  assert.equal(session.selected, null);
  assert.equal(session.focused, null);
  assert.equal(session.distance, 28);
  assert.equal(session.distance_mode, 'schematic');
  assert.equal(session.elevation_deg, 20);
  let framed = bag.model.frameBody(session, 'tc5');
  assert.equal(framed.focused, 'tc5');
  assert.equal(framed.selected, 'tc5');
  assert.equal(framed.elevation_deg, session.elevation_deg);
  assert.equal(framed.azimuth_deg, session.azimuth_deg);
  assert.equal(framed.distance, session.distance);
  assert.ok(framed.callouts.indexOf('body:tc5') >= 0);
  const picked = bag.model.selectBody(framed, 'tc8');
  assert.equal(picked.focused, 'tc5');
  assert.equal(picked.elevation_deg, framed.elevation_deg);
  assert.equal(picked.azimuth_deg, framed.azimuth_deg);
  assert.equal(picked.distance, framed.distance);
  assert.equal(picked.distance_mode, framed.distance_mode);
  assert.equal(picked.selected, 'tc8');
  const cleared = bag.model.clearSelection(picked);
  assert.equal(cleared.selected, null);
  assert.deepEqual(cleared.callouts, []);
  assert.equal(cleared.focused, 'tc5');
  assert.equal(cleared.elevation_deg, picked.elevation_deg);
  assert.equal(cleared.distance, picked.distance);
  let cards = bag.model.initialSession(bag.view);
  ['a', 'b', 'c', 'd'].forEach(function (id) {
    cards = bag.model.selectBody(cards, id);
  });
  assert.equal(cards.callouts.length, 3);
  assert.equal(cards.callouts.indexOf('body:a'), -1);
  assert.equal(cards.callouts[0], 'body:b');
  assert.equal(cards.selected, 'd');
  assert.equal(cards.elevation_deg, session.elevation_deg);
});

test('readouts quote the lore file and the body numbers', async function () {
  const bag = await loaded();
  const star = bag.model.infoLines(bag.system, 'star').join('\n');
  assert.match(star, /G8V/);
  assert.match(star, /5320/);
  assert.match(star, /Tau Ceti/);
  const kak = bag.model.infoLines(bag.system, 'tc5').join('\n');
  assert.match(kak, /Kakakiko/);
  assert.match(kak, /0\.71/);
  assert.match(kak, /0\.0396/);
  assert.match(bag.model.infoLines(bag.system, 'tc4').join('\n'), /e <= 0\.1/);
  assert.match(bag.model.infoLines(bag.system, 'tc5a').join('\n'), /151060/);
  assert.deepEqual(bag.model.infoLines(bag.system, 'missing'), ['unknown']);
  assert.equal(bag.model.hoverReadout({ a_au: 0.71 }), '0.71 AU');
  assert.equal(bag.model.hoverReadout({ a_km: 151060 }), '151,060 km');
  assert.equal(bag.model.hoverReadout({}), '');
  assert.match(bag.model.pencilNote(), /Tau_Cet_system_v2\.md/);
  assert.match(bag.model.pencilNote(), /not saved/i);
  assert.equal(bag.model.starDisplayColor('G8V'), '#ffe0a0');
  assert.equal(bag.model.starDisplayColor('G2V'), '#fff0c8');
  assert.equal(bag.model.starDisplayColor(undefined), '#ffe0a0');
  assert.equal(bag.model.themeChrome('empire').space.base, '#5a6270');
  assert.equal(bag.model.themeChrome('empire').starStyle, 'soft');
  assert.equal(bag.model.themeChrome('mardat').space.base, '#17143e');
  assert.equal(bag.model.themeChrome('mardat').starStyle, 'fiery');
  assert.equal(bag.model.themeChrome('other').id, 'empire');
});

test('Tau Ceti light is a near-white yellow with a dim ambient fill', async function () {
  const light = await import('../site/viewer3d/light.js');
  assert.equal(light.TAU_CETI_LIGHT_K, 5344);
  assert.ok(light.TAU_CETI_LIGHT_K > 5300 && light.TAU_CETI_LIGHT_K < 5400);
  const color = light.blackbodySrgb(5344);
  ['r', 'g', 'b'].forEach(function (channel) {
    assert.ok(color[channel] >= 0 && color[channel] <= 1, channel);
  });
  assert.ok(color.r >= color.g && color.g > color.b);
  assert.ok(color.r > 0.9, String(color.r));
  assert.ok(color.g > 0.75, String(color.g));
  assert.ok(color.b > 0.6, String(color.b));
  [light.blackbodySrgb(100), light.blackbodySrgb(NaN)].forEach(function (sample) {
    ['r', 'g', 'b'].forEach(function (channel) {
      assert.ok(Number.isFinite(sample[channel]), channel);
      assert.ok(sample[channel] >= 0 && sample[channel] <= 1, channel);
    });
  });
  assert.deepEqual(light.keyLightViewOffset(), { x: -1, y: 1, z: 1 });
  assert.ok(light.LIGHTING.ambient > 0 && light.LIGHTING.ambient <= 0.35);
  assert.equal(light.LIGHTING.pointDistance, 0);
  assert.equal(light.LIGHTING.pointDecay, 2);
  assert.ok(light.LIGHTING.keyIntensity > light.pointLightLuminance(1.6) * 3);
  const stops = light.starGlowStops();
  assert.equal(stops[0].rgba[3], 1);
  assert.equal(stops[stops.length - 1].rgba[3], 0);
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].t > stops[i - 1].t);
});

test('star glow disc stays clear of every schematic planet', async function () {
  const bag = await loaded();
  const light = await import('../site/viewer3d/light.js');
  const scene = bag.model.buildScene(bag.system, bag.view);
  const gane = scene.bodies.find(function (body) { return body.id === 'tc1'; });
  assert.equal(gane.name, 'Gane');
  // Sprite scale is the full width of a camera-facing quad. three.js keeps one
  // view-space depth for every fragment, so a quad that reaches a planet cuts
  // a hard circle into it. The visible disc is the inscribed circle.
  const glowRadius = light.LIGHTING.glowScale / 2;
  assert.ok(glowRadius > scene.star.radius, 'glow radius ' + glowRadius + ' star ' + scene.star.radius);
  scene.bodies.forEach(function (body) {
    const distance = Math.hypot(body.position.x, body.position.y || 0, body.position.z);
    const clearance = distance - body.radius;
    assert.ok(glowRadius < clearance, body.name + ' clearance ' + clearance + ' glow ' + glowRadius);
  });
  const client = read('site/viewer3d/viewer3d.js');
  const glowAt = client.indexOf('new THREE.Sprite');
  const glowBlock = client.slice(glowAt, client.indexOf('glow.scale', glowAt));
  assert.match(glowBlock, /depthWrite:\s*false/);
  assert.match(glowBlock, /depthTest:\s*true/);
  assert.match(glowBlock, /AdditiveBlending/);
});

test('hohmann arc is an open half-ellipse with the focus at the origin', async function () {
  const arcMod = await import('../site/viewer3d/transfer-arc.js');
  const arc = arcMod.hohmannArc(4, 9, 0.3, 64);
  assert.equal(arc.a, (4 + 9) / 2);
  assert.equal(arc.e, Math.abs(9 - 4) / (4 + 9));
  const points = arc.points;
  assert.equal(points.length, 65);
  assert.ok(Math.abs(Math.hypot(points[0].x, points[0].z) - 4) < 1e-6);
  assert.ok(Math.abs(Math.hypot(points[points.length - 1].x, points[points.length - 1].z) - 9) < 1e-6);
  const span = wrappedDelta(orbitalAngle(points[0]), orbitalAngle(points[points.length - 1]));
  assert.ok(Math.abs(Math.abs(span) - Math.PI) < 1e-6, String(span));
  points.forEach(function (point) {
    assert.equal(point.y, 0);
    const radius = Math.hypot(point.x, point.z);
    assert.ok(radius >= 4 - 1e-6 && radius <= 9 + 1e-6, String(radius));
  });
  const separation = Math.hypot(points[0].x - points[points.length - 1].x, points[0].z - points[points.length - 1].z);
  assert.ok(separation > 1, String(separation));
  assert.ok(tangentCos(points[0], points[1]) < 0.08);
  assert.ok(tangentCos(points[points.length - 1], points[points.length - 2]) < 0.08);
  const mid = points[32];
  assert.ok(Math.abs(Math.hypot(mid.x, mid.z) - arc.a * (1 - arc.e * arc.e)) < 1e-6);
  const inward = arcMod.hohmannArc(9, 4, 0, 64);
  const inwardPoints = inward.points;
  assert.ok(Math.abs(Math.hypot(inwardPoints[0].x, inwardPoints[0].z) - 9) < 1e-6);
  assert.ok(Math.abs(Math.hypot(inwardPoints[inwardPoints.length - 1].x, inwardPoints[inwardPoints.length - 1].z) - 4) < 1e-6);
  const inwardSpan = wrappedDelta(orbitalAngle(inwardPoints[0]), orbitalAngle(inwardPoints[inwardPoints.length - 1]));
  assert.ok(Math.abs(Math.abs(inwardSpan) - Math.PI) < 1e-6, String(inwardSpan));
  inwardPoints.forEach(function (point) {
    const radius = Math.hypot(point.x, point.z);
    assert.ok(radius >= 4 - 1e-6 && radius <= 9 + 1e-6, String(radius));
  });
});

function offsetFromSegment(a, b, distance) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const midX = (a.x + b.x) / 2;
  const midZ = (a.z + b.z) / 2;
  return {
    x: midX + (-dz / len) * distance,
    y: ((a.y || 0) + (b.y || 0)) / 2,
    z: midZ + (dx / len) * distance
  };
}

test('picking the transfer arc returns its details and corner slots replace the oldest', async function () {
  const bag = await loaded();
  const scene = bag.model.buildScene(bag.system, bag.view);
  const hop = scene.transfers[0];
  assert.equal(bag.model.TRANSFER_LINE_THRESHOLD, 0.2);
  assert.ok(bag.model.TRANSFER_HIT_RADIUS >= 0.9);
  assert.ok(bag.model.TRANSFER_HIT_RADIUS < 1.25);
  assert.equal(bag.model.transferHitRadiusAt(bag.model.TRANSFER_HIT_REF_DISTANCE), bag.model.TRANSFER_HIT_RADIUS);
  assert.equal(bag.model.transferHitRadiusAt(10), bag.model.TRANSFER_HIT_RADIUS);
  assert.ok(bag.model.transferHitRadiusAt(bag.model.TRANSFER_HIT_REF_DISTANCE * 2) > bag.model.TRANSFER_HIT_RADIUS);
  assert.equal(bag.model.transferHitRadiusAt(400), bag.model.TRANSFER_HIT_RADIUS_CAP);
  assert.ok(bag.model.TRANSFER_HIT_RADIUS_CAP > bag.model.TRANSFER_HIT_RADIUS);
  assert.ok(bag.model.TRANSFER_HIT_RADIUS_CAP <= 1.8);
  const tube = bag.model.transferTubePoints(hop.points);
  assert.ok(tube.length >= 2);
  assert.ok(tube.indexOf(hop.points[0]) < 0);
  assert.ok(tube.indexOf(hop.points[hop.points.length - 1]) < 0);
  const midIndex = Math.floor(hop.points.length / 2);
  const onArc = hop.points[midIndex];
  const hit = bag.model.pickTransferAt(hop, onArc.x, onArc.y || 0, onArc.z);
  assert.equal(hit.kind, 'transfer');
  assert.equal(hit.id, 'hohmann');
  assert.equal(hit.from, 'tc5');
  assert.equal(hit.to, 'tc6');
  assert.equal(hit.days, hop.days);
  assert.equal(hit.dv1_km_s, hop.dv1_km_s);
  assert.equal(hit.dv2_km_s, hop.dv2_km_s);
  const middle = offsetFromSegment(hop.points[midIndex], hop.points[midIndex + 1], 0.3);
  const fat = bag.model.pickTransferAt(hop, middle.x, middle.y, middle.z);
  assert.equal(fat && fat.kind, 'transfer');
  const nearMiss = offsetFromSegment(hop.points[midIndex], hop.points[midIndex + 1], 0.9);
  const nearHit = bag.model.pickTransferAt(hop, nearMiss.x, nearMiss.y, nearMiss.z);
  assert.equal(nearHit && nearHit.kind, 'transfer');
  assert.equal(nearHit && nearHit.from, 'tc5');
  assert.equal(nearHit && nearHit.to, 'tc6');
  const wide = offsetFromSegment(hop.points[midIndex], hop.points[midIndex + 1], 1.2);
  assert.equal(bag.model.pickTransferAt(hop, wide.x, wide.y, wide.z), null);
  const end = offsetFromSegment(hop.points[0], hop.points[1], 0.3);
  assert.equal(bag.model.pickTransferAt(hop, end.x, end.y, end.z), null);
  assert.equal(bag.model.pickTransferAt(hop, end.x, end.y, end.z, bag.model.TRANSFER_HIT_RADIUS_CAP), null);
  assert.equal(bag.model.pickTransferAt(hop, 0, 0, 0), null);
  const lines = bag.model.transferInfoLines(bag.system, hop);
  assert.match(lines.join('\n'), /From Kakakiko/);
  assert.match(lines.join('\n'), /To Croquet Ball/);
  assert.match(lines.join('\n'), new RegExp(Math.round(hop.days) + ' d'));
  assert.match(lines.join('\n'), /Departure delta-v/);
  assert.match(lines.join('\n'), /Arrival delta-v/);
  assert.match(lines.join('\n'), /km\/s/);
  const bare = { id: 'hohmann', from: 'tc5', to: 'tc6', days: 10, points: hop.points };
  const bareLines = bag.model.transferInfoLines(bag.system, bare);
  assert.equal(bareLines.some(function (line) { return line.indexOf('km/s') >= 0; }), false);
  assert.match(bareLines.join('\n'), /10 d/);
  const one = { id: 'hohmann', from: 'tc5', to: 'tc6', days: 10, dv1_km_s: 1.25, points: hop.points };
  const oneLines = bag.model.transferInfoLines(bag.system, one);
  assert.equal(oneLines.filter(function (line) { return line.indexOf('km/s') >= 0; }).length, 1);
  assert.match(oneLines.join('\n'), /1\.3 km\/s/);
  assert.match(bag.model.calloutLines(bag.system, 'transfer:hohmann', scene.transfers).join('\n'), /Croquet Ball/);
  assert.deepEqual(bag.model.calloutLines(bag.system, 'transfer:missing', scene.transfers), ['unknown']);
  let session = bag.model.initialSession(bag.view);
  const camera = {
    elevation_deg: session.elevation_deg,
    azimuth_deg: session.azimuth_deg,
    distance: session.distance,
    distance_mode: session.distance_mode,
    focused: session.focused
  };
  session = bag.model.selectFromPick(session, hit);
  assert.equal(session.selected, 'transfer:hohmann');
  assert.ok(session.callouts.indexOf('transfer:hohmann') >= 0);
  assert.equal(session.elevation_deg, camera.elevation_deg);
  assert.equal(session.azimuth_deg, camera.azimuth_deg);
  assert.equal(session.distance, camera.distance);
  assert.equal(session.distance_mode, camera.distance_mode);
  assert.equal(session.focused, camera.focused);
  const orbit = bag.model.selectFromPick(session, { id: 'tc8' });
  assert.equal(orbit.selected, 'tc8');
  assert.ok(orbit.callouts.indexOf('body:tc8') >= 0);
  assert.ok(orbit.callouts.indexOf('transfer:hohmann') >= 0);
  assert.equal(orbit.focused, session.focused);
  const closed = bag.model.selectFromPick(orbit, hit);
  assert.equal(closed.callouts.indexOf('transfer:hohmann'), -1);
  assert.equal(closed.selected, 'tc8');
  let slots = bag.model.assignCardSlots([], ['body:a', 'body:b', 'body:c'], 'tl');
  assert.equal(slots.length, 3);
  assert.deepEqual(slots.map(function (slot) { return slot.corner; }), ['tr', 'bl', 'br']);
  assert.equal(slots.some(function (slot) { return slot.corner === 'tl'; }), false);
  const replaced = bag.model.assignCardSlots(slots, ['body:b', 'body:c', 'body:d'], 'tl');
  assert.equal(replaced.length, 3);
  assert.equal(replaced.some(function (slot) { return slot.key === 'body:a'; }), false);
  assert.equal(replaced.find(function (slot) { return slot.key === 'body:b'; }).corner, 'bl');
  assert.equal(replaced.find(function (slot) { return slot.key === 'body:c'; }).corner, 'br');
  assert.equal(replaced.find(function (slot) { return slot.key === 'body:d'; }).corner, 'tr');
  assert.equal(replaced.some(function (slot) { return slot.corner === 'tl'; }), false);
  const freed = bag.model.assignCardSlots(replaced, ['body:b', 'body:d'], 'tl');
  assert.equal(freed.length, 2);
  assert.equal(freed.some(function (slot) { return slot.key === 'body:c'; }), false);
  assert.equal(freed.find(function (slot) { return slot.key === 'body:b'; }).corner, 'bl');
  assert.equal(freed.find(function (slot) { return slot.key === 'body:d'; }).corner, 'tr');
  const overflow = bag.model.assignCardSlots([], ['body:a', 'body:b', 'body:c', 'body:d'], 'tl');
  assert.equal(overflow.length, 3);
  assert.equal(overflow.some(function (slot) { return slot.key === 'body:a'; }), false);
  assert.deepEqual(overflow.map(function (slot) { return slot.key; }), ['body:b', 'body:c', 'body:d']);
  const orbitFirst = bag.model.choosePick([
    { kind: 'transfer', id: 'hohmann', from: 'tc5', to: 'tc6' },
    { id: 'tc8', record: { a_au: 1 } }
  ]);
  assert.equal(orbitFirst.id, 'tc8');
  assert.equal(orbitFirst.kind, undefined);
  const onlyArc = bag.model.choosePick([
    { kind: 'transfer', id: 'hohmann', from: 'tc5', to: 'tc6' }
  ]);
  assert.equal(onlyArc.kind, 'transfer');
  assert.equal(bag.model.choosePick([{ id: 'tc5' }, { kind: 'transfer', id: 'hohmann' }]).id, 'tc5');
});

test('viewer3d wires the transfer into the orbit raycaster and the corner cards', function () {
  const client = read('site/viewer3d/viewer3d.js');
  const css = read('site/viewer3d/viewer3d.css');
  assert.match(client, /TRANSFER_LINE_THRESHOLD/);
  assert.match(client, /raycaster\.params\.Line\.threshold = TRANSFER_LINE_THRESHOLD/);
  assert.match(client, /TRANSFER_HIT_RADIUS/);
  assert.match(client, /transferHitRadiusAt/);
  assert.match(client, /cardLinks/);
  assert.doesNotMatch(client, /open\.href = '\.\.\/manual\/'/);
  assert.match(client, /TubeGeometry/);
  assert.match(client, /transferTubePoints/);
  assert.match(client, /transferPickRecord/);
  assert.match(client, /hit\.kind === 'transfer'/);
  assert.match(client, /selectFromPick/);
  assert.match(client, /choosePick/);
  assert.match(client, /assignCardSlots/);
  assert.match(client, /calloutLines/);
  assert.match(client, /pickables\.push\(line\)/);
  assert.equal((client.match(/Line\.threshold\s*=/g) || []).length, 1);
  assert.match(css, /\[data-corner="tr"\]/);
  assert.match(css, /\[data-corner="bl"\]/);
  assert.match(css, /\[data-corner="br"\]/);
  assert.match(css, /#legend \{[^}]*top:\s*0\.75rem/);
  assert.match(css, /#legend \{[^}]*left:\s*0\.75rem/);
  assert.doesNotMatch(css, /#cards \{[^}]*flex-direction:\s*column/);
});

test('viewer3d shades planets and keeps the key light on the camera', async function () {
  const client = read('site/viewer3d/viewer3d.js');
  ['MeshStandardMaterial', 'MeshBasicMaterial', 'PointLight', 'DirectionalLight', 'AmbientLight', 'AdditiveBlending', 'Sprite', 'keyLightViewOffset', 'blackbodySrgb'].forEach(function (name) {
    assert.match(client, new RegExp(name));
  });
  assert.doesNotMatch(client, /set\(\s*8\s*,\s*12\s*,\s*6\s*\)/);
  assert.doesNotMatch(read('site/viewer3d/light.js'), /from\s+['"]three/);
  assert.doesNotMatch(read('site/viewer3d/transfer-arc.js'), /from\s+['"]three/);
});

test('viewer3d blocks stuck text selection on the canvas, labels, and legend', function () {
  const css = read('site/viewer3d/viewer3d.css');
  function ruleBody(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
    assert.ok(match, 'missing rule ' + selector);
    return match[1];
  }
  ['#stage canvas', '#labels', '.body-label', '#legend'].forEach(function (selector) {
    const body = ruleBody(selector);
    assert.match(body, /(?:^|[^-])user-select:\s*none/, selector + ' user-select');
    assert.match(body, /-webkit-user-select:\s*none/, selector + ' webkit');
  });
  ['#cards', '#cards .card'].forEach(function (selector) {
    const body = ruleBody(selector);
    assert.doesNotMatch(body, /user-select:\s*none/, selector);
    assert.doesNotMatch(body, /-webkit-user-select:\s*none/, selector);
  });
  const client = read('site/viewer3d/viewer3d.js');
  const down = client.match(/canvas\.addEventListener\('pointerdown', function \(event\) \{([\s\S]*?)\n  \}\);/);
  assert.ok(down, 'canvas pointerdown handler');
  const handler = down[1];
  assert.match(handler, /getSelection/);
  assert.match(handler, /removeAllRanges/);
  assert.match(handler, /if\s*\(/);
  assert.doesNotMatch(handler, /getSelection\(\)\s*\.removeAllRanges\(\)/);
});

function fnv1a(bytes) {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

test('density sets the point count and dustiness sets size, opacity, and color spread', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  assert.equal(sky.DENSITY_MIN, 0);
  assert.equal(sky.DENSITY_MAX, 4);
  assert.equal(sky.DENSITY_DEFAULT, 2);
  assert.deepEqual(sky.DENSITY_COUNTS, [0, 3000, 7000, 14000, 24000]);
  assert.equal(sky.pointCountForDensity(0), 0);
  assert.equal(sky.pointCountForDensity(1), 3000);
  assert.equal(sky.pointCountForDensity(2), 7000);
  assert.equal(sky.pointCountForDensity(3), 14000);
  assert.equal(sky.pointCountForDensity(4), 24000);
  assert.equal(sky.pointCountForDensity(1.2), 3000);
  assert.equal(sky.pointCountForDensity(-3), 0);
  assert.equal(sky.pointCountForDensity(9), 24000);
  assert.equal(sky.pointCountForDensity(NaN), 7000);
  let previous = -1;
  for (let step = 0; step <= 4; step++) {
    const count = sky.pointCountForDensity(step);
    assert.ok(count > previous, String(count));
    previous = count;
    assert.ok(count === 0 || (count >= 1000 && count <= 30000), String(count));
  }
  assert.deepEqual(sky.splitBeltCounts(0), { asteroid: 0, kuiper: 0, total: 0 });
  assert.deepEqual(sky.splitBeltCounts(7000), { asteroid: 4200, kuiper: 2800, total: 7000 });
  assert.deepEqual(sky.splitBeltCounts(1), { asteroid: 1, kuiper: 0, total: 1 });
  assert.deepEqual(sky.splitBeltCounts(NaN), { asteroid: 0, kuiper: 0, total: 0 });
  assert.equal(sky.DUSTINESS_MIN, 0);
  assert.equal(sky.DUSTINESS_MAX, 100);
  assert.equal(sky.DUSTINESS_DEFAULT, 40);
  function expectStyle(dustiness) {
    const t = Math.min(100, Math.max(0, dustiness)) / 100;
    return {
      size: 0.02 + t * 0.12,
      opacity: 0.28 + t * 0.57,
      colorSpread: 0.05 + t * 0.4
    };
  }
  assert.deepEqual(sky.dustinessStyle(0), expectStyle(0));
  assert.deepEqual(sky.dustinessStyle(40), expectStyle(40));
  assert.deepEqual(sky.dustinessStyle(100), expectStyle(100));
  assert.deepEqual(sky.dustinessStyle(NaN), expectStyle(40));
  assert.deepEqual(sky.dustinessStyle(-10), expectStyle(0));
  assert.deepEqual(sky.dustinessStyle(140), expectStyle(100));
  const low = sky.dustinessStyle(0);
  const high = sky.dustinessStyle(100);
  assert.ok(high.size > low.size);
  assert.ok(high.opacity > low.opacity && high.opacity <= 1);
  assert.ok(high.colorSpread > low.colorSpread);
  assert.equal(sky.dustIsPickable(), false);
  assert.equal(sky.BELT_HEIGHT_FRACTION, 0.28);
  assert.equal(sky.beltHalfHeight(6, 8), 0.56);
  assert.equal(sky.beltHalfHeight(5, 5), 0.02);
});

test('dust belt samples are deterministic and stay inside the torus', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  assert.doesNotMatch(read('site/viewer3d/sky.js'), /from\s+['"]three/);
  const spec = {
    innerR: 4,
    outerR: 6,
    halfHeight: 0.5,
    count: 500,
    seed: sky.SKY_SEED
  };
  const first = sky.generateBeltSamples(spec);
  const second = sky.generateBeltSamples(spec);
  assert.equal(first.count, 500);
  assert.equal(first.positions.length, 1500);
  assert.equal(first.palette.length, 500);
  assert.equal(first.jitter.length, 500);
  assert.deepEqual(first.positions, second.positions);
  assert.deepEqual(first.palette, second.palette);
  assert.deepEqual(first.jitter, second.jitter);
  const other = sky.generateBeltSamples(Object.assign({}, spec, { seed: sky.SKY_SEED + 1 }));
  assert.notDeepEqual(first.positions, other.positions);
  let posX = 0;
  let negX = 0;
  let posZ = 0;
  let negZ = 0;
  for (let i = 0; i < first.count; i++) {
    const x = first.positions[i * 3];
    const y = first.positions[i * 3 + 1];
    const z = first.positions[i * 3 + 2];
    const radius = Math.hypot(x, z);
    assert.ok(radius >= 4 - 1e-6 && radius <= 6 + 1e-6, String(radius));
    assert.ok(Math.abs(y) <= 0.5 + 1e-6, String(y));
    assert.ok(first.jitter[i] >= -1 && first.jitter[i] <= 1);
    if (x > 0) posX += 1;
    if (x < 0) negX += 1;
    if (z > 0) posZ += 1;
    if (z < 0) negZ += 1;
  }
  assert.ok(posX > 0 && negX > 0 && posZ > 0 && negZ > 0);
  const swapped = sky.generateBeltSamples({ innerR: 6, outerR: 4, halfHeight: 0.2, count: 40, seed: 3 });
  for (let i = 0; i < swapped.count; i++) {
    const radius = Math.hypot(swapped.positions[i * 3], swapped.positions[i * 3 + 2]);
    assert.ok(radius >= 4 - 1e-6 && radius <= 6 + 1e-6, String(radius));
  }
  const empty = sky.generateBeltSamples({ innerR: 1, outerR: 2, halfHeight: 0.2, count: 0, seed: 1 });
  assert.equal(empty.count, 0);
  assert.equal(empty.positions.length, 0);
  const flat = new Float32Array(3);
  const flatJitter = new Float32Array(3);
  sky.writeBeltColors(0, 0, 0, flat, 0);
  sky.writeBeltColors(0, 0.8, 0, flatJitter, 0);
  assert.deepEqual(flat, flatJitter);
  const otherBase = new Float32Array(3);
  sky.writeBeltColors(1, 0, 0, otherBase, 0);
  assert.notDeepEqual(flat, otherBase);
  const wild = new Float32Array(3);
  sky.writeBeltColors(0, 1, 5, wild, 0);
  wild.forEach(function (channel) {
    assert.ok(channel >= 0 && channel <= 1);
  });
  const bands = sky.dustBands([
    { id: 'b1', name: 'The Sombrero', innerAu: 1.1, outerAu: 1.6, innerR: 8, outerR: 7 },
    { id: 'b2', name: 'Outer Wall', innerAu: 10, outerAu: 50, innerR: 12, outerR: 14 },
    { id: 'other', innerR: 1, outerR: 2 }
  ]);
  assert.equal(bands.length, 2);
  assert.equal(bands[0].id, 'b1');
  assert.equal(bands[0].innerR, 7);
  assert.equal(bands[0].outerR, 8);
  assert.equal(bands[0].seed, sky.beltSeed('b1'));
  assert.equal(bands[1].id, 'b2');
  assert.equal(bands[1].seed, sky.beltSeed('b2'));
  assert.ok(bands[0].halfHeight > 0);
  assert.deepEqual(sky.dustBands([{ id: 'b1' }]), []);
  assert.notEqual(sky.beltSeed('b1'), sky.beltSeed('b2'));
});

test('Tau Ceti dust radii sit between the neighboring orbits', async function () {
  const bag = await loaded();
  const sky = await import('../site/viewer3d/sky.js');
  function check(mode) {
    const scene = bag.model.buildScene(bag.system, bag.view, { distance_mode: mode });
    const belts = sky.dustBands(scene.belts);
    assert.equal(belts.length, 2, mode);
    const asteroid = belts[0];
    const kuiper = belts[1];
    assert.equal(asteroid.id, 'b1');
    assert.equal(asteroid.name, 'The Sombrero');
    assert.equal(asteroid.innerAu, 1.1);
    assert.equal(asteroid.outerAu, 1.6);
    assert.equal(kuiper.id, 'b2');
    assert.equal(kuiper.name, 'Outer Wall');
    assert.equal(kuiper.innerAu, 10);
    assert.equal(kuiper.outerAu, 50);
    assert.ok(asteroid.innerR > sceneRadius(scene, 'tc5'), mode + ' tc5 ' + sceneRadius(scene, 'tc5'));
    assert.ok(asteroid.outerR < sceneRadius(scene, 'tc6'), mode + ' tc6 ' + sceneRadius(scene, 'tc6'));
    assert.ok(kuiper.innerR > sceneRadius(scene, 'tc8'), mode + ' tc8 ' + sceneRadius(scene, 'tc8'));
    assert.ok(kuiper.outerR > kuiper.innerR);
    scene.bodies.forEach(function (body) {
      const radius = Math.hypot(body.position.x, body.position.z);
      const inAsteroid = radius > asteroid.innerR && radius < asteroid.outerR;
      const inKuiper = radius > kuiper.innerR && radius < kuiper.outerR;
      assert.equal(inAsteroid, false, body.id + ' asteroid ' + mode);
      assert.equal(inKuiper, false, body.id + ' kuiper ' + mode);
    });
    const split = sky.splitBeltCounts(sky.pointCountForDensity(sky.DENSITY_DEFAULT));
    [asteroid, kuiper].forEach(function (band) {
      const count = band.id === 'b2' ? split.kuiper : split.asteroid;
      const samples = sky.generateBeltSamples({
        innerR: band.innerR,
        outerR: band.outerR,
        halfHeight: band.halfHeight,
        count: count,
        seed: band.seed
      });
      assert.equal(samples.count, count);
      for (let i = 0; i < samples.count; i++) {
        const x = samples.positions[i * 3];
        const y = samples.positions[i * 3 + 1];
        const z = samples.positions[i * 3 + 2];
        const radius = Math.hypot(x, z);
        assert.ok(radius >= band.innerR - 1e-6 && radius <= band.outerR + 1e-6, band.id + ' ' + radius);
        assert.ok(Math.abs(y) <= band.halfHeight + 1e-6, band.id + ' y ' + y);
      }
    });
  }
  check('schematic');
  check('linear');
  const close = bag.model.buildScene(bag.system, bag.view, { frame: 'tc5' });
  assert.equal(close.belts.length, 0);
  assert.equal(sky.dustBands(close.belts).length, 0);
});

test('starfield background is a seeded equirectangular 2:1 texture', async function () {
  const sky = await import('../site/viewer3d/sky.js');
  const spec = sky.starfieldSpec();
  assert.equal(spec.width, 1024);
  assert.equal(spec.height, 512);
  assert.equal(spec.width, spec.height * 2);
  assert.equal(spec.seed, sky.SKY_SEED);
  assert.equal(sky.SKY_SEED, 20261017);
  assert.equal(spec.mapping, 'EquirectangularReflectionMapping');
  const record = sky.backgroundRecord(spec.width, spec.height);
  assert.equal(record.width, 1024);
  assert.equal(record.height, 512);
  assert.equal(record.aspect, 2);
  assert.equal(record.mapping, 'EquirectangularReflectionMapping');
  assert.throws(function () { sky.backgroundRecord(100, 100); });
  assert.throws(function () { sky.backgroundRecord(3, 2); });
  const pixels = sky.starfieldRgba(spec.width, spec.height, spec.seed);
  const again = sky.starfieldRgba(spec.width, spec.height, spec.seed);
  assert.equal(pixels.length, spec.width * spec.height * 4);
  assert.equal(fnv1a(pixels), fnv1a(again));
  const other = sky.starfieldRgba(spec.width, spec.height, spec.seed + 1);
  assert.notEqual(fnv1a(pixels), fnv1a(other));
  assert.equal(pixels[3], 255);
  let dark = 0;
  let bright = 0;
  let tinted = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(pixels[i + 3], 255);
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const mag = r > g ? r : g;
    const peak = mag > b ? mag : b;
    if (peak < 12) dark += 1;
    else {
      bright += 1;
      if (Math.abs(r - b) > 8) tinted += 1;
    }
  }
  assert.ok(dark > bright * 20, 'dark ' + dark + ' bright ' + bright);
  assert.ok(bright > 400, String(bright));
  assert.ok(tinted > 80, String(tinted));
});

test('viewer3d mounts the starfield and keeps dust out of the raycaster', function () {
  const client = read('site/viewer3d/viewer3d.js');
  const page = read('site/viewer3d/index.html');
  assert.doesNotMatch(page, /id="dust-density"/);
  assert.doesNotMatch(page, /id="dust-dustiness"/);
  assert.match(page, /The Sombrero/);
  assert.match(page, /Outer Wall/);
  assert.match(page, /id="belt-b1-density"[^>]*min="0"/);
  assert.match(page, /id="belt-b1-density"[^>]*max="4"/);
  assert.match(page, /id="belt-b1-density"[^>]*value="2"/);
  assert.match(page, /id="belt-b2-density"[^>]*value="2"/);
  assert.match(page, /id="belt-b1-dustiness"[^>]*min="0"/);
  assert.match(page, /id="belt-b1-dustiness"[^>]*max="100"/);
  assert.match(page, /id="belt-b1-dustiness"[^>]*value="40"/);
  assert.match(page, /id="belt-b2-dustiness"[^>]*value="40"/);
  assert.match(client, /starfieldSpec/);
  assert.match(client, /starfieldRgba/);
  assert.match(client, /backgroundRecord/);
  assert.match(client, /function ensureStarfield/);
  assert.match(client, /scene\.background\s*=\s*ensureStarfield\(THREE\)/);
  assert.match(client, /THREE\[record\.mapping\]/);
  assert.match(client, /minFilter\s*=\s*THREE\.LinearFilter/);
  assert.match(client, /magFilter\s*=\s*THREE\.LinearFilter/);
  assert.match(client, /generateMipmaps\s*=\s*false/);
  assert.doesNotMatch(client, /scene\.background\s*=\s*new THREE\.Color/);
  assert.match(client, /function mountDustBelts/);
  assert.match(client, /function applyDustiness/);
  assert.match(client, /function emptyRaycast\(\) \{\s*\}/);
  assert.match(client, /from '\.\/ring-belt\.js'/);
  assert.match(client, /ringBeltsFromBands/);
  assert.match(client, /withDensity/);
  assert.match(client, /withDustiness/);
  assert.match(client, /updateRingBeltFrame/);
  assert.match(client, /sizeAttenuation:\s*true/);
  assert.match(client, /getElementById\('belt-b1-density'\)/);
  assert.match(client, /getElementById\('belt-b2-density'\)/);
  assert.match(client, /getElementById\('belt-b1-dustiness'\)/);
  assert.match(client, /getElementById\('belt-b2-dustiness'\)/);
  const mount = client.match(/function mountDustBelts\([\s\S]*?\n\}/);
  assert.ok(mount, 'mountDustBelts');
  assert.match(mount[0], /emptyRaycast/);
  assert.match(mount[0], /pickable = false/);
  assert.doesNotMatch(mount[0], /pickables/);
  assert.doesNotMatch(mount[0], /userData\.id/);
});
