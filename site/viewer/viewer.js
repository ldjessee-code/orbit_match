import { loadView } from '../js/schema.js';
import { isHandoff, isLoreSystem, resolveSystem, safeSystemFile } from '../js/system-source.js';
import { renderSvg } from '../js/render-svg.js';
import { hasSubmap } from '../viewer3d/scene-model.js';
import { applyShell } from '../js/shell.js';
import {
  collectBrowserSignals,
  decideViewer,
  readResourceStorage,
  resourceDestination,
  writeResourceStorage
} from '../js/low-resource.js';
import {
  readViewerState,
  systemIdFromSearch,
  viewAtClock
} from '../js/viewer-state.js';
import { mountPlaybackDock } from '../js/playback.js';

export function bindTimeDock(env) {
  return mountPlaybackDock(env);
}

const hasDom = typeof document !== 'undefined';
const sky = hasDom ? document.getElementById('sky') : null;
const status = hasDom ? document.getElementById('load-status') : null;
const readout = hasDom ? document.getElementById('readout') : null;
let frame = 'system';
let bag = null;
let playback = null;

function fetchJson(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) throw new Error(url + ' ' + response.status);
    return response.json();
  });
}

function clockedView() {
  const search = typeof location === 'undefined' ? '' : location.search;
  const state = playback && playback.viewerState ? playback.viewerState() : readViewerState();
  return viewAtClock(bag.view, bag.system, state, systemIdFromSearch(search));
}

function paint() {
  if (!bag) return;
  const style = bag.view.style === 'holo' ? bag.holo : bag.quiet;
  sky.innerHTML = renderSvg(bag.system, clockedView(), bag.empire, style, { frame: frame });
  readout.textContent = '';
  sky.querySelectorAll('[data-au]').forEach(function (el) {
    el.addEventListener('pointerenter', function () {
      readout.textContent = el.getAttribute('data-au') + ' AU';
    });
    el.addEventListener('pointerleave', function () {
      readout.textContent = '';
    });
  });
  paintCrumbs();
}

function crumbText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paintCrumbs() {
  const host = document.getElementById('crumbs');
  if (!host || !bag) return;
  const star = bag.system.star || {};
  let focusBody = null;
  if (frame && frame !== 'system') {
    focusBody = (bag.system.bodies || []).find(function (body) { return body.id === frame; }) || null;
    if (!focusBody || !hasSubmap(bag.system, focusBody.id)) {
      if (frame !== 'system') {
        frame = 'system';
        if (playback) playback.setClose(false);
      }
      focusBody = null;
    }
  }
  let html = '<button type="button" id="crumb-system" data-frame="system"' +
    (frame === 'system' ? ' aria-current="true"' : '') + '>' + crumbText(star.name || 'System') + '</button>';
  if (focusBody) {
    html += '<span aria-hidden="true">/</span>';
    html += '<button type="button" id="crumb-focus" data-frame="' + crumbText(frame) + '" aria-current="true">' +
      crumbText(focusBody.name || frame) + '</button>';
  }
  host.innerHTML = html;
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

if (sky) sky.addEventListener('click', function (event) {
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
  if (next && next !== 'system' && (!bag || !hasSubmap(bag.system, next))) return;
  frame = next || 'system';
  if (playback) playback.setClose(frame !== 'system');
  if (bag) bag.view.callouts = [];
  paint();
}

const crumbHost = hasDom ? document.getElementById('crumbs') : null;
if (crumbHost) {
  crumbHost.addEventListener('click', function (event) {
    const button = event.target.closest ? event.target.closest('button') : null;
    if (!button || !crumbHost.contains(button)) return;
    showFrame(button.getAttribute('data-frame') || 'system');
  });
}

if (sky) sky.addEventListener('dblclick', function (event) {
  if (!bag) return;
  const hit = event.target.closest ? event.target.closest('[data-callout]') : null;
  if (!hit || !sky.contains(hit)) return;
  const raw = hit.getAttribute('data-callout') || '';
  const id = raw.indexOf('body:') === 0 ? raw.slice(5) : raw;
  if (!id || id === 'star') {
    showFrame('system');
    return;
  }
  if (hasSubmap(bag.system, id)) showFrame(id);
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

const resourceToggle = hasDom ? document.getElementById('resource-toggle') : null;
if (resourceToggle) {
  resourceToggle.addEventListener('click', function () {
    writeResourceStorage('3d');
    const dest = resourceDestination('svg', { mode: '3d' }, location.search);
    if (dest) location.assign(dest);
  });
}

if (hasDom) {
  const timeDock = document.querySelector('.dock');
  if (timeDock) {
    playback = bindTimeDock({
      document: document,
      window: window,
      dock: timeDock,
      storage: typeof localStorage === 'undefined' ? null : localStorage,
      now: function () {
        return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      },
      requestFrame: function (fn) {
        if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
        return setTimeout(function () { fn(Date.now()); }, 16);
      },
      cancelFrame: function (id) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
        clearTimeout(id);
      },
      onPaint: function () { paint(); },
      systemId: function () {
        const search = typeof location === 'undefined' ? '' : location.search;
        return systemIdFromSearch(search);
      },
      isClose: function () { return frame !== 'system'; }
    });
  }
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

if (hasDom && stayOnSvg()) Promise.all([
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
