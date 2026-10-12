import { pos, hohmannDays, fusionMatched, AU_M } from './kepler.js';

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
    .replace(/>/g, '&gt;');
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

function heliocentric(system) {
  return (system.bodies || []).filter(function (body) {
    return body.parent == null && body.kind !== 'belt' && typeof body.orbit.a_au === 'number';
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

function diskRadius(body) {
  const radius = body.physical && body.physical.radius_km;
  const earth = 6371;
  const used = radius > 0 ? radius : earth * 0.5;
  return 1.15 * (7 + 4 * Math.pow(used / earth, 0.4));
}

function fillFor(body, theme) {
  const display = body.display || {};
  if (display.color) return display.color;
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

export function renderSvg(system, view, theme, style, options) {
  const frame = options && options.frame && options.frame !== 'system' ? options.frame : 'system';
  const focus = frame === 'system' ? null : byId(system, frame);
  if (focus && focus.orbit && typeof focus.orbit.a_km !== 'number' && focus.kind !== 'belt') {
    return renderClose(system, view, theme, style, focus);
  }
  if (focus && typeof (focus.orbit && focus.orbit.a_km) === 'number') {
    const parent = byId(system, focus.parent);
    return renderClose(system, view, theme, style, parent || focus);
  }
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
  const map = schematicMap(distances, rIn, fit);
  const place = function (x, y) {
    const r = Math.hypot(x, y);
    const scale = r === 0 ? 1 : map(r) / r;
    return project(x, y, { cx: CX, cy: CY, scale: scale, elevation_deg: elev, azimuth_deg: az });
  };
  const angles = displayAngles(system);
  const parts = [];
  parts.push(openSvg(style, theme));
  if (layer(view, 'habitable')) band(parts, system, map, CX, CY, ratio, style);
  if (layer(view, 'belts')) belts(parts, system, place, style);
  if (layer(view, 'orbits')) {
    const seen = new Set();
    heliocentric(system).forEach(function (body) {
      const key = auText(body.orbit.a_au);
      if (seen.has(key)) return;
      seen.add(key);
      ring(parts, CX, CY, map(body.orbit.a_au), ratio, style.orbit, body.orbit.a_au, body.id);
    });
  }
  if (layer(view, 'transfers')) transfer(parts, system, view, place, style, angles);
  const markers = heliocentric(system).map(function (body) {
    const angle = angles.get(body.id) || 0;
    const e = body.orbit.e || 0;
    const spot = pos({
      a: body.orbit.a_au,
      e: e,
      period_days: body.orbit.period_days || 365.25,
      M0: angle,
      w: 0
    }, 0);
    const at = place(spot.x, spot.y);
    return { body: body, at: at, r: diskRadius(body) };
  }).sort(function (a, b) { return a.at.sy - b.at.sy; });
  markers.filter(function (item) { return item.at.sy < CY; }).forEach(function (item) { bodyMark(parts, item, theme, style); });
  starDisk(parts, system, CX, CY, rStar, theme, style);
  markers.filter(function (item) { return item.at.sy >= CY; }).forEach(function (item) { bodyMark(parts, item, theme, style); });
  if (layer(view, 'labels')) {
    markers.forEach(function (item) { nameTag(parts, item, style); });
    (system.bodies || []).filter(function (body) { return body.kind === 'belt'; }).forEach(function (body) {
      const mid = ((body.orbit.a_inner_au || 0) + (body.orbit.a_outer_au || 0)) / 2;
      const at = place(mid, 0.15 * mid);
      parts.push('<text data-callout="body:' + xml(body.id) + '" x="' + num(at.sx) + '" y="' + num(at.sy) + '" fill="' + style.text + '" font-size="14">' + xml(body.name) + '</text>');
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

function renderClose(system, view, theme, style, focus) {
  const elev = view.elevation_deg;
  const az = view.azimuth_deg || 0;
  const ratio = Math.sin((elev * Math.PI) / 180);
  const CX = 820;
  const CY = 530;
  const children = (system.bodies || []).filter(function (body) { return body.parent === focus.id; });
  let maxKm = 1;
  children.forEach(function (body) {
    const a = body.orbit.a_km || 0;
    const e = body.orbit.e || 0;
    maxKm = Math.max(maxKm, a * (1 + e));
  });
  const px = 360 / maxKm;
  const place = function (x, y) {
    return project(x, y, { cx: CX, cy: CY, scale: px, elevation_deg: elev, azimuth_deg: az });
  };
  const parts = [];
  parts.push(openSvg(style, theme));
  const sync = children.filter(function (body) { return body.kind === 'structure' && body.orbit.a_km; });
  if (sync.length && layer(view, 'structures')) {
    ring(parts, CX, CY, sync[0].orbit.a_km * px, ratio, style.orbit, null, sync[0].id);
    const labelAt = place(sync[0].orbit.a_km, 0);
    parts.push('<text x="' + num(labelAt.sx + 8) + '" y="' + num(labelAt.sy - 8) + '" fill="' + style.muted + '" font-size="12">' + Math.round(sync[0].orbit.a_km) + ' km</text>');
  }
  if (layer(view, 'orbits')) {
    children.filter(function (body) { return body.kind !== 'structure'; }).forEach(function (body) {
      drawChildOrbit(parts, body, place, px, ratio, CX, CY, style);
    });
  }
  const marks = [];
  children.forEach(function (body) {
    const a = body.orbit.a_km || 0;
    const e = body.orbit.e || 0;
    let x = a;
    let y = 0;
    if (typeof body.angle_deg === 'number') {
      const ang = (body.angle_deg * Math.PI) / 180;
      x = a * Math.cos(ang);
      y = a * Math.sin(ang);
    } else if (e) {
      const spot = pos({ a: a, e: e, period_days: body.orbit.period_days || 1, M0: 0, w: 0 }, 0);
      x = spot.x;
      y = spot.y;
    }
    const at = place(x, y);
    marks.push({ body: body, at: at, r: body.kind === 'structure' ? 5 : Math.max(6, diskRadius(body) * 0.45) });
    if (e >= 0.1 && layer(view, 'labels')) {
      const peri = a * (1 - e);
      const pe = place(peri, 0);
      parts.push('<text x="' + num(pe.sx + 8) + '" y="' + num(pe.sy + 16) + '" fill="' + style.text + '" font-size="12">' + Math.round(peri) + ' km</text>');
    }
  });
  marks.sort(function (a, b) { return a.at.sy - b.at.sy; });
  marks.forEach(function (item) { bodyMark(parts, item, theme, style); });
  const focusR = Math.max(18, diskRadius(focus));
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

function drawChildOrbit(parts, body, place, px, ratio, cx, cy, style) {
  const a = body.orbit.a_km || 0;
  const e = body.orbit.e || 0;
  if (e >= 0.05 && body.orbit.period_days) {
    const pts = [];
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const spot = pos({ a: a, e: e, period_days: body.orbit.period_days, M0: 0, w: 0 }, body.orbit.period_days * i / steps);
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
    const color = (body.display && body.display.color) || style.belt || style.muted;
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

function transfer(parts, system, view, place, style, angles) {
  const spec = view.transfer;
  if (!spec || !spec.from || !spec.to) return;
  const from = byId(system, spec.from);
  const to = byId(system, spec.to);
  if (!from || !to || !(from.orbit.a_au > 0) || !(to.orbit.a_au > 0)) return;
  const mass = system.star && system.star.mass_solar ? system.star.mass_solar : 1;
  const hop = hohmannDays(from.orbit.a_au, to.orbit.a_au, mass);
  const ang = angles.get(from.id) || 0;
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const nu = (Math.PI * i) / 80;
    const r = hop.at_au * (1 - hop.e * hop.e) / (1 + hop.e * Math.cos(nu));
    pts.push(place(r * Math.cos(ang + nu), r * Math.sin(ang + nu)));
  }
  const d = polyline(pts);
  parts.push('<path data-callout="transfer:hohmann" d="' + d + '" fill="none" stroke="transparent" stroke-width="12"/>');
  parts.push('<path data-role="hohmann" data-days="' + hop.days.toFixed(0) + '" d="' + d + '" fill="none" stroke="' + style.hohmann + '" stroke-width="1.5" stroke-dasharray="' + (style.hohmann_dash || '8 6') + '" pointer-events="none"/>');
  const flown = fuse(from, to, ang, angles.get(to.id) || 0);
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

function fuse(from, to, fromAngle, toAngle) {
  try {
    const dep = xy(from, fromAngle);
    const tgt = xy(to, toAngle);
    return fusionMatched(dep, tgt, 0, 0.01 * G0, 150000, AU_M);
  } catch (err) {
    return null;
  }
}

function xy(body, angle) {
  const orbit = {
    a: body.orbit.a_au,
    e: body.orbit.e || 0,
    period_days: body.orbit.period_days || 365.25,
    M0: angle,
    w: 0
  };
  return function (t) {
    const spot = pos(orbit, t);
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
  parts.push('<text data-name="' + xml(item.body.id) + '" data-callout="body:' + xml(item.body.id) + '" text-anchor="' + anchor + '" x="' + num(x) + '" y="' + num(y) + '" fill="' + style.text + '" font-size="14">' + xml(item.body.name) + '</text>');
}

function nameTag(parts, item, style) {
  const reach = labelReach(item);
  const x = item.at.sx + reach + 8;
  const y = item.at.sy - 6;
  parts.push('<text data-name="' + xml(item.body.id) + '" data-callout="body:' + xml(item.body.id) + '" x="' + num(x) + '" y="' + num(y) + '" fill="' + style.text + '" font-size="14">' + xml(item.body.name) + '</text>');
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
    (system.bodies || []).filter(function (body) { return body.kind === 'belt'; }).forEach(function (body) {
      rows.push(legendRow(body, auText(body.orbit.a_inner_au) + '\u2013' + auText(body.orbit.a_outer_au) + ' AU', theme));
    });
  } else {
    (listed || []).forEach(function (body) {
      const orbit = body.orbit || {};
      const dist = typeof orbit.a_km === 'number' ? Math.round(orbit.a_km) + ' km' : '';
      rows.push(legendRow(body, dist, theme));
    });
  }
  const x = 24;
  const y = 24;
  const notes = mode === 'system'
    ? ['Schematic distances.', 'Angles are for reading, not a date.']
    : ['Linear kilometres.', 'Stations share the synchronous ring.'];
  const height = 64 + rows.length * 18 + notes.length * 16;
  parts.push('<g id="legend">');
  parts.push('<rect x="' + x + '" y="' + y + '" width="300" height="' + height + '" rx="8" fill="' + style.surface + '" stroke="' + style.border + '" stroke-width="1"/>');
  parts.push('<rect x="' + (x + 16) + '" y="' + (y + 28) + '" width="72" height="2" fill="' + theme.accent + '"/>');
  parts.push('<text x="' + (x + 16) + '" y="' + (y + 22) + '" fill="' + style.text + '" font-size="16">Legend</text>');
  parts.push('<text x="' + (x + 190) + '" y="' + (y + 22) + '" fill="' + style.muted + '" font-size="12">' + (mode === 'system' ? 'True AU' : 'Distance') + '</text>');
  rows.forEach(function (row, i) {
    const yy = y + 48 + i * 18;
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
  return { id: body.id, name: body.name, dist: dist, color: fillFor(body, theme) };
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
  const split = String(id).split(':');
  const kind = split[0];
  const bodyId = split.slice(1).join(':');
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
  (ctx.system.bodies || []).filter(function (item) { return item.parent === body.id; }).slice(0, 6).forEach(function (item) {
    lines.push(item.name);
  });
  return {
    id: 'body:' + body.id,
    title: body.name,
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

function transferBlock(id, ctx) {
  const spec = ctx.view.transfer;
  if (!spec || !spec.from || !spec.to) return null;
  const from = byId(ctx.system, spec.from);
  const to = byId(ctx.system, spec.to);
  if (!from || !to || !(from.orbit.a_au > 0) || !(to.orbit.a_au > 0)) return null;
  const mass = ctx.system.star && ctx.system.star.mass_solar ? ctx.system.star.mass_solar : 1;
  const hop = hohmannDays(from.orbit.a_au, to.orbit.a_au, mass);
  const ang = (ctx.angles && ctx.angles.get(from.id)) || 0;
  const flown = fuse(from, to, ang, (ctx.angles && ctx.angles.get(to.id)) || 0);
  const fusionLine = flown ? flown.days.toFixed(0) + ' d at this spacing' : 'No matched burn at this spacing';
  const hohmann = id === 'transfer:hohmann';
  const lines = hohmann
    ? ['Hohmann ' + hop.days.toFixed(0) + ' d', hop.dv1_km_s.toFixed(1) + ' + ' + hop.dv2_km_s.toFixed(1) + ' km/s', fusionLine]
    : ['Fusion 0.01 g, ballpark', fusionLine];
  return {
    id: id,
    title: from.name + ' to ' + to.name,
    lines: lines,
    color: hohmann ? ctx.style.hohmann : ctx.style.fusion,
    anchor: transferAnchor(id, ctx, from, hop, ang, flown)
  };
}

function transferAnchor(id, ctx, from, hop, ang, flown) {
  if (!ctx.place || !ctx.heliocentric) return { x: ctx.CX, y: ctx.CY, r: 0 };
  if (id === 'transfer:fusion' && flown) {
    const mid = flown.at(flown.T * 0.5);
    const at = ctx.place(mid[0], mid[1]);
    return { x: at.sx, y: at.sy, r: 0 };
  }
  const nu = Math.PI / 2;
  const r = hop.at_au * (1 - hop.e * hop.e) / (1 + hop.e * Math.cos(nu));
  const at = ctx.place(r * Math.cos(ang + nu), r * Math.sin(ang + nu));
  return { x: at.sx, y: at.sy, r: 0 };
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
