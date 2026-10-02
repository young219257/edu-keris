/* 5단계: 결과 관리 및 패키징 — /api/v1/packages (생성·조회·재현·공유·삭제) */
(function () {
  'use strict';
  var A = window.App;
  var items = [], selected = null, detail = null, busy = null, shareOpen = false, mTab = 'metrics', aIdx = 0;
  var anCache = {};   // 분석 id → 분석 상세(계수표용). 매니페스트에는 result 가 없어서 따로 조회한다

  function notice(msg, isError) {
    A.$('#pk-notice-msg').textContent = msg;
    var n = A.$('#pk-notice');
    ['bg-emerald-50', 'border-emerald-200', 'text-emerald-900'].forEach(function (c) { n.classList.toggle(c, !isError); });
    ['bg-rose-50', 'border-rose-200', 'text-rose-800'].forEach(function (c) { n.classList.toggle(c, !!isError); });
    n.classList.remove('hidden'); n.classList.add('flex');
    setTimeout(function () { n.classList.add('hidden'); n.classList.remove('flex'); }, 4000);
  }

  /* ---------------- 목록 ---------------- */
  function loadPackages() {
    return A.get('/api/v1/packages' + A.qs({ limit: 100 })).then(function (p) {
      items = p.items || [];
      A.$('#pk-title').textContent = '저장된 분석 패키지 (' + A.num(p.total) + '건)';
      renderList();
    }).catch(function (e) { A.toast(e.message, 'error'); });
  }

  function renderList() {
    A.$('#pk-list').innerHTML = items.length ? items.map(function (it) {
      var on = selected && selected.id === it.id;
      return '<div data-id="' + A.esc(it.id) + '" class="p-3.5 rounded-xl border transition-all cursor-pointer ' + (on ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600/30' : 'border-slate-200 bg-white hover:bg-slate-50/80') + '">' +
        '<div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="text-xs font-bold text-slate-900 truncate" title="' + A.esc(it.name) + '">' + A.esc(it.name) + '</div>' +
        '<div class="text-[10px] text-slate-400 truncate">분석 ' + (it.analysis_ids || []).length + '건</div></div>' +
        '<div class="flex items-center gap-1.5 shrink-0">' + (it.share_token ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">공유 중</span>' : '') +
        '<button type="button" data-del="' + A.esc(it.id) + '" title="패키지 삭제" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer">' + A.icon('trash-2', 'w-3.5 h-3.5') + '</button></div></div>' +
        '<div class="text-[10px] text-slate-400 mt-1.5">' + A.date(it.created_at) + '</div></div>';
    }).join('') : '<div class="text-center py-10 text-slate-400 text-xs">저장된 분석 패키지가 없습니다.</div>';
  }


  /* ---------------- 패키지 매니페스트: 종합 통계 지표 / 변수 및 전처리 규칙 명세 ---------------- */
  var METHOD_NAME = { correlation: '상관분석', linear_regression: '선형 회귀분석', logistic_regression: '로지스틱 회귀분석', decision_tree_regressor: '의사결정나무 (회귀)', decision_tree_classifier: '의사결정나무 (분류)',
    kmeans: 'K-평균 군집분석', hierarchical: '계층적 군집분석', dbscan: 'DBSCAN 군집분석', pca: '주성분분석 (PCA)', anova: '분산분석 (ANOVA/ANCOVA)', multilevel: '다층모형 (HLM)', growth_curve: '성장곡선모형', psm: '성향점수매칭 (PSM)' };
  function sigCap(p) { return p == null ? '' : p < 0.001 ? 'p < 0.001 (유의)' : p < 0.01 ? 'p < 0.01 (유의)' : p < 0.05 ? 'p < 0.05 (유의)' : 'p = ' + Number(p).toFixed(3) + ' (유의하지 않음)'; }
  function confCap(p) { return p == null ? '' : p < 0.001 ? '99.9% 신뢰수준' : p < 0.01 ? '99% 신뢰수준' : p < 0.05 ? '95% 신뢰수준' : '유의수준 미달'; }
  function pctCap(v) { return (v * 100).toFixed(1) + '%'; }
  /** 지표 키 → [라벨, 캡션(값, 전체 지표), 강조색('blue'|'green'), 소수 자릿수]. 지표정리표(분석기법별지표정리.md) 기준 */
  var METRIC_META = {
    r_squared: ['결정계수 (R²)', function (v) { return '설명력 ' + pctCap(v); }, 'blue'],
    adjusted_r_squared: ['수정 R² (Adj R²)', function () { return '자유도 보정 계수'; }],
    holdout_r_squared: ['검증셋 R²', function () { return '홀드아웃 기준 설명력'; }],
    train_r_squared: ['학습셋 R²', function () { return '학습 데이터 기준'; }],
    rmse: ['RMSE (표준오차)', function () { return '평균제곱근오차'; }],
    mse: ['MSE (평균제곱오차)', function () { return '오차 제곱의 평균'; }],
    mae: ['MAE (절대오차)', function () { return '평균절대오차'; }],
    mape: ['MAPE (백분율오차)', function (v) { return '평균 ' + pctCap(v) + ' 오차'; }, null, 4],
    aic: ['AIC', function () { return '낮을수록 우수'; }, null, 2],
    bic: ['BIC', function () { return '낮을수록 우수'; }, null, 2],
    log_likelihood: ['로그 우도', function () { return 'Log-Likelihood'; }, null, 2],
    f_statistic: ['F-통계량 (F-Stat)', function (v, m) { return sigCap(m.f_pvalue); }, 'green', 2],
    f_pvalue: ['통계적 유의확률 (p)', function (v) { return confCap(v); }, 'green'],
    durbin_watson: ['Durbin-Watson', function (v) { return v >= 1.5 && v <= 2.5 ? '잔차 독립성 충족' : '자기상관 의심'; }],
    accuracy: ['정확도 (Accuracy)', function (v) { return '전체 ' + pctCap(v) + ' 정분류'; }, 'blue'],
    precision: ['정밀도 (Precision)', function () { return '양성 예측 중 적중'; }],
    recall: ['재현율 (Recall)', function () { return '실제 양성 중 적중'; }],
    f1: ['F1 점수', function () { return '정밀도·재현율 조화평균'; }],
    roc_auc: ['ROC-AUC', function () { return '분류 판별력'; }, 'green'],
    log_loss: ['Log Loss', function () { return '낮을수록 우수'; }],
    mcfadden: ['McFadden R²', function () { return '유사 결정계수'; }, 'blue'],
    llr_pvalue: ['우도비 검정 (p)', function (v) { return confCap(v); }, 'green'],
    silhouette: ['실루엣 계수', function () { return '1에 가까울수록 우수'; }, 'blue'],
    calinski_harabasz: ['Calinski-Harabasz', function () { return '클수록 우수'; }, null, 2],
    davies_bouldin: ['Davies-Bouldin', function () { return '낮을수록 우수'; }],
    inertia: ['Inertia', function () { return '군집 내 제곱합'; }, null, 2],
    n_iter: ['반복 횟수', function () { return '수렴까지'; }, null, 0],
    between_ss: ['군집 간 제곱합', function () { return 'Between SS'; }, null, 2],
    total_ss: ['총 제곱합', function () { return 'Total SS'; }, null, 2],
    variance_ratio: ['분산 설명 비율', function (v) { return '군집 간 ' + pctCap(v); }, 'blue'],
    n_clusters: ['군집 수', function () { return '최종 군집'; }, null, 0],
    n_noise: ['노이즈 수', function () { return '어느 군집에도 속하지 않음'; }, null, 0],
    noise_ratio: ['노이즈 비율', function (v) { return pctCap(v); }],
    n_components: ['주성분 수', function () { return '추출 성분'; }, null, 0],
    total_explained_variance: ['누적 설명분산', function (v) { return pctCap(v); }, 'blue'],
    first_component_ratio: ['제1주성분 비율', function (v) { return pctCap(v); }],
    n_variables: ['변수 수', function () { return '분석 변수'; }, null, 0],
    n_pairs: ['변수 쌍 수', function () { return '분석된 조합'; }, null, 0],
    n_strong_pairs: ['강한 상관 쌍', function () { return '|r| ≥ 0.7'; }, null, 0],
    max_abs_coefficient: ['최대 |r|', function () { return '가장 강한 상관'; }, 'blue'],
    n_observations: ['관측치 수', function () { return '유효 표본'; }, null, 0],
    model_r_squared: ['모형 R²', function (v) { return '설명력 ' + pctCap(v); }, 'blue'],
    n_significant_terms: ['유의한 효과 수', function () { return 'p < 0.05'; }, null, 0],
    max_eta_squared: ['최대 효과크기 (η²)', function () { return '가장 큰 효과'; }],
    levene_p_value: ['Levene 등분산 (p)', function (v) { return v >= 0.05 ? '등분산 충족' : '등분산 위배'; }, 'green'],
    n_groups: ['집단 수', function () { return '상위 수준 단위'; }, null, 0],
    icc: ['ICC', function () { return '집단 간 분산 비율'; }, 'blue'],
    unconditional_icc: ['무조건모형 ICC', function () { return '예측변수 투입 전'; }],
    n_individuals: ['개체 수', function () { return '추적 대상'; }, null, 0],
    average_growth_rate: ['평균 성장률', function (v, m) { return sigCap(m.average_growth_rate_p_value); }, 'green'],
    average_growth_rate_p_value: ['성장률 유의확률 (p)', function (v) { return confCap(v); }, 'green'],
    slope_variance: ['기울기 분산', function () { return '개체 간 성장률 차이'; }],
    n_treated: ['처치군', function () { return '처치 대상'; }, null, 0],
    n_matched_treated: ['매칭된 처치군', function () { return '매칭 성공'; }, null, 0],
    match_rate: ['매칭률', function (v) { return pctCap(v); }, 'blue'],
    mean_abs_smd_before: ['평균 |SMD| (전)', function () { return '매칭 전 불균형'; }],
    mean_abs_smd_after: ['평균 |SMD| (후)', function (v) { return v < 0.1 ? '균형 양호 (< 0.1)' : '불균형'; }, 'green'],
    att: ['처치효과 (ATT)', function (v, m) { return sigCap(m.att_p_value); }, 'green'],
    att_p_value: ['ATT 유의확률 (p)', function (v) { return confCap(v); }, 'green']
  };
  var CAP_CLS = { blue: 'text-blue-600', green: 'text-emerald-600' };

  function fmtMetric(k, v, d) {
    if (d === 0 || (Number.isInteger(v) && d === undefined)) return A.num(v);
    if (/p_?value$/.test(k) && v < 0.0001) return '< 0.0001';
    return Number(v).toFixed(d === undefined ? 4 : d);
  }
  /** 요약 지표 표: 지표 / 값 / 해석 (아래 회귀계수 표와 같은 디자인) */
  function metricCards(metrics) {
    var keys = Object.keys(metrics || {}).filter(function (k) { return typeof metrics[k] === 'number' && isFinite(metrics[k]); });
    if (!keys.length) return '<div class="py-10 text-center text-xs text-slate-400">저장된 통계 지표가 없습니다.</div>';
    var th = 'py-3 px-4 font-semibold text-slate-600 text-xs';
    var body = keys.map(function (k) {
      var meta = METRIC_META[k] || [A.viz.label(k), function () { return ''; }], v = metrics[k];
      return '<tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"><td class="py-2.5 px-4 text-sm text-slate-900">' + A.esc(meta[0]) + '</td>' +
        '<td class="py-2.5 px-4 text-right font-mono font-bold text-slate-900">' + fmtMetric(k, v, meta[3]) + '</td>' +
        '<td class="py-2.5 px-4 text-xs ' + (CAP_CLS[meta[2]] || 'text-slate-500') + '">' + A.esc(meta[1](v, metrics) || '') + '</td></tr>';
    }).join('');
    return '<div class="rounded-2xl border border-slate-200 overflow-hidden"><div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white"><span class="text-sm font-bold text-slate-900 flex items-center gap-2">' + A.icon('bar-chart-3', 'w-4 h-4 text-blue-700') + '요약 통계 지표</span><span class="text-xs text-slate-500">' + keys.length + '개 지표</span></div>' +
      '<div class="max-h-[420px] overflow-auto"><table class="w-full border-collapse"><thead class="sticky top-0"><tr class="bg-slate-50 border-b border-slate-200"><th class="' + th + ' text-left w-[38%]">지표</th><th class="' + th + ' text-right w-[22%]">값</th><th class="' + th + ' text-left">해석</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  var PREP_LABEL = {
    missing_strategy: { median: '중앙값 대체 (median)', mean: '평균값 대체 (mean)', mode: '최빈값 대체 (mode)', drop_rows: '행 제거 (drop_rows)', zero: '0 대체 (zero)', constant: '상수 대체 (constant)', none: '처리 안 함 (none)' },
    outlier_treatment: { winsorize: '윈저라이징 (winsorize)', drop: '행 제거 (drop)', log: '로그 변환 (log)', keep: '유지 (keep)', none: '유지 (none)' },
    scaling: { standard: '표준화 (standard)', minmax: '정규화 (minmax)', robust: '로버스트 (robust)', none: '미적용 (none)' },
    encoding: { onehot: '원-핫 인코딩 (onehot)', label: '라벨 인코딩 (label)', ordinal: '순서 인코딩 (ordinal)', none: '미적용 (none)' }
  };
  /** 기법별로 의미 있는 추가 파라미터 (값이 비어 있지 않을 때만 표시) */
  var PARAM_LABEL = { factors: '요인 (Factors)', covariates: '공변량 (Covariates)', group_column: '집단 변수', time_column: '시간 변수', treatment_column: '처치 변수', n_clusters: '군집 수', linkage: '연결 방법',
    eps: 'eps (반경)', min_samples: '최소 표본 수', n_components: '주성분 수', correlation_method: '상관계수 방법', max_depth: '최대 깊이', criterion: '분할 기준', positive_label: '양성 범주', caliper: '캘리퍼', n_neighbors: '매칭 이웃 수', random_slope: '확률기울기', include_interaction: '교호작용 포함', test_size: '검증셋 비율', weight_column: '가중치 변수', auto_k_range: 'K 탐색 범위' };
  var METHOD_PARAMS = { kmeans: ['n_clusters', 'auto_k_range'], hierarchical: ['n_clusters', 'linkage'], dbscan: ['eps', 'min_samples'], pca: ['n_components'], correlation: ['correlation_method'],
    decision_tree_regressor: ['max_depth', 'criterion', 'test_size'], decision_tree_classifier: ['max_depth', 'criterion', 'positive_label', 'test_size'], linear_regression: ['test_size', 'weight_column'], logistic_regression: ['positive_label', 'test_size'],
    anova: ['factors', 'covariates', 'include_interaction'], multilevel: ['group_column', 'random_slope'], growth_curve: ['group_column', 'time_column'], psm: ['treatment_column', 'caliper', 'n_neighbors'] };

  function field(label, valueHtml, extra) { return '<div class="p-3.5 rounded-xl border border-slate-200 bg-white ' + (extra || '') + '"><div class="text-[11px] text-slate-400 mb-1">' + label + '</div><div class="text-sm font-bold text-slate-900">' + valueHtml + '</div></div>'; }
  function chips(arr) { return arr.length ? '<div class="flex flex-wrap gap-1.5">' + arr.map(function (x) { return '<span class="px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 text-xs font-mono font-medium">' + A.esc(x) + '</span>'; }).join('') + '</div>' : '<span class="text-slate-400 font-normal">없음</span>'; }
  function pval(v) { return Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? '예' : '아니오') : String(v); }
  function specSection(no, title, tag, tagCls, body) {
    return '<div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"><div class="flex items-center justify-between"><h5 class="text-sm font-bold text-slate-900">' + no + '. ' + title + '</h5><span class="text-xs font-mono font-semibold ' + tagCls + '">' + tag + '</span></div>' + body + '</div>';
  }
  function specView(an) {
    var p = an.params || {}, pre = an.preprocessing || {};
    var feats = p.features || [];
    var vars = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' + field('종속변수 (Target Variable)', p.target ? A.esc(p.target) : '<span class="text-slate-400 font-normal">없음 (비지도/탐색)</span>') +
      field('분석 기법 (Algorithm)', '<span class="text-blue-700">' + A.esc(METHOD_NAME[an.method] || an.method) + '</span>') + '</div>' +
      field('독립변수 목록 (Feature Variables)', chips(feats));
    var extra = (METHOD_PARAMS[an.method] || []).filter(function (k) { var v = p[k]; return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && !(k === 'test_size' && !v); });
    if (extra.length) vars += '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">' + extra.map(function (k) {
      var v = p[k];
      return field(PARAM_LABEL[k] || k, Array.isArray(v) && k !== 'auto_k_range' ? chips(v) : A.esc(k === 'test_size' ? (v * 100) + '%' : k === 'auto_k_range' ? v.join(' ~ ') : pval(v)));
    }).join('') + '</div>';
    var lab = function (grp, v) { return A.esc((PREP_LABEL[grp] || {})[v] || (v == null ? '-' : v)); };
    var prep = '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' + field('결측치 정제', lab('missing_strategy', pre.missing_strategy)) +
      field('이상치 정제', lab('outlier_treatment', pre.outlier_treatment) + (pre.outlier_treatment && pre.outlier_treatment !== 'keep' && pre.outlier_method ? '<div class="text-[11px] font-normal text-slate-500 mt-0.5">탐지: ' + A.esc(pre.outlier_method.toUpperCase()) + (pre.outlier_threshold != null ? ' (기준 ' + A.esc(pre.outlier_threshold) + ')' : '') + '</div>' : '')) +
      field('특성 스케일링', lab('scaling', pre.scaling)) + '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' + field('범주형 인코딩', lab('encoding', pre.encoding) + (pre.drop_first ? '<div class="text-[11px] font-normal text-slate-500 mt-0.5">기준 범주 1개 제외</div>' : '')) +
      field('중복 행 제거', pre.drop_duplicates ? '적용' : '미적용') + field('행 필터', (pre.filters || []).length ? (pre.filters.length + '개 조건') : '미적용') + '</div>';
    return '<div class="space-y-4">' + specSection(1, '모델 변수 설정', 'Target &amp; Features', 'text-blue-700', vars) + specSection(2, '적용된 데이터 전처리 규칙', 'Auto-Pipeline', 'text-emerald-700', prep) + '</div>';
  }

  /** 회귀계수 표: 선형(t), 로지스틱(z), 다층·성장(fixed_effects, 검정통계량 없음) 공용 */
  function coefTable(an) {
    var d = anCache[an.id];
    if (d === undefined) {
      anCache[an.id] = null;
      A.get('/api/v1/analyses/' + encodeURIComponent(an.id)).then(function (r) { anCache[an.id] = r; renderDetail(); }).catch(function () { anCache[an.id] = false; });
      return '';
    }
    if (!d || !d.result) return '';
    var rows = d.result.coefficients || d.result.fixed_effects;
    if (!Array.isArray(rows) || !rows.length || rows[0].coefficient === undefined) return '';   // 다항 로지스틱 등 다른 구조는 생략
    var stat = rows[0].t_value !== undefined ? 't_value' : rows[0].z_value !== undefined ? 'z_value' : null;
    var hasSe = rows[0].std_error !== undefined;
    var f = function (v, n) { return v == null || isNaN(v) ? '-' : Number(v).toFixed(n); };
    var signed = function (v) { return v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3); };
    var star = function (p) { return p == null ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns'; };
    var th = 'py-3 px-4 font-semibold text-slate-600 text-xs';
    var head = '<tr class="bg-slate-50 border-b border-slate-200"><th class="' + th + ' text-left">변수명</th><th class="' + th + ' text-right">계수 (B)</th>' + (hasSe ? '<th class="' + th + ' text-right">표준오차</th>' : '') +
      (stat ? '<th class="' + th + ' text-right">' + (stat === 't_value' ? 't-값' : 'z-값') + '</th>' : '') + '<th class="' + th + ' text-right">p-값</th><th class="' + th + ' text-center">유의수준</th></tr>';
    var body = rows.map(function (r) {
      var st = star(r.p_value);
      return '<tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"><td class="py-3 px-4 text-sm text-slate-900">' + A.esc(r.source_variable || r.term) + '</td>' +
        '<td class="py-3 px-4 text-right font-mono font-bold text-blue-700">' + signed(r.coefficient) + '</td>' +
        (hasSe ? '<td class="py-3 px-4 text-right font-mono text-slate-500">' + f(r.std_error, 3) + '</td>' : '') +
        (stat ? '<td class="py-3 px-4 text-right font-mono text-slate-800">' + (r[stat] == null ? '-' : (r[stat] < 0 ? '−' : '') + Math.abs(r[stat]).toFixed(2)) + '</td>' : '') +
        '<td class="py-3 px-4 text-right font-mono text-emerald-700">' + (r.p_value == null ? '-' : r.p_value < 0.0001 ? '&lt; 0.0001' : f(r.p_value, 4)) + '</td>' +
        '<td class="py-3 px-4 text-center font-mono font-bold ' + (st === 'ns' ? 'text-amber-600' : 'text-orange-500') + '">' + st + '</td></tr>';
    }).join('');
    return '<div class="rounded-2xl border border-slate-200 overflow-hidden"><div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white"><span class="text-sm font-bold text-slate-900 flex items-center gap-2">' + A.icon('table', 'w-4 h-4 text-blue-700') + '주요 변수별 회귀계수 및 유의성 검정</span><span class="text-xs text-slate-500">신뢰구간: <span class="font-mono">95%</span></span></div>' +
      '<div class="max-h-[420px] overflow-auto"><table class="w-full border-collapse"><thead class="sticky top-0">' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100 bg-slate-50/50">*** p &lt; 0.001, ** p &lt; 0.01, * p &lt; 0.05, ns 유의하지 않음' + (stat === 'z_value' ? ' · 로지스틱 회귀 계수(로그 오즈)' : '') + '</div></div>';
  }

  function manifestView(s) {
    var list = (s.manifest && s.manifest.analyses) || [];
    if (!list.length) return '<div class="py-10 text-center text-xs text-slate-400">' + (s.manifest ? '매니페스트에 분석 정보가 없습니다.' : '매니페스트를 불러오는 중...') + '</div>';
    if (aIdx >= list.length) aIdx = 0;
    var an = list[aIdx];
    var picker = list.length > 1 ? '<div class="flex flex-wrap gap-1.5">' + list.map(function (x, i) {
      return '<button type="button" data-aidx="' + i + '" class="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ' + (i === aIdx ? 'bg-[#003876] text-white border-[#003876]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50') + '">' + A.esc(METHOD_NAME[x.method] || x.name || ('분석 ' + (i + 1))) + '</button>';
    }).join('') + '</div>' : '';
    var tabBtn = function (id, icon, label) {
      var on = mTab === id;
      return '<button type="button" data-mtab="' + id + '" class="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ' + (on ? 'bg-white text-[#003876] border-2 border-[#003876]/80 shadow-xs' : 'text-slate-500 hover:text-slate-800 border-2 border-transparent') + '">' + A.icon(icon, 'w-4 h-4') + '<span>' + label + '</span></button>';
    };
    var tabs = '<div class="flex gap-1.5 p-1.5 bg-slate-100/80 border border-slate-200 rounded-2xl">' + tabBtn('metrics', 'bar-chart-3', '종합 통계 지표 및 해석') + tabBtn('spec', 'sliders-horizontal', '변수 및 전처리 규칙 명세') + '</div>';
    return '<div class="space-y-3">' + picker + tabs + (mTab === 'metrics' ? '<div class="space-y-4">' + metricCards(an.metrics) + coefTable(an) + '</div>' : specView(an)) + '</div>';
  }

  /* ---------------- 상세 ---------------- */
  function renderDetail() {
    var box = A.$('#pk-detail');
    if (!selected) { box.innerHTML = '<div class="p-12 text-center text-slate-400">분석 패키지를 선택해 주세요.</div>'; return; }
    var s = detail && detail.id === selected.id ? detail : selected;
    var shareUrl = s.share_token ? location.origin + A.ctx + '/api/v1/shared/' + encodeURIComponent(s.share_token) : null;
    var head = '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200"><div class="space-y-1 min-w-0">' +
      '<h3 class="text-base font-bold text-slate-900 tracking-tight">' + A.esc(s.name) + '</h3>' +
      (s.description ? '<p class="text-xs text-slate-500">' + A.esc(s.description) + '</p>' : '') +
      '<div class="text-[11px] text-slate-500 font-mono">' + A.date(s.created_at) + '</div></div>' +
      '<div class="flex items-center gap-2 shrink-0">' +
      '<button type="button" data-act="share" title="' + (s.share_token ? '공유 링크 보기' : '공유 링크 발급') + '" class="p-2 rounded-xl border transition-colors cursor-pointer ' + (shareOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50') + '">' + A.icon('share-2', 'w-4 h-4') + '</button>' +
      '<button type="button" data-act="reproduce" ' + (busy ? 'disabled' : '') + ' class="px-3.5 py-2 bg-[#003876] hover:bg-[#002855] disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0">' + A.icon('rotate-ccw', 'w-3.5 h-3.5') + '<span>' + (busy === 'reproduce' ? '이동 중...' : '이 조건으로 재현 실행') + '</span></button></div></div>';

    var shareBox = '';
    if (shareOpen && shareUrl) {
      shareBox = '<div class="p-3 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2"><div class="flex items-center gap-2"><input readonly value="' + A.esc(shareUrl) + '" class="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-700">' +
        '<button type="button" data-act="copy" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer shrink-0 flex items-center gap-1">' + A.icon('copy', 'w-3.5 h-3.5') + '<span>복사</span></button></div>' +
        '<div class="flex items-center justify-between gap-2"><span class="text-[10px] text-slate-500">공유 링크는 세션이 종료되어도 7일간 유지됩니다. 링크로는 읽기 전용 조회만 가능합니다.</span>' +
        '<button type="button" data-act="unshare" class="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer shrink-0">공유 해제</button></div></div>';
    }

    var manifest = manifestView(s);

    var exportBox = '<div class="pt-4 border-t border-slate-200 space-y-2.5"><span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">' + A.icon('download', 'w-3.5 h-3.5 text-blue-700') + '내보내기</span>' +
      '<div class="grid grid-cols-2 gap-2.5">' +
      '<button type="button" data-act="pdf" class="p-3 bg-red-50/80 hover:bg-red-100/90 text-red-800 border border-red-200 rounded-xl text-xs font-bold cursor-pointer text-left"><span class="block">PDF 보고서</span><span class="block text-[10px] font-normal opacity-80 mt-0.5">' + (busy === 'pdf' ? '생성 중...' : '종합 요약 · 지표 · 결과표') + '</span></button>' +
      '<button type="button" data-act="excel" class="p-3 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer text-left"><span class="block">Excel 통계표</span><span class="block text-[10px] font-normal opacity-80 mt-0.5">' + (busy === 'excel' ? '생성 중...' : '다중 시트 결과표') + '</span></button></div></div>';

    box.innerHTML = head + shareBox + manifest + exportBox;
    A.icons();
  }

  function select(id) {
    selected = items.filter(function (i) { return i.id === id; })[0] || null;
    detail = null;
    renderList();
    renderDetail();
    if (selected) A.get('/api/v1/packages/' + encodeURIComponent(id)).then(function (d) { detail = d; renderDetail(); }).catch(function (e) { A.toast(e.message, 'error'); });
  }

  function refreshSelected(p) {
    detail = p;
    items = items.map(function (i) { return i.id === p.id ? p : i; });
    selected = p;
    renderList();
    renderDetail();
  }


  /** 재현: 선택한 분석의 데이터셋·변수·파라미터·전처리를 작업 상태로 복원하고 4-1단계(모형 설정·실행)로 이동한다.
   *  실행은 4-1단계에서 사용자가 직접 누른다. */
  function reproduce() {
    var s = detail && detail.id === selected.id ? detail : selected;
    var list = (s.manifest && s.manifest.analyses) || [];
    var an = list[aIdx] || list[0];
    if (!an) { notice('패키지에 재현할 분석 정보가 없습니다.'); return; }
    var ds = (s.manifest && s.manifest.dataset) || {};
    var dsId = ds.id || s.dataset_id;
    var p = an.params || {};
    busy = 'reproduce'; renderDetail();
    // 원본 데이터셋이 현재 세션에 남아 있는지 먼저 확인
    A.get('/api/v1/datasets/' + encodeURIComponent(dsId)).then(function (d) {
      var params = {};
      Object.keys(p).forEach(function (k) { if (k !== 'target' && k !== 'features' && p[k] !== null) params[k] = p[k]; });
      if (p.auto_k_range) params.auto_k = true;   // 4-1단계 UI 는 auto_k 체크박스로 auto_k_range 를 만든다
      A.saveState({
        datasetId: d.id, datasetName: d.name, datasetRows: d.n_rows, analysisId: null,
        config: { method: an.method, target: p.target || '', features: (p.features || []).slice(), params: params },
        preprocessing: an.preprocessing || {}
      });
      location.href = A.ctx + '/analysis/step4';
    }).catch(function () {
      busy = null; renderDetail();
      notice('원본 데이터셋(' + (ds.name || '-') + ')이 현재 세션에 없어 재현할 수 없습니다. 1단계에서 데이터를 다시 반입해 주세요.', true);
    });
  }

  function removePackage(id) {
    var it = items.filter(function (i) { return i.id === id; })[0];
    if (!it || !window.confirm("'" + it.name + "' 패키지를 삭제할까요?")) return;
    A.del('/api/v1/packages/' + encodeURIComponent(id)).then(function () {
      notice('패키지가 삭제되었습니다.');
      var wasSel = selected && selected.id === id;
      if (wasSel) { selected = null; detail = null; shareOpen = false; }
      return loadPackages().then(function () { if (wasSel && items.length) select(items[0].id); else renderDetail(); });
    }).catch(function (err) { A.toast(err.message, 'error'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    A.$('#pk-list').addEventListener('click', function (e) {
      var c = e.target.closest('[data-id]');
      var d = e.target.closest('[data-del]');
      if (d) { e.stopPropagation(); removePackage(d.getAttribute('data-del')); return; }
      if (c) { shareOpen = false; aIdx = 0; select(c.getAttribute('data-id')); }
    });
    A.$('#pk-detail').addEventListener('click', function (e) {
      var mt = e.target.closest('[data-mtab]'), ai = e.target.closest('[data-aidx]');
      if (mt) { mTab = mt.getAttribute('data-mtab'); renderDetail(); return; }
      if (ai) { aIdx = +ai.getAttribute('data-aidx'); renderDetail(); return; }
      var b = e.target.closest('[data-act]');
      if (!b || !selected) return;
      var act = b.getAttribute('data-act'), id = selected.id, p = '/api/v1/packages/' + encodeURIComponent(id);
      if (act === 'reproduce') {
        if (!busy) reproduce();
      } else if ((act === 'pdf' || act === 'excel') && !busy) {
        busy = act; renderDetail();
        A.downloadFile('GET', '/export/package/' + encodeURIComponent(id) + '/' + act, null, (selected.name || 'package').replace(/[\\/:*?"<>|]/g, '_') + (act === 'pdf' ? '.pdf' : '.xlsx'))
          .then(function (name) { notice("'" + name + "' 파일이 다운로드되었습니다."); })
          .catch(function (err) { A.toast(err.message, 'error'); }).then(function () { busy = null; renderDetail(); });
      } else if (act === 'share') {
        var cur = detail && detail.id === id ? detail : selected;
        if (cur.share_token) { shareOpen = !shareOpen; renderDetail(); return; }   // 이미 발급된 링크는 열고 닫기만
        A.post(p + '/share', {}).then(function () { return A.get(p); }).then(function (d) { shareOpen = true; refreshSelected(d); }).catch(function (err) { A.toast(err.message, 'error'); });
      } else if (act === 'unshare') {
        A.del(p + '/share').then(function () { return A.get(p); }).then(function (d) { shareOpen = false; refreshSelected(d); notice('공유가 해제되었습니다.'); }).catch(function (err) { A.toast(err.message, 'error'); });
      } else if (act === 'copy') {
        var inp = A.$('#pk-detail input[readonly]');
        var done = function () { var sp = b.querySelector('span'); if (sp) { sp.textContent = '복사됨'; setTimeout(function () { sp.textContent = '복사'; }, 1500); } };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, done); else { inp.select(); document.execCommand('copy'); done(); }
      }
    });

    loadPackages().then(function () {
      if (items.length) select(items[0].id); else renderDetail();
    });
    A.icons();
  });
})();
