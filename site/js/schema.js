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

function orbitFromV1(body) {
  const orbit = {};
  const au = num(body.au);
  const km = num(body.distanceKm);
  const period = num(body.period);
  if (au != null) orbit.a_au = au;
  if (km != null) orbit.a_km = km;
  if (period != null) {
    orbit.period_days = body.unit === 'days' ? period : period * YEAR_DAYS;
  }
  return orbit;
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
  for (const raw of src.bodies || []) {
    const moons = Array.isArray(raw.moons) ? raw.moons : [];
    const planet = Object.assign({}, raw);
    stripV1Orbit(planet);
    planet.parent = planet.parent == null ? null : planet.parent;
    planet.orbit = orbitFromV1(raw);
    bodies.push(planet);
    for (const moon of moons) {
      const flat = Object.assign({}, moon);
      stripV1Orbit(flat);
      flat.parent = raw.id;
      flat.orbit = orbitFromV1(moon);
      bodies.push(flat);
    }
  }
  return Object.assign({}, src, { orbit_match: 2, bodies: bodies });
}

function hasDistance(orbit) {
  if (!orbit) return false;
  return ['a_au', 'period_days', 'a_km', 'a_inner_au', 'a_outer_au'].some(function (key) {
    return typeof orbit[key] === 'number';
  });
}

function derivePeriod(body, massSolar) {
  const orbit = body.orbit;
  if (!orbit || orbit.period_days != null || typeof orbit.a_au !== 'number') return;
  const mass = typeof massSolar === 'number' && massSolar > 0 ? massSolar : 1;
  orbit.period_days = YEAR_DAYS * Math.sqrt((orbit.a_au * orbit.a_au * orbit.a_au) / mass);
}

function takeAngle(orbit, key) {
  if (!Object.prototype.hasOwnProperty.call(orbit, key)) return;
  const raw = orbit[key];
  if (raw == null || raw === '') {
    delete orbit[key];
    return;
  }
  const parsed = parseAngleDeg(raw);
  if (!parsed.ok || parsed.empty) throw new Error(key + ' is not a valid angle');
  orbit[key] = parsed.value;
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
  const mass = data.star.mass_solar;
  adoptEpoch(data);
  adoptReference(data);
  data.skipped = [];
  data.bodies = Array.isArray(data.bodies) ? data.bodies : [];
  for (const body of data.bodies) {
    body.orbit = body.orbit && typeof body.orbit === 'object' ? body.orbit : {};
    coerce(body.orbit, ORBIT_NUMBERS);
    if (body.physical && typeof body.physical === 'object') coerce(body.physical, PHYSICAL_NUMBERS);
    if (body.angle_deg != null) {
      const angle = num(body.angle_deg);
      if (angle != null) body.angle_deg = angle;
    }
    adoptAngles(body);
    derivePeriod(body, mass);
    if (!hasDistance(body.orbit)) {
      data.skipped.push({ id: body.id == null ? null : body.id, reason: 'no distance' });
    }
  }
  return data;
}

export function loadSystem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.orbit_match == null || input.orbit_match === '') {
    throw new Error('orbit_match version is missing');
  }
  const version = num(input.orbit_match);
  if (version == null) throw new Error('orbit_match version is missing');
  if (version > 2) throw new Error('orbit_match version ' + version + ' is not supported');
  const data = version < 2 ? migrateV1toV2(input) : copy(input);
  return normalize(data);
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
