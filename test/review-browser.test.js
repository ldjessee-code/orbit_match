// Failing browser tests for CODE_REVIEW.md. They drive the real pages in headless
// Edge through the DevTools protocol, using Node built-ins only. They skip when
// Edge is not installed. Each test name starts with its finding id.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/microsoft-edge'
].find(function (file) { return fs.existsSync(file); });
const PORT = 8144;
const DEBUG_PORT = 9344;
const BASE = 'http://127.0.0.1:' + PORT;
const STORE = 'orbit-match-manual';
const LONG = { timeout: 60000, skip: EDGE ? false : 'Edge is not installed' };

const sleep = function (ms) { return new Promise(function (done) { setTimeout(done, ms); }); };

// Records every file the page saves, and every native dialog it opens.
const SPY = `
window.__saved = [];
window.__links = [];
window.__draws = 0;
(function () {
  const make = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) { window.__saved.push(blob); return make(blob); };
  HTMLAnchorElement.prototype.click = function () {
    window.__links.push({ download: this.download, connected: this.isConnected });
  };
  ['WebGLRenderingContext', 'WebGL2RenderingContext'].forEach(function (name) {
    const proto = window[name] && window[name].prototype;
    if (!proto) return;
    ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'].forEach(function (method) {
      const real = proto[method];
      if (!real) return;
      proto[method] = function () { window.__draws += 1; return real.apply(this, arguments); };
    });
  });
})();`;

let edge;
let server;
let profile;
let page;

async function openTab() {
  const response = await fetch('http://127.0.0.1:' + DEBUG_PORT + '/json/new?about:blank', { method: 'PUT' });
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function (done) { socket.onopen = done; });
  let next = 0;
  const waiting = new Map();
  const tab = { dialogs: [], requests: [], responses: [] };
  const send = function (method, params) {
    return new Promise(function (done) {
      next += 1;
      waiting.set(next, done);
      socket.send(JSON.stringify({ id: next, method: method, params: params || {} }));
    });
  };
  socket.onmessage = function (message) {
    const data = JSON.parse(message.data);
    if (data.id && waiting.has(data.id)) {
      waiting.get(data.id)(data);
      waiting.delete(data.id);
    } else if (data.method === 'Page.javascriptDialogOpening') {
      tab.dialogs.push(data.params.message);
      send('Page.handleJavaScriptDialog', { accept: true });
    } else if (data.method === 'Network.requestWillBeSent') {
      tab.requests.push(data.params.request.url);
    } else if (data.method === 'Network.responseReceived') {
      tab.responses.push({ url: data.params.response.url, status: data.params.response.status });
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('DOM.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SPY });
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  tab.send = send;
  tab.js = async function (expression) {
    const result = await send('Runtime.evaluate', { expression: expression, awaitPromise: true, returnByValue: true });
    if (result.result && result.result.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.exception.description || result.result.exceptionDetails.text);
    }
    return result.result.result.value;
  };
  tab.go = async function (url, wait) {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    await send('Page.navigate', { url: url });
    await sleep(wait || 1500);
  };
  tab.pick = async function (selector, file) {
    const doc = await send('DOM.getDocument');
    const node = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: selector });
    if (!node.result.nodeId) throw new Error('no element for ' + selector);
    await send('DOM.setFileInputFiles', { nodeId: node.result.nodeId, files: [file] });
    await sleep(500);
  };
  tab.block = function (patterns) { return send('Network.setBlockedURLs', { urls: patterns }); };
  // Runs source before each new page until the returned function is called.
  tab.inject = async function (source) {
    const added = await send('Page.addScriptToEvaluateOnNewDocument', { source: source });
    return function () { return send('Page.removeScriptToEvaluateOnNewDocument', { identifier: added.result.identifier }); };
  };
  tab.clickAt = async function (x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x, y: y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
    await sleep(70);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
    await sleep(120);
  };
  return tab;
}

