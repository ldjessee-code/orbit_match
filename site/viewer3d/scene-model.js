import { pos, hohmannDays } from '../js/kepler.js';
import { toThree, clampElevation, cameraPose } from './frame.js';
import { hohmannArc } from './transfer-arc.js';

const TAU = 2 * Math.PI;
const SYSTEM_RIN = 1.6;
const SYSTEM_FIT = 14;
const SYSTEM_DISTANCE = 28;
const CLOSE_DISTANCE = 18;
const CLOSE_SPAN = 8;

export const TRANSFER_LINE_THRESHOLD = 0.2;
export const TRANSFER_HIT_RADIUS = 1;
export const TRANSFER_HIT_REF_DISTANCE = 28;
export const TRANSFER_HIT_RADIUS_CAP = 1.8;

export function transferHitRadiusAt(cameraDistance) {
  const dist = Number(cameraDistance);
  if (!Number.isFinite(dist) || dist <= TRANSFER_HIT_REF_DISTANCE) return TRANSFER_HIT_RADIUS;
  const scaled = TRANSFER_HIT_RADIUS * (dist / TRANSFER_HIT_REF_DISTANCE);
  if (scaled > TRANSFER_HIT_RADIUS_CAP) return TRANSFER_HIT_RADIUS_CAP;
  return scaled;
}

export const THREE_MODULE_URL = 'https://unpkg.com/three@0.170.0/build/three.module.js';

export const FALLBACK = {
  heading: 'WebGL is not available',
  body: 'This page needs WebGL to draw the 3D system. The SVG system view still works.',
  href: '../viewer/',
  link: 'Open the SVG system view'
};

export function starDisplayColor(spectype) {
  const text = String(spectype == null ? '' : spectype).toUpperCase();
  const match = text.match(/G\s*([0-9])/);
  if (!match) return '#ffe0a0';
  const n = Number(match[1]);
  if (n <= 4) return '#fff0c8';
  return '#ffe0a0';
}

export function themeChrome(themeName) {
  if (themeName === 'mardat') {
    return {
      id: 'mardat',
      starStyle: 'fiery',
      starColor: '#ffcf6e',
      space: { base: '#17143e', center: '#221c52', edge: '#0b0a24', dark: true },
      panel: '#6B6F76',
      text: '#f1f2f4',
      accent: '#ff2e48',
      title: '#173f96'
    };
  }
  return {
    id: 'empire',
    starStyle: 'soft',
    starColor: '#ffe0a0',
    space: { base: '#5a6270', center: '#687282', edge: '#4b525e', dark: false },
    panel: '#EEF1F5',
    text: '#12202b',
    accent: '#7FD3FF',
    title: '#7FD3FF'
  };
}

function byId(system, id) {
  return (system.bodies || []).find(function (body) { return body.id === id; });
}

function heliocentric(system) {
  return (system.bodies || []).filter(function (body) {
    return body.parent == null && body.kind !== 'belt' && body.orbit && typeof body.orbit.a_au === 'number' && Number.isFinite(body.orbit.a_au);
  }).slice().sort(function (a, b) {
    return a.orbit.a_au - b.orbit.a_au || String(a.id).localeCompare(String(b.id));
  });
}

function displayAngles(system) {
  const worlds = heliocentric(system);
  const angles = new Map();
  worlds.forEach(function (body, index) {
    const stored = body.orbit && body.orbit.mean_anomaly_deg;
    angles.set(body.id, typeof stored === 'number' ? (stored * Math.PI) / 180 : (index / worlds.length) * TAU);
  });
  worlds.forEach(function (body) {
    if (!body.lagrange || !body.lagrange.of || !angles.has(body.lagrange.of)) return;
    angles.set(body.id, angles.get(body.lagrange.of) + Math.PI / 3);
  });
  return angles;
}

function distanceKnots(system) {
  const distances = [];
  (system.bodies || []).forEach(function (body) {
    const orbit = body.orbit || {};
    if (typeof orbit.a_au === 'number' && orbit.a_au > 0) distances.push(orbit.a_au);
    if (typeof orbit.a_inner_au === 'number' && orbit.a_inner_au > 0) distances.push(orbit.a_inner_au);
    if (typeof orbit.a_outer_au === 'number' && orbit.a_outer_au > 0) distances.push(orbit.a_outer_au);
  });
  return distances;
}

