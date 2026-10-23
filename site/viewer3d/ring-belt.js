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
    seed: belt.seed,
    features: belt.features
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
    features: Array.isArray(source.features) ? source.features : [],
    drawSolid: source.drawSolid === true,
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
      density: saved.density == null ? (band.density == null ? DENSITY_DEFAULT : band.density) : saved.density,
      dustiness: saved.dustiness == null ? (band.dustiness == null ? DUSTINESS_DEFAULT : band.dustiness) : saved.dustiness,
      follow: 'star',
      innerAu: band.innerAu,
      outerAu: band.outerAu,
      features: band.features || []
    }));
  });
  return list;
}

export function ringKmToScene(rKm, planetRadiusKm, displayRadius) {
  const r = Number(rKm);
  const planet = Number(planetRadiusKm);
  const display = Number(displayRadius);
  if (!(planet > 0) || !(display > 0) || !Number.isFinite(r)) return 0;
  return display * (r / planet);
}

function taggedValue(node) {
  if (node == null || typeof node !== 'object') {
    const n = Number(node);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof node.value === 'number' && Number.isFinite(node.value)) return node.value;
  if (typeof node.min === 'number' && typeof node.max === 'number' && node.min > 0 && node.max > 0) {
    return Math.sqrt(node.min * node.max);
  }
  if (typeof node.min === 'number' && Number.isFinite(node.min)) return node.min;
  if (typeof node.max === 'number' && Number.isFinite(node.max)) return node.max;
  return null;
}

function tauToDustiness(tau) {
  const t = taggedValue(tau);
  if (!Number.isFinite(t) || t <= 0) return 12;
  const logt = Math.log10(t);
  let dust = 8 + ((logt + 8) / 9) * 90;
  if (dust < 0) dust = 0;
  if (dust > 100) dust = 100;
  return dust;
}

function tauToCountShare(tau) {
  const t = taggedValue(tau);
  if (!Number.isFinite(t) || t <= 0) return 0.01;
  const logt = Math.log10(Math.max(t, 1e-8));
  let share = 0.008 + ((logt + 8) / 9) * 0.09;
  if (share < 0.006) share = 0.006;
  if (share > 0.12) share = 0.12;
  return share;
}

function bodyById(system, id) {
  return ((system && system.bodies) || []).find(function (item) { return item && item.id === id; }) || null;
}

export function cueBallRingSource(system) {
  const stored = system && system.rings_belts && system.rings_belts.cue_ball_ring_source;
  if (stored) return String(stored);
  const cue = bodyById(system, 'tc7');
  if (cue && cue.ring_system && Array.isArray(cue.ring_system.bands) && cue.ring_system.bands.length) {
    return 'data-belt';
  }
  return 'solid';
}

export function solidRingForBody(system, bodyId) {
  const body = bodyById(system, bodyId);
  if (!body) return false;
  const bands = body.ring_system && body.ring_system.bands;
  if (Array.isArray(bands)) {
    for (let i = 0; i < bands.length; i++) {
      if (bands[i] && bands[i].draw !== false) return false;
    }
  }
  return body.rings === true;
}

function bandInnerOuterKm(band) {
  const center = taggedValue(band.r_center_km);
  const width = taggedValue(band.width_km);
  if (center != null && width != null && width > 0) {
    return { innerKm: center - width / 2, outerKm: center + width / 2 };
  }
  return { innerKm: taggedValue(band.r_in_km), outerKm: taggedValue(band.r_out_km) };
}

export function planetRingsFromScene(system, scene) {
  const list = [];
  const sceneBodies = (scene && scene.bodies) || [];
  ((system && system.bodies) || []).forEach(function (src) {
    const ringSys = src.ring_system;
    if (!ringSys || !Array.isArray(ringSys.bands)) return;
    const sceneBody = sceneBodies.find(function (item) { return item && item.id === src.id; });
    if (!sceneBody) return;
    const planetKm = taggedValue(ringSys.planet_radius_km) || (src.physical && src.physical.radius_km);
    const display = sceneBody.radius;
    ringSys.bands.forEach(function (band, index) {
      if (!band || band.draw === false) return;
      const name = band.name == null ? '' : String(band.name);
      if (/gap/i.test(name) || name === 'phoebe_like') return;
      const km = bandInnerOuterKm(band);
      if (!(km.innerKm > 0) || !(km.outerKm > km.innerKm)) return;
      let innerR = ringKmToScene(km.innerKm, planetKm, display);
      let outerR = ringKmToScene(km.outerKm, planetKm, display);
      if (outerR < innerR) {
        const swap = innerR;
        innerR = outerR;
        outerR = swap;
      }
      if (outerR - innerR < 0.004) {
        const mid = (innerR + outerR) / 2;
        innerR = mid - 0.002;
        outerR = mid + 0.002;
      }
      const thickness = Math.max(display * 0.025, 0.006);
      list.push({
        id: src.id + '-' + name,
        name: (src.name || src.id) + ' ' + name,
        parentId: src.id,
        follow: 'planet',
        center: {
          x: sceneBody.position.x,
          y: sceneBody.position.y,
          z: sceneBody.position.z
        },
        innerRadius: innerR,
        outerRadius: outerR,
        thickness: thickness,
        inclination: 0,
        seed: SKY_SEED + 200 + index + (src.id === 'tc6' ? 0 : src.id === 'tc7' ? 20 : 40),
        density: DENSITY_DEFAULT,
        dustiness: tauToDustiness(band.tau),
        countShare: tauToCountShare(band.tau),
        drawSolid: false
      });
    });
  });
  return list;
}
