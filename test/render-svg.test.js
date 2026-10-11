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

function elementById(svg, id) {
  const match = svg.match(new RegExp('<[a-zA-Z0-9]+\\b[^>]*\\bid="' + id + '"[^>]*>'));
  assert.ok(match, 'missing #' + id);
  return match[0];
}

function attr(tag, name) {
  const match = tag.match(new RegExp('\\b' + name + '="([^"]*)"'));
  assert.ok(match, name + ' on ' + tag.slice(0, 80));
  return match[1];
}

async function loaded() {
  const schema = await import('../site/js/schema.js');
  const draw = await import('../site/js/render-svg.js');
  const system = schema.loadSystem(readJson('site/data/tau-ceti.system.json'));
  const view = schema.loadView(readJson('site/data/tau-ceti.view.json'));
  const empire = readJson('site/themes/empire.json');
  const quiet = readJson('site/themes/quiet.json');
  const holo = readJson('site/themes/holo.json');
  return { draw: draw, system: system, view: view, empire: empire, quiet: quiet, holo: holo };
}

test('project keeps +X on the right and lifts +Y by sin(elevation)', async function () {
  const { project } = await import('../site/js/render-svg.js');
  const cam = { cx: 100, cy: 200, scale: 10, elevation_deg: 20, azimuth_deg: 0 };
  const onX = project(1, 0, cam);
  assert.ok(Math.abs(onX.sx - 110) < 1e-9, String(onX.sx));
  assert.ok(Math.abs(onX.sy - 200) < 1e-9, String(onX.sy));
  const onY = project(0, 1, cam);
  const lifted = 200 - 10 * Math.sin((20 * Math.PI) / 180);
  assert.ok(Math.abs(onY.sx - 100) < 1e-9, String(onY.sx));
  assert.ok(Math.abs(onY.sy - lifted) < 1e-9, String(onY.sy));
  const turned = project(1, 0, { cx: 0, cy: 0, scale: 1, elevation_deg: 90, azimuth_deg: 90 });
  assert.ok(Math.abs(turned.sx) < 1e-9, String(turned.sx));
  assert.ok(Math.abs(turned.sy - 1) < 1e-9, String(turned.sy));
});

