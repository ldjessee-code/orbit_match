import { loadView } from '../js/schema.js';
import { renderSvg } from '../js/render-svg.js';
import { hasSubmap } from '../viewer3d/scene-model.js';
import { applyShell } from '../js/shell.js';
import {
  dayText,
  fetchJson,
  fillSelect,
  issueText,
  keepSystemInLinks,
  loadFailText,
  loadRequestedSystem,
  systemFromText,
  themeFileName,
  tripChoices
} from '../js/viewer-common.js';
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

// With no ?system=, the page opens tau-ceti.system.json.
const DEFAULT_SYSTEM = 'tau-ceti.system.json';

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
// The clock id: the requested system, or the name of an opened file.
let clockId = null;
// A repaint replaces the picture, so it waits while a pointer is down.
// Otherwise the element under the press is gone at release and no click fires.
let pointerDown = false;
let paintWaiting = false;

function currentClockId() {
  if (clockId) return clockId;
  const search = typeof location === 'undefined' ? '' : location.search;
  return systemIdFromSearch(search);
}

function clockedView() {
  const state = playback && playback.viewerState ? playback.viewerState() : readViewerState();
  return viewAtClock(bag.view, bag.system, state, currentClockId());
}

// Zoom crops the picture around its center. Elevation tilts the plane.
function zoomed(svg) {
  const zoom = bag.zoom > 1 ? bag.zoom : 1;
  if (zoom === 1) return svg;
  const w = 1600 / zoom;
  const h = 1000 / zoom;
  const box = (800 - w / 2).toFixed(1) + ' ' + (500 - h / 2).toFixed(1) + ' ' + w.toFixed(1) + ' ' + h.toFixed(1);
  return svg.replace('viewBox="0 0 1600 1000"', 'viewBox="' + box + '"');
}

function paint() {
  if (!bag) return;
  if (pointerDown) {
    paintWaiting = true;
    return;
  }
  paintWaiting = false;
  const view = clockedView();
  sky.innerHTML = zoomed(renderSvg(bag.system, view, bag.theme, bag.style, { frame: frame }));
  fitPicture();
  readout.textContent = '';
  paintDay(view);
  paintCrumbs();
}

// The picture fits the window, so nothing runs below the fold.
function fitPicture() {
  const svg = sky.querySelector('svg');
  if (!svg || typeof window === 'undefined') return;
  const top = sky.getBoundingClientRect().top;
  const room = Math.max(240, window.innerHeight - top - 12);
  svg.style.maxHeight = room + 'px';
}

