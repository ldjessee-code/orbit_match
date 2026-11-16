// Which viewer stays on screen.
//
// An explicit URL wins on either page. view=svg, view=2d, or low=1 selects SVG.
// view=3d or low=0 selects 3D.
// With no view and no low parameter, the folder you opened stays:
// viewer/ stays on SVG, and viewer3d/ stays on 3D.
// The one exception is viewer3d/ when the probe reports webgl === false.
// That page then opens the SVG viewer.
// This decision ignores localStorage key orbit-match-viewer-mode.
// The switch button may still write that key. It also puts view= in the URL,
// so the next load is an explicit choice.
//
// detectLowResource still reports the old heuristics. Any one match is low:
// - WebGL is unavailable (webgl === false).
// - navigator.connection.saveData is true.
// - navigator.deviceMemory is a positive number and <= 2 (gigabytes). Missing or 0 is ignored.
// - navigator.hardwareConcurrency is a positive number and <= 2. Missing or 0 is ignored.
// - matchMedia('(prefers-reduced-motion: reduce)') matches.
// - WebGL MAX_TEXTURE_SIZE is a positive number below 4096 (the 4k sky needs 4096).
// Only webgl === false changes the open page, and only on viewer3d/ when the URL is silent.

export const RESOURCE_STORAGE_KEY = 'orbit-match-viewer-mode';

export function urlViewerMode(search) {
  const raw = search == null ? '' : String(search);
  const params = new URLSearchParams(raw.charAt(0) === '?' ? raw.slice(1) : raw);
  const view = String(params.get('view') || '').toLowerCase();
  const low = String(params.get('low') || '').toLowerCase();
  if (view === 'svg' || view === '2d' || low === '1' || low === 'true') return 'svg';
  if (view === '3d' || low === '0' || low === 'false') return '3d';
  return null;
}

export function storedViewerMode(value) {
  if (value === 'svg' || value === '3d') return value;
  return null;
}

export function detectLowResource(signals) {
  const src = signals || {};
  if (src.webgl === false) return true;
  if (src.saveData === true) return true;
  if (typeof src.deviceMemory === 'number' && src.deviceMemory > 0 && src.deviceMemory <= 2) return true;
  if (typeof src.hardwareConcurrency === 'number' && src.hardwareConcurrency > 0 && src.hardwareConcurrency <= 2) return true;
  if (src.prefersReducedMotion === true) return true;
  if (typeof src.maxTextureSize === 'number' && src.maxTextureSize > 0 && src.maxTextureSize < 4096) return true;
  return false;
}

export function chooseViewer(input) {
  const src = input || {};
  const url = urlViewerMode(src.search || '');
  if (url) return { mode: url, source: 'url', low: url === 'svg' };
  const page = src.page === 'svg' || src.page === '3d' ? src.page : null;
  if (page === '3d' && src.signals && src.signals.webgl === false) {
    return { mode: 'svg', source: 'webgl', low: true };
  }
  if (page === 'svg') return { mode: 'svg', source: 'page', low: true };
  return { mode: '3d', source: 'page', low: false };
}

export function decideViewer(env) {
  const src = env || {};
  const search = src.search || '';
  const page = src.page;
  const storedRaw = src.stored;
  if (urlViewerMode(search)) {
    return chooseViewer({ search: search, page: page, stored: storedRaw, signals: src.signals || {} });
  }
  let signals = Object.assign({}, src.signals || {});
  const knownWebgl = signals.webgl === true || signals.webgl === false;
  if (page === '3d' && !knownWebgl && typeof src.probe === 'function') {
    const extra = src.probe() || {};
    signals = Object.assign({}, signals, extra);
  }
  return chooseViewer({ search: search, page: page, stored: storedRaw, signals: signals });
}

export function resourceDestination(page, choice, search) {
  if (!choice || (choice.mode !== '3d' && choice.mode !== 'svg')) return null;
  if (choice.mode === page) return null;
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  params.delete('low');
  params.set('view', choice.mode);
  const query = params.toString();
  const base = choice.mode === 'svg' ? '../viewer/' : '../viewer3d/';
  return base + (query ? '?' + query : '');
}

export function readResourceStorage(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (!store || !store.getItem) return null;
    return store.getItem(RESOURCE_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

export function writeResourceStorage(mode, storage) {
  if (mode !== '3d' && mode !== 'svg') return false;
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (!store || !store.setItem) return false;
    store.setItem(RESOURCE_STORAGE_KEY, mode);
    return true;
  } catch (err) {
    return false;
  }
}

export function collectBrowserSignals(options) {
  const opts = options || {};
  const root = opts.root || (typeof globalThis === 'undefined' ? {} : globalThis);
  const nav = root.navigator || {};
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection || {};
  let reduced = false;
  try {
    const match = root.matchMedia;
    if (typeof match === 'function') {
      reduced = !!match.call(root, '(prefers-reduced-motion: reduce)').matches;
    }
  } catch (err) {
    reduced = false;
  }
  const signals = {
    saveData: connection.saveData === true,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    prefersReducedMotion: reduced
  };
  if (opts.probeWebgl && typeof opts.probe === 'function') {
    const probed = opts.probe() || {};
    if (probed.webgl === true || probed.webgl === false) signals.webgl = probed.webgl;
    if (typeof probed.maxTextureSize === 'number') signals.maxTextureSize = probed.maxTextureSize;
  }
  return signals;
}
