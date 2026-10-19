// Reusable dust ring / belt. No three.js import.
// Catalog belts b1 and b2 keep the 60/40 split of the shared density table so the default look stays 4200 and 2800.
// Inclination is radians about +X (the line of nodes). Zero keeps the orbital plane on XZ, matching frame.toThree.
// An explicit thickness is the full slab and is not raised to the heliocentric floor. Omit it to use that floor.

import {
  DENSITY_DEFAULT,
  DENSITY_MAX,
  DENSITY_MIN,
  DUSTINESS_DEFAULT,
  DUSTINESS_MAX,
  DUSTINESS_MIN,
  SKY_SEED,
  beltHalfHeight,
  dustinessStyle,
  dustIsPickable,
  generateBeltSamples,
  pointCountForDensity,
  splitBeltCounts
} from './sky.js';

export { dustIsPickable };

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampDensity(density) {
  if (!Number.isFinite(Number(density))) return DENSITY_DEFAULT;
  let index = Math.round(Number(density));
  if (index < DENSITY_MIN) index = DENSITY_MIN;
  if (index > DENSITY_MAX) index = DENSITY_MAX;
  return index;
}

function clampDustiness(dustiness) {
  if (!Number.isFinite(Number(dustiness))) return DUSTINESS_DEFAULT;
  let value = Number(dustiness);
  if (value < DUSTINESS_MIN) value = DUSTINESS_MIN;
  if (value > DUSTINESS_MAX) value = DUSTINESS_MAX;
  return value;
}

export function ringPointCount(belt) {
  const source = belt || {};
  const total = pointCountForDensity(source.density);
  if (source.id === 'b2') return splitBeltCounts(total).kuiper;
  if (source.id === 'b1') return splitBeltCounts(total).asteroid;
  if (Number.isFinite(source.countShare)) {
    if (source.countShare <= 0) return 0;
    return Math.floor(total * source.countShare);
  }
  return total;
}

function poseSamples(positions, belt) {
  const count = positions.length / 3;
  const out = new Float32Array(positions.length);
  const cos = Math.cos(belt.inclination || 0);
  const sin = Math.sin(belt.inclination || 0);
  const cx = belt.center.x;
  const cy = belt.center.y;
  const cz = belt.center.z;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    out[i * 3] = x + cx;
    out[i * 3 + 1] = (y * cos - z * sin) + cy;
    out[i * 3 + 2] = (y * sin + z * cos) + cz;
  }
  return { positions: out, count: count };
}

function placeSamples(belt) {
  const local = generateBeltSamples({
    innerR: belt.innerRadius,
    outerR: belt.outerRadius,
    halfHeight: belt.thickness / 2,
    count: belt.count,
    seed: belt.seed
  });
  return Object.assign({}, belt, {
    local: local,
    world: poseSamples(local.positions, belt)
  });
}

function normalizeRingBelt(config) {
  const source = config || {};
  let inner = finiteOr(source.innerRadius, finiteOr(source.innerR, 0));
  let outer = finiteOr(source.outerRadius, finiteOr(source.outerR, inner));
  if (outer < inner) {
    const swap = inner;
    inner = outer;
    outer = swap;
  }
  let thickness = Number(source.thickness);
  if (!Number.isFinite(thickness) || thickness < 0) {
    thickness = beltHalfHeight(inner, outer) * 2;
  }
  const centerIn = source.center || {};
  const density = clampDensity(source.density);
  const dustiness = clampDustiness(source.dustiness);
  const countShare = Number.isFinite(Number(source.countShare)) ? Number(source.countShare) : null;
  return {
    id: source.id == null ? '' : String(source.id),
    name: source.name == null ? '' : String(source.name),
    center: {
      x: finiteOr(centerIn.x, 0),
      y: finiteOr(centerIn.y, 0),
      z: finiteOr(centerIn.z, 0)
    },
    innerRadius: inner,
    outerRadius: outer,
    thickness: thickness,
    inclination: finiteOr(source.inclination, 0),
    seed: Number.isFinite(Number(source.seed)) ? Number(source.seed) : SKY_SEED,
    density: density,
    dustiness: dustiness,
    follow: source.follow === 'planet' ? 'planet' : 'star',
    parentId: source.parentId == null ? null : String(source.parentId),
    countShare: countShare,
    innerAu: source.innerAu,
    outerAu: source.outerAu,
    style: dustinessStyle(dustiness)
  };
}

export function createRingBelt(config) {
  const belt = normalizeRingBelt(config);
  belt.count = ringPointCount(belt);
  return placeSamples(belt);
}

export function withDensity(belt, density) {
  const value = clampDensity(density);
  if (!belt || belt.density === value) return belt;
  const next = Object.assign({}, belt, { density: value });
  next.count = ringPointCount(next);
  return placeSamples(next);
}

export function withDustiness(belt, dustiness) {
  const value = clampDustiness(dustiness);
  if (!belt || belt.dustiness === value) return belt;
  return Object.assign({}, belt, {
    dustiness: value,
    style: dustinessStyle(value)
  });
}

export function updateRingBeltFrame(belt, parentPosition) {
  if (!belt || (belt.follow !== 'planet' && belt.follow !== 'star') || !parentPosition) return belt;
  const center = {
    x: finiteOr(parentPosition.x, belt.center.x),
    y: finiteOr(parentPosition.y, belt.center.y),
    z: finiteOr(parentPosition.z, belt.center.z)
  };
  if (center.x === belt.center.x && center.y === belt.center.y && center.z === belt.center.z) return belt;
  const next = Object.assign({}, belt, { center: center });
  next.world = poseSamples(belt.local.positions, next);
  return next;
}

export function ringBeltsFromBands(bands, settingsById) {
  const settings = settingsById || {};
  const list = [];
  (bands || []).forEach(function (band) {
    if (!band) return;
    const saved = settings[band.id] || {};
    list.push(createRingBelt({
      id: band.id,
      name: band.name,
      center: { x: 0, y: 0, z: 0 },
      innerRadius: band.innerR,
      outerRadius: band.outerR,
      thickness: Number(band.halfHeight) * 2,
      inclination: 0,
      seed: band.seed,
      density: saved.density == null ? DENSITY_DEFAULT : saved.density,
      dustiness: saved.dustiness == null ? DUSTINESS_DEFAULT : saved.dustiness,
      follow: 'star',
      innerAu: band.innerAu,
      outerAu: band.outerAu
    }));
  });
  return list;
}