function paintDay(view) {
  const box = document.getElementById('clock-day');
  if (!box) return;
  const epoch = bag.system.epoch;
  const date = epoch && typeof epoch === 'object' && epoch.game_datetime ? ' · epoch ' + epoch.game_datetime : '';
  box.textContent = dayText(view.epoch_days) + date;
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
    (frame === 'system' ? ' aria-current="true"' : '') + '>' + crumbText(star.name || star.hostname || 'System') + '</button>';
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

if (sky) {
  sky.addEventListener('pointerdown', function () { pointerDown = true; });
  const release = function () {
    if (!pointerDown) return;
    pointerDown = false;
    // The click for this press arrives first, then the waiting frame paints.
    if (paintWaiting) setTimeout(paint, 0);
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
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
  // Hover readouts are handled once here, so a repaint does not drop them.
  sky.addEventListener('pointerover', function (event) {
    const hit = event.target.closest ? event.target.closest('[data-au]') : null;
    if (readout) readout.textContent = hit ? hit.getAttribute('data-au') + ' AU' : '';
  });
}

function showFrame(next) {
  if (next && next !== 'system' && (!bag || !hasSubmap(bag.system, next))) return;
  frame = next || 'system';
  if (playback) playback.setClose(frame !== 'system');
  if (bag) bag.view.callouts = [];
  paint();
  paintBodyList();
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

// A list of every body beside the picture. Each opens its card, by keyboard
// as well as by mouse. A body with its own map can be framed from here too.
function paintBodyList() {
  const host = hasDom ? document.getElementById('body-list') : null;
  if (!host || !bag) return;
  while (host.firstChild) host.removeChild(host.firstChild);
  const rows = [{ id: 'star', name: (bag.system.star && (bag.system.star.name || bag.system.star.hostname)) || 'Star', key: 'star' }];
  (bag.system.bodies || []).forEach(function (body) {
    if (body && body.id != null) rows.push({ id: String(body.id), name: body.name || String(body.id), key: 'body:' + body.id });
  });
  rows.forEach(function (row) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = row.name;
    button.setAttribute('data-callout', row.key);
    button.addEventListener('click', function () { toggleCallout(row.key); });
    item.appendChild(button);
    if (row.id !== 'star' && hasSubmap(bag.system, row.id)) {
      const zoomIn = document.createElement('button');
      zoomIn.type = 'button';
      zoomIn.textContent = 'Close view';
      zoomIn.setAttribute('aria-label', 'Close view of ' + row.name);
      zoomIn.addEventListener('click', function () { showFrame(row.id); });
      item.appendChild(zoomIn);
    }
    host.appendChild(item);
  });
}

function paintTrip() {
  if (!bag) return;
  const rows = tripChoices(bag.system);
  const spec = bag.view.transfer || {};
  fillSelect(document, document.getElementById('trip-from'), rows, spec.from, 'No trip');
  fillSelect(document, document.getElementById('trip-to'), rows, spec.to, 'No trip');
}

function chooseTrip() {
  if (!bag) return;
  const from = document.getElementById('trip-from').value;
  const to = document.getElementById('trip-to').value;
  bag.view.transfer = from && to ? Object.assign({}, bag.view.transfer || {}, { from: from, to: to }) : null;
  paint();
}

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
  const choice = decideViewer({
    page: 'svg',
    search: location.search,
    stored: readResourceStorage(),
    signals: collectBrowserSignals(),
    probe: probeWebgl
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

function bindControls() {
  const zoom = document.getElementById('zoom');
  const elev = document.getElementById('elev');
  const elevText = document.getElementById('elev-value');
  if (zoom) zoom.addEventListener('input', function () {
    if (!bag) return;
    bag.zoom = Number(zoom.value) || 1;
    paint();
  });
  if (elev) elev.addEventListener('input', function () {
    if (!bag) return;
    bag.view.elevation_deg = Number(elev.value) || 20;
    if (elevText) elevText.textContent = bag.view.elevation_deg + '°';
    paint();
  });
  const from = document.getElementById('trip-from');
  const to = document.getElementById('trip-to');
  if (from) from.addEventListener('change', chooseTrip);
  if (to) to.addEventListener('change', chooseTrip);
  const go = document.getElementById('goto-day-go');
  const day = document.getElementById('goto-day');
  if (go && day) go.addEventListener('click', function () {
    const target = Number(day.value);
    if (!playback || !Number.isFinite(target)) return;
    playback.step(target - playback.elapsed());
  });
  const reset = document.getElementById('reset-epoch');
  if (reset) reset.addEventListener('click', function () {
    if (playback) playback.step(-playback.elapsed());
  });
  const picker = document.getElementById('system-file');
  if (picker) picker.addEventListener('change', function () {
    const file = picker.files && picker.files[0];
    picker.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const system = systemFromText(String(reader.result), file.name);
        clockId = 'file:' + file.name;
        bag.system = system;
        bag.view = Object.assign(loadView({ orbit_match_view: 1 }), { style: bag.view.style, theme: bag.view.theme });
        frame = 'system';
        if (playback) playback.setClose(false);
        showLoaded('Opened ' + file.name + '.');
      } catch (err) {
        status.textContent = loadFailText(err) + ' The picture did not change.';
      }
    };
    reader.onerror = function () { status.textContent = file.name + ' could not be read. The picture did not change.'; };
    reader.readAsText(file);
  });
}

function showLoaded(message) {
  const star = bag.system.star || {};
  const name = star.name || star.hostname;
  if (name) document.title = name + ' — Orbit Match';
  const issues = issueText(bag.system);
  status.textContent = [message, issues].filter(Boolean).join(' ');
  paintTrip();
  paintBodyList();
  paint();
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
      systemId: function () { return currentClockId(); },
      isClose: function () { return frame !== 'system'; }
    });
  }
  bindControls();
  keepSystemInLinks(document, location.search);
  window.addEventListener('resize', function () { if (bag) fitPicture(); });
}

function storageOrNull() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (err) { return null; }
}

if (hasDom && stayOnSvg()) loadRequestedSystem(location.search, storageOrNull(), DEFAULT_SYSTEM).then(function (loaded) {
  const view = loaded.view;
  const themeName = themeFileName(view.theme, 'empire');
  const styleName = themeFileName(view.style, 'quiet');
  return Promise.all([
    fetchJson('../themes/' + themeName + '.json').catch(function () { return fetchJson('../themes/empire.json'); }),
    fetchJson('../themes/' + styleName + '.json').catch(function () { return fetchJson('../themes/quiet.json'); })
  ]).then(function (files) {
    bag = { system: loaded.system, view: view, theme: files[0], style: files[1], zoom: 1 };
    const elev = document.getElementById('elev');
    if (elev) elev.value = String(view.elevation_deg);
    const elevText = document.getElementById('elev-value');
    if (elevText) elevText.textContent = view.elevation_deg + '°';
    showLoaded('');
    applyShell(document);
  });
}).catch(function (err) {
  status.textContent = loadFailText(err);
});