function tempFile(name, text) {
  const file = path.join(profile, name);
  fs.writeFileSync(file, text);
  return file;
}

async function freshBuilder(hash) {
  await page.go(BASE + '/manual/', 400);
  await page.js('localStorage.clear()');
  page.dialogs.length = 0;
  await page.go(BASE + '/manual/' + (hash || ''), 1500);
}

function setField(selector, value) {
  return page.js(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

const TAU_FILE = path.join(root, 'site/data/tau-ceti.system.json');
const promptOpen = "!!document.querySelector('dialog[open], [role=\"dialog\"]:not([hidden]), [role=\"alertdialog\"]:not([hidden])')";

async function prompted() {
  return page.dialogs.length > 0 || await page.js(promptOpen);
}

test.before(async function () {
  if (!EDGE) return;
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-browser-'));
  server = spawn(process.execPath, [path.join(root, 'tools/serve-site.mjs'), String(PORT)], { stdio: 'ignore' });
  edge = spawn(EDGE, [
    '--headless=new', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist',
    '--no-first-run', '--disable-extensions', '--remote-debugging-port=' + DEBUG_PORT,
    '--user-data-dir=' + path.join(profile, 'edge'), 'about:blank'
  ], { stdio: 'ignore' });
  await sleep(3500);
  page = await openTab();
});

test.after(async function () {
  if (edge) edge.kill();
  if (server) server.kill();
  await sleep(500);
  if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  process.exitCode = process.exitCode || 0;
  setTimeout(function () { process.exit(); }, 200).unref();
});

// ---- Critical ----

test('C1: a viewer opens a system file the visitor chooses', LONG, async function () {
  await page.go(BASE + '/viewer/?view=svg', 1500);
  const hasPicker = await page.js("!!document.querySelector('input[type=file]')");
  assert.equal(hasPicker, true, 'the SVG viewer has no file input');
  await page.pick('input[type=file]', path.join(root, 'test/fixtures/made-up-angles.system.json'));
  await sleep(1500);
  assert.match(await page.js("document.getElementById('sky').textContent"), /Made Up/);
});

test('C1: a missing system does not blame the static server', LONG, async function () {
  await page.go(BASE + '/viewer/?view=svg&system=55-cnc', 1500);
  assert.doesNotMatch(await page.js("document.getElementById('load-status').textContent"), /static server/);
});

test('C2: opening Tau Ceti and pressing Save writes back the same data', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  await page.js("document.getElementById('save-system').click()");
  await sleep(400);
  const dialogButton = await page.js("(() => { const box = document.querySelector('dialog[open]'); const b = box && box.querySelector('button'); if (b) b.click(); return !!b; })()");
  if (dialogButton) await sleep(400);
  const saved = await page.js('Promise.all(window.__saved.map(blob => blob.text()))');
  assert.ok(saved.length > 0, 'nothing was saved');
  assert.deepEqual(JSON.parse(saved[saved.length - 1]), JSON.parse(fs.readFileSync(TAU_FILE, 'utf8')));
});

test('C4: a name in a file cannot run script in the builder', LONG, async function () {
  await freshBuilder();
  const evil = '"><img src=x onerror="window.__xss=1">';
  const file = tempFile('evil.system.json', JSON.stringify({ orbit_match: 2, kind: 'system', star: { hostname: 'E' }, bodies: [{ id: 'a', kind: 'planet', name: evil, orbit: { a_au: 1 } }] }));
  await page.pick('#system-file', file);
  await sleep(500);
  assert.notEqual(await page.js('window.__xss'), 1);
});

test('C5: saving over existing data asks about a backup first', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  await setField('[data-body="tc5"] [data-field="name"]', 'Renamed');
  page.dialogs.length = 0;
  await page.js("document.getElementById('save-system').click()");
  await sleep(400);
  assert.equal(await prompted(), true, 'Save wrote the file without asking');
  const text = page.dialogs.join(' ') + await page.js("(document.querySelector('dialog[open]') || {}).textContent || ''");
  assert.match(text, /back\s?up/i);
});

