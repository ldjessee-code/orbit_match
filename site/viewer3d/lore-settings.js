// Dock section built from system data. Names and layer lists stay in the system file.

export const LORE_SETTINGS_TITLE = 'Lore based settings';

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function loreSettingsFromSystem(system) {
  const belts = [];
  const layers = [];
  const bodies = system && Array.isArray(system.bodies) ? system.bodies : [];
  bodies.forEach(function (body) {
    if (!body || body.id == null) return;
    if (body.kind === 'belt') {
      const display = body.display || {};
      const density = finite(display.density);
      const dustiness = finite(display.dustiness);
      belts.push({
        id: String(body.id),
        name: body.name == null ? String(body.id) : String(body.name),
        density: density == null ? 2 : density,
        dustiness: dustiness == null ? 40 : dustiness
      });
    }
    const list = Array.isArray(body.layers) ? body.layers : [];
    list.forEach(function (layer) {
      if (!layer || layer.key == null) return;
      let visible = true;
      if (layer.defaultVisible != null) visible = !!layer.defaultVisible;
      else if (layer.default === false) visible = false;
      layers.push({
        bodyId: String(body.id),
        bodyName: body.name == null ? String(body.id) : String(body.name),
        key: String(layer.key),
        node: layer.node == null ? '' : String(layer.node),
        label: layer.label == null ? String(layer.key) : String(layer.label),
        defaultVisible: visible
      });
    });
  });
  return {
    title: LORE_SETTINGS_TITLE,
    collapsed: true,
    belts: belts,
    layers: layers
  };
}

export function loreSettingsMarkup(plan) {
  const source = plan || { belts: [], layers: [] };
  const parts = [];
  (source.belts || []).forEach(function (belt) {
    parts.push(
      '<fieldset class="belt-controls" data-belt="' + esc(belt.id) + '">' +
      '<legend>' + esc(belt.name) + '</legend>' +
      '<label>Density <input id="belt-' + esc(belt.id) + '-density" data-belt-density="' + esc(belt.id) + '" type="range" min="0" max="4" step="1" value="' + esc(belt.density) + '" aria-label="' + esc(belt.name + ' Density') + '"> <span id="belt-' + esc(belt.id) + '-density-readout"></span></label>' +
      '<label>Dustiness <input id="belt-' + esc(belt.id) + '-dustiness" data-belt-dustiness="' + esc(belt.id) + '" type="range" min="0" max="100" step="1" value="' + esc(belt.dustiness) + '" aria-label="' + esc(belt.name + ' Dustiness') + '"> <span id="belt-' + esc(belt.id) + '-dustiness-readout"></span></label>' +
      '</fieldset>'
    );
  });
  (source.layers || []).forEach(function (layer) {
    const id = 'layer-' + layer.bodyId + '-' + layer.key;
    parts.push(
      '<label><input id="' + esc(id) + '" data-layer-key="' + esc(layer.key) + '" data-layer-body="' + esc(layer.bodyId) + '" data-layer-node="' + esc(layer.node) + '" type="checkbox"' +
      (layer.defaultVisible ? ' checked' : '') +
      ' aria-label="' + esc(layer.bodyName + ' ' + layer.label) + '"> ' + esc(layer.label) + '</label>'
    );
  });
  return parts.join('');
}