test('quiet svg names Tau Ceti and skips holo filters', async function () {
  const bag = await loaded();
  const svg = bag.draw.renderSvg(bag.system, bag.view, bag.empire, bag.quiet);
  assert.match(svg, /Tau Ceti/);
  assert.doesNotMatch(svg, /feGaussianBlur/);
  assert.doesNotMatch(svg, /feDropShadow/);
  assert.doesNotMatch(svg, /scan-pattern/);
  assert.doesNotMatch(svg, /id="scan"/);
  assert.match(svg, /#070b10/);
  assert.match(svg, /<text\b[^>]*>Eight Ball<\/text>/);
  assert.match(svg, /<text\b[^>]*>Croquet Ball<\/text>/);
  assert.doesNotMatch(svg, /proposed/i);
  assert.doesNotMatch(svg, /TBD/);
  assert.match(svg, /e ≤ 0\.1/);
  const star = elementById(svg, 'star');
  const name = elementById(svg, 'star-name');
  const gap = Math.hypot(Number(attr(name, 'x')) - Number(attr(star, 'cx')), Number(attr(name, 'y')) - Number(attr(star, 'cy')));
  assert.ok(gap > Number(attr(star, 'r')), String(gap));
  const rings = svg.match(/<ellipse\b[^>]*\bdata-role="orbit"[^>]*>/g) || [];
  assert.ok(rings.length >= 5, 'orbits ' + rings.length);
  const ratio = Math.sin((20 * Math.PI) / 180);
  rings.forEach(function (ring) {
    const rx = Number(attr(ring, 'rx'));
    const ry = Number(attr(ring, 'ry'));
    assert.ok(rx > 0 && Math.abs(ry / rx - ratio) < 0.01, ry + '/' + rx);
  });
  assert.match(svg, /0\.71 AU/);
  assert.match(svg, /2\.8 AU/);
  const kepler = await import('../site/js/kepler.js');
  const hop = kepler.hohmannDays(0.71, 2.8, 0.78);
  assert.match(svg, new RegExp(hop.days.toFixed(0) + ' d'));
});

test('a theme accent is read from the theme object', async function () {
  const bag = await loaded();
  const themed = Object.assign({}, bag.empire, { accent: '#123456' });
  const svg = bag.draw.renderSvg(bag.system, bag.view, themed, bag.quiet);
  assert.match(svg, /#123456/);
  assert.doesNotMatch(svg, /feGaussianBlur/);
});

test('holo chrome draws a scan pattern and the quiet plate does not', async function () {
  const bag = await loaded();
  const holo = bag.draw.renderSvg(bag.system, bag.view, bag.empire, bag.holo);
  assert.match(holo, /id="scan-pattern"/);
  assert.match(holo, /Tau Ceti/);
  const quietPlate = read('site/viewer/plates/quiet-empire-system.svg');
  const holoPlate = read('site/viewer/plates/holo-empire-system.svg');
  assert.match(quietPlate, /Tau Ceti/);
  assert.doesNotMatch(quietPlate, /feGaussianBlur|feDropShadow|scan-pattern/);
  assert.match(holoPlate, /id="scan-pattern"/);
  assert.match(read('site/viewer/plates/index.html'), /quiet-empire-system\.svg/);
  assert.match(read('site/viewer/plates/index.html'), /holo-empire-system\.svg/);
});

test('Kakakiko close-up uses the synchronous ring, not moon Lagrange stations', async function () {
  const bag = await loaded();
  const svg = bag.draw.renderSvg(bag.system, bag.view, bag.empire, bag.quiet, { frame: 'tc5' });
  assert.match(svg, /Shudder/);
  assert.match(svg, /Der Eindringling/);
  assert.match(svg, /Haven/);
  assert.match(svg, /Yard/);
  assert.match(svg, /Watch/);
  assert.match(svg, /120848|120,848/);
  assert.match(svg, /54076|54,076/);
  assert.doesNotMatch(svg, /L4 Yard|L5 Haven|L3 Watch/);
  const rings = svg.match(/<ellipse\b[^>]*\bdata-role="orbit"[^>]*>/g) || [];
  const ratio = Math.sin((20 * Math.PI) / 180);
  rings.forEach(function (ring) {
    const rx = Number(attr(ring, 'rx'));
    const ry = Number(attr(ring, 'ry'));
    assert.ok(Math.abs(ry / rx - ratio) < 0.01, ry + '/' + rx);
  });
});

test('home page points at the viewer and the page does not embed the fixture', function () {
  const home = read('site/index.html');
  assert.match(home, /View Tau Ceti/);
  assert.match(home, /href="viewer\/"/);
  const page = read('site/viewer/index.html');
  assert.match(page, /type="module"/);
  assert.match(page, /paused/i);
  assert.doesNotMatch(page, /151060/);
  assert.doesNotMatch(page, /8131|8130|127\.0\.0\.1:8080/);
  const client = read('site/viewer/viewer.js');
  assert.doesNotMatch(client, /8131|8130/);
  assert.match(client, /tau-ceti\.system\.json/);
  const server = read('tools/serve-site.mjs');
  assert.match(server, /8131/);
});

test('star-map link prefers config pages.starroute_map', async function () {
  const shell = await import('../site/js/shell.js');
  assert.equal(shell.starMapHref({
    pages: { starroute_map: 'https://example.test/map' },
    other_page: 'https://example.test/other'
  }), 'https://example.test/map');
  assert.equal(shell.starMapHref({ other_page: 'https://example.test/other' }), 'https://example.test/other');
  assert.equal(shell.starMapHref({}), '');
});