test('C5: opening another file over unsaved work asks first', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  await setField('[data-body="tc5"] [data-field="name"]', 'Unsaved');
  page.dialogs.length = 0;
  await page.pick('#system-file', path.join(root, 'test/fixtures/made-up-angles.system.json'));
  assert.equal(await prompted(), true, 'the unsaved edit was replaced without asking');
});

test('C5: a file that cannot be read leaves the current work alone', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  const future = tempFile('future.system.json', JSON.stringify({ orbit_match: 3, bodies: [] }));
  await page.pick('#system-file', future);
  assert.equal(await page.js("document.querySelectorAll('[data-body]').length"), 16);
  assert.match(await page.js("document.getElementById('status').textContent"), /version|not supported|cannot/i);
});

// ---- High ----

test('H1: stepping the clock does not reload the models', LONG, async function () {
  await page.go(BASE + '/viewer3d/?view=3d', 6000);
  page.requests.length = 0;
  await page.js("document.getElementById('time-fwd-10').click()");
  await sleep(1500);
  const models = page.requests.filter(function (url) { return /\.glb/.test(url); });
  assert.equal(models.length, 0, models.length + ' model requests after one click');
});

test('H2: a click on a body works while the SVG viewer plays', LONG, async function () {
  await page.go(BASE + '/viewer/?view=svg', 1500);
  await page.js("localStorage.removeItem('orbit-match-viewer-state')");
  await page.go(BASE + '/viewer/?view=svg', 1500);
  await page.js("document.getElementById('play-forward').click()");
  await sleep(500);
  const spot = "(() => { const r = document.querySelector('#sky circle[data-id=\"tc6\"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()";
  const cards = "document.querySelectorAll('#sky rect.card').length";
  let hits = 0;
  for (let i = 0; i < 4; i += 1) {
    const before = await page.js(cards);
    const at = await page.js(spot);
    await page.clickAt(at[0], at[1]);
    if (await page.js(cards) !== before) hits += 1;
  }
  await page.js("document.getElementById('play-pause').click()");
  await page.js("localStorage.removeItem('orbit-match-viewer-state')");
  assert.ok(hits >= 3, hits + ' of 4 clicks registered');
});

test('H3: typing in Surface pressure keeps World facts open and keeps focus', LONG, async function () {
  await freshBuilder();
  await page.js("document.getElementById('add-body').click()");
  await sleep(100);
  await page.js("document.querySelector('.body-card details').open = true; document.querySelector('[data-field=\"pressure\"]').focus()");
  await setField('[data-field="pressure"]', '0');
  await sleep(100);
  assert.equal(await page.js("document.querySelector('.body-card details').open"), true);
  assert.equal(await page.js('document.activeElement.dataset.field'), 'pressure');
});

test('H5: the page shows that the day has changed', LONG, async function () {
  await page.go(BASE + '/viewer/?view=svg', 1500);
  await page.js("localStorage.removeItem('orbit-match-viewer-state')");
  await page.go(BASE + '/viewer/?view=svg', 1500);
  await page.js("document.getElementById('time-fwd-10').click()");
  await sleep(300);
  const shown = await page.js("[...document.querySelectorAll('main *')].filter(el => !el.closest('button, select, option') && !el.children.length).map(el => el.textContent).join(' | ')");
  await page.js("localStorage.removeItem('orbit-match-viewer-state')");
  assert.match(shown, /\b(day|t\s*\+|epoch\s*\+)\s*\+?\s*10\b|\b10 days? (since|after|from)/i);
});

test('H7: a viewer shows why a load failed', LONG, async function () {
  await page.go(BASE + '/viewer/?view=svg&system=..%2Fsecret', 1500);
  assert.doesNotMatch(await page.js("document.getElementById('load-status').textContent"), /static server/);
});

