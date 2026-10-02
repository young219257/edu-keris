/* 추천 차트 갤러리 — API 의 chart_recommendations 와 chart_data 를 Highcharts 로 그린다.
 * chart_data 의 세부 구조는 기법·차트 종류마다 다르므로 자주 쓰이는 형태(수치 배열, {x,y} 행 배열, 열 배열 객체,
 * 라벨+값, 행렬, 사분위 상자그림)를 추정해서 그리고, 어느 것도 맞지 않으면 원본 데이터를 표/트리로 보여준다. */
(function () {
  'use strict';
  var A = window.App;
  var PALETTE = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

  var KIND_LABEL = { histogram: '히스토그램', boxplot: '상자그림', bar: '막대차트', scatter: '산점도', scatter_with_fit: '산점도+회귀선', heatmap: '히트맵', line: '선 그래프', residual: '잔차도', roc_curve: 'ROC 곡선', confusion_matrix: '혼동행렬', tree_diagram: '트리 다이어그램', feature_importance: '변수 중요도', cluster_scatter: '군집 산점도', elbow: '엘보 곡선', dendrogram: '덴드로그램', scree: '스크리 플롯', missing_matrix: '결측 행렬', means_plot: '평균 도표', random_effects: '랜덤효과', variance_components: '분산 성분', trajectory: '성장 궤적', ps_distribution: '성향점수 분포', love_plot: 'Love Plot' };
  var LINE_KINDS = ['line', 'elbow', 'scree', 'trajectory', 'roc_curve'];
  var SCATTER_KINDS = ['scatter', 'scatter_with_fit', 'residual', 'cluster_scatter'];
  var BAR_KINDS = ['bar', 'feature_importance', 'means_plot', 'variance_components', 'random_effects', 'histogram'];

  if (window.Highcharts) {
    Highcharts.setOptions({
      colors: PALETTE,
      chart: { style: { fontFamily: 'inherit' }, spacing: [8, 8, 8, 8] },
      credits: { enabled: false },
      title: { text: undefined },
      legend: { itemStyle: { fontSize: '11px' } },
      xAxis: { gridLineColor: '#f1f5f9', lineColor: '#e2e8f0', labels: { style: { fontSize: '10px' } } },
      yAxis: { gridLineColor: '#f1f5f9', title: { style: { fontSize: '10px' } }, labels: { style: { fontSize: '10px' } } },
      tooltip: { backgroundColor: '#fff', borderColor: '#e2e8f0', style: { fontSize: '11px' } }
    });
  }

  var instances = [];
  function destroyAll() { instances.forEach(function (c) { try { c.destroy(); } catch (e) { /* ignore */ } }); instances = []; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function isMatrix(v) { return Array.isArray(v) && v.length && v.every(function (r) { return Array.isArray(r) && r.length && r.every(function (c) { return c === null || isNum(c); }); }); }

  /** 열 배열 객체 {x:[..], y:[..]} → 행 배열 */
  function columnsToRows(o) {
    var keys = Object.keys(o), arrs = keys.filter(function (k) { return Array.isArray(o[k]) && o[k].every(function (x) { return x === null || typeof x !== 'object'; }); });
    if (arrs.length < 2) return null;
    var n = o[arrs[0]].length;
    if (!arrs.every(function (k) { return o[k].length === n; })) return null;
    var rows = [];
    for (var i = 0; i < n; i++) { var r = {}; arrs.forEach(function (k) { r[k] = o[k][i]; }); rows.push(r); }
    return rows;
  }
  function pickKeys(rows, rec) {
    var enc = rec.encoding || {}, first = rows[0] || {}, keys = Object.keys(first);
    var numKeys = keys.filter(function (k) { return isNum(first[k]); });
    var x = enc.x && keys.indexOf(enc.x) >= 0 ? enc.x : null, y = enc.y && keys.indexOf(enc.y) >= 0 ? enc.y : null;
    if (!x) x = numKeys.filter(function (k) { return k !== y; })[0] || keys[0];
    if (!y) y = numKeys.filter(function (k) { return k !== x; })[0];
    var grp = enc.color || enc.group || enc.series || ['cluster', 'group', 'label', 'class', 'series'].filter(function (k) { return keys.indexOf(k) >= 0 && k !== x && k !== y; })[0];
    var lab = keys.filter(function (k) { return typeof first[k] === 'string' && k !== grp; })[0];
    return { x: x, y: y, group: grp, label: lab, numKeys: numKeys };
  }

  function box(id) { return '<div id="' + id + '" class="h-64"></div>'; }
  function baseHc(type, extra) {
    return Object.assign({ chart: { type: type }, legend: { enabled: false } }, extra || {});
  }

  /** 행 배열에서 사분위 필드(최솟값/Q1/중앙값/Q3/최댓값)를 추정 */
  function boxplotData(rows) {
    var FIELD_SETS = [['min', 'q1', 'median', 'q3', 'max'], ['low', 'q1', 'median', 'q3', 'high'], ['whisker_low', 'q1', 'median', 'q3', 'whisker_high']];
    var fs = FIELD_SETS.filter(function (f) { return f.every(function (k) { return isNum(rows[0][k]); }); })[0];
    if (!fs) return null;
    var lk = Object.keys(rows[0]).filter(function (k) { return typeof rows[0][k] === 'string'; })[0];
    return { categories: rows.map(function (r, i) { return lk ? String(r[lk]) : '변수' + (i + 1); }), data: rows.map(function (r) { return fs.map(function (k) { return r[k]; }); }) };
  }

  function heat(m, xl, yl, rec) {
    var conf = rec.kind === 'confusion_matrix';
    var xc = Array.isArray(xl) ? xl : m[0].map(function (_, i) { return 'C' + (i + 1); });
    var yc = Array.isArray(yl) ? yl : m.map(function (_, i) { return 'R' + (i + 1); });
    var data = [];
    m.forEach(function (row, yi) { row.forEach(function (v, xi) { if (v !== null && v !== undefined) data.push([xi, yi, v]); }); });
    var uid = 'ch-hm-' + Math.random().toString(36).slice(2, 8);
    return {
      html: heatBox(uid, xc.length, yc.length, 34),
      draw: function (el) {
        return Highcharts.chart(el, baseHc('heatmap', {
          xAxis: { categories: xc, labels: { style: { fontSize: '10px' } } },
          yAxis: { categories: yc, title: { text: null }, reversed: true, labels: { style: { fontSize: '10px' } } },
          colorAxis: conf
            ? { min: 0, minColor: '#eff6ff', maxColor: '#1d4ed8' }
            : { min: -1, max: 1, stops: [[0, '#ef4444'], [0.5, '#ffffff'], [1, '#2563eb']] },
          legend: { enabled: true, align: 'right', layout: 'vertical', verticalAlign: 'middle' },
          series: [{ data: data, dataLabels: { enabled: true, style: { fontSize: '10px', textOutline: 'none' }, format: '{point.value:.2f}' }, borderWidth: 1, borderColor: '#fff' }],
          tooltip: { formatter: function () { return xc[this.point.x] + ' × ' + yc[this.point.y] + ': <b>' + this.point.value + '</b>'; } }
        }));
      }
    };
  }

  /** 트리 구조도: chart_data.tree = {nodes:[{id,parent,branch(yes/no),label,n_samples,impurity,is_leaf,predicted}], links} → Highcharts treegraph */
  function treePlan(rec, data, uid) {
    var nodes = isObj(data) && data[(rec.options && rec.options.node_list) || 'nodes'];
    if (!Array.isArray(nodes) || !nodes.length || nodes[0].id === undefined || !('parent' in nodes[0])) return null;
    var leaves = nodes.filter(function (n) { return n.is_leaf; }).length;
    var pts = nodes.map(function (n) {
      var pred = typeof n.predicted === 'number' ? Number(n.predicted.toFixed(3)) : n.predicted;
      return { id: String(n.id), parent: n.parent === null || n.parent === undefined ? undefined : String(n.parent), name: n.is_leaf ? '예측 ' + pred : n.label,
        branch: n.branch === 'yes' ? '참' : n.branch === 'no' ? '거짓' : '', n: n.n_samples, impurity: n.impurity, pred: pred, color: n.is_leaf ? PALETTE[0] : '#64748b' };
    });
    return { html: '<div id="' + uid + '" style="height:' + Math.max(256, leaves * 48) + 'px"></div>', draw: function (el) {
      return Highcharts.chart(el, {
        chart: { inverted: true, spacingRight: 110 }, title: { text: null }, legend: { enabled: false },
        tooltip: { pointFormatter: function () { return (this.branch ? '분기: ' + this.branch + '<br/>' : '') + '<b>' + this.name + '</b><br/>표본수: ' + this.n + '<br/>불순도: ' + (this.impurity != null ? Number(this.impurity).toFixed(4) : '-') + '<br/>예측값: ' + this.pred; } },
        series: [{ type: 'treegraph', data: pts, marker: { symbol: 'circle', radius: 5 }, link: { color: '#cbd5e1', lineWidth: 1.5 },
          dataLabels: { pointFormat: '{point.name}<br/><span style="font-weight:400;color:#64748b">n={point.n}</span>', align: 'left', x: 8, crop: false, overflow: 'allow', style: { fontSize: '10px', fontWeight: '600', color: '#0f172a', textOutline: 'none', whiteSpace: 'nowrap' } } }]
      });
    } };
  }

  /* ---------------- 추천 종류(kind)별 전용 렌더러: 실제 API 의 encoding/options 를 그대로 해석 ---------------- */
  function sized(id, h) { return '<div id="' + id + '" style="height:' + (h || 256) + 'px"></div>'; }
  function fx(v, d) { return isNum(v) ? Number(v.toFixed(d === undefined ? 3 : d)) : v; }
  function pct(v) { return isNum(v) ? (v * 100).toFixed(1) + '%' : v; }
  function opt(rec) { return rec.options || {}; }
  function enc(rec) { return rec.encoding || {}; }
  function rowsOf(d) { return Array.isArray(d) && d.length && d.every(isObj) ? d : null; }
  function sortRows(rows, spec, enc_) {
    if (!spec) return rows;
    var desc = spec.charAt(0) === '-', axis = spec.replace('-', ''), f = enc_[axis];
    if (!f) return rows;
    return rows.slice().sort(function (a, b) { return desc ? b[f] - a[f] : a[f] - b[f]; });
  }
  /** factor 가 여러 개면 "요인: 수준", 하나면 수준만 */
  function groupCats(rows, gx, gby) {
    var multi = gby && rows.some(function (r) { return r[gby] !== rows[0][gby]; });
    return rows.map(function (r) { return multi ? r[gby] + ': ' + r[gx] : String(r[gx]); });
  }
  function ols(pts) {
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
    var den = n * sxx - sx * sx;
    if (!den) return null;
    var b = (n * sxy - sx * sy) / den;
    return { b: b, a: (sy - b * sx) / n };
  }
  function extent(arr) { return [Math.min.apply(null, arr), Math.max.apply(null, arr)]; }

  /** 히트맵 상자: 행·열이 많으면 셀 크기를 유지한 채 카드 안에서 스크롤 (기본 최대 높이 420px) */
  function heatBox(uid, nx, ny, cell) {
    var h = Math.max(256, ny * cell + 70), w = nx * 46 + 140;
    return '<div style="max-height:420px;overflow:auto"><div id="' + uid + '" style="height:' + h + 'px;min-width:' + w + 'px"></div></div>';
  }
  /** 셀 목록({x,y,값}) 또는 행렬 → 히트맵 (상관행렬·혼동행렬·적재값) */
  function heatCells(xc, yc, pts, o) {
    return function (el) {
      return Highcharts.chart(el, baseHc('heatmap', {
        xAxis: { categories: xc, title: { text: o.xTitle || null } },
        yAxis: { categories: yc, title: { text: o.yTitle || null }, reversed: true },
        colorAxis: o.diverging ? { min: o.domain ? o.domain[0] : -1, max: o.domain ? o.domain[1] : 1, stops: [[0, '#ef4444'], [0.5, '#ffffff'], [1, '#2563eb']] } : { min: 0, minColor: '#eff6ff', maxColor: '#1d4ed8' },
        legend: { enabled: true, align: 'right', layout: 'vertical', verticalAlign: 'middle' },
        series: [{ data: pts, borderWidth: 1, borderColor: '#fff', dataLabels: { enabled: pts.length <= 150, style: { fontSize: '10px', textOutline: 'none' }, format: o.integer ? '{point.value}' : '{point.value:.2f}' } }],
        tooltip: { formatter: function () { return (o.yTitle ? o.yTitle + ' ' : '') + yc[this.point.y] + ' × ' + (o.xTitle ? o.xTitle + ' ' : '') + xc[this.point.x] + ': <b>' + fx(this.point.value) + '</b>'; } }
      }));
    };
  }
  function planHeatmap(rec, data, uid, ctx) {
    var e = enc(rec), o = opt(rec), conf = rec.kind === 'confusion_matrix';
    var cells = isObj(data) && data[o.cells || 'cells'];
    if (Array.isArray(cells) && cells.length) {
      var xf = e.x || 'x', yf = e.y || 'y', vf = e.color || e.label || 'value';
      var uniq = function (f) { var s = []; cells.forEach(function (c) { if (s.indexOf(String(c[f])) < 0) s.push(String(c[f])); }); return s; };
      var xc = (data.labels || data.columns || uniq(xf)).map(String), yc = (data.labels || data.columns || uniq(yf)).map(String);
      var pts = cells.map(function (c) { return [xc.indexOf(String(c[xf])), yc.indexOf(String(c[yf])), c[vf]]; });
      return { html: heatBox(uid, xc.length, yc.length, 34), draw: heatCells(xc, yc, pts, { diverging: o.diverging, domain: o.domain, integer: conf, xTitle: conf ? '예측' : null, yTitle: conf ? '실제' : null }) };
    }
    // PCA 적재값: chart_data 에 없으면 result.components[].loadings 로 구성
    var comps = ctx.result && ctx.result.components;
    if (!data && rec.data_key === 'loadings' && Array.isArray(comps) && comps.length && comps[0].loadings) {
      var cx = comps.map(function (c) { return c.component; }), vy = Object.keys(comps[0].loadings), lp = [];
      comps.forEach(function (c, xi) { vy.forEach(function (v, yi) { lp.push([xi, yi, c.loadings[v]]); }); });
      return { html: heatBox(uid, cx.length, vy.length, 30), draw: heatCells(cx, vy, lp, { diverging: true, domain: o.domain || [-1, 1] }) };
    }
    return null;
  }

  /** 상관분석 scatter_pairs: 쌍마다 산점도 → 선택 상자로 전환, 회귀선 포함 */
  function planScatterPairs(rec, data, uid) {
    var o = opt(rec), pk = o.points || 'points';
    if (!rowsOf(data) || !Array.isArray(data[0][pk])) return null;
    var sel = '<select id="' + uid + '-sel" class="mb-1.5 w-full text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white">' + data.map(function (p, i) { return '<option value="' + i + '">' + A.esc(p[o.group_by || 'pair'] || ('쌍 ' + (i + 1))) + (isNum(p.coefficient) ? ' (r = ' + p.coefficient.toFixed(3) + ')' : '') + '</option>'; }).join('') + '</select>';
    function cfg(p) {
      var pts = p[pk].map(function (q) { return [q.x, q.y]; }), fit = o.fit_line ? ols(pts) : null, xs = extent(pts.map(function (q) { return q[0]; }));
      var s = [{ type: 'scatter', name: p.pair, data: pts, color: PALETTE[0] + 'aa', marker: { radius: 2.5, symbol: 'circle' } }];
      if (fit) s.push({ type: 'line', name: '회귀선', data: [[xs[0], fit.a + fit.b * xs[0]], [xs[1], fit.a + fit.b * xs[1]]], color: PALETTE[1], marker: { enabled: false }, enableMouseTracking: false });
      return { xAxis: { title: { text: p.x_label } }, yAxis: { title: { text: p.y_label } }, series: s };
    }
    return { html: sel + box(uid), draw: function (el) {
      var chart = Highcharts.chart(el, baseHc('scatter', cfg(data[0])));
      var s = document.getElementById(uid + '-sel');
      if (s) s.addEventListener('change', function () {
        var c = cfg(data[+s.value]);
        while (chart.series.length) chart.series[0].remove(false);
        c.series.forEach(function (x) { chart.addSeries(x, false); });
        chart.xAxis[0].setTitle({ text: c.xAxis.title.text }, false); chart.yAxis[0].setTitle({ text: c.yAxis.title.text }, false);
        chart.redraw();
      });
      return chart;
    } };
  }

  /** 실제값 대 예측값(대각 기준선·회귀선) / 잔차도(기준선 0) */
  function planScatterFit(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows || !isNum(rows[0][e.x]) || !isNum(rows[0][e.y])) return null;
    var pts = rows.map(function (r) { return [r[e.x], r[e.y]]; });
    var xs = extent(pts.map(function (p) { return p[0]; })), ys = extent(pts.map(function (p) { return p[1]; }));
    var s = [{ type: 'scatter', name: '관측치', data: pts, color: PALETTE[0] + 'aa', marker: { radius: 2.5, symbol: 'circle' } }];
    if (o.identity_line) { var lo = Math.min(xs[0], ys[0]), hi = Math.max(xs[1], ys[1]); s.push({ type: 'line', name: '기준선 (y = x)', data: [[lo, lo], [hi, hi]], color: '#94a3b8', dashStyle: 'Dash', marker: { enabled: false }, enableMouseTracking: false }); }
    var fit = o.fit_line ? ols(pts) : null;
    if (fit) s.push({ type: 'line', name: '회귀선', data: [[xs[0], fit.a + fit.b * xs[0]], [xs[1], fit.a + fit.b * xs[1]]], color: PALETTE[1], marker: { enabled: false }, enableMouseTracking: false });
    var ref = isNum(o.reference_line) ? [{ value: o.reference_line, color: PALETTE[1], width: 1.5, dashStyle: 'Dash', zIndex: 3 }] : [];
    return { html: box(uid), draw: function (el) {
      return Highcharts.chart(el, baseHc('scatter', { legend: { enabled: s.length > 1 }, xAxis: { title: { text: o.x_label || e.x } }, yAxis: { title: { text: o.y_label || e.y }, plotLines: ref }, series: s,
        tooltip: { pointFormatter: function () { return (o.x_label || e.x) + ': <b>' + fx(this.x) + '</b><br/>' + (o.y_label || e.y) + ': <b>' + fx(this.y) + '</b>'; } } }));
    } };
  }

  /** 히스토그램 구간 행 [{bin_start, bin_end, bin_center, count}] */
  function planHistogramRows(rec, data, uid) {
    var rows = rowsOf(data);
    if (!rows || rows[0].count === undefined || (rows[0].bin_center === undefined && rows[0].bin_start === undefined)) return null;
    var pts = rows.map(function (r) { return { x: isNum(r.bin_center) ? r.bin_center : (r.bin_start + r.bin_end) / 2, y: r.count, lo: r.bin_start, hi: r.bin_end }; });
    var w = rows.length > 1 && isNum(rows[0].bin_start) ? rows[0].bin_end - rows[0].bin_start : undefined;
    return { html: box(uid), draw: function (el) {
      return Highcharts.chart(el, baseHc('column', { xAxis: { title: { text: null } }, yAxis: { title: { text: '빈도' } },
        plotOptions: { column: { pointPadding: 0, groupPadding: 0, borderWidth: 0.5, borderColor: '#fff', pointRange: w } },
        tooltip: { pointFormatter: function () { return (isNum(this.lo) ? fx(this.lo) + ' ~ ' + fx(this.hi) : fx(this.x)) + '<br/>빈도: <b>' + this.y + '</b>'; } },
        series: [{ data: pts, color: PALETTE[0] }] }));
    } };
  }

  /** 막대: encoding 의 x/y 중 문자열 쪽을 범주, 수치 쪽을 값으로. 객체 값(z_means 등)은 범주×그룹 묶음 막대.
   *  options: sort, error_bars[lo,hi], reference_line, format(percent), diverging. color 가 불리언이면 유의/비유의 색 구분 */
  /** 다중 분류 로지스틱: 서버가 chart_data.coefficients 를 빈 배열로 주므로 result.coefficients[{class, terms[{term, odds_ratio}]}] 로 범주별 오즈비 묶음 막대를 그린다 */
  function planMultinomialOdds(rec, uid, ctx) {
    var rc = ctx.result && ctx.result.coefficients;
    if (rec.data_key !== 'coefficients' || !Array.isArray(rc) || !rc.length || !Array.isArray(rc[0].terms)) return null;
    var terms = rc[0].terms.map(function (t) { return t.term; });
    var ref = isNum(opt(rec).reference_line) ? opt(rec).reference_line : 1;
    return { html: sized(uid, Math.max(256, terms.length * rc.length * 16 + 90)), draw: function (el) {
      return Highcharts.chart(el, baseHc('bar', { legend: { enabled: true }, xAxis: { categories: terms },
        yAxis: { title: { text: '오즈비 (Exp(B))' }, plotLines: [{ value: ref, color: '#64748b', width: 1, dashStyle: 'Dash', zIndex: 3, label: { text: '기준 ' + ref, style: { fontSize: '10px', color: '#64748b' } } }] },
        tooltip: { shared: true, valueDecimals: 3 },
        series: rc.map(function (c, i) { return { name: '범주 ' + c.class, color: PALETTE[i % PALETTE.length], data: terms.map(function (t) { var x = c.terms.filter(function (y) { return y.term === t; })[0]; return x ? fx(x.odds_ratio) : null; }) }; }) }));
    } };
  }

  function planBar(rec, data, uid, ctx) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows) return planMultinomialOdds(rec, uid, ctx || {});
    var f0 = rows[0], isPctFmt = o.format === 'percent';
    var valFmt = function (v) { return isPctFmt ? pct(v) : fx(v); };
    var ref = isNum(o.reference_line) ? [{ value: o.reference_line, color: '#64748b', width: 1, dashStyle: 'Dash', zIndex: 3 }] : [];
    // 묶음 막대: 값 필드가 {변수: 값} 객체 (군집 프로파일)
    var objF = [e.x, e.y].filter(function (f) { return f && isObj(f0[f]); })[0];
    if (objF) {
      var feats = Object.keys(f0[objF]);
      return { html: sized(uid, Math.max(256, feats.length * rows.length * 14 + 80)), draw: function (el) {
        return Highcharts.chart(el, baseHc('bar', { legend: { enabled: true }, xAxis: { categories: feats }, yAxis: { title: { text: objF }, plotLines: o.diverging || isNum(o.reference_line) ? [{ value: o.reference_line || 0, color: '#64748b', width: 1 }] : [] },
          series: rows.map(function (r, i) { return { name: String(r.label || r[e.color] || ('그룹 ' + (i + 1))), color: PALETTE[i % PALETTE.length], data: feats.map(function (k) { return fx(r[objF][k]); }) }; }) }));
      } };
    }
    var catF = [e.y, e.x].filter(function (f) { return f && f0[f] !== undefined && !isNum(f0[f]); })[0];
    var valF = [e.x, e.y].filter(function (f) { return f && isNum(f0[f]); })[0];
    if (!valF) return null;
    rows = sortRows(rows, o.sort, e);
    var cats = catF ? rows.map(function (r) { return String(r[catF]); }) : rows.length === 1 ? [A.viz.label(valF)] : rows.map(function (_, i) { return String(i + 1); });
    var horiz = catF === e.y;   // 범주가 y 축으로 지정되면 가로 막대
    var boolColor = e.color && typeof f0[e.color] === 'boolean';
    var pts = rows.map(function (r) { return { y: r[valF], color: boolColor ? (r[e.color] ? PALETTE[0] : '#cbd5e1') : undefined }; });
    var series = [{ name: valF, data: pts, color: PALETTE[0] }];
    var eb = o.error_bars;
    if (Array.isArray(eb) && eb.length === 2 && isNum(f0[eb[0]])) series.push({ type: 'errorbar', name: '95% 신뢰구간', data: rows.map(function (r) { return [r[eb[0]], r[eb[1]]]; }), color: '#334155', whiskerLength: '40%' });
    return { html: sized(uid, horiz ? Math.max(256, cats.length * 26 + 70) : 256), draw: function (el) {
      return Highcharts.chart(el, baseHc(horiz ? 'bar' : 'column', {
        xAxis: { categories: cats }, yAxis: { title: { text: null }, plotLines: ref, labels: { formatter: function () { return isPctFmt ? pct(this.value) : this.value; } } },
        legend: { enabled: !!boolColor, labelFormatter: function () { return this.name; } },
        tooltip: { shared: true, formatter: function () { var r = rows[this.points ? this.points[0].point.index : this.point.index], s = '<b>' + A.esc(this.x !== undefined ? this.x : cats[0]) + '</b><br/>' + valF + ': <b>' + valFmt(r[valF]) + '</b>'; if (eb && isNum(r[eb[0]])) s += '<br/>95% CI: [' + fx(r[eb[0]]) + ', ' + fx(r[eb[1]]) + ']'; if (isNum(r.p_value)) s += '<br/>p = ' + fx(r.p_value, 4); return s; } },
        series: boolColor ? series.concat([{ name: '유의 (p<.05)', color: PALETTE[0], data: [] }, { name: '비유의', color: '#cbd5e1', data: [] }]).map(function (s, i) { if (i === 0) s.showInLegend = false; if (s.type === 'errorbar') s.showInLegend = false; return s; }) : series
      }));
    } };
  }

  /** 평균 도표: 집단 평균 + 신뢰구간 오차막대 */
  function planMeans(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows || !isNum(rows[0][e.y])) return null;
    var cats = groupCats(rows, e.x, o.group_by), eb = o.error_bars;
    return { html: box(uid), draw: function (el) {
      var s = [{ type: 'line', name: '평균', data: rows.map(function (r) { return r[e.y]; }), color: PALETTE[0], lineWidth: 1.5, marker: { enabled: true, radius: 4 } }];
      if (Array.isArray(eb) && isNum(rows[0][eb[0]])) s.push({ type: 'errorbar', name: '95% 신뢰구간', data: rows.map(function (r) { return [r[eb[0]], r[eb[1]]]; }), color: '#334155' });
      return Highcharts.chart(el, baseHc('line', { xAxis: { categories: cats }, yAxis: { title: { text: '평균' } }, tooltip: { shared: true, valueDecimals: 3 }, series: s }));
    } };
  }

  /** 상자그림: options.whisker_fields(울타리 기준) 우선, 없으면 min/q1/median/q3/max */
  function planBox(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows) return null;
    var wf = Array.isArray(o.whisker_fields) && o.whisker_fields.every(function (k) { return isNum(rows[0][k]); }) ? o.whisker_fields : null;
    if (!wf) { var bp = boxplotData(rows); if (!bp) return null; wf = null; }
    var cats = e.x && rows[0][e.x] !== undefined ? groupCats(rows, e.x, o.group_by) : (bp && bp.categories);
    var pts = wf ? rows.map(function (r) { return wf.map(function (k) { return r[k]; }); }) : bp.data;
    // 울타리 밖 최솟/최댓값은 이상치 점으로
    var outl = [];
    if (wf) rows.forEach(function (r, i) { ['min', 'max'].forEach(function (k) { if (isNum(r[k]) && (r[k] < r[wf[0]] || r[k] > r[wf[4]])) outl.push([i, r[k]]); }); });
    return { html: box(uid), draw: function (el) {
      var s = [{ type: 'boxplot', name: '분포', data: pts, color: PALETTE[0], fillColor: PALETTE[0] + '22', medianColor: PALETTE[1], medianWidth: 2 }];
      if (outl.length) s.push({ type: 'scatter', name: '극단값 (min/max)', data: outl, color: PALETTE[1], marker: { radius: 3, symbol: 'circle' } });
      return Highcharts.chart(el, baseHc('boxplot', { xAxis: { categories: cats }, yAxis: { title: { text: null } }, series: s }));
    } };
  }

  /** 덴드로그램: merges[{left,right,distance,size}] (scipy linkage, 잎 0..n-1, i번째 병합은 n+i) */
  function planDendrogram(rec, data, uid, ctx) {
    var o = opt(rec), merges = isObj(data) && data[o.merge_list || 'merges'], n = isObj(data) && data[o.n_leaves || 'n_leaves'];
    if (!Array.isArray(merges) || !merges.length || !isNum(n)) return null;
    var pos = {}, h = {}, order = 0;
    (function place(id) {                        // 재귀 대신 스택으로 잎 순서 부여 (깊은 트리 대비)
      var stack = [[id, false]];
      while (stack.length) {
        var t = stack.pop(), nid = t[0];
        if (nid < n) { pos[nid] = order++; h[nid] = 0; continue; }
        var m = merges[nid - n];
        if (t[1]) { pos[nid] = (pos[m.left] + pos[m.right]) / 2; h[nid] = m.distance; continue; }
        stack.push([nid, true], [m.right, false], [m.left, false]);
      }
    })(n + merges.length - 1);
    var line = [];
    merges.forEach(function (m) {
      line.push([pos[m.left], h[m.left]], [pos[m.left], m.distance], [pos[m.right], m.distance], [pos[m.right], h[m.right]], null);
    });
    var k = ctx.params && ctx.params.n_clusters, cut = null;
    // k개 군집 = 마지막 k-1번의 병합을 하지 않은 상태 → 마지막 수행 병합과 첫 미수행 병합 거리의 중간에 절단선
    if (isNum(k) && k > 1 && k <= merges.length) cut = (merges[merges.length - k].distance + merges[merges.length - k + 1].distance) / 2;
    return { html: sized(uid, 300), draw: function (el) {
      return Highcharts.chart(el, baseHc('line', {
        xAxis: { labels: { enabled: n <= 40 }, tickLength: 0, title: { text: '관측치 (' + n + '개)' } },
        yAxis: { title: { text: '병합 거리' }, min: 0, plotLines: cut ? [{ value: cut, color: PALETTE[1], dashStyle: 'Dash', width: 1.5, label: { text: k + '개 군집 절단선', style: { fontSize: '10px', color: PALETTE[1] } } }] : [] },
        tooltip: { enabled: false },
        series: [{ data: line, color: '#475569', lineWidth: 1, marker: { enabled: false }, connectNulls: false, enableMouseTracking: false, turboThreshold: 0 }]
      }));
    } };
  }

  /** 엘보 곡선: k 별 inertia + 보조축 실루엣, 선택된 k 표시. chart_data 에 없으면 result.elbow 사용 */
  function planElbow(rec, data, uid, ctx) {
    var rows = rowsOf(data) || rowsOf(ctx.result && ctx.result.elbow), e = enc(rec), o = opt(rec);
    if (!rows) return null;
    var xf = e.x || 'k', yf = e.y || 'inertia', y2 = o.secondary_y || (rows[0].silhouette !== undefined ? 'silhouette' : null);
    var sk = isNum(o.selected_k) ? o.selected_k : ctx.params && ctx.params.n_clusters;
    return { html: box(uid), draw: function (el) {
      var s = [{ name: yf, data: rows.map(function (r) { return [r[xf], r[yf]]; }), color: PALETTE[0], marker: { radius: 4 } }];
      if (y2) s.push({ name: y2, yAxis: 1, data: rows.map(function (r) { return [r[xf], r[y2]]; }), color: PALETTE[2], dashStyle: 'ShortDash', marker: { radius: 3 } });
      return Highcharts.chart(el, baseHc('line', { legend: { enabled: !!y2 }, tooltip: { shared: true, valueDecimals: 3 },
        xAxis: { title: { text: '군집 수 (k)' }, allowDecimals: false, plotLines: isNum(sk) ? [{ value: sk, color: PALETTE[1], dashStyle: 'Dash', width: 1.5, label: { text: '선택 k=' + sk, style: { fontSize: '10px', color: PALETTE[1] } } }] : [] },
        yAxis: [{ title: { text: yf } }, { title: { text: y2 }, opposite: true }], series: s }));
    } };
  }

  /** 스크리 플롯: 성분별 설명 비율(막대) + 누적 비율(선, 보조축) */
  function planScree(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows || !isNum(rows[0][e.y])) return null;
    var cum = o.secondary_y && isNum(rows[0][o.secondary_y]) ? o.secondary_y : null;
    return { html: box(uid), draw: function (el) {
      var s = [{ type: 'column', name: '설명 비율', data: rows.map(function (r) { return r[e.y]; }), color: PALETTE[0] }];
      if (cum) s.push({ type: 'line', name: '누적 비율', data: rows.map(function (r) { return r[cum]; }), color: PALETTE[1], marker: { radius: 4 } });
      return Highcharts.chart(el, baseHc('column', { legend: { enabled: !!cum }, xAxis: { categories: rows.map(function (r) { return String(r[e.x]); }) },
        yAxis: { title: { text: null }, max: o.format === 'percent' ? 1 : undefined, labels: { formatter: function () { return o.format === 'percent' ? pct(this.value) : this.value; } } },
        tooltip: { shared: true, pointFormatter: function () { return this.series.name + ': <b>' + pct(this.y) + '</b><br/>'; } }, series: s }));
    } };
  }

  /** 군집 산점도(PCA 투영) + 중심점(options.centroid_data_key) */
  function planCluster(rec, data, uid, ctx) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows || !isNum(rows[0][e.x || 'x'])) return null;
    var xf = e.x || 'x', yf = e.y || 'y', cf = e.color || 'cluster', groups = {}, names = [];
    rows.forEach(function (r) { var g = String(r[cf]); if (!groups[g]) { groups[g] = []; names.push(g); } groups[g].push([r[xf], r[yf]]); });
    names.sort(function (a, b) { return (a === '-1') - (b === '-1') || (isNaN(a) || isNaN(b) ? a.localeCompare(b) : a - b); });
    var cents = rowsOf(o.centroid_data_key && ctx.chartData[o.centroid_data_key]);
    return { html: sized(uid, 280), draw: function (el) {
      var s = names.map(function (g, i) { var noise = g === '-1'; return { name: noise ? '노이즈' : '군집 ' + g, data: groups[g], color: noise ? '#94a3b8' : PALETTE[i % PALETTE.length], marker: { radius: 2.5, symbol: 'circle' } }; });
      if (cents) s.push({ name: '군집 중심', data: cents.map(function (c) { return { x: c.x, y: c.y, color: PALETTE[names.indexOf(String(c.cluster)) % PALETTE.length], name: '군집 ' + c.cluster }; }), marker: { symbol: 'diamond', radius: 8, lineWidth: 2, lineColor: '#0f172a' }, color: '#0f172a', zIndex: 5 });
      return Highcharts.chart(el, baseHc('scatter', { legend: { enabled: true }, xAxis: { title: { text: rows[0].x_label || xf } }, yAxis: { title: { text: rows[0].y_label || yf } }, series: s,
        tooltip: { pointFormatter: function () { return fx(this.x) + ', ' + fx(this.y); } } }));
    } };
  }

  /** ROC 곡선 + 무작위 기준 대각선, AUC 는 metrics.roc_auc */
  function planRoc(rec, data, uid, ctx) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows) return null;
    var xf = e.x || 'fpr', yf = e.y || 'tpr', auc = ctx.metrics && ctx.metrics.roc_auc;
    var pts = rows.map(function (r) { return [r[xf], r[yf]]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return { html: box(uid), draw: function (el) {
      var s = [{ type: 'area', name: 'ROC' + (isNum(auc) ? ' (AUC = ' + auc.toFixed(3) + ')' : ''), data: pts, color: PALETTE[0], fillOpacity: 0.12, marker: { enabled: false }, step: false }];
      if (o.diagonal_reference !== false) s.push({ type: 'line', name: '무작위 기준', data: [[0, 0], [1, 1]], color: '#94a3b8', dashStyle: 'Dash', marker: { enabled: false }, enableMouseTracking: false });
      return Highcharts.chart(el, baseHc('line', { legend: { enabled: true }, xAxis: { min: 0, max: 1, title: { text: o.x_label || xf } }, yAxis: { min: 0, max: 1, title: { text: o.y_label || yf } }, series: s,
        tooltip: { pointFormatter: function () { return (o.x_label || xf) + ': ' + fx(this.x) + '<br/>' + (o.y_label || yf) + ': <b>' + fx(this.y) + '</b>'; } } }));
    } };
  }

  /** 성장 궤적: kind=individual(개체 예측선, 회색) / observed(관측점) / average(평균 성장선, 강조) */
  function planTrajectory(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec);
    if (!rows || rows[0].kind === undefined) return planLineRows(rec, data, uid);
    var xf = e.x || 'time', yf = e.y || 'value', gf = e.color || 'group', ind = {}, obs = [], avg = [], gcount = 0;
    rows.forEach(function (r) {
      if (r.kind === 'average') avg.push([r[xf], r[yf]]);
      else if (r.kind === 'observed') obs.push([r[xf], r[yf]]);
      else { if (!ind[r[gf]]) { if (gcount >= 150) return; ind[r[gf]] = []; gcount++; } ind[r[gf]].push([r[xf], r[yf]]); }
    });
    return { html: sized(uid, 280), draw: function (el) {
      var s = [];
      Object.keys(ind).forEach(function (g, i) { s.push({ type: 'line', name: '개체 ' + g, data: ind[g].sort(function (a, b) { return a[0] - b[0]; }), color: '#cbd5e1', lineWidth: 1, marker: { enabled: false }, showInLegend: i === 0, linkedTo: i ? ':previous' : undefined, enableMouseTracking: false }); });
      if (s.length) s[0].name = '개체별 예측선';
      if (obs.length) s.push({ type: 'scatter', name: '관측값', data: obs, color: PALETTE[0] + '66', marker: { radius: 2, symbol: 'circle' } });
      if (avg.length) s.push({ type: 'line', name: '평균 성장선', data: avg.sort(function (a, b) { return a[0] - b[0]; }), color: PALETTE[1], lineWidth: 3, marker: { radius: 4 }, zIndex: 5 });
      return Highcharts.chart(el, baseHc('line', { legend: { enabled: true }, xAxis: { title: { text: xf } }, yAxis: { title: { text: yf } }, series: s, tooltip: { valueDecimals: 3 } }));
    } };
  }
  function planLineRows(rec, data, uid) {
    var rows = rowsOf(data);
    if (!rows) return null;
    var k = pickKeys(rows, rec);
    if (!k.x || !k.y) return null;
    var series = {};
    rows.forEach(function (r) { var g = k.group ? String(r[k.group]) : k.y; (series[g] = series[g] || []).push([r[k.x], r[k.y]]); });
    var sn = Object.keys(series);
    sn.forEach(function (n) { series[n].sort(function (a, b) { return a[0] - b[0]; }); });
    return { html: box(uid), draw: function (el) {
      return Highcharts.chart(el, baseHc('line', { xAxis: { title: { text: k.x } }, yAxis: { title: { text: k.y } }, legend: { enabled: sn.length > 1 },
        series: sn.map(function (n, i) { return { name: n, data: series[n], color: PALETTE[i % PALETTE.length], marker: { radius: 2 } }; }) }));
    } };
  }

  /** 성향점수 분포: 집단별 구간 빈도(밀도 비율) — 매칭 전(전체, 점선) / 매칭 후(실선) */
  function planPsDist(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows || !isNum(rows[0][e.x || 'propensity'])) return null;
    var xf = e.x || 'propensity', gf = e.color || 'group', mf = o.facet || 'matched', B = 20;
    var ext = extent(rows.map(function (r) { return r[xf]; })), lo = ext[0], w = (ext[1] - lo) / B || 1;
    function hist(sub) { var c = []; for (var i = 0; i < B; i++) c.push(0); sub.forEach(function (r) { c[Math.min(B - 1, Math.floor((r[xf] - lo) / w))]++; }); return c.map(function (v, i) { return [lo + w * (i + 0.5), sub.length ? v / sub.length : 0]; }); }
    var groups = []; rows.forEach(function (r) { if (groups.indexOf(r[gf]) < 0) groups.push(r[gf]); });
    var hasM = rows[0][mf] !== undefined;
    return { html: box(uid), draw: function (el) {
      var s = [];
      groups.forEach(function (g, i) {
        var all = rows.filter(function (r) { return r[gf] === g; });
        s.push({ name: g + (hasM ? ' (매칭 전)' : ''), data: hist(all), color: PALETTE[i % PALETTE.length], dashStyle: hasM ? 'ShortDash' : 'Solid', fillOpacity: hasM ? 0 : 0.15, lineWidth: 1.5 });
        if (hasM) s.push({ name: g + ' (매칭 후)', data: hist(all.filter(function (r) { return r[mf]; })), color: PALETTE[i % PALETTE.length], fillOpacity: 0.15, lineWidth: 2 });
      });
      return Highcharts.chart(el, baseHc('areaspline', { legend: { enabled: true }, xAxis: { title: { text: '성향점수' } }, yAxis: { title: { text: '비율' }, labels: { formatter: function () { return pct(this.value); } } },
        plotOptions: { areaspline: { marker: { enabled: false } } }, tooltip: { shared: true, pointFormatter: function () { return this.series.name + ': <b>' + pct(this.y) + '</b><br/>'; } }, series: s }));
    } };
  }

  /** Love plot: 공변량별 표준화 평균차(SMD) 매칭 전/후 비교, ±0.1 기준선 */
  function planLove(rec, data, uid) {
    var rows = rowsOf(data), e = enc(rec), o = opt(rec);
    if (!rows) return null;
    var cf = e.y || 'covariate', af = e.x || 'smd_after', bf = o.compare_field || 'smd_before';
    var cats = rows.map(function (r) { return String(r[cf]); });
    var refs = (o.reference_lines || [-0.1, 0.1]).map(function (v) { return { value: v, color: PALETTE[1], dashStyle: 'Dash', width: 1 }; }).concat([{ value: 0, color: '#94a3b8', width: 1 }]);
    return { html: sized(uid, Math.max(256, cats.length * 28 + 80)), draw: function (el) {
      var s = [];
      if (isNum(rows[0][bf])) s.push({ name: '매칭 전', data: rows.map(function (r, i) { return [i, r[bf]]; }), color: '#94a3b8', marker: { symbol: 'circle', radius: 5 } });
      s.push({ name: '매칭 후', data: rows.map(function (r, i) { return [i, r[af]]; }), color: PALETTE[0], marker: { symbol: 'diamond', radius: 6 } });
      return Highcharts.chart(el, baseHc('scatter', { chart: { type: 'scatter', inverted: true }, legend: { enabled: true }, xAxis: { categories: cats, title: { text: null } }, yAxis: { title: { text: '표준화 평균차 (SMD)' }, plotLines: refs }, series: s,
        tooltip: { pointFormatter: function () { return cats[this.x] + '<br/>' + this.series.name + ': <b>' + fx(this.y) + '</b>'; } } }));
    } };
  }

  var KIND_PLANS = {
    heatmap: planHeatmap, confusion_matrix: planHeatmap,
    scatter: planScatterPairs, scatter_with_fit: planScatterFit, residual: planScatterFit,
    histogram: planHistogramRows, bar: planBar, feature_importance: planBar, variance_components: planBar, random_effects: planBar,
    means_plot: planMeans, boxplot: planBox, dendrogram: planDendrogram, elbow: planElbow, scree: planScree,
    cluster_scatter: planCluster, roc_curve: planRoc, trajectory: planTrajectory, line: planLineRows,
    ps_distribution: planPsDist, love_plot: planLove, tree_diagram: treePlan
  };

  /** 반환: { html, draw(container) } 또는 null(그릴 수 없음 → 원본 표시).
   *  1) kind 전용 렌더러 → 2) 데이터 모양 추정(범용) 순으로 시도한다. ctx = {result, metrics, chartData, params} (chart_data 누락 시 보충용) */
  function plan(rec, data, uid, ctx) {
    ctx = ctx || {};
    var kp = KIND_PLANS[rec.kind];
    if (kp) { var r = kp(rec, data, uid, ctx); if (r) return r; }
    if (data === undefined || data === null) return null;
    if (isObj(data) && isMatrix(data.matrix || data.values)) return heat(data.matrix || data.values, data.x_labels || data.labels || data.columns, data.y_labels || data.labels || data.columns, rec);
    if (isMatrix(data)) return heat(data, null, null, rec);
    var tp = treePlan(rec, data, uid);
    if (tp) return tp;

    var rows = null;
    if (Array.isArray(data) && data.length && data.every(isObj)) rows = data;
    else if (isObj(data)) rows = columnsToRows(data);

    if (isObj(data) && !rows) {
      var edges = data.bin_edges || data.edges || data.bins, counts = data.counts || data.frequencies || data.values || data.y;   // 히스토그램
      if (Array.isArray(edges) && Array.isArray(counts) && counts.every(isNum)) {
        var labels = counts.map(function (c, i) { var a = edges[i], b = edges[i + 1]; return isNum(a) && isNum(b) ? ((a + b) / 2).toFixed(2) : String(edges[i]); });
        return { html: box(uid), draw: function (el) { return Highcharts.chart(el, baseHc('column', { xAxis: { categories: labels }, yAxis: { title: { text: null } }, series: [{ data: counts, pointPadding: 0.02, groupPadding: 0, color: PALETTE[0] }] })); } };
      }
      var keys = Object.keys(data);                                                   // {라벨: 값}
      if (keys.length && keys.every(function (k) { return isNum(data[k]); })) {
        return { html: box(uid), draw: function (el) { return Highcharts.chart(el, baseHc('column', { xAxis: { categories: keys }, yAxis: { title: { text: null } }, series: [{ data: keys.map(function (k) { return data[k]; }), color: PALETTE[0] }] })); } };
      }
    }
    if (Array.isArray(data) && data.length && data.every(isNum)) {                    // 수치 배열
      var isLine = LINE_KINDS.indexOf(rec.kind) >= 0;
      return { html: box(uid), draw: function (el) { return Highcharts.chart(el, baseHc(isLine ? 'line' : 'column', { xAxis: { categories: data.map(function (_, i) { return String(i + 1); }) }, yAxis: { title: { text: null } }, series: [{ data: data, color: PALETTE[0], marker: { enabled: data.length < 40 } }] })); } };
    }
    if (!rows || !rows.length) return null;
    var k = pickKeys(rows, rec);
    if (rec.kind === 'boxplot' || (rows[0].q1 !== undefined && rows[0].q3 !== undefined)) {
      var bp = boxplotData(rows);
      if (bp) return { html: box(uid), draw: function (el) { return Highcharts.chart(el, baseHc('boxplot', { xAxis: { categories: bp.categories }, yAxis: { title: { text: null } }, series: [{ data: bp.data, color: PALETTE[0], fillColor: PALETTE[0] + '22' }] })); } };
      return { html: A.viz.table(rows), draw: null };                                 // 사분위 필드를 못 찾으면 표로 대체
    }
    if (SCATTER_KINDS.indexOf(rec.kind) >= 0 || (rec.kind === 'ps_distribution' && k.y)) {
      if (!k.x || !k.y) return null;
      var groups = {};
      rows.forEach(function (r) { var g = k.group ? String(r[k.group]) : '전체'; (groups[g] = groups[g] || []).push([r[k.x], r[k.y]]); });
      var names = Object.keys(groups);
      return { html: box(uid), draw: function (el) {
        return Highcharts.chart(el, baseHc('scatter', {
          xAxis: { title: { text: k.x } }, yAxis: { title: { text: k.y } },
          legend: { enabled: names.length > 1 },
          series: names.map(function (n, i) { return { name: n, data: groups[n], color: PALETTE[i % PALETTE.length], marker: { radius: 3, symbol: 'circle' } }; })
        }));
      } };
    }
    if (LINE_KINDS.indexOf(rec.kind) >= 0) {
      if (!k.x || !k.y) return null;
      var series = {};
      rows.forEach(function (r) { var g = k.group ? String(r[k.group]) : k.y; (series[g] = series[g] || []).push([r[k.x], r[k.y]]); });
      var sn = Object.keys(series);
      sn.forEach(function (n) { series[n].sort(function (a, b) { return a[0] - b[0]; }); });
      return { html: box(uid), draw: function (el) {
        return Highcharts.chart(el, baseHc('line', {
          xAxis: { title: { text: k.x } }, yAxis: { title: { text: k.y } },
          legend: { enabled: sn.length > 1 },
          series: sn.map(function (n, i) { return { name: n, data: series[n], color: PALETTE[i % PALETTE.length], marker: { radius: 2 } }; })
        }));
      } };
    }
    if (BAR_KINDS.indexOf(rec.kind) >= 0 || k.label) {                                // 라벨 + 값 막대
      var lk = k.label || k.x, vk = k.y && k.y !== lk ? k.y : k.numKeys.filter(function (n) { return n !== lk; })[0];
      if (!lk || !vk) return null;
      var top = rows.slice(0, 40);
      var horiz = rec.kind === 'feature_importance';
      return { html: box(uid), draw: function (el) {
        return Highcharts.chart(el, baseHc(horiz ? 'bar' : 'column', {
          xAxis: { categories: top.map(function (r) { return String(r[lk]); }) },
          yAxis: { title: { text: null } },
          series: [{ data: top.map(function (r) { return r[vk]; }), color: PALETTE[0] }]
        }));
      } };
    }
    return null;
  }

  function recTitle(rec) { return !rec.title || rec.title === rec.kind ? (KIND_LABEL[rec.kind] || rec.kind) : rec.title; }
  /** 서버가 추천만 하고 데이터를 주지 않은 경우의 안내 */
  function noDataMsg(rec, ctx) {
    if (rec.kind === 'roc_curve' && ctx && ctx.result && ctx.result.binary === false) return '다중 분류(3개 이상 범주) 모형은 서버가 ROC 곡선 데이터를 제공하지 않습니다.<br>분류 성능은 혼동행렬을 참고하세요.';
    return '서버 응답에 이 차트의 데이터(chart_data' + (rec.data_key ? '.' + A.esc(rec.data_key) : '') + ')가 포함되지 않았습니다.';
  }

  function card(rec, idx, data, ctx) {
    var uid = 'ch-' + idx, p = null, body, raw = '';
    try { p = plan(rec, data, uid, ctx); } catch (e) { p = null; }
    if (p) body = p.html;
    else if (data === undefined || data === null || (Array.isArray(data) && !data.length)) body = '<div class="py-8 text-center text-xs text-slate-400 leading-relaxed">' + noDataMsg(rec, ctx) + '</div>';
    else body = '<div class="text-[11px] text-slate-500 mb-1.5">차트로 자동 변환할 수 없는 형식이어서 원본 데이터를 표시합니다.</div>' + A.viz.tree(data, 0);
    var badge = '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">' + (idx + 1) + '순위</span>';
    return { uid: uid, plan: p, html: '<div class="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs"><div class="flex items-start justify-between gap-2 mb-2"><div class="min-w-0"><div class="flex items-center gap-1.5">' + badge + '<h5 class="text-xs font-bold text-slate-900 truncate">Figure ' + (idx + 1) + '. ' + A.esc(recTitle(rec)) + '</h5></div><p class="text-[11px] text-slate-500 mt-0.5">' + A.esc(rec.reason) + '</p></div><span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">' + A.esc(KIND_LABEL[rec.kind] || rec.kind) + '</span></div>' + body + raw + '</div>' };
  }

  function recData(r, cd) {
    var data = r.data_key ? cd[r.data_key] : undefined;
    return data === undefined ? cd[r.kind] : data;
  }

  /** 상세 보기 하단 요약: 표본수 + 대표 지표 1개 */
  function footInfo(data, ctx) {
    var m = ctx.metrics || {}, n = Array.isArray(data) ? data.length : null;
    if (isObj(data)) { var arr = data.nodes || data.cells || data.merges; if (Array.isArray(arr)) n = null; }
    var nObs = ctx.result.n_observations || m.n_observations;
    var left = nObs != null ? '표본수: N = ' + A.num(nObs) : n != null ? '데이터 점: ' + A.num(n) + '개' : '';
    var right = '';
    if (isNum(m.r_squared)) right = '결정계수 R² = ' + m.r_squared.toFixed(3) + ' (설명력 ' + (m.r_squared * 100).toFixed(1) + '%)';
    else if (isNum(m.accuracy)) right = '정확도 = ' + (m.accuracy * 100).toFixed(1) + '%' + (isNum(m.roc_auc) ? ' · AUC = ' + m.roc_auc.toFixed(3) : '');
    else if (isNum(m.silhouette)) right = '실루엣 = ' + m.silhouette.toFixed(3);
    else if (isNum(m.total_explained_variance)) right = '누적 설명분산 = ' + (m.total_explained_variance * 100).toFixed(1) + '%';
    else if (isNum(m.model_r_squared)) right = '모형 R² = ' + m.model_r_squared.toFixed(3);
    else if (isNum(m.icc)) right = 'ICC = ' + m.icc.toFixed(3);
    else if (isNum(m.att)) right = 'ATT = ' + m.att.toFixed(3);
    else if (isNum(m.max_abs_coefficient)) right = '최대 |r| = ' + m.max_abs_coefficient.toFixed(3);
    return { left: left, right: right };
  }

  /** 차트 데이터 → 표 행 배열 (중첩 구조는 차트가 실제로 쓰는 배열을 꺼낸다) */
  function dataRows(data) {
    if (Array.isArray(data) && data.length && data.every(isObj)) {
      if (Array.isArray(data[0].points)) {   // 상관 산점도: 쌍마다 점 배열 → 쌍 이름을 붙여 펼침
        var out = [];
        data.forEach(function (p) { (p.points || []).forEach(function (q) { var r = { pair: p.pair }; Object.keys(q).forEach(function (k) { r[k] = q[k]; }); out.push(r); }); });
        return out;
      }
      return data;
    }
    if (Array.isArray(data) && data.length && data.every(isNum)) return data.map(function (v, i) { return { index: i + 1, value: v }; });
    if (isObj(data)) {
      var inner = data.nodes || data.cells || data.merges;
      if (Array.isArray(inner)) return inner;
      var cr = columnsToRows(data);
      if (cr) return cr;
      var keys = Object.keys(data);
      if (keys.length && keys.every(function (k) { return isNum(data[k]); })) return keys.map(function (k) { return { label: k, value: data[k] }; });
    }
    return null;
  }
  function cellText(v) {
    if (v === null || v === undefined) return '-';
    if (isNum(v)) return String(Number.isInteger(v) ? v : Number(v.toFixed(4)));
    if (typeof v === 'boolean') return v ? '예' : '아니오';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
  function dataPanel(data) {
    var rows = dataRows(data), title, body;
    if (rows && rows.length) {
      var cols = [];
      rows.slice(0, 50).forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
      var shown = rows.slice(0, 1000);
      title = '차트 원시 데이터 (' + A.num(rows.length) + '개 행)';
      body = '<div class="rounded-xl border border-slate-200 max-h-[340px] overflow-auto"><table class="w-full text-left text-xs border-collapse"><thead class="sticky top-0 z-10"><tr class="bg-slate-50 border-b border-slate-200">' +
        cols.map(function (c) { return '<th class="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap bg-slate-50">' + A.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody class="font-mono text-slate-700">' +
        shown.map(function (r) { return '<tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">' + cols.map(function (c) { return '<td class="py-2.5 px-4 whitespace-nowrap">' + A.esc(cellText(r[c])) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>' + (rows.length > shown.length ? '<div class="text-[11px] text-slate-400 pt-1.5">상위 ' + A.num(shown.length) + '행만 표시</div>' : '');
    } else {
      title = '차트 원시 데이터';
      body = '<div class="rounded-xl border border-slate-200 p-3 max-h-[340px] overflow-auto text-[11px]">' + A.viz.tree(data, 0) + '</div>';
    }
    return '<div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"><div class="flex items-center justify-between pb-3 border-b border-slate-100"><span class="text-sm font-bold text-slate-900 flex items-center gap-2">' + A.icon('table', 'w-4 h-4 text-blue-700') + title + '</span>' +
      '<button type="button" data-cdata="1" class="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">닫기</button></div>' + body + '</div>';
  }

  /** 차트 하나를 크게 보는 상세 화면. ← 차트 목록으로 / 차트 데이터 조회 / 이전·다음 */
  function renderDetail(st) {
    destroyAll();
    var r = st.recs[st.idx], data = recData(r, st.cd), uid = 'ch-detail-' + st.idx, p = null;
    try { p = plan(r, data, uid, st.ctx); } catch (e) { p = null; }
    var body = p ? p.html : (data === undefined || data === null || (Array.isArray(data) && !data.length))
      ? '<div class="py-24 text-center text-xs text-slate-400 leading-relaxed">' + noDataMsg(r, st.ctx) + '</div>'
      : '<div class="text-[11px] text-slate-500 mb-1.5">차트로 자동 변환할 수 없는 형식이어서 원본 데이터를 표시합니다.</div>' + A.viz.tree(data, 0);
    var f = footInfo(data, st.ctx), n = st.recs.length;
    var navBtn = function (dir, icon, dis) { return '<button type="button" data-cnav="' + dir + '"' + (dis ? ' disabled' : '') + ' class="p-1.5 rounded-lg text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">' + A.icon(icon, 'w-4 h-4') + '</button>'; };
    var hasData = data !== undefined && data !== null && !(Array.isArray(data) && !data.length);
    st.root.innerHTML = '<div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">' +
      '<div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<button type="button" data-cback="1" class="px-4 py-2 bg-[#003876] hover:bg-[#002855] text-white text-sm font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0">' + A.icon('arrow-left', 'w-4 h-4') + '<span>차트 목록으로</span></button>' +
          '<span class="w-px h-6 bg-slate-200 shrink-0"></span>' +
          '<span class="text-[11px] font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shrink-0">추천 ' + (st.idx + 1) + '순위</span>' +
          '<h4 class="text-base font-bold text-slate-900 truncate">' + A.esc(recTitle(r)) + '</h4>' +
        '</div>' +
        '<div class="flex items-center gap-2 shrink-0">' +
          (hasData ? '<button type="button" data-cdata="1" class="px-3.5 py-2 rounded-xl border text-sm font-semibold flex items-center gap-1.5 cursor-pointer ' + (st.showData ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50') + '">' + A.icon(st.showData ? 'x' : 'table', 'w-4 h-4') + '<span>' + (st.showData ? '차트 데이터 닫기' : '차트 데이터 조회') + '</span></button>' : '') +
          '<div class="flex items-center gap-1 px-1.5 py-1 bg-slate-100 rounded-xl border border-slate-200">' + navBtn(-1, 'chevron-left', st.idx === 0) + '<span class="px-2 text-sm font-mono font-bold text-slate-800">' + (st.idx + 1) + ' / ' + n + '</span>' + navBtn(1, 'chevron-right', st.idx === n - 1) + '</div>' +
        '</div>' +
      '</div>' +
      (r.reason ? '<p class="text-xs text-slate-500 -mt-1">' + A.esc(r.reason) + '</p>' : '') +
      '<div class="rounded-2xl border border-slate-100 bg-slate-50/40 p-4" id="' + uid + '-wrap">' + body +
        ((f.left || f.right) ? '<div class="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-200 text-xs"><span class="text-slate-500">' + A.esc(f.left) + '</span><span class="font-mono font-bold text-slate-800">' + A.esc(f.right) + '</span></div>' : '') + '</div>' +
      (st.showData && hasData ? dataPanel(data) : '') +
      '</div>';
    if (p && p.draw && window.Highcharts) {
      var el = document.getElementById(uid);
      if (el) {
        // 상세 화면은 크게: 고정 높이 차트는 520px 로 키우고, 히트맵 스크롤 상자 제한도 넓힌다
        var h = parseInt(el.style.height, 10) || 0;
        el.classList.remove('h-64');
        el.style.height = Math.max(h, 520) + 'px';
        if (el.parentNode && el.parentNode.style && el.parentNode.style.maxHeight) el.parentNode.style.maxHeight = '640px';
        instances.push(p.draw(el));
      }
    }
    A.icons && A.icons();
  }

  function renderGallery(st) {
    destroyAll();
    var root = st.root, recs = st.recs;
    if (!recs.length) { root.innerHTML = '<div class="card-modern p-8 text-center text-xs text-slate-400">추천된 차트가 없습니다.</div>'; return; }
    var cards = recs.map(function (r, i) { return card(r, i, recData(r, st.cd), st.ctx); });
    root.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">' + cards.map(function (c, i) {
      // 카드를 누르면 상세 화면으로 (선택 상자·원본 데이터 펼치기는 제외)
      return c.html.replace('<div class="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">', '<div data-cidx="' + i + '" title="클릭하면 크게 봅니다" class="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">');
    }).join('') + '</div>';
    cards.forEach(function (c) {
      if (!c.plan || !c.plan.draw) return;
      var el = document.getElementById(c.uid);
      if (el && window.Highcharts) instances.push(c.plan.draw(el));
    });
  }

  A.charts = {
    gallery: function (root, analysis) {
      var cd = analysis.chart_data || {};
      var st = root._chartState = {
        root: root, cd: cd, idx: 0, showData: false,
        recs: (analysis.chart_recommendations || []).slice().sort(function (a, b) { return a.priority - b.priority; }),
        ctx: { result: analysis.result || {}, metrics: analysis.metrics || {}, chartData: cd, params: analysis.params || {} }
      };
      if (!root._chartBound) {
        root._chartBound = true;
        root.addEventListener('click', function (e) {
          var s = root._chartState;
          if (!s) return;
          if (e.target.closest('[data-cback]')) { renderGallery(s); return; }
          if (e.target.closest('[data-cdata]')) { s.showData = !s.showData; renderDetail(s); return; }
          var nav = e.target.closest('[data-cnav]');
          if (nav) { if (!nav.disabled) { s.idx += +nav.getAttribute('data-cnav'); s.showData = false; renderDetail(s); } return; }
          if (e.target.closest('select, details, summary, input, a, button')) return;
          var c = e.target.closest('[data-cidx]');
          if (c) { s.idx = +c.getAttribute('data-cidx'); s.showData = false; renderDetail(s); }
        });
      }
      renderGallery(st);
    }
  };
})();
