import { loadView } from '../js/schema.js';
import { cardLinks, VIEWER_SYSTEM_ID } from '../js/builder-link.js';
import { applyShell } from '../js/shell.js';
import { isHandoff, isLoreSystem, resolveSystem, safeSystemFile } from '../js/system-source.js';
import {
  collectBrowserSignals,
  decideViewer,
  readResourceStorage,
  resourceDestination,
  writeResourceStorage
} from '../js/low-resource.js';
import { loreSettingsFromSystem, loreSettingsMarkup } from './lore-settings.js';
import { polarLimits, cameraPose, clampElevation } from './frame.js';
import {
  TAU_CETI_LIGHT_K,
  blackbodySrgb,
  keyLightViewOffset,
  LIGHTING,
  starGlowStops
} from './light.js';
import {
  buildScene,
  FALLBACK,
  themeChrome,
  initialSession,
  selectBody,
  frameBody,
  clearSelection,
  hoverReadout,
  pencilNote,
  TRANSFER_LINE_THRESHOLD,
  TRANSFER_HIT_RADIUS,
  transferHitRadiusAt,
  transferTubePoints,
  transferPickRecord,
  selectFromPick,
  assignCardSlots,
  calloutLines,
  choosePick
} from './scene-model.js';
import {
  DENSITY_DEFAULT,
  DUSTINESS_DEFAULT,
  dustBands,
  writeBeltColors,
  starfieldSpec,
  starfieldRgba,
  backgroundRecord,
  skyReference
} from './sky.js';
import {
  ringBeltsFromBands,
  ringPointCount,
  updateRingBeltFrame,
  withDensity,
  withDustiness,
  createRingBelt,
  planetRingsFromScene,
  solidRingForBody
} from './ring-belt.js';
import {
  modelFileForBody,
  modelMountPlan,
  defaultLayerState,
  setLayerVisible,
  layerVisibleForNode,
  isGlbRingNode
} from './body-models.js';

let loadedSystem = null;
let loadedView = null;
let session = null;
let frame = 'system';
let themeName = 'empire';
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let stage = null;
let canvas = null;
let pickables = [];
let labelEntries = [];
let projectVec = null;
let raycaster = null;
let pointer = null;
let clickTimer = null;
let applying = false;
let loopStarted = false;
let keyLight = null;
let keyAim = null;
let sceneTransfers = [];
let cardSlots = [];
let transferHits = [];
const beltControl = {};
let ringState = [];
let dustClouds = [];
let sceneRoot = null;
let starfieldTex = null;
let equirectTex = null;
let equirectUrl = '';
let dataLayers = [];
let loreBound = false;
let dustSprite = null;
let BodyGLTFLoader = null;
let modelGeneration = 0;
let layerState = defaultLayerState();

function showFallback() {
  const el = document.getElementById('fallback');
  if (!el) return;
  const heading = el.querySelector('h2');
  const body = el.querySelector('p');
  const link = el.querySelector('a');
  if (heading) heading.textContent = FALLBACK.heading;
  if (body) body.textContent = FALLBACK.body;
  if (link) {
    link.href = FALLBACK.href;
    link.textContent = FALLBACK.link;
  }
  el.hidden = false;
}

function webglContext(surface) {
  if (!surface || !surface.getContext) return null;
  const attrs = { antialias: true, alpha: false };
  try {
    return surface.getContext('webgl2', attrs) || surface.getContext('webgl', attrs);
  } catch (err) {
    return null;
  }
}

function fetchJson(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) throw new Error(url + ' ' + response.status);
    return response.json();
  });
}

function modeLabel(mode) {
  return mode === 'linear' ? 'True AU' : 'Schematic';
}

function viewNow() {
  const next = Object.assign({}, loadedView);
  next.theme = themeName;
  next.distance_mode = session.distance_mode;
  next.elevation_deg = session.elevation_deg;
  next.azimuth_deg = session.azimuth_deg;
  return next;
}

function stageSize() {
  const width = stage.clientWidth || window.innerWidth || 800;
  const height = stage.clientHeight || Math.round((window.innerHeight || 800) * 0.7);
  return { width: width, height: Math.max(height, 1) };
}

function resize() {
  if (!renderer || !camera || !stage) return;
  const size = stageSize();
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height, false);
}

function disposeMaterial(mat) {
  if (mat.map && !(mat.map.userData && mat.map.userData.shared)) mat.map.dispose();
  mat.dispose();
}

function disposeObject(obj) {
  obj.traverse(function (child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    }
  });
}

function tagMesh(mesh, id, record, position) {
  mesh.userData.id = id;
  mesh.userData.record = record;
  mesh.userData.position = position;
  pickables.push(mesh);
}

