/* 3단계: 데이터 탐색(EDA) — GET /api/v1/datasets/{id}/profile, /correlation */
(function () {
  'use strict';
  var A = window.App;
  if (!A.requireDataset()) return;
  var dsId = A.state.datasetId;

  function sgn(v) { return v === null || v === undefined || isNaN(v) ? '-' : (v >= 0 ? '+' : '') + Number(v).toFixed(2); }

  function renderStats(p) {
    var nums = p.numeric || [];
    A.$('#eda-badge').innerHTML = '수치형 변수 <strong class="text-slate-900">' + nums.length + '</strong>개 · 총 <strong class="text-slate-900">' + A.num(p.n_rows) + '</strong>행';
    A.$('#stat-count').textContent = nums.length + '개 변수';
    A.$('#stat-rows').textContent = A.num(p.n_rows) + '행';
    A.$('#stat-body').innerHTML = nums.map(function (n) {
      var tot = (n.count || 0) + (n.missing || 0), ratio = tot ? (n.missing || 0) / tot * 100 : 0;
      return '<tr class="transition-colors hover:bg-blue-50/20"><td class="py-2.5 px-3 font-sans font-medium text-slate-800"><span class="truncate max-w-[180px]">' + A.esc(n.column) + '</span></td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-700">' + A.num(n.count) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right font-bold text-slate-900">' + A.num(n.mean, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-600">' + A.num(n.std, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-500">' + A.num(n.min, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-700">' + A.num(n.q1, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right font-bold text-blue-700">' + A.num(n.median, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-700">' + A.num(n.q3, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-500">' + A.num(n.max, 2) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-600">' + sgn(n.skewness) + '</td>' +
        '<td class="py-2.5 px-2.5 text-right text-slate-600">' + sgn(n.kurtosis) + '</td>' +
        '<td class="py-2.5 px-3 text-right">' + (ratio > 0 ? '<span class="text-amber-600 font-medium">' + ratio.toFixed(1) + '%</span>' : '<span class="text-emerald-600 font-medium">0%</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="12" class="py-8 text-center text-slate-400 font-sans">수치형 변수가 없습니다.</td></tr>';
  }

  var METHOD = { pearson: '피어슨 상관계수 매트릭스 (Pearson Correlation Matrix)', spearman: '스피어만 순위상관 매트릭스 (Spearman)', kendall: '켄달 순위상관 매트릭스 (Kendall)' };

  function renderCorr(c) {
    A.$('#corr-title').textContent = METHOD[c.method] || '상관계수 매트릭스';
    var cols = c.columns || [], m = c.matrix || [];
    if (!cols.length) { A.$('#corr-wrap').innerHTML = '<div class="py-6 text-center text-xs text-slate-400">상관분석이 가능한 수치형 변수가 없습니다.</div>'; A.$('#pairs-wrap').classList.add('hidden'); return; }
    var head = '<tr class="border-b border-slate-200 text-[11px]"><th class="p-2.5 text-left font-semibold text-slate-600 bg-slate-50/80 rounded-tl-lg">변수</th>' + cols.map(function (l) { return '<th class="p-2.5 font-semibold text-slate-700 truncate max-w-[90px] bg-slate-50/80" title="' + A.esc(l) + '">' + A.esc(l) + '</th>'; }).join('') + '</tr>';
    var body = cols.map(function (rl, i) {
      return '<tr class="hover:bg-slate-50/50 transition-colors"><td class="p-2.5 text-left font-sans font-medium text-slate-800 truncate max-w-[140px] bg-slate-50/30" title="' + A.esc(rl) + '">' + A.esc(rl) + '</td>' +
        cols.map(function (cl, j) {
          var v = (m[i] || [])[j];
          if (v === null || v === undefined) return '<td class="p-2.5 text-slate-300">-</td>';
          var t = Number(v).toFixed(2), cls;
          if (i === j) cls = 'bg-slate-100 text-slate-400 font-bold';
          else if (v >= 0.7) cls = 'bg-blue-100 text-blue-900 font-bold';
          else if (v >= 0.4) cls = 'bg-blue-50/70 text-blue-800 font-medium';
          else if (v <= -0.4) cls = 'bg-slate-100 text-slate-700 font-bold';
          else cls = 'text-slate-600';
          return '<td class="p-2.5 ' + cls + '">' + t + '</td>';
        }).join('') + '</tr>';
    }).join('');
    A.$('#corr-wrap').innerHTML = '<table class="w-full text-center text-xs border-collapse"><thead>' + head + '</thead><tbody class="divide-y divide-slate-100 font-mono text-xs">' + body + '</tbody></table>';

    var pairs = (c.pairs || []).slice().sort(function (a, b) { return Math.abs(b.coefficient) - Math.abs(a.coefficient); }).slice(0, 10);
    var pw = A.$('#pairs-wrap');
    pw.classList.toggle('hidden', !pairs.length);
    pw.innerHTML = pairs.length ? '<div class="text-[11px] font-bold text-slate-700 mb-1.5">상관 강도 상위 변수쌍</div><div class="grid grid-cols-1 md:grid-cols-2 gap-1.5">' + pairs.map(function (p) {
      return '<div class="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"><span class="text-slate-800 truncate">' + A.esc(p.x) + ' ↔ ' + A.esc(p.y) + '</span><span class="font-mono shrink-0 ml-2"><strong class="' + (p.coefficient >= 0 ? 'text-blue-700' : 'text-rose-600') + '">' + Number(p.coefficient).toFixed(3) + '</strong> <span class="text-slate-400">' + A.esc(p.strength) + (p.p_value !== null && p.p_value !== undefined ? ' · p ' + A.pFmt(p.p_value) : '') + '</span></span></div>';
    }).join('') + '</div>' : '';
  }

  function loadCorr() {
    return A.get('/api/v1/datasets/' + encodeURIComponent(dsId) + '/correlation' + A.qs({ method: A.$('#corr-method').value })).then(renderCorr).catch(function (e) {
      if (!A.datasetGone(e)) { A.$('#corr-wrap').innerHTML = '<div class="py-6 text-center text-xs text-rose-600">' + A.esc(e.message) + '</div>'; }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    A.$('#corr-method').addEventListener('change', loadCorr);
    var spec = A.state.preprocessing || {};
    A.get('/api/v1/datasets/' + encodeURIComponent(dsId) + '/profile' + A.qs({ outlier_method: spec.outlier_method, outlier_threshold: spec.outlier_threshold })).then(function (p) {
      renderStats(p);
      A.icons();
    }).catch(function (e) { if (!A.datasetGone(e)) A.toast(e.message, 'error'); });
    loadCorr().then(function () { A.icons(); });
    A.icons();
  });
})();
