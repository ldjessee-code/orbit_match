// Shared viewer clock. One elapsed_days per system id, in localStorage.
// The system file and the view file stay at the epoch. Days drawn are elapsed_days minus epoch.t0_days.

export const VIEWER_STATE_KEY = 'orbit-match-viewer-state';

const DEFAULT_SYSTEM_ID = 'tau-ceti';

function blankState() {
  return { orbit_match_viewer_state: 1, systems: {} };
}

function storageOf(storage) {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function finiteDays(value) {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

function cloneState(state) {
  const systems = {};
  const src = state && state.systems && typeof state.systems === 'object' && !Array.isArray(state.systems)
    ? state.systems
    : {};
  Object.keys(src).forEach(function (id) {
    const days = finiteDays(src[id] && src[id].elapsed_days);
    if (days != null) systems[id] = { elapsed_days: days };
  });
  return { orbit_match_viewer_state: 1, systems: systems };
}

export function systemIdFromSearch(search) {
  const raw = search == null ? '' : String(search);
  const params = new URLSearchParams(raw.charAt(0) === '?' ? raw.slice(1) : raw);
  const requested = params.get('system');
  if (!requested) return DEFAULT_SYSTEM_ID;
  const stem = requested.trim().replace(/\.system\.json$/i, '');
  return stem ? stem : DEFAULT_SYSTEM_ID;
}

export function readViewerState(storage) {
  try {
    const store = storageOf(storage);
    if (!store || typeof store.getItem !== 'function') return blankState();
    const raw = store.getItem(VIEWER_STATE_KEY);
    if (raw == null || raw === '') return blankState();
    return cloneState(JSON.parse(raw));
  } catch (err) {
    return blankState();
  }
}

export function writeViewerState(state, storage) {
  try {
    const store = storageOf(storage);
    if (!store || typeof store.setItem !== 'function') return false;
    store.setItem(VIEWER_STATE_KEY, JSON.stringify(cloneState(state)));
    return true;
  } catch (err) {
    return false;
  }
}

export function elapsedDays(state, systemId) {
  const id = systemId || DEFAULT_SYSTEM_ID;
  const row = state && state.systems ? state.systems[id] : null;
  const days = finiteDays(row && row.elapsed_days);
  return days == null ? 0 : days;
}

export function setElapsedDays(state, systemId, days) {
  const id = systemId || DEFAULT_SYSTEM_ID;
  const next = cloneState(state);
  const value = finiteDays(days);
  next.systems[id] = { elapsed_days: value == null ? 0 : value };
  return next;
}

export function stepElapsed(state, systemId, delta) {
  const id = systemId || DEFAULT_SYSTEM_ID;
  const step = finiteDays(delta);
  return setElapsedDays(state, id, elapsedDays(state, id) + (step == null ? 0 : step));
}

export function clockDays(elapsed, epoch) {
  const days = finiteDays(elapsed);
  const t0 = epoch && typeof epoch === 'object' ? finiteDays(epoch.t0_days) : null;
  return (days == null ? 0 : days) - (t0 == null ? 0 : t0);
}

export function viewAtClock(view, system, state, systemId) {
  const next = Object.assign({}, view || {});
  const epoch = system && system.epoch;
  next.epoch_days = clockDays(elapsedDays(state, systemId), epoch);
  return next;
}
