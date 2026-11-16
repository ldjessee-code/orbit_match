import { parseAngleDeg } from './kepler.js';

const YEAR_DAYS = 365.25;
const ANGLE_KEYS = ['position_angle_deg', 'perihelion_longitude_deg'];
const ORBIT_NUMBERS = ['a_au', 'a_km', 'a_inner_au', 'a_outer_au', 'e', 'e_max', 'i_deg', 'period_days'];
const PHYSICAL_NUMBERS = ['radius_km', 'mass_earth', 'mass_kg', 'mass_solar', 'surface_g', 'rotation_h', 'tilt_deg'];
const STAR_NUMBERS = ['mass_solar', 'lum_solar', 'lum_log', 'teff_k', 'radius_solar', 'hz_inner_au', 'hz_outer_au', 'x_ly', 'y_ly', 'z_ly'];

export { YEAR_DAYS };

function num(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function coerce(obj, keys) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key) || obj[key] == null) continue;
    const parsed = num(obj[key]);
    if (parsed != null) obj[key] = parsed;
  }
}

// A period with no unit is in years for a planet and in days for a moon, as
// the builder shows it.
function orbitFromV1(body, isMoon) {
  const orbit = {};
  const au = num(body.au);
  const km = num(body.distanceKm);
  const period = num(body.period);
  if (au != null) orbit.a_au = au;
  if (km != null) orbit.a_km = km;
  if (period != null) {
    const unit = body.unit || (isMoon ? 'days' : 'years');
    orbit.period_days = unit === 'days' ? period : period * YEAR_DAYS;
  }
  return orbit;
}

// A version 1 body can already carry an orbit. Keep it, and let the flat
// version 1 fields win where both are set, since those are what the form edits.
function mergeOrbit(body, isMoon) {
  const kept = body.orbit && typeof body.orbit === 'object' && !Array.isArray(body.orbit) ? body.orbit : {};
  return Object.assign({}, kept, orbitFromV1(body, isMoon));
}

function stripV1Orbit(body) {
  delete body.au;
  delete body.period;
  delete body.unit;
  delete body.distanceKm;
  delete body.moons;
}

export function migrateV1toV2(input) {
  const src = copy(input);
  const bodies = [];
  // Moons, and moons of moons, follow their parent as flat bodies.
  const addMoons = function (owner) {
    const moons = Array.isArray(owner.moons) ? owner.moons : [];
    for (const moon of moons) {
      if (!moon || typeof moon !== 'object') continue;
      const flat = Object.assign({}, moon);
      stripV1Orbit(flat);
      flat.parent = owner.id;
      flat.orbit = mergeOrbit(moon, true);
      bodies.push(flat);
      addMoons(moon);
    }
  };
  for (const raw of src.bodies || []) {
    if (!raw || typeof raw !== 'object') {
      bodies.push(raw);
      continue;
    }
    const planet = Object.assign({}, raw);
    stripV1Orbit(planet);
    planet.parent = planet.parent == null ? null : planet.parent;
    planet.orbit = mergeOrbit(raw, raw.kind === 'moon');
    bodies.push(planet);
    addMoons(raw);
  }
  return Object.assign({}, src, { orbit_match: 2, bodies: bodies });
}

function hasDistance(orbit) {
  if (!orbit) return false;
  return ['a_au', 'period_days', 'a_km', 'a_inner_au', 'a_outer_au'].some(function (key) {
    return typeof orbit[key] === 'number';
  });
}

const AU_KM = 149597870.7;
const G_SI = 6.6743e-11;
const EARTH_KG = 5.9722e24;
const SUN_KG = 1.98847e30;

export { AU_KM };

function hasParent(body) {
  return body.parent != null && body.parent !== '';
}

// The mass of a body in kilograms, from whichever field the file has.
function bodyMassKg(body) {
  const physical = body && body.physical && typeof body.physical === 'object' ? body.physical : {};
  if (typeof physical.mass_kg === 'number' && physical.mass_kg > 0) return physical.mass_kg;
  if (typeof physical.mass_earth === 'number' && physical.mass_earth > 0) return physical.mass_earth * EARTH_KG;
  if (typeof physical.mass_solar === 'number' && physical.mass_solar > 0) return physical.mass_solar * SUN_KG;
  return null;
}

