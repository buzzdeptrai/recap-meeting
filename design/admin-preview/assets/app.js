/* Biên bản admin preview: theme, drawer, menu, tabs, segmented, sort, demo toggles. No dependencies. */
(function () {
  var KEY = "bb-theme";
  var root = document.documentElement;
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked */ } }
  function current() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function sync() {
    var dark = current() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối");
      var sun = b.querySelector(".i-sun"), moon = b.querySelector(".i-moon");
      if (sun) sun.style.display = dark ? "" : "none";
      if (moon) moon.style.display = dark ? "none" : "";
    });
  }
  function apply(t, persist) {
    root.setAttribute("data-theme", t);
    if (persist) write(t);
    sync();
  }
  var q = /[?&]theme=(light|dark)/.exec(location.search);
  var saved = q ? q[1] : read();
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  document.addEventListener("DOMContentLoaded", function () {
    sync();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () { apply(current() === "dark" ? "light" : "dark", true); });
    });

    /* Sidebar drawer (< 900px) */
    var menuBtn = document.querySelector(".menu-btn");
    function closeNav() { document.body.classList.remove("nav-open"); if (menuBtn) menuBtn.setAttribute("aria-expanded", "false"); }
    if (menuBtn) menuBtn.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    var scrim = document.querySelector(".scrim");
    if (scrim) scrim.addEventListener("click", closeNav);

    /* User menu */
    var ub = document.querySelector(".userbtn"), um = document.querySelector(".menu");
    function closeMenu() { if (um) { um.hidden = true; ub.setAttribute("aria-expanded", "false"); } }
    if (ub && um) {
      ub.addEventListener("click", function (e) { e.stopPropagation(); var open = um.hidden; um.hidden = !open; ub.setAttribute("aria-expanded", String(open)); });
      document.addEventListener("click", function (e) { if (!um.contains(e.target)) closeMenu(); });
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); closeNav(); } });

    /* Tabs */
    document.querySelectorAll("[role=tablist]").forEach(function (list) {
      var tabs = Array.prototype.slice.call(list.querySelectorAll("[role=tab]"));
      function select(tab) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", String(on));
          t.tabIndex = on ? 0 : -1;
          var p = document.getElementById(t.getAttribute("aria-controls"));
          if (p) p.hidden = !on;
        });
      }
      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () { select(t); });
        t.addEventListener("keydown", function (e) {
          var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!n) return;
          var next = tabs[(i + n + tabs.length) % tabs.length];
          select(next); next.focus();
        });
      });
    });

    /* Segmented single-choice groups */
    document.querySelectorAll(".seg[data-seg]").forEach(function (seg) {
      seg.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        var tgt = seg.getAttribute("data-seg-target");
        if (tgt) document.querySelectorAll("[data-seg-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-seg-pane") !== b.getAttribute("data-value"); });
      });
    });

    /* Sortable tables: th[data-sort="num|text"] with td[data-v] */
    document.querySelectorAll("table").forEach(function (table) {
      var ths = Array.prototype.slice.call(table.querySelectorAll("th[data-sort]"));
      ths.forEach(function (th) {
        var btn = th.querySelector("button"); if (!btn) return;
        btn.addEventListener("click", function () {
          var idx = Array.prototype.indexOf.call(th.parentNode.children, th);
          var dir = th.getAttribute("aria-sort") === "descending" ? "ascending" : "descending";
          ths.forEach(function (x) { x.removeAttribute("aria-sort"); });
          th.setAttribute("aria-sort", dir);
          var body = table.tBodies[0];
          var rows = Array.prototype.slice.call(body.rows);
          var num = th.getAttribute("data-sort") === "num";
          rows.sort(function (a, b) {
            var av = a.cells[idx].getAttribute("data-v") || a.cells[idx].textContent.trim();
            var bv = b.cells[idx].getAttribute("data-v") || b.cells[idx].textContent.trim();
            var r = num ? parseFloat(av) - parseFloat(bv) : av.localeCompare(bv, "vi");
            return dir === "ascending" ? r : -r;
          });
          rows.forEach(function (r) { body.appendChild(r); });
        });
      });
    });

    /* Generic show/hide toggles: [data-toggle="#id"] */
    document.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var el = document.querySelector(b.getAttribute("data-toggle"));
        if (!el) return;
        el.hidden = !el.hidden;
        b.setAttribute("aria-pressed", String(!el.hidden));
      });
    });

    /* Password reveal */
    document.querySelectorAll("[data-reveal]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = document.getElementById(b.getAttribute("data-reveal"));
        var show = i.type === "password";
        i.type = show ? "text" : "password";
        b.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      });
    });

    /* Static demo: "Kiểm tra kết nối" */
    document.querySelectorAll("[data-test-conn]").forEach(function (b) {
      b.addEventListener("click", function () {
        var out = document.getElementById(b.getAttribute("data-test-conn"));
        var label = b.textContent;
        b.disabled = true; b.textContent = "Đang kiểm tra…";
        setTimeout(function () {
          b.disabled = false; b.textContent = label;
          if (out) out.innerHTML = '<span class="pill pill-ok">Kết nối ổn</span> <span class="mono muted">' + b.getAttribute("data-ms") + ' ms</span>';
        }, 900);
      });
    });

    /* Static demo: stop real form submits */
    document.querySelectorAll("form[data-static]").forEach(function (f) { f.addEventListener("submit", function (e) { e.preventDefault(); }); });
  });
})();
