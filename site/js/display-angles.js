// One start-angle rule for both viewers. A stored angle is drawn exactly.
// A missing angle is a spread for reading. This module does not write the system.

const TAU = 2 * Math.PI;

export const ANGLE_MISSING_LINE = 'Start angle is not set. Shown as a spread for reading, not a canon angle.';

function storedStartRadians(body) {
  if (!body || body.kind === 'belt') return null;
  const orbit = body.orbit || {};
  if (typeof orbit.position_angle_deg === 'number') return (orbit.position_angle_deg * Math.PI) / 180;
  if (typeof body.angle_deg === 'number') return (body.angle_deg * Math.PI) / 180;
  if (typeof orbit.mean_anomaly_deg === 'number') return (orbit.mean_anomaly_deg * Math.PI) / 180;
  return null;
}

function heliocentricBodies(bodies) {
  return bodies.filter(function (body) {
    return body && body.parent == null && body.kind !== 'belt' && body.orbit && typeof body.orbit.a_au === 'number' && Number.isFinite(body.orbit.a_au);
  }).slice().sort(function (a, b) {
    return a.orbit.a_au - b.orbit.a_au || String(a.id).localeCompare(String(b.id));
  });
}

function childBodies(bodies, parentId) {
  return bodies.filter(function (body) {
    return body && body.parent === parentId && body.kind !== 'belt' && body.orbit && typeof body.orbit.a_km === 'number';
  }).slice().sort(function (a, b) {
    return (a.orbit.a_km || 0) - (b.orbit.a_km || 0) || String(a.id).localeCompare(String(b.id));
  });
}

function assignGroup(list, angles) {
  const count = list.length;
  list.forEach(function (body, index) {
    const stored = storedStartRadians(body);
    if (stored != null) angles.set(body.id, stored);
    else angles.set(body.id, (index / count) * TAU);
  });
  list.forEach(function (body) {
    if (storedStartRadians(body) != null) return;
    const partner = body.lagrange && body.lagrange.of;
    if (!partner || !angles.has(partner)) return;
    angles.set(body.id, angles.get(partner) + Math.PI / 3);
  });
}

export function displayAngleMap(system) {
  const angles = new Map();
  const data = system && typeof system === 'object' ? system : {};
  const bodies = Array.isArray(data.bodies) ? data.bodies : [];
  assignGroup(heliocentricBodies(bodies), angles);
  const parents = [];
  bodies.forEach(function (body) {
    if (!body || body.parent == null || parents.indexOf(body.parent) >= 0) return;
    parents.push(body.parent);
  });
  parents.forEach(function (parentId) {
    assignGroup(childBodies(bodies, parentId), angles);
  });
  return angles;
}