function schematicMap(distances, rIn, fit) {
  const uniq = [];
  distances.filter(function (n) { return typeof n === 'number' && n > 0; }).sort(function (a, b) { return a - b; }).forEach(function (n) {
    if (!uniq.length || Math.abs(uniq[uniq.length - 1] - n) / n > 1e-6) uniq.push(n);
  });
  if (uniq.length < 2) {
    const edge = uniq[0] || 1;
    return function (r) { return rIn + (fit - rIn) * (r / edge); };
  }
  const lam = 0.45;
  const la = Math.log(uniq[0]);
  const lb = Math.log(uniq[uniq.length - 1]);
  const rho = uniq.map(function (a, i) {
    const u = ((i / (uniq.length - 1)) + lam * (Math.log(a) - la) / (lb - la)) / (1 + lam);
    return rIn + (fit - rIn) * u;
  });
  return function (r) {
    if (!(r > 0)) return 0;
    if (r <= uniq[0]) {
      const t = r / uniq[0];
      return rIn * Math.sqrt(t) + (rho[0] - rIn) * t;
    }
    for (let i = 1; i < uniq.length; i++) {
      if (r <= uniq[i]) {
        const t = (Math.log(r) - Math.log(uniq[i - 1])) / (Math.log(uniq[i]) - Math.log(uniq[i - 1]));
        return rho[i - 1] + t * (rho[i] - rho[i - 1]);
      }
    }
    return rho[rho.length - 1];
  };
}

function linearMap(distances, fit) {
  let maxAu = 0;
  distances.forEach(function (n) {
    if (typeof n === 'number' && n > maxAu) maxAu = n;
  });
  if (!(maxAu > 0)) maxAu = 1;
  return function (r) { return (r / maxAu) * fit; };
}

function placeAu(radial, x, y) {
  const r = Math.hypot(x, y);
  if (!(r > 0)) return toThree(0, 0);
  const scale = radial(r) / r;
  return toThree(x * scale, y * scale);
}

function sceneOrbitRadius(radial, aAu) {
  const placed = placeAu(radial, aAu, 0);
  return Math.hypot(placed.x, placed.z);
}

function taggedNum(node) {
  if (node == null || typeof node !== 'object') {
    const n = Number(node);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof node.value === 'number' && Number.isFinite(node.value)) return node.value;
  return null;
}

function beltFeaturesFromBody(body, radial) {
  const struct = body && body.belt_structure;
  if (!struct) return [];
  const features = [];
  (struct.gaps_au || []).forEach(function (item) {
    const au = taggedNum(item);
    if (!(au > 0)) return;
    const halfAu = taggedNum(item.half_width_au) || 0.015;
    const depth = taggedNum(item.depth);
    const radius = sceneOrbitRadius(radial, au);
    const edge = sceneOrbitRadius(radial, au + halfAu);
    features.push({
      type: 'gap',
      au: au,
      radius: radius,
      halfWidth: Math.abs(edge - radius),
      depth: depth == null ? 0.85 : depth
    });
  });
  const clumps = struct.resonant_clumps_with_eight_ball_au || {};
  ['3:2', '2:1'].forEach(function (key) {
    const node = clumps[key];
    if (!node || node.draw === false) return;
    const au = taggedNum(node);
    if (!(au > 0)) return;
    const halfAu = taggedNum(node.half_width_au) || (key === '3:2' ? 0.35 : 0.45);
    const gain = taggedNum(node.gain);
    const radius = sceneOrbitRadius(radial, au);
    const edge = sceneOrbitRadius(radial, au + halfAu);
    const feat = {
      type: 'clump',
      au: au,
      radius: radius,
      halfWidth: Math.abs(edge - radius),
      gain: gain == null ? 1.6 : gain
    };
    if (key === '3:2' && node.azimuthal) {
      feat.azimuthal = {
        n: taggedNum(node.azimuthal.n),
        phase: taggedNum(node.azimuthal.phase),
        gain: taggedNum(node.azimuthal.gain)
      };
    }
    features.push(feat);
  });
  return features;
}

