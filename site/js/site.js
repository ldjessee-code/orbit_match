(function () {
  var cfg = window.ORBIT_MATCH || {};
  var link = document.getElementById("star-map");
  if (link && cfg.other_page) {
    link.href = cfg.other_page;
  }
})();
