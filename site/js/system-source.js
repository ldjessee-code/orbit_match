// Prefer a lore system file. Otherwise build a star from a handoff or catalog row.
// Planet spheres come only from explicit planet records. exoplanet_count is a label.

import { loadSystem } from './schema.js';

export const PC_TO_LY = 3.26156;

const HANDOFF_KEYS = {
  starroute_handoff: true,
  kind: true,
  star_key: true,
  gaia_source_id: true,
  hyg_id: true,
  hip: true,
  hd: true,
  hostname: true,
  name: true,
  ra_deg: true,
  dec_deg: true,
  dist_pc: true,
  x: true,
  y: true,
  z: true,
  mag: true,
  bp_rp: true,
  ci: true,
  spect: true,
  has_known_exoplanets: true,
  exoplanet_count: true,
  sy_pnum: true,
  st_mass: true,
  mass_known: true,
  tier: true,
  turquenish_system: true,
  system_file: true,
  lore_version: true,
  rings_belts_version: true,
  system_file_sha256: true,
  belts: true,
  rings: true,
  planets: true,
  bodies: true
};

export function isLoreSystem(record) {
  return !!(record && typeof record === 'object' && !Array.isArray(record)
    && record.orbit_match != null && record.orbit_match !== ''
    && record.kind !== 'system_handoff');
}

export function isHandoff(record) {
  return !!(record && typeof record === 'object' && !Array.isArray(record)
    && record.kind === 'system_handoff');
}

export function safeSystemFile(name) {
  if (name == null || name === '') return null;
  const text = String(name).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.system\.json$/.test(text)) return null;
  return text;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function starFromHandoff(handoff) {
  const star = {
    hostname: handoff.hostname == null ? null : handoff.hostname,
    name: handoff.name == null ? null : handoff.name,
    setting_name: handoff.turquenish_system == null ? null : handoff.turquenish_system,
    spectype: handoff.spect == null ? null : handoff.spect,
    star_key: handoff.star_key == null ? null : handoff.star_key,
    gaia_source_id: handoff.gaia_source_id == null ? null : handoff.gaia_source_id,
    hyg_id: handoff.hyg_id == null ? null : handoff.hyg_id,
    hip: handoff.hip == null ? null : handoff.hip,
    hd: handoff.hd == null ? null : handoff.hd,
    render_mag: finite(handoff.mag),
    ra_deg: finite(handoff.ra_deg),
    dec_deg: finite(handoff.dec_deg),
    dist_pc: finite(handoff.dist_pc),
    bp_rp: finite(handoff.bp_rp),
    ci: finite(handoff.ci)
  };
  const x = finite(handoff.x);
  const y = finite(handoff.y);
  const z = finite(handoff.z);
  if (x != null) star.x_ly = x * PC_TO_LY;
  if (y != null) star.y_ly = y * PC_TO_LY;
  if (z != null) star.z_ly = z * PC_TO_LY;
  if (handoff.mass_known === false) {
    star.mass_known = false;
  } else if (finite(handoff.st_mass) != null) {
    star.mass_solar = finite(handoff.st_mass);
    if (handoff.mass_known === true) star.mass_known = true;
  }
  return star;
}

function explicitPlanets(handoff) {
  const list = [];
  if (Array.isArray(handoff.planets)) {
    handoff.planets.forEach(function (planet) {
      if (planet && typeof planet === 'object') list.push(planet);
    });
  }
  if (Array.isArray(handoff.bodies)) {
    handoff.bodies.forEach(function (body) {
      if (!body || typeof body !== 'object') return;
      if (body.kind === 'belt') return;
      list.push(body);
    });
  }
  return list;
}

function bodiesFromHandoff(handoff) {
  const bodies = [];
  explicitPlanets(handoff).forEach(function (planet) {
    const body = copy(planet);
    if (!body.kind) body.kind = 'planet';
    bodies.push(body);
  });
  (Array.isArray(handoff.belts) ? handoff.belts : []).forEach(function (belt, index) {
    if (!belt || typeof belt !== 'object') return;
    const body = {
      id: belt.id == null || belt.id === '' ? 'belt-' + (index + 1) : String(belt.id),
      name: belt.name == null ? 'Belt' : String(belt.name),
      kind: 'belt',
      parent: belt.parent == null ? null : belt.parent,
      orbit: {}
    };
    if (finite(belt.a_inner_au) != null) body.orbit.a_inner_au = finite(belt.a_inner_au);
    if (finite(belt.a_outer_au) != null) body.orbit.a_outer_au = finite(belt.a_outer_au);
    if (belt.display && typeof belt.display === 'object') body.display = copy(belt.display);
    if (belt.belt_structure && typeof belt.belt_structure === 'object') {
      body.belt_structure = copy(belt.belt_structure);
    }
    bodies.push(body);
  });
  return bodies;
}

function unmappedFields(handoff) {
  const extra = {};
  Object.keys(handoff).forEach(function (key) {
    if (!HANDOFF_KEYS[key]) extra[key] = handoff[key];
  });
  return extra;
}

