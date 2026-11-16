(function () {
  var star = document.getElementById("star-map");
  var setting = document.getElementById("setting");
  var notes = document.getElementById("notes");

  function webAddress(value) {
    if (!value) return "";
    try {
      var url = new URL(String(value));
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (err) {
      return "";
    }
  }

  // The star map page: ?jumpgate= first (and remembered), then the address
  // this browser remembered. config.json comes last.
  function peerPage() {
    var asked = webAddress(new URLSearchParams(location.search).get("jumpgate"));
    if (asked) {
      try { window.localStorage.setItem("orbit-match-jumpgate", asked); } catch (err) { /* storage blocked */ }
      return asked;
    }
    try { return webAddress(window.localStorage.getItem("orbit-match-jumpgate")); } catch (err) { return ""; }
  }

  fetch("config.json")
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (cfg) {
      var map = cfg.pages && cfg.pages.starroute_map;
      var peer = peerPage();
      if (star && (peer || map || cfg.other_page)) star.href = peer || map || cfg.other_page;
      if (setting && cfg.setting && cfg.setting.lore) setting.href = cfg.setting.lore;
      if (notes && cfg.repos && cfg.repos.orbit_match) notes.href = cfg.repos.orbit_match;
    })
    .catch(function () {});
})();

