// Orbital XY from kepler.pos maps to three.js Y-up as (x, 0, -y).

function zero(value) {
  if (!value) return 0;
  return value;
}

export function toThree(x, y) {
  return { x: zero(x), y: 0, z: zero(-y) };
}

export function clampElevation(deg) {
  if (!Number.isFinite(deg)) return 20;
  if (deg < 15) return 15;
  if (deg > 75) return 75;
  return deg;
}

export function cameraPose(elevationDeg, azimuthDeg, distance) {
  const elevation = clampElevation(elevationDeg);
  const azimuth = Number.isFinite(azimuthDeg) ? azimuthDeg : 0;
  const dist = typeof distance === 'number' && distance > 0 ? distance : 1;
  const elev = (elevation * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;
  const y = Math.sin(elev) * dist;
  const horizontal = Math.cos(elev) * dist;
  return {
    x: Math.sin(az) * horizontal,
    y: y,
    z: Math.cos(az) * horizontal,
    elevation_deg: elevation,
    azimuth_deg: azimuth,
    distance: dist
  };
}

export function polarLimits() {
  const deg = Math.PI / 180;
  return {
    minPolarAngle: 15 * deg,
    maxPolarAngle: 75 * deg
  };
}