function glowTexture(THREE) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const mid = size / 2;
  const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  starGlowStops().forEach(function (stop) {
    const c = stop.rgba;
    const r = Math.round(c[0] * 255);
    const g = Math.round(c[1] * 255);
    const b = Math.round(c[2] * 255);
    gradient.addColorStop(stop.t, 'rgba(' + r + ',' + g + ',' + b + ',' + c[3] + ')');
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function lineGeom(THREE, points, color, closed) {
  const geom = new THREE.BufferGeometry();
  const arr = new Float32Array(points.length * 3);
  points.forEach(function (point, index) {
    arr[index * 3] = point.x;
    arr[index * 3 + 1] = point.y;
    arr[index * 3 + 2] = point.z;
  });
  geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const material = new THREE.LineBasicMaterial({ color: color });
  return closed ? new THREE.LineLoop(geom, material) : new THREE.Line(geom, material);
}

function circlePoints(radius) {
  const points = [];
  const steps = 96;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius });
  }
  return points;
}

function paintLegend(data) {
  const el = document.getElementById('legend');
  if (!el) return;
  el.innerHTML = '';
  const mode = document.createElement('p');
  mode.textContent = modeLabel(data.distanceMode);
  const epoch = document.createElement('p');
  epoch.textContent = data.epochLabel;
  const note = document.createElement('p');
  note.textContent = 'Sizes are enlarged.';
  el.appendChild(mode);
  el.appendChild(epoch);
  el.appendChild(note);
  if (data.distanceMode === 'linear') {
    const warn = document.createElement('p');
    warn.textContent = 'True AU hides the inner planets inside the star.';
    el.appendChild(warn);
  }
  el.dataset.corner = data.legendCorner || 'tl';
}

function syncLabels(data) {
  const host = document.getElementById('labels');
  labelEntries = [];
  if (!host) return;
  host.innerHTML = '';
  if (!data.showLabels) return;
  data.bodies.forEach(function (body) {
    const el = document.createElement('span');
    el.className = 'body-label';
    el.textContent = body.name;
    host.appendChild(el);
    labelEntries.push({ el: el, position: body.position });
  });
}

function placeLabels() {
  if (!labelEntries.length || !camera || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  labelEntries.forEach(function (entry) {
    projectVec.set(entry.position.x, entry.position.y, entry.position.z);
    projectVec.project(camera);
    if (projectVec.z < -1 || projectVec.z > 1) {
      entry.el.style.display = 'none';
      return;
    }
    entry.el.style.display = 'block';
    entry.el.style.left = (projectVec.x * 0.5 + 0.5) * width + 'px';
    entry.el.style.top = (-projectVec.y * 0.5 + 0.5) * height + 'px';
  });
}

function paintCrumbs() {
  const systemCrumb = document.getElementById('crumb-system');
  const focusCrumb = document.getElementById('crumb-focus');
  if (systemCrumb) systemCrumb.setAttribute('aria-current', frame === 'system' ? 'true' : 'false');
  if (focusCrumb) focusCrumb.setAttribute('aria-current', frame === 'system' ? 'false' : 'true');
}

function bodyDisplayName(id) {
  const data = loadedSystem || {};
  const body = (data.bodies || []).find(function (item) { return item.id === id; });
  if (body && body.name) return body.name;
  return String(id);
}

function openLinkSpec(key) {
  const text = String(key);
  if (text.indexOf('transfer:') === 0) {
    const hopId = text.slice('transfer:'.length);
    const hop = (sceneTransfers || []).find(function (item) { return item.id === hopId; });
    if (hop) {
      return {
        kind: 'transfer',
        systemId: VIEWER_SYSTEM_ID,
        fromId: hop.from,
        toId: hop.to,
        fromName: bodyDisplayName(hop.from),
        toName: bodyDisplayName(hop.to)
      };
    }
  }
  const id = text.indexOf('body:') === 0 ? text.slice(5) : text;
  if (id === 'star') return { kind: 'star', id: 'star', systemId: VIEWER_SYSTEM_ID };
  return { kind: 'body', id: id, systemId: VIEWER_SYSTEM_ID };
}

function paintCards() {
  const root = document.getElementById('cards');
  if (!root || !session) return;
  root.innerHTML = '';
  cardSlots = assignCardSlots(cardSlots, session.callouts, 'tl');
  cardSlots.forEach(function (slot) {
    const key = slot.key;
    const id = String(key).indexOf('body:') === 0 ? String(key).slice(5) : String(key);
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.corner = slot.corner;
    calloutLines(loadedSystem, key, sceneTransfers).forEach(function (line) {
      const row = document.createElement('p');
      row.textContent = line;
      card.appendChild(row);
    });
    cardLinks(openLinkSpec(key)).forEach(function (item) {
      const open = document.createElement('a');
      open.href = item.href;
      open.textContent = item.label;
      card.appendChild(open);
    });
    const pencil = document.createElement('button');
    pencil.type = 'button';
    pencil.textContent = 'Pencil';
    const note = document.createElement('p');
    note.className = 'pencil-note';
    pencil.addEventListener('click', function () {
      note.textContent = pencilNote();
    });
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', function () {
      if (String(key).indexOf('transfer:') === 0) {
        session = selectFromPick(session, { kind: 'transfer', id: String(key).slice('transfer:'.length) });
      } else {
        session = selectBody(session, id);
      }
      paintCards();
    });
    card.appendChild(pencil);
    card.appendChild(dismiss);
    card.appendChild(note);
    root.appendChild(card);
  });
}

