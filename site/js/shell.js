export function starMapHref(cfg) {
  if (!cfg || typeof cfg !== 'object') return '';
  const pages = cfg.pages && typeof cfg.pages === 'object' ? cfg.pages : {};
  if (pages.starroute_map) return pages.starroute_map;
  if (cfg.other_page) return cfg.other_page;
  return '';
}

const PEER_KEY = 'orbit-match-jumpgate';

function webAddress(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (err) {
    return '';
  }
}

// The star map page: ?jumpgate= first (and remembered), then the address this
// browser remembered, then config.json.
export function peerPage(search, cfg) {
  const asked = webAddress(new URLSearchParams(search || '').get('jumpgate'));
  if (asked) {
    try { window.localStorage.setItem(PEER_KEY, asked); } catch (err) { /* storage blocked */ }
    return asked;
  }
  let kept = '';
  try { kept = webAddress(window.localStorage.getItem('orbit-match-jumpgate')); } catch (err) { kept = ''; }
  return kept || starMapHref(cfg);
}

export function applyShell(doc) {
  const root = doc || document;
  return fetch(new URL('../config.json', import.meta.url))
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (cfg) {
      const star = root.getElementById('star-map');
      const href = peerPage(window.location.search, cfg);
      if (star && href) star.href = href;
      const setting = root.getElementById('setting');
      if (setting && cfg.setting && cfg.setting.lore) setting.href = cfg.setting.lore;
      const notes = root.getElementById('notes');
      if (notes && cfg.repos && cfg.repos.orbit_match) notes.href = cfg.repos.orbit_match;
    })
    .catch(function () {});
}
