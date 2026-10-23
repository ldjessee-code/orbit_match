import { loadView } from '../js/schema.js';
import { isHandoff, isLoreSystem, resolveSystem, safeSystemFile } from '../js/system-source.js';
import { renderSvg } from '../js/render-svg.js';
import { applyShell } from '../js/shell.js';
import {
  collectBrowserSignals,
  decideViewer,
  readResourceStorage,
  resourceDestination,
  writeResourceStorage
} from '../js/low-resource.js';

const sky = document.getElementById('sky');
const status = document.getElementById('load-status');
const readout = document.getElementById('readout');
let frame = 'system';
let bag = null;

function fetchJson(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) throw new Error(url + ' ' + response.status);
    return response.json();
  });
}

function paint() {
  if (!bag) return;
  const style = bag.view.style === 'holo' ? bag.holo : bag.quiet;
  sky.innerHTML = renderSvg(bag.system, bag.view, bag.empire, style, { frame: frame });
  readout.textContent = '';
  sky.querySelectorAll('[data-au]').forEach(function (el) {
    el.addEventListener('pointerenter', function () {
      readout.textContent = el.getAttribute('data-au') + ' AU';
    });
    el.addEventListener('pointerleave', function () {
      readout.textContent = '';
    });
  });
  document.getElementById('crumb-system').setAttribute('aria-current', frame === 'system' ? 'true' : 'false');
  document.getElementById('crumb-focus').setAttribute('aria-current', frame === 'system' ? 'false' : 'true');
}

function cardKey(id) {
  const text = String(id);
  if (text.slice(0, 6) === 'orbit:') return 'body:' + text.slice(6);
  return text;
}

function toggleCallout(id) {
  if (!bag || !id) return;
  const key = cardKey(id);
  const list = [];
  bag.view.callouts.forEach(function (item) {
    const next = cardKey(item);
    if (list.indexOf(next) < 0) list.push(next);
  });
  const at = list.indexOf(key);
  if (at >= 0) list.splice(at, 1);
  else {
    list.push(key);
    if (list.length > 3) list.shift();
  }
  bag.view.callouts = list;
  paint();
}

sky.addEventListener('click', function (event) {
  if (!bag) return;
  const hit = event.target.closest ? event.target.closest('[data-callout]') : null;
  if (hit && sky.contains(hit)) {
    toggleCallout(hit.getAttribute('data-callout'));
    return;
  }
  const role = event.target.getAttribute && event.target.getAttribute('data-role');
  if (role === 'sky' && bag.view.callouts.length) {
    bag.view.callouts = [];
    paint();
  }
});

function showFrame(next) {
  frame = next;
  if (bag) bag.view.callouts = [];
  paint();
}

document.getElementById('crumb-system').addEventListener('click', function () {
  showFrame('system');
});
document.getElementById('crumb-focus').addEventListener('click', function () {
  showFrame(this.getAttribute('data-frame') || 'system');
});

function probeWebgl() {
  const surface = document.createElement('canvas');
  let gl = null;
  try {
    gl = surface.getContext('webgl2') || surface.getContext('webgl');
  } catch (err) {
    gl = null;
  }
  if (!gl) return { webgl: false, maxTextureSize: null };
  const size = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
  if (lose && lose.loseContext) lose.loseContext();
  return { webgl: true, maxTextureSize: typeof size === 'number' ? size : null };
}

function stayOnSvg() {
  if (typeof location === 'undefined') return true;
  const probed = probeWebgl();
  // A browser with no WebGL cannot draw the 3D page. Stay here even if storage asked for 3D.
  if (probed.webgl === false) return true;
  const choice = decideViewer({
    search: location.search,
    stored: readResourceStorage(),
    signals: collectBrowserSignals(),
    probe: function () { return probed; }
  });
  const dest = resourceDestination('svg', choice, location.search);
  if (!dest) return true;
  location.replace(dest);
  return false;
}

const resourceToggle = document.getElementById('resource-toggle');
if (resourceToggle) {
  resourceToggle.addEventListener('click', function () {
    writeResourceStorage('3d');
    const dest = resourceDestination('svg', { mode: '3d' }, location.search);
    if (dest) location.assign(dest);
  });
}

async function loadRequestedSystem() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('system');
  let loreName = 'tau-ceti.system.json';
  if (requested) {
    const withSuffix = /\.system\.json$/i.test(requested) ? requested : requested + '.system.json';
    const safe = safeSystemFile(withSuffix);
    if (!safe) throw new Error('system name is not allowed');
    loreName = safe;
  }
  const handoffName = loreName.replace(/\.system\.json$/i, '.handoff.json');
  let lore = null;
  let handoff = null;
  try { lore = await fetchJson('../data/' + loreName); } catch (err) { lore = null; }
  try { handoff = await fetchJson('../data/' + handoffName); } catch (err) { handoff = null; }
  if (lore && !isLoreSystem(lore)) lore = null;
  if (handoff && !isHandoff(handoff)) handoff = null;
  if (!lore && !handoff) throw new Error('system file missing');
  return resolveSystem({ lore: lore, handoff: handoff });
}

if (stayOnSvg()) Promise.all([
  loadRequestedSystem(),
  fetchJson('../data/tau-ceti.view.json'),
  fetchJson('../themes/quiet.json'),
  fetchJson('../themes/empire.json'),
  fetchJson('../themes/holo.json')
]).then(function (files) {
  bag = {
    system: files[0],
    view: loadView(files[1]),
    quiet: files[2],
    empire: files[3],
    holo: files[4]
  };
  paint();
  applyShell(document);
}).catch(function () {
  status.textContent = 'The system file did not load. Open this page from the static server.';
});
