(function () {
  var TOPICS = {
    period: {
      title: "Orbital period",
      text: "The time for one trip around the star. Years and days are the same orbit. Changing the unit rewrites the number and leaves the distance where it is."
    },
    unit: {
      title: "Years or days",
      text: "This only changes how the period is written. The distance in AU stays put, and the goldilocks band does not move."
    },
    goldilocks: {
      title: "Goldilocks zone",
      text: "The band comes from the star's luminosity. A body is drawn inside it when its distance from the star falls between the two edges."
    },
    pressure: {
      title: "Surface pressure",
      text: "Atmospheres, where 1 is Earth's air at sea level. Together with the oxygen and carbon dioxide percents, this estimates whether a person can breathe, and which gear would be the lightest that works."
    },
    o2: {
      title: "Oxygen",
      text: "Percent of the air that is oxygen, not the partial pressure. At 1 atmosphere, a normal breath is about 21%."
    },
    co2: {
      title: "Carbon dioxide",
      text: "Percent of the air that is carbon dioxide. A small percent becomes poisonous when the whole atmosphere is thick, because the pressure of that gas rises with the air."
    },
    "moon-period": {
      title: "A moon's period",
      text: "Time for one trip around its planet. It is not the planet's year, and it does not move the planet along the goldilocks band."
    },
    "moon-distance": {
      title: "Distance from the planet",
      text: "Kilometers from the planet, not AU from the star."
    }
  };

  var on = false;

  function pop() {
    var el = document.getElementById("term-pop");
    if (!el) {
      el = document.createElement("div");
      el.id = "term-pop";
      el.className = "term-pop hidden";
      el.setAttribute("role", "dialog");
      document.body.appendChild(el);
    }
    return el;
  }

  function hide() {
    pop().classList.add("hidden");
  }

  function show(topic, x, y) {
    var box = pop();
    box.innerHTML = "<h3>" + topic.title + "</h3><p>" + topic.text + "</p>";
    box.classList.remove("hidden");
    var left = Math.min(Math.max(8, x), window.innerWidth - box.offsetWidth - 8);
    var top = y + 12;
    if (top + box.offsetHeight > window.innerHeight - 8) top = Math.max(8, y - box.offsetHeight - 12);
    box.style.left = left + "px";
    box.style.top = top + "px";
  }

  function setMode(next) {
    on = next;
    document.body.classList.toggle("help-inspect", on);
    var button = document.getElementById("help-mode");
    if (button) button.classList.toggle("is-active", on);
    if (!on) hide();
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("#help-mode");
    if (button) {
      setMode(!on);
      return;
    }
    if (!on) return;
    var hit = event.target.closest("[data-help]");
    if (!hit) {
      hide();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    var topic = TOPICS[hit.getAttribute("data-help")];
    if (!topic) return;
    show(topic, event.clientX, event.clientY);
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMode(false);
  });
})();