function buildFromHandoff(handoff) {
  if (!isHandoff(handoff)) throw new Error('not a system handoff');
  const extra = unmappedFields(handoff);
  const system = {
    orbit_match: 2,
    kind: 'system',
    source: 'handoff',
    tier: Object.prototype.hasOwnProperty.call(handoff, 'tier') ? (handoff.tier == null ? null : handoff.tier) : null,
    exoplanet_count: handoff.exoplanet_count == null ? null : handoff.exoplanet_count,
    sy_pnum: handoff.sy_pnum == null ? null : handoff.sy_pnum,
    has_known_exoplanets: handoff.has_known_exoplanets === true,
    turquenish_system: handoff.turquenish_system == null ? null : handoff.turquenish_system,
    system_file: handoff.system_file == null ? null : handoff.system_file,
    star: starFromHandoff(handoff),
    bodies: bodiesFromHandoff(handoff),
    ring_notes: Array.isArray(handoff.rings) ? copy(handoff.rings) : []
  };
  if (handoff.lore_version != null) system.lore_version = handoff.lore_version;
  if (handoff.rings_belts_version != null) system.rings_belts_version = handoff.rings_belts_version;
  if (handoff.system_file_sha256 != null) system.system_file_sha256 = handoff.system_file_sha256;
  if (Object.keys(extra).length) system.unmapped = extra;
  return system;
}

export function systemFromHandoff(handoff) {
  return loadSystem(buildFromHandoff(handoff));
}

function catalogToHandoff(row) {
  const handoff = {
    starroute_handoff: '1',
    kind: 'system_handoff',
    star_key: row.star_key == null ? null : row.star_key,
    gaia_source_id: row.gaia_source_id == null ? null : row.gaia_source_id,
    hyg_id: row.hyg_id == null ? null : row.hyg_id,
    hip: row.hip == null ? null : row.hip,
    hd: row.hd == null ? null : row.hd,
    hostname: row.hostname || row.exo_hostname || row.proper || row.name || 'star',
    name: row.name || row.proper || row.hostname || row.exo_hostname || 'star',
    ra_deg: finite(row.ra_deg),
    dec_deg: finite(row.dec_deg),
    dist_pc: finite(row.dist_pc),
    mag: row.mag != null ? row.mag : row.render_mag,
    bp_rp: row.bp_rp == null ? null : row.bp_rp,
    ci: row.ci == null ? null : row.ci,
    spect: row.spect || row.spectype || row.st_spectype || null,
    has_known_exoplanets: row.has_known_exoplanets === true || Number(row.exoplanet_count) > 0,
    exoplanet_count: row.exoplanet_count == null ? null : row.exoplanet_count,
    sy_pnum: row.sy_pnum == null ? null : row.sy_pnum,
    st_mass: row.st_mass == null ? null : row.st_mass,
    mass_known: Object.prototype.hasOwnProperty.call(row, 'mass_known') ? row.mass_known : null,
    tier: Object.prototype.hasOwnProperty.call(row, 'tier') ? row.tier : null,
    turquenish_system: row.turquenish_system == null ? null : row.turquenish_system,
    system_file: row.system_file == null ? null : row.system_file,
    belts: Array.isArray(row.belts) ? row.belts : [],
    rings: Array.isArray(row.rings) ? row.rings : [],
    planets: Array.isArray(row.planets) ? row.planets : []
  };
  if (Array.isArray(row.bodies)) handoff.bodies = row.bodies;
  if (finite(row.x) != null) handoff.x = finite(row.x);
  else if (finite(row.calculated_x) != null) handoff.x = finite(row.calculated_x) / PC_TO_LY;
  if (finite(row.y) != null) handoff.y = finite(row.y);
  else if (finite(row.calculated_y) != null) handoff.y = finite(row.calculated_y) / PC_TO_LY;
  if (finite(row.z) != null) handoff.z = finite(row.z);
  else if (finite(row.calculated_z) != null) handoff.z = finite(row.calculated_z) / PC_TO_LY;
  return handoff;
}

export function systemFromCatalog(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('catalog row is missing');
  if (isLoreSystem(row)) {
    const loaded = loadSystem(row);
    loaded.source = 'lore';
    return loaded;
  }
  if (isHandoff(row)) return systemFromHandoff(row);
  const system = systemFromHandoff(catalogToHandoff(row));
  system.source = 'catalog';
  return system;
}

function fillMissing(target, incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  Object.keys(incoming).forEach(function (key) {
    if (incoming[key] == null || incoming[key] === '') return;
    if (target[key] == null || target[key] === '') target[key] = incoming[key];
  });
}

export function applyHandoffOverlay(system, handoff) {
  if (!system || !isHandoff(handoff)) return system;
  const star = system.star && typeof system.star === 'object' ? system.star : {};
  system.star = star;
  fillMissing(star, starFromHandoff(handoff));
  if ((system.tier == null || system.tier === '') && handoff.tier != null) system.tier = handoff.tier;
  if (system.exoplanet_count == null && handoff.exoplanet_count != null) {
    system.exoplanet_count = handoff.exoplanet_count;
  }
  if (system.sy_pnum == null && handoff.sy_pnum != null) system.sy_pnum = handoff.sy_pnum;
  if (system.turquenish_system == null && handoff.turquenish_system != null) {
    system.turquenish_system = handoff.turquenish_system;
  }
  return system;
}

export function resolveSystem(input) {
  const src = input || {};
  if (isLoreSystem(src.lore)) {
    const loaded = loadSystem(src.lore);
    if (isHandoff(src.handoff)) applyHandoffOverlay(loaded, src.handoff);
    else if (src.catalog && typeof src.catalog === 'object') {
      applyHandoffOverlay(loaded, catalogToHandoff(src.catalog));
    }
    loaded.source = 'lore';
    return loaded;
  }
  if (isHandoff(src.handoff)) {
    const system = systemFromHandoff(src.handoff);
    system.source = 'handoff';
    return system;
  }
  if (src.catalog && typeof src.catalog === 'object') return systemFromCatalog(src.catalog);
  throw new Error('no system source');
}
