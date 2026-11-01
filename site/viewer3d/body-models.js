// Maps Tau Ceti system ids onto Rudy's unit-radius body glbs.
// Display scale is the scene radius already used for the fallback sphere.

export const BODY_MODEL_FILE = {
  star: 'tau-ceti.glb',
  tc1: 'gane.glb',
  tc2: 'hornstooth.glb',
  tc3: 'husk.glb',
  tc4: 'sable.glb',
  tc5: 'kakakiko.glb',
  tc5a: 'shudder.glb',
  tc5b: 'der-eindringling.glb',
  tc6: 'croquet-ball.glb',
  tc6gate: 'jumpgate-ring-v4.glb',
  tc7: 'cue-ball.glb',
  tc8: 'eight-ball.glb'
};

export const JUMPGATE_RING_BODY_ID = 'tc6gate';
export const JUMPGATE_RING_TRUE_OUTER_RADIUS_M = 515.625;
// Outer radius of the jumpgate ring in the system view, in scene units.
// True outer radius is 515.625 m (1.03125 km across). At AU scale that is
// invisible, so the ring is drawn at 0.36: larger than the old marker
// (~0.236) and smaller than Croquet Ball / tc6 (~0.402). About 100000
// times the true size next to tc6. The drawn size is never the true size
// in the normal view.
export const JUMPGATE_RING_DISPLAY_OUTER_RADIUS = 0.36;
export const JUMPGATE_RING_ENLARGE_FACTOR = 100000;

export function isJumpgateRingBody(id) {
  return id === JUMPGATE_RING_BODY_ID;
}

export function ringModelScale(displayOuterRadius) {
  const radius = Number(displayOuterRadius);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  return radius / JUMPGATE_RING_TRUE_OUTER_RADIUS_M;
}

export function modelDisplayRadius(id, sceneRadius) {
  if (isJumpgateRingBody(id)) return JUMPGATE_RING_DISPLAY_OUTER_RADIUS;
  return sceneRadius;
}

export function shouldHideGlbRingNode(nodeName, bodyId) {
  if (isJumpgateRingBody(bodyId)) return false;
  return isGlbRingNode(nodeName);
}

export function jumpgateRingScaleNote(trueScale) {
  if (trueScale) return '';
  return 'Jumpgate ring: drawn about ' + JUMPGATE_RING_ENLARGE_FACTOR +
    ' times its true size so it can be seen. Not to scale.';
}

export function jumpgateRingBodyLabel(name, trueScale) {
  const base = name == null ? '' : String(name);
  if (trueScale) return base;
  if (!base) return 'not to scale';
  return base + ' (not to scale)';
}

export function isGlbRingNode(name) {
  return /ring/i.test(String(name == null ? '' : name));
}

function cleanModelPath(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.indexOf('..') >= 0 || text.indexOf('\\') >= 0 || text.indexOf('\n') >= 0) return null;
  if (!/\.glb$/i.test(text)) return null;
  return text.replace(/^\//, '');
}

function modelFromSystem(id, system) {
  if (!system || typeof system !== 'object') return undefined;
  if (id === 'star' && system.star && Object.prototype.hasOwnProperty.call(system.star, 'model')) {
    return cleanModelPath(system.star.model);
  }
  const body = (system.bodies || []).find(function (item) { return item && item.id === id; });
  if (body && Object.prototype.hasOwnProperty.call(body, 'model')) return cleanModelPath(body.model);
  return undefined;
}

export function modelFileForBody(id, system) {
  const fromData = modelFromSystem(id, system);
  if (fromData !== undefined) return fromData;
  const file = BODY_MODEL_FILE[id];
  if (!file) return null;
  return 'models/' + file;
}

export function modelScale(displayRadius, id) {
  if (isJumpgateRingBody(id)) return ringModelScale(displayRadius);
  const radius = Number(displayRadius);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  return radius;
}

export function modelMountPlan(result, id, displayRadius, fileOverride) {
  const pickId = id == null ? null : String(id);
  const file = fileOverride !== undefined ? fileOverride : modelFileForBody(pickId);
  const scale = modelScale(displayRadius, pickId);
  if (!(result && result.ok && file && scale != null)) {
    return { pickId: pickId, fallback: true, hideSphere: false, scale: null, file: file };
  }
  return { pickId: pickId, fallback: false, hideSphere: true, scale: scale, file: file };
}

export function applyBodyModelLoadResult(host, loadOk, id, displayRadius, file) {
  const plan = modelMountPlan(loadOk ? { ok: true } : { ok: false }, id, displayRadius, file);
  if (host) {
    if (!host.userData) host.userData = {};
    host.userData.modelFallback = !!plan.fallback;
  }
  return plan;
}

// South winter ice matches the blend hide_render and the r3 preview (north cap only).
export const KAKAKIKO_LAYERS = [
  {
    key: 'clouds',
    nodeName: 'SM_kakakiko_clouds',
    controlId: 'kakakiko-clouds',
    label: 'Clouds',
    defaultVisible: true
  },
  {
    key: 'seaice-north',
    nodeName: 'SM_kakakiko_seaice_north_winter',
    controlId: 'kakakiko-seaice-north',
    label: 'N winter sea ice',
    defaultVisible: true
  },
  {
    key: 'seaice-south',
    nodeName: 'SM_kakakiko_seaice_south_winter',
    controlId: 'kakakiko-seaice-south',
    label: 'S winter sea ice',
    defaultVisible: false
  },
  {
    key: 'atmosphere',
    nodeName: 'SM_kakakiko_atmosphere_PLACEHOLDER',
    controlId: 'kakakiko-atmosphere',
    label: 'Atmosphere glow',
    defaultVisible: true
  }
];

function layerCatalog(layers) {
  return Array.isArray(layers) && layers.length ? layers : KAKAKIKO_LAYERS;
}

function layerDefault(layer) {
  if (!layer) return false;
  if (layer.defaultVisible != null) return !!layer.defaultVisible;
  if (layer.default === false) return false;
  return true;
}

function layerNodeName(layer) {
  if (!layer) return '';
  if (layer.nodeName != null) return layer.nodeName;
  return layer.node == null ? '' : layer.node;
}

export function defaultLayerState(layers) {
  const state = {};
  layerCatalog(layers).forEach(function (layer) {
    state[layer.key] = layerDefault(layer);
  });
  return state;
}

export function setLayerVisible(state, key, visible, layers) {
  const list = layerCatalog(layers);
  const next = {};
  const seen = {};
  list.forEach(function (layer) {
    seen[layer.key] = true;
    const current = state && typeof state[layer.key] === 'boolean' ? state[layer.key] : layerDefault(layer);
    next[layer.key] = layer.key === key ? !!visible : current;
  });
  if (state) {
    Object.keys(state).forEach(function (name) {
      if (seen[name]) return;
      next[name] = name === key ? !!visible : state[name];
    });
  }
  if (!seen[key]) next[key] = !!visible;
  return next;
}

export function layerVisibleForNode(nodeName, state, layers) {
  const list = layerCatalog(layers);
  for (let i = 0; i < list.length; i++) {
    const layer = list[i];
    if (layerNodeName(layer) !== nodeName) continue;
    if (state && typeof state[layer.key] === 'boolean') return state[layer.key];
    return layerDefault(layer);
  }
  return null;
}

export function applyLayerList(nodes, state, layers) {
  return (nodes || []).map(function (node) {
    const visible = layerVisibleForNode(node && node.name, state, layers);
    if (visible === null) return Object.assign({}, node);
    return Object.assign({}, node, { visible: visible });
  });
}
