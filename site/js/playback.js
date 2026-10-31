// Shared playback clock. This module does not touch document and does not
// start a timer. The viewer passes now(), requestFrame(), and the dock.
// A frame of 1 second or less counts in full. A longer frame, such as a
// background tab, counts as FRAME_DT_CAP_SECONDS (0.25 s) so the clock does
// not jump. localStorage writes wait WRITE_INTERVAL_MS (100 ms) and always
// run on pause and on a step. Play, direction, and speed stay in this module's
// memory. Only elapsed_days is written to the shared store.

import {
  VIEWER_STATE_KEY,
  elapsedDays,
  readViewerState,
  stepElapsed,
  writeViewerState
} from './viewer-state.js';

export const FRAME_DT_CAP_SECONDS = 0.25;
export const WRITE_INTERVAL_MS = 100;

const FULL_FRAME_SECONDS = 1;

const SPEEDS = [
  { id: 'd1', label: '1 day/sec', daysPerSecond: 1 },
  { id: 'd10', label: '10 days/sec', daysPerSecond: 10 },
  { id: 'd100', label: '100 days/sec', daysPerSecond: 100 },
  { id: 'h1', label: '1 hour/sec', daysPerSecond: 1 / 24 }
];

const SPEED_IDS = Object.create(null);
SPEEDS.forEach(function (row) { SPEED_IDS[row.id] = row; });

function copySpeed(row) {
  return { id: row.id, label: row.label, daysPerSecond: row.daysPerSecond };
}

export function defaultPlayback() {
  return { playing: false, direction: 1, speed: 'd1' };
}

export function speedsFor(isClose) {
  const list = [];
  SPEEDS.forEach(function (row) {
    if (row.id === 'h1' && !isClose) return;
    list.push(copySpeed(row));
  });
  return list;
}

export function normalizeForView(state, isClose) {
  const src = state && typeof state === 'object' ? state : {};
  let speed = SPEED_IDS[src.speed] ? src.speed : 'd1';
  if (!isClose && speed === 'h1') speed = 'd1';
  return {
    playing: !!src.playing,
    direction: src.direction < 0 ? -1 : 1,
    speed: speed
  };
}

function usedSeconds(dt) {
  if (dt > FULL_FRAME_SECONDS) return FRAME_DT_CAP_SECONDS;
  return dt;
}

export function advance(state, dtSeconds) {
  if (!state || !state.playing) return 0;
  const dt = typeof dtSeconds === 'number' ? dtSeconds : Number(dtSeconds);
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  const row = SPEED_IDS[state.speed];
  if (!row) return 0;
  const dir = state.direction < 0 ? -1 : 1;
  return dir * row.daysPerSecond * usedSeconds(dt);
}

function systemIdOf(deps) {
  const raw = typeof deps.systemId === 'function' ? deps.systemId() : deps.systemId;
  return raw ? String(raw) : 'tau-ceti';
}

export function createPlaybackController(deps) {
  const env = deps || {};
  let state = defaultPlayback();
  let memory = readViewerState(env.storage);
  let closeFlag = false;
  let lastStamp = null;
  let lastWriteAt = null;
  let queued = false;
  let handle = null;
  let onControls = null;

  function closeNow() {
    if (typeof env.isClose === 'function') return !!env.isClose();
    return closeFlag;
  }

  function touch() {
    if (typeof onControls === 'function') onControls();
  }

  function stampOf(stamp) {
    if (typeof stamp === 'number' && Number.isFinite(stamp)) return stamp;
    return typeof env.now === 'function' ? env.now() : 0;
  }

  function publish(force, stamp) {
    const t = stampOf(stamp);
    const due = !!force || lastWriteAt == null || (t - lastWriteAt) >= WRITE_INTERVAL_MS;
    if (due) {
      writeViewerState(memory, env.storage);
      lastWriteAt = t;
    }
    if (typeof env.onPaint === 'function') env.onPaint();
  }

  function cancelQueued() {
    if (handle != null && typeof env.cancelFrame === 'function') env.cancelFrame(handle);
    handle = null;
    queued = false;
  }

  function schedule() {
    if (queued || !state.playing || typeof env.requestFrame !== 'function') return;
    queued = true;
    handle = env.requestFrame(function (ts) {
      queued = false;
      handle = null;
      onFrame(ts);
    });
  }

  function onFrame(ts) {
    if (!state.playing) return;
    const stamp = stampOf(ts);
    const beforeSpeed = state.speed;
    state = normalizeForView(state, closeNow());
    if (state.speed !== beforeSpeed) touch();
    if (lastStamp == null) {
      lastStamp = stamp;
      schedule();
      return;
    }
    const delta = advance(state, (stamp - lastStamp) / 1000);
    lastStamp = stamp;
    if (delta !== 0) {
      memory = stepElapsed(memory, systemIdOf(env), delta);
      publish(false, stamp);
    }
    if (state.playing) schedule();
  }

  function getState() {
    return {
      playing: !!state.playing,
      direction: state.direction < 0 ? -1 : 1,
      speed: state.speed
    };
  }

  function elapsed() {
    return elapsedDays(memory, systemIdOf(env));
  }

  function press(which) {
    if (which === 'pause') {
      state.playing = false;
      state = normalizeForView(state, closeNow());
      cancelQueued();
      lastStamp = null;
      publish(true);
      touch();
      return getState();
    }
    if (which === 'forward' || which === 'reverse') {
      const wasPlaying = state.playing;
      state.playing = true;
      state.direction = which === 'reverse' ? -1 : 1;
      state = normalizeForView(state, closeNow());
      if (!wasPlaying) lastStamp = null;
      touch();
      schedule();
      return getState();
    }
    return getState();
  }

  function setSpeed(id) {
    const offered = speedsFor(closeNow()).some(function (row) { return row.id === id; });
    if (offered) state.speed = id;
    touch();
    return getState();
  }

  function step(days) {
    const delta = typeof days === 'number' ? days : Number(days);
    if (!Number.isFinite(delta)) return elapsed();
    memory = stepElapsed(memory, systemIdOf(env), delta);
    publish(true);
    return elapsed();
  }

  function setClose(flag) {
    closeFlag = !!flag;
    state = normalizeForView(state, closeNow());
    touch();
    return getState();
  }

  function syncFromStorage() {
    if (state.playing) return false;
    memory = readViewerState(env.storage);
    if (typeof env.onPaint === 'function') env.onPaint();
    return true;
  }

  return {
    press: press,
    setSpeed: setSpeed,
    step: step,
    setClose: setClose,
    syncFromStorage: syncFromStorage,
    getState: getState,
    elapsed: elapsed,
    viewerState: function () { return memory; },
    isClose: closeNow,
    setOnControls: function (fn) {
      onControls = typeof fn === 'function' ? fn : null;
      touch();
    }
  };
}

