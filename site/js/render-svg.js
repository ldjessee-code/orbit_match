import { pos, hohmannDays, fusionMatched, AU_M, positionFromAngles } from './kepler.js';
import { hasSubmap, closeExtentKm, isDrawableBand, bandEdgesKm, moonletsKm, angleIsMissing } from '../viewer3d/scene-model.js';
import { displayAngleMap, ANGLE_MISSING_LINE } from './display-angles.js';

const TAU = 2 * Math.PI;
const W = 1600;
const H = 1000;
const G0 = 9.80665;

function num(value) {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function xml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A color from a file goes into an attribute as is, so accept only color
// syntax: #hex, a CSS name, or rgb()/hsl() with plain numbers.
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,/]+\))$/i;

export function safeColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return COLOR.test(text) ? text : null;
}

// Theme and style values also go into attributes. Drop any string that could
// leave its attribute, so the renderer's own fallback is used instead.
const ATTR_SAFE = /^[-#\w\s.,()%/]*$/;

function safeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value || {};
  const out = {};
  Object.keys(value).forEach(function (key) {
    const item = value[key];
    if (typeof item === 'string') {
      if (ATTR_SAFE.test(item)) out[key] = item;
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      out[key] = safeSettings(item);
    } else {
      out[key] = item;
    }
  });
  return out;
}

function auText(value) {
  return String(Math.round(value * 1000) / 1000);
}

// Azimuth walks the camera counterclockwise around the focus, so the world
// turns clockwise on the screen. sy lifts +Y by sin(elevation).
export function project(x, y, cam) {
  const az = ((cam.azimuth_deg || 0) * Math.PI) / 180;
  const elev = ((cam.elevation_deg || 0) * Math.PI) / 180;
  const cos = Math.cos(az);
  const sin = Math.sin(az);
  const X = x * cos + y * sin;
  const Y = -x * sin + y * cos;
  const scale = cam.scale == null ? 1 : cam.scale;
  return {
    sx: cam.cx + X * scale,
    sy: cam.cy - Y * Math.sin(elev) * scale
  };
}

function byId(system, id) {
  return (system.bodies || []).find(function (body) { return body.id === id; });
}

// Belts the picture can place: both edges known.
function edgedBelts(system) {
  return (system.bodies || []).filter(function (body) {
    return body.kind === 'belt' && body.orbit && typeof body.orbit.a_inner_au === 'number' && typeof body.orbit.a_outer_au === 'number';
  });
}

function heliocentric(system) {
  return (system.bodies || []).filter(function (body) {
    return body.parent == null && body.kind !== 'belt' && typeof body.orbit.a_au === 'number';
  }).slice().sort(function (a, b) {
    return a.orbit.a_au - b.orbit.a_au || String(a.id).localeCompare(String(b.id));
  });
}

function displayAngles(system) {
  return displayAngleMap(system);
}