// A body around the star takes its period from the star's mass, and its
// distance from its period. A moon takes its period from its planet's mass,
// never from the star's. With no planet mass, the moon keeps no period.
function derivePeriod(body, massSolar, byId) {
  const orbit = body.orbit;
  if (!orbit) return;
  const mass = typeof massSolar === 'number' && massSolar > 0 ? massSolar : 1;
  if (!hasParent(body)) {
    if (typeof orbit.a_au !== 'number' && typeof orbit.a_km === 'number') orbit.a_au = orbit.a_km / AU_KM;
    if (typeof orbit.a_au !== 'number' && typeof orbit.period_days === 'number' && orbit.period_days > 0) {
      const years = orbit.period_days / YEAR_DAYS;
      orbit.a_au = Math.cbrt(years * years * mass);
    }
    if (orbit.period_days != null || typeof orbit.a_au !== 'number') return;
    orbit.period_days = YEAR_DAYS * Math.sqrt((orbit.a_au * orbit.a_au * orbit.a_au) / mass);
    return;
  }
  if (typeof orbit.a_km !== 'number' && typeof orbit.a_au === 'number') orbit.a_km = orbit.a_au * AU_KM;
  if (body.kind !== 'moon' || orbit.period_days != null || typeof orbit.a_km !== 'number') return;
  const parent = byId.get(body.parent);
  const kg = parent ? bodyMassKg(parent) : null;
  if (kg == null) return;
  const metres = orbit.a_km * 1000;
  orbit.period_days = 2 * Math.PI * Math.sqrt((metres * metres * metres) / (G_SI * kg)) / 86400;
}

// Degrees in the system plane, kept to the precision the file gave. 360 is the
// same direction as 0. A negative position angle, common in catalog data, is
// turned into 0 to 360.
function readAngle(raw, key) {
  let value = null;
  if (typeof raw === 'number') value = raw;
  else if (typeof raw === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) value = Number(raw.trim());
  if (value == null || !Number.isFinite(value)) return null;
  if (key === 'position_angle_deg' && value < 0 && value >= -360) value += 360;
  if (value < 0 || value > 360) return null;
  if (value === 360 || Object.is(value, -0)) value = 0;
  return value;
}

function takeAngle(orbit, key) {
  if (!Object.prototype.hasOwnProperty.call(orbit, key)) return;
  const raw = orbit[key];
  if (raw == null || raw === '') {
    delete orbit[key];
    return;
  }
  const value = readAngle(raw, key);
  if (value == null) throw new Error(key + ' is not a valid angle');
  orbit[key] = value;
}

function versionOf(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.orbit_match == null || input.orbit_match === '') {
    return { ok: false, message: 'orbit_match version is missing' };
  }
  const version = num(input.orbit_match);
  if (version == null) return { ok: false, message: 'orbit_match version is missing' };
  if (!Number.isInteger(version) || version < 1 || version > 2) {
    return { ok: false, message: 'orbit_match version ' + version + ' is not supported' };
  }
  return { ok: true, version: version };
}

const DISTANCE_KEYS = ['a_au', 'a_km', 'a_inner_au', 'a_outer_au', 'period_days'];

