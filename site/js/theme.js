(function () {
  var key = "starroute-theme";
  var theme = "dim";
  try { theme = localStorage.getItem(key) || "dim"; } catch (err) { /* private mode */ }
  if (theme !== "light" && theme !== "dim" && theme !== "black") theme = "dim";
  document.documentElement.dataset.theme = theme;

  function bind() {
    var select = document.getElementById("color-theme");
    if (!select) return;
    select.value = document.documentElement.dataset.theme || "dim";
    select.addEventListener("change", function () {
      var next = select.value;
      if (next !== "light" && next !== "dim" && next !== "black") next = "dim";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch (err) { /* private mode */ }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
