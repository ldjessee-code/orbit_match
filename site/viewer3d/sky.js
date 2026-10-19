// Pure starfield and dust-belt helpers. No three.js import: the page applies the mapping.

export const SKY_SEED = 20261017;

export const DENSITY_MIN = 0;
export const DENSITY_MAX = 4;
export const DENSITY_DEFAULT = 2;
export const DENSITY_COUNTS = [0, 3000, 7000, 14000, 24000];

export const DUSTINESS_MIN = 0;
export const DUSTINESS_MAX = 100;
export const DUSTINESS_DEFAULT = 40;

export const BELT_HEIGHT_FRACTION = 0.28;

const DUST_PALETTE = [
  [0.58, 0.52, 0.44],
  [0.45, 0.40, 0.34],
  [0.64, 0.54, 0.40],
  [0.50, 0.47, 0.43],
  [0.38, 0.34, 0.30]
];

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointCountForDensity(density) {
  if (!Number.isFinite(density)) return DENSITY_COUNTS[DENSITY_DEFAULT];
  let index = Math.round(density);
  if (index < DENSITY_MIN) index = DENSITY_MIN;
  if (index > DENSITY_MAX) index = DENSITY_MAX;
  return DENSITY_COUNTS[index];
}

export function splitBeltCounts(total) {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const kuiper = Math.floor(count * 0.4);
  return { asteroid: count - kuiper, kuiper: kuiper, total: count };
}

export function dustinessStyle(dustiness) {
  const raw = Number.isFinite(dustiness) ? dustiness : DUSTINESS_DEFAULT;
  const t = clamp(raw, DUSTINESS_MIN, DUSTINESS_MAX) / 100;
  return {
    size: 0.02 + t * 0.12,
    opacity: 0.28 + t * 0.57,
    colorSpread: 0.05 + t * 0.4
  };
}

export function beltHalfHeight(innerR, outerR) {
  const width = Math.abs(Number(outerR) - Number(innerR));
  const half = (Number.isFinite(width) ? width : 0) * BELT_HEIGHT_FRACTION;
  if (half < 0.02) return 0.02;
  return half;
}

export function beltSeed(id) {
  if (id === 'b2') return SKY_SEED + 101;
  return SKY_SEED + 7;
}

export function dustIsPickable() {
  return false;
}

export function dustBands(belts) {
  const order = ['b1', 'b2'];
  const out = [];
  order.forEach(function (id) {
    const belt = (belts || []).find(function (item) { return item && item.id === id; });
    if (!belt) return;
    const innerIn = Number(belt.innerR);
    const outerIn = Number(belt.outerR);
    if (!Number.isFinite(innerIn) || !Number.isFinite(outerIn)) return;
    const innerR = Math.min(innerIn, outerIn);
    const outerR = Math.max(innerIn, outerIn);
    out.push({
      id: belt.id,
      name: belt.name,
      innerAu: belt.innerAu,
      outerAu: belt.outerAu,
      innerR: innerR,
      outerR: outerR,
      halfHeight: beltHalfHeight(innerR, outerR),
      seed: beltSeed(belt.id)
    });
  });
  return out;
}

export function generateBeltSamples(spec) {
  const source = spec || {};
  const countIn = Number(source.count);
  const count = Number.isFinite(countIn) && countIn > 0 ? Math.floor(countIn) : 0;
  let inner = Number(source.innerR);
  let outer = Number(source.outerR);
  if (!Number.isFinite(inner)) inner = 0;
  if (!Number.isFinite(outer)) outer = inner;
  if (outer < inner) {
    const swap = inner;
    inner = outer;
    outer = swap;
  }
  let half = Number(source.halfHeight);
  if (!Number.isFinite(half) || half < 0) half = beltHalfHeight(inner, outer);
  const seed = Number.isFinite(source.seed) ? source.seed : SKY_SEED;
  const positions = new Float32Array(count * 3);
  const palette = new Uint8Array(count);
  const jitter = new Float32Array(count);
  const rng = mulberry32(seed);
  const span = outer - inner;
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radialU = (rng() + rng() + rng()) / 3;
    const heightU = (rng() + rng() + rng()) / 3;
    let radius = inner + span * radialU;
    let y = (heightU - 0.5) * 2 * half;
    if (radius < inner) radius = inner;
    if (radius > outer) radius = outer;
    if (y > half) y = half;
    if (y < -half) y = -half;
    // Orbital plane is XZ. Negative sine matches frame.toThree.
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = -Math.sin(angle) * radius;
    palette[i] = Math.floor(rng() * DUST_PALETTE.length);
    jitter[i] = rng() * 2 - 1;
  }
  return {
    count: count,
    positions: positions,
    palette: palette,
    jitter: jitter,
    innerR: inner,
    outerR: outer,
    halfHeight: half,
    seed: seed
  };
}