test('H9: editing a deep-linked system does not replace the saved draft', LONG, async function () {
  await freshBuilder();
  await setField('[data-header="concept"]', 'my own draft');
  const draft = await page.js(`localStorage.getItem('${STORE}')`);
  await page.go(BASE + '/manual/#system=tau-ceti&object=tc5', 2000);
  await setField('[data-body="tc5"] [data-field="name"]', 'Kakakiko');
  await sleep(100);
  assert.equal(await page.js(`localStorage.getItem('${STORE}')`), draft);
});

test('H9: choosing a new star clears the last system\'s details', LONG, async function () {
  await freshBuilder();
  await setField('[data-header="holder"]', 'Old Faction');
  await chooseTestStar();
  assert.equal(await page.js("document.querySelector('[data-header=\"holder\"]').value"), '');
});

test('H9: Remove asks before deleting a body from loaded data', LONG, async function () {
  await freshBuilder('#system=tau-ceti');
  await sleep(500);
  page.dialogs.length = 0;
  await page.js("document.querySelector('[data-body=\"tc8\"] [data-act=\"remove\"]').click()");
  await sleep(300);
  assert.equal(await prompted(), true);
});

test('H10: Haven opens as a structure with its distance', LONG, async function () {
  await freshBuilder('#system=tau-ceti');
  await sleep(500);
  assert.equal(await page.js("document.querySelector('[data-body=\"haven\"] [data-field=\"kind\"]').value"), 'structure');
  const values = await page.js("[...document.querySelectorAll('[data-body=\"haven\"] input')].map(i => i.value)");
  assert.ok(values.includes('54076'), 'distance not shown');
});

test('H14: Randomize all asks before replacing locked angles', LONG, async function () {
  await freshBuilder('#system=tau-ceti');
  await sleep(500);
  page.dialogs.length = 0;
  const before = await page.js("document.querySelector('[data-body=\"tc5\"] [data-field=\"position_angle_deg\"]').value");
  await page.js("document.getElementById('randomize-all').click()");
  await sleep(300);
  const asked = await prompted();
  const after = await page.js("document.querySelector('[data-body=\"tc5\"] [data-field=\"position_angle_deg\"]').value");
  assert.ok(asked || after === before, 'locked angle changed from ' + before + ' to ' + after + ' without asking');
});

test('H15: removing a planet does not leave its moons pointing at nothing', LONG, async function () {
  await freshBuilder('#system=tau-ceti');
  await sleep(500);
  await page.js("document.querySelector('[data-body=\"tc5\"] [data-act=\"remove\"]').click()");
  await sleep(300);
  await page.js("(() => { const b = document.querySelector('dialog[open] button'); if (b) b.click(); })()");
  await sleep(300);
  const gone = await page.js("!document.querySelector('[data-body=\"tc5\"]')");
  const moonStays = await page.js("!!document.querySelector('[data-body=\"tc5a\"]')");
  assert.ok(!(gone && moonStays), 'Kakakiko is gone but Shudder still orbits it');
});

// ---- Medium ----

test('M11: changing the hash on an open builder loads that system', LONG, async function () {
  await freshBuilder();
  await page.js("location.hash = '#system=tau-ceti&object=tc5'");
  await sleep(1500);
  assert.ok(await page.js("document.querySelectorAll('[data-body]').length") > 0);
});

// ---- Second pass, 2026-11-05 ----

const STAR_CSV = 'hostname,sy_pnum,st_spectype,st_mass,st_lum,st_teff,st_rad\nTest Star,3,G2V,1,0,5772,1\n';

async function chooseTestStar() {
  await page.pick('#star-file', tempFile('stars.csv', STAR_CSV));
  await setField('#star-search', 'Test');
  await sleep(200);
  await page.js("document.querySelector('#star-results button').click()");
  await sleep(300);
}

