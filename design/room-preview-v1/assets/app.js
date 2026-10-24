/* Static preview only: tabs, view toggle, dismiss, theme. No data, no network. */
(function () {
  var q = new URLSearchParams(location.search);
  var root = document.documentElement;
  if (q.get("theme") === "dark") root.setAttribute("data-theme", "dark");

  document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark";
      if (dark) root.removeAttribute("data-theme"); else root.setAttribute("data-theme", "dark");
    });
  });

  function selectTab(name) {
    document.querySelectorAll('[role="tab"][data-tab]').forEach(function (t) {
      t.setAttribute("aria-selected", String(t.dataset.tab === name));
    });
    document.querySelectorAll(".panel").forEach(function (p) { p.hidden = p.dataset.panel !== name; });
  }
  document.querySelectorAll('[role="tab"][data-tab]').forEach(function (t) {
    t.addEventListener("click", function () {
      if (t.getAttribute("aria-disabled") === "true") return;
      selectTab(t.dataset.tab);
    });
  });
  if (q.get("tab")) selectTab(q.get("tab"));

  var tr = document.querySelector(".transcript");
  document.querySelectorAll("[data-view]").forEach(function (b) {
    if (b.closest(".transcript")) return;
    b.addEventListener("click", function () {
      if (!tr) return;
      tr.dataset.view = b.dataset.view;
      document.querySelectorAll("[data-view]").forEach(function (x) {
        if (!x.closest(".transcript")) x.setAttribute("aria-pressed", String(x === b));
      });
    });
  });
  if (tr && q.get("view")) {
    var vb = document.querySelector('button[data-view="' + q.get("view") + '"]');
    if (vb) vb.click();
  }

  document.querySelectorAll("[data-dismiss]").forEach(function (b) {
    b.addEventListener("click", function () { b.closest(".banner").hidden = true; });
  });

  var tip = document.querySelector(".tip");
  if (tip && q.get("tip") === "1") tip.classList.add("show");

  var sc = document.querySelector(".scroll");
  if (sc && q.get("scroll") !== "top" && document.querySelector(".seg.interim")) { sc.style.scrollBehavior = "auto"; sc.scrollTop = sc.scrollHeight; }
})();