function fine(value) {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

function clockDays(view) {
  return view && typeof view.epoch_days === 'number' ? view.epoch_days : 0;
}

function referenceDeg(system) {
  const ref = system && system.reference_direction;
  if (!ref || typeof ref !== 'object' || Array.isArray(ref) || typeof ref.deg !== 'number') return 0;
  return ref.deg;
}

function usesAngle(body) {
  return !!(body && body.orbit && typeof body.orbit.position_angle_deg === 'number');
}

// A body at a Lagrange point with no stored angle sits 60 degrees from its
// partner at every time: ahead at L4, behind at L5.
function lagrangeSpot(system, body, a, tDays, periodFallback, depth) {
  const lagrange = body.lagrange;
  if (!lagrange || !lagrange.of || usesAngle(body) || typeof body.angle_deg === 'number' || depth > 4) return null;
  const partner = byId(system, lagrange.of);
  if (!partner || partner === body || !partner.orbit) return null;
  const pa = typeof partner.orbit.a_au === 'number' ? partner.orbit.a_au : partner.orbit.a_km;
  if (typeof pa !== 'number') return null;
  const there = spotAt(system, partner, pa, tDays, displayAngles(system).get(partner.id) || 0, periodFallback, depth + 1);
  const shift = String(lagrange.point || '').toUpperCase() === 'L5' ? -Math.PI / 3 : Math.PI / 3;
  const angle = Math.atan2(there.y, there.x) + shift;
  return { x: a * Math.cos(angle), y: a * Math.sin(angle) };
}

// periodFallback is the period used when the body has none: 365.25 days
// around the star, and 1 day in a close view, as the 3D view does.
function spotAt(system, body, a, tDays, legacyRadians, periodFallback, depth) {
  const orbit = body.orbit || {};
  const e = orbit.e || 0;
  const fallback = periodFallback == null ? 365.25 : periodFallback;
  const period = orbit.period_days > 0 ? orbit.period_days : fallback;
  const linked = lagrangeSpot(system, body, a, tDays, fallback, depth || 0);
  if (linked) return linked;
  if (usesAngle(body)) {
    return positionFromAngles({
      a: a,
      e: e,
      period_days: period,
      position_angle_deg: orbit.position_angle_deg,
      perihelion_longitude_deg: typeof orbit.perihelion_longitude_deg === 'number' ? orbit.perihelion_longitude_deg : 0,
      reference_deg: referenceDeg(system)
    }, tDays);
  }
  const flat = pos({ a: a, e: e, period_days: period, M0: legacyRadians || 0, w: 0 }, tDays);
  // The reference direction turns every body, with or without a stored angle.
  const rot = (referenceDeg(system) * Math.PI) / 180;
  if (!rot) return flat;
  return { x: flat.x * Math.cos(rot) - flat.y * Math.sin(rot), y: flat.x * Math.sin(rot) + flat.y * Math.cos(rot) };
}

function schematicMap(distances, rIn, fit) {
  const uniq = [];
  distances.filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; }).forEach(function (n) {
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

// True spacing: radius grows in step with AU, from the star's edge to the fit.
function linearMap(distances, rIn, fit) {
  let max = 0;
  distances.forEach(function (n) { if (n > max) max = n; });
  if (!(max > 0)) max = 1;
  return function (r) { return (r / max) * fit; };
}

// Reference rings at round AU values, and the axis through the star.
function grid(parts, distances, map, cx, cy, ratio, style) {
  let max = 0;
  distances.forEach(function (n) { if (n > max) max = n; });
  if (!(max > 0)) return;
  const color = style.grid || style.border || style.muted;
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  steps.filter(function (au) { return au <= max * 1.05; }).forEach(function (au) {
    const rx = map(au);
    parts.push('<ellipse data-role="grid" cx="' + cx + '" cy="' + cy + '" rx="' + num(rx) + '" ry="' + num(rx * ratio) + '" fill="none" stroke="' + color + '" stroke-width="0.5" stroke-dasharray="1 6" pointer-events="none"/>');
    parts.push('<text data-role="grid" x="' + num(cx + rx + 4) + '" y="' + (cy - 4) + '" fill="' + style.muted + '" font-size="10" pointer-events="none">' + au + ' AU</text>');
  });
  const reach = map(max);
  parts.push('<line data-role="grid" x1="' + num(cx - reach) + '" y1="' + cy + '" x2="' + num(cx + reach) + '" y2="' + cy + '" stroke="' + color + '" stroke-width="0.5" pointer-events="none"/>');
}

function eccentricRing(parts, system, body, place, style) {
  const orbit = body.orbit;
  const period = orbit.period_days > 0 ? orbit.period_days : 365.25;
  const legacy = displayAngles(system).get(body.id) || 0;
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const spot = spotAt(system, body, orbit.a_au, (period * i) / 96, usesAngle(body) ? 0 : legacy);
    pts.push(place(spot.x, spot.y));
  }
  const d = polyline(pts) + ' Z';
  const call = ' data-callout="body:' + xml(body.id) + '"';
  parts.push('<g><title>' + auText(orbit.a_au) + ' AU</title><path data-id="' + xml(body.id) + '" data-au="' + auText(orbit.a_au) + '"' + call + ' d="' + d + '" fill="none" stroke="transparent" stroke-width="12"/><path data-role="orbit" data-id="' + xml(body.id) + '" d="' + d + '" fill="none" stroke="' + style.orbit + '" stroke-width="1" pointer-events="none"/></g>');
}

function diskRadius(body) {
  const radius = body.physical && body.physical.radius_km;
  const earth = 6371;
  const used = radius > 0 ? radius : earth * 0.5;
  return 1.15 * (7 + 4 * Math.pow(used / earth, 0.4));
}

function fillFor(body, theme) {
  const display = body.display || {};
  const own = safeColor(display.color);
  if (own) return own;
  if (body.kind === 'belt') return theme.belt || '#d8c9a3';
  if (body.kind === 'moon') return theme.moon || theme.planet || '#d9d3c7';
  if (body.kind === 'structure') return theme.structure || theme.accent || '#8fd0ff';
  return theme.planet || '#9bb0c4';
}

function torusRadii(r) {
  const rx = Math.max(r * 1.9, 13);
  const ry = rx * 0.68;
  return { rx: rx, ry: ry, hole: 0.46 };
}

function labelReach(item) {
  if (item.body.display && item.body.display.shape === 'torus') return torusRadii(item.r).rx;
  return item.r;
}

export function renderSvg(system, view, rawTheme, rawStyle, options) {
  const theme = safeSettings(rawTheme);
  const style = safeSettings(rawStyle);
  const frame = options && options.frame && options.frame !== 'system' ? options.frame : 'system';
  const focus = frame === 'system' ? null : byId(system, frame);
  if (focus) return renderClose(system, view, theme, style, focus);
  return renderSystem(system, view, theme, style);
}

function renderSystem(system, view, theme, style) {
  const elev = view.elevation_deg;
  const az = view.azimuth_deg || 0;
  const ratio = Math.sin((elev * Math.PI) / 180);
  const CX = 800;
  const CY = 530;
  const rStar = style.star_radius || 48;
  const rIn = Math.max(rStar + 36, (rStar + 12) / Math.max(ratio, 0.25));
  const fit = Math.min(W / 2 - 120, (H / 2 - 120) / Math.max(ratio, 0.25));
  const distances = [];
  (system.bodies || []).forEach(function (body) {
    const orbit = body.orbit || {};
    if (typeof orbit.a_au === 'number') distances.push(orbit.a_au);
    if (typeof orbit.a_inner_au === 'number') distances.push(orbit.a_inner_au);
    if (typeof orbit.a_outer_au === 'number') distances.push(orbit.a_outer_au);
  });
  // distance_mode "linear" (or "true") spaces orbits by their real AU.
  const linear = view.distance_mode === 'linear' || view.distance_mode === 'true';
  const map = linear ? linearMap(distances, rIn, fit) : schematicMap(distances, rIn, fit);
  const place = function (x, y) {
    const r = Math.hypot(x, y);
    const scale = r === 0 ? 1 : map(r) / r;
    return project(x, y, { cx: CX, cy: CY, scale: scale, elevation_deg: elev, azimuth_deg: az });
  };
  const angles = displayAngles(system);
  const parts = [];
  parts.push(openSvg(style, theme));
  if (view.layers && view.layers.grid === true) grid(parts, distances, map, CX, CY, ratio, style);
  if (layer(view, 'habitable')) band(parts, system, map, CX, CY, ratio, style);
  if (layer(view, 'belts')) belts(parts, system, place, style);
  if (layer(view, 'orbits')) {
    const seen = new Set();
    heliocentric(system).forEach(function (body) {
      // An eccentric orbit is drawn along its real path, as the 3D view does.
      if ((body.orbit.e || 0) >= 0.05) {
        eccentricRing(parts, system, body, place, style);
        return;
      }
      const key = auText(body.orbit.a_au);
      if (seen.has(key)) return;
      seen.add(key);
      ring(parts, CX, CY, map(body.orbit.a_au), ratio, style.orbit, body.orbit.a_au, body.id);
    });
  }
  const tDays = clockDays(view);
  if (layer(view, 'transfers')) transfer(parts, system, view, place, style, angles, tDays);
  const markers = heliocentric(system).map(function (body) {
    const angle = angles.get(body.id) || 0;
    const spot = spotAt(system, body, body.orbit.a_au, tDays, angle);
    const at = place(spot.x, spot.y);
    return { body: body, at: at, r: diskRadius(body), submap: hasSubmap(system, body.id) };
  }).sort(function (a, b) { return a.at.sy - b.at.sy; });
  markers.filter(function (item) { return item.at.sy < CY; }).forEach(function (item) { bodyMark(parts, item, theme, style); });
  starDisk(parts, system, CX, CY, rStar, theme, style);
  markers.filter(function (item) { return item.at.sy >= CY; }).forEach(function (item) { bodyMark(parts, item, theme, style); });
  if (layer(view, 'labels')) {
    markers.forEach(function (item) { nameTag(parts, item, style); });
    edgedBelts(system).forEach(function (body) {
      const mid = (body.orbit.a_inner_au + body.orbit.a_outer_au) / 2;
      const at = place(mid, 0.15 * mid);
      parts.push('<text data-callout="body:' + xml(body.id) + '" x="' + num(at.sx) + '" y="' + num(at.sy) + '" fill="' + style.text + '" font-size="14">' + xml(nameOf(body)) + '</text>');
    });
  }
  legend(parts, system, view, style, theme, 'system');
  drawCallouts(parts, {
    system: system,
    view: view,
    theme: theme,
    style: style,
    markers: markers,
    place: place,
    angles: angles,
    CX: CX,
    CY: CY,
    rStar: rStar,
    heliocentric: true
  });
  frameRect(parts, style);
  parts.push('</svg>');
  return parts.join('\n');
}

function childKmSpot(system, body, tDays, angles) {
  const orbit = body.orbit || {};
  const a = orbit.a_km || 0;
  const m0 = angles && angles.has(body.id) ? angles.get(body.id) : 0;
  return spotAt(system, body, a, tDays, usesAngle(body) ? 0 : m0, 1);
}

function drawCloseRings(parts, focus, px, ratio, cx, cy, style) {
  const bands = focus.ring_system && focus.ring_system.bands;
  if (!Array.isArray(bands)) return;
  bands.forEach(function (band) {
    if (!isDrawableBand(band)) return;
    const km = bandEdgesKm(band);
    const mid = (km.innerKm + km.outerKm) / 2;
    const rx = mid * px;
    const width = (km.outerKm - km.innerKm) * px;
    parts.push('<ellipse data-role="ring" data-band="' + xml(band.name) + '" data-parent="' + xml(focus.id) + '" cx="' + cx + '" cy="' + cy + '" rx="' + fine(rx) + '" ry="' + fine(rx * ratio) + '" fill="none" stroke="' + style.orbit + '" stroke-width="' + fine(width) + '" pointer-events="none"/>');
  });
}

function renderClose(system, view, theme, style, focus) {
  const elev = view.elevation_deg;
  const az = view.azimuth_deg || 0;
  const ratio = Math.sin((elev * Math.PI) / 180);
  const CX = 820;
  const CY = 530;
  const children = (system.bodies || []).filter(function (body) {
    return body && body.parent === focus.id && body.kind !== 'belt' && body.orbit && typeof body.orbit.a_km === 'number';
  });
  const extent = closeExtentKm(system, focus);
  const px = 360 / extent;
  const place = function (x, y) {
    return project(x, y, { cx: CX, cy: CY, scale: px, elevation_deg: elev, azimuth_deg: az });
  };
  const parts = [];
  const angles = displayAngles(system);
  parts.push(openSvg(style, theme));
  drawCloseRings(parts, focus, px, ratio, CX, CY, style);
  // One ring for each distance a structure orbits at. Stations that share a
  // distance share its ring.
  if (layer(view, 'structures')) {
    const seenKm = new Set();
    children.filter(function (body) { return body.kind === 'structure' && body.orbit.a_km; }).forEach(function (body) {
      const key = Math.round(body.orbit.a_km * 1000);
      if (seenKm.has(key)) return;
      seenKm.add(key);
      ring(parts, CX, CY, body.orbit.a_km * px, ratio, style.orbit, null, body.id);
      const labelAt = place(body.orbit.a_km, 0);
      parts.push('<text x="' + num(labelAt.sx + 8) + '" y="' + num(labelAt.sy - 8) + '" fill="' + style.muted + '" font-size="12">' + Math.round(body.orbit.a_km) + ' km</text>');
    });
  }
  if (layer(view, 'orbits')) {
    children.filter(function (body) { return body.kind !== 'structure'; }).forEach(function (body) {
      drawChildOrbit(parts, body, place, px, ratio, CX, CY, style, system, angles);
    });
  }
  const tDays = clockDays(view);
  moonletsKm(focus).forEach(function (moonlet) {
    const at = place(moonlet.a_km, 0);
    parts.push('<circle data-role="moonlet" data-a-km="' + moonlet.a_km + '" cx="' + num(at.sx) + '" cy="' + num(at.sy) + '" r="3" fill="' + style.muted + '"/>');
  });
  const marks = [];
  children.forEach(function (body) {
    const a = body.orbit.a_km || 0;
    const e = body.orbit.e || 0;
    const spot = childKmSpot(system, body, tDays, angles);
    const x = spot.x;
    const y = spot.y;
    const at = place(x, y);
    marks.push({
      body: body,
      at: at,
      r: body.kind === 'structure' ? 5 : Math.max(6, diskRadius(body) * 0.45),
      submap: hasSubmap(system, body.id)
    });
    if (e >= 0.1 && layer(view, 'labels')) {
      // The periapsis lies along the longitude of perihelion, turned by the
      // reference direction.
      const peri = a * (1 - e);
      const w = ((usesAngle(body) && typeof body.orbit.perihelion_longitude_deg === 'number' ? body.orbit.perihelion_longitude_deg : 0) + (usesAngle(body) ? referenceDeg(system) : 0)) * Math.PI / 180;
      const pe = place(peri * Math.cos(w), peri * Math.sin(w));
      parts.push('<text x="' + num(pe.sx + 8) + '" y="' + num(pe.sy + 16) + '" fill="' + style.text + '" font-size="12">' + Math.round(peri) + ' km</text>');
    }
  });
  marks.sort(function (a, b) { return a.at.sy - b.at.sy; });
  marks.forEach(function (item) { bodyMark(parts, item, theme, style); });
  const focusKm = focus.physical && typeof focus.physical.radius_km === 'number' && focus.physical.radius_km > 0 ? focus.physical.radius_km : 0;
  const focusR = focusKm > 0 ? focusKm * px : Math.max(18, diskRadius(focus));
  parts.push('<circle id="focus" data-callout="body:' + xml(focus.id) + '" cx="' + CX + '" cy="' + CY + '" r="' + num(focusR) + '" fill="' + fillFor(focus, theme) + '" stroke="' + style.muted + '" stroke-width="1"/>');
  if (layer(view, 'labels')) {
    parts.push('<text data-callout="body:' + xml(focus.id) + '" text-anchor="middle" x="' + CX + '" y="' + (CY + focusR + 20) + '" fill="' + style.text + '" font-size="16">' + xml(focus.name) + '</text>');
    marks.forEach(function (item) { radialTag(parts, item, CX, CY, style); });
  }
  const focusItem = { body: focus, at: { sx: CX, sy: CY }, r: focusR };
  legend(parts, system, view, style, theme, 'close', [focus].concat(children));
  drawCallouts(parts, {
    system: system,
    view: view,
    theme: theme,
    style: style,
    markers: marks.concat([focusItem]),
    place: place,
    angles: displayAngles(system),
    CX: CX,
    CY: CY,
    rStar: focusR,
    focusR: focusR,
    heliocentric: false
  });
  frameRect(parts, style);
  parts.push('</svg>');
  return parts.join('\n');
}

function drawChildOrbit(parts, body, place, px, ratio, cx, cy, style, system, angles) {
  const a = body.orbit.a_km || 0;
  const e = body.orbit.e || 0;
  if (e >= 0.05 && body.orbit.period_days) {
    const pts = [];
    const steps = 96;
    const m0 = angles && angles.has(body.id) ? angles.get(body.id) : 0;
    for (let i = 0; i <= steps; i++) {
      const spot = usesAngle(body)
        ? spotAt(system, body, a, body.orbit.period_days * i / steps, 0)
        : pos({ a: a, e: e, period_days: body.orbit.period_days, M0: m0, w: 0 }, body.orbit.period_days * i / steps);
      pts.push(place(spot.x, spot.y));
    }
    const d = polyline(pts);
    const call = ' data-callout="body:' + xml(body.id) + '"';
    parts.push('<path' + call + ' d="' + d + '" fill="none" stroke="transparent" stroke-width="10"/>');
    parts.push('<path data-id="' + xml(body.id) + '" d="' + d + '" fill="none" stroke="' + style.orbit + '" stroke-width="1" pointer-events="none"/>');
    return;
  }
  ring(parts, cx, cy, a * px, ratio, style.orbit, null, body.id);
}

function openSvg(style, theme) {
  const lines = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Segoe UI, system-ui, sans-serif">'
  ];
  if (style.filters) {
    lines.push('<filter id="glow"><feGaussianBlur stdDeviation="2"/></filter>');
  }
  if (style.scan) {
    lines.push('<pattern id="scan-pattern" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" opacity="0.14"/></pattern>');
  }
  const star = theme.star || {};
  lines.push('<radialGradient id="star-fill"><stop offset="0" stop-color="' + (star.core || '#fffaf0') + '"/><stop offset="1" stop-color="' + (star.fill || '#ffe0a0') + '"/></radialGradient>');
  lines.push('<rect data-role="sky" width="' + W + '" height="' + H + '" fill="' + style.background + '"/>');
  if (style.scan) lines.push('<rect width="' + W + '" height="' + H + '" fill="url(#scan-pattern)" pointer-events="none"/>');
  if (style.lamps) {
    lines.push('<g id="lamps">');
    [0, 1, 2].forEach(function (i) {
      lines.push('<circle cx="' + (36 + i * 16) + '" cy="18" r="4" fill="' + (theme.accent || style.warning) + '"/>');
    });
    lines.push('</g>');
  }
  return lines.join('\n');
}