function pointerNDC(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / (rect.height || 1)) * 2 + 1;
}

function pickData(object) {
  let obj = object;
  while (obj && !obj.userData.id && obj.parent) obj = obj.parent;
  if (!obj || !obj.userData.id) return null;
  return obj.userData;
}

function pick(event) {
  if (!raycaster || !camera) return null;
  pointerNDC(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  const records = [];
  for (let i = 0; i < hits.length; i++) {
    const data = pickData(hits[i].object);
    if (data) records.push(data);
  }
  return choosePick(records);
}

function cameraOffset() {
  return {
    x: camera.position.x - controls.target.x,
    y: camera.position.y - controls.target.y,
    z: camera.position.z - controls.target.z
  };
}

function syncElevationFromCamera() {
  const off = cameraOffset();
  const dist = Math.hypot(off.x, off.y, off.z) || 1;
  const elev = Math.asin(Math.max(-1, Math.min(1, off.y / dist))) * 180 / Math.PI;
  session.elevation_deg = clampElevation(elev);
  session.azimuth_deg = Math.atan2(off.x, off.z) * 180 / Math.PI;
  session.distance = dist;
  const slider = document.getElementById('elev');
  const text = document.getElementById('elev-readout');
  if (slider && document.activeElement !== slider) slider.value = String(session.elevation_deg);
  if (text) text.textContent = Math.round(session.elevation_deg) + '°';
}

function transferCameraDistance() {
  if (!camera) return TRANSFER_HIT_RADIUS;
  if (controls && controls.target && camera.position.distanceTo) {
    return camera.position.distanceTo(controls.target);
  }
  return Math.hypot(camera.position.x, camera.position.y, camera.position.z) || TRANSFER_HIT_RADIUS;
}

function buildTransferHit(THREE, hop, radius) {
  const tubePts = transferTubePoints(hop.points);
  if (tubePts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(tubePts.map(function (point) {
    return new THREE.Vector3(point.x, point.y || 0, point.z);
  }));
  const geom = new THREE.TubeGeometry(curve, Math.max(tubePts.length, 8), radius, 6, false);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData = transferPickRecord(hop);
  return mesh;
}

function syncTransferHits(THREE) {
  if (!THREE || !transferHits.length) return;
  const radius = transferHitRadiusAt(transferCameraDistance());
  transferHits.forEach(function (entry) {
    if (Math.abs(entry.radius - radius) < 0.05) return;
    const mesh = buildTransferHit(THREE, entry.hop, radius);
    if (!mesh || !entry.mesh.parent) return;
    const index = pickables.indexOf(entry.mesh);
    if (index >= 0) pickables.splice(index, 1, mesh);
    else pickables.push(mesh);
    entry.mesh.parent.add(mesh);
    entry.mesh.parent.remove(entry.mesh);
    disposeObject(entry.mesh);
    entry.mesh = mesh;
    entry.radius = radius;
  });
}

function emptyRaycast() {}

function ensureStarfield(THREE) {
  if (starfieldTex) return starfieldTex;
  const spec = starfieldSpec();
  const record = backgroundRecord(spec.width, spec.height);
  const rgba = starfieldRgba(record.width, record.height, spec.seed);
  const canvas = document.createElement('canvas');
  canvas.width = record.width;
  canvas.height = record.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const image = ctx.createImageData(record.width, record.height);
    image.data.set(rgba);
    ctx.putImageData(image, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  // Direction-only background: equirect mapping ignores camera position, so the sky does not parallax or scale when the view dollies.
  texture.mapping = THREE[record.mapping];
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // No mip chain: a mipmap min filter would make this equirect texture incomplete and sample black.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  starfieldTex = texture;
  return texture;
}

function ensureDustSprite(THREE) {
  if (dustSprite) return dustSprite;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const mid = size / 2;
    const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData.shared = true;
  texture.needsUpdate = true;
  dustSprite = texture;
  return texture;
}

function createDustCloud(THREE, belt) {
  const samples = belt.local;
  const style = belt.style;
  const count = samples.count;
  const geom = new THREE.BufferGeometry();
  // Local samples stay around the origin. The Points object carries center and inclination.
  geom.setAttribute('position', new THREE.BufferAttribute(samples.positions, 3));
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    writeBeltColors(samples.palette[i], samples.jitter[i], style.colorSpread, colors, i * 3);
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: style.size,
    map: ensureDustSprite(THREE),
    transparent: true,
    opacity: style.opacity,
    vertexColors: true,
    sizeAttenuation: true,
    depthWrite: false,
    depthTest: true
  });
  const cloud = new THREE.Points(geom, mat);
  cloud.userData.samples = samples;
  cloud.userData.kind = 'dust-belt';
  return cloud;
}

function dustCloudById(id) {
  for (let i = 0; i < dustClouds.length; i++) {
    if (dustClouds[i].userData.beltId === id) return dustClouds[i];
  }
  return null;
}

function writeBeltReadout(belt) {
  const densityReadout = document.getElementById('belt-' + belt.id + '-density-readout');
  const dustReadout = document.getElementById('belt-' + belt.id + '-dustiness-readout');
  if (densityReadout) densityReadout.textContent = String(belt.count);
  if (dustReadout) dustReadout.textContent = String(Math.round(belt.dustiness));
}

function writeSettingsReadout(id) {
  const settings = beltControl[id];
  if (!settings) return;
  const count = ringPointCount({ id: id, density: settings.density });
  const densityReadout = document.getElementById('belt-' + id + '-density-readout');
  const dustReadout = document.getElementById('belt-' + id + '-dustiness-readout');
  if (densityReadout) densityReadout.textContent = String(count);
  if (dustReadout) dustReadout.textContent = String(Math.round(settings.dustiness));
}

function releaseDustClouds() {
  for (let i = dustClouds.length - 1; i >= 0; i--) {
    const cloud = dustClouds[i];
    if (cloud.material) cloud.material.map = null;
    if (cloud.parent) cloud.parent.remove(cloud);
    disposeObject(cloud);
  }
  dustClouds = [];
}

function placeDustCloud(THREE, root, belt) {
  if (!belt || belt.count <= 0) return;
  const cloud = createDustCloud(THREE, belt);
  cloud.raycast = emptyRaycast;
  cloud.userData.pickable = false;
  cloud.userData.beltId = belt.id;
  cloud.position.set(belt.center.x, belt.center.y, belt.center.z);
  cloud.rotation.x = belt.inclination;
  root.add(cloud);
  dustClouds.push(cloud);
}

function mountDustBelts(THREE, root, belts, sceneData) {
  releaseDustClouds();
  const bands = dustBands(belts);
  ringState = ringBeltsFromBands(bands, beltControl);
  const planetConfigs = planetRingsFromScene(loadedSystem, sceneData || { bodies: [] });
  for (let p = 0; p < planetConfigs.length; p++) {
    ringState.push(createRingBelt(planetConfigs[p]));
  }
  for (let i = 0; i < ringState.length; i++) {
    const belt = ringState[i];
    writeBeltReadout(belt);
    if (belt.count <= 0) continue;
    const cloud = createDustCloud(THREE, belt);
    cloud.raycast = emptyRaycast;
    cloud.userData.pickable = false;
    cloud.userData.beltId = belt.id;
    cloud.position.set(belt.center.x, belt.center.y, belt.center.z);
    cloud.rotation.x = belt.inclination;
    root.add(cloud);
    dustClouds.push(cloud);
  }
  if (!ringState.length) {
    Object.keys(beltControl).forEach(writeSettingsReadout);
  }
}

function replaceDustCloud(THREE, root, belt) {
  for (let i = dustClouds.length - 1; i >= 0; i--) {
    const cloud = dustClouds[i];
    if (cloud.userData.beltId !== belt.id) continue;
    if (cloud.material) cloud.material.map = null;
    if (cloud.parent) cloud.parent.remove(cloud);
    disposeObject(cloud);
    dustClouds.splice(i, 1);
  }
  placeDustCloud(THREE, root, belt);
}

function applyDustiness(belt) {
  writeBeltReadout(belt);
  const cloud = dustCloudById(belt.id);
  if (!cloud || !belt.local || !belt.local.count) return;
  cloud.material.size = belt.style.size;
  cloud.material.opacity = belt.style.opacity;
  const samples = belt.local;
  const colors = cloud.geometry.attributes.color;
  for (let i = 0; i < samples.count; i++) {
    writeBeltColors(samples.palette[i], samples.jitter[i], belt.style.colorSpread, colors.array, i * 3);
  }
  colors.needsUpdate = true;
}

function bindBeltRange(input, apply) {
  if (!input) return;
  input.addEventListener('input', function () {
    apply(Number(input.value));
  });
}

function refreshBeltDensity(THREE, root, id) {
  const density = beltControl[id].density;
  for (let i = 0; i < ringState.length; i++) {
    if (ringState[i].id !== id) continue;
    ringState[i] = withDensity(ringState[i], density);
    replaceDustCloud(THREE, root, ringState[i]);
    writeBeltReadout(ringState[i]);
    return;
  }
  writeSettingsReadout(id);
}

function refreshBeltDustiness(id) {
  const dustiness = beltControl[id].dustiness;
  for (let i = 0; i < ringState.length; i++) {
    if (ringState[i].id !== id) continue;
    ringState[i] = withDustiness(ringState[i], dustiness);
    applyDustiness(ringState[i]);
    return;
  }
  writeSettingsReadout(id);
}

function bodyWorldPosition(id) {
  if (!sceneRoot || !id) return null;
  let found = null;
  sceneRoot.traverse(function (child) {
    if (found || !child.isMesh) return;
    if (child.userData && child.userData.id === id) found = child.position;
  });
  return found;
}

function syncPlanetRings() {
  for (let i = 0; i < ringState.length; i++) {
    const belt = ringState[i];
    if (!belt || belt.follow !== 'planet') continue;
    const parent = bodyWorldPosition(belt.parentId);
    if (!parent) continue;
    const next = updateRingBeltFrame(belt, parent);
    if (next === belt) continue;
    ringState[i] = next;
    const cloud = dustCloudById(belt.id);
    if (!cloud) continue;
    cloud.position.set(next.center.x, next.center.y, next.center.z);
    cloud.rotation.x = next.inclination;
  }
}

function findBodyHost(root, id) {
  let found = null;
  if (!root || !id) return null;
  root.traverse(function (child) {
    if (found || !child.isMesh) return;
    if (child.userData && child.userData.id === id) found = child;
  });
  return found;
}

function syncKakakikoLayers(root) {
  if (!root) return;
  root.traverse(function (child) {
    const visible = layerVisibleForNode(child.name, layerState, dataLayers);
    if (visible === null) return;
    child.visible = visible;
  });
}

function mountFromPlan(host, gltf, plan) {
  if (!host || !plan || plan.fallback || !gltf || !gltf.scene) return;
  const model = gltf.scene;
  model.scale.setScalar(plan.scale);
  model.traverse(function (child) {
    if (isGlbRingNode(child.name)) {
      child.visible = false;
      return;
    }
    const visible = layerVisibleForNode(child.name, layerState, dataLayers);
    if (visible !== null) child.visible = visible;
  });
  host.add(model);
  host.userData.modelFallback = false;
  if (plan.hideSphere && host.material) {
    host.material.transparent = true;
    host.material.opacity = 0;
    host.material.depthWrite = false;
    host.material.colorWrite = false;
    host.material.needsUpdate = true;
  }
}

function scheduleBodyModels(root, data) {
  const generation = ++modelGeneration;
  if (!BodyGLTFLoader || !root || !data) return;
  const loader = new BodyGLTFLoader();
  const jobs = [];
  if (data.star) jobs.push({ id: 'star', radius: data.star.radius });
  (data.bodies || []).forEach(function (body) {
    jobs.push({ id: body.id, radius: body.radius });
  });
  jobs.forEach(function (job) {
    const file = modelFileForBody(job.id, loadedSystem);
    if (!file) return;
    loader.loadAsync(file).then(function (gltf) {
      if (generation !== modelGeneration) {
        disposeObject(gltf.scene);
        return;
      }
      const host = findBodyHost(root, job.id);
      const plan = modelMountPlan(host ? { ok: true } : { ok: false }, job.id, job.radius, file);
      if (!host || plan.fallback) {
        if (gltf.scene) disposeObject(gltf.scene);
        if (host) host.userData.modelFallback = true;
        return;
      }
      mountFromPlan(host, gltf, plan);
    }).catch(function () {
      if (generation !== modelGeneration) return;
      const host = findBodyHost(root, job.id);
      const plan = modelMountPlan({ ok: false }, job.id, job.radius, file);
      if (host && plan.fallback) host.userData.modelFallback = true;
    });
  });
}

function layersFromSystem(system) {
  const list = [];
  ((system && system.bodies) || []).forEach(function (body) {
    (body.layers || []).forEach(function (layer) {
      if (!layer || layer.key == null) return;
      list.push({
        key: String(layer.key),
        node: layer.node == null ? '' : String(layer.node),
        nodeName: layer.node == null ? '' : String(layer.node),
        default: layer.default,
        defaultVisible: layer.default === false ? false : layer.defaultVisible !== false
      });
    });
  });
  return list;
}

function fillBeltControl(system) {
  Object.keys(beltControl).forEach(function (key) { delete beltControl[key]; });
  loreSettingsFromSystem(system).belts.forEach(function (belt) {
    beltControl[belt.id] = { density: belt.density, dustiness: belt.dustiness };
  });
}

function bindLoreSettings(THREE, root) {
  const host = document.getElementById('lore-settings-body');
  if (!host || !loadedSystem) return;
  const plan = loreSettingsFromSystem(loadedSystem);
  host.innerHTML = loreSettingsMarkup(plan);
  if (loreBound) return;
  loreBound = true;
  host.addEventListener('input', function (event) {
    const el = event.target;
    if (!el || !el.getAttribute) return;
    const densityId = el.getAttribute('data-belt-density');
    const dustId = el.getAttribute('data-belt-dustiness');
    if (densityId && beltControl[densityId]) {
      const value = Number(el.value);
      beltControl[densityId].density = Number.isFinite(value) ? value : DENSITY_DEFAULT;
      refreshBeltDensity(THREE, root, densityId);
    }
    if (dustId && beltControl[dustId]) {
      const value = Number(el.value);
      beltControl[dustId].dustiness = Number.isFinite(value) ? value : DUSTINESS_DEFAULT;
      refreshBeltDustiness(dustId);
    }
  });
  host.addEventListener('change', function (event) {
    const el = event.target;
    if (!el || !el.getAttribute || el.getAttribute('data-layer-key') == null) return;
    layerState = setLayerVisible(layerState, el.getAttribute('data-layer-key'), el.checked, dataLayers);
    if (sceneRoot) syncKakakikoLayers(sceneRoot);
  });
}

async function loadRequestedSystem() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('system');
  let loreName = 'tau-ceti.system.json';
  if (requested) {
    const withSuffix = /\.system\.json$/i.test(requested) ? requested : requested + '.system.json';
    const safe = safeSystemFile(withSuffix);
    if (!safe) throw new Error('system name is not allowed');
    loreName = safe;
  }
  const handoffName = loreName.replace(/\.system\.json$/i, '.handoff.json');
  let lore = null;
  let handoff = null;
  try { lore = await fetchJson('../data/' + loreName); } catch (err) { lore = null; }
  try { handoff = await fetchJson('../data/' + handoffName); } catch (err) { handoff = null; }
  if (lore && !isLoreSystem(lore)) lore = null;
  if (handoff && !isHandoff(handoff)) handoff = null;
  if (!lore && !handoff) throw new Error('system file missing');
  return resolveSystem({ lore: lore, handoff: handoff });
}

