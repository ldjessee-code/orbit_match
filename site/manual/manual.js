(function () {
  var O = window.OrbitManual;
  var STORE = "orbit-match-manual";
  var state = {
    stars: [],
    source: "",
    header: blankHeader(),
    rows: [],
    hz: null,
    fromDeepLink: false,
    // The file the editor last opened or saved, exactly as read or written.
    opened: null,
    // The editor's work as of that open or save, to tell unsaved changes.
    clean: null,
    // Star facts as a star list or file gave them, to tell typed ones.
    starClean: null,
    // The system file a deep link opened. Its edits get their own draft.
    linkFile: "",
    // The star map link in the address, once it has been applied.
    linkApplied: false,
    linkSnapshot: null,
    linkHostDone: false
  };

  var starCard = document.getElementById("star-card");
  var stack = document.getElementById("stack");
  var status = document.getElementById("status");
  var search = document.getElementById("star-search");
  var results = document.getElementById("star-results");
  var fileInput = document.getElementById("star-file");
  var systemFile = document.getElementById("system-file");
  var dragId = null;

  function blankHeader() {
    return {
      hostname: "",
      setting_name: "",
      spectype: "",
      mass: "",
      lum: "",
      teff: "",
      rad: "",
      x: "",
      y: "",
      z: "",
      planets: "",
      concept: "",
      holder: "",
      port: "",
      services: "",
      tags: "",
      imports: "",
      exports: "",
      fuel: "",
      fuel_unit: "",
      arrivals: [],
      epoch: "",
      epoch_object: null,
      reference_label: "toward the vernal point / arbitrary",
      reference_deg: "0"
    };
  }

  function uid() {
    return "b" + Math.random().toString(36).slice(2, 9);
  }

  function blankBody(kind, generated) {
    return {
      id: uid(),
      kind: kind || "planet",
      name: "",
      period: "",
      unit: "years",
      au: "",
      gravity: "",
      atmosphere: "",
      water: "",
      temperature: "",
      day: "",
      population: "",
      government: "",
      tech: "",
      concept: "",
      pressure: "",
      o2: "",
      co2: "",
      position_angle_deg: "",
      perihelion_longitude_deg: "",
      moons: [],
      generated: !!generated
    };
  }

  function blankMoon() {
    var moon = blankBody("moon", false);
    moon.unit = "days";
    moon.distanceKm = "";
    return moon;
  }

  function bodies() {
    return state.rows.filter(function (row) { return row.type === "body"; }).map(function (row) { return row.body; });
  }

  function mass() {
    return O.num(state.header.mass) || 1;
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function headerLum() {
    return O.luminosity({
      st_lum: state.header.lum,
      st_rad: state.header.rad,
      st_teff: state.header.teff
    });
  }

  // A file that states its goldilocks zone keeps it while the star facts that
  // set it are unchanged. Otherwise the zone comes from the luminosity.
  function fileHz() {
    var source = state.header.source;
    var star = source && source.star;
    if (!star || typeof star.hz_inner_au !== "number" || typeof star.hz_outer_au !== "number") return null;
    var same = [["lum", "lum_log"], ["teff", "teff_k"], ["rad", "radius_solar"], ["mass", "mass_solar"]].every(function (pair) {
      return String(state.header[pair[0]] == null ? "" : state.header[pair[0]]) === String(star[pair[1]] == null ? "" : star[pair[1]]);
    });
    return same ? { inner: star.hz_inner_au, outer: star.hz_outer_au, file: true } : null;
  }

  function refreshHz() {
    state.hz = fileHz() || O.goldilocks(headerLum());
  }

  function zoneNote() {
    if (!state.hz) return "The goldilocks band appears once the star has a luminosity or a radius and temperature.";
    var a = state.hz.inner.toFixed(2);
    var b = state.hz.outer.toFixed(2);
    return "Goldilocks zone " + a + "–" + b + " AU, " + (state.hz.file ? "as the file gives it" : "from this star's luminosity") + ". A body sits in the band when its distance is inside that range.";
  }

  function paintStar() {
    var color = O.starColor(state.header.spectype, O.num(state.header.teff));
    starCard.style.borderColor = color;
    starCard.style.boxShadow = "0 0 0 1px " + color;
    var host = document.getElementById("host-name");
    var spec = document.getElementById("spec-type");
    if (host) host.textContent = state.header.hostname || "No star yet";
    if (spec) spec.textContent = state.header.spectype || "Spectral type unknown";
    ["hostname", "setting_name", "spectype", "mass", "lum", "teff", "rad", "x", "y", "z", "planets", "concept", "holder", "port", "services", "tags", "imports", "exports", "fuel", "fuel_unit", "epoch", "reference_label", "reference_deg"].forEach(function (key) {
      var input = starCard.querySelector('[data-header="' + key + '"]');
      if (input && document.activeElement !== input) input.value = state.header[key] || "";
    });
    var note = document.getElementById("zone-note");
    if (note) note.textContent = zoneNote();
  }

  function field(label, html) {
    return '<label>' + label + html + "</label>";
  }

  function renderBody(body) {
    var list = bodies();
    var index = list.findIndex(function (item) { return item.id === body.id; });
    var zones = O.visualZones(state.rows);
    var notes = O.warningsFor(body, list[index - 1], list[index + 1], zones[body.id], state.hz, mass());
    var kepler = keplerNote(body);
    if (kepler) notes.push(kepler);
    var card = document.createElement("article");
    card.className = "body-card";
    card.dataset.body = body.id;
    card.innerHTML =
      '<div class="card-tools">' +
        '<button type="button" class="drag" aria-label="Drag ' + esc(body.name || "body") + '">Drag</button>' +
        '<button type="button" data-act="in">Inward</button>' +
        '<button type="button" data-act="out">Outward</button>' +
        '<button type="button" data-act="remove">Remove</button>' +
      "</div>" +
      field("Name", '<input data-field="name" value="' + esc(body.name) + '">') +
      field("Kind", '<select data-field="kind">' + options(body.kind) + "</select>") +
      '<div class="pair">' +
        field("Orbital period", '<input data-field="period" data-help="period" inputmode="decimal" value="' + esc(body.period) + '">') +
        field("Unit", '<select data-field="unit" data-help="unit"><option value="years"' + (body.unit === "years" ? " selected" : "") + '>Years</option><option value="days"' + (body.unit === "days" ? " selected" : "") + ">Days</option></select>") +
      "</div>" +
      distanceHtml(body) +
      (body.kind === "belt" ? "" : field("Eccentricity", '<input data-field="e" inputmode="decimal" placeholder="0 is a circle" value="' + esc(body.e) + '">')) +
      '<div class="angle-row">' +
        field("Position at epoch (deg)", '<input data-field="position_angle_deg" inputmode="decimal" value="' + esc(body.position_angle_deg) + '">') +
        '<button type="button" data-act="random-position">Random</button>' +
      "</div>" +
      '<div class="angle-row">' +
        field("Longitude of perihelion (deg)", '<input data-field="perihelion_longitude_deg" inputmode="decimal" value="' + esc(body.perihelion_longitude_deg) + '">') +
        '<button type="button" data-act="random-perihelion">Random</button>' +
      "</div>" +
      (body.angle_error ? '<p class="warn" data-angle-error>' + esc(body.angle_error) + "</p>" : "") +
      (notes.length ? '<p class="warn">' + notes.map(esc).join(" ") + "</p>" : "") +
      "<details><summary>World facts</summary>" +
        '<div class="pair">' +
          field("Mass (Earth = 1)", '<input data-field="mass_earth" inputmode="decimal" value="' + esc(body.mass_earth) + '">') +
          field("Radius (km)", '<input data-field="radius_km" inputmode="decimal" value="' + esc(body.radius_km) + '">') +
        "</div>" +
        field("Gravity", '<input data-field="gravity" value="' + esc(body.gravity) + '">') +
        field("Atmosphere", '<input data-field="atmosphere" value="' + esc(body.atmosphere) + '">') +
        field("Water", '<input data-field="water" value="' + esc(body.water) + '">') +
        field("Temperature", '<input data-field="temperature" value="' + esc(body.temperature) + '">') +
        field("Day length", '<input data-field="day" value="' + esc(body.day) + '">') +
        field("Population", '<input data-field="population" value="' + esc(body.population) + '">') +
        field("Government", '<input data-field="government" value="' + esc(body.government) + '">') +
        field("Tech", '<input data-field="tech" value="' + esc(body.tech) + '">') +
        field("High concept", '<textarea data-field="concept">' + esc(body.concept) + "</textarea>") +
        field("Surface pressure (atm)", '<input data-field="pressure" data-help="pressure" inputmode="decimal" value="' + esc(body.pressure) + '">') +
        field("Oxygen (%)", '<input data-field="o2" data-help="o2" inputmode="decimal" value="' + esc(body.o2) + '">') +
        field("Carbon dioxide (%)", '<input data-field="co2" data-help="co2" inputmode="decimal" value="' + esc(body.co2) + '">') +
        airHtml(body) +
      "</details>" +
      moonHtml(body);
    return card;
  }

  // A belt has two edges. A body with a parent sits a distance in km from it.
  // Any other body sits a distance in AU from the star.
  function distanceHtml(body) {
    if (body.kind === "belt") {
      return '<div class="pair">' +
        field("Inner edge (AU)", '<input data-field="a_inner_au" inputmode="decimal" value="' + esc(body.a_inner_au) + '">') +
        field("Outer edge (AU)", '<input data-field="a_outer_au" inputmode="decimal" value="' + esc(body.a_outer_au) + '">') +
        "</div>";
    }
    if (body.parent) {
      return field("Distance from " + esc(parentName(body.parent)) + " (km)", '<input data-field="distanceKm" inputmode="decimal" value="' + esc(body.distanceKm) + '">');
    }
    return field("Distance (AU)", '<input data-field="au" inputmode="decimal" value="' + esc(body.au) + '">');
  }

  function parentName(id) {
    var found = bodies().find(function (item) { return item.id === id; });
    return (found && found.name) || id;
  }

  // Period and distance agree for the star's mass by Kepler's third law. When
  // the mass changes, a card says so instead of keeping two numbers that no
  // longer fit.
  function keplerNote(body) {
    if (body.parent || body.kind === "belt") return "";
    var years = O.periodYears(body);
    var au = O.num(body.au);
    if (years == null || au == null || au <= 0) return "";
    var expected = O.auToPeriodYears(au, mass());
    if (!expected || Math.abs(years - expected) / expected < 0.02) return "";
    return "This period and distance do not agree for a star of " + mass() + " solar masses. Change one of them, or the star mass.";
  }

  function airHtml(body) {
    var advice = O.airAdvice(body.pressure, body.o2, body.co2);
    if (!advice) return "";
    if (advice.percent == null) return '<p class="air-note">' + esc(advice.lines.join(" ")) + "</p>";
    var extra = advice.lines.length ? " " + advice.lines.join(" ") : "";
    return '<p class="air-note">Oxygen is about ' + advice.percent + '% of a normal breath. Lightest gear: ' + esc(advice.aid) + "." + esc(extra) + "</p>";
  }

  // Replaces only the air advice under a body's or moon's facts, so typing in
  // an air field does not redraw the cards.
  function refreshAir(host, body) {
    var panel = null;
    for (var i = 0; i < host.children.length; i++) {
      if (host.children[i].tagName === "DETAILS") { panel = host.children[i]; break; }
    }
    if (!panel) return;
    var old = null;
    for (var j = 0; j < panel.children.length; j++) {
      if (panel.children[j].classList.contains("air-note")) { old = panel.children[j]; break; }
    }
    var html = airHtml(body);
    if (!html) {
      if (old) old.remove();
      return;
    }
    var box = document.createElement("div");
    box.innerHTML = html;
    var note = box.firstChild;
    if (old) panel.replaceChild(note, old);
    else panel.appendChild(note);
  }

  function moonHtml(body) {
    // A moon card shows moons it already holds, so none is hidden.
    if (body.kind === "moon" && !(body.moons && body.moons.length)) return "";
    var moons = body.moons || [];
    var html = '<div class="moons"><p class="moon-title">Moons</p>';
    moons.forEach(function (moon) {
      html += '<div class="moon" data-moon="' + esc(moon.id) + '">' +
        '<div class="card-tools"><button type="button" data-act="remove-moon">Remove moon</button></div>' +
        field("Moon name", '<input data-moon-field="name" value="' + esc(moon.name) + '">') +
        '<div class="pair">' +
          field("Period around the planet", '<input data-moon-field="period" data-help="moon-period" inputmode="decimal" value="' + esc(moon.period) + '">') +
          field("Unit", '<select data-moon-field="unit"><option value="days"' + (moon.unit !== "years" ? " selected" : "") + '>Days</option><option value="years"' + (moon.unit === "years" ? " selected" : "") + ">Years</option></select>") +
        "</div>" +
        field("Distance from planet (km)", '<input data-moon-field="distanceKm" data-help="moon-distance" inputmode="decimal" value="' + esc(moon.distanceKm) + '">') +
        '<div class="angle-row">' +
          field("Position at epoch (deg)", '<input data-moon-field="position_angle_deg" inputmode="decimal" value="' + esc(moon.position_angle_deg) + '">') +
          '<button type="button" data-act="random-moon-position">Random</button>' +
        "</div>" +
        '<div class="angle-row">' +
          field("Longitude of perihelion (deg)", '<input data-moon-field="perihelion_longitude_deg" inputmode="decimal" value="' + esc(moon.perihelion_longitude_deg) + '">') +
          '<button type="button" data-act="random-moon-perihelion">Random</button>' +
        "</div>" +
        (moon.angle_error ? '<p class="warn" data-angle-error>' + esc(moon.angle_error) + "</p>" : "") +
        "<details><summary>Moon facts</summary>" +
          field("Gravity", '<input data-moon-field="gravity" value="' + esc(moon.gravity) + '">') +
          field("Atmosphere", '<input data-moon-field="atmosphere" value="' + esc(moon.atmosphere) + '">') +
          field("Surface pressure (atm)", '<input data-moon-field="pressure" inputmode="decimal" value="' + esc(moon.pressure) + '">') +
          field("Oxygen (%)", '<input data-moon-field="o2" inputmode="decimal" value="' + esc(moon.o2) + '">') +
          field("Carbon dioxide (%)", '<input data-moon-field="co2" inputmode="decimal" value="' + esc(moon.co2) + '">') +
          field("Water", '<input data-moon-field="water" value="' + esc(moon.water) + '">') +
          field("Temperature", '<input data-moon-field="temperature" value="' + esc(moon.temperature) + '">') +
          field("Day length", '<input data-moon-field="day" value="' + esc(moon.day) + '">') +
          field("Population", '<input data-moon-field="population" value="' + esc(moon.population) + '">') +
          field("Government", '<input data-moon-field="government" value="' + esc(moon.government) + '">') +
          field("Tech", '<input data-moon-field="tech" value="' + esc(moon.tech) + '">') +
          field("High concept", '<textarea data-moon-field="concept">' + esc(moon.concept) + "</textarea>") +
          airHtml(moon) +
        "</details></div>";
    });
    html += '<button type="button" data-act="add-moon">Add a moon</button></div>';
    return html;
  }

  // The kinds the viewers draw. A station, gate, or yard is a structure. A
  // kind from an older file stays in the list, so it is not lost.
  var KINDS = ["planet", "moon", "asteroid", "belt", "structure"];

  function options(kind) {
    var list = KINDS.slice();
    if (kind && list.indexOf(kind) < 0) list.push(kind);
    return list.map(function (name) {
      return '<option value="' + name + '"' + (name === kind ? " selected" : "") + ">" + name + "</option>";
    }).join("");
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;");
  }

  function hzLabel(edge) {
    var line = document.createElement("div");
    line.className = "hz-line";
    line.dataset.edge = edge;
    line.textContent = edge === "inner" ? "Goldilocks starts" : "Goldilocks ends";
    return line;
  }

  function panelKey(el) {
    var card = el.closest("[data-body]");
    var moon = el.closest("[data-moon]");
    return (card ? card.dataset.body : "") + "|" + (moon ? moon.dataset.moon : "");
  }

  // What a redraw must put back: open panels and the focused field.
  function viewState() {
    var open = {};
    var panels = stack.querySelectorAll("details[open]");
    for (var i = 0; i < panels.length; i++) open[panelKey(panels[i])] = true;
    var active = document.activeElement;
    var focus = null;
    if (active && stack.contains(active) && active.closest("[data-body]")) {
      focus = {
        key: panelKey(active),
        attr: active.dataset.moonField ? "data-moon-field" : (active.dataset.field ? "data-field" : (active.dataset.act ? "data-act" : null)),
        name: active.dataset.moonField || active.dataset.field || active.dataset.act || null,
        start: active.selectionStart,
        end: active.selectionEnd
      };
    }
    return { open: open, focus: focus };
  }

  function restoreView(saved) {
    var panels = stack.querySelectorAll("details");
    for (var i = 0; i < panels.length; i++) {
      if (saved.open[panelKey(panels[i])]) panels[i].open = true;
    }
    var f = saved.focus;
    if (!f || !f.attr || !f.name) return;
    var parts = f.key.split("|");
    var scope = stack.querySelector('[data-body="' + cssId(parts[0]) + '"]');
    if (scope && parts[1]) scope = scope.querySelector('[data-moon="' + cssId(parts[1]) + '"]');
    if (!scope) return;
    var candidates = scope.querySelectorAll("[" + f.attr + '="' + cssId(f.name) + '"]');
    var input = null;
    for (var j = 0; j < candidates.length; j++) {
      if (panelKey(candidates[j]) === f.key) { input = candidates[j]; break; }
    }
    if (!input) return;
    input.focus();
    if (input.setSelectionRange && f.start != null) {
      try { input.setSelectionRange(f.start, f.end); } catch (err) { /* not a text field */ }
    }
  }

  function cssId(value) {
    return window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
  }

  function renderStack(keep) {
    var focus = keep || null;
    var saved = viewState();
    stack.innerHTML = "";
    var parent = stack;
    var gold = null;
    state.rows.forEach(function (row) {
      if (row.type === "hz" && row.edge === "inner") {
        gold = document.createElement("div");
        gold.className = "band band-gold";
        gold.appendChild(hzLabel("inner"));
        if (state.hz) {
          var range = document.createElement("p");
          range.className = "hz-range";
          range.textContent = state.hz.inner.toFixed(2) + "–" + state.hz.outer.toFixed(2) + " AU";
          gold.appendChild(range);
        }
        stack.appendChild(gold);
        parent = gold;
        return;
      }
      if (row.type === "hz" && row.edge === "outer") {
        var label = hzLabel("outer");
        if (gold) gold.appendChild(label);
        else stack.appendChild(label);
        parent = stack;
        gold = null;
        return;
      }
      if (row.type === "body") parent.appendChild(renderBody(row.body));
    });
    if (!bodies().length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No orbital objects yet. Add one, or choose a star with a known planet count.";
      stack.appendChild(empty);
    }
    restoreView(saved);
    if (focus && focus.body) {
      var input = stack.querySelector('[data-body="' + focus.body + '"] [data-field="' + focus.field + '"]');
      if (input) {
        input.focus();
        if (input.setSelectionRange && focus.start != null) {
          try { input.setSelectionRange(focus.start, focus.end); } catch (err) { /* number inputs */ }
        }
      }
    }
  }

  function rebuildZones(keep) {
    var list = bodies();
    state.rows = O.withZones(list, state.hz, mass());
    renderStack(keep);
    saveLocal();
  }

  // A body holds work unless it is a blank card made from a planet count.
  function bodyHasWork(body) {
    return !body.generated || !!(body.name || body.period || body.au || body.concept ||
      body.position_angle_deg || body.perihelion_longitude_deg || (body.moons && body.moons.length));
  }

  function edited() {
    return bodies().some(bodyHasWork);
  }

  // A moon added with "Add a moon" starts blank. Any filled field is work.
  function moonHasWork(moon) {
    return Object.keys(moon).some(function (key) {
      if (key === "id" || key === "kind" || key === "unit" || key === "generated" || key === "moons" || key === "angle_error") return false;
      return moon[key] != null && String(moon[key]).trim() !== "";
    });
  }

  // Star facts that a star list fills. Typed values count as work.
  var STAR_FACTS = ["hostname", "setting_name", "spectype", "mass", "lum", "teff", "rad", "x", "y", "z"];
  var CARD_FIELDS = ["concept", "holder", "port", "services", "tags", "imports", "exports", "fuel", "fuel_unit", "epoch"];

  function starFacts() {
    var out = {};
    STAR_FACTS.forEach(function (key) { out[key] = String(state.header[key] || ""); });
    return JSON.stringify(out);
  }

  function starTyped() {
    var base = {};
    try { base = state.starClean ? JSON.parse(state.starClean) : {}; } catch (err) { base = {}; }
    return STAR_FACTS.some(function (key) {
      var now = String(state.header[key] || "");
      return now !== "" && now !== String(base[key] || "");
    });
  }

  function cardTyped() {
    return CARD_FIELDS.some(function (key) { return String(state.header[key] || "").trim() !== ""; });
  }

  function hasWork() {
    return edited() || starTyped() || cardTyped();
  }

  // ---- Undo ----

  var undoStack = [];
  var undoButton = document.getElementById("undo");

  function pushUndo(label) {
    undoStack.push({
      label: label,
      data: JSON.stringify({ header: state.header, bodies: bodies(), opened: state.opened, clean: state.clean, starClean: state.starClean })
    });
    if (undoStack.length > 20) undoStack.shift();
    if (undoButton) undoButton.disabled = false;
  }

  function undo() {
    var item = undoStack.pop();
    if (undoButton) undoButton.disabled = !undoStack.length;
    if (!item) return;
    var data = JSON.parse(item.data);
    state.header = data.header;
    state.opened = data.opened;
    state.clean = data.clean;
    state.starClean = data.starClean;
    search.value = state.header.hostname || "";
    refreshHz();
    state.rows = O.withZones(data.bodies, state.hz, mass());
    paintStar();
    renderStack();
    saveLocal();
    setStatus("Undid " + item.label + ".");
  }

  function applyRow(row) {
    // A new star starts a new system. Nothing from the last one carries over.
    state.header = blankHeader();
    state.header.hostname = row.hostname || "";
    state.header.spectype = row.st_spectype || "";
    state.header.mass = row.st_mass || "";
    state.header.lum = row.st_lum || "";
    state.header.teff = row.st_teff || "";
    state.header.rad = row.st_rad || "";
    state.header.x = row.calculated_x || "";
    state.header.y = row.calculated_y || "";
    state.header.z = row.calculated_z || "";
    var count = O.num(row.sy_pnum);
    state.header.planets = count == null ? "" : String(Math.round(count));
    search.value = row.hostname || "";
    refreshHz();
    // Published planets fill their cards. The rest of the count stays blank.
    var list = (row.planets || []).slice(0, 40).map(planetFromRow).sort(function (a, b) {
      return (O.bodyAu(a, mass()) || Infinity) - (O.bodyAu(b, mass()) || Infinity);
    });
    var n = Math.max(list.length, Math.min(40, Math.round(count || 0)));
    while (list.length < n) list.push(blankBody("planet", true));
    state.rows = O.withZones(list, state.hz, mass());
    state.opened = null;
    state.clean = null;
    state.starClean = starFacts();
    paintStar();
    renderStack();
    saveLocal();
    var shown = n;
    var raw = Math.round(count || 0);
    setStatus(row.hostname + " — " + shown + (shown === 1 ? " planet section." : " planet sections.") +
      (raw > 40 ? " The file listed " + raw + ". Add the rest by hand." : ""));
  }

  function setPlanetCount(n) {
    n = Math.max(0, Math.min(40, Math.round(n)));
    var list = bodies();
    while (list.filter(function (body) { return body.kind === "planet"; }).length < n) {
      list.push(blankBody("planet", true));
    }
    // Only blank cards made from the count are removed. A card with any work,
    // a moon, or an angle stays, so the count can end up higher than asked.
    var removed = false;
    while (list.filter(function (body) { return body.kind === "planet"; }).length > n) {
      var idx = -1;
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].kind === "planet" && !bodyHasWork(list[i])) idx = i;
        if (idx >= 0) break;
      }
      if (idx < 0) break;
      if (!removed) pushUndo("lowering Known planets");
      removed = true;
      list.splice(idx, 1);
    }
    refreshHz();
    state.rows = O.withZones(list, state.hz, mass());
    renderStack();
    saveLocal();
  }

  function chooseStar(row) {
    if (!row) return;
    closeResults();
    var name = row.hostname || row.sy_name || "that star";
    var asked = edited() || starTyped()
      ? ask("Replace the system with " + name + "?",
        ["Choosing a star starts a new system with its known planets. The bodies and star facts in the editor are replaced.", "A backup saves the current work as a file first. Undo also brings it back."],
        BACKUP_CHOICES, changeList())
      : Promise.resolve("continue");
    asked.then(function (choice) {
      if (choice === "cancel") { setStatus("Kept the current system."); return; }
      if (choice === "backup") backupWork();
      pushUndo("choosing " + name);
      applyRow(row);
    });
  }

  function showResults() {
    var q = search.value.trim().toLowerCase();
    var matches = state.stars.filter(function (row) {
      if (!q) return true;
      return (row.hostname || "").toLowerCase().indexOf(q) !== -1 ||
        (row.sy_name || "").toLowerCase().indexOf(q) !== -1;
    }).slice(0, q ? 20 : 8);
    results.innerHTML = "";
    if (!matches.length) {
      results.hidden = true;
      return;
    }
    matches.forEach(function (row) {
      var li = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      var spec = row.st_spectype ? " · " + row.st_spectype : "";
      var n = row.sy_pnum ? " · " + Math.round(Number(row.sy_pnum)) + " planets" : "";
      button.textContent = (row.hostname || row.sy_name) + spec + n;
      button.addEventListener("click", function () { chooseStar(row); });
      li.appendChild(button);
      results.appendChild(li);
    });
    results.hidden = false;
  }

  function closeResults() {
    results.hidden = true;
  }

  // NASA tables have one row per planet. A star is listed once, and keeps its
  // planet rows.
  function groupStars(rows) {
    var byHost = {};
    var out = [];
    rows.forEach(function (row) {
      var key = row.hostname;
      var star = byHost[key];
      if (!star) {
        star = Object.assign({}, row);
        star.planets = [];
        byHost[key] = star;
        out.push(star);
      }
      if (row.pl_name || O.num(row.pl_orbsmax) != null || O.num(row.pl_orbper) != null) star.planets.push(row);
    });
    return out;
  }

  // One published planet as a card: distance, period, eccentricity, mass,
  // and radius, from the NASA planet columns.
  function planetFromRow(row) {
    var body = blankBody("planet", false);
    body.name = row.pl_name || "";
    var au = O.num(row.pl_orbsmax);
    var days = O.num(row.pl_orbper);
    var e = O.num(row.pl_orbeccen);
    var earths = O.num(row.pl_bmasse);
    var radius = O.num(row.pl_rade);
    if (au != null && au > 0) body.au = String(au);
    if (days != null && days > 0) {
      body.period = String(days);
      body.unit = "days";
    }
    if (e != null && e >= 0 && e < 1) body.e = String(e);
    if (earths != null && earths > 0) body.mass_earth = String(earths);
    if (radius != null && radius > 0) body.radius_km = String(Number((radius * 6371.0).toPrecision(5)));
    return body;
  }

  function loadStars(text, source) {
    state.stars = groupStars(O.parseCsv(text));
    state.source = source;
    var link = window.OrbitBuilderLink;
    if (state.fromDeepLink || (link && link.parseBuilderHash(location.hash).mode === "load")) return;
    if (!state.stars.length) {
      setStatus("No stars found in " + source + ". The file needs a hostname column with at least one row.");
      return;
    }
    setStatus(state.stars.length + (state.stars.length === 1 ? " star from " : " stars from ") + source + ". Search for one in the star section.");
    // A star map link is applied once, at load. A star list that arrives
    // later fills the linked star only if nothing was changed since.
    applyLinkHost();
  }

  function hashParams() {
    return new URLSearchParams((location.hash || "").replace(/^#/, ""));
  }

  function applyHashOverlay() {
    if (state.fromDeepLink) return;
    var q = hashParams();
    if (q.get("h") !== "1" && !q.get("host")) return;
    if (!state.header.hostname && q.get("host")) {
      state.header.hostname = q.get("host");
      search.value = q.get("host");
    }
    ["name", "spec", "mass", "lum", "teff", "planets", "concept", "port", "holder", "fuel", "fuel_unit"].forEach(function (key) {
      var value = q.get(key);
      if (!value) return;
      var map = { name: "setting_name", spec: "spectype" };
      state.header[map[key] || key] = value;
    });
    ["x", "y", "z"].forEach(function (key) {
      if (q.get(key)) state.header[key] = q.get(key);
    });
    if (q.getAll("svc").length) state.header.services = q.getAll("svc").join(", ");
    if (q.getAll("tag").length) state.header.tags = q.getAll("tag").join(", ");
    if (q.getAll("imp").length) state.header.imports = q.getAll("imp").join(", ");
    if (q.getAll("exp").length) state.header.exports = q.getAll("exp").join(", ");
    if (q.getAll("from").length) state.header.arrivals = q.getAll("from");
    if (!bodies().length && O.num(state.header.planets)) {
      var n = Math.max(0, Math.min(40, Math.round(O.num(state.header.planets))));
      var list = [];
      for (var i = 0; i < n; i++) list.push(blankBody("planet", true));
      refreshHz();
      state.rows = O.withZones(list, state.hz, mass());
    } else {
      refreshHz();
      state.rows = O.withZones(bodies(), state.hz, mass());
    }
    paintStar();
    renderStack();
    saveLocal();
  }

  function readHeader(event) {
    var input = event.target.closest("[data-header]");
    if (!input) return;
    // A change event after an input event carries the same value. One edit is
    // handled once.
    if (event.type === "change" && String(state.header[input.dataset.header] == null ? "" : state.header[input.dataset.header]) === input.value) return;
    state.header[input.dataset.header] = input.value;
    if (input.dataset.header === "planets") {
      var n = O.num(input.value);
      if (n == null) return;
      setPlanetCount(n);
      return;
    }
    if (input.dataset.header === "lum" || input.dataset.header === "teff" || input.dataset.header === "mass" || input.dataset.header === "spectype" || input.dataset.header === "rad") {
      refreshHz();
      paintStar();
      rebuildZones();
    } else {
      paintStar();
      saveLocal();
    }
  }

  function syncOrbit(body, source) {
    // Four significant figures, so a close planet keeps its distance.
    var figures = function (value) { return String(Number(value.toPrecision(4))); };
    if (source === "period") {
      var au = O.periodToAu(O.periodYears(body), mass());
      body.au = au == null ? "" : figures(au);
    } else if (source === "au") {
      var years = O.auToPeriodYears(body.au, mass());
      if (years == null) body.period = "";
      else if (body.unit === "days") body.period = figures(years * O.YEAR_DAYS);
      else body.period = figures(years);
    }
  }

  function onStackInput(event) {
    var input = event.target.closest("[data-field], [data-moon-field]");
    var card = event.target.closest("[data-body]");
    if (!input || !card) return;
    var body = bodies().find(function (item) { return item.id === card.dataset.body; });
    if (!body) return;
    var moonEl = input.closest("[data-moon]");
    // A change event after an input event carries the same value. One edit is
    // handled once.
    if (event.type === "change") {
      var owner = body;
      if (moonEl) owner = (body.moons || []).find(function (item) { return item.id === moonEl.dataset.moon; }) || null;
      var key = input.dataset.moonField || input.dataset.field;
      if (owner && String(owner[key] == null ? "" : owner[key]) === input.value) return;
    }
    // Any change, including a moon or an angle, makes the card the user's work.
    body.generated = false;
    if (moonEl) {
      var moon = (body.moons || []).find(function (item) { return item.id === moonEl.dataset.moon; });
      if (!moon) return;
      if (input.dataset.moonField === "unit") {
        moon.period = O.convertPeriod(moon.period, moon.unit, input.value);
        moon.unit = input.value;
        renderStack();
        saveLocal();
        return;
      }
      if (input.dataset.moonField === "position_angle_deg" || input.dataset.moonField === "perihelion_longitude_deg") {
        moon[input.dataset.moonField] = input.value;
        var moonParsed = angleParse(input.value);
        moon.angle_error = moonParsed.ok ? "" : moonParsed.error;
        var moonWarn = moonEl.querySelector("[data-angle-error]");
        if (!moonWarn && !moonParsed.ok) {
          moonWarn = document.createElement("p");
          moonWarn.className = "warn";
          moonWarn.setAttribute("data-angle-error", "");
          moonEl.appendChild(moonWarn);
        }
        if (moonWarn) moonWarn.textContent = moonParsed.ok ? "" : moonParsed.error;
        saveLocal();
        return;
      }
      moon[input.dataset.moonField] = input.value;
      if (input.dataset.moonField === "pressure" || input.dataset.moonField === "o2" || input.dataset.moonField === "co2") {
        refreshAir(moonEl, moon);
      }
      saveLocal();
      return;
    }
    if (input.dataset.field === "unit") {
      // A planet card with no stored unit shows Years.
      body.period = O.convertPeriod(body.period, body.unit || "years", input.value);
      body.unit = input.value;
      renderStack({ body: body.id, field: "period" });
      saveLocal();
      return;
    }
    if (input.dataset.field === "position_angle_deg" || input.dataset.field === "perihelion_longitude_deg") {
      body[input.dataset.field] = input.value;
      var parsed = angleParse(input.value);
      body.angle_error = parsed.ok ? "" : parsed.error;
      var warn = card.querySelector("[data-angle-error]");
      if (!warn && !parsed.ok) {
        warn = document.createElement("p");
        warn.className = "warn";
        warn.setAttribute("data-angle-error", "");
        card.appendChild(warn);
      }
      if (warn) warn.textContent = parsed.ok ? "" : parsed.error;
      saveLocal();
      return;
    }
    body[input.dataset.field] = input.value;
    if (input.dataset.field === "generated") return;
    body.generated = false;
    if (input.dataset.field === "kind") {
      // The card's fields follow its kind, and moons it holds stay shown.
      renderStack();
      saveLocal();
      return;
    }
    if (input.dataset.field === "pressure" || input.dataset.field === "o2" || input.dataset.field === "co2") {
      refreshAir(card, body);
      saveLocal();
      return;
    }
    if (input.dataset.field === "period" || input.dataset.field === "au") {
      // A body with a parent orbits that parent, not the star, so the star's
      // mass cannot turn its period into a distance.
      if (!body.parent) syncOrbit(body, input.dataset.field);
      refreshHz();
      rebuildZones({
        body: body.id,
        field: input.dataset.field,
        start: input.selectionStart,
        end: input.selectionEnd
      });
    } else {
      saveLocal();
    }
  }

  function moveBody(id, targetId, after) {
    var from = state.rows.findIndex(function (row) { return row.type === "body" && row.body.id === id; });
    if (from < 0 || id === targetId) return;
    var item = state.rows[from];
    var to = state.rows.findIndex(function (row) { return row.type === "body" && row.body.id === targetId; });
    if (to < 0) return;
    var dest = after ? to + 1 : to;
    if (dest === from || dest === from + 1) return;
    state.rows.splice(from, 1);
    if (from < dest) dest -= 1;
    state.rows.splice(dest, 0, item);
    renderStack();
    saveLocal();
  }

  function shiftBody(id, dir) {
    var list = bodies();
    var index = list.findIndex(function (body) { return body.id === id; });
    var next = index + dir;
    if (index < 0 || next < 0 || next >= list.length) return;
    var from = state.rows.findIndex(function (row) { return row.type === "body" && row.body.id === id; });
    var item = state.rows.splice(from, 1)[0];
    var to = state.rows.findIndex(function (row) { return row.type === "body" && row.body.id === list[next].id; });
    if (dir > 0) to += 1;
    state.rows.splice(to, 0, item);
    renderStack();
    saveLocal();
  }

  function onStackClick(event) {
    var card = event.target.closest("[data-body]");
    if (!card) return;
    var act = event.target.closest("[data-act]");
    if (!act) return;
    var id = card.dataset.body;
    if (act.dataset.act === "remove") {
      removeBody(id);
      return;
    }
    if (act.dataset.act === "in") shiftBody(id, -1);
    if (act.dataset.act === "out") shiftBody(id, 1);
    if (act.dataset.act === "add-moon") {
      var host = bodies().find(function (item) { return item.id === id; });
      if (!host) return;
      host.generated = false;
      if (!host.moons) host.moons = [];
      host.moons.push(blankMoon());
      renderStack();
      saveLocal();
    }
    if (act.dataset.act === "random-position" || act.dataset.act === "random-perihelion" || act.dataset.act === "random-moon-position" || act.dataset.act === "random-moon-perihelion") {
      var planet = bodies().find(function (item) { return item.id === id; });
      if (!planet) return;
      var moonBox = act.closest("[data-moon]");
      var target = planet;
      if (moonBox) {
        target = (planet.moons || []).find(function (item) { return item.id === moonBox.dataset.moon; });
      }
      if (!target) return;
      var which = act.dataset.act === "random-position" || act.dataset.act === "random-moon-position" ? "position" : "peri";
      pushUndo("a random angle");
      if (!applyRandom(target, which)) return;
      planet.generated = false;
      renderStack();
      saveLocal();
    }
    if (act.dataset.act === "remove-moon") {
      var owner = bodies().find(function (item) { return item.id === id; });
      var moonBox = act.closest("[data-moon]");
      if (!owner || !moonBox) return;
      var gone = (owner.moons || []).find(function (moon) { return moon.id === moonBox.dataset.moon; });
      var drop = function () {
        pushUndo("removing " + ((gone && gone.name) || "a moon"));
        owner.moons = (owner.moons || []).filter(function (moon) { return moon.id !== moonBox.dataset.moon; });
        renderStack();
        saveLocal();
        setStatus("Removed " + ((gone && gone.name) || "the moon") + ". Undo brings it back.");
      };
      if (!gone || !moonHasWork(gone)) { drop(); return; }
      ask("Remove " + (gone.name || "this moon") + "?", ["Undo brings it back."],
        [{ key: "remove", label: "Remove" }, { key: "cancel", label: "Cancel" }]).then(function (choice) {
        if (choice === "remove") drop();
      });
    }
  }

  // Every body that orbits this one, at any depth.
  function dependents(id) {
    var list = bodies();
    var found = [];
    var walk = function (parentId) {
      list.forEach(function (body) {
        if (body.parent === parentId && found.indexOf(body) < 0) {
          found.push(body);
          walk(body.id);
        }
      });
    };
    walk(id);
    return found;
  }

  // Remove asks first when the body holds work, and takes everything that
  // orbits it along, so no body is left pointing at a missing parent.
  function removeBody(id) {
    var body = bodies().find(function (item) { return item.id === id; });
    if (!body) return;
    var deps = dependents(id);
    var nested = body.moons || [];
    var label = body.name || "this body";
    var names = deps.map(function (item) { return item.name || item.id; })
      .concat(nested.map(function (moon) { return moon.name || "an unnamed moon"; }));
    var drop = function () {
      pushUndo("removing " + label);
      var out = {};
      out[id] = true;
      deps.forEach(function (item) { out[item.id] = true; });
      state.rows = state.rows.filter(function (row) {
        return !(row.type === "body" && out[row.body.id]);
      });
      rebuildZones();
      setStatus("Removed " + label + (names.length ? " and " + names.length + " that orbit it" : "") + ". Undo brings " + (names.length ? "them" : "it") + " back.");
    };
    if (!bodyHasWork(body) && !names.length) { drop(); return; }
    var count = names.length;
    ask("Remove " + label + "?",
      [count ? "These orbit it and are removed with it: " + names.join(", ") + "." : "This removes it from the system.", "Undo brings it back."],
      [{ key: "remove", label: count ? "Remove it and " + count + (count === 1 ? " body" : " bodies") + " that orbit it" : "Remove" },
        { key: "cancel", label: "Cancel" }]).then(function (choice) {
      if (choice === "remove") drop();
    });
  }

  function addBody() {
    var body = blankBody("planet", false);
    var outer = -1;
    state.rows.forEach(function (row, index) {
      if (row.type === "hz" && row.edge === "outer") outer = index;
    });
    if (outer >= 0) state.rows.splice(outer, 0, { type: "body", body: body });
    else state.rows.push({ type: "body", body: body });
    renderStack();
    saveLocal();
  }

  function angleApi() {
    return window.OrbitBuilderLink || null;
  }

  function angleParse(value) {
    var api = angleApi();
    if (!api || !api.parseAngleDeg) return { ok: false, error: "The angle tool did not load." };
    return api.parseAngleDeg(value);
  }

  function applyRandom(body, which) {
    var api = angleApi();
    if (!api || !api.randomAngleDeg) {
      setStatus("The angle tool did not load.");
      return false;
    }
    if (which === "position" || which === "both") body.position_angle_deg = api.randomAngleDeg().toFixed(2);
    if (which === "peri" || which === "both") body.perihelion_longitude_deg = api.randomAngleDeg().toFixed(2);
    body.angle_error = "";
    return true;
  }

  function randomizeAll() {
    var api = angleApi();
    if (!api || !api.randomizeManualAngles || !api.randomAngleDeg) {
      setStatus("The angle tool did not load.");
      return;
    }
    var list = bodies();
    var blank = function (value) { return value == null || String(value).trim() === ""; };
    var lockedAngle = function (body) {
      var canon = body.canon || {};
      return canon["orbit.position_angle_deg"] === "locked" || canon["orbit.perihelion_longitude_deg"] === "locked";
    };
    var withAngles = [];
    var locked = [];
    var note = function (body) {
      if (body.kind === "belt") return;
      if (!blank(body.position_angle_deg) || !blank(body.perihelion_longitude_deg)) withAngles.push(body.name || body.id);
      if (lockedAngle(body)) locked.push(body.name || body.id);
    };
    list.forEach(function (body) {
      note(body);
      if (body.kind !== "belt") (body.moons || []).forEach(note);
    });
    // "blank" fills only empty angles. "all" replaces every angle.
    var run = function (mode) {
      var next = api.randomizeManualAngles(list, function () { return api.randomAngleDeg(); });
      var changed = false;
      var take = function (target, fresh) {
        ["position_angle_deg", "perihelion_longitude_deg"].forEach(function (key) {
          if (mode === "all" || blank(target[key])) {
            target[key] = fresh[key];
            changed = true;
          }
        });
        target.angle_error = "";
      };
      pushUndo("Randomize all");
      list.forEach(function (body, index) {
        var fresh = next[index];
        if (!fresh || body.kind === "belt") return;
        take(body, fresh);
        (body.moons || []).forEach(function (moon, moonIndex) {
          var freshMoon = (fresh.moons || [])[moonIndex];
          if (!freshMoon || moon.kind === "belt") return;
          take(moon, freshMoon);
        });
      });
      if (!changed) {
        undoStack.pop();
        if (undoButton) undoButton.disabled = !undoStack.length;
        setStatus("Every angle is already set. Nothing changed.");
        return;
      }
      renderStack();
      saveLocal();
      setStatus(mode === "all" ? "Replaced every angle. Undo brings the old ones back." : "Filled the blank angles. Existing angles were kept.");
    };
    if (!withAngles.length) { run("all"); return; }
    ask("Randomize angles?",
      [withAngles.length + (withAngles.length === 1 ? " body already has" : " bodies already have") + " angles." +
        (locked.length ? " Locked in the file: " + locked.join(", ") + "." : ""),
        "Filling only blank angles keeps every existing one."],
      [{ key: "blank", label: "Fill blank angles only" },
        { key: "all", label: "Replace all angles" + (locked.length ? ", including locked ones" : "") },
        { key: "cancel", label: "Cancel" }]).then(function (choice) {
      if (choice === "cancel") return;
      run(choice);
    });
  }

  function systemRecord() {
    var link = angleApi();
    if (!link || !link.systemRecordFromManual) throw new Error("The system link did not load.");
    return link.systemRecordFromManual(state.header, bodies());
  }

  function saveFile() {
    var record;
    try { record = systemRecord(); }
    catch (err) {
      setStatus(err.message || "An angle is not a number from 0 to 360.");
      return;
    }
    var text = JSON.stringify(record, null, 2);
    var name = fileStem(state.header.hostname) + ".system.json";
    var write = function (backupName) {
      download(text, name);
      state.opened = { name: name, text: text };
      state.clean = snapshot();
      saveLocal();
      setStatus("Saved " + name + "." + (backupName ? " The file as it was opened is backed up as " + backupName + "." : ""));
    };
    if (!state.opened) {
      write(null);
      return;
    }
    var changes = changeList();
    ask("Save this system?",
      ["Saving writes " + name + ". A backup first saves " + state.opened.name + " as it was opened, under a dated name.",
        changes.length ? "These are the changes since it was opened:" : "Nothing has changed since it was opened."],
      BACKUP_CHOICES, changes).then(function (choice) {
      if (choice === "cancel") { setStatus("Not saved."); return; }
      write(choice === "backup" ? backupOpened() : null);
    });
  }

  function focusLinkedObject(data, objectId) {
    var link = window.OrbitBuilderLink;
    var target = link ? link.focusTarget(data, objectId) : null;
    var marked = document.querySelectorAll(".deep-link-target");
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove("deep-link-target");
    var host = state.header.hostname || "the system";
    if (!target) {
      setStatus("Opened " + host + ". That object is not in the file.");
      return;
    }
    var el = target.kind === "star" ? starCard : stack.querySelector(target.selector);
    if (!el) {
      setStatus("Opened " + host + ". That object is not on the page.");
      return;
    }
    el.classList.add("deep-link-target");
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
    if (target.kind === "star") {
      setStatus("Opened " + host + ". The star is selected.");
      return;
    }
    var named = (data.bodies || []).find(function (body) { return body.id === target.id; });
    setStatus("Opened " + host + ". " + ((named && named.name) || target.id) + " is selected.");
  }

  // Reads a whole system file without touching the editor. Throws with a
  // reason the user can read when the file cannot be opened.
  function readSystem(text) {
    var data;
    try { data = JSON.parse(text); }
    catch (err) { throw new Error("That file is not valid JSON."); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("That file is not a system JSON.");
    var link = window.OrbitBuilderLink;
    // Cards show a moon's own period. An older link script has only
    // manualBodyFromSystem.
    var card = link && (link.manualCardFromSystem || link.manualBodyFromSystem);
    if (!link || !link.checkSystem || !card) throw new Error("The system link did not load.");
    link.checkSystem(data);
    var header = Object.assign(blankHeader(), link.manualHeaderFromSystem(data));
    var list = (data.bodies || []).map(function (body) {
      var next = card(body);
      next.id = next.id || uid();
      next.moons = (next.moons || []).map(function (moon) {
        var mapped = card(moon);
        mapped.id = mapped.id || uid();
        return mapped;
      });
      return next;
    });
    return { data: data, header: header, bodies: list };
  }

  // Puts a system that readSystem accepted into the editor.
  function applySystem(read, opened, options) {
    var opts = options || {};
    state.header = read.header;
    search.value = state.header.hostname;
    refreshHz();
    state.rows = O.withZones(read.bodies, state.hz, mass());
    paintStar();
    renderStack();
    state.opened = opened || null;
    state.clean = snapshot();
    state.starClean = starFacts();
    if (opts.persist !== false) saveLocal();
    if (opts.objectId) focusLinkedObject(read.data, opts.objectId);
    else if (opts.persist === false) setStatus("Opened " + (state.header.hostname || "the system") + ".");
  }

  function loadSystem(text, options) {
    applySystem(readSystem(text), (options && options.opened) || null, options);
  }

  // ---- Keeping work safe ----

  function snapshot() {
    return JSON.stringify({ header: state.header, bodies: bodies() });
  }

  // True when the editor holds work that is not in a file yet.
  function unsavedWork() {
    if (state.clean != null) return snapshot() !== state.clean;
    return hasWork();
  }

  function stamp() {
    var d = new Date();
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + "-" + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
  }

  function baseName(name) {
    return String(name || "system").replace(/\.system\.json$/i, "").replace(/\.json$/i, "");
  }

  // Greek letters common in star names, spelled out for a file name.
  var GREEK = {
    "α": "alf", "β": "bet", "γ": "gam", "δ": "del", "ε": "eps", "ζ": "zet", "η": "eta", "θ": "tet",
    "ι": "iot", "κ": "kap", "λ": "lam", "μ": "mu", "ν": "nu", "ξ": "ksi", "ο": "omi", "π": "pi",
    "ρ": "rho", "σ": "sig", "ς": "sig", "τ": "tau", "υ": "ups", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "ome"
  };

  // A file name the viewers accept (safeSystemFile): ASCII letters, digits,
  // dot, dash, and underscore, starting with a letter or digit.
  function fileStem(name) {
    var text = String(name || "").replace(/[α-ωΑ-Ω]/g, function (c) {
      var spelled = GREEK[c.toLowerCase()];
      return spelled ? spelled + " " : c;
    });
    if (text.normalize) text = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    text = text.replace(/[^A-Za-z0-9.-]+/g, "_").replace(/_+/g, "_").replace(/^[^A-Za-z0-9]+/, "").replace(/[_.-]+$/, "");
    return text || "system";
  }

  // The link is in the page when it is clicked, and the address is kept a
  // while after, so every browser can start the download.
  function download(text, name) {
    var blob = new Blob([text], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      link.remove();
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  // The file exactly as it was opened, under a dated name.
  function backupOpened() {
    if (!state.opened) return null;
    var name = baseName(state.opened.name) + ".backup-" + stamp() + ".system.json";
    download(state.opened.text, name);
    return name;
  }

  // The editor's current work, for when it is about to be replaced.
  function backupWork() {
    var text;
    try { text = JSON.stringify(systemRecord(), null, 2); }
    catch (err) { text = JSON.stringify({ unsaved_builder_draft: JSON.parse(snapshot()) }, null, 2); }
    var name = fileStem(baseName(state.header.hostname || "system")) + ".backup-" + stamp() + ".system.json";
    download(text, name);
    return name;
  }

  function changeList() {
    if (state.clean == null) return [];
    var before;
    try { before = JSON.parse(state.clean); } catch (err) { return []; }
    var lines = [];
    var label = function (body) { return body.name || body.id; };
    Object.keys(state.header).forEach(function (key) {
      if (JSON.stringify(state.header[key]) !== JSON.stringify(before.header[key])) lines.push("Star: " + key.replace(/_/g, " "));
    });
    var compare = function (oldList, newList, prefix) {
      var olds = {};
      oldList.forEach(function (body) { olds[body.id] = body; });
      var seen = {};
      newList.forEach(function (body) {
        seen[body.id] = true;
        var old = olds[body.id];
        if (!old) { lines.push(prefix + "Added " + label(body)); return; }
        var fields = Object.keys(Object.assign({}, old, body)).filter(function (key) {
          return key !== "moons" && key !== "angle_error" && key !== "generated" && JSON.stringify(old[key]) !== JSON.stringify(body[key]);
        });
        if (fields.length) lines.push(prefix + label(body) + ": " + fields.join(", ").replace(/_/g, " "));
        compare(old.moons || [], body.moons || [], prefix + label(body) + " moon ");
      });
      oldList.forEach(function (body) { if (!seen[body.id]) lines.push(prefix + "Removed " + label(body)); });
    };
    compare(before.bodies || [], bodies(), "");
    return lines;
  }

  // A modal question. Resolves with the key of the chosen button. Escape is
  // the same as Cancel.
  function ask(title, lines, choices, list) {
    return new Promise(function (done) {
      var dialog = document.createElement("dialog");
      dialog.className = "ask";
      var heading = document.createElement("h2");
      heading.textContent = title;
      dialog.appendChild(heading);
      lines.forEach(function (line) {
        var p = document.createElement("p");
        p.textContent = line;
        dialog.appendChild(p);
      });
      if (list && list.length) {
        var ul = document.createElement("ul");
        ul.className = "ask-changes";
        list.slice(0, 12).forEach(function (item) {
          var li = document.createElement("li");
          li.textContent = item;
          ul.appendChild(li);
        });
        if (list.length > 12) {
          var more = document.createElement("li");
          more.textContent = "and " + (list.length - 12) + " more";
          ul.appendChild(more);
        }
        dialog.appendChild(ul);
      }
      var row = document.createElement("div");
      row.className = "ask-actions";
      var finished = false;
      var finish = function (key) {
        if (finished) return;
        finished = true;
        if (dialog.open) dialog.close();
        dialog.remove();
        done(key);
      };
      choices.forEach(function (choice) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = choice.label;
        button.addEventListener("click", function () { finish(choice.key); });
        row.appendChild(button);
      });
      dialog.appendChild(row);
      dialog.addEventListener("cancel", function (event) { event.preventDefault(); finish("cancel"); });
      document.body.appendChild(dialog);
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      var first = row.querySelector("button");
      if (first) first.focus();
    });
  }

  var BACKUP_CHOICES = [
    { key: "backup", label: "Back up and continue" },
    { key: "continue", label: "Continue without a backup" },
    { key: "cancel", label: "Cancel" }
  ];

  // Asks before work in the editor is replaced. Resolves true to go ahead.
  function guardReplace(what) {
    if (!unsavedWork()) return Promise.resolve(true);
    return ask("Replace the work in the editor?",
      [what + " replaces the system in the editor, and it has changes that are not in a file.", "A backup saves the current work as a file first."],
      BACKUP_CHOICES, changeList()).then(function (choice) {
      if (choice === "cancel") return false;
      if (choice === "backup") backupWork();
      return true;
    });
  }

  function openSystemText(text, name) {
    var read;
    try { read = readSystem(text); }
    catch (err) {
      var why = String(err.message || "it is not a system JSON").replace(/\.?$/, ".");
      setStatus(name + " was not opened: " + why + " Nothing in the editor changed.");
      return;
    }
    guardReplace("Opening " + name).then(function (go) {
      if (!go) { setStatus(name + " was not opened. Nothing in the editor changed."); return; }
      pushUndo("opening " + name);
      applySystem(read, { name: name, text: text });
      setStatus("Opened " + name + ".");
    });
  }

  function bootDeepLink() {
    var link = window.OrbitBuilderLink;
    if (!link) {
      setStatus("The system link did not load.");
      return;
    }
    var plan = link.parseBuilderHash(location.hash);
    if (plan.mode !== "load") {
      state.fromDeepLink = false;
      if (isStarLink()) bootStarLink();
      else restoreLocal();
      return;
    }
    // A deep-linked system keeps its edits in a draft of its own, so the
    // user's main draft is never replaced by it.
    state.fromDeepLink = true;
    state.linkFile = String(plan.file);
    fetch(plan.file)
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then(function (text) {
        var name = String(plan.file).split(/[\\/]/).pop() || "system.json";
        loadSystem(text, { persist: false, objectId: plan.objectId, opened: { name: name, text: text } });
        offerLinkDraft(name);
      })
      .catch(function () {
        state.fromDeepLink = false;
        state.linkFile = "";
        restoreLocal();
        setStatus("The linked system did not load. The draft on this browser is unchanged.");
      });
  }

  function draftKey() {
    return state.fromDeepLink ? STORE + ":link:" + state.linkFile : STORE;
  }

  function readDraft(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return data && data.header && Array.isArray(data.bodies) ? data : null;
    } catch (err) {
      return null;
    }
  }

  function useDraft(data) {
    state.opened = data.opened && typeof data.opened.text === "string" ? data.opened : null;
    state.clean = typeof data.clean === "string" ? data.clean : null;
    state.starClean = typeof data.starClean === "string" ? data.starClean : null;
    state.header = Object.assign(blankHeader(), data.header);
    search.value = state.header.hostname || "";
    refreshHz();
    state.rows = O.withZones(data.bodies, state.hz, mass());
    paintStar();
    renderStack();
  }

  // Earlier unsaved edits to the same deep-linked file can be brought back.
  function offerLinkDraft(name) {
    var data = readDraft(draftKey());
    if (!data || data.clean !== state.clean) return;
    if (JSON.stringify({ header: data.header, bodies: data.bodies }) === data.clean) return;
    ask("Bring back your edits to " + name + "?",
      ["This browser has edits to " + name + " that were not saved to a file."],
      [{ key: "restore", label: "Bring back my edits" },
        { key: "backup", label: "Back up my edits, then open the file" },
        { key: "continue", label: "Open the file without my edits" }]).then(function (choice) {
      if (choice === "restore") {
        useDraft(data);
        setStatus("Brought back your edits to " + name + ".");
        return;
      }
      if (choice === "backup") {
        var name2 = baseName(name) + ".edits-" + stamp() + ".json";
        download(JSON.stringify(data, null, 2), name2);
        setStatus("Your edits are backed up as " + name2 + ".");
      }
    });
  }

  function saveLocal() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify({ header: state.header, bodies: bodies(), opened: state.opened, clean: state.clean, starClean: state.starClean }));
    } catch (err) {
      setStatus("This browser did not keep the draft (storage is full or blocked). Save the system to a file to keep it.");
    }
  }

  function restoreLocal() {
    var data = readDraft(STORE);
    if (!data) return;
    try {
      useDraft(data);
      setStatus("Restored the system on this browser.");
    } catch (err) { /* ignore a bad draft */ }
  }

  // ---- Star map links (#h=1 or #host=) ----

  function isStarLink() {
    return !!(hashParams().get("host") || hashParams().get("h") === "1");
  }

  function draftHasWork(data) {
    var header = data.header || {};
    var typed = STAR_FACTS.concat(CARD_FIELDS).some(function (key) { return String(header[key] || "").trim() !== ""; });
    return typed || (data.bodies || []).some(bodyHasWork);
  }

  // The link's values go in once. A draft with work is not replaced
  // without asking.
  function bootStarLink() {
    var data = readDraft(STORE);
    if (!data || !draftHasWork(data)) {
      applyLink();
      return;
    }
    try { useDraft(data); } catch (err) { /* show the link anyway */ }
    var host = hashParams().get("host");
    ask("Open " + (host || "the star") + " from the star map?",
      ["Opening the star map link replaces the draft on this browser.", "A backup saves the draft as a file first."],
      BACKUP_CHOICES, []).then(function (choice) {
      if (choice === "cancel") {
        state.linkApplied = true;
        state.linkHostDone = true;
        setStatus("Kept your draft. The star map link was not applied.");
        return;
      }
      if (choice === "backup") backupWork();
      pushUndo("opening the star map link");
      state.header = blankHeader();
      state.rows = [];
      state.opened = null;
      state.clean = null;
      state.starClean = null;
      search.value = "";
      applyLink();
    });
  }

  function applyLink() {
    applyHashOverlay();
    state.linkApplied = true;
    state.linkSnapshot = snapshot();
    if (state.stars.length) applyLinkHost();
  }

  // When the star list has the linked star, fill its facts, then put the
  // link's own values back on top. Skipped once the user has made changes.
  function applyLinkHost() {
    if (!state.linkApplied || state.linkHostDone) return;
    var hashHost = hashParams().get("host");
    if (!hashHost) { state.linkHostDone = true; return; }
    if (snapshot() !== state.linkSnapshot) { state.linkHostDone = true; return; }
    var found = state.stars.find(function (row) {
      return row.hostname === hashHost || row.sy_name === hashHost;
    });
    state.linkHostDone = true;
    if (!found) return;
    applyRow(found);
    applyHashOverlay();
    state.linkSnapshot = snapshot();
  }

  function newSystem() {
    guardReplace("Starting a new system").then(function (go) {
      if (!go) return;
      pushUndo("starting a new system");
      state.header = blankHeader();
      state.opened = null;
      state.clean = null;
      state.starClean = null;
      search.value = "";
      refreshHz();
      state.rows = O.withZones([], state.hz, mass());
      paintStar();
      renderStack();
      saveLocal();
      setStatus("Started a new system. Undo brings the last one back.");
    });
  }

  // The viewers read the system being edited from this key, so it can be seen
  // without saving a file first.
  var VIEW_KEY = "orbit-match-view-system";

  function viewSystem() {
    var record;
    try { record = systemRecord(); }
    catch (err) {
      setStatus((err.message || "The system has a field that is not a number.") + " Fix it to view the system.");
      return;
    }
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(record)); }
    catch (err) {
      setStatus("This browser did not keep the system for the viewer (storage is full or blocked). Save it to a file and open that in the viewer.");
      return;
    }
    window.open("../viewer/?view=svg&source=builder", "_blank", "noopener");
    setStatus("Opened " + (state.header.hostname || "the system") + " in the viewer.");
  }

  // The star map link follows ?jumpgate= and the address this browser
  // remembered, as the viewers do.
  function setPeerLink(cfg) {
    var star = document.getElementById("star-map");
    if (!star) return;
    var web = function (value) {
      try {
        var url = new URL(String(value || ""));
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
      } catch (err) { return ""; }
    };
    var asked = web(new URLSearchParams(location.search).get("jumpgate"));
    var kept = "";
    try {
      if (asked) window.localStorage.setItem("orbit-match-jumpgate", asked);
      else kept = web(window.localStorage.getItem("orbit-match-jumpgate"));
    } catch (err) { kept = ""; }
    var href = asked || kept || (cfg && cfg.pages && cfg.pages.starroute_map) || (cfg && cfg.other_page) || "";
    if (href) star.href = href;
  }

  function wide() {
    return window.matchMedia("(min-width: 900px)").matches;
  }

  stack.addEventListener("input", onStackInput);
  stack.addEventListener("change", onStackInput);
  stack.addEventListener("click", onStackClick);
  starCard.addEventListener("input", readHeader);
  starCard.addEventListener("change", readHeader);
  document.getElementById("add-body").addEventListener("click", addBody);
  document.getElementById("save-system").addEventListener("click", saveFile);
  document.getElementById("randomize-all").addEventListener("click", randomizeAll);
  document.getElementById("new-system").addEventListener("click", newSystem);
  if (undoButton) undoButton.addEventListener("click", undo);
  var viewButton = document.getElementById("view-system");
  if (viewButton) viewButton.addEventListener("click", viewSystem);
  // A new deep link in the address loads that system, after the same
  // question as any other open.
  window.addEventListener("hashchange", function () {
    var link = window.OrbitBuilderLink;
    if (!link || link.parseBuilderHash(location.hash).mode !== "load") return;
    guardReplace("Opening the linked system").then(function (go) {
      if (go) bootDeepLink();
    });
  });
  search.addEventListener("focus", showResults);
  search.addEventListener("input", showResults);
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".finder")) closeResults();
  });
  // Each input is cleared after use, so picking the same file again still
  // fires a change and reopens it.
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { loadStars(String(reader.result), file.name); };
    reader.readAsText(file);
  });
  systemFile.addEventListener("change", function () {
    var file = systemFile.files && systemFile.files[0];
    systemFile.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { openSystemText(String(reader.result), file.name); };
    reader.onerror = function () { setStatus(file.name + " could not be read. Nothing in the editor changed."); };
    reader.readAsText(file);
  });

  stack.addEventListener("pointerdown", function (event) {
    var handle = event.target.closest(".drag");
    var card = event.target.closest("[data-body]");
    if (!handle || !card) return;
    dragId = card.dataset.body;
    stack.setPointerCapture(event.pointerId);
  });
  window.addEventListener("pointermove", function (event) {
    if (!dragId) return;
    var under = document.elementsFromPoint ? document.elementsFromPoint(event.clientX, event.clientY) : [document.elementFromPoint(event.clientX, event.clientY)];
    var target = null;
    for (var i = 0; i < under.length; i++) {
      var node = under[i] && under[i].closest && under[i].closest("[data-body]");
      if (node && node.dataset.body !== dragId) { target = node; break; }
    }
    if (!target) return;
    var rect = target.getBoundingClientRect();
    var after = wide() ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2;
    moveBody(dragId, target.dataset.body, after);
  });
  window.addEventListener("pointerup", function () { dragId = null; });
  window.addEventListener("pointercancel", function () { dragId = null; });

  paintStar();
  renderStack();
  if (hashParams().get("system")) document.addEventListener("DOMContentLoaded", bootDeepLink);
  else if (isStarLink()) bootStarLink();
  else restoreLocal();

  fetch("../config.json")
    .then(function (response) { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
    .then(function (cfg) { setPeerLink(cfg); return fetch(cfg.star_list); })
    .then(function (response) { if (!response.ok) throw new Error(String(response.status)); return response.text(); })
    .then(function (text) {
      if (state.stars.length) return;
      loadStars(text, "the star map list");
    })
    .catch(function () {
      if (!state.stars.length && !state.fromDeepLink) setStatus("The star list did not load. Choose a CSV from the star map.");
    });
})();