export function writeBeltColors(paletteIndex, jitter, colorSpread, out, offset) {
  const count = DUST_PALETTE.length;
  let index = Math.floor(Number(paletteIndex) || 0) % count;
  if (index < 0) index += count;
  const base = DUST_PALETTE[index];
  const spread = Number(colorSpread) || 0;
  const shift = Number(jitter) || 0;
  const at = offset || 0;
  out[at] = clamp01(base[0] + shift * spread);
  out[at + 1] = clamp01(base[1] + shift * spread * 0.75);
  out[at + 2] = clamp01(base[2] + shift * spread * 0.45);
}

export function starfieldSpec() {
  return {
    width: 1024,
    height: 512,
    seed: SKY_SEED,
    mapping: 'EquirectangularReflectionMapping'
  };
}

export function backgroundRecord(width, height) {
  if (width !== height * 2 || height < 2) {
    throw new Error('starfield texture must be equirectangular 2:1');
  }
  return {
    width: width,
    height: height,
    aspect: 2,
    mapping: 'EquirectangularReflectionMapping'
  };
}

function writeSkyPixel(rgba, width, height, x, y, r, g, b) {
  if (y < 0 || y >= height) return;
  const xx = ((x % width) + width) % width;
  const i = (y * width + xx) * 4;
  const nr = clamp(Math.round(r), 0, 255);
  const ng = clamp(Math.round(g), 0, 255);
  const nb = clamp(Math.round(b), 0, 255);
  if (nr + ng + nb < rgba[i] + rgba[i + 1] + rgba[i + 2]) return;
  rgba[i] = nr;
  rgba[i + 1] = ng;
  rgba[i + 2] = nb;
  rgba[i + 3] = 255;
}

export function starfieldRgba(width, height, seed) {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    rgba[offset] = 3;
    rgba[offset + 1] = 4;
    rgba[offset + 2] = 8;
    rgba[offset + 3] = 255;
  }
  const rng = mulberry32(seed >>> 0);
  const stars = Math.max(8, Math.round((width * height) / 240));
  for (let s = 0; s < stars; s++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const bright = Math.pow(rng(), 4);
    const mag = 36 + Math.floor(bright * 219);
    const temp = rng();
    let r;
    let g;
    let b;
    if (temp < 0.22) {
      r = mag * 0.70;
      g = mag * 0.84;
      b = mag;
    } else if (temp > 0.78) {
      r = mag;
      g = mag * 0.84;
      b = mag * 0.58;
    } else {
      r = mag * 0.96;
      g = mag * 0.97;
      b = mag;
    }
    writeSkyPixel(rgba, width, height, x, y, r, g, b);
    if (bright < 0.62) continue;
    const dim = bright < 0.85 ? 0.38 : 0.55;
    writeSkyPixel(rgba, width, height, x - 1, y, r * dim, g * dim, b * dim);
    writeSkyPixel(rgba, width, height, x + 1, y, r * dim, g * dim, b * dim);
    writeSkyPixel(rgba, width, height, x, y - 1, r * dim, g * dim, b * dim);
    writeSkyPixel(rgba, width, height, x, y + 1, r * dim, g * dim, b * dim);
  }
  return rgba;
}
