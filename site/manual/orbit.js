(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OrbitManual = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var YEAR_DAYS = 365.25;

  function num(value) {
    if (value == null) return null;
    var text = String(value).trim();
    if (!text) return null;
    var n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var quoted = false;
    var i;
    for (i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            quoted = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        quoted = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c !== "\r") {
        field += c;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) return [];
    var headers = rows[0];
    var out = [];
    for (i = 1; i < rows.length; i++) {
      if (rows[i].length === 1 && rows[i][0] === "") continue;
      var obj = {};
      for (var cix = 0; cix < headers.length; cix++) obj[headers[cix]] = rows[i][cix] || "";
      if (obj.hostname) out.push(obj);
    }
    return out;
  }

  function luminosity(row) {
    var logL = num(row && (row.st_lum != null ? row.st_lum : row.lum_log));
    if (logL != null) return Math.pow(10, logL);
    var linear = num(row && row.lum_solar);
    if (linear != null && linear > 0) return linear;
    var radius = num(row && (row.st_rad != null ? row.st_rad : row.radius));
    var teff = num(row && (row.st_teff != null ? row.st_teff : row.teff_k));
    if (radius != null && radius > 0 && teff != null && teff > 0) {
      var t = teff / 5772;
      return radius * radius * t * t * t * t;
    }
    return null;
  }

  function goldilocks(lum) {
    if (lum == null || lum <= 0) return null;
    var root = Math.sqrt(lum);
    return { inner: 0.95 * root, outer: 1.67 * root };
  }

  function starColor(spectype, teff) {
    var s = String(spectype || "").toUpperCase();
    var letter = (s.match(/[OBAFGKMLTY]/) || [""])[0];
    if (!letter && teff) {
      if (teff >= 30000) letter = "O";
      else if (teff >= 10000) letter = "B";
      else if (teff >= 7500) letter = "A";
      else if (teff >= 6000) letter = "F";
      else if (teff >= 5200) letter = "G";
      else if (teff >= 3700) letter = "K";
      else letter = "M";
    }
    var dwarf = /(?<!I)V/.test(s);
    if (letter === "O" || letter === "B") return dwarf ? "#6eb6ff" : "#3d9bff";
    if (letter === "A") return "#d5e4ff";
    if (letter === "F") return "#f4f0dc";
    if (letter === "G") return "#e6c56a";
    if (letter === "K") return "#e08a3c";
    if (letter === "M" || letter === "L") return dwarf || !/III|II|IV/.test(s) ? "#8f2430" : "#c4473c";
    if (letter === "T" || letter === "Y") return "#6a4038";
    return "#8fd0a8";
  }

  function periodYears(body) {
    var p = num(body && body.period);
    if (p == null || p <= 0) return null;
    return body.unit === "days" ? p / YEAR_DAYS : p;
  }

  function periodToAu(periodYear, mass) {
    if (periodYear == null || periodYear <= 0) return null;
    var m = num(mass);
    if (m == null || m <= 0) m = 1;
    return Math.pow(periodYear * periodYear * m, 1 / 3);
  }

  function auToPeriodYears(au, mass) {
    var a = num(au);
    if (a == null || a <= 0) return null;
    var m = num(mass);
    if (m == null || m <= 0) m = 1;
    return Math.sqrt(a * a * a / m);
  }

  function bodyAu(body, mass) {
    var direct = num(body && body.au);
    if (direct != null && direct > 0) return direct;
    return periodToAu(periodYears(body), mass);
  }

  function placeHz(bodies, hz, mass) {
    if (!hz) return null;
    var inner = bodies.length;
    var outer = bodies.length;
    var saw = false;
    for (var i = 0; i < bodies.length; i++) {
      var au = bodyAu(bodies[i], mass);
      if (au == null) continue;
      saw = true;
      if (inner === bodies.length && au >= hz.inner) inner = i;
      if (au >= hz.outer) {
        outer = i;
        break;
      }
    }
    if (!saw) return null;
    if (outer < inner) outer = inner;
    return { inner: inner, outer: outer };
  }

  function withZones(bodies, hz, mass) {
    var place = placeHz(bodies, hz, mass);
    var rows = [];
    if (!place) {
      if (hz) {
        rows.push({ type: "hz", edge: "inner" });
        rows.push({ type: "hz", edge: "outer" });
      }
      for (var n = 0; n < bodies.length; n++) rows.push({ type: "body", body: bodies[n] });
      return rows;
    }
    for (var i = 0; i <= bodies.length; i++) {
      if (i === place.inner) rows.push({ type: "hz", edge: "inner" });
      if (i === place.outer) rows.push({ type: "hz", edge: "outer" });
      if (i < bodies.length) rows.push({ type: "body", body: bodies[i] });
    }
    return rows;
  }

  function visualZones(rows) {
    var zone = "inner";
    var map = {};
    rows.forEach(function (row) {
      if (row.type === "hz" && row.edge === "inner") zone = "gold";
      else if (row.type === "hz" && row.edge === "outer") zone = "outer";
      else if (row.type === "body") map[row.body.id] = zone;
    });
    return map;
  }

  function physicalZone(au, hz) {
    if (au == null || !hz) return null;
    if (au < hz.inner) return "inner";
    if (au > hz.outer) return "outer";
    return "gold";
  }

  function warningsFor(body, prev, next, visual, hz, mass) {
    var notes = [];
    var p = periodYears(body);
    var pNext = next ? periodYears(next) : null;
    var pPrev = prev ? periodYears(prev) : null;
    if (p != null && pNext != null && p > pNext) {
      notes.push("This period is longer than the next body outward. A round orbit would reach past it, so this orbit would be elongated.");
    }
    if (p != null && pPrev != null && p < pPrev) {
      notes.push("This period is shorter than the next body inward. A round orbit would sit closer to the star than that body.");
    }
    var au = bodyAu(body, mass);
    var physical = physicalZone(au, hz);
    if (physical && visual && physical !== visual) {
      if (physical === "gold") {
        notes.push("This distance sits in the goldilocks zone. The card is outside that band.");
      } else if (visual === "gold") {
        notes.push("This distance sits outside the goldilocks zone. The card is inside that band.");
      } else {
        notes.push("This distance does not agree with where the card sits relative to the goldilocks zone.");
      }
    }
    return notes;
  }

  return {
    YEAR_DAYS: YEAR_DAYS,
    num: num,
    parseCsv: parseCsv,
    luminosity: luminosity,
    goldilocks: goldilocks,
    starColor: starColor,
    periodYears: periodYears,
    periodToAu: periodToAu,
    auToPeriodYears: auToPeriodYears,
    bodyAu: bodyAu,
    placeHz: placeHz,
    withZones: withZones,
    visualZones: visualZones,
    physicalZone: physicalZone,
    warningsFor: warningsFor
  };
});
