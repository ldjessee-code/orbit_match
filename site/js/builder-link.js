import { parseAngleDeg, randomAngleDeg } from './kepler.js';
import { loadSystem, YEAR_DAYS } from './schema.js';

// Throws with a reason when the viewers could not read this file. Works on a
// copy, so the caller's data is untouched.
export function checkSystem(data) {
  loadSystem(JSON.parse(JSON.stringify(data)));
  return true;
}

export const VIEWER_SYSTEM_ID = 'tau-ceti';
export const STAR_OBJECT_ID = 'star';
export const OPEN_LABEL = 'Open in Orbital Object Details';

const SYSTEM_FILES = {
  'tau-ceti': '../data/tau-ceti.system.json'
};

const OBJECT_ID = /^[A-Za-z0-9_-]+$/;

export function builderHref(systemId, objectId) {
  const params = new URLSearchParams();
  params.set('system', systemId || VIEWER_SYSTEM_ID);
  if (objectId) params.set('object', objectId);
  return '../manual/#' + params.toString();
}

export function focusTarget(system, objectId) {
  if (!objectId || typeof objectId !== 'string') return null;
  if (objectId === STAR_OBJECT_ID) {
    return { kind: 'star', id: STAR_OBJECT_ID, selector: '#star-card' };
  }
  if (!OBJECT_ID.test(objectId)) return null;
  const bodies = system && Array.isArray(system.bodies) ? system.bodies : [];
  const found = bodies.some(function (body) { return body && body.id === objectId; });
  if (!found) return null;
  return { kind: 'body', id: objectId, selector: '[data-body="' + objectId + '"]' };
}

export function parseBuilderHash(hash) {
  const raw = String(hash == null ? '' : hash);
  const text = raw.charAt(0) === '#' ? raw.slice(1) : raw;
  const params = new URLSearchParams(text);
  const systemId = params.get('system');
  if (!systemId || !Object.prototype.hasOwnProperty.call(SYSTEM_FILES, systemId)) {
    return { mode: 'blank', systemId: null, objectId: null, file: null, focus: null };
  }
  const file = SYSTEM_FILES[systemId];
  const objectRaw = params.get('object');
  if (!objectRaw || (objectRaw !== STAR_OBJECT_ID && !OBJECT_ID.test(objectRaw))) {
    return { mode: 'load', systemId: systemId, objectId: null, file: file, focus: null };
  }
  const focus = objectRaw === STAR_OBJECT_ID
    ? focusTarget({ bodies: [] }, objectRaw)
    : focusTarget({ bodies: [{ id: objectRaw }] }, objectRaw);
  return { mode: 'load', systemId: systemId, objectId: objectRaw, file: file, focus: focus };
}

export function cardLinks(spec) {
  const item = spec || {};
  const systemId = item.systemId || VIEWER_SYSTEM_ID;
  if (item.kind === 'transfer' && item.fromId && item.toId) {
    const fromName = item.fromName || item.fromId;
    const toName = item.toName || item.toId;
    return [
      {
        objectId: item.fromId,
        href: builderHref(systemId, item.fromId),
        label: 'Open ' + fromName + ' in Orbital Object Details'
      },
      {
        objectId: item.toId,
        href: builderHref(systemId, item.toId),
        label: 'Open ' + toName + ' in Orbital Object Details'
      }
    ];
  }
  const id = item.kind === 'star' || item.id === STAR_OBJECT_ID ? STAR_OBJECT_ID : item.id;
  return [{
    objectId: id,
    href: builderHref(systemId, id),
    label: OPEN_LABEL
  }];
}

function angleText(value) {
  if (value == null || value === '') return null;
  const parsed = parseAngleDeg(value);
  if (!parsed.ok || parsed.empty) return null;
  return String(parsed.value);
}

const ANGLE_FIELDS = ['position_angle_deg', 'perihelion_longitude_deg'];
const REFERENCE_LABEL = 'toward the vernal point / arbitrary';

