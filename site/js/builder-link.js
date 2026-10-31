import { parseAngleDeg, randomAngleDeg } from './kepler.js';

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

function plainNum(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function exportManualBody(body) {
  const next = Object.assign({}, body || {});
  delete next.angle_error;
  for (let i = 0; i < ANGLE_FIELDS.length; i++) {
    const key = ANGLE_FIELDS[i];
    if (next[key] == null || next[key] === '') {
      delete next[key];
      continue;
    }
    const parsed = parseAngleDeg(next[key]);
    if (!parsed.ok || parsed.empty) throw new Error(key + ' is not a valid angle.');
    next[key] = parsed.value;
  }
  if (Array.isArray(next.moons)) {
    next.moons = next.moons.map(function (moon) { return exportManualBody(moon); });
  }
  return next;
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

function epochForSave(header) {
  const obj = header.epoch_object;
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && String(header.epoch || '') === String(obj.label || '')) {
    return obj;
  }
  if (header.epoch == null) return '';
  return String(header.epoch);
}

export function manualHeaderFromSystem(system) {
  const src = system || {};
  const epoch = src.epoch;
  let text = '';
  let epochObject = null;
  if (typeof epoch === 'string') text = epoch;
  else if (epoch && typeof epoch === 'object' && !Array.isArray(epoch)) {
    epochObject = epoch;
    text = epoch.label == null ? '' : String(epoch.label);
  }
  const ref = src.reference_direction;
  let label = REFERENCE_LABEL;
  let deg = '0';
  if (typeof ref === 'string' && ref.trim()) label = ref.trim();
  else if (ref && typeof ref === 'object' && !Array.isArray(ref)) {
    if (ref.label != null && String(ref.label).trim() !== '') label = String(ref.label);
    if (ref.deg != null && ref.deg !== '') deg = String(ref.deg);
  }
  return {
    epoch: text,
    epoch_object: epochObject,
    reference_label: label,
    reference_deg: deg
  };
}

export function systemRecordFromManual(header, bodies) {
  const h = header || {};
  const refRaw = h.reference_deg == null || h.reference_deg === '' ? 0 : h.reference_deg;
  const ref = parseAngleDeg(refRaw);
  if (!ref.ok || ref.empty) throw new Error('reference_direction.deg is not a valid angle.');
  const label = h.reference_label == null || String(h.reference_label).trim() === ''
    ? REFERENCE_LABEL
    : String(h.reference_label).trim();
  return {
    orbit_match: 1,
    kind: 'system',
    epoch: epochForSave(h),
    reference_direction: { label: label, deg: ref.value },
    star: {
      hostname: h.hostname,
      setting_name: h.setting_name,
      spectype: h.spectype,
      mass_solar: plainNum(h.mass),
      lum_log: plainNum(h.lum),
      teff_k: plainNum(h.teff),
      radius_solar: plainNum(h.rad),
      x_ly: plainNum(h.x),
      y_ly: plainNum(h.y),
      z_ly: plainNum(h.z)
    },
    known_planet_count: plainNum(h.planets),
    card: {
      high_concept: h.concept,
      port: h.port || null,
      services: h.services ? String(h.services).split(',').map(function (part) { return part.trim(); }).filter(Boolean) : [],
      holder: h.holder,
      fuel: h.fuel,
      fuel_unit: h.fuel_unit
    },
    arrivals: (h.arrivals || []).map(function (host) { return { from_hostname: host, route_id: '' }; }),
    bodies: (bodies || []).map(function (body) { return exportManualBody(body); })
  };
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
    parseAngleDeg: parseAngleDeg,
    randomAngleDeg: randomAngleDeg,
    randomizeManualAngles: randomizeManualAngles
  };
}
