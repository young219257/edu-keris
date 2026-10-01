/* 범용 결과 렌더러 — API 의 metrics / result / chart_data 는 기법마다 구조가 달라 키·값을 그대로 표·트리로 보여준다 */
(function () {
  'use strict';
  var A = window.App;
  var V = A.viz = {};

  var LABELS = {
    r2: 'R²', r_squared: 'R²', adj_r2: '수정 R²', adj_r_squared: '수정 R²', rmse: 'RMSE', mae: 'MAE', mse: 'MSE',
    accuracy: '정확도', precision: '정밀도', recall: '재현율', f1: 'F1', f1_score: 'F1', auc: 'AUC', roc_auc: 'ROC-AUC',
    n_samples: '표본 수', n_obs: '관측치 수', n: 'N', n_features: '변수 수', n_clusters: '군집 수',
    aic: 'AIC', bic: 'BIC', log_likelihood: '로그우도', p_value: 'p-value', f_statistic: 'F-통계량', f_pvalue: 'F p-value',
    silhouette: '실루엣', silhouette_score: '실루엣', inertia: 'WCSS(군집내 제곱합)', explained_variance_ratio: '설명 분산 비율',
    coefficients: '회귀계수', intercept: '절편', feature_importance: '변수 중요도', feature_importances: '변수 중요도',
    train_size: '학습 표본', test_size: '검증 표본', n_train: '학습 표본', n_test: '검증 표본'
  };
  V.label = function (k) {
    if (LABELS[k]) return LABELS[k];
    return String(k).replace(/_/g, ' ');
  };
  V.fmt = function (v) {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'boolean') return v ? '예' : '아니오';
    if (typeof v === 'number') return isFinite(v) ? (Math.abs(v) >= 1000 || Number.isInteger(v) ? A.num(v, Number.isInteger(v) ? 0 : 2) : String(Math.round(v * 10000) / 10000)) : '-';
    return A.esc(v);
  };
  V.isPrim = function (v) { return v === null || typeof v !== 'object'; };

  var P_KEYS = ['p_value', 'f_pvalue', 'pvalue'];
  function stars(p) { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : ''; }

  /** 스칼라 값만 카드로 (중첩 객체는 제외) */
  V.metricsGrid = function (obj, limit) {
    var keys = Object.keys(obj || {}).filter(function (k) { return V.isPrim(obj[k]); }).slice(0, limit || 16);
    if (!keys.length) return '';
    return '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">' + keys.map(function (k, i) {
      var v = obj[k], isP = P_KEYS.indexOf(k) >= 0 && typeof v === 'number';
      var text = V.fmt(v) + (isP ? stars(v) : '');
      var hi = i === 0;
      return '<div class="rounded-xl p-3 border transition-shadow hover:shadow-sm ' + (hi ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200/80') + '">' +
        '<div class="text-[10px] font-semibold uppercase tracking-wide truncate ' + (hi ? 'text-blue-700/80' : 'text-slate-400') + '" title="' + A.esc(k) + '">' + A.esc(V.label(k)) + '</div>' +
        '<div class="text-base font-extrabold mt-1 font-mono ' + (hi ? 'text-blue-800' : 'text-slate-900') + '">' + text + '</div></div>';
    }).join('') + '</div>';
  };

  /** 객체 배열 → 표 */
  V.table = function (rows, maxRows) {
    rows = rows || [];
    if (!rows.length) return '<div class="text-[11px] text-slate-400 p-2">데이터 없음</div>';
    var cols = [];
    rows.slice(0, 30).forEach(function (r) { Object.keys(r || {}).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    var shown = rows.slice(0, maxRows || 200);
    return '<div class="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-xl"><table class="w-full text-[11px] text-left border-collapse"><thead class="bg-slate-100/90 sticky top-0"><tr>' +
      cols.map(function (c) { return '<th class="py-2 px-2.5 font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">' + A.esc(V.label(c)) + '</th>'; }).join('') + '</tr></thead><tbody class="font-mono">' +
      shown.map(function (r, i) {
        return '<tr class="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors ' + (i % 2 ? 'bg-slate-50/50' : 'bg-white') + '">' + cols.map(function (c) {
          var v = r[c];
          return '<td class="py-1.5 px-2.5 whitespace-nowrap text-slate-700">' + (V.isPrim(v) ? V.fmt(v) : '<span class="text-slate-400">' + A.esc(JSON.stringify(v).slice(0, 60)) + '</span>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' + (rows.length > shown.length ? '<div class="text-[10px] text-slate-400 mt-1">상위 ' + shown.length + ' / ' + rows.length + '행 표시</div>' : '');
  };

  function isRowArray(v) { return Array.isArray(v) && v.length && v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }); }
  function isPrimArray(v) { return Array.isArray(v) && v.every(V.isPrim); }
  function isMatrix(v) { return Array.isArray(v) && v.length && v.every(function (r) { return isPrimArray(r); }) && Array.isArray(v[0]); }

  /** 임의 JSON → 접이식 트리 */
  V.tree = function (val, depth, open) {
    depth = depth || 0;
    if (V.isPrim(val)) return '<span class="font-mono text-slate-800">' + V.fmt(val) + '</span>';
    if (isPrimArray(val)) {
      var s = val.slice(0, 40).map(V.fmt).join(', ');
      return '<span class="font-mono text-slate-700 text-[11px]">[' + s + (val.length > 40 ? ' … (' + val.length + '개)' : '') + ']</span>';
    }
    if (isMatrix(val)) return '<div class="overflow-x-auto"><table class="text-[11px] font-mono border border-slate-200"><tbody>' + val.slice(0, 50).map(function (r) { return '<tr>' + r.slice(0, 30).map(function (c) { return '<td class="px-2 py-0.5 border border-slate-100">' + V.fmt(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (isRowArray(val)) return V.table(val);
    var entries = Array.isArray(val) ? val.map(function (x, i) { return [String(i), x]; }) : Object.keys(val).map(function (k) { return [k, val[k]]; });
    return '<div class="space-y-1 ' + (depth ? 'pl-3 border-l border-slate-200' : '') + '">' + entries.map(function (e) {
      var v = e[1];
      if (V.isPrim(v) || isPrimArray(v)) return '<div class="flex gap-2 text-[11px]"><span class="text-slate-500 shrink-0 min-w-[90px]">' + A.esc(V.label(e[0])) + '</span>' + V.tree(v, depth + 1) + '</div>';
      return '<details class="text-[11px]"' + (open || depth < 1 ? ' open' : '') + '><summary class="cursor-pointer font-semibold text-slate-700 py-0.5">' + A.esc(V.label(e[0])) + ' <span class="text-slate-400 font-normal">' + (Array.isArray(v) ? '(' + v.length + ')' : '') + '</span></summary><div class="pt-1">' + V.tree(v, depth + 1) + '</div></details>';
    }).join('') + '</div>';
  };
})();