function stampRandomAngles(body, roll) {
  const pos = Number(roll());
  const peri = Number(roll());
  body.position_angle_deg = pos.toFixed(2);
  body.perihelion_longitude_deg = peri.toFixed(2);
  body.angle_error = '';
}

// Belts have no single longitude. Moons, including nested moons, do.
export function randomizeManualAngles(bodies, randomAngleDeg) {
  const roll = typeof randomAngleDeg === 'function' ? randomAngleDeg : function () { return 0; };
  return (bodies || []).map(function (body) {
    const next = Object.assign({}, body || {});
    const moons = Array.isArray(body && body.moons) ? body.moons : null;
    if (next.kind !== 'belt') stampRandomAngles(next, roll);
    if (moons) {
      next.moons = moons.map(function (moon) {
        const copy = Object.assign({}, moon || {});
        if (next.kind === 'belt' || copy.kind === 'belt') return copy;
        stampRandomAngles(copy, roll);
        return copy;
      });
    }
    return next;
  });
}

function copyJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return value == null ? '' : String(value);
}

function listText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

// Star fields: header key, object in the file, key in that object.
const STAR_TEXT = [['hostname', 'hostname'], ['setting_name', 'setting_name'], ['spectype', 'spectype']];
const STAR_NUMBER = [['mass', 'mass_solar'], ['lum', 'lum_log'], ['teff', 'teff_k'], ['rad', 'radius_solar'], ['x', 'x_ly'], ['y', 'y_ly'], ['z', 'z_ly']];
const CARD_TEXT = [['concept', 'high_concept'], ['holder', 'holder'], ['fuel', 'fuel'], ['fuel_unit', 'fuel_unit']];
const HEADER_LABELS = {
  mass: 'Star mass', lum: 'Star luminosity', teff: 'Star temperature', rad: 'Star radius',
  x: 'Star x', y: 'Star y', z: 'Star z', planets: 'Known planets'
};

// Every builder header field, read from a system file. The file itself, less
// its bodies, rides along as `source`, so a save can start from it and keep
// the data the form has no field for.
export function manualHeaderFromSystem(system) {
  const src = isPlainObject(system) ? system : {};
  const star = isPlainObject(src.star) ? src.star : {};
  const card = isPlainObject(src.card) ? src.card : {};
  const epoch = src.epoch;
  let epochText = '';
  let epochObject = null;
  if (typeof epoch === 'string') epochText = epoch;
  else if (isPlainObject(epoch)) {
    epochObject = epoch;
    epochText = epoch.label == null ? '' : String(epoch.label);
  }
  const ref = src.reference_direction;
  let label = REFERENCE_LABEL;
  let deg = '0';
  if (typeof ref === 'string' && ref.trim()) label = ref.trim();
  else if (isPlainObject(ref)) {
    if (ref.label != null && String(ref.label).trim() !== '') label = String(ref.label);
    if (ref.deg != null && ref.deg !== '') deg = String(ref.deg);
  }
  const source = copyJson(src);
  delete source.bodies;
  const header = {
    hostname: star.hostname || '',
    setting_name: star.setting_name || '',
    spectype: star.spectype || '',
    planets: text(src.known_planet_count),
    port: card.port || '',
    services: listText(card.services),
    arrivals: (Array.isArray(src.arrivals) ? src.arrivals : []).map(function (item) { return item && item.from_hostname; }).filter(Boolean),
    epoch: epochText,
    epoch_object: epochObject,
    reference_label: label,
    reference_deg: deg,
    source: source
  };
  STAR_NUMBER.forEach(function (pair) { header[pair[0]] = text(star[pair[1]]); });
  CARD_TEXT.forEach(function (pair) { header[pair[0]] = card[pair[1]] || ''; });
  return header;
}

// A number typed in the form. Blank is null. Anything else that is not a
// number stops the save, so a typo never erases a stored value.
function formNumber(value, what) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(what + ' is not a number: "' + raw + '".');
  return parsed;
}

function setOrDelete(obj, key, value) {
  if (value == null || value === '') delete obj[key];
  else obj[key] = value;
}