function frameRect(parts, style) {
  parts.push('<rect data-role="frame" x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" fill="none" stroke="' + style.border + '" stroke-width="1" pointer-events="none"/>');
}

function starDisk(parts, system, cx, cy, r, theme, style) {
  const star = theme.star || {};
  const name = (system.star && (system.star.name || system.star.hostname)) || 'Star';
  const spec = system.star && system.star.spectype ? system.star.spectype : '';
  parts.push('<circle id="star" data-callout="star" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#star-fill)" stroke="' + (star.edge || '#f3c983') + '" stroke-width="1"/>');
  const specSpan = spec ? '<tspan fill="' + style.muted + '" font-size="12"> ' + xml(spec) + '</tspan>' : '';
  parts.push('<text id="star-name" data-callout="star" x="' + (cx + r + 16) + '" y="' + (cy + 5) + '" fill="' + style.text + '" font-size="16">' + xml(name) + specSpan + '</text>');
}

function ring(parts, cx, cy, rx, ratio, color, au, id) {
  const label = au == null ? '' : auText(au) + ' AU';
  const hit = au == null ? '' : ' data-au="' + auText(au) + '"';
  const call = ' data-callout="body:' + xml(id) + '"';
  parts.push('<g><title>' + label + '</title><ellipse data-id="' + xml(id) + '"' + hit + call + ' cx="' + cx + '" cy="' + cy + '" rx="' + num(rx) + '" ry="' + num(rx * ratio) + '" fill="none" stroke="transparent" stroke-width="12"/><ellipse data-role="orbit" data-id="' + xml(id) + '" cx="' + cx + '" cy="' + cy + '" rx="' + num(rx) + '" ry="' + num(rx * ratio) + '" fill="none" stroke="' + color + '" stroke-width="1" pointer-events="none"/></g>');
}

