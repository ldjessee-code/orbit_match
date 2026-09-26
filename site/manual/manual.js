(function () {
  var O = window.OrbitManual;
  var STORE = "orbit-match-manual";
  var state = {
    stars: [],
    source: "",
    header: blankHeader(),
    rows: [],
    hz: null
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
      fuel: "",
      fuel_unit: "",
      arrivals: []
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
      generated: !!generated
    };
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

  function refreshHz() {
    state.hz = O.goldilocks(headerLum());
  }

  function zoneNote() {
    if (!state.hz) return "The goldilocks band appears once the star has a luminosity or a radius and temperature.";
    var a = state.hz.inner.toFixed(2);
    var b = state.hz.outer.toFixed(2);
    return "Goldilocks zone " + a + "–" + b + " AU. The band marks the page once a body has a period or a distance.";
  }

  function paintStar() {
    var color = O.starColor(state.header.spectype, O.num(state.header.teff));
    starCard.style.borderColor = color;
    starCard.style.boxShadow = "0 0 0 1px " + color;
    var host = document.getElementById("host-name");
    var spec = document.getElementById("spec-type");
    if (host) host.textContent = state.header.hostname || "No star yet";
    if (spec) spec.textContent = state.header.spectype || "Spectral type unknown";
    ["setting_name", "spectype", "mass", "lum", "teff", "planets", "concept", "holder", "port", "services", "fuel", "fuel_unit"].forEach(function (key) {
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
    var card = document.createElement("article");
    card.className = "body-card";
    card.dataset.body = body.id;
    card.innerHTML =
      '<div class="card-tools">' +
        '<button type="button" class="drag" aria-label="Drag ' + (body.name || "body") + '">Drag</button>' +
        '<button type="button" data-act="in">Inward</button>' +
        '<button type="button" data-act="out">Outward</button>' +
        '<button type="button" data-act="remove">Remove</button>' +
      "</div>" +
      field("Name", '<input data-field="name" value="' + esc(body.name) + '">') +
      field("Kind", '<select data-field="kind">' + options(body.kind) + "</select>") +
      '<div class="pair">' +
        field("Orbital period", '<input data-field="period" inputmode="decimal" value="' + esc(body.period) + '">') +
        field("Unit", '<select data-field="unit"><option value="years"' + (body.unit === "years" ? " selected" : "") + '>Years</option><option value="days"' + (body.unit === "days" ? " selected" : "") + ">Days</option></select>") +
      "</div>" +
      field("Distance (AU)", '<input data-field="au" inputmode="decimal" value="' + esc(body.au) + '">') +
      (notes.length ? '<p class="warn">' + notes.map(esc).join(" ") + "</p>" : "") +
      "<details><summary>World facts</summary>" +
        field("Gravity", '<input data-field="gravity" value="' + esc(body.gravity) + '">') +
        field("Atmosphere", '<input data-field="atmosphere" value="' + esc(body.atmosphere) + '">') +
        field("Water", '<input data-field="water" value="' + esc(body.water) + '">') +
        field("Temperature", '<input data-field="temperature" value="' + esc(body.temperature) + '">') +
        field("Day length", '<input data-field="day" value="' + esc(body.day) + '">') +
        field("Population", '<input data-field="population" value="' + esc(body.population) + '">') +
        field("Government", '<input data-field="government" value="' + esc(body.government) + '">') +
        field("Tech", '<input data-field="tech" value="' + esc(body.tech) + '">') +
        field("High concept", '<textarea data-field="concept">' + esc(body.concept) + "</textarea>") +
      "</details>";
    return card;
  }

  function options(kind) {
    return ["planet", "moon", "asteroid", "belt", "jumpgate", "station", "staryard"].map(function (name) {
      return '<option value="' + name + '"' + (name === kind ? " selected" : "") + ">" + name + "</option>";
    }).join("");
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function hzLabel(edge) {
    var line = document.createElement("div");
    line.className = "hz-line";
    line.dataset.edge = edge;
    line.textContent = edge === "inner" ? "Goldilocks starts" : "Goldilocks ends";
    return line;
  }

  function renderStack(keep) {
    var focus = keep || null;
    stack.innerHTML = "";
    var parent = stack;
    var gold = null;
    state.rows.forEach(function (row) {
      if (row.type === "hz" && row.edge === "inner") {
        gold = document.createElement("div");
        gold.className = "band band-gold";
        gold.appendChild(hzLabel("inner"));
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

  function edited() {
    return bodies().some(function (body) {
      return body.name || body.period || body.au || body.concept || !body.generated;
    });
  }

  function applyRow(row) {
    state.header.hostname = row.hostname || "";
    state.header.setting_name = state.header.setting_name || "";
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
    var n = Math.max(0, Math.min(40, Math.round(count || 0)));
    var list = [];
    for (var i = 0; i < n; i++) list.push(blankBody("planet", true));
    state.rows = O.withZones(list, state.hz, mass());
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
    while (list.filter(function (body) { return body.kind === "planet"; }).length > n) {
      var idx = -1;
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].kind === "planet" && list[i].generated && !list[i].name && !list[i].period) idx = i;
        if (idx >= 0) break;
      }
      if (idx < 0) break;
      list.splice(idx, 1);
    }
    refreshHz();
    state.rows = O.withZones(list, state.hz, mass());
    renderStack();
    saveLocal();
  }

  function chooseStar(row) {
    if (!row) return;
    if (edited() && !window.confirm("Replace the current bodies with the known planets of " + row.hostname + "?")) return;
    closeResults();
    applyRow(row);
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

  function loadStars(text, source) {
    state.stars = O.parseCsv(text);
    state.source = source;
    setStatus(state.stars.length + " stars from " + source + ". Search for one in the star section.");
    var hashHost = hashParams().get("host");
    if (hashHost && !edited()) {
      var found = state.stars.find(function (row) {
        return row.hostname === hashHost || row.sy_name === hashHost;
      });
      if (found) applyRow(found);
    }
    applyHashOverlay();
  }

  function hashParams() {
    return new URLSearchParams((location.hash || "").replace(/^#/, ""));
  }

  function applyHashOverlay() {
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
    state.header[input.dataset.header] = input.value;
    if (input.dataset.header === "planets") {
      var n = O.num(input.value);
      if (n == null) return;
      setPlanetCount(n);
      return;
    }
    if (input.dataset.header === "lum" || input.dataset.header === "teff" || input.dataset.header === "mass" || input.dataset.header === "spectype") {
      refreshHz();
      paintStar();
      rebuildZones();
    } else {
      paintStar();
      saveLocal();
    }
  }

  function syncOrbit(body, source) {
    if (source === "period" || source === "unit") {
      var au = O.periodToAu(O.periodYears(body), mass());
      body.au = au == null ? "" : String(Math.round(au * 1000) / 1000);
    } else if (source === "au") {
      var years = O.auToPeriodYears(body.au, mass());
      if (years == null) body.period = "";
      else if (body.unit === "days") body.period = String(Math.round(years * O.YEAR_DAYS * 10) / 10);
      else body.period = String(Math.round(years * 1000) / 1000);
    }
  }

  function onStackInput(event) {
    var input = event.target.closest("[data-field]");
    var card = event.target.closest("[data-body]");
    if (!input || !card) return;
    var body = bodies().find(function (item) { return item.id === card.dataset.body; });
    if (!body) return;
    body[input.dataset.field] = input.value;
    if (input.dataset.field === "generated") return;
    body.generated = false;
    if (input.dataset.field === "period" || input.dataset.field === "unit" || input.dataset.field === "au") {
      syncOrbit(body, input.dataset.field);
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
      state.rows = state.rows.filter(function (row) {
        return !(row.type === "body" && row.body.id === id);
      });
      rebuildZones();
      return;
    }
    if (act.dataset.act === "in") shiftBody(id, -1);
    if (act.dataset.act === "out") shiftBody(id, 1);
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

  function systemRecord() {
    return {
      orbit_match: 1,
      kind: "system",
      star: {
        hostname: state.header.hostname,
        setting_name: state.header.setting_name,
        spectype: state.header.spectype,
        mass_solar: O.num(state.header.mass),
        lum_log: O.num(state.header.lum),
        teff_k: O.num(state.header.teff),
        radius_solar: O.num(state.header.rad),
        x_ly: O.num(state.header.x),
        y_ly: O.num(state.header.y),
        z_ly: O.num(state.header.z)
      },
      known_planet_count: O.num(state.header.planets),
      card: {
        high_concept: state.header.concept,
        port: state.header.port || null,
        services: state.header.services ? state.header.services.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
        holder: state.header.holder,
        fuel: state.header.fuel,
        fuel_unit: state.header.fuel_unit
      },
      arrivals: (state.header.arrivals || []).map(function (host) { return { from_hostname: host, route_id: "" }; }),
      bodies: bodies()
    };
  }

  function saveFile() {
    var blob = new Blob([JSON.stringify(systemRecord(), null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    var name = (state.header.hostname || "system").replace(/[^\w.-]+/g, "_");
    link.href = URL.createObjectURL(blob);
    link.download = name + ".system.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function loadSystem(text) {
    var data = JSON.parse(text);
    var star = data.star || {};
    state.header = blankHeader();
    state.header.hostname = star.hostname || "";
    state.header.setting_name = star.setting_name || "";
    state.header.spectype = star.spectype || "";
    state.header.mass = star.mass_solar == null ? "" : String(star.mass_solar);
    state.header.lum = star.lum_log == null ? "" : String(star.lum_log);
    state.header.teff = star.teff_k == null ? "" : String(star.teff_k);
    state.header.rad = star.radius_solar == null ? "" : String(star.radius_solar);
    state.header.x = star.x_ly == null ? "" : String(star.x_ly);
    state.header.y = star.y_ly == null ? "" : String(star.y_ly);
    state.header.z = star.z_ly == null ? "" : String(star.z_ly);
    state.header.planets = data.known_planet_count == null ? "" : String(data.known_planet_count);
    var card = data.card || {};
    state.header.concept = card.high_concept || "";
    state.header.port = card.port || "";
    state.header.services = (card.services || []).join(", ");
    state.header.holder = card.holder || "";
    state.header.fuel = card.fuel || "";
    state.header.fuel_unit = card.fuel_unit || "";
    state.header.arrivals = (data.arrivals || []).map(function (item) { return item.from_hostname; });
    search.value = state.header.hostname;
    var list = (data.bodies || []).map(function (body) {
      body.id = body.id || uid();
      return body;
    });
    refreshHz();
    state.rows = O.withZones(list, state.hz, mass());
    paintStar();
    renderStack();
    saveLocal();
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ header: state.header, bodies: bodies() }));
    } catch (err) { /* private mode */ }
  }

  function restoreLocal() {
    if (hashParams().get("host") || hashParams().get("h") === "1") return;
    var raw = localStorage.getItem(STORE);
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      if (!data.header || !data.bodies) return;
      state.header = data.header;
      search.value = state.header.hostname || "";
      refreshHz();
      state.rows = O.withZones(data.bodies, state.hz, mass());
      paintStar();
      renderStack();
      setStatus("Restored the system on this browser.");
    } catch (err) { /* ignore a bad draft */ }
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
  search.addEventListener("focus", showResults);
  search.addEventListener("input", showResults);
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".finder")) closeResults();
  });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { loadStars(String(reader.result), file.name); };
    reader.readAsText(file);
  });
  systemFile.addEventListener("change", function () {
    var file = systemFile.files && systemFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { loadSystem(String(reader.result)); setStatus("Opened " + file.name + "."); }
      catch (err) { setStatus("That file is not a system JSON."); }
    };
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
  restoreLocal();

  fetch("../config.json")
    .then(function (response) { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
    .then(function (cfg) { return fetch(cfg.star_list); })
    .then(function (response) { if (!response.ok) throw new Error(String(response.status)); return response.text(); })
    .then(function (text) {
      if (state.stars.length) return;
      loadStars(text, "the star map list");
    })
    .catch(function () {
      if (!state.stars.length) setStatus("The star list did not load. Choose a CSV from the star map.");
    });

  if (hashParams().get("host") || hashParams().get("h") === "1") applyHashOverlay();
})();