function headerRecord(h) {
  const source = isPlainObject(h.source) ? h.source : null;
  const out = source ? copyJson(source) : { kind: 'system' };
  const was = source ? manualHeaderFromSystem(source) : manualHeaderFromSystem({});
  out.orbit_match = 2;
  if (!out.kind) out.kind = 'system';
  const changed = function (key) {
    return JSON.stringify(h[key] == null ? '' : h[key]) !== JSON.stringify(was[key] == null ? '' : was[key]);
  };
  const star = function () {
    if (!isPlainObject(out.star)) out.star = {};
    return out.star;
  };
  const card = function () {
    if (!isPlainObject(out.card)) out.card = {};
    return out.card;
  };
  STAR_TEXT.forEach(function (pair) {
    if (changed(pair[0])) setOrDelete(star(), pair[1], text(h[pair[0]]));
  });
  STAR_NUMBER.forEach(function (pair) {
    if (changed(pair[0])) setOrDelete(star(), pair[1], formNumber(h[pair[0]], HEADER_LABELS[pair[0]]));
  });
  if (changed('planets')) setOrDelete(out, 'known_planet_count', formNumber(h.planets, HEADER_LABELS.planets));
  CARD_TEXT.forEach(function (pair) {
    if (changed(pair[0])) setOrDelete(card(), pair[1], text(h[pair[0]]));
  });
  if (changed('port')) card().port = h.port ? String(h.port) : null;
  if (changed('services')) {
    card().services = h.services ? String(h.services).split(',').map(function (part) { return part.trim(); }).filter(Boolean) : [];
  }
  if (changed('arrivals')) {
    const before = Array.isArray(out.arrivals) ? out.arrivals : [];
    out.arrivals = (h.arrivals || []).map(function (host) {
      const kept = before.find(function (item) { return item && item.from_hostname === host; });
      return kept || { from_hostname: host, route_id: '' };
    });
  }
  if (changed('epoch')) {
    // Rewording the epoch changes its label only. Its date stays.
    if (isPlainObject(out.epoch)) out.epoch.label = text(h.epoch);
    else setOrDelete(out, 'epoch', text(h.epoch));
  }
  if (changed('reference_label') || changed('reference_deg')) {
    const refRaw = h.reference_deg == null || h.reference_deg === '' ? 0 : h.reference_deg;
    const ref = parseAngleDeg(refRaw);
    if (!ref.ok || ref.empty) throw new Error('reference_direction.deg is not a valid angle.');
    const label = h.reference_label == null || String(h.reference_label).trim() === ''
      ? REFERENCE_LABEL
      : String(h.reference_label).trim();
    out.reference_direction = Object.assign(isPlainObject(out.reference_direction) ? out.reference_direction : {}, { label: label, deg: ref.value });
  }
  return out;
}

// Keys the form adds to a body. They are written into `orbit`, or dropped.
const FORM_ONLY = ['au', 'period', 'unit', 'distanceKm', 'position_angle_deg', 'perihelion_longitude_deg', 'moons', 'generated', 'angle_error'];
// Free-text facts the form offers. A blank one is not written.
const FORM_FACTS = ['gravity', 'atmosphere', 'water', 'temperature', 'day', 'population', 'government', 'tech', 'concept', 'pressure', 'o2', 'co2'];

function periodDays(period, unit, what) {
  const value = formNumber(period, what);
  if (value == null) return null;
  return unit === 'days' ? value : value * YEAR_DAYS;
}