async function lastSave() {
  await page.js("document.getElementById('save-system').click()");
  await sleep(400);
  await page.js("(() => { const b = document.querySelector('dialog[open] button'); if (b) b.click(); })()");
  await sleep(400);
  const saved = await page.js('Promise.all(window.__saved.map(blob => blob.text()))');
  assert.ok(saved.length > 0, 'nothing was saved');
  return JSON.parse(saved[saved.length - 1]);
}

test('H16: lowering Known planets keeps a planet that has a moon', LONG, async function () {
  await freshBuilder();
  await chooseTestStar();
  await page.js("document.querySelectorAll('[data-act=\"add-moon\"]')[2].click()");
  await sleep(200);
  await setField('[data-moon-field="name"]', 'Keep me');
  page.dialogs.length = 0;
  await setField('[data-header="planets"]', '2');
  await sleep(300);
  const kept = await page.js("!!document.querySelector('[data-moon-field=\"name\"]')");
  assert.ok(kept || await prompted(), 'the planet and its moon were deleted without asking');
});

test('H16: choosing a star asks first when only an angle was edited', LONG, async function () {
  await freshBuilder();
  await chooseTestStar();
  await setField('[data-field="position_angle_deg"]', '123');
  page.dialogs.length = 0;
  await setField('#star-search', 'Test');
  await sleep(200);
  await page.js("document.querySelector('#star-results button').click()");
  await sleep(300);
  assert.equal(await prompted(), true, 'the edited angle was replaced without asking');
});

test('H16: choosing a star asks first when star data was typed by hand', LONG, async function () {
  await freshBuilder();
  await page.pick('#star-file', tempFile('stars.csv', STAR_CSV));
  await setField('[data-header="mass"]', '0.42');
  await setField('[data-header="teff"]', '3100');
  page.dialogs.length = 0;
  await setField('#star-search', 'Test');
  await sleep(200);
  await page.js("document.querySelector('#star-results button').click()");
  await sleep(300);
  assert.equal(await prompted(), true, 'the typed star data was replaced without asking');
});

test('H17: a file that fails halfway does not leave two systems mixed', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  const broken = tempFile('half.system.json', JSON.stringify({ orbit_match: 2, star: { hostname: 'Other Star' }, card: { services: 'fuel' }, bodies: [] }));
  await page.pick('#system-file', broken);
  const saved = await lastSave();
  assert.ok(!(saved.star.hostname === 'Other Star' && saved.bodies.length > 0), 'Other Star was saved with ' + saved.bodies.length + ' Tau Ceti bodies');
});

test('H18: the open control can load the same file again', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  assert.equal(await page.js("document.getElementById('system-file').value"), '', 'picking this file again fires no change event');
});

test('H19: a star built by hand can be given a name', LONG, async function () {
  await freshBuilder();
  assert.equal(await page.js("!!document.querySelector('[data-header=\"hostname\"]')"), true, 'no field names the star');
});

test('H19: a star built by hand can be given a radius and a position', LONG, async function () {
  await freshBuilder();
  for (const key of ['rad', 'x', 'y', 'z']) {
    assert.equal(await page.js("!!document.querySelector('[data-header=\"" + key + "\"]')"), true, 'no field for ' + key);
  }
});

test('M29: loading a CSV does not undo edits with values from the link', LONG, async function () {
  await freshBuilder('#h=1&holder=FromLink');
  await setField('[data-header="holder"]', 'Mine');
  await page.pick('#star-file', tempFile('stars.csv', STAR_CSV));
  await sleep(300);
  assert.equal(await page.js("JSON.parse(localStorage.getItem('" + STORE + "')).header.holder"), 'Mine');
});

test('M29: a link from the star map does not replace the draft without asking', LONG, async function () {
  await freshBuilder();
  await setField('[data-header="concept"]', 'my own draft');
  page.dialogs.length = 0;
  await page.go(BASE + '/manual/#h=1&host=Other', 1500);
  const kept = await page.js("(localStorage.getItem('" + STORE + "') || '').includes('my own draft')");
  assert.ok(kept || await prompted(), 'the draft is gone');
});

