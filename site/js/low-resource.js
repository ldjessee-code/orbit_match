// Low-resource gate. Capable browsers stay on the 3D viewer. The SVG viewer is the low-power page.
//
// Heuristics (any one match selects SVG when the URL and localStorage have not chosen):
// - WebGL is unavailable (webgl === false).
// - navigator.connection.saveData is true.
// - navigator.deviceMemory is a positive number and <= 2 (gigabytes). Missing or 0 is ignored.
// - navigator.hardwareConcurrency is a positive number and <= 2. Missing or 0 is ignored.
// - matchMedia('(prefers-reduced-motion: reduce)') matches.
// - WebGL MAX_TEXTURE_SIZE is a positive number below 4096 (the 4k sky needs 4096).
//
// Choice order: URL (view=3d|svg or low=0|1), then localStorage key orbit-match-viewer-mode,
// then the heuristics. No matching signal means 3D.

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
  const stored = storedViewerMode(src.stored);
  if (stored) return { mode: stored, source: 'storage', low: stored === 'svg' };
  const low = detectLowResource(src.signals);
  return { mode: low ? 'svg' : '3d', source: 'auto', low: low };
}

export function decideViewer(env) {
  const src = env || {};
  const search = src.search || '';
  const storedRaw = src.stored;
  if (urlViewerMode(search) || storedViewerMode(storedRaw)) {
    return chooseViewer({ search: search, stored: storedRaw, signals: src.signals || {} });
  }
  let signals = Object.assign({}, src.signals || {});
  const early = chooseViewer({ search: search, stored: storedRaw, signals: signals });
  if (early.mode === 'svg' || typeof src.probe !== 'function') return early;
  const extra = src.probe() || {};
  signals = Object.assign({}, signals, extra);
  return chooseViewer({ search: search, stored: storedRaw, signals: signals });
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