// One body as version 2. Only the fields the form changed are written over
// what the file had. Moons nested in the form come back as bodies after it.
function exportBody(body, parentId, list) {
  const name = (body && (body.name || body.id)) || 'A body';
  const out = copyJson(body) || {};
  FORM_ONLY.forEach(function (key) { delete out[key]; });
  FORM_FACTS.forEach(function (key) {
    if (out[key] === '' || out[key] == null) delete out[key];
  });
  if (parentId != null && (out.parent == null || out.parent === '')) out.parent = parentId;
  const orbit = isPlainObject(out.orbit) ? out.orbit : {};
  out.orbit = orbit;
  // What the form would show for the stored orbit. A field that still shows
  // that was not edited, so the stored value is kept exactly.
  const was = manualBodyFromSystem({ orbit: isPlainObject(body.orbit) ? body.orbit : {} });
  if (text(body.au).trim() !== text(was.au)) setOrDelete(orbit, 'a_au', formNumber(body.au, name + ': distance (AU)'));
  if (text(body.distanceKm).trim() !== text(was.distanceKm)) setOrDelete(orbit, 'a_km', formNumber(body.distanceKm, name + ': distance (km)'));
  const unit = body.unit || 'years';
  const wasUnit = was.unit || 'years';
  if (text(body.period).trim() !== text(was.period) || (text(body.period).trim() !== '' && unit !== wasUnit)) {
    setOrDelete(orbit, 'period_days', periodDays(body.period, unit, name + ': period'));
  }
  ANGLE_FIELDS.forEach(function (key) {
    if (text(body[key]).trim() === text(was[key])) return;
    if (body[key] == null || String(body[key]).trim() === '') {
      delete orbit[key];
      return;
    }
    const parsed = parseAngleDeg(body[key]);
    if (!parsed.ok || parsed.empty) throw new Error(name + ': ' + key + ' is not a valid angle.');
    orbit[key] = parsed.value;
  });
  list.push(out);
  (Array.isArray(body.moons) ? body.moons : []).forEach(function (moon) {
    exportBody(moon, out.id, list);
  });
}

export function systemRecordFromManual(header, bodies) {
  const out = headerRecord(header || {});
  const list = [];
  (bodies || []).forEach(function (body) { exportBody(body || {}, null, list); });
  out.bodies = list;
  return out;
}

export function manualBodyFromSystem(body) {
  const source = body && typeof body === 'object' ? body : {};
  const next = Object.assign({}, source);
  const orbit = source.orbit || {};
  const heliocentric = typeof orbit.a_au === 'number' && Number.isFinite(orbit.a_au);
  if ((next.au == null || next.au === '') && heliocentric) {
    next.au = String(orbit.a_au);
  }
  if (heliocentric && (next.period == null || next.period === '') && typeof orbit.period_days === 'number' && Number.isFinite(orbit.period_days)) {
    next.period = String(orbit.period_days);
    if (!next.unit) next.unit = 'days';
  }
  const posText = angleText(orbit.position_angle_deg);
  const periText = angleText(orbit.perihelion_longitude_deg);
  if ((next.position_angle_deg == null || next.position_angle_deg === '') && posText != null) {
    next.position_angle_deg = posText;
  }
  if ((next.perihelion_longitude_deg == null || next.perihelion_longitude_deg === '') && periText != null) {
    next.perihelion_longitude_deg = periText;
  }
  if (typeof next.position_angle_deg === 'number') next.position_angle_deg = String(next.position_angle_deg);
  if (typeof next.perihelion_longitude_deg === 'number') next.perihelion_longitude_deg = String(next.perihelion_longitude_deg);
  if (Array.isArray(next.moons)) {
    next.moons = next.moons.map(function (moon) { return manualBodyFromSystem(moon); });
  }
  return next;
}

if (typeof window !== 'undefined') {
  window.OrbitBuilderLink = {
    VIEWER_SYSTEM_ID: VIEWER_SYSTEM_ID,
    STAR_OBJECT_ID: STAR_OBJECT_ID,
    OPEN_LABEL: OPEN_LABEL,
    builderHref: builderHref,
    parseBuilderHash: parseBuilderHash,
    focusTarget: focusTarget,
    cardLinks: cardLinks,
    manualBodyFromSystem: manualBodyFromSystem,
    manualHeaderFromSystem: manualHeaderFromSystem,
    systemRecordFromManual: systemRecordFromManual,
    checkSystem: checkSystem,
    parseAngleDeg: parseAngleDeg,
    randomAngleDeg: randomAngleDeg,
    randomizeManualAngles: randomizeManualAngles
  };
}
