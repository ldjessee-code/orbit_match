const test = require('node:test');
const assert = require('node:assert/strict');

// v2.41c Shudder, not the abandoned 251,350 km axis.
const SHUDDER_A_KM = 151060;
const SHUDDER_E = 0.2;
const SHUDDER_PERI_KM = 120848;

test('circular 1 AU at t = 0 and mean anomaly 0 is x = 1, y = 0', async function () {
  const { pos } = await import('../site/js/kepler.js');
  const p = pos({ a: 1, e: 0, period_days: 365.25, M0: 0, w: 0 }, 0);
  assert.ok(Math.abs(p.x - 1) < 1e-9, 'x ' + p.x);
  assert.ok(Math.abs(p.y) < 1e-9, 'y ' + p.y);
});

test('Shudder at mean anomaly 0 is at periapsis 120848 km', async function () {
  const { pos } = await import('../site/js/kepler.js');
  const p = pos({ a: SHUDDER_A_KM, e: SHUDDER_E, period_days: 6.607, M0: 0, w: 0 }, 0);
  const distance = Math.hypot(p.x, p.y);
  assert.ok(Math.abs(distance - SHUDDER_PERI_KM) < 1e-6, String(distance));
  assert.equal(SHUDDER_A_KM * (1 - SHUDDER_E), SHUDDER_PERI_KM);
});

test('Hohmann 0.71 to 2.8 AU around 0.78 solar masses is within 1 day of 481', async function () {
  const { hohmannDays } = await import('../site/js/kepler.js');
  const hop = hohmannDays(0.71, 2.8, 0.78);
  assert.ok(Math.abs(hop.days - 481) < 1, String(hop.days));
  assert.ok(hop.dv1_km_s > 8 && hop.dv1_km_s < 8.4, String(hop.dv1_km_s));
  assert.ok(hop.dv2_km_s > 5.5 && hop.dv2_km_s < 5.9, String(hop.dv2_km_s));
});

test('circular orbit speed is the circumference divided by the period', async function () {
  const { vel } = await import('../site/js/kepler.js');
  const period = 365.25;
  const speed = vel({ a: 1, e: 0, period_days: period, M0: 0, w: 0 }, 0);
  const magnitude = Math.hypot(speed.x, speed.y);
  assert.ok(Math.abs(magnitude - (2 * Math.PI / period)) < 1e-6, String(magnitude));
});

test('fusion burn-coast-burn at mean anomaly 0 stays inside a 150 km/s budget', async function () {
  const { pos, fusionMatched } = await import('../site/js/kepler.js');
  const mass = 0.78;
  const year = 365.25;
  const kak = { a: 0.71, e: 0, M0: 0, w: 0, period_days: year * Math.sqrt((0.71 ** 3) / mass) };
  const ball = { a: 2.8, e: 0, M0: 0, w: 0, period_days: year * Math.sqrt((2.8 ** 3) / mass) };
  const xy = function (orbit) {
    return function (t) {
      const p = pos(orbit, t);
      return [p.x, p.y];
    };
  };
  const flown = fusionMatched(xy(kak), xy(ball), 0, 0.01 * 9.80665, 150000, 1.495978707e11);
  // 82 d on the old card used other placeholder angles. This departure is mean anomaly 0.
  assert.ok(Math.abs(flown.days - 58.07) < 0.5, String(flown.days));
  assert.ok(flown.dvUsed <= 150000 + 1, String(flown.dvUsed));
  assert.ok(flown.tb / 86400 > 8.5 && flown.tb / 86400 < 9.2, String(flown.tb));
  assert.equal(typeof flown.at, 'function');
});
