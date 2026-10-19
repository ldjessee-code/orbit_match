const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

const requireFromHere = createRequire(__filename);
const orbit = requireFromHere(path.join('..', 'site', 'manual', 'orbit.js'));

test('YEAR_DAYS is 365.25', function () {
  assert.equal(orbit.YEAR_DAYS, 365.25);
});

test('periodToAu of one year around one solar mass is 1 AU', function () {
  assert.equal(orbit.periodToAu(1, 1), 1);
});

test('goldilocks at one solar luminosity is 0.95 and 1.67 AU', function () {
  const zone = orbit.goldilocks(1);
  assert.equal(zone.inner, 0.95);
  assert.equal(zone.outer, 1.67);
});

test('convertPeriod round-trips a year through days', function () {
  const days = orbit.convertPeriod('1', 'years', 'days');
  assert.equal(days, '365.25');
  assert.equal(orbit.convertPeriod(days, 'days', 'years'), '1');
});

test('airAdvice names a pressure suit below 0.062 atm', function () {
  const thin = orbit.airAdvice(0.05, 21, 0.04);
  assert.equal(thin.aid, 'Pressure suit');
});

test('airAdvice is unaided for 1 atm, 21% O2, and 0.04% CO2', function () {
  const air = orbit.airAdvice(1, 21, 0.04);
  assert.equal(air.aid, 'Unaided');
});

test('parseCsv keeps a comma inside quotes', function () {
  const rows = orbit.parseCsv('hostname,note\nTau,"hello, world"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hostname, 'Tau');
  assert.equal(rows[0].note, 'hello, world');
});