function visualRadius(body) {
  const earth = 6371;
  const physical = body.physical || {};
  let radius = physical.radius_km;
  if (typeof radius !== 'number' || !Number.isFinite(radius)) radius = 3185.5;
  const raw = 1.6 * (8 + 5 * Math.pow(radius / earth, 0.4));
  let scene = raw / 80;
  if (!Number.isFinite(scene) || scene < 0.08) scene = 0.08;
  if (scene > 0.45) scene = 0.45;
  return scene;
}

function auText(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded) + ' AU';
}

function withCommas(value) {
  const negative = value < 0;
  const text = String(Math.abs(Math.round(value)));
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (i > 0 && (text.length - i) % 3 === 0) out += ',';
    out += text.charAt(i);
  }
  return negative ? '-' + out : out;
}

function bodyRecord(body, position, radius) {
  const orbit = body.orbit || {};
  const display = body.display || {};
  const record = {
    id: body.id,
    name: body.name,
    designation: body.designation == null ? '' : body.designation,
    kind: body.kind || '',
    parent: body.parent == null ? null : body.parent,
    color: display.color || '#9bb0c4',
    radius: radius,
    rings: body.rings === true,
    stripes: display.stripes === true,
    position: position,
    a_au: typeof orbit.a_au === 'number' ? orbit.a_au : null,
    e: orbit.e || 0,
    e_max: typeof orbit.e_max === 'number' ? orbit.e_max : null,
    period_days: typeof orbit.period_days === 'number' ? orbit.period_days : null,
    trueLabel: ''
  };
  if (typeof orbit.a_au === 'number') record.trueLabel = auText(orbit.a_au);
  else if (typeof orbit.a_km === 'number') record.trueLabel = withCommas(orbit.a_km) + ' km';
  if (typeof orbit.a_km === 'number') record.a_km = orbit.a_km;
  return record;
}

function epochLabel(system) {
  const epoch = system.epoch || {};
  let label = epoch.label || 'T+0 (circa 1600 yrs hence)';
  if (epoch.canon === 'placeholder' && label.indexOf('placeholder') < 0) label += ' (placeholder)';
  return label;
}

function layerOn(view, name) {
  return !view.layers || view.layers[name] !== false;
}

function distanceModeOf(view, options) {
  const raw = options && options.distance_mode ? options.distance_mode : view.distance_mode;
  if (raw === 'linear' || raw === 'true') return 'linear';
  return 'schematic';
}

function sameDistance(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
  return Math.abs(a - b) / scale <= 1e-6;
}

function sampleEllipse(a, e, period, m0, steps, mapPoint) {
  const span = period > 0 ? period : 1;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const spot = pos({ a: a, e: e || 0, period_days: span, M0: m0 || 0, w: 0 }, span * i / steps);
    points.push(mapPoint(spot.x, spot.y));
  }
  return points;
}