function band(parts, system, map, cx, cy, ratio, style) {
  const star = system.star || {};
  if (typeof star.hz_inner_au !== 'number' || typeof star.hz_outer_au !== 'number') return;
  const color = style.habitable || '#6d8f7a';
  [star.hz_inner_au, star.hz_outer_au].forEach(function (au) {
    const rx = map(au);
    parts.push('<ellipse data-role="habitable" cx="' + cx + '" cy="' + cy + '" rx="' + num(rx) + '" ry="' + num(rx * ratio) + '" fill="none" stroke="' + color + '" stroke-width="1" stroke-dasharray="2 5" pointer-events="none"/>');
  });
  const rx = map(star.hz_outer_au);
  const ang = 0.9;
  const lx = cx + Math.cos(ang) * rx + 10;
  const ly = cy - Math.sin(ang) * rx * ratio;
  parts.push('<text x="' + num(lx) + '" y="' + num(ly) + '" fill="' + color + '" font-size="12" pointer-events="none">Habitable</text>');
}

function belts(parts, system, place, style) {
  (system.bodies || []).filter(function (body) { return body.kind === 'belt'; }).forEach(function (body) {
    const inner = body.orbit.a_inner_au;
    const outer = body.orbit.a_outer_au;
    if (!(inner > 0) || !(outer > inner)) return;
    const count = outer > 5 ? 480 : 200;
    const color = safeColor(body.display && body.display.color) || style.belt || style.muted;
    for (let i = 0; i < count; i++) {
      // Three uniform draws peak in the middle of the belt. The edges stay thin.
      const u = (hash(body.id + ':u:' + i) + hash(body.id + ':v:' + i) + hash(body.id + ':w:' + i)) / 3;
      const r = inner * Math.pow(outer / inner, u);
      const t = hash(body.id + ':a:' + i) * TAU;
      const at = place(r * Math.cos(t), r * Math.sin(t));
      const edge = Math.abs(u - 0.5) * 2;
      const opacity = (0.95 - 0.7 * edge).toFixed(2);
      const radius = (0.65 + 1.15 * (1 - edge)).toFixed(2);
      parts.push('<circle cx="' + num(at.sx) + '" cy="' + num(at.sy) + '" r="' + radius + '" fill="' + color + '" opacity="' + opacity + '" pointer-events="none"/>');
    }
  });
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function departureRadians(system, body, tDays, angles) {
  if (usesAngle(body)) {
    const spot = spotAt(system, body, body.orbit.a_au, tDays, 0);
    return Math.atan2(spot.y, spot.x);
  }
  return angles.get(body.id) || 0;
}

// The drive for the fusion card. A view's transfer can set thrust_g and
// budget_km_s. These are the defaults.
export const FUSION_DRIVE = { thrust_g: 0.01, budget_km_s: 150 };

function driveOf(view) {
  const spec = (view && view.transfer) || {};
  const g = typeof spec.thrust_g === 'number' && spec.thrust_g > 0 ? spec.thrust_g : FUSION_DRIVE.thrust_g;
  const budget = typeof spec.budget_km_s === 'number' && spec.budget_km_s > 0 ? spec.budget_km_s : FUSION_DRIVE.budget_km_s;
  return { thrust_g: g, acc: g * G0, budget_m_s: budget * 1000 };
}

// The body that orbits the star, for a body or any of its moons or stations.
function starAnchor(system, body) {
  let at = body;
  for (let i = 0; at && i < 8; i++) {
    if (at.parent == null || at.parent === '') return at;
    at = byId(system, at.parent);
  }
  return null;
}

// One trip, as both the picture and the card read it: the two ends, the
// Hohmann numbers, the departure angle on this day, and the arc in AU. A
// moon or a station travels with the body that orbits the star. A trip from
// a body to itself is no trip.
function tripPlan(system, view, tDays, angles) {
  const spec = view.transfer;
  if (!spec || !spec.from || !spec.to || spec.from === spec.to) return null;
  const named = { from: byId(system, spec.from), to: byId(system, spec.to) };
  if (!named.from || !named.to) return null;
  const from = starAnchor(system, named.from);
  const to = starAnchor(system, named.to);
  if (!from || !to || from === to || !(from.orbit.a_au > 0) || !(to.orbit.a_au > 0)) return null;
  const massGiven = system.star && system.star.mass_solar > 0;
  const mass = massGiven ? system.star.mass_solar : 1;
  const hop = hohmannDays(from.orbit.a_au, to.orbit.a_au, mass);
  const ang = departureRadians(system, from, tDays, angles);
  // Outward the arc leaves at periapsis. Inward it leaves at apoapsis, so it
  // starts at the origin either way.
  const outward = to.orbit.a_au >= from.orbit.a_au;
  const arc = [];
  for (let i = 0; i <= 80; i++) {
    const nu = (Math.PI * i) / 80;
    const r = hop.at_au * (1 - hop.e * hop.e) / (1 + (outward ? 1 : -1) * hop.e * Math.cos(nu));
    arc.push([r * Math.cos(ang + nu), r * Math.sin(ang + nu)]);
  }
  return {
    named: named,
    from: from,
    to: to,
    hop: hop,
    ang: ang,
    arc: arc,
    massAssumed: !massGiven,
    drive: driveOf(view),
    tDays: tDays
  };
}

function flyPlan(system, plan, angles) {
  if (!plan) return null;
  if (!('flown' in plan)) {
    plan.flown = fuse(plan.from, plan.to, plan.ang, departureRadians(system, plan.to, plan.tDays, angles), system, plan.tDays, plan.drive);
  }
  return plan.flown;
}

function transfer(parts, system, view, place, style, angles, tDays) {
  const plan = tripPlan(system, view, tDays, angles);
  if (!plan) return;
  const hop = plan.hop;
  const pts = plan.arc.map(function (pair) { return place(pair[0], pair[1]); });
  const d = polyline(pts);
  parts.push('<path data-callout="transfer:hohmann" d="' + d + '" fill="none" stroke="transparent" stroke-width="12"/>');
  parts.push('<path data-role="hohmann" data-days="' + hop.days.toFixed(0) + '" d="' + d + '" fill="none" stroke="' + style.hohmann + '" stroke-width="1.5" stroke-dasharray="' + (style.hohmann_dash || '8 6') + '" pointer-events="none"/>');
  const flown = flyPlan(system, plan, angles);
  if (flown) {
    const burn = Math.max(1, Math.round(40 * flown.tb / flown.T));
    const all = sampleFusion(flown, place);
    const coast = polyline(all);
    parts.push('<path data-callout="transfer:fusion" d="' + coast + '" fill="none" stroke="transparent" stroke-width="12"/>');
    parts.push('<path data-role="fusion-coast" d="' + coast + '" fill="none" stroke="' + style.fusion + '" stroke-width="1.5" stroke-dasharray="4 4" pointer-events="none"/>');
    parts.push('<path data-role="fusion-burn" d="' + polyline(all.slice(0, burn)) + '" fill="none" stroke="' + style.fusion + '" stroke-width="2" pointer-events="none"/>');
    parts.push('<path data-role="fusion-burn" d="' + polyline(all.slice(all.length - burn)) + '" fill="none" stroke="' + style.fusion + '" stroke-width="2" pointer-events="none"/>');
  }
}

// The fusion trip leaving on day tDays. A trip the drive cannot make is null,
// and the card says no matched burn.
function fuse(from, to, fromAngle, toAngle, system, tDays, drive) {
  try {
    const dep = xy(from, fromAngle, system);
    const tgt = xy(to, toAngle, system);
    const use = drive || driveOf(null);
    const flown = fusionMatched(dep, tgt, tDays || 0, use.acc, use.budget_m_s, AU_M);
    return flown && flown.ok !== false ? flown : null;
  } catch (err) {
    return null;
  }
}

function xy(body, angle, system) {
  const legacy = usesAngle(body) ? 0 : angle;
  return function (t) {
    const spot = spotAt(system, body, body.orbit.a_au, t, legacy);
    return [spot.x, spot.y];
  };
}

function sampleFusion(flown, place) {
  const steps = 48;
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(placePoint(flown.at(flown.T * i / steps), place));
  return pts;
}

function placePoint(pair, place) {
  return place(pair[0], pair[1]);
}

function polyline(points) {
  return points.map(function (p, i) {
    return (i ? 'L' : 'M') + num(p.sx) + ' ' + num(p.sy);
  }).join(' ');
}

function bodyMark(parts, item, theme, style) {
  const body = item.body;
  const fill = fillFor(body, theme);
  const call = ' data-callout="body:' + xml(body.id) + '"';
  if (body.display && body.display.shape === 'torus') {
    const ringSize = torusRadii(item.r);
    parts.push('<ellipse data-id="' + xml(body.id) + '"' + call + ' data-shape="torus" cx="' + num(item.at.sx) + '" cy="' + num(item.at.sy) + '" rx="' + num(ringSize.rx) + '" ry="' + num(ringSize.ry) + '" fill="' + fill + '"/>');
    parts.push('<ellipse cx="' + num(item.at.sx) + '" cy="' + num(item.at.sy) + '" rx="' + num(ringSize.rx * ringSize.hole) + '" ry="' + num(ringSize.ry * ringSize.hole) + '" fill="' + style.background + '" pointer-events="none"/>');
    return;
  }
  parts.push('<circle data-id="' + xml(body.id) + '"' + call + ' cx="' + num(item.at.sx) + '" cy="' + num(item.at.sy) + '" r="' + num(item.r) + '" fill="' + fill + '" stroke="' + style.muted + '" stroke-width="1"/>');
  if (body.display && body.display.stripes) {
    const stripe = body.display.stripe || '#f4efe4';
    [-0.32, 0.18].forEach(function (t) {
      const y = item.at.sy + item.r * t;
      const half = Math.sqrt(Math.max(0, 1 - t * t)) * item.r * 0.9;
      parts.push('<line x1="' + num(item.at.sx - half) + '" y1="' + num(y) + '" x2="' + num(item.at.sx + half) + '" y2="' + num(y) + '" stroke="' + stripe + '" stroke-width="1.2" pointer-events="none"/>');
    });
  }
  if (body.rings) {
    parts.push('<ellipse cx="' + num(item.at.sx) + '" cy="' + num(item.at.sy) + '" rx="' + num(item.r * 1.85) + '" ry="' + num(item.r * 0.45) + '" fill="none" stroke="' + style.orbit + '" stroke-width="1" pointer-events="none"/>');
  }
}

function radialTag(parts, item, cx, cy, style) {
  const dx = item.at.sx - cx;
  const dy = item.at.sy - cy;
  const len = Math.hypot(dx, dy) || 1;
  const reach = labelReach(item);
  const x = item.at.sx + (dx / len) * (reach + 16);
  const y = item.at.sy + (dy / len) * (reach + 16);
  const anchor = dx >= 0 ? 'start' : 'end';
  parts.push('<text data-name="' + xml(item.body.id) + '" data-callout="body:' + xml(item.body.id) + '"' + submapAttr(item) + ' text-anchor="' + anchor + '" x="' + num(x) + '" y="' + num(y) + '" fill="' + style.text + '" font-size="14">' + xml(labelName(item)) + '</text>');
}

function labelName(item) {
  return item && item.submap ? nameOf(item.body) + ' ·' : nameOf(item.body);
}

function submapAttr(item) {
  return item && item.submap ? ' data-submap="true"' : '';
}

function nameTag(parts, item, style) {
  const reach = labelReach(item);
  const x = item.at.sx + reach + 8;
  const y = item.at.sy - 6;
  parts.push('<text data-name="' + xml(item.body.id) + '" data-callout="body:' + xml(item.body.id) + '" x="' + num(x) + '" y="' + num(y) + '" fill="' + style.text + '" font-size="14">' + xml(nameOf(item.body)) + '</text>');
  if (item.body.lagrange && item.body.lagrange.point) {
    parts.push('<text x="' + num(x) + '" y="' + num(y + 16) + '" fill="' + style.muted + '" font-size="12">' + xml(item.body.lagrange.point) + '</text>');
  }
}

function legend(parts, system, view, style, theme, mode, listed) {
  const rows = [];
  if (mode === 'system') {
    heliocentric(system).forEach(function (body) {
      rows.push(legendRow(body, auText(body.orbit.a_au) + ' AU', theme));
    });
    edgedBelts(system).forEach(function (body) {
      rows.push(legendRow(body, auText(body.orbit.a_inner_au) + '\u2013' + auText(body.orbit.a_outer_au) + ' AU', theme));
    });
  } else {
    (listed || []).forEach(function (body) {
      const orbit = body.orbit || {};
      const dist = typeof orbit.a_km === 'number' ? Math.round(orbit.a_km) + ' km' : '';
      rows.push(legendRow(body, dist, theme));
    });
  }
  const linear = view.distance_mode === 'linear' || view.distance_mode === 'true';
  const notes = mode === 'system'
    ? [linear ? 'True distances.' : 'Schematic distances.', 'Angles are for reading, not a date.']
    : ['Linear kilometres.', 'Moons, rings, and the disc share one scale.'];
  // The legend fits the picture. Rows that do not fit are counted instead.
  const room = Math.floor((H - 48 - 64 - notes.length * 16) / 18);
  if (rows.length > room) {
    const hidden = rows.length - (room - 1);
    rows.length = room - 1;
    rows.push({ id: '', name: 'and ' + hidden + ' more', dist: '', color: 'none', more: true });
  }
  const height = 64 + rows.length * 18 + notes.length * 16;
  const corner = String(view.legend_corner || 'tl');
  const x = corner.charAt(1) === 'r' ? W - 24 - 300 : 24;
  const y = corner.charAt(0) === 'b' ? H - 24 - height : 24;
  parts.push('<g id="legend">');
  parts.push('<rect x="' + x + '" y="' + y + '" width="300" height="' + height + '" rx="8" fill="' + style.surface + '" stroke="' + style.border + '" stroke-width="1"/>');
  parts.push('<rect x="' + (x + 16) + '" y="' + (y + 28) + '" width="72" height="2" fill="' + theme.accent + '"/>');
  parts.push('<text x="' + (x + 16) + '" y="' + (y + 22) + '" fill="' + style.text + '" font-size="16">Legend</text>');
  parts.push('<text x="' + (x + 190) + '" y="' + (y + 22) + '" fill="' + style.muted + '" font-size="12">' + (mode === 'system' ? 'True AU' : 'Distance') + '</text>');
  rows.forEach(function (row, i) {
    const yy = y + 48 + i * 18;
    if (row.more) {
      parts.push('<text x="' + (x + 34) + '" y="' + yy + '" fill="' + style.muted + '" font-size="12">' + xml(row.name) + '</text>');
      return;
    }
    parts.push('<circle data-swatch="' + xml(row.id) + '" data-callout="body:' + xml(row.id) + '" cx="' + (x + 22) + '" cy="' + (yy - 4) + '" r="4.5" fill="' + row.color + '" stroke="' + style.muted + '" stroke-width="1"/>');
    parts.push('<text x="' + (x + 34) + '" y="' + yy + '" fill="' + style.text + '" font-size="12">' + xml(row.name) + '</text>');
    parts.push('<text x="' + (x + 190) + '" y="' + yy + '" fill="' + style.muted + '" font-size="12" font-family="ui-monospace, Cascadia Mono, Consolas, monospace">' + xml(row.dist) + '</text>');
  });
  notes.forEach(function (note, i) {
    const yy = y + 56 + rows.length * 18 + i * 16;
    parts.push('<text x="' + (x + 16) + '" y="' + yy + '" fill="' + style.muted + '" font-size="12">' + xml(note) + '</text>');
  });
  parts.push('</g>');
}

function legendRow(body, dist, theme) {
  return { id: body.id, name: nameOf(body), dist: dist, color: fillFor(body, theme) };
}

function cardKey(id) {
  const text = String(id);
  if (text.slice(0, 6) === 'orbit:') return 'body:' + text.slice(6);
  return text;
}

function drawCallouts(parts, ctx) {
  const ids = [];
  (Array.isArray(ctx.view.callouts) ? ctx.view.callouts : []).forEach(function (id) {
    const key = cardKey(id);
    if (ids.indexOf(key) < 0) ids.push(key);
  });
  const blocks = [];
  ids.slice(0, 3).forEach(function (id) {
    const block = calloutBlock(id, ctx);
    if (block) blocks.push(block);
  });
  blocks.forEach(function (block, index) {
    const height = 48 + block.lines.length * 18;
    const x = index === 1 ? 24 : W - 320;
    const y = index === 0 ? 24 : H - height - 24;
    paintCard(parts, x, y, 296, height, block, ctx.style);
  });
}

function calloutBlock(id, ctx) {
  if (id === 'star' || id === 'body:star') return starBlock(ctx);
  if (id === 'transfer:hohmann' || id === 'transfer:fusion') return transferBlock(id, ctx);
  const bodyId = String(id).split(':').slice(1).join(':');
  const body = byId(ctx.system, bodyId);
  if (!body) return null;
  return bodyBlock(body, ctx);
}

function starBlock(ctx) {
  const star = ctx.system.star || {};
  const lines = [];
  if (star.spectype) lines.push(star.spectype);
  if (typeof star.mass_solar === 'number') lines.push(star.mass_solar + ' solar masses');
  if (typeof star.hz_inner_au === 'number' && typeof star.hz_outer_au === 'number') {
    lines.push('Habitable ' + auText(star.hz_inner_au) + '\u2013' + auText(star.hz_outer_au) + ' AU');
  }
  const edge = (ctx.theme.star && ctx.theme.star.edge) || ctx.style.warning;
  return {
    id: 'star',
    title: star.name || star.hostname || 'Star',
    lines: lines.length ? lines : ['Star'],
    color: edge,
    anchor: { x: ctx.CX, y: ctx.CY, rx: ctx.rStar || 48, ry: ctx.rStar || 48 }
  };
}

function bodyBlock(body, ctx) {
  const orbit = body.orbit || {};
  const lines = [];
  if (typeof orbit.a_au === 'number') lines.push(auText(orbit.a_au) + ' AU');
  if (typeof orbit.a_km === 'number') lines.push(Math.round(orbit.a_km) + ' km');
  if (typeof orbit.a_inner_au === 'number' && typeof orbit.a_outer_au === 'number') {
    lines.push(auText(orbit.a_inner_au) + '\u2013' + auText(orbit.a_outer_au) + ' AU');
  }
  if (orbit.e_max != null) {
    lines.push('Drawn at e = ' + (orbit.e || 0));
    lines.push('e \u2264 ' + orbit.e_max);
  } else if (typeof orbit.e === 'number' && orbit.e > 0) {
    lines.push('e = ' + orbit.e);
  }
  if (body.lagrange && body.lagrange.point) lines.push(String(body.lagrange.point));
  if (angleIsMissing(body)) lines.push(ANGLE_MISSING_LINE);
  (ctx.system.bodies || []).filter(function (item) { return item.parent === body.id; }).slice(0, 6).forEach(function (item) {
    lines.push(nameOf(item));
  });
  return {
    id: 'body:' + body.id,
    title: nameOf(body),
    lines: lines.length ? lines : [body.kind || 'Body'],
    color: fillFor(body, ctx.theme),
    anchor: bodyAnchor(body, ctx)
  };
}

function bodyAnchor(body, ctx) {
  const marker = (ctx.markers || []).find(function (item) { return item.body.id === body.id; });
  if (marker) {
    if (body.display && body.display.shape === 'torus') {
      const ringSize = torusRadii(marker.r);
      return { x: marker.at.sx, y: marker.at.sy, rx: ringSize.rx, ry: ringSize.ry };
    }
    return { x: marker.at.sx, y: marker.at.sy, rx: marker.r, ry: marker.r };
  }
  const orbit = body.orbit || {};
  if (body.kind === 'belt' && ctx.place && ctx.heliocentric) {
    const mid = ((orbit.a_inner_au || 0) + (orbit.a_outer_au || 0)) / 2;
    const at = ctx.place(mid, 0);
    return { x: at.sx, y: at.sy, r: 0 };
  }
  return { x: ctx.CX, y: ctx.CY, rx: ctx.focusR || ctx.rStar || 8, ry: ctx.focusR || ctx.rStar || 8 };
}

// The card reads the same trip the picture draws, on the same day.
function transferBlock(id, ctx) {
  const tDays = clockDays(ctx.view);
  const angles = ctx.angles || displayAngles(ctx.system);
  const plan = tripPlan(ctx.system, ctx.view, tDays, angles);
  if (!plan) return null;
  const hop = plan.hop;
  const flown = flyPlan(ctx.system, plan, angles);
  const fusionLine = flown ? flown.days.toFixed(0) + ' d at this spacing' : 'No matched burn at this spacing';
  const hohmann = id === 'transfer:hohmann';
  const lines = hohmann
    ? ['Hohmann ' + hop.days.toFixed(0) + ' d', hop.dv1_km_s.toFixed(1) + ' + ' + hop.dv2_km_s.toFixed(1) + ' km/s', fusionLine]
    : ['Fusion ' + plan.drive.thrust_g + ' g, ballpark', fusionLine];
  if (plan.massAssumed) lines.push('Star mass not given: 1 solar mass assumed');
  return {
    id: id,
    title: nameOf(plan.named.from) + ' to ' + nameOf(plan.named.to),
    lines: lines,
    color: hohmann ? ctx.style.hohmann : ctx.style.fusion,
    anchor: transferAnchor(id, ctx, plan, flown)
  };
}

// The leader ends on the drawn arc: its middle point on this day.
function transferAnchor(id, ctx, plan, flown) {
  if (!ctx.place || !ctx.heliocentric) return { x: ctx.CX, y: ctx.CY, r: 0 };
  if (id === 'transfer:fusion' && flown) {
    const mid = flown.at(flown.T * 0.5);
    const at = ctx.place(mid[0], mid[1]);
    return { x: at.sx, y: at.sy, r: 0 };
  }
  const mid = plan.arc[Math.floor(plan.arc.length / 2)];
  const at = ctx.place(mid[0], mid[1]);
  return { x: at.sx, y: at.sy, r: 0 };
}

function nameOf(body) {
  return body && body.name ? body.name : String(body && body.id);
}

function paintCard(parts, x, y, w, h, block, style) {
  const from = rectEdge(x, y, w, h, block.anchor.x, block.anchor.y);
  const end = leaderEnd(block.anchor, from);
  parts.push('<line data-role="leader" x1="' + num(from.x) + '" y1="' + num(from.y) + '" x2="' + num(end.x) + '" y2="' + num(end.y) + '" stroke="' + block.color + '" stroke-width="1" pointer-events="none"/>');
  parts.push('<g data-callout="' + xml(block.id) + '">');
  parts.push('<rect class="card" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + style.surface + '" stroke="' + block.color + '" stroke-width="1.5"/>');
  parts.push('<circle cx="' + (x + 22) + '" cy="' + (y + 16) + '" r="5" fill="' + block.color + '" stroke="' + style.muted + '" stroke-width="1" pointer-events="none"/>');
  parts.push('<text x="' + (x + 36) + '" y="' + (y + 21) + '" fill="' + style.text + '" font-size="16">' + xml(block.title) + '</text>');
  block.lines.forEach(function (line, i) {
    parts.push('<text x="' + (x + 16) + '" y="' + (y + 46 + i * 18) + '" fill="' + style.muted + '" font-size="14">' + xml(line) + '</text>');
  });
  parts.push('</g>');
}

function rectEdge(x, y, w, h, tx, ty) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx === 0 ? Infinity : (w / 2) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function leaderEnd(anchor, from) {
  const rx = anchor.rx || anchor.r || 0;
  const ry = anchor.ry || anchor.r || 0;
  if (!(rx > 0) || !(ry > 0)) return { x: anchor.x, y: anchor.y };
  const vx = from.x - anchor.x;
  const vy = from.y - anchor.y;
  const denom = (vx * vx) / (rx * rx) + (vy * vy) / (ry * ry);
  if (!(denom > 0)) return { x: anchor.x, y: anchor.y };
  const scale = 1 / Math.sqrt(denom);
  return { x: anchor.x + vx * scale, y: anchor.y + vy * scale };
}

function layer(view, name) {
  return !view.layers || view.layers[name] !== false;
}
