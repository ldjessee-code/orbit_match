// TEMP skybox A/B (Doug 10/20) - remove after sky integration
// Rudy cube faces are pre-baked for three.js CubeTextureLoader. Load them as-is.

export const TEMP_SKYBOX_MARKER = 'TEMP skybox A/B (Doug 10/20) - remove after sky integration';

export const DEFAULT_SKY = 'procedural';

export const CUBE_PATH = 'sky/cube/';

export const CUBE_FACE_FILES = Object.freeze([
  'px.png',
  'nx.png',
  'py.png',
  'ny.png',
  'pz.png',
  'nz.png'
]);

export const EQUIRECT_URL = 'sky/tauceti_sky_equirect_4k.png';

export function cubeLoadPlan() {
  return {
    path: CUBE_PATH,
    files: CUBE_FACE_FILES.slice(),
    mirror: false,
    flip: false,
    colorSpace: 'SRGBColorSpace'
  };
}

export function equirectLoadPlan() {
  return {
    url: EQUIRECT_URL,
    mapping: 'EquirectangularReflectionMapping',
    colorSpace: 'SRGBColorSpace',
    flip: false
  };
}

export function createSkyAb(procedural) {
  return {
    mode: DEFAULT_SKY,
    procedural: procedural || null,
    cube: null,
    equirect: null,
    cubePending: false,
    equirectPending: false
  };
}

export function setSkyMode(state, mode) {
  if (mode === 'cube' || mode === 'equirect') state.mode = mode;
  else state.mode = DEFAULT_SKY;
  return state;
}

export function toggleCube(state) {
  state.mode = state.mode === 'cube' ? DEFAULT_SKY : 'cube';
  return state;
}

export function backgroundFor(state) {
  if (!state) return null;
  if (state.mode === 'cube' && state.cube) return state.cube;
  if (state.mode === 'equirect' && state.equirect) return state.equirect;
  return state.procedural;
}

export function swapBackground(scene, procedural, alternate, useAlternate) {
  const next = useAlternate ? alternate : procedural;
  if (scene) scene.background = next;
  return next;
}

export function skyToggleFromKey(event) {
  if (!event || event.repeat) return false;
  const key = event.key;
  if (key !== 'b' && key !== 'B') return false;
  const target = event.target || null;
  if (target && target.isContentEditable) return false;
  const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  return true;
}