function rebuild(THREE, root, resetCamera) {
  dustClouds = [];
  transferHits = [];
  while (root.children.length) {
    const child = root.children.pop();
    root.remove(child);
    disposeObject(child);
  }
  pickables = [];
  const data = buildScene(loadedSystem, viewNow(), { frame: frame, distance_mode: session.distance_mode });
  sceneTransfers = data.transfers || [];
  const chrome = themeChrome(data.theme);
  renderer.setClearColor(chrome.space.base);
  scene.background = ensureStarfield(THREE);
  applySystemSky(THREE);
  stage.style.background = chrome.space.base;
  const rootStyle = document.documentElement;
  rootStyle.style.setProperty('--viewer3d-panel', chrome.panel);
  rootStyle.style.setProperty('--viewer3d-text', chrome.text);
  rootStyle.style.setProperty('--viewer3d-accent', chrome.accent);
  if (data.star) {
    const rgb = blackbodySrgb(TAU_CETI_LIGHT_K);
    const starLightColor = new THREE.Color(rgb.r, rgb.g, rgb.b);
    const point = new THREE.PointLight(
      starLightColor,
      LIGHTING.pointIntensity,
      LIGHTING.pointDistance,
      LIGHTING.pointDecay
    );
    point.position.set(0, 0, 0);
    root.add(point);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(THREE),
      color: starLightColor,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true
    }));
    glow.scale.set(LIGHTING.glowScale, LIGHTING.glowScale, 1);
    glow.position.set(0, 0, 0);
    root.add(glow);
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(data.star.radius, 32, 24),
      new THREE.MeshBasicMaterial({ color: data.star.color })
    );
    star.position.set(0, 0, 0);
    tagMesh(star, 'star', null, data.star.position);
    root.add(star);
  }
  data.bodies.forEach(function (body) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius, 24, 16),
      new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.92, metalness: 0 })
    );
    mesh.position.set(body.position.x, body.position.y, body.position.z);
    const record = {};
    if (typeof body.a_au === 'number') record.a_au = body.a_au;
    else if (typeof body.a_km === 'number') record.a_km = body.a_km;
    tagMesh(mesh, body.id, record, body.position);
    if (solidRingForBody(loadedSystem, body.id)) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.radius * 1.35, body.radius * 1.7, 64),
        new THREE.MeshStandardMaterial({ color: body.color, roughness: 1, metalness: 0, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI / 2;
      mesh.add(ring);
    }
    root.add(mesh);
  });
  data.orbits.forEach(function (orbit) {
    const line = lineGeom(THREE, orbit.points, 0xd4f0ff, true);
    const owner = data.bodies.find(function (body) { return body.id === orbit.id; });
    line.userData.id = orbit.id;
    if (owner && typeof owner.a_au === 'number') line.userData.record = { a_au: owner.a_au };
    else if (owner && typeof owner.a_km === 'number') line.userData.record = { a_km: owner.a_km };
    if (owner) line.userData.position = owner.position;
    pickables.push(line);
    root.add(line);
  });
  data.belts.forEach(function (belt) {
    root.add(lineGeom(THREE, belt.points, belt.color || 0xd8c9a3, true));
  });
  mountDustBelts(THREE, root, data.belts || [], data);
  data.transfers.forEach(function (hop) {
    const record = transferPickRecord(hop);
    const line = lineGeom(THREE, hop.points, hop.color || 0x6dffc8, false);
    line.userData = record;
    pickables.push(line);
    root.add(line);
    const hitRadius = resetCamera ? TRANSFER_HIT_RADIUS : transferHitRadiusAt(transferCameraDistance());
    const mesh = buildTransferHit(THREE, hop, hitRadius);
    if (mesh) {
      pickables.push(mesh);
      root.add(mesh);
      transferHits.push({ hop: hop, mesh: mesh, radius: hitRadius });
    }
  });
  if (data.habitable && typeof data.habitable.outerR === 'number') {
    root.add(lineGeom(THREE, circlePoints(data.habitable.innerR), 0x8ff0bf, true));
    root.add(lineGeom(THREE, circlePoints(data.habitable.outerR), 0x8ff0bf, true));
  }
  scheduleBodyModels(root, data);
  paintLegend(data);
  syncLabels(data);
  paintCrumbs();
  if (resetCamera && data.camera) {
    camera.up.set(0, 1, 0);
    camera.position.set(data.camera.x, data.camera.y, data.camera.z);
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
  }
}

