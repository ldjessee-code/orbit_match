// Two-body positions and transfers. Length in, length out. Days in, days out.
// SI constants match the concept generator so the 481-day Hohmann card stays put.

const TAU = 2 * Math.PI;
const AU_M = 1.495978707e11;
const MU_SUN_M3_S2 = 1.32712440018e20;
const DAY_S = 86400;

export { AU_M, MU_SUN_M3_S2, DAY_S };

function wrap(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

function wrapDeg(deg) {
  let full = ((deg % 360) + 360) % 360;
  if (Object.is(full, -0) || full === 360) full = 0;
  return full;
}

function finishAngle(parsed) {
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 360) {
    return { ok: false, empty: false, value: null, error: 'Enter a number from 0 to 360.' };
  }
  let rounded = Math.round(parsed * 100) / 100;
  if (parsed === 360 || rounded >= 360) rounded = 0;
  if (Object.is(rounded, -0)) rounded = 0;
  return { ok: true, empty: false, value: rounded };
}

// Degrees in the system plane. 360 is the same direction as 0. Text is rejected.
export function parseAngleDeg(value) {
  if (value == null) return { ok: true, empty: true, value: null };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, empty: false, value: null, error: 'Enter a number from 0 to 360.' };
    }
    return finishAngle(value);
  }
  const text = String(value).trim();
  if (text === '') return { ok: true, empty: true, value: null };
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    return { ok: false, empty: false, value: null, error: 'Enter a number from 0 to 360.' };
  }
  return finishAngle(Number(text));
}

// Uniform over 0.00 to 359.99. rng returns a number in [0, 1). 1 still stays below 360.
export function randomAngleDeg(rng) {
  const next = typeof rng === 'function' ? rng : Math.random;
  let roll = Number(next());
  if (!Number.isFinite(roll)) throw new Error('rng did not return a number');
  if (roll < 0) roll = 0;
  if (roll >= 1) return 359.99;
  let index = Math.floor(roll * 36000);
  const nearest = Math.round(roll * 36000);
  if (nearest !== index && Math.abs(roll * 36000 - nearest) < 1e-6) index = nearest;
  if (index < 0) index = 0;
  if (index > 35999) index = 35999;
  return index / 100;
}

function trueToEccentric(nu, e) {
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);
  const denom = 1 + e * cosNu;
  const root = Math.sqrt(Math.max(0, 1 - e * e));
  return Math.atan2((root * sinNu) / denom, (e + cosNu) / denom);
}

function eccentricToTrue(E, e) {
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const denom = 1 - e * cosE;
  const root = Math.sqrt(Math.max(0, 1 - e * e));
  return Math.atan2((root * sinE) / denom, (cosE - e) / denom);
}

// True longitude at epoch is position_angle_deg. Perihelion longitude is the
// same zero. tDays is days after that epoch. e = 0 ignores perihelion.
export function positionFromAngles(orbit, tDays) {
  const src = orbit || {};
  const e = src.e > 0 ? src.e : 0;
  let a = src.a;
  if (a == null) a = src.a_au;
  if (a == null) a = src.a_km;
  const period = src.period_days;
  const positionDeg = src.position_angle_deg || 0;
  const periDeg = src.perihelion_longitude_deg || 0;
  const refDeg = src.reference_deg || 0;
  const t = tDays || 0;
  const nu0 = ((positionDeg - periDeg) * Math.PI) / 180;
  const E0 = e === 0 ? wrap(nu0) : trueToEccentric(nu0, e);
  const M0 = e === 0 ? E0 : wrap(E0 - e * Math.sin(E0));
  const w = (periDeg * Math.PI) / 180;
  const span = period > 0 ? period : 1;
  const spot = pos({ a: a, e: e, period_days: span, M0: M0, w: w }, period > 0 ? t : 0);
  const motion = period > 0 ? (TAU * t) / period : 0;
  const E = solveKepler(M0 + motion, e);
  const nu = e === 0 ? wrap(E) : eccentricToTrue(E, e);
  const trueLon = wrapDeg((nu * 180) / Math.PI + periDeg);
  const rot = (refDeg * Math.PI) / 180;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const x = spot.x * c - spot.y * s;
  const y = spot.x * s + spot.y * c;
  return { x: x, y: y, true_longitude_deg: trueLon, radius: Math.hypot(x, y) };
}

