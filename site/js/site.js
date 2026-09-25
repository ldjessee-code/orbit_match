(function () {
  var star = document.getElementById("star-map");
  var setting = document.getElementById("setting");
  var notes = document.getElementById("notes");

  fetch("config.json")
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (cfg) {
      var map = cfg.pages && cfg.pages.starroute_map;
      if (star && (map || cfg.other_page)) star.href = map || cfg.other_page;
      if (setting && cfg.setting && cfg.setting.lore) setting.href = cfg.setting.lore;
      if (notes && cfg.repos && cfg.repos.orbit_match) notes.href = cfg.repos.orbit_match;
    })
    .catch(function () {});
})();