function applyBackgroundRotation(THREE, rotation) {
  const rot = rotation || { x: 0, y: 0, z: 0 };
  if (!scene.backgroundRotation) scene.backgroundRotation = new THREE.Euler(rot.x, rot.y, rot.z, 'XYZ');
  else scene.backgroundRotation.set(rot.x, rot.y, rot.z, 'XYZ');
}

function applySystemSky(THREE) {
  const plan = skyReference(loadedSystem);
  const procedural = ensureStarfield(THREE);
  scene.background = procedural;
  applyBackgroundRotation(THREE, plan.rotation);
  if (plan.mode !== 'equirect' || !plan.url) return;
  if (equirectTex && equirectUrl === plan.url) {
    scene.background = equirectTex;
    return;
  }
  const url = plan.url;
  const loader = new THREE.TextureLoader();
  loader.load(url, function (tex) {
    if (!loadedSystem || skyReference(loadedSystem).url !== url) {
      tex.dispose();
      return;
    }
    // Rudy README: EquirectangularReflectionMapping and sRGB. Leave the loader's vertical orientation alone.
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    equirectTex = tex;
    equirectUrl = url;
    if (scene) scene.background = tex;
  }, undefined, function () {
    if (scene) scene.background = ensureStarfield(THREE);
  });
}

