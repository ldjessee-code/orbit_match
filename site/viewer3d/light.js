export const TAU_CETI_LIGHT_K = 5344;

export const LIGHTING = {
  kelvin: 5344,
  ambient: 0.16,
  keyIntensity: 2.2,
  pointIntensity: 1.2,
  pointDistance: 0,
  pointDecay: 2,
  // Full width of the star sprite. Half of this is the disc radius. Keep that
  // radius under the nearest planet surface. The sprite has one depth, so a
  // disc that reaches a planet cuts a hard circle into the lit face.
  glowScale: 2.4
};

function channel(value) {
  let sample = value;
  if (sample < 0) sample = 0;
  if (sample > 255) sample = 255;
  return sample / 255;
}

export function blackbodySrgb(kelvin) {
  let temperature = kelvin;
  if (!Number.isFinite(temperature) || temperature < 1000) temperature = TAU_CETI_LIGHT_K;
  const t = temperature / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return { r: channel(r), g: channel(g), b: channel(b) };
}

export function keyLightViewOffset() {
  return { x: -1, y: 1, z: 1 };
}

// 1/d^decay model of the star point light. The key light must stay brighter
// than this on the innermost schematic orbit (scene radius 1.6).
export function pointLightLuminance(distance) {
  const d = distance > 0 ? distance : 0.01;
  const falloff = 1 / Math.max(Math.pow(d, LIGHTING.pointDecay), 0.01);
  return LIGHTING.pointIntensity * falloff;
}

export function starGlowStops() {
  return [
    { t: 0, rgba: [1, 1, 1, 1] },
    { t: 0.22, rgba: [1, 0.91, 0.72, 0.8] },
    { t: 1, rgba: [1, 0.84, 0.5, 0] }
  ];
}
