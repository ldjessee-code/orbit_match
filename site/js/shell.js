export function starMapHref(cfg) {
  if (!cfg || typeof cfg !== 'object') return '';
  const pages = cfg.pages && typeof cfg.pages === 'object' ? cfg.pages : {};
  if (pages.starroute_map) return pages.starroute_map;
  if (cfg.other_page) return cfg.other_page;
  return '';
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
      const href = starMapHref(cfg);
      if (star && href) star.href = href;
      const setting = root.getElementById('setting');
      if (setting && cfg.setting && cfg.setting.lore) setting.href = cfg.setting.lore;
      const notes = root.getElementById('notes');
      if (notes && cfg.repos && cfg.repos.orbit_match) notes.href = cfg.repos.orbit_match;
    })
    .catch(function () {});
}