function aimKeyLight() {
  if (!keyLight || !keyAim || !camera) return;
  const offset = keyLightViewOffset();
  keyAim.set(offset.x, offset.y, offset.z).applyQuaternion(camera.quaternion);
  keyLight.position.copy(camera.position).add(keyAim);
  keyLight.target.position.copy(camera.position);
}

function tick() {
  if (!canvas || !canvas.isConnected) return;
  requestAnimationFrame(tick);
  if (controls) controls.update();
  aimKeyLight();
  syncPlanetRings();
  if (renderer && scene && camera) renderer.render(scene, camera);
  placeLabels();
}

async function startViewer(THREE, OrbitControls, gl) {
  const viewFile = await fetchJson('../data/tau-ceti.view.json');
  loadedSystem = await loadRequestedSystem();
  loadedView = loadView(viewFile);
  dataLayers = layersFromSystem(loadedSystem);
  layerState = dataLayers.length ? defaultLayerState(dataLayers) : defaultLayerState();
  fillBeltControl(loadedSystem);
  session = initialSession(loadedView);
  themeName = loadedView.theme === 'mardat' ? 'mardat' : 'empire';
  const themeSelect = document.getElementById('scene-theme');
  if (themeSelect) themeSelect.value = themeName;
  const elev = document.getElementById('elev');
  const elevText = document.getElementById('elev-readout');
  if (elev) elev.value = String(session.elevation_deg);
  if (elevText) elevText.textContent = Math.round(session.elevation_deg) + '°';
  scene = new THREE.Scene();
  const size = stageSize();
  camera = new THREE.PerspectiveCamera(42, size.width / size.height, 0.05, 400);
  camera.up.set(0, 1, 0);
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, context: gl, antialias: true });
  } catch (err) {
    showFallback();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  resize();
  scene.add(new THREE.AmbientLight(0xffffff, LIGHTING.ambient));
  keyLight = new THREE.DirectionalLight(0xffffff, LIGHTING.keyIntensity);
  keyAim = new THREE.Vector3();
  scene.add(keyLight);
  scene.add(keyLight.target);
  const root = new THREE.Group();
  sceneRoot = root;
  scene.add(root);
  controls = new OrbitControls(camera, canvas);
  const limits = polarLimits();
  controls.minPolarAngle = limits.minPolarAngle;
  controls.maxPolarAngle = limits.maxPolarAngle;
  controls.enablePan = true;
  if (THREE.MOUSE && THREE.TOUCH) {
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }
  controls.enableDamping = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 200;
  controls.addEventListener('change', function () {
    if (!applying) syncTransferHits(THREE);
  });
  projectVec = new THREE.Vector3();
  raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = TRANSFER_LINE_THRESHOLD;
  pointer = new THREE.Vector2();
  let pointerDown = null;
  bindLoreSettings(THREE, root);
  rebuild(THREE, root, true);
  paintCards();
  window.addEventListener('resize', resize);
  if (elev) {
    elev.addEventListener('input', function () {
      applying = true;
      const off = cameraOffset();
      const dist = Math.hypot(off.x, off.y, off.z) || session.distance || 28;
      const az = Math.atan2(off.x, off.z) * 180 / Math.PI;
      const pose = cameraPose(Number(elev.value), az, dist);
      camera.position.set(controls.target.x + pose.x, controls.target.y + pose.y, controls.target.z + pose.z);
      session.elevation_deg = pose.elevation_deg;
      session.azimuth_deg = pose.azimuth_deg;
      session.distance = pose.distance;
      if (elevText) elevText.textContent = Math.round(pose.elevation_deg) + '°';
      controls.update();
      applying = false;
    });
  }
  controls.addEventListener('change', function () {
    if (applying) return;
    syncElevationFromCamera();
  });
  if (themeSelect) {
    themeSelect.addEventListener('change', function () {
      themeName = themeSelect.value === 'mardat' ? 'mardat' : 'empire';
      rebuild(THREE, root, false);
    });
  }
  const timeButton = document.getElementById('time-play');
  if (timeButton) {
    timeButton.addEventListener('click', function () {
      timeButton.textContent = 'Time ×1, paused';
    });
  }
  const crumbSystem = document.getElementById('crumb-system');
  const crumbFocus = document.getElementById('crumb-focus');
  if (crumbSystem) {
    crumbSystem.addEventListener('click', function () {
      frame = 'system';
      session = Object.assign({}, session, { focused: null });
      rebuild(THREE, root, true);
    });
  }
  if (crumbFocus) {
    crumbFocus.addEventListener('click', function () {
      frame = crumbFocus.getAttribute('data-frame') || 'tc5';
      session = Object.assign({}, session, { focused: frame });
      rebuild(THREE, root, true);
    });
  }
  canvas.addEventListener('pointermove', function (event) {
    const hit = pick(event);
    const readout = document.getElementById('readout');
    if (!readout) return;
    readout.textContent = hit && hit.record ? hoverReadout(hit.record) : '';
  });
  canvas.addEventListener('pointerdown', function (event) {
    pointerDown = { x: event.clientX, y: event.clientY };
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
    if (selection) selection.removeAllRanges();
  });
  canvas.addEventListener('click', function (event) {
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
    const hit = pick(event);
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(function () {
      clickTimer = null;
      if (!hit) {
        const kept = controls.target.clone();
        session = clearSelection(session);
        controls.target.copy(kept);
        paintCards();
        return;
      }
      if (hit.kind === 'transfer') {
        session = selectFromPick(session, hit);
        paintCards();
        return;
      }
      if (hit.id === 'star') {
        session = selectBody(session, 'star');
        paintCards();
        return;
      }
      session = selectBody(session, hit.id);
      paintCards();
    }, 280);
  });
  canvas.addEventListener('dblclick', function (event) {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    const hit = pick(event);
    if (!hit) return;
    if (hit.kind === 'transfer') {
      session = selectFromPick(session, hit);
      paintCards();
      return;
    }
    if (hit.id === 'star') {
      frame = 'system';
      session = Object.assign({}, session, { focused: null });
      rebuild(THREE, root, true);
      paintCards();
      return;
    }
    if (hit.id === 'tc5' && frame !== 'tc5') {
      frame = 'tc5';
      session = frameBody(session, 'tc5');
      rebuild(THREE, root, true);
      paintCards();
      return;
    }
    session = frameBody(session, hit.id);
    const pos = hit.position || { x: 0, y: 0, z: 0 };
    controls.target.set(pos.x, pos.y, pos.z);
    controls.update();
    paintCards();
  });
  if (!loopStarted) {
    loopStarted = true;
    tick();
  }
}

