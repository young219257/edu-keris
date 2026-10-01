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
      html: box(uid),
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

  /** 반환: { html, draw(container) } 또는 null(그릴 수 없음 → 원본 표시) */
  function plan(rec, data, uid) {
    if (data === undefined || data === null) return null;
    if (isObj(data) && isMatrix(data.matrix || data.values)) return heat(data.matrix || data.values, data.x_labels || data.labels || data.columns, data.y_labels || data.labels || data.columns, rec);
    if (isMatrix(data)) return heat(data, null, null, rec);

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

  function card(rec, idx, data) {
    var uid = 'ch-' + idx, p = null, body, raw = '';
    try { p = plan(rec, data, uid); } catch (e) { p = null; }
    if (p) body = p.html;
    else if (data === undefined || data === null) body = '<div class="py-8 text-center text-xs text-slate-400">이 차트에 대한 데이터(chart_data' + (rec.data_key ? '.' + A.esc(rec.data_key) : '') + ')가 없습니다.</div>';
    else body = '<div class="text-[11px] text-slate-500 mb-1.5">차트로 자동 변환할 수 없는 형식이어서 원본 데이터를 표시합니다.</div>' + A.viz.tree(data, 0);
    if (p && p.draw && data !== undefined && data !== null) raw = '<details class="mt-2 text-[11px]"><summary class="cursor-pointer text-slate-500">원본 데이터 보기</summary><div class="pt-1.5 max-h-56 overflow-y-auto">' + A.viz.tree(data, 0) + '</div></details>';
    var badge = '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">' + (idx + 1) + '순위</span>';
    return { uid: uid, plan: p, html: '<div class="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs"><div class="flex items-start justify-between gap-2 mb-2"><div class="min-w-0"><div class="flex items-center gap-1.5">' + badge + '<h5 class="text-xs font-bold text-slate-900 truncate">Figure ' + (idx + 1) + '. ' + A.esc(rec.title) + '</h5></div><p class="text-[11px] text-slate-500 mt-0.5">' + A.esc(rec.reason) + '</p></div><span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">' + A.esc(KIND_LABEL[rec.kind] || rec.kind) + '</span></div>' + body + raw + '</div>' };
  }

  A.charts = {
    gallery: function (root, analysis) {
      destroyAll();
      var recs = (analysis.chart_recommendations || []).slice().sort(function (a, b) { return a.priority - b.priority; });
      var cd = analysis.chart_data || {};
      if (!recs.length) { root.innerHTML = '<div class="card-modern p-8 text-center text-xs text-slate-400">추천된 차트가 없습니다.</div>'; return; }
      var cards = recs.map(function (r, i) {
        var data = r.data_key ? cd[r.data_key] : undefined;
        if (data === undefined) data = cd[r.kind];
        return card(r, i, data);
      });
      root.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">' + cards.map(function (c) { return c.html; }).join('') + '</div>';
      cards.forEach(function (c) {
        if (!c.plan || !c.plan.draw) return;
        var el = document.getElementById(c.uid);
        if (el && window.Highcharts) instances.push(c.plan.draw(el));
      });
    }
  };
})();