function fillSpeed(select, doc, speeds, selected) {
  const existing = select.querySelectorAll('option');
  for (let i = existing.length - 1; i >= 0; i--) {
    const option = existing[i];
    if (typeof option.remove === 'function') option.remove();
    else if (option.parentNode && option.parentNode.removeChild) option.parentNode.removeChild(option);
  }
  speeds.forEach(function (speed) {
    const option = doc.createElement('option');
    option.value = speed.id;
    option.textContent = speed.label;
    if (typeof option.setAttribute === 'function') option.setAttribute('value', speed.id);
    select.appendChild(option);
  });
  select.value = selected;
}

function markPressed(button, on) {
  if (button && typeof button.setAttribute === 'function') {
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

export function mountPlaybackDock(deps) {
  const env = deps || {};
  const controller = createPlaybackController(env);
  const doc = env.document;
  const dock = env.dock || (doc && typeof doc.querySelector === 'function' ? doc.querySelector('.dock') : null);
  if (!dock || !doc || typeof doc.createElement !== 'function') return controller;

  const reverse = typeof dock.querySelector === 'function' ? dock.querySelector('#play-reverse') : null;
  const pause = typeof dock.querySelector === 'function' ? dock.querySelector('#play-pause') : null;
  const forward = typeof dock.querySelector === 'function' ? dock.querySelector('#play-forward') : null;
  const select = typeof dock.querySelector === 'function' ? dock.querySelector('#play-speed') : null;

  function paintControls() {
    const current = controller.getState();
    markPressed(reverse, current.playing && current.direction < 0);
    markPressed(pause, !current.playing);
    markPressed(forward, current.playing && current.direction > 0);
    if (select) fillSpeed(select, doc, speedsFor(controller.isClose()), current.speed);
  }

  if (reverse && reverse.addEventListener) {
    reverse.addEventListener('click', function () { controller.press('reverse'); });
  }
  if (pause && pause.addEventListener) {
    pause.addEventListener('click', function () { controller.press('pause'); });
  }
  if (forward && forward.addEventListener) {
    forward.addEventListener('click', function () { controller.press('forward'); });
  }
  if (select && select.addEventListener) {
    select.addEventListener('change', function () { controller.setSpeed(select.value); });
  }
  if (dock.addEventListener) {
    dock.addEventListener('click', function (event) {
      const target = event && event.target;
      if (!target || typeof target.closest !== 'function') return;
      const button = target.closest('button[data-days]');
      if (!button) return;
      if (typeof dock.contains === 'function' && !dock.contains(button)) return;
      const days = Number(button.getAttribute('data-days'));
      if (!Number.isFinite(days)) return;
      controller.step(days);
    });
  }
  if (env.window && typeof env.window.addEventListener === 'function') {
    env.window.addEventListener('storage', function (event) {
      if (!event || event.key !== VIEWER_STATE_KEY) return;
      controller.syncFromStorage();
    });
  }
  controller.setOnControls(paintControls);
  return controller;
}
