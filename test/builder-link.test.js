const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

test('builder deep link builds, parses, and keeps blank mode', async function () {
  const link = await import('../site/js/builder-link.js');
  const system = readJson('site/data/tau-ceti.system.json');
  assert.equal(link.VIEWER_SYSTEM_ID, 'tau-ceti');
  assert.equal(link.STAR_OBJECT_ID, 'star');
  assert.equal(link.builderHref('tau-ceti', 'tc5'), '../manual/#system=tau-ceti&object=tc5');
  assert.equal(link.builderHref('tau-ceti', 'star'), '../manual/#system=tau-ceti&object=star');
  const body = link.parseBuilderHash('#system=tau-ceti&object=tc5');
  assert.equal(body.mode, 'load');
  assert.equal(body.systemId, 'tau-ceti');
  assert.equal(body.objectId, 'tc5');
  assert.equal(body.file, '../data/tau-ceti.system.json');
  assert.equal(body.focus.kind, 'body');
  assert.equal(body.focus.selector, '[data-body="tc5"]');
  const star = link.parseBuilderHash('#system=tau-ceti&object=star');
  assert.equal(star.mode, 'load');
  assert.equal(star.focus.kind, 'star');
  assert.equal(star.focus.selector, '#star-card');
  const systemOnly = link.parseBuilderHash('#system=tau-ceti');
  assert.equal(systemOnly.mode, 'load');
  assert.equal(systemOnly.objectId, null);
  assert.equal(systemOnly.focus, null);
  assert.equal(link.parseBuilderHash('').mode, 'blank');
  assert.equal(link.parseBuilderHash('#').mode, 'blank');
  assert.equal(link.parseBuilderHash('#host=tau%20Cet&h=1').mode, 'blank');
  assert.equal(link.parseBuilderHash('#system=omega&object=tc5').mode, 'blank');
  assert.equal(link.parseBuilderHash('#system=../secret&object=tc5').mode, 'blank');
  const rejected = link.parseBuilderHash('#system=tau-ceti&object=../tc5');
  assert.equal(rejected.mode, 'load');
  assert.equal(rejected.objectId, null);
  const tc5 = link.focusTarget(system, 'tc5');
  assert.equal(tc5.kind, 'body');
  assert.equal(tc5.id, 'tc5');
  assert.equal(tc5.selector, '[data-body="tc5"]');
  assert.equal(link.focusTarget(system, 'star').kind, 'star');
  assert.equal(link.focusTarget(system, 'missing'), null);
  assert.equal(link.focusTarget(system, '../x'), null);
  const mapped = link.manualBodyFromSystem(system.bodies.find(function (item) { return item.id === 'tc5'; }));
  assert.equal(mapped.id, 'tc5');
  assert.equal(mapped.name, 'Kakakiko');
  assert.equal(mapped.au, '0.71');
  assert.equal(mapped.period, '247.4');
  assert.equal(mapped.unit, 'days');
  const moon = link.manualBodyFromSystem(system.bodies.find(function (item) { return item.id === 'tc5a'; }));
  assert.equal(moon.id, 'tc5a');
  assert.equal(moon.name, 'Shudder');
  assert.equal(moon.au, undefined);
  assert.equal(moon.period, undefined);
  const kept = link.manualBodyFromSystem({
    id: 'x',
    au: '1',
    period: '2',
    unit: 'years',
    orbit: { a_au: 9, period_days: 9 }
  });
  assert.equal(kept.au, '1');
  assert.equal(kept.period, '2');
  assert.equal(kept.unit, 'years');
  const pair = link.cardLinks({
    kind: 'transfer',
    fromId: 'tc5',
    toId: 'tc6',
    fromName: 'Kakakiko',
    toName: 'Croquet Ball'
  });
  assert.equal(pair.length, 2);
  assert.equal(pair[0].href, '../manual/#system=tau-ceti&object=tc5');
  assert.equal(pair[1].href, '../manual/#system=tau-ceti&object=tc6');
  assert.match(pair[0].label, /Kakakiko/);
  assert.match(pair[1].label, /Croquet Ball/);
  assert.match(pair[0].label, /Open/);
  assert.match(pair[1].label, /Orbital Object Details/);
  assert.notEqual(pair[0].objectId, pair[1].objectId);
  const one = link.cardLinks({ kind: 'body', id: 'tc8' });
  assert.equal(one.length, 1);
  assert.equal(one[0].label, 'Open in Orbital Object Details');
  assert.equal(one[0].href, '../manual/#system=tau-ceti&object=tc8');
  const starLink = link.cardLinks({ kind: 'star', id: 'star' });
  assert.equal(starLink.length, 1);
  assert.equal(starLink[0].href, '../manual/#system=tau-ceti&object=star');
  assert.equal(starLink[0].label, 'Open in Orbital Object Details');
});

test('manual page loads a deep link and still restores a blank visit', function () {
  const manual = read('site/manual/manual.js');
  const page = read('site/manual/index.html');
  const css = read('site/manual/manual.css');
  assert.match(page, /builder-link\.js/);
  assert.match(manual, /parseBuilderHash/);
  assert.match(manual, /manualBodyFromSystem/);
  assert.match(manual, /focusTarget/);
  assert.match(manual, /scrollIntoView/);
  assert.match(manual, /deep-link-target/);
  assert.match(manual, /fromDeepLink/);
  assert.match(manual, /persist !== false/);
  assert.match(manual, /restoreLocal/);
  assert.match(manual, /function restoreLocal/);
  assert.match(css, /\.deep-link-target/);
  assert.doesNotMatch(manual, /tau-ceti\.system\.json/);
});
