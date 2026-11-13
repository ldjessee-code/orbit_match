// Loading shared by the SVG and 3D viewers: the system named in the address,
// a file the visitor opens, or the system the builder hands over. Every path
// goes through loadSystem, so a shared file is checked the same way.

import { loadSystem, loadView } from './schema.js';
import { isHandoff, isLoreSystem, resolveSystem, safeSystemFile } from './system-source.js';

export const DEFAULT_SYSTEM_FILE = 'tau-ceti.system.json';
// The builder's "View this system" leaves the system here.
export const VIEW_SYSTEM_KEY = 'orbit-match-view-system';

const NAME_RULE = 'A system name uses letters, digits, dot, dash, and underscore.';

export function fetchJson(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) {
      const err = new Error(url + ' ' + response.status);
      err.status = response.status;
      throw err;
    }
    return response.json();
  });
}

function reasonError(text) {
  const err = new Error(text);
  err.forVisitor = true;
  return err;
}

// One parsed JSON record as a loaded system. A system file and a star map
// handoff are both accepted.
export function systemFromRecord(record) {
  if (isLoreSystem(record)) return resolveSystem({ lore: record });
  if (isHandoff(record)) return resolveSystem({ handoff: record });
  throw reasonError('That file is not an Orbit Match system file or a star map handoff.');
}

// Text from a file the visitor chose.
export function systemFromText(text, name) {
  let record;
  try { record = JSON.parse(text); }
  catch (err) { throw reasonError((name || 'That file') + ' is not valid JSON.'); }
  try { return systemFromRecord(record); }
  catch (err) { throw reasonError((name || 'That file') + ' was not opened: ' + String(err.message || err).replace(/\.?$/, '.')); }
}

export function systemFromBuilder(storage) {
  let raw = null;
  try { raw = storage ? storage.getItem(VIEW_SYSTEM_KEY) : null; } catch (err) { raw = null; }
  if (!raw) throw reasonError('The builder has not sent a system to view. Use "View this system" in the builder, or open a system file.');
  return systemFromText(raw, 'The system from the builder');
}

// Days since the epoch, for the dock. 10 shows as "Day +10".
export function dayText(days) {
  const value = typeof days === 'number' && Number.isFinite(days) ? days : 0;
  const shown = Math.abs(value - Math.round(value)) < 1e-6 ? String(Math.round(value)) : value.toFixed(2);
  return 'Day ' + (value > 0 ? '+' : '') + shown + (value === 0 ? ' (the epoch)' : ' since the epoch');
}

function stemOf(fileName) {
  return String(fileName).replace(/\.system\.json$/i, '');
}

// The system named by ?system=, its view file when it has one, and a stem for
// the clock. A missing file says so, and says how to open one.
export async function loadRequestedSystem(search, storage, defaultFile) {
  const params = new URLSearchParams(search || '');
  if (params.get('source') === 'builder') {
    return { system: systemFromBuilder(storage), view: loadView({ orbit_match_view: 1 }), stem: 'builder' };
  }
  const requested = params.get('system');
  let loreName = safeSystemFile(defaultFile) || DEFAULT_SYSTEM_FILE;
  if (requested) {
    const withSuffix = /\.system\.json$/i.test(requested) ? requested : requested + '.system.json';
    const safe = safeSystemFile(withSuffix);
    if (!safe) throw reasonError('"' + requested + '" is not a system this page can open. ' + NAME_RULE);
    loreName = safe;
  }
  const stem = stemOf(loreName);
  let system = null;
  let lore = null;
  try { lore = await fetchJson('../data/' + loreName); } catch (err) { lore = null; }
  if (lore) {
    if (!isLoreSystem(lore)) throw reasonError(loreName + ' is not an Orbit Match system file.');
    try { system = loadSystem(lore); }
    catch (err) { throw reasonError(loreName + ' could not be read: ' + String(err.message || err).replace(/\.?$/, '.')); }
  } else {
    // Only a system with no file of its own looks for a star map handoff.
    let handoff = null;
    try { handoff = await fetchJson('../data/' + stem + '.handoff.json'); } catch (err) { handoff = null; }
    if (!handoff || !isHandoff(handoff)) {
      throw reasonError('This site has no system file named ' + loreName + '. Use "Open a system file" to view one from your computer.');
    }
    system = resolveSystem({ handoff: handoff });
  }
  let view;
  try { view = loadView(await fetchJson('../data/' + stem + '.view.json')); }
  catch (err) { view = loadView({ orbit_match_view: 1 }); }
  return { system: system, view: view, stem: stem };
}

export function loadFailText(err) {
  if (err && err.forVisitor) return err.message;
  return 'The system did not load: ' + String((err && err.message) || err) + '.';
}

// Warnings from validateSystem, for the line under the picture.
export function issueText(system) {
  const list = system && Array.isArray(system.issues) ? system.issues : [];
  const shown = list.filter(function (item) { return item && item.message; }).map(function (item) { return item.message; });
  if (!shown.length) return '';
  return shown.slice(0, 4).join(' ') + (shown.length > 4 ? ' And ' + (shown.length - 4) + ' more.' : '');
}

// A theme or style name from a view file names a file in ../themes/.
export function themeFileName(name, fallback) {
  const text = String(name == null ? '' : name).trim();
  return /^[a-z0-9-]+$/i.test(text) ? text : fallback;
}

// Every body a trip can start or end at, by name.
export function tripChoices(system) {
  return (system.bodies || []).filter(function (body) {
    return body && body.kind !== 'belt' && body.id != null;
  }).map(function (body) {
    return { id: String(body.id), name: body.name || String(body.id) };
  });
}

// Fills a <select> with options built as elements, so names are text.
export function fillSelect(doc, select, rows, selected, blankLabel) {
  if (!select) return;
  while (select.firstChild) select.removeChild(select.firstChild);
  if (blankLabel) {
    const blank = doc.createElement('option');
    blank.value = '';
    blank.textContent = blankLabel;
    select.appendChild(blank);
  }
  rows.forEach(function (row) {
    const option = doc.createElement('option');
    option.value = row.id;
    option.textContent = row.name;
    select.appendChild(option);
  });
  select.value = selected == null ? '' : String(selected);
}

// Links between the viewers keep ?system= (or ?source=).
export function keepSystemInLinks(doc, search) {
  const params = new URLSearchParams(search || '');
  const keep = ['system', 'source'].filter(function (key) { return params.get(key); });
  if (!keep.length) return;
  doc.querySelectorAll('a[href*="viewer"]').forEach(function (link) {
    const href = link.getAttribute('href');
    if (!href || /^https?:/i.test(href)) return;
    const url = new URL(href, doc.baseURI);
    keep.forEach(function (key) { url.searchParams.set(key, params.get(key)); });
    link.setAttribute('href', url.pathname + url.search + url.hash);
  });
}
