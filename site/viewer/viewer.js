import { loadSystem, loadView } from '../js/schema.js';
import { renderSvg } from '../js/render-svg.js';
import { applyShell } from '../js/shell.js';

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

Promise.all([
  fetchJson('../data/tau-ceti.system.json'),
  fetchJson('../data/tau-ceti.view.json'),
  fetchJson('../themes/quiet.json'),
  fetchJson('../themes/empire.json'),
  fetchJson('../themes/holo.json')
]).then(function (files) {
  bag = {
    system: loadSystem(files[0]),
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
