export const VIEWER_SYSTEM_ID = 'tau-ceti';
export const STAR_OBJECT_ID = 'star';
export const OPEN_LABEL = 'Open in Orbital Object Details';

const SYSTEM_FILES = {
  'tau-ceti': '../data/tau-ceti.system.json'
};

const OBJECT_ID = /^[A-Za-z0-9_-]+$/;

export function builderHref(systemId, objectId) {
  const params = new URLSearchParams();
  params.set('system', systemId || VIEWER_SYSTEM_ID);
  if (objectId) params.set('object', objectId);
  return '../manual/#' + params.toString();
}

export function focusTarget(system, objectId) {
  if (!objectId || typeof objectId !== 'string') return null;
  if (objectId === STAR_OBJECT_ID) {
    return { kind: 'star', id: STAR_OBJECT_ID, selector: '#star-card' };
  }
  if (!OBJECT_ID.test(objectId)) return null;
  const bodies = system && Array.isArray(system.bodies) ? system.bodies : [];
  const found = bodies.some(function (body) { return body && body.id === objectId; });
  if (!found) return null;
  return { kind: 'body', id: objectId, selector: '[data-body="' + objectId + '"]' };
}

export function parseBuilderHash(hash) {
  const raw = String(hash == null ? '' : hash);
  const text = raw.charAt(0) === '#' ? raw.slice(1) : raw;
  const params = new URLSearchParams(text);
  const systemId = params.get('system');
  if (!systemId || !Object.prototype.hasOwnProperty.call(SYSTEM_FILES, systemId)) {
    return { mode: 'blank', systemId: null, objectId: null, file: null, focus: null };
  }
  const file = SYSTEM_FILES[systemId];
  const objectRaw = params.get('object');
  if (!objectRaw || (objectRaw !== STAR_OBJECT_ID && !OBJECT_ID.test(objectRaw))) {
    return { mode: 'load', systemId: systemId, objectId: null, file: file, focus: null };
  }
  const focus = objectRaw === STAR_OBJECT_ID
    ? focusTarget({ bodies: [] }, objectRaw)
    : focusTarget({ bodies: [{ id: objectRaw }] }, objectRaw);
  return { mode: 'load', systemId: systemId, objectId: objectRaw, file: file, focus: focus };
}

export function cardLinks(spec) {
  const item = spec || {};
  const systemId = item.systemId || VIEWER_SYSTEM_ID;
  if (item.kind === 'transfer' && item.fromId && item.toId) {
    const fromName = item.fromName || item.fromId;
    const toName = item.toName || item.toId;
    return [
      {
        objectId: item.fromId,
        href: builderHref(systemId, item.fromId),
        label: 'Open ' + fromName + ' in Orbital Object Details'
      },
      {
        objectId: item.toId,
        href: builderHref(systemId, item.toId),
        label: 'Open ' + toName + ' in Orbital Object Details'
      }
    ];
  }
  const id = item.kind === 'star' || item.id === STAR_OBJECT_ID ? STAR_OBJECT_ID : item.id;
  return [{
    objectId: id,
    href: builderHref(systemId, id),
    label: OPEN_LABEL
  }];
}

export function manualBodyFromSystem(body) {
  const source = body && typeof body === 'object' ? body : {};
  const next = Object.assign({}, source);
  const orbit = source.orbit || {};
  const heliocentric = typeof orbit.a_au === 'number' && Number.isFinite(orbit.a_au);
  if ((next.au == null || next.au === '') && heliocentric) {
    next.au = String(orbit.a_au);
  }
  if (heliocentric && (next.period == null || next.period === '') && typeof orbit.period_days === 'number' && Number.isFinite(orbit.period_days)) {
    next.period = String(orbit.period_days);
    if (!next.unit) next.unit = 'days';
  }
  return next;
}

if (typeof window !== 'undefined') {
  window.OrbitBuilderLink = {
    VIEWER_SYSTEM_ID: VIEWER_SYSTEM_ID,
    STAR_OBJECT_ID: STAR_OBJECT_ID,
    OPEN_LABEL: OPEN_LABEL,
    builderHref: builderHref,
    parseBuilderHash: parseBuilderHash,
    focusTarget: focusTarget,
    cardLinks: cardLinks,
    manualBodyFromSystem: manualBodyFromSystem
  };
}
