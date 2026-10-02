/* 범용 결과 렌더러 — API 의 metrics / result / chart_data 는 기법마다 구조가 달라 키·값을 그대로 표·트리로 보여준다 */
(function () {
  'use strict';
  var A = window.App;
  var V = A.viz = {};

  var LABELS = {
    r2: 'R²', r_squared: 'R²', adj_r2: '수정 R²', adj_r_squared: '수정 R²', adjusted_r_squared: '수정 R²', holdout_r_squared: '검증 R²',
    rmse: 'RMSE', mae: 'MAE', mse: 'MSE', mape: 'MAPE',
    accuracy: '정확도', precision: '정밀도', recall: '재현율', f1: 'F1', f1_score: 'F1', auc: 'AUC', roc_auc: 'ROC-AUC',
    n_samples: '표본 수', n_obs: '관측치 수', n_observations: '관측치 수', n: 'N', n_features: '변수 수', n_clusters: '군집 수',
    aic: 'AIC', bic: 'BIC', log_likelihood: '로그우도', p_value: 'p-value', f_statistic: 'F-통계량', f_pvalue: 'F p-value',
    durbin_watson: 'Durbin-Watson', evaluation: '평가 기준', weighted: '가중 적용',
    silhouette: '실루엣', silhouette_score: '실루엣', inertia: 'WCSS(군집내 제곱합)', explained_variance_ratio: '설명 분산 비율',
    coefficients: '회귀계수', intercept: '절편', feature_importance: '변수 중요도', feature_importances: '변수 중요도',
    train_size: '학습 표본', test_size: '검증 표본', n_train: '학습 표본', n_test: '검증 표본',
    predicted: '예측값', residual: '잔차', diagnostics: '진단', normality: '정규성 검정', homoscedasticity: '등분산성 검정', vif: 'VIF'
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

  /** 스칼라 값만 정사각형 칩으로 (중첩 객체는 제외) */
  V.metricsGrid = function (obj, limit) {
    var keys = Object.keys(obj || {}).filter(function (k) { return V.isPrim(obj[k]); }).slice(0, limit || 16);
    if (!keys.length) return '';
    return '<div class="flex flex-wrap gap-2">' + keys.map(function (k, i) {
      var v = obj[k], isP = P_KEYS.indexOf(k) >= 0 && typeof v === 'number';
      var text = V.fmt(v) + (isP ? stars(v) : '');
      var hi = i === 0;
      return '<div class="w-20 h-20 shrink-0 flex flex-col items-center justify-center text-center gap-0.5 rounded-xl border px-1 ' + (hi ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200/80') + '">' +
        '<span class="text-[10px] font-semibold leading-tight line-clamp-2 ' + (hi ? 'text-blue-700/80' : 'text-slate-500') + '" title="' + A.esc(k) + '">' + A.esc(V.label(k)) + '</span>' +
        '<span class="text-sm font-extrabold font-mono ' + (hi ? 'text-blue-800' : 'text-slate-900') + '">' + text + '</span></div>';
    }).join('') + '</div>';
  };

  function isPrimArray(v) { return Array.isArray(v) && v.every(V.isPrim); }
  function isPlainObjAllPrim(v) { return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(function (k) { return V.isPrim(v[k]); }); }
  /** 값이 전부 스칼라인 평범한 객체는 JSON 대신 "라벨: 값 · 라벨: 값" 형태로 읽기 쉽게 압축 */
  function compactObj(v, max) {
    var keys = Object.keys(v);
    var shown = keys.slice(0, max || 3).map(function (k) { return V.label(k) + ' ' + V.fmt(v[k]); });
    return shown.join(' · ') + (keys.length > (max || 3) ? ' …' : '');
  }
  function tableCell(v) {
    if (V.isPrim(v)) return V.fmt(v);
    if (isPlainObjAllPrim(v)) return '<span class="text-slate-600">' + A.esc(compactObj(v)) + '</span>';
    if (isPrimArray(v)) return '<span class="text-slate-600">[' + v.slice(0, 5).map(V.fmt).join(', ') + (v.length > 5 ? ' …' : '') + ']</span>';
    return '<span class="text-slate-400">' + A.esc(JSON.stringify(v).slice(0, 60)) + '</span>';
  }

  var TH_CLS = 'py-2 px-2.5 font-bold text-slate-700 whitespace-nowrap border border-slate-200 bg-slate-100 text-center';
  var TD_CLS = 'py-1.5 px-2.5 whitespace-nowrap text-slate-700 border border-slate-200/90';

  /** 객체 배열 → 표 (SPSS 스타일 격자) */
  V.table = function (rows, maxRows) {
    rows = rows || [];
    if (!rows.length) return '<div class="text-[11px] text-slate-400 p-2">데이터 없음</div>';
    var cols = [];
    rows.slice(0, 30).forEach(function (r) { Object.keys(r || {}).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    var shown = rows.slice(0, maxRows || 200);
    return '<div class="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-lg"><table class="w-full text-[11px] text-left border-collapse"><thead class="sticky top-0"><tr>' +
      cols.map(function (c) { return '<th class="' + TH_CLS + '">' + A.esc(V.label(c)) + '</th>'; }).join('') + '</tr></thead><tbody class="font-mono">' +
      shown.map(function (r) {
        return '<tr class="hover:bg-blue-50/40 transition-colors">' + cols.map(function (c) {
          return '<td class="' + TD_CLS + '">' + tableCell(r[c]) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' + (rows.length > shown.length ? '<div class="text-[10px] text-slate-400 mt-1">상위 ' + shown.length + ' / ' + rows.length + '행 표시</div>' : '');
  };

  function isRowArray(v) { return Array.isArray(v) && v.length && v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }); }
  function isMatrix(v) { return Array.isArray(v) && v.length && v.every(function (r) { return isPrimArray(r); }) && Array.isArray(v[0]); }

  /** 임의 JSON → 접이식 트리 */
  V.tree = function (val, depth, open) {
    depth = depth || 0;
    if (V.isPrim(val)) return '<span class="font-mono text-slate-800">' + V.fmt(val) + '</span>';
    if (isPrimArray(val)) {
      var s = val.slice(0, 40).map(V.fmt).join(', ');
      return '<span class="font-mono text-slate-700 text-[11px]">[' + s + (val.length > 40 ? ' … (' + val.length + '개)' : '') + ']</span>';
    }
    if (isMatrix(val)) return '<div class="overflow-x-auto"><table class="text-[11px] font-mono border-collapse"><tbody>' + val.slice(0, 50).map(function (r) { return '<tr>' + r.slice(0, 30).map(function (c) { return '<td class="px-2 py-1 border border-slate-200 text-center">' + V.fmt(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (isRowArray(val)) return V.table(val);
    var entries = Array.isArray(val) ? val.map(function (x, i) { return [String(i), x]; }) : Object.keys(val).map(function (k) { return [k, val[k]]; });
    return '<div class="space-y-1.5 ' + (depth ? 'pl-3 border-l-2 border-slate-100' : '') + '">' + entries.map(function (e) {
      var v = e[1];
      if (V.isPrim(v)) return '<div class="flex gap-2 text-[11px] py-0.5"><span class="text-slate-500 shrink-0 min-w-[110px] font-medium">' + A.esc(V.label(e[0])) + '</span><span class="font-mono text-slate-900 font-semibold">' + V.fmt(v) + '</span></div>';
      if (isPrimArray(v)) return '<div class="flex gap-2 text-[11px] py-0.5"><span class="text-slate-500 shrink-0 min-w-[110px] font-medium">' + A.esc(V.label(e[0])) + '</span>' + V.tree(v, depth + 1) + '</div>';
      return '<details class="text-[11px] bg-slate-50/60 rounded-lg px-2.5 py-1.5 border border-slate-100"' + (open || depth < 1 ? ' open' : '') + '><summary class="cursor-pointer font-bold text-slate-800 py-0.5">' + A.esc(V.label(e[0])) + ' <span class="text-slate-400 font-normal">' + (Array.isArray(v) ? '(' + v.length + ')' : '') + '</span></summary><div class="pt-1.5">' + V.tree(v, depth + 1) + '</div></details>';
    }).join('') + '</div>';
  };
})();