export function solveKepler(meanAnomaly, eccentricity) {
  const e = eccentricity || 0;
  let M = wrap(meanAnomaly);
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 60; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

export function pos(orbit, tDays) {
  const e = orbit.e || 0;
  const a = orbit.a;
  const period = orbit.period_days;
  const M0 = orbit.M0 || 0;
  const w = orbit.w || 0;
  const E = solveKepler(M0 + TAU * tDays / period, e);
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const c = Math.cos(w);
  const s = Math.sin(w);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function vel(orbit, tDays) {
  const h = 1e-4;
  const before = pos(orbit, tDays - h);
  const after = pos(orbit, tDays + h);
  return { x: (after.x - before.x) / (2 * h), y: (after.y - before.y) / (2 * h) };
}

function velArray(fn, tDays) {
  const h = 1e-4;
  const before = fn(tDays - h);
  const after = fn(tDays + h);
  return [(after[0] - before[0]) / (2 * h), (after[1] - before[1]) / (2 * h)];
}

export function hohmann(r1, r2, mu) {
  const at = (r1 + r2) / 2;
  return {
    tof: Math.PI * Math.sqrt((at ** 3) / mu),
    dv1: Math.abs(Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1)),
    dv2: Math.abs(Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)))),
    at: at,
    e: Math.abs(r2 - r1) / (r1 + r2)
  };
}

export function hohmannDays(r1Au, r2Au, massSolar) {
  const hop = hohmann(r1Au * AU_M, r2Au * AU_M, MU_SUN_M3_S2 * massSolar);
  return {
    days: hop.tof / DAY_S,
    dv1_km_s: hop.dv1 / 1000,
    dv2_km_s: hop.dv2 / 1000,
    at_au: hop.at / AU_M,
    e: hop.e
  };
}

function burnCoastBurn(r0, v0, rT, vT, T, tb) {
  const dr = [rT[0] - r0[0] - v0[0] * T, rT[1] - r0[1] - v0[1] * T];
  const dv = [vT[0] - v0[0], vT[1] - v0[1]];
  const a1 = [0, 1].map(function (k) { return (dr[k] / tb - dv[k] / 2) / (T - tb); });
  const a2 = [0, 1].map(function (k) { return dv[k] / tb - a1[k]; });
  return {
    a1: a1,
    a2: a2,
    amax: Math.max(Math.hypot(a1[0], a1[1]), Math.hypot(a2[0], a2[1])),
    dvUsed: (Math.hypot(a1[0], a1[1]) + Math.hypot(a2[0], a2[1])) * tb
  };
}

// depFn and tgtFn take days and return [x, y]. S converts that length to metres.
// acc is m/s^2. budget is m/s. Gravity is left out; the card says ballpark.
export function fusionMatched(depFn, tgtFn, t0Days, acc, budget, S) {
  const r0 = depFn(t0Days).map(function (x) { return x * S; });
  const v0 = velArray(depFn, t0Days).map(function (x) { return x * S / DAY_S; });
  const stateAt = function (T) {
    const td = t0Days + T / DAY_S;
    return [
      tgtFn(td).map(function (x) { return x * S; }),
      velArray(tgtFn, td).map(function (x) { return x * S / DAY_S; })
    ];
  };
  const tbFor = function (T) { return Math.min(T / 2, budget / (2 * acc)); };
  const need = function (T) {
    const ends = stateAt(T);
    return burnCoastBurn(r0, v0, ends[0], ends[1], T, tbFor(T)).amax;
  };
  let lo = 1000;
  let hi = 2000;
  let guard = 0;
  while (need(hi) > acc && guard < 40) {
    hi *= 1.5;
    guard += 1;
  }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (need(mid) > acc) lo = mid;
    else hi = mid;
  }
  const T = hi;
  const tb = tbFor(T);
  const ends = stateAt(T);
  const solved = burnCoastBurn(r0, v0, ends[0], ends[1], T, tb);
  const at = function (t) {
    let p = [r0[0], r0[1]];
    let v = [v0[0], v0[1]];
    const seg = function (dt, a) {
      p = [
        p[0] + v[0] * dt + 0.5 * a[0] * dt * dt,
        p[1] + v[1] * dt + 0.5 * a[1] * dt * dt
      ];
      v = [v[0] + a[0] * dt, v[1] + a[1] * dt];
    };
    seg(Math.min(t, tb), solved.a1);
    if (t > tb) {
      seg(Math.min(t, T - tb) - tb, [0, 0]);
      if (t > T - tb) seg(t - (T - tb), solved.a2);
    }
    return [p[0] / S, p[1] / S];
  };
  return {
    T: T,
    days: T / DAY_S,
    tb: tb,
    at: at,
    dvUsed: solved.dvUsed,
    arrive: tgtFn(t0Days + T / DAY_S)
  };
}

if (typeof window !== 'undefined') {
  window.OrbitKepler = {
    parseAngleDeg: parseAngleDeg,
    randomAngleDeg: randomAngleDeg,
    positionFromAngles: positionFromAngles,
    solveKepler: solveKepler,
    pos: pos
  };
}