function probeWebgl() {
  const surface = document.createElement('canvas');
  let gl = null;
  try {
    gl = surface.getContext('webgl2') || surface.getContext('webgl');
  } catch (err) {
    gl = null;
  }
  if (!gl) return { webgl: false, maxTextureSize: null };
  const size = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
  if (lose && lose.loseContext) lose.loseContext();
  return { webgl: true, maxTextureSize: typeof size === 'number' ? size : null };
}

function bindResourceToggle() {
  const button = document.getElementById('resource-toggle');
  if (!button) return;
  button.addEventListener('click', function () {
    writeResourceStorage('svg');
    const dest = resourceDestination('3d', { mode: 'svg' }, location.search);
    if (dest) location.assign(dest);
  });
}

async function boot() {
  if (typeof document === 'undefined') return;
  const choice = decideViewer({
    search: location.search,
    stored: readResourceStorage(),
    signals: collectBrowserSignals(),
    probe: probeWebgl
  });
  const dest = resourceDestination('3d', choice, location.search);
  if (dest) {
    location.replace(dest);
    return;
  }
  bindResourceToggle();
  applyShell(document);
  stage = document.getElementById('stage');
  canvas = stage ? stage.querySelector('canvas') : null;
  if (!canvas) {
    showFallback();
    return;
  }
  const gl = webglContext(canvas);
  if (!gl) {
    showFallback();
    return;
  }
  let THREE;
  let OrbitControls;
  try {
    THREE = await import('three');
    const controlsMod = await import('three/addons/controls/OrbitControls.js');
    OrbitControls = controlsMod.OrbitControls;
  } catch (err) {
    showFallback();
    return;
  }
  try {
    const gltfMod = await import('three/addons/loaders/GLTFLoader.js');
    BodyGLTFLoader = gltfMod.GLTFLoader || null;
  } catch (err) {
    BodyGLTFLoader = null;
  }
  try {
    await startViewer(THREE, OrbitControls, gl);
  } catch (err) {
    const status = document.getElementById('load-status');
    if (status) status.textContent = 'The system file did not load. Open this page from the static server.';
  }
}

boot();
