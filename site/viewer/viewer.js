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

document.getElementById('crumb-system').addEventListener('click', function () {
  frame = 'system';
  paint();
});
document.getElementById('crumb-focus').addEventListener('click', function () {
  frame = this.getAttribute('data-frame') || 'system';
  paint();
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
