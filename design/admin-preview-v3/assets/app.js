/* Biên bản admin preview v3: drawer, sample data, SVG charts, usage controls. All prices are examples ("ví dụ"). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function nf(v, d) { return v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- drawer ---------- */
  var side = $('#sidebar'), scrim = $('.scrim'), menu = $('.menu');
  function drawer(open) {
    if (!side) return;
    side.classList.toggle('open', open); scrim.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', open);
    if (open) { var a = $('a', side); a && a.focus(); } else if (document.activeElement && side.contains(document.activeElement)) menu.focus();
  }
  if (menu) {
    menu.addEventListener('click', function () { drawer(!side.classList.contains('open')); });
    scrim.addEventListener('click', function () { drawer(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') drawer(false); });
  }

  /* ---------- sample data (Oct 2026, 22 days) ---------- */
  var DG = [1.34,3.49,0,0,1.65,2.35,3.18,1.91,2.54,0,0,1.07,3.22,2.88,2.07,3.03,1.11,0,0.8,1.74,2.1,2.11];
  var OP = [0.17,0.31,0.22,0,0.11,0.26,0.36,0.33,0.29,0.16,0,0.07,0.28,0.39,0.32,0.33,0.27,0.07,0.05,0.16,0.25,0.25];
  var GE = [0.02,0.06,0,0,0.03,0.03,0.05,0.04,0.05,0,0,0.02,0.06,0.05,0.03,0.06,0.02,0,0.01,0.03,0.03,0.04];
  var MEET = [2,3,0,0,2,3,3,2,3,0,0,1,3,3,2,3,1,0,1,2,2,2];
  function mul(a, k) { return a.map(function (v) { return v * k; }); }
  function pre(a) { return a.slice(2, 10).map(function (v) { return v * 0.88; }).concat(a); } // 8 earlier days -> 30
  var ATOMS = [
    { vendor: 'Deepgram', model: 'nova-3 · trực tiếp', service: 'Chép lời trực tiếp', cost: mul(DG, 31.65 / 36.59), tot: { cost: 31.65, sec: 246600, tin: 0, tout: 0, calls: 47 } },
    { vendor: 'Deepgram', model: 'nova-3 · chép lại', service: 'Chép lại sau họp', cost: mul(DG, 4.94 / 36.59), tot: { cost: 4.94, sec: 38520, tin: 0, tout: 0, calls: 14 } },
    { vendor: 'OpenAI', model: 'gpt-4.1', service: 'Tạo biên bản', cost: mul(OP, 4.30 / 4.65), tot: { cost: 4.30, sec: 0, tin: 1310000, tout: 210000, calls: 46 } },
    { vendor: 'Gemini', model: 'gemini-3.1-flash-lite', service: 'Dịch trực tiếp', cost: GE.slice(), tot: { cost: 0.63, sec: 0, tin: 3840000, tout: 620000, calls: 5210 } },
    { vendor: 'OpenAI', model: 'gpt-4.1-mini', service: 'Dịch trực tiếp', cost: mul(OP, 0.35 / 4.65), tot: { cost: 0.35, sec: 0, tin: 520000, tout: 90000, calls: 177 } }
  ];
  ATOMS.forEach(function (a) {
    var ct = a.cost.reduce(function (s, v) { return s + v; }, 0);
    a.cost = pre(a.cost);
    a.rate = {}; ['cost', 'sec', 'tin', 'tout', 'calls'].forEach(function (m) { a.rate[m] = m === 'cost' ? 1 : a.tot[m] / ct; });
  });
  var DAYS30 = [];
  for (var i = 0; i < 30; i++) { var d = new Date(2026, 9, 22 - 29 + i); DAYS30.push(d.getDate() + '/' + (d.getMonth() + 1)); }
  var HOURS = pre(DG).map(function (c) { return c * (285120 / 3600) / 36.59 * 1; }); // chép lời giờ/ngày (30)

  /* ---------- chart helpers ---------- */
  function mono(pts) { // monotone cubic, returns C segments (starts after the first point)
    var n = pts.length, dx = [], m = [], t = [], s = '';
    if (n < 2) return '';
    for (var i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { var k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    for (i = 0; i < n - 1; i++) {
      var x1 = pts[i][0] + dx[i] / 3, x2 = pts[i + 1][0] - dx[i] / 3;
      s += 'C' + x1.toFixed(1) + ' ' + (pts[i][1] + t[i] * dx[i] / 3).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + (pts[i + 1][1] - t[i + 1] * dx[i] / 3).toFixed(1) + ' ' + pts[i + 1][0].toFixed(1) + ' ' + pts[i + 1][1].toFixed(1);
    }
    return s;
  }
  function line(pts) { return 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1) + mono(pts); }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 6 ? 6 : f <= 8 ? 8 : 10) * p; }
  function gradient(defs, id, color, top, bot) {
    var g = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': top }, g);
    el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': bot }, g);
  }
  function mount(box, h, draw) { // re-render on resize
    function go() { var w = Math.max(box.clientWidth, 260); draw(w, h); }
    go(); var last = box.clientWidth;
    if (window.ResizeObserver) new ResizeObserver(function () { if (Math.abs(box.clientWidth - last) > 2) { last = box.clientWidth; go(); } }).observe(box);
  }
  function frame(box, w, h) {
    box.querySelectorAll('svg').forEach(function (s) { s.remove(); });
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img' });
    box.insertBefore(svg, box.firstChild); return svg;
  }
  function xLabels(svg, labels, x, y, every, anchor) {
    labels.forEach(function (l, i) { if (i % every === 0 || i === labels.length - 1) { var t = el('text', { x: x(i), y: y, 'text-anchor': 'middle', 'class': 'ax' }, svg); t.textContent = l; } });
  }

  /* ---------- dashboard ---------- */
  var DAYS22 = DAYS30.slice(8);
  var cost22 = DG.map(function (v, i) { return v * 1 + OP[i] + GE[i]; });
  function lineChart(box) {
    var h = 440;
    mount(box, h, function (w) {
      h = w < 400 ? 300 : 440;
      var svg = frame(box, w, h), defs = el('defs', {}, svg), L = 36, R = 36, T = 12, B = 32, iw = w - L - R, ih = h - T - B;
      gradient(defs, 'ap', '#FF0080', .28, 0); gradient(defs, 'an', '#3A416F', .12, 0);
      el('linearGradient', { id: 'lp' }, defs);
      var max = 4, x = function (i) { return L + iw * i / 21; }, y = function (v) { return T + ih - ih * v / max; };
      for (var g = 0; g <= 4; g++) {
        el('line', { x1: L, x2: w - R, y1: y(g), y2: y(g), 'class': 'grid-l' }, svg);
        var a = el('text', { x: L - 10, y: y(g) + 4, 'text-anchor': 'end', 'class': 'ax' }, svg); a.textContent = g;
        var b = el('text', { x: w - R + 10, y: y(g) + 4, 'text-anchor': 'start', 'class': 'ax' }, svg); b.textContent = '$' + g * 2;
      }
      [[cost22, 'ap', '#FF0080', .5], [MEET, 'an', '#3A416F', 1]].forEach(function (s) {
        var pts = s[0].map(function (v, i) { return [x(i), y(v * s[3])]; });
        el('path', { d: line(pts) + 'L' + x(21) + ' ' + y(0) + 'L' + x(0) + ' ' + y(0) + 'Z', fill: 'url(#' + s[1] + ')' }, svg);
        el('path', { d: line(pts), fill: 'none', stroke: s[2], 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
        el('circle', { cx: x(21), cy: y(s[0][21] * s[3]), r: 5, fill: '#fff', stroke: s[2], 'stroke-width': 3 }, svg);
      });
      xLabels(svg, DAYS22, x, h - 8, 3);
      svg.setAttribute('aria-label', 'Biểu đồ đường: số cuộc họp và chi phí ước tính mỗi ngày, 1 đến 22 tháng 10');
    });
  }
  function barChart(box) {
    var h = 220, data = HOURS.slice(8);
    mount(box, h, function (w) {
      var svg = frame(box, w, h), L = 28, T = 8, B = 28, iw = w - L, ih = h - T - B, max = 8, n = 22, step = iw / n, bw = Math.max(5, Math.min(14, step * .56));
      var y = function (v) { return T + ih - ih * v / max; };
      for (var g = 0; g <= 8; g += 2) {
        el('line', { x1: L, x2: w, y1: y(g), y2: y(g), 'class': 'grid-l' }, svg);
        var t = el('text', { x: 0, y: y(g) + 4, 'class': 'ax' }, svg); t.textContent = g;
      }
      data.forEach(function (v, i) {
        var bh = Math.max(v > 0 ? 4 : 0, ih * v / max);
        if (bh) el('rect', { x: L + step * i + (step - bw) / 2, y: T + ih - bh, width: bw, height: bh, rx: bw / 2, fill: '#fff', opacity: .95 }, svg);
      });
      xLabels(svg, DAYS22, function (i) { return L + step * i + step / 2; }, h - 6, w < 420 ? 6 : 3);
      svg.setAttribute('aria-label', 'Biểu đồ cột: giờ chép lời mỗi ngày, tổng 79,2 giờ');
    });
  }

  /* ---------- usage ---------- */
  var COLORS = ['#7928CA', '#FF0080', '#3A416F', '#17C1E8', '#A8B8D8'];
  var M = { cost: { label: 'Chi phí (ví dụ)', f: function (v) { return '$' + nf(v, 2); }, axis: function (v) { return '$' + nf(v, v % 1 ? 1 : 0); } },
    sec: { label: 'Giờ chép lời', f: function (v) { return nf(v / 3600, 1) + ' giờ'; }, axis: function (v) { return nf(v / 3600, 0) + ' giờ'; } },
    tok: { label: 'Token', f: function (v) { return v >= 1e6 ? nf(v / 1e6, 2) + ' triệu' : v >= 1e3 ? nf(v / 1e3, 0) + ' nghìn' : nf(v, 0); }, axis: function (v) { return v >= 1e6 ? nf(v / 1e6, 1) + 'tr' : nf(v / 1e3, 0) + 'k'; } },
    calls: { label: 'Lượt gọi', f: function (v) { return nf(Math.round(v), 0); }, axis: function (v) { return v >= 1000 ? nf(v / 1000, 0) + 'k' : nf(v, 0); } } };
  var DELTA = { 7: { cost: 4.2, sec: 2.9, tok: 6.8, calls: 3.1 }, 30: { cost: 9.4, sec: 6.1, tok: 12.3, calls: 4.8 }, 0: { cost: 15.9, sec: 13.4, tok: 19.4, calls: 10.7 } };
  var RANGES = { 7: 7, 30: 30, 0: 22 };
  var state = { range: 0, group: 'vendor', metric: 'cost' };
  var GROUP_TITLE = { vendor: 'Theo nhà cung cấp', model: 'Theo model', service: 'Theo dịch vụ' };
  var RANGE_TXT = { 7: '16/10 – 22/10/2026', 30: '23/09 – 22/10/2026', 0: '01/10 – 22/10/2026' };

  function val(a, m, i) { return m === 'tok' ? a.cost[i] * (a.rate.tin + a.rate.tout) : a.cost[i] * a.rate[m]; }
  function groups() {
    var keys = [], map = {};
    ATOMS.forEach(function (a) { var k = a[state.group]; if (!map[k]) { map[k] = []; keys.push(k); } map[k].push(a); });
    return keys.map(function (k, i) { return { key: k, atoms: map[k], color: COLORS[i % COLORS.length] }; });
  }
  function series(g, m, n) { var out = []; for (var i = 30 - n; i < 30; i++) out.push(g.atoms.reduce(function (s, a) { return s + val(a, m, i); }, 0)); return out; }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }

  function stacked(box, tip) {
    var gs = groups(), n = RANGES[state.range], m = state.metric, labels = DAYS30.slice(30 - n);
    var ser = gs.map(function (g) { return series(g, m, n); });
    var totals = labels.map(function (_, i) { return ser.reduce(function (s, a) { return s + a[i]; }, 0); });
    var u = m === 'sec' ? 3600 : 1, max = niceMax(Math.max.apply(null, totals) * 1.05 / u) * u, h = 280;
    mount(box, h, function (w) {
      var svg = frame(box, w, h), defs = el('defs', {}, svg), L = 44, R = 8, T = 12, B = 32, iw = w - L - R, ih = h - T - B;
      var x = function (i) { return L + iw * i / (n - 1); }, y = function (v) { return T + ih - ih * v / max; };
      for (var g = 0; g <= 4; g++) {
        el('line', { x1: L, x2: w - R, y1: y(max * g / 4), y2: y(max * g / 4), 'class': 'grid-l' }, svg);
        var t = el('text', { x: L - 10, y: y(max * g / 4) + 4, 'text-anchor': 'end', 'class': 'ax' }, svg); t.textContent = M[m].axis(max * g / 4);
      }
      var cum = labels.map(function () { return 0; }), layers = [];
      ser.forEach(function (s, k) {
        var bot = cum.slice(); cum = cum.map(function (c, i) { return c + s[i]; });
        layers.push({ top: cum.map(function (c, i) { return [x(i), y(c)]; }), bot: bot.map(function (c, i) { return [x(i), y(c)]; }) });
        gradient(defs, 'sg' + k, gs[k].color, .85, .55);
      });
      layers.slice().reverse().forEach(function (L2, ri) {
        var k = layers.length - 1 - ri, rb = L2.bot.slice().reverse();
        el('path', { d: line(L2.top) + 'L' + rb[0][0] + ' ' + rb[0][1] + mono(rb) + 'Z', fill: 'url(#sg' + k + ')' }, svg);
        el('path', { d: line(L2.top), fill: 'none', stroke: gs[k].color, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
      });
      xLabels(svg, labels, x, h - 8, n > 22 ? 5 : n > 10 ? 3 : 1);
      var cur = el('line', { y1: T, y2: T + ih, stroke: '#7928CA', 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: 0 }, svg);
      var hit = el('rect', { x: L, y: T, width: iw, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Vùng biểu đồ, dùng phím mũi tên trái phải để xem từng ngày' }, svg);
      var idx = -1;
      function show(i) {
        i = Math.max(0, Math.min(n - 1, i)); idx = i;
        cur.setAttribute('x1', x(i)); cur.setAttribute('x2', x(i)); cur.setAttribute('opacity', 1);
        var html = '<b>' + labels[i] + '/2026</b>';
        gs.forEach(function (g, k) { html += '<div><span><i style="background:' + g.color + '"></i>' + g.key + '</span><span>' + M[m].f(ser[k][i]) + '</span></div>'; });
        html += '<div style="border-top:1px solid #eee;margin-top:4px;padding-top:4px"><span>Tổng</span><span>' + M[m].f(totals[i]) + '</span></div>';
        tip.innerHTML = html; tip.style.opacity = 1;
        var left = x(i) + 14; if (left + 170 > w) left = x(i) - 174;
        tip.style.left = Math.max(0, left) + 'px'; tip.style.top = '8px';
      }
      function hide() { cur.setAttribute('opacity', 0); tip.style.opacity = 0; }
      hit.addEventListener('pointermove', function (e) { var r = svg.getBoundingClientRect(); show(Math.round((e.clientX - r.left - L) / iw * (n - 1))); });
      hit.addEventListener('pointerleave', hide); hit.addEventListener('blur', hide);
      hit.addEventListener('focus', function () { show(n - 1); });
      hit.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); } });
      svg.setAttribute('aria-label', 'Biểu đồ ' + M[m].label + ' theo ngày, nhóm ' + GROUP_TITLE[state.group].toLowerCase());
    });
    var lg = $('#legend'); lg.innerHTML = gs.map(function (g) { return '<span><i style="background:' + g.color + '"></i>' + g.key + '</span>'; }).join('');
    return totals;
  }

  function hm(sec) { var m = Math.round(sec / 60); return Math.floor(m / 60) + ' giờ ' + (m % 60 < 10 ? '0' : '') + (m % 60) + ' phút'; }
  function table() {
    var gs = groups(), n = RANGES[state.range], tot = {}, rows = [];
    gs.forEach(function (g) {
      var r = { g: g }; ['cost', 'sec', 'tin', 'tout', 'calls'].forEach(function (m) {
        r[m] = g.atoms.reduce(function (s, a) { var v = 0; for (var i = 30 - n; i < 30; i++) v += a.cost[i] * a.rate[m]; return s + v; }, 0); tot[m] = (tot[m] || 0) + r[m];
      }); rows.push(r);
    });
    rows.sort(function (a, b) { return b.cost - a.cost; });
    $('#tbl-title').textContent = GROUP_TITLE[state.group];
    $('#tbl-first').textContent = state.group === 'vendor' ? 'Nhà cung cấp' : state.group === 'model' ? 'Model' : 'Dịch vụ';
    var hl = { cost: 5, sec: 1, tok: 2, calls: 4 }[state.metric];
    function cell(i, html) { return '<td' + (i === hl || (state.metric === 'tok' && i === 3) ? ' class="hl"' : '') + '>' + html + '</td>'; }
    var dash = '<span class="dim">–</span>';
    $('#tbl-body').innerHTML = rows.map(function (r) {
      var sub = state.group === 'vendor' ? r.g.atoms.map(function (a) { return a.model.split(' · ')[0]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') : r.g.atoms.map(function (a) { return a.vendor; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
      var kenh = r.sec ? hm(r.sec) + '<small>' + nf(Math.round(r.sec / 60), 0) + ' phút kênh</small>' : dash;
      return '<tr><td><span class="name"><i class="itile sm" style="background:' + r.g.color + ';width:12px;height:12px;border-radius:50%;box-shadow:none"></i><span>' + r.g.key + '<small>' + sub + '</small></span></span></td>' +
        cell(1, kenh) + cell(2, r.tin ? nf(r.tin, 0) : dash) + cell(3, r.tout ? nf(r.tout, 0) : dash) + cell(4, nf(Math.round(r.calls), 0)) + cell(5, '$' + nf(r.cost, 2)) +
        '<td><span class="bar share"><i style="width:' + (r.cost / tot.cost * 100).toFixed(1) + '%;background:' + r.g.color + '"></i></span> <span class="num" style="margin-left:8px">' + nf(r.cost / tot.cost * 100, 0) + '%</span></td></tr>';
    }).join('');
    $('#tbl-foot').innerHTML = '<tr><td><b>Tổng</b></td><td><b>' + hm(tot.sec) + '</b></td><td><b>' + nf(tot.tin, 0) + '</b></td><td><b>' + nf(tot.tout, 0) + '</b></td><td><b>' + nf(Math.round(tot.calls), 0) + '</b></td><td><b>$' + nf(tot.cost, 2) + '</b></td><td></td></tr>';
    return tot;
  }

  function usage() {
    var box = $('#main-chart'), tip = $('#tip');
    function render() {
      var totals = stacked(box, tip), tot = table(), m = state.metric;
      var v = m === 'tok' ? tot.tin + tot.tout : tot[m];
      $('#headline').textContent = M[m].f(v);
      $('#head-label').textContent = M[m].label + ' · ' + RANGE_TXT[state.range];
      var d = DELTA[state.range][m]; $('#delta').innerHTML = '<span class="up">+' + nf(d, 1) + '%</span> <span class="sub">so với kỳ trước</span>';
      $$('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.range === state.range)); });
      $$('.tabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.metric === state.metric)); });
    }
    $$('.seg button').forEach(function (b) { b.addEventListener('click', function () { state.range = +b.dataset.range; render(); }); });
    $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { state.metric = b.dataset.metric; render(); }); });
    $('#groupby').addEventListener('change', function (e) { state.group = e.target.value; render(); });
    var q = location.hash.replace('#', '').split(',');  // optional preview state: #model,tok,30
    if (q[0] && GROUP_TITLE[q[0]]) { state.group = q[0]; $('#groupby').value = q[0]; }
    if (q[1] && M[q[1]]) state.metric = q[1];
    if (q[2] !== undefined && RANGES[q[2]]) state.range = +q[2];
    render();
  }

  if ($('#line-chart')) { lineChart($('#line-chart')); barChart($('#bar-chart')); }
  if ($('#main-chart')) usage();
})();
