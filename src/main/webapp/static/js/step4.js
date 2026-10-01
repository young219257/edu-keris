/* 4-1단계: 통계 모형 설정 및 실행 — POST /api/v1/analyses, GET /api/v1/analyses */
(function () {
  'use strict';
  var A = window.App;
  if (!A.requireDataset()) return;
  var dsId = A.state.datasetId;

  var CAT_CLS = { '기초': 'bg-blue-50 text-blue-700', '예측': 'bg-indigo-50 text-indigo-700', '군집': 'bg-purple-50 text-purple-700', '고급': 'bg-emerald-50 text-emerald-700' };
  /* API AnalysisMethod 14종. fields = AnalysisParams 중 화면에 노출할 항목 */
  var METHODS = [
    { id: 'correlation', name: '상관분석', en: 'Correlation', cat: '기초', icon: 'network', desc: '변수 간 상관계수 행렬', target: false, feat: '투입 변수 (Variables)', fields: ['correlation_method'] },
    { id: 'linear_regression', name: '선형회귀', en: 'Linear Regression', cat: '예측', icon: 'trending-up', desc: '연속형 종속변수 예측', target: true, feat: '독립변수 (Features / X)', fields: ['weight_column', 'test_size', 'fit_intercept'] },
    { id: 'logistic_regression', name: '로지스틱 회귀', en: 'Logistic Regression', cat: '예측', icon: 'git-branch', desc: '이진 범주 확률 예측', target: true, feat: '독립변수 (Features / X)', fields: ['positive_label', 'weight_column', 'test_size', 'max_iter'] },
    { id: 'decision_tree_regressor', name: '의사결정나무(회귀)', en: 'Decision Tree Regressor', cat: '예측', icon: 'git-branch', desc: '규칙 기반 연속형 예측', target: true, feat: '독립변수 (Features / X)', fields: ['max_depth', 'min_samples_leaf', 'ccp_alpha', 'test_size'] },
    { id: 'decision_tree_classifier', name: '의사결정나무(분류)', en: 'Decision Tree Classifier', cat: '예측', icon: 'git-branch', desc: '규칙 기반 범주 분류', target: true, feat: '독립변수 (Features / X)', fields: ['positive_label', 'max_depth', 'min_samples_leaf', 'ccp_alpha', 'test_size'] },
    { id: 'kmeans', name: 'K-평균 군집', en: 'K-Means', cat: '군집', icon: 'pie-chart', desc: '유사 관측치 K개 군집화', target: false, feat: '투입 변수 (Variables)', fields: ['n_clusters', 'auto_k', 'label_columns'] },
    { id: 'hierarchical', name: '계층적 군집', en: 'Hierarchical', cat: '군집', icon: 'network', desc: '덴드로그램 기반 군집', target: false, feat: '투입 변수 (Variables)', fields: ['n_clusters', 'linkage', 'label_columns'] },
    { id: 'dbscan', name: 'DBSCAN', en: 'DBSCAN', cat: '군집', icon: 'pie-chart', desc: '밀도 기반 군집·노이즈 탐지', target: false, feat: '투입 변수 (Variables)', fields: ['eps', 'min_samples', 'label_columns'] },
    { id: 'pca', name: '주성분분석', en: 'PCA', cat: '기초', icon: 'layers', desc: '차원 축소·요인 구조 파악', target: false, feat: '투입 변수 (Variables)', fields: ['n_components'] },
    { id: 'anova', name: '분산분석 (ANOVA/ANCOVA)', en: 'ANOVA', cat: '고급', icon: 'award', desc: '집단 간 평균 차이 검정', target: true, feat: '추가 독립변수 (선택)', fields: ['factors', 'covariates', 'include_interaction'], featOptional: true },
    { id: 'multilevel', name: '다층모형 (HLM)', en: 'Multilevel', cat: '고급', icon: 'layers', desc: '집단 내 위계 구조 반영 회귀', target: true, feat: '고정효과 변수', fields: ['group_column', 'random_slope'] },
    { id: 'growth_curve', name: '성장곡선모형', en: 'Growth Curve', cat: '고급', icon: 'trending-up', desc: '시간에 따른 변화 궤적', target: true, feat: '추가 독립변수 (선택)', fields: ['time_column', 'group_column'], featOptional: true },
    { id: 'psm', name: '성향점수매칭 (PSM)', en: 'Propensity Score Matching', cat: '고급', icon: 'award', desc: '처치 효과 추정을 위한 매칭', target: true, feat: '공변량 (Covariates / X)', fields: ['treatment_column', 'caliper', 'n_neighbors'] }
  ];
  var FIELDS = {
    test_size: { t: 'select', label: '검증(홀드아웃) 비율', def: 0, num: true, opts: [[0, '사용 안 함 (전체 적합)'], [0.2, '20%'], [0.3, '30%']] },
    fit_intercept: { t: 'check', label: '절편 포함', def: true },
    positive_label: { t: 'text', label: '양성(1) 클래스 값 (선택)', ph: '예: 1 / Y / 합격' },
    weight_column: { t: 'col', label: '가중치 변수 (선택)', from: 'numeric' },
    max_iter: { t: 'select', label: '최대 반복 횟수', def: 200, num: true, opts: [[100, '100'], [200, '200 (기본)'], [500, '500'], [1000, '1000']] },
    max_depth: { t: 'select', label: '최대 트리 깊이', def: 3, num: true, opts: [['', '제한 없음'], [2, '2단계'], [3, '3단계'], [4, '4단계'], [5, '5단계'], [8, '8단계']] },
    min_samples_leaf: { t: 'select', label: '리프 최소 표본 수', def: 1, num: true, opts: [[1, '1'], [5, '5'], [10, '10'], [20, '20']] },
    ccp_alpha: { t: 'select', label: '가지치기 강도 (ccp_alpha)', def: 0, num: true, opts: [[0, '0 (없음)'], [0.001, '0.001'], [0.01, '0.01'], [0.05, '0.05']] },
    n_clusters: { t: 'select', label: '군집 수 (K)', def: 3, num: true, opts: [[2, '2개'], [3, '3개'], [4, '4개'], [5, '5개'], [6, '6개'], [8, '8개']] },
    auto_k: { t: 'check', label: '군집 수 자동 탐색 (엘보/실루엣, K=2~8)', def: false },
    linkage: { t: 'select', label: '연결법 (linkage)', def: 'ward', opts: [['ward', 'Ward'], ['complete', 'Complete'], ['average', 'Average'], ['single', 'Single']] },
    eps: { t: 'select', label: '반경 (eps)', def: 0.5, num: true, opts: [[0.3, '0.3'], [0.5, '0.5'], [0.8, '0.8'], [1, '1.0'], [1.5, '1.5']] },
    min_samples: { t: 'select', label: '최소 이웃 수 (min_samples)', def: 5, num: true, opts: [[3, '3'], [5, '5'], [10, '10'], [20, '20']] },
    n_components: { t: 'select', label: '추출 성분 수', def: 2, num: true, opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']] },
    correlation_method: { t: 'select', label: '상관계수 방법', def: 'pearson', opts: [['pearson', 'Pearson'], ['spearman', 'Spearman'], ['kendall', 'Kendall']] },
    factors: { t: 'cols', label: '요인 (범주형 독립변수)', from: 'any' },
    covariates: { t: 'cols', label: '공변량 (ANCOVA, 선택)', from: 'numeric' },
    include_interaction: { t: 'check', label: '상호작용 항 포함', def: true },
    group_column: { t: 'col', label: '집단(상위 수준) 변수', from: 'any', required: true },
    time_column: { t: 'col', label: '시간 변수', from: 'numeric', required: true },
    random_slope: { t: 'check', label: '랜덤 기울기 포함', def: false },
    treatment_column: { t: 'col', label: '처치(0/1) 변수', from: 'any', required: true },
    caliper: { t: 'select', label: '캘리퍼 (매칭 허용 거리)', def: '', num: true, opts: [['', '제한 없음'], [0.05, '0.05'], [0.1, '0.1'], [0.2, '0.2']] },
    n_neighbors: { t: 'select', label: '매칭 이웃 수', def: 1, num: true, opts: [[1, '1:1'], [2, '1:2'], [3, '1:3'], [5, '1:5']] },
    label_columns: { t: 'cols', label: '식별자 변수 (원시데이터 표시용, 선택)', from: 'any' }
  };

  var dataset = null, methods = METHODS, analysis = null, running = false;
  var cfg = Object.assign({ method: 'linear_regression', target: '', features: [], params: {} }, A.state.config || {});

  function meta(id) { return methods.filter(function (m) { return m.id === id; })[0] || methods[0]; }
  function cols() { return dataset ? dataset.columns || [] : []; }
  function numericCols() { return cols().filter(function (c) { return c.role === 'numeric' || c.role === 'boolean'; }); }
  function anyCols() { return cols().filter(function (c) { return c.role !== 'constant'; }); }
  function pool(kind) { return kind === 'numeric' ? numericCols() : anyCols(); }

  function pv(key) { return cfg.params[key] !== undefined ? cfg.params[key] : FIELDS[key].def; }

  /* ---------------- 기법 선택 ---------------- */
  function renderMethods() {
    A.$('#method-grid').innerHTML = methods.map(function (m) {
      var on = cfg.method === m.id;
      return '<button type="button" data-method="' + m.id + '" class="p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ' + (on ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60') + '">' +
        '<div class="flex items-center justify-between w-full mb-1.5"><div class="p-1.5 rounded-lg ' + (on ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600') + '">' + A.icon(m.icon, 'w-3.5 h-3.5') + '</div><span class="px-1.5 py-0.5 rounded text-[9px] font-bold ' + (CAT_CLS[m.cat] || '') + '">' + m.cat + '</span></div>' +
        '<div><div class="text-xs font-bold truncate ' + (on ? 'text-blue-900' : 'text-slate-800') + '">' + A.esc(m.name) + '</div><div class="text-[10px] text-slate-500 mt-0.5 line-clamp-1" title="' + A.esc(m.desc) + '">' + A.esc(m.desc) + '</div></div></button>';
    }).join('');
  }

  /* ---------------- 변수/파라미터 ---------------- */
  var SELECT_CLS = 'w-full appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-800 shadow-2xs transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600';
  function selectWrap(innerSelect) {
    return '<div class="relative">' + innerSelect + '<i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i></div>';
  }
  /** 모든 필드를 동일한 박스(테두리·배경)로 감싸 좌/우 리듬을 맞춘다 */
  function field(label, body) {
    return '<div class="p-3 rounded-lg border border-slate-200 bg-slate-50/40 space-y-1.5"><label class="text-xs font-semibold text-slate-800 block">' + label + '</label>' + body + '</div>';
  }
  function colSelect(id, key, from, selected, optional) {
    return selectWrap('<select id="' + id + '" data-key="' + key + '" class="' + SELECT_CLS + '">' +
      '<option value="">' + (optional ? '(사용 안 함)' : '(선택)') + '</option>' +
      pool(from).map(function (c) { return '<option value="' + A.esc(c.name) + '"' + (selected === c.name ? ' selected' : '') + '>' + A.esc(c.name) + '</option>'; }).join('') + '</select>');
  }

  function renderVars() {
    var m = meta(cfg.method);
    var box = A.$('#target-box');
    if (m.target) {
      box.innerHTML = field(cfg.method === 'psm' ? '결과변수 (Outcome / Y)' : '종속변수 (Target / Y)', colSelect('sel-target', 'target', 'numeric', cfg.target, false));
    } else {
      box.innerHTML = '<div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">선택한 <strong>' + A.esc(m.name) + '</strong> 기법은 종속변수(Target) 지정이 필요하지 않습니다.</div>';
    }
    A.$('#feat-title').textContent = m.feat;
    var avail = numericCols().filter(function (c) { return !m.target || c.name !== cfg.target; });
    A.$('#feat-list').innerHTML = avail.map(function (c) {
      var on = cfg.features.indexOf(c.name) >= 0;
      return '<label class="flex items-center gap-2 p-1.5 rounded hover:bg-white text-xs text-slate-700 cursor-pointer transition-colors"><input type="checkbox" data-feat="' + A.esc(c.name) + '" ' + (on ? 'checked' : '') + ' class="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"><span class="truncate">' + A.esc(c.name) + '</span><span class="ml-auto text-[10px] text-slate-400 font-mono">' + A.esc(c.role) + '</span></label>';
    }).join('') || '<div class="text-[11px] text-slate-400 p-2">선택 가능한 수치형 변수가 없습니다. 1단계에서 변수 타입을 확인하세요.</div>';
    A.$('#feat-count').textContent = cfg.features.length + '개';

    A.$('#extra-params').innerHTML = m.fields.map(function (k) {
      var f = FIELDS[k];
      if (f.t === 'select') {
        return field(f.label, selectWrap('<select data-par="' + k + '" class="' + SELECT_CLS + '">' +
          f.opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(pv(k)) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'));
      }
      if (f.t === 'check') {
        return '<div class="p-3 rounded-lg border border-slate-200 bg-slate-50/40"><label class="flex items-center gap-2 text-xs text-slate-800 font-semibold cursor-pointer"><input type="checkbox" data-par="' + k + '" ' + (pv(k) ? 'checked' : '') + ' class="rounded text-blue-600 border-slate-300 focus:ring-blue-500">' + f.label + '</label></div>';
      }
      if (f.t === 'text') {
        return field(f.label, '<input type="text" data-par="' + k + '" value="' + A.esc(cfg.params[k] || '') + '" placeholder="' + A.esc(f.ph || '') + '" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs shadow-2xs transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">');
      }
      if (f.t === 'col') {
        return field(f.label, colSelect('par-' + k, k, f.from, cfg.params[k], !f.required).replace('data-key="' + k + '"', 'data-par="' + k + '"'));
      }
      var sel = cfg.params[k] || [];
      return field(f.label, '<div class="border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto space-y-0.5 bg-white">' +
        pool(f.from).map(function (c) { return '<label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-50"><input type="checkbox" data-multi="' + k + '" value="' + A.esc(c.name) + '" ' + (sel.indexOf(c.name) >= 0 ? 'checked' : '') + ' class="rounded text-blue-600 border-slate-300"><span class="truncate">' + A.esc(c.name) + '</span></label>'; }).join('') + '</div>');
    }).join('');
    A.$('#btn-run').disabled = running;
  }

  /* ---------------- 요청 조립 ---------------- */
  function buildParams() {
    var m = meta(cfg.method), p = { features: cfg.features.slice() };
    if (m.target) p.target = cfg.target;
    m.fields.forEach(function (k) {
      var f = FIELDS[k], v = pv(k);
      if (k === 'auto_k') { if (v) p.auto_k_range = [2, 8]; return; }
      if (k === 'n_clusters' && pv('auto_k')) return;
      if (f.t === 'cols') { if (v && v.length) p[k] = v; return; }
      if (v === '' || v === undefined || v === null) return;
      if (f.t === 'text' && !String(v).trim()) return;
      p[k] = f.num ? Number(v) : v;
    });
    return p;
  }
  function validate() {
    var m = meta(cfg.method);
    if (m.target && !cfg.target) return '종속변수를 선택하세요.';
    if (!m.featOptional && !cfg.features.length) return '변수를 1개 이상 선택하세요.';
    var miss = m.fields.filter(function (k) { return FIELDS[k].required && !cfg.params[k]; });
    if (miss.length) return '필수 항목을 선택하세요: ' + FIELDS[miss[0]].label;
    if (cfg.method === 'anova' && !(cfg.params.factors || []).length) return 'ANOVA 요인(범주형 변수)을 1개 이상 선택하세요.';
    return null;
  }

  /* ---------------- 결과 패널 ---------------- */
  var STATUS = { succeeded: ['수렴 성공', 'bg-emerald-50 text-emerald-700 border-emerald-200'], failed: ['실패', 'bg-rose-50 text-rose-700 border-rose-200'], running: ['실행 중', 'bg-amber-50 text-amber-700 border-amber-200'], pending: ['대기', 'bg-slate-50 text-slate-600 border-slate-200'] };
  function renderResult() {
    var p = A.$('#result-panel');
    var ok = analysis && analysis.status === 'succeeded';
    A.$('#fit-badge').classList.toggle('hidden', !ok);
    A.$('#fit-badge').classList.toggle('flex', !!ok);
    if (!analysis) {
      p.innerHTML = '<div class="py-6 text-center text-slate-400 space-y-2">' + A.icon('cpu', 'w-8 h-8 mx-auto text-slate-300') + '<div class="text-xs font-semibold text-slate-600">분석이 아직 실행되지 않았습니다.</div><div class="text-[11px]">위에서 변수를 설정하고 \'통계 모델 분석 실행\'을 클릭하세요.</div></div>';
      A.icons();
      return;
    }
    var r = analysis, st = STATUS[r.status] || STATUS.pending, m = meta(r.method);
    var err = (r.status === 'failed') ? '<div class="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">분석 연산에 실패했습니다. 변수·파라미터 설정을 확인한 뒤 다시 시도해 주세요.</div>' : '';
    p.innerHTML = '<div class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-2.5">' +
      '<div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">' + A.icon('sparkles', 'w-4 h-4') + '</div><div><div class="flex items-center gap-2"><h4 class="text-xs font-bold text-slate-900">' + A.esc(m.name) + ' 연산 결과</h4>' +
      '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ' + st[1] + '">' + st[0] + '</span></div><div class="text-[10px] text-slate-500 mt-0.5 font-mono">' + A.date(r.completed_at || r.created_at) + '</div></div></div></div>' + err;
    A.icons();
  }

  function renderPipe() {
    var m = meta(cfg.method), pc = A.state.preprocessing;
    var rows = pc ? Object.keys(pc).filter(function (k) { return V(pc[k]); }).map(function (k) { return row(k, Array.isArray(pc[k]) ? pc[k].length + '개 변수' : String(pc[k])); }).join('') : '<div class="text-[11px] text-amber-600">2단계에서 저장한 전처리 규칙이 없습니다 (API 기본값으로 실행).</div>';
    function V(x) { return x !== null && x !== undefined && x !== ''; }
    A.$('#pipe-body').innerHTML = '<div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">' +
      '<div class="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2"><div class="font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-200">01. 모델 및 변수 바인딩 명세</div><div class="space-y-1 text-[11px]">' +
      '<div class="flex justify-between"><span class="text-slate-500">선택 모형:</span><span class="font-semibold text-slate-800">' + A.esc(m.name) + ' (' + A.esc(m.en) + ')</span></div>' +
      '<div class="flex justify-between"><span class="text-slate-500">종속변수 (Y):</span><span class="font-semibold text-slate-800">' + (m.target ? A.esc(cfg.target || '-') : '없음 (비지도/탐색)') + '</span></div>' +
      '<div class="pt-1"><span class="text-slate-500 block mb-1">투입 변수 (' + cfg.features.length + '개):</span><div class="flex flex-wrap gap-1">' + cfg.features.map(function (f) { return '<span class="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] text-slate-700">' + A.esc(f) + '</span>'; }).join('') + '</div></div></div></div>' +
      '<div class="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2"><div class="font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-200">02. 적용될 전처리 파이프라인 규칙</div><div class="space-y-1.5 text-[11px]">' + rows + '</div></div></div>';
  }
  function row(k, v) { return '<div class="flex items-center justify-between"><span class="text-slate-500 font-mono">' + A.esc(k) + ':</span><span class="font-medium text-slate-800">' + A.esc(v) + '</span></div>'; }

  function run() {
    if (running) return;
    var bad = validate();
    if (bad) { A.toast(bad, 'error'); return; }
    running = true;
    var b = A.$('#btn-run');
    b.disabled = true;
    b.innerHTML = '<span>분석 연산 수행 중...</span>';
    var m = meta(cfg.method);
    A.saveState({ config: cfg });
    A.post('/api/v1/analyses', { dataset_id: dsId, method: cfg.method, name: m.name + ' - ' + (A.state.datasetName || dsId), params: buildParams(), preprocessing: A.state.preprocessing || {} }).then(function (r) {
      analysis = r;
      A.saveState({ analysisId: r.id });
      renderResult();
      if (r.status === 'failed') A.toast('분석 연산에 실패했습니다. 변수·파라미터 설정을 확인한 뒤 다시 시도해 주세요.', 'error');
      else A.toast('분석 모델 연산이 완료되었습니다. (' + m.name + ')');
    }).catch(function (e) { A.toast(e.message, 'error'); }).then(function () {
      running = false;
      b.disabled = false;
      b.innerHTML = A.icon('play', 'w-3.5 h-3.5') + '<span>통계 모델 분석 실행 (Run)</span>';
      A.icons();
    });
  }

  function defaultFeatures() {
    var m = meta(cfg.method);
    return numericCols().filter(function (c) { return !m.target || c.name !== cfg.target; }).slice(0, 4).map(function (c) { return c.name; });
  }
  function refreshAll() { renderMethods(); renderVars(); renderPipe(); A.icons(); }

  document.addEventListener('DOMContentLoaded', function () {
    A.$('#method-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-method]');
      if (!b) return;
      cfg.method = b.getAttribute('data-method');
      var m = meta(cfg.method);
      if (m.target && !cfg.target && numericCols().length) cfg.target = numericCols()[0].name;
      cfg.features = cfg.features.filter(function (f) { return f !== cfg.target || !m.target; });
      if (!cfg.features.length && !m.featOptional) cfg.features = defaultFeatures();
      refreshAll();
    });
    A.$('#target-box').addEventListener('change', function (e) {
      if (e.target.id !== 'sel-target') return;
      cfg.target = e.target.value;
      cfg.features = cfg.features.filter(function (f) { return f !== cfg.target; });
      renderVars(); renderPipe(); A.icons();
    });
    A.$('#feat-list').addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-feat');
      if (!id) return;
      var i = cfg.features.indexOf(id);
      if (e.target.checked && i < 0) cfg.features.push(id);
      if (!e.target.checked && i >= 0) cfg.features.splice(i, 1);
      A.$('#feat-count').textContent = cfg.features.length + '개';
      renderPipe(); A.icons();
    });
    A.$('#feat-all').addEventListener('click', function () {
      var m = meta(cfg.method);
      cfg.features = numericCols().filter(function (c) { return !m.target || c.name !== cfg.target; }).map(function (c) { return c.name; });
      renderVars(); renderPipe(); A.icons();
    });
    A.$('#feat-none').addEventListener('click', function () { cfg.features = []; renderVars(); renderPipe(); A.icons(); });
    A.$('#extra-params').addEventListener('change', function (e) {
      var t = e.target, k = t.getAttribute('data-par'), mk = t.getAttribute('data-multi');
      if (mk) {
        var arr = cfg.params[mk] || [];
        var i = arr.indexOf(t.value);
        if (t.checked && i < 0) arr.push(t.value);
        if (!t.checked && i >= 0) arr.splice(i, 1);
        cfg.params[mk] = arr;
        return;
      }
      if (!k) return;
      cfg.params[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'auto_k') { renderVars(); A.icons(); }
    });
    A.$('#btn-run').addEventListener('click', run);
    A.$('#pipe-toggle').addEventListener('click', function () {
      var b = A.$('#pipe-body'), open = b.classList.toggle('hidden') === false;
      A.$('#pipe-txt').textContent = open ? '접기' : '상세 보기';
      A.$('#pipe-ic').style.transform = open ? 'rotate(180deg)' : '';
    });

    A.get('/api/v1/datasets/' + encodeURIComponent(dsId)).then(function (d) {
      dataset = d;
      A.$('#s4-dataset').textContent = d.name;
      A.$('#s4-rows').textContent = '(' + A.num(d.n_rows) + '행)';
      var m = meta(cfg.method);
      var names = cols().map(function (c) { return c.name; });
      if (cfg.target && names.indexOf(cfg.target) < 0) cfg.target = '';
      cfg.features = cfg.features.filter(function (f) { return names.indexOf(f) >= 0; });
      if (m.target && !cfg.target && numericCols().length) cfg.target = numericCols()[0].name;
      if (!cfg.features.length && !m.featOptional) cfg.features = defaultFeatures();
      refreshAll();
      renderResult();
      if (A.state.analysisId) {
        return A.get('/api/v1/analyses/' + encodeURIComponent(A.state.analysisId)).then(function (r) { analysis = r; renderResult(); }).catch(function () { A.saveState({ analysisId: null }); });
      }
    }).catch(function (e) { if (!A.datasetGone(e)) A.toast(e.message, 'error'); });

    // API 가 제공하는 기법 설명이 있으면 보강 (실패해도 내장 목록으로 동작)
    A.get('/api/v1/methods').then(function (list) {
      (list || []).forEach(function (x) {
        var id = x.id || x.method || x.key || x.value, m = METHODS.filter(function (y) { return y.id === id; })[0];
        if (m && x.description) m.desc = x.description;
      });
      renderMethods(); A.icons();
    }).catch(function () { /* ignore */ });
    A.icons();
  });
})();