test('M30: changing the star mass does not leave orbits silently inconsistent', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  const before = await page.js("document.querySelector('[data-body=\"tc5\"] [data-field=\"period\"]').value");
  await setField('[data-header="mass"]', '1.5');
  await sleep(300);
  const after = await page.js("document.querySelector('[data-body=\"tc5\"] [data-field=\"period\"]').value");
  const told = await page.js("/mass/i.test(document.getElementById('status').textContent + ' ' + Array.from(document.querySelectorAll('.warn')).map(el => el.textContent).join(' '))");
  assert.ok(after !== before || told, 'period stayed ' + before + ' with no warning');
});

test('M33: a star with one CSV row per planet is listed once', LONG, async function () {
  await freshBuilder();
  const rows = 'hostname,pl_name,sy_pnum,st_spectype\nTest Star,Test Star b,3,G2V\nTest Star,Test Star c,3,G2V\nTest Star,Test Star d,3,G2V\n';
  await page.pick('#star-file', tempFile('per-planet.csv', rows));
  await setField('#star-search', 'Test');
  await sleep(200);
  assert.equal(await page.js("document.querySelectorAll('#star-results button').length"), 1);
});

test('L17: a fixed angle does not keep showing its old error', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  const angle = '[data-body="tc5"] [data-field="position_angle_deg"]';
  await setField(angle, 'abc');
  await setField('[data-body="tc5"] [data-field="period"]', '250');
  await sleep(200);
  await setField(angle, '10');
  await sleep(200);
  assert.equal(await page.js("document.querySelector('[data-body=\"tc5\"]').textContent.includes('Enter a number from 0 to 360')"), false);
});

test('L18: saving tells the user it worked', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  await lastSave();
  assert.match(await page.js("document.getElementById('status').textContent"), /saved/i);
});

// ---- Third pass, 2026-11-06: outstanding items that had no test ----

const THREE_D = BASE + '/viewer3d/?view=3d';
const SVG_PAGE = BASE + '/viewer/?view=svg';

async function addBodyWithMoon() {
  await freshBuilder();
  await page.js("document.getElementById('add-body').click()");
  await sleep(100);
  await page.js("document.querySelector('[data-act=\"add-moon\"]').click()");
  await sleep(100);
}

test('H3: typing in a moon\'s air fields keeps the panel open and keeps focus', LONG, async function () {
  await addBodyWithMoon();
  await page.js("document.querySelector('.moon details').open = true; document.querySelector('[data-moon-field=\"pressure\"]').focus()");
  await setField('[data-moon-field="pressure"]', '0');
  await sleep(100);
  assert.equal(await page.js("document.querySelector('.moon details').open"), true);
  assert.equal(await page.js('document.activeElement.dataset.moonField'), 'pressure');
});

test('H3: changing a moon\'s unit keeps focus on that moon', LONG, async function () {
  await addBodyWithMoon();
  await page.js("document.querySelector('[data-moon-field=\"unit\"]').focus()");
  await setField('[data-moon-field="unit"]', 'years');
  await sleep(100);
  assert.equal(await page.js("!!document.activeElement.closest('[data-moon]')"), true, 'focus left the moon');
});

test('H4: a blocked three.js is not reported as missing WebGL', LONG, async function () {
  await page.block(['*unpkg.com*']);
  try {
    await page.go(THREE_D, 3000);
    const shown = await page.js("(() => { const box = document.getElementById('fallback'); return box.hidden ? '' : box.textContent; })()");
    assert.doesNotMatch(shown, /WebGL is not available/);
  } finally {
    await page.block([]);
  }
});

test('H11: a CSV with no stars says so', LONG, async function () {
  await freshBuilder();
  await page.pick('#star-file', tempFile('nothing.csv', 'a,b\n1,2\n'));
  await sleep(200);
  assert.doesNotMatch(await page.js("document.getElementById('status').textContent"), /^0 stars from .*Search for one/);
});