function circleAt(radius) {
  const points = [];
  const steps = 96;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * TAU;
    points.push(toThree(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return points;
}

export function buildScene(system, view, options) {
  const data = system || { bodies: [], star: {} };
  const spec = view || {};
  const opts = options || {};
  const requested = opts.frame && opts.frame !== 'system' ? opts.frame : 'system';
  const focus = requested === 'system' ? null : byId(data, requested);
  if (focus) return buildClose(data, spec, opts, focus);
  return buildSystem(data, spec, opts);
}

function buildSystem(system, view, options) {
  const mode = distanceModeOf(view, options);
  const knots = distanceKnots(system);
  const radial = mode === 'linear' ? linearMap(knots, SYSTEM_FIT) : schematicMap(knots, SYSTEM_RIN, SYSTEM_FIT);
  const angles = displayAngles(system);
  const worlds = heliocentric(system);
  const chrome = themeChrome(view.theme);
  const star = system.star || {};
  const starColor = chrome.id === 'mardat' ? chrome.starColor : starDisplayColor(star.spectype);
  const tDays = typeof view.epoch_days === 'number' ? view.epoch_days : 0;
  const bodies = worlds.map(function (body) {
    const orbit = body.orbit;
    const angle = angles.get(body.id) || 0;
    const spot = pos({
      a: orbit.a_au,
      e: orbit.e || 0,
      period_days: orbit.period_days || 365.25,
      M0: angle,
      w: 0
    }, tDays);
    return bodyRecord(body, placeAu(radial, spot.x, spot.y), visualRadius(body));
  });
  const orbits = [];
  if (layerOn(view, 'orbits')) {
    const seen = [];
    worlds.forEach(function (body) {
      const a = body.orbit.a_au;
      for (let i = 0; i < seen.length; i++) {
        if (sameDistance(seen[i], a)) return;
      }
      seen.push(a);
      const angle = angles.get(body.id) || 0;
      orbits.push({
        id: body.id,
        points: sampleEllipse(a, body.orbit.e || 0, body.orbit.period_days || 365.25, angle, 96, function (x, y) {
          return placeAu(radial, x, y);
        })
      });
    });
  }
  const belts = [];
  if (layerOn(view, 'belts')) {
    (system.bodies || []).filter(function (body) { return body.kind === 'belt'; }).forEach(function (body) {
      const inner = body.orbit && body.orbit.a_inner_au;
      const outer = body.orbit && body.orbit.a_outer_au;
      if (!(inner > 0) || !(outer > 0)) return;
      const mid = radial((inner + outer) / 2);
      belts.push({
        id: body.id,
        name: body.name,
        innerAu: inner,
        outerAu: outer,
        innerR: radial(inner),
        outerR: radial(outer),
        color: (body.display && body.display.color) || '#d8c9a3',
        density: body.display ? body.display.density : undefined,
        dustiness: body.display ? body.display.dustiness : undefined,
        points: circleAt(mid),
        features: beltFeaturesFromBody(body, radial)
      });
    });
  }
  let habitable = null;
  if (layerOn(view, 'habitable') && typeof star.hz_inner_au === 'number' && typeof star.hz_outer_au === 'number') {
    habitable = {
      innerAu: star.hz_inner_au,
      outerAu: star.hz_outer_au,
      innerR: radial(star.hz_inner_au),
      outerR: radial(star.hz_outer_au)
    };
  }
  const transfers = [];
  if (layerOn(view, 'transfers') && view.transfer && view.transfer.from && view.transfer.to) {
    const from = byId(system, view.transfer.from);
    const to = byId(system, view.transfer.to);
    if (from && to && typeof from.orbit.a_au === 'number' && typeof to.orbit.a_au === 'number') {
      const mass = star.mass_solar || 1;
      const hop = hohmannDays(from.orbit.a_au, to.orbit.a_au, mass);
      const r1Scene = sceneOrbitRadius(radial, from.orbit.a_au);
      const r2Scene = sceneOrbitRadius(radial, to.orbit.a_au);
      const fromBody = bodies.find(function (body) { return body.id === from.id; });
      const departure = fromBody
        ? Math.atan2(-fromBody.position.z, fromBody.position.x)
        : (angles.get(from.id) || 0);
      const arc = hohmannArc(r1Scene, r2Scene, departure);
      transfers.push({
        id: 'hohmann',
        from: from.id,
        to: to.id,
        color: '#6dffc8',
        days: hop.days,
        dv1_km_s: hop.dv1_km_s,
        dv2_km_s: hop.dv2_km_s,
        r1: r1Scene,
        r2: r2Scene,
        points: arc.points
      });
    }
  }
  const elevation = clampElevation(view.elevation_deg);
  const azimuth = view.azimuth_deg || 0;
  return {
    star: {
      name: star.name || 'Tau Ceti',
      spectype: star.spectype || '',
      color: starColor,
      radius: 0.7,
      position: { x: 0, y: 0, z: 0 }
    },
    bodies: bodies,
    orbits: orbits,
    belts: belts,
    habitable: habitable,
    transfers: transfers,
    camera: cameraPose(elevation, azimuth, SYSTEM_DISTANCE),
    epochLabel: epochLabel(system),
    legendCorner: view.legend_corner || 'tl',
    distanceMode: mode,
    frame: 'system',
    focusId: null,
    theme: chrome.id,
    showLabels: layerOn(view, 'labels')
  };
}

function buildClose(system, view, options, focus) {
  const mode = distanceModeOf(view, options);
  const children = (system.bodies || []).filter(function (body) {
    return body.parent === focus.id;
  }).slice().sort(function (a, b) {
    return (a.orbit.a_km || 0) - (b.orbit.a_km || 0) || String(a.id).localeCompare(String(b.id));
  });
  let maxKm = 0;
  children.forEach(function (body) {
    if (body.orbit && typeof body.orbit.a_km === 'number' && body.orbit.a_km > maxKm) maxKm = body.orbit.a_km;
  });
  if (!(maxKm > 0)) maxKm = 1;
  const scale = CLOSE_SPAN / maxKm;
  const tDays = typeof view.epoch_days === 'number' ? view.epoch_days : 0;
  const bodies = [bodyRecord(focus, { x: 0, y: 0, z: 0 }, 1.2)];
  children.forEach(function (body, index) {
    const orbit = body.orbit || {};
    const a = orbit.a_km;
    if (typeof a !== 'number') return;
    const period = orbit.period_days || 1;
    const m0 = typeof body.angle_deg === 'number' ? (body.angle_deg * Math.PI) / 180 : (index / children.length) * TAU;
    const spot = pos({ a: a, e: orbit.e || 0, period_days: period, M0: m0, w: 0 }, tDays);
    bodies.push(bodyRecord(body, toThree(spot.x * scale, spot.y * scale), visualRadius(body)));
  });
  const orbits = [];
  if (layerOn(view, 'orbits')) {
    const seen = [];
    children.forEach(function (body, index) {
      const orbit = body.orbit || {};
      const a = orbit.a_km;
      if (typeof a !== 'number') return;
      for (let i = 0; i < seen.length; i++) {
        if (sameDistance(seen[i], a)) return;
      }
      seen.push(a);
      const period = orbit.period_days || 1;
      const m0 = typeof body.angle_deg === 'number' ? (body.angle_deg * Math.PI) / 180 : (index / children.length) * TAU;
      orbits.push({
        id: body.id,
        points: sampleEllipse(a, orbit.e || 0, period, m0, 96, function (x, y) {
          return toThree(x * scale, y * scale);
        })
      });
    });
  }
  const chrome = themeChrome(view.theme);
  return {
    star: null,
    bodies: bodies,
    orbits: orbits,
    belts: [],
    habitable: null,
    transfers: [],
    camera: cameraPose(clampElevation(view.elevation_deg), view.azimuth_deg || 0, CLOSE_DISTANCE),
    epochLabel: epochLabel(system),
    legendCorner: view.legend_corner || 'tl',
    distanceMode: mode,
    frame: focus.id,
    focusId: focus.id,
    theme: chrome.id,
    showLabels: layerOn(view, 'labels')
  };
}

export function initialSession(view) {
  const source = view || {};
  const callouts = [];
  (Array.isArray(source.callouts) ? source.callouts : []).forEach(function (item) {
    if (callouts.length < 3) callouts.push(item);
  });
  const mode = source.distance_mode === 'linear' || source.distance_mode === 'true' ? 'linear' : 'schematic';
  return {
    selected: null,
    focused: null,
    callouts: callouts,
    elevation_deg: clampElevation(source.elevation_deg),
    azimuth_deg: source.azimuth_deg || 0,
    distance: SYSTEM_DISTANCE,
    distance_mode: mode
  };
}

function copySession(session, callouts, selected, focused) {
  return {
    selected: selected,
    focused: focused === undefined ? session.focused : focused,
    callouts: callouts,
    elevation_deg: session.elevation_deg,
    azimuth_deg: session.azimuth_deg,
    distance: session.distance,
    distance_mode: session.distance_mode
  };
}

function stripBody(key) {
  const text = String(key);
  if (text.indexOf('body:') === 0) return text.slice(5);
  return text;
}

export function selectBody(session, id) {
  const callouts = session.callouts.slice();
  const key = 'body:' + id;
  const at = callouts.indexOf(key);
  let selected = id;
  if (at >= 0) {
    callouts.splice(at, 1);
    selected = callouts.length ? stripBody(callouts[callouts.length - 1]) : null;
  } else {
    callouts.push(key);
    if (callouts.length > 3) callouts.shift();
  }
  return copySession(session, callouts, selected);
}

export function frameBody(session, id) {
  const callouts = session.callouts.slice();
  const key = 'body:' + id;
  if (callouts.indexOf(key) < 0) {
    callouts.push(key);
    if (callouts.length > 3) callouts.shift();
  }
  return copySession(session, callouts, id, id);
}

export function clearSelection(session) {
  return copySession(session, [], null);
}

export function transferHitInset(pointCount) {
  return Math.max(1, Math.floor(pointCount * 0.12));
}

export function transferTubePoints(points) {
  const list = points || [];
  const inset = transferHitInset(list.length);
  if (list.length - 2 * inset < 2) return [];
  return list.slice(inset, list.length - inset);
}

function segmentDistance(ax, ay, az, bx, by, bz, px, py, pz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (ab2 > 0) {
    t = (apx * abx + apy * aby + apz * abz) / ab2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  return Math.hypot(ax + abx * t - px, ay + aby * t - py, az + abz * t - pz);
}

function polylineDistance(points, x, y, z) {
  if (!points || !points.length) return Infinity;
  if (points.length === 1) {
    const only = points[0];
    return Math.hypot(only.x - x, (only.y || 0) - y, only.z - z);
  }
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dist = segmentDistance(a.x, a.y || 0, a.z, b.x, b.y || 0, b.z, x, y, z);
    if (dist < best) best = dist;
  }
  return best;
}

export function transferPickRecord(hop) {
  const record = {
    kind: 'transfer',
    id: hop.id,
    from: hop.from,
    to: hop.to
  };
  if (typeof hop.days === 'number' && Number.isFinite(hop.days)) record.days = hop.days;
  if (typeof hop.dv1_km_s === 'number' && Number.isFinite(hop.dv1_km_s)) record.dv1_km_s = hop.dv1_km_s;
  if (typeof hop.dv2_km_s === 'number' && Number.isFinite(hop.dv2_km_s)) record.dv2_km_s = hop.dv2_km_s;
  return record;
}

export function pickTransferAt(hop, x, y, z, radius) {
  if (!hop || !hop.points) return null;
  if (polylineDistance(hop.points, x, y, z) <= TRANSFER_LINE_THRESHOLD) return transferPickRecord(hop);
  const tube = transferTubePoints(hop.points);
  const tubeRadius = typeof radius === 'number' && Number.isFinite(radius) ? radius : TRANSFER_HIT_RADIUS;
  if (tube.length >= 2 && polylineDistance(tube, x, y, z) <= tubeRadius) return transferPickRecord(hop);
  return null;
}

function oneDecimal(value) {
  return String(Math.round(value * 10) / 10);
}

export function transferInfoLines(system, hop) {
  if (!hop || typeof hop !== 'object') return ['unknown'];
  const from = byId(system, hop.from);
  const to = byId(system, hop.to);
  const lines = [];
  lines.push('From ' + (from && from.name ? from.name : String(hop.from == null ? 'unknown' : hop.from)));
  lines.push('To ' + (to && to.name ? to.name : String(hop.to == null ? 'unknown' : hop.to)));
  if (typeof hop.days === 'number' && Number.isFinite(hop.days)) lines.push(String(Math.round(hop.days)) + ' d');
  if (typeof hop.dv1_km_s === 'number' && Number.isFinite(hop.dv1_km_s)) {
    lines.push('Departure delta-v ' + oneDecimal(hop.dv1_km_s) + ' km/s');
  }
  if (typeof hop.dv2_km_s === 'number' && Number.isFinite(hop.dv2_km_s)) {
    lines.push('Arrival delta-v ' + oneDecimal(hop.dv2_km_s) + ' km/s');
  }
  return lines;
}

export function calloutLines(system, key, transfers) {
  const text = String(key);
  if (text.indexOf('transfer:') === 0) {
    const id = text.slice('transfer:'.length);
    const hop = (transfers || []).find(function (item) { return item.id === id; });
    if (!hop) return ['unknown'];
    return transferInfoLines(system, hop);
  }
  if (text.indexOf('body:') === 0) return infoLines(system, text.slice(5));
  return infoLines(system, text);
}

export function selectTransfer(session, hit) {
  const id = hit && typeof hit === 'object' ? hit.id : hit;
  const callouts = session.callouts.slice();
  const key = 'transfer:' + id;
  const at = callouts.indexOf(key);
  let selected = key;
  if (at >= 0) {
    callouts.splice(at, 1);
    selected = callouts.length ? stripBody(callouts[callouts.length - 1]) : null;
  } else {
    callouts.push(key);
    if (callouts.length > 3) callouts.shift();
  }
  return copySession(session, callouts, selected);
}

export function selectFromPick(session, hit) {
  if (hit && hit.kind === 'transfer') return selectTransfer(session, hit);
  return selectBody(session, hit.id);
}

export function choosePick(records) {
  let transfer = null;
  const list = records || [];
  for (let i = 0; i < list.length; i++) {
    const record = list[i];
    if (!record || !record.id) continue;
    if (record.kind !== 'transfer') return record;
    if (!transfer) transfer = record;
  }
  return transfer;
}

export function assignCardSlots(previous, callouts, legendCorner) {
  const legend = legendCorner || 'tl';
  const corners = ['tl', 'tr', 'bl', 'br'].filter(function (corner) { return corner !== legend; });
  const keys = [];
  (Array.isArray(callouts) ? callouts : []).forEach(function (key) {
    if (keys.indexOf(key) < 0) keys.push(key);
  });
  while (keys.length > 3) keys.shift();
  const used = {};
  const kept = {};
  (Array.isArray(previous) ? previous : []).forEach(function (slot) {
    if (!slot || keys.indexOf(slot.key) < 0) return;
    if (corners.indexOf(slot.corner) < 0 || used[slot.corner] || kept[slot.key]) return;
    used[slot.corner] = true;
    kept[slot.key] = slot.corner;
  });
  keys.forEach(function (key) {
    if (kept[key]) return;
    let corner = null;
    for (let i = 0; i < corners.length; i++) {
      if (!used[corners[i]]) {
        corner = corners[i];
        break;
      }
    }
    if (!corner) return;
    used[corner] = true;
    kept[key] = corner;
  });
  return keys.map(function (key) {
    return { key: key, corner: kept[key] };
  });
}

export function infoLines(system, id) {
  const data = system && typeof system === 'object' ? system : {};
  if (id === 'star') {
    const star = data.star || {};
    const lines = [];
    lines.push(star.name || 'Star');
    if (star.spectype) lines.push(String(star.spectype));
    if (typeof star.mass_solar === 'number') lines.push(String(star.mass_solar) + ' solar masses');
    if (typeof star.lum_solar === 'number') lines.push(String(star.lum_solar) + ' solar luminosities');
    if (typeof star.teff_k === 'number') lines.push(String(star.teff_k) + ' K');
    if (typeof star.hz_inner_au === 'number' && typeof star.hz_outer_au === 'number') {
      lines.push('Habitable ' + auText(star.hz_inner_au) + ' – ' + auText(star.hz_outer_au));
    }
    return lines;
  }
  const body = (data.bodies || []).find(function (item) { return item.id === id; });
  if (!body) return ['unknown'];
  const orbit = body.orbit || {};
  const lines = [body.name];
  if (body.designation) lines.push(String(body.designation));
  if (body.kind) lines.push(body.kind);
  if (typeof orbit.a_au === 'number') lines.push(auText(orbit.a_au));
  if (typeof orbit.e === 'number') lines.push(String(orbit.e));
  if (typeof orbit.e_max === 'number') lines.push('e <= ' + orbit.e_max);
  if (typeof orbit.a_km === 'number') lines.push(String(Math.round(orbit.a_km)) + ' km');
  if (typeof orbit.period_days === 'number') lines.push(String(orbit.period_days) + ' d');
  const physical = body.physical || {};
  if (typeof physical.radius_km === 'number') lines.push(String(physical.radius_km) + ' km radius');
  if (typeof physical.mass_earth === 'number') lines.push(String(physical.mass_earth) + ' Earth masses');
  if (typeof physical.surface_g === 'number') lines.push(String(physical.surface_g) + ' g');
  return lines;
}

export function hoverReadout(record) {
  if (!record || typeof record !== 'object') return '';
  if (typeof record.a_au === 'number') return auText(record.a_au);
  if (typeof record.a_km === 'number') return withCommas(record.a_km) + ' km';
  return '';
}

export function pencilNote() {
  return 'This edit is not saved. It can contradict Tau_Cet_system_v2.md.';
}