// Every problem in a system file, as { path, severity, message }. Severity
// "fatal" stops a load. "warning" loads, and the viewer shows the message.
export function validateSystem(input) {
  const issues = [];
  const add = function (path, severity, message) { issues.push({ path: path, severity: severity, message: message }); };
  const version = versionOf(input);
  if (!version.ok) {
    add('orbit_match', 'fatal', version.message);
    return issues;
  }
  const bodies = Array.isArray(input.bodies) ? input.bodies : [];
  const seen = new Set();
  const ids = new Set(bodies.filter(function (body) { return body && typeof body === 'object'; }).map(function (body) { return body.id; }));
  const star = input.star && typeof input.star === 'object' ? input.star : {};
  const mass = num(star.mass_solar);
  if (mass != null && mass <= 0) add('star.mass_solar', 'warning', 'The star mass must be more than 0. It is left out.');
  bodies.forEach(function (body, index) {
    const at = 'bodies[' + index + ']';
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      add(at, 'warning', 'An empty entry in bodies is left out.');
      return;
    }
    const name = body.name || body.id || at;
    if (body.id != null && seen.has(body.id)) add(at + '.id', 'warning', name + ': duplicate id "' + body.id + '".');
    seen.add(body.id);
    if (hasParent(body)) {
      if (body.parent === body.id) add(at + '.parent', 'warning', name + ': the parent is the body itself.');
      else if (!ids.has(body.parent)) add(at + '.parent', 'warning', name + ': the parent "' + body.parent + '" is not in this file.');
    }
    const orbit = body.orbit && typeof body.orbit === 'object' ? body.orbit : {};
    const e = num(orbit.e);
    if (e != null && (e < 0 || e >= 1)) add(at + '.orbit.e', 'warning', name + ': an eccentricity of ' + e + ' is not a closed orbit. It is drawn as a circle.');
    DISTANCE_KEYS.forEach(function (key) {
      const value = num(orbit[key]);
      if (value != null && value <= 0) add(at + '.orbit.' + key, 'warning', name + ': ' + key + ' must be more than 0. It is left out.');
    });
    ANGLE_KEYS.forEach(function (key) {
      const raw = orbit[key] != null && orbit[key] !== '' ? orbit[key] : body[key];
      if (raw == null || raw === '') return;
      if (readAngle(raw, key) == null) add(at + '.orbit.' + key, 'fatal', name + ': ' + key + ' is not a valid angle');
    });
  });
  return issues;
}

// Values the drawing cannot use come out of the working copy, and the reason
// stays in issues.
function dropBadValues(data) {
  if (typeof data.star.mass_solar === 'number' && data.star.mass_solar <= 0) delete data.star.mass_solar;
  for (const body of data.bodies) {
    const orbit = body.orbit;
    if (typeof orbit.e === 'number' && (orbit.e < 0 || orbit.e >= 1)) delete orbit.e;
    DISTANCE_KEYS.forEach(function (key) {
      if (typeof orbit[key] === 'number' && orbit[key] <= 0) delete orbit[key];
    });
  }
}

function adoptAngles(body) {
  const orbit = body.orbit;
  for (const key of ANGLE_KEYS) {
    const missing = orbit[key] == null || orbit[key] === '';
    if (missing && body[key] != null && body[key] !== '') orbit[key] = body[key];
    if (Object.prototype.hasOwnProperty.call(body, key)) delete body[key];
    takeAngle(orbit, key);
  }
}

function adoptReference(data) {
  if (!Object.prototype.hasOwnProperty.call(data, 'reference_direction') || data.reference_direction == null) return;
  const ref = data.reference_direction;
  if (typeof ref === 'string') {
    data.reference_direction = {
      label: ref.trim() || 'toward the vernal point / arbitrary',
      deg: 0
    };
    return;
  }
  if (typeof ref !== 'object' || Array.isArray(ref)) throw new Error('reference_direction is not valid');
  const label = ref.label == null || String(ref.label).trim() === ''
    ? 'toward the vernal point / arbitrary'
    : String(ref.label);
  let deg = 0;
  if (ref.deg != null && ref.deg !== '') {
    const parsed = parseAngleDeg(ref.deg);
    if (!parsed.ok || parsed.empty) throw new Error('reference_direction.deg is not a valid angle');
    deg = parsed.value;
  }
  data.reference_direction = { label: label, deg: deg };
}