test('M8: a close planet keeps its distance to three figures', LONG, async function () {
  await freshBuilder();
  await page.js("document.getElementById('add-body').click()");
  await sleep(100);
  await setField('[data-field="period"]', '0.00191');
  await sleep(100);
  const au = Number(await page.js("document.querySelector('[data-field=\"au\"]').value"));
  const expected = Math.cbrt(0.00191 * 0.00191);
  assert.ok(Math.abs(au - expected) / expected < 0.005, 'shows ' + au + ' for ' + expected.toFixed(5));
});

test('M10: the SVG picture fits the window', LONG, async function () {
  await page.go(SVG_PAGE, 1500);
  const over = await page.js("Math.round(document.querySelector('#sky svg').getBoundingClientRect().bottom - innerHeight)");
  assert.ok(over <= 0, 'the picture runs ' + over + ' px below the window');
});

test('M34: editing a moon on its own card does not give it a distance from the star', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  await setField('[data-body="tc5a"] [data-field="period"]', '6.7');
  await sleep(200);
  const au = await page.js("(document.querySelector('[data-body=\"tc5a\"] [data-field=\"au\"]') || {}).value || ''");
  assert.equal(au, '', 'Shudder now has an AU distance');
});

test('M35: a deep link that fails to load leaves the draft safe', LONG, async function () {
  await freshBuilder();
  await setField('[data-header="concept"]', 'my own draft');
  await page.block(['*tau-ceti.system.json*']);
  try {
    await page.go(BASE + '/manual/#system=tau-ceti', 1500);
  } finally {
    await page.block([]);
  }
  await page.js("document.getElementById('add-body').click()");
  await sleep(200);
  assert.match(await page.js("localStorage.getItem('" + STORE + "') || ''"), /my own draft/);
});

test('L19: neither viewer asks for a handoff file that does not exist', LONG, async function () {
  for (const url of [SVG_PAGE, THREE_D]) {
    page.responses.length = 0;
    await page.go(url, 3000);
    const missing = page.responses.filter(function (row) { return row.status === 404 && /handoff/.test(row.url); });
    assert.deepEqual(missing.map(function (row) { return row.url; }), []);
  }
});

test('L23: the 3D view draws nothing while idle', LONG, async function () {
  await page.go(THREE_D, 7000);
  const before = await page.js('window.__draws');
  await sleep(1000);
  const drawn = await page.js('window.__draws') - before;
  assert.ok(before > 0, 'the scene never drew');
  assert.ok(drawn < 10, drawn + ' draw calls in one idle second');
});

test('L25: the 3D view does not fetch every model at start', LONG, async function () {
  page.requests.length = 0;
  await page.go(THREE_D, 7000);
  const files = Array.from(new Set(page.requests.filter(function (url) { return /\.glb/.test(url); })));
  const bytes = files.reduce(function (sum, url) {
    return sum + fs.statSync(path.join(root, 'site', new URL(url).pathname)).size;
  }, 0);
  assert.ok(bytes < 8e6, (bytes / 1e6).toFixed(1) + ' MB of models at start, in ' + files.length + ' files');
});

