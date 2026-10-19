import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSystem, loadView } from '../site/js/schema.js';
import { renderSvg } from '../site/js/render-svg.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(site, rel), 'utf8'));
}

const system = loadSystem(readJson('data/tau-ceti.system.json'));
const view = loadView(readJson('data/tau-ceti.view.json'));
const empire = readJson('themes/empire.json');
const quiet = readJson('themes/quiet.json');
const holo = readJson('themes/holo.json');
const out = path.join(site, 'viewer', 'plates');
fs.mkdirSync(out, { recursive: true });

const plates = [
  ['quiet-empire-system.svg', quiet, 'system'],
  ['holo-empire-system.svg', holo, 'system'],
  ['quiet-empire-kakakiko.svg', quiet, 'tc5'],
  ['holo-empire-kakakiko.svg', holo, 'tc5']
];

plates.forEach(function (plate) {
  const svg = renderSvg(system, view, empire, plate[1], { frame: plate[2] });
  fs.writeFileSync(path.join(out, plate[0]), svg);
});