function adoptEpoch(data) {
  if (!Object.prototype.hasOwnProperty.call(data, 'epoch') || data.epoch == null) return;
  if (typeof data.epoch === 'string') return;
  if (typeof data.epoch === 'object' && !Array.isArray(data.epoch)) {
    const raw = data.epoch.game_datetime;
    if (typeof raw === 'string') {
      const text = raw.trim();
      if (text) data.epoch.game_datetime = text;
      else delete data.epoch.game_datetime;
    } else if (Object.prototype.hasOwnProperty.call(data.epoch, 'game_datetime')) {
      delete data.epoch.game_datetime;
    }
    return;
  }
  if (typeof data.epoch === 'number' && Number.isFinite(data.epoch)) {
    data.epoch = String(data.epoch);
    return;
  }
  throw new Error('epoch is not valid');
}

function normalize(data) {
  data.orbit_match = 2;
  data.star = data.star && typeof data.star === 'object' ? data.star : {};
  coerce(data.star, STAR_NUMBERS);
  if (data.star.lum_solar != null && data.star.lum_log != null) data.luminosity_seen = 'both';
  else if (data.star.lum_solar != null) data.luminosity_seen = 'lum_solar';
  else if (data.star.lum_log != null) data.luminosity_seen = 'lum_log';
  adoptEpoch(data);
  adoptReference(data);
  data.skipped = [];
  data.bodies = (Array.isArray(data.bodies) ? data.bodies : []).filter(function (body) {
    return body && typeof body === 'object' && !Array.isArray(body);
  });
  const byId = new Map();
  for (const body of data.bodies) {
    body.orbit = body.orbit && typeof body.orbit === 'object' ? body.orbit : {};
    coerce(body.orbit, ORBIT_NUMBERS);
    if (body.physical && typeof body.physical === 'object') coerce(body.physical, PHYSICAL_NUMBERS);
    if (body.angle_deg != null) {
      const angle = num(body.angle_deg);
      if (angle != null) body.angle_deg = angle;
    }
    adoptAngles(body);
    if (!byId.has(body.id)) byId.set(body.id, body);
  }
  dropBadValues(data);
  const mass = data.star.mass_solar;
  for (const body of data.bodies) {
    derivePeriod(body, mass, byId);
    if (!hasDistance(body.orbit)) {
      data.skipped.push({ id: body.id == null ? null : body.id, reason: 'no distance' });
    }
  }
  return data;
}

export function loadSystem(input) {
  const version = versionOf(input);
  if (!version.ok) throw new Error(version.message);
  const issues = validateSystem(input);
  const data = version.version < 2 ? migrateV1toV2(input) : copy(input);
  const loaded = normalize(data);
  Object.defineProperty(loaded, 'issues', { value: issues, enumerable: false, writable: true, configurable: true });
  return loaded;
}

export function loadView(input) {
  if (!input || typeof input !== 'object' || input.orbit_match_view == null || input.orbit_match_view === '') {
    throw new Error('orbit_match_view version is missing');
  }
  const version = num(input.orbit_match_view);
  if (version !== 1) throw new Error('orbit_match_view version ' + input.orbit_match_view + ' is not supported');
  const view = copy(input);
  view.orbit_match_view = 1;
  if (view.style == null || view.style === '') view.style = 'quiet';
  if (view.theme == null || view.theme === '') view.theme = 'empire';
  if (typeof view.style !== 'string' || !view.style.trim()) throw new Error('view style is missing');
  if (typeof view.theme !== 'string' || !view.theme.trim()) throw new Error('view theme is missing');
  let elevation = view.elevation_deg == null ? 20 : num(view.elevation_deg);
  if (elevation == null) elevation = 20;
  if (elevation < 15) elevation = 15;
  if (elevation > 75) elevation = 75;
  view.elevation_deg = elevation;
  let azimuth = view.azimuth_deg == null ? 0 : num(view.azimuth_deg);
  if (azimuth == null) azimuth = 0;
  view.azimuth_deg = azimuth;
  if (!view.distance_mode) view.distance_mode = 'schematic';
  if (!view.legend_corner) view.legend_corner = 'tl';
  if (!Array.isArray(view.callouts)) view.callouts = [];
  if (view.callouts.length > 3) view.callouts = view.callouts.slice(0, 3);
  return view;
}