test('L26: one edit saves the draft once', LONG, async function () {
  await freshBuilder();
  await page.js("document.getElementById('add-body').click()");
  await sleep(100);
  await page.js("(() => { window.__sets = 0; const real = Storage.prototype.setItem; Storage.prototype.setItem = function () { window.__sets += 1; return real.apply(this, arguments); }; })()");
  await page.js("(() => { const input = document.querySelector('[data-field=\"kind\"]'); input.value = 'asteroid'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await sleep(100);
  assert.equal(await page.js('window.__sets'), 1);
});

test('L27: blocked storage does not stop the builder starting', LONG, async function () {
  const stop = await page.inject("Storage.prototype.getItem = function () { throw new Error('blocked'); };");
  try {
    page.requests.length = 0;
    await page.go(BASE + '/manual/', 1500);
    assert.ok(page.requests.some(function (url) { return /\/config\.json/.test(url); }), 'the page stopped before it read config.json');
  } finally {
    await stop();
  }
});

test('L38: a sky image that fails is not requested on every frame', LONG, async function () {
  await page.block(['*/sky/*']);
  try {
    await page.go(THREE_D, 5000);
    page.requests.length = 0;
    for (let i = 0; i < 3; i += 1) {
      await page.js("document.getElementById('time-fwd').click()");
      await sleep(500);
    }
    const again = page.requests.filter(function (url) { return /\/sky\//.test(url); });
    assert.equal(again.length, 0, again.length + ' more sky requests from 3 clicks');
  } finally {
    await page.block([]);
  }
});

test('L40: the 3D canvas follows its stage, not only the window', LONG, async function () {
  await page.go(THREE_D, 5000);
  await page.js("document.getElementById('stage').style.width = '600px'");
  await sleep(600);
  const sizes = await page.js("[document.querySelector('#stage canvas').width, document.getElementById('stage').clientWidth * devicePixelRatio]");
  assert.ok(Math.abs(sizes[0] - sizes[1]) <= 2, 'canvas is ' + sizes[0] + ', stage is ' + sizes[1]);
});

test('L41: menu links between viewers keep the system', LONG, async function () {
  await page.go(THREE_D + '&system=tau-ceti', 2000);
  assert.match(await page.js("document.querySelector('nav a[href*=\"view=svg\"]').href"), /system=tau-ceti/);
});

test('L29: the dock leaves no large gap above the picture', LONG, async function () {
  await page.go(THREE_D, 3000);
  const gap = await page.js("Math.round(document.getElementById('stage').getBoundingClientRect().top - document.querySelector('.dock-row').getBoundingClientRect().bottom)");
  assert.ok(gap <= 48, gap + ' px between the controls and the picture');
});

test('L42: the builder and the file agree on the goldilocks zone', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  const star = JSON.parse(fs.readFileSync(TAU_FILE, 'utf8')).star;
  const expected = star.hz_inner_au.toFixed(2) + '–' + star.hz_outer_au.toFixed(2);
  assert.ok((await page.js("document.getElementById('zone-note').textContent")).includes(expected));
});

test('L43: a saved file name can be opened by the viewers', LONG, async function () {
  const source = await import('../site/js/system-source.js');
  await freshBuilder();
  await page.pick('#system-file', tempFile('tau.system.json', JSON.stringify({ orbit_match: 2, kind: 'system', star: { hostname: 'τ Cet' }, bodies: [] })));
  await lastSave();
  const name = await page.js('window.__links[window.__links.length - 1].download');
  assert.ok(source.safeSystemFile(name), name + ' is refused by safeSystemFile');
});

test('L45: a draft that cannot be stored says so', LONG, async function () {
  await freshBuilder();
  await page.js("Storage.prototype.setItem = function () { throw new Error('full'); }");
  await setField('[data-header="concept"]', 'lost');
  await sleep(100);
  assert.match(await page.js("document.getElementById('status').textContent"), /not saved|storage|full|could not/i);
});

test('L46: the download link is in the page when it is clicked', LONG, async function () {
  await freshBuilder();
  await page.pick('#system-file', TAU_FILE);
  await lastSave();
  assert.equal(await page.js('window.__links[window.__links.length - 1].connected'), true);
});

test('L49: changing a planet to a moon does not hide its moons', LONG, async function () {
  await addBodyWithMoon();
  await setField('[data-moon-field="name"]', 'Keep me');
  page.dialogs.length = 0;
  await setField('[data-field="kind"]', 'moon');
  await page.js("document.getElementById('add-body').click()");
  await sleep(200);
  const shown = await page.js("!!document.querySelector('[data-moon-field=\"name\"]')");
  assert.ok(shown || await prompted(), 'the moon has no card, and nothing asked');
});
