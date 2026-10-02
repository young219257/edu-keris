/* 2단계: 데이터 품질 진단 및 전처리 — GET /api/v1/datasets/{id}/profile, PreprocessingSpec 을 화면 상태로 보관 */
(function () {
  'use strict';
  var A = window.App;

  // 이상치 탐지 기법 = API OutlierMethod. threshold 는 profile/outliers 의 outlier_threshold / threshold 로 전달
  var ALGOS = [
    { id: 'iqr', name: 'IQR (사분위수 범위)', tag: '단변량', tagCls: 'bg-blue-50 text-blue-800 border border-blue-200', desc: '사분위수 범위 기반 비모수 탐지', label: 'IQR 배수 (k):', def: 1.5, opts: [[1.5, '1.5배 (표준 이상치)'], [2.0, '2.0배 (중간 이상치)'], [3.0, '3.0배 (극단 이상치)']], formula: 'x < Q1 − k·IQR  또는  x > Q3 + k·IQR' },
    { id: 'zscore', name: 'Z-score (표준점수)', tag: '모수적', tagCls: 'bg-blue-50 text-blue-800 border border-blue-200', desc: '정규분포 기준 표준점수 기반 탐지', label: '임계값 (|Z|):', def: 3.0, opts: [[2.5, '2.5 (엄격한 98.8% 기준)'], [3.0, '3.0 (표준 99.7% 기준)'], [3.5, '3.5 (극단값만 탐지)']], formula: '|x − μ| / σ > 임계값' },
    { id: 'modified_zscore', name: '수정된 Z-score (MAD)', tag: '로버스트', tagCls: 'bg-emerald-100 text-emerald-800', desc: '중앙값·중위절대편차 기반 왜곡 방지 탐지', label: '임계값 (|M_i|):', def: 3.5, opts: [[3.0, '3.0 (보수적 탐지)'], [3.5, '3.5 (Iglewicz 표준)'], [4.0, '4.0 (극단치 전용)']], formula: '0.6745·|x − 중앙값| / MAD > 임계값' },
    { id: 'grubbs', name: "Grubbs' 검정", tag: '가설검정', tagCls: 'bg-purple-100 text-purple-800', desc: '유의확률 기반 최대 극단치 순차 검정', label: '유의수준 (α):', def: 0.05, opts: [[0.01, 'α = 0.01 (99% 신뢰수준)'], [0.05, 'α = 0.05 (95% 신뢰수준 표준)'], [0.10, 'α = 0.10 (90% 신뢰수준)']], formula: '최대 |x − μ| / σ 가 임계값 초과' },
    { id: 'mahalanobis', name: '마할라노비스 거리', tag: '다변량 공분산', tagCls: 'bg-blue-100 text-blue-800', desc: '변수 간 공분산·상관관계 기반 다변량 탐지', label: '거리 임계치 (D_M):', def: 3.0, opts: [[2.5, '2.5 (민감한 다변량 탐지)'], [3.0, '3.0 (표준 다변량 기준)'], [3.5, '3.5 (극단적 상관 이탈치)']], formula: 'D_M = √((x−μ)ᵀ Σ⁻¹ (x−μ)) > 임계치' },
    { id: 'isolation_forest', name: 'Isolation Forest', tag: '트리 앙상블', tagCls: 'bg-indigo-100 text-indigo-800', desc: '의사결정나무 분할 기반 고립치 탐지', label: '고립 점수 임계치:', def: 0.60, opts: [[0.55, '0.55 (보수적 탐지)'], [0.60, '0.60 (표준 권장 임계치)'], [0.65, '0.65 (극단 고립치만)']], formula: '고립 점수 > 임계치' },
    { id: 'lof', name: 'LOF (국소 이상치 계수)', tag: '국소 밀도', tagCls: 'bg-teal-100 text-teal-800', desc: '이웃 밀도차 기반 국소 고립치 탐지', label: 'LOF 임계치:', def: 1.5, opts: [[1.3, '1.3 (민감 탐지)'], [1.5, '1.5 (표준 권장 기준)'], [1.8, '1.8 (극단 희박 밀도치)']], formula: 'LOF > 임계치' }
  ];
  // PreprocessingSpec 값(API) ↔ 화면 표시
  var STRATS = {
    missing_strategy: { title: '1. 결측치(Missing) 정제', opts: [['median', '중앙값 대체 (Median)', '왜곡 방지 권장'], ['mean', '평균값 대체 (Mean)', '정규분포형 적합'], ['mode', '최빈값 대체 (Mode)', '이산/범주형 적합'], ['drop_rows', '결측치 행 제거 (Drop)', '완전 관측치만 보존'], ['zero', '0 대체 (Zero)', '0으로 치환'], ['none', '처리 안 함 (None)', '원본 유지']] },
    outlier_treatment: { title: '2. 이상치(Outlier) 정제', opts: [['winsorize', '윈저라이징 (클리핑)', '임계 경계값 보정'], ['drop', '이상치 행 제거 (Drop)', '이상 관측치 삭제'], ['log', '로그 변환 (Log)', '스케일 완화'], ['keep', '원본값 보존 (Keep)', '진단만 수행']] },
    scaling: { title: '3. 특성 스케일링', opts: [['standard', '표준화 (Standard)', '평균 0, 분산 1'], ['minmax', '정규화 (MinMax)', '0~1 범위'], ['robust', '로버스트 (Robust)', 'IQR 기반 스케일'], ['none', '미적용 (None)', '원시 스케일']] },
    drop_duplicates: { title: '4. 중복 행 처리', opts: [[false, '유지 (Keep)', '중복 행 그대로'], [true, '중복 제거 (Drop)', '완전 동일 행 삭제']] }
  };

  if (!A.requireDataset()) return;
  // 2단계는 항상 원본 데이터셋 기준. 이미 전처리된 데이터셋으로 넘어간 뒤 다시 와도 원본(rawDatasetId)으로 진단·전처리한다.
  var dsId = A.state.rawDatasetId || A.state.datasetId;
  var ui = A.state.prepUi || {};
  // 이상치 탐지 기법은 기본 선택 없음. 사용자가 기법을 고르고 '탐지 실행' 버튼을 눌러야 /outliers 를 호출한다.
  var sel = { method: null, threshold: null };
  var active = null;   // 마지막으로 탐지를 실행한 기법 {method, threshold}
  // 전처리 규칙은 항목별 맨 위 옵션이 기본 선택. 저장된 선택이 있으면 유효한 값만 덮어쓴다.
  var pcfg = {};
  Object.keys(STRATS).forEach(function (k) {
    var saved = ui.prep && ui.prep[k];
    var valid = STRATS[k].opts.some(function (o) { return o[0] === saved; });
    pcfg[k] = valid ? saved : STRATS[k].opts[0][0];
  });
  var profile = null, dataset = null, selectedCol = null;

  function algo(id) { return ALGOS.filter(function (a) { return a.id === id; })[0] || null; }
  function byCol(list) { var m = {}; (list || []).forEach(function (x) { m[x.column] = x; }); return m; }

  /** 결측치·이상치·스케일링 → POST /datasets/{id}/preprocess 요청 (전처리된 새 데이터셋 생성) */
  function buildPreprocessRequest() {
    var req = { missing_strategy: pcfg.missing_strategy, outlier_treatment: pcfg.outlier_treatment, scaling: pcfg.scaling };
    // 이상치 판정은 2단계에서 탐지를 실행한 기법·임계값과 맞춘다 (명세 권고). 탐지를 안 했으면 서버 기본값
    if (active) { req.outlier_method = active.method; req.outlier_threshold = Number(active.threshold); }
    return req;
  }
  function needsPreprocess() { return pcfg.missing_strategy !== 'none' || pcfg.outlier_treatment !== 'keep' || pcfg.scaling !== 'none'; }
  /** 분석 실행 시 보내는 PreprocessingSpec: 결측치·이상치·스케일링은 이미 데이터셋에 적용됐으므로 다시 하지 않고,
   *  /preprocess 에 없는 중복 행 제거와 범주형 인코딩만 여기서 지정한다. */
  function buildSpec() {
    return { drop_duplicates: !!pcfg.drop_duplicates, outlier_treatment: 'keep', scaling: 'none', encoding: 'onehot' };
  }
  function persist() {
    A.saveState({ preprocessing: buildSpec(), prepUi: { outlier: active, prep: pcfg } });
  }
  function setMsg(text) {
    var m = A.$('#prep-msg');
    m.textContent = text || '';
    m.classList.toggle('hidden', !text);
  }

  /* ---------------- 알고리즘 카드 ---------------- */
  function renderAlgos() {
    A.$('#algo-grid').innerHTML = ALGOS.map(function (a) {
      var on = sel.method === a.id;
      return '<div data-algo="' + a.id + '" role="button" class="p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ' + (on ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white') + '">' +
        '<div><div class="flex items-center justify-between gap-1"><span class="text-xs font-bold text-slate-900">' + A.esc(a.name) + '</span><span class="text-[10px] px-1.5 py-0.5 rounded font-semibold ' + a.tagCls + '">' + a.tag + '</span></div>' +
        '<p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">' + a.desc + '</p></div>' +
        '<div class="mt-3 pt-2 border-t flex items-center justify-between text-[11px] ' + (on ? 'border-blue-200' : 'border-slate-200') + '"><span class="font-semibold ' + (on ? 'text-slate-700' : 'text-slate-400') + '">' + a.label + '</span>' +
          '<select data-thr="1"' + (on ? '' : ' disabled') + ' class="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-800 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600' + (on ? '' : ' opacity-50 cursor-not-allowed') + '">' +
          a.opts.map(function (o) { return '<option value="' + o[0] + '"' + (Number(on ? sel.threshold : a.def) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>';
    }).join('');
    var a = algo(sel.method);
    var nm = A.$('#algo-sel-name');
    nm.textContent = a ? a.name : '-';
    nm.className = 'text-blue-700 font-bold';
  }

  /* ---------------- 진단 결과 ---------------- */
  function totalOutliers() { return (profile.outliers || []).reduce(function (s, o) { return s + (o.n_outliers || 0); }, 0); }

  function renderQuality() {
    if (!profile) return;
    var a = active && algo(active.method);
    var outs = totalOutliers();
    A.$('#card-rows').textContent = A.num(profile.n_rows) + '행 × ' + profile.n_cols + '변수';
    var cm = A.$('#card-missing');
    cm.textContent = A.num(profile.total_missing_cells) + '건 (' + (profile.missing_ratio * 100).toFixed(1) + '%)';
    cm.className = 'text-lg font-bold font-mono mt-0.5 block ' + (profile.total_missing_cells > 0 ? 'text-amber-600' : 'text-slate-900');
    A.$('#card-out-label').textContent = a ? '이상치 검출 (' + a.name + ')' : '이상치 검출';
    var co = A.$('#card-outliers');
    co.textContent = a ? A.num(outs) + '건' : '탐지 전';
    co.className = 'text-lg font-bold font-mono mt-0.5 block ' + (!a ? 'text-slate-400' : outs > 0 ? 'text-blue-700' : 'text-slate-900');
    var cd = A.$('#card-dups');
    cd.textContent = A.num(profile.n_duplicated_rows) + '행';
    cd.className = 'text-lg font-bold font-mono mt-0.5 block ' + (profile.n_duplicated_rows > 0 ? 'text-amber-600' : 'text-slate-900');
    A.$('#applied-name').textContent = a ? a.name : '미실행';
    A.$('#applied-formula').textContent = a ? a.formula : '위에서 탐지 기법을 선택하고 실행하세요';
    A.$('#th-out').textContent = a ? '이상치 (' + a.name + ')' : '이상치';

    var miss = byCol(profile.missing), outl = byCol(profile.outliers);
    var nums = profile.numeric || [];
    if (!selectedCol && nums.length) selectedCol = nums[0].column;
    A.$('#var-body').innerHTML = nums.map(function (n) {
      var mc = (miss[n.column] || {}).n_missing || n.missing || 0, oc = (outl[n.column] || {}).n_outliers || 0, issue = mc > 0 || (a && oc > 0);
      return '<tr data-col="' + A.esc(n.column) + '" class="cursor-pointer transition-colors ' + (n.column === selectedCol ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50') + '">' +
        '<td class="py-2.5 px-3 font-sans font-medium text-slate-800">' + A.esc(n.column) + '</td>' +
        '<td class="py-2.5 px-3 text-right">' + (mc > 0 ? '<span class="text-amber-600 font-bold">' + A.num(mc) + '</span>' : '<span class="text-slate-400">0</span>') + '</td>' +
        '<td class="py-2.5 px-3 text-right">' + (!a ? '<span class="text-slate-300">-</span>' : oc > 0 ? '<span class="text-blue-700 font-bold">' + A.num(oc) + '</span>' : '<span class="text-slate-400">0</span>') + '</td>' +
        '<td class="py-2.5 px-3 text-right font-sans">' + (issue ? '<span class="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">조치 필요</span>' : '<span class="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">양호</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="py-6 text-center text-slate-400 font-sans">수치형 변수가 없습니다.</td></tr>';
    renderDetail();
    renderAlgos();
  }

  function renderDetail() {
    var card = A.$('#detail-card');
    var n = (profile.numeric || []).filter(function (x) { return x.column === selectedCol; })[0];
    if (!n) { card.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">분석할 수치형 변수가 없습니다.</div>'; return; }
    var o = byCol(profile.outliers)[selectedCol];
    var a = active && algo(active.method);
    function box(label, v, hi) { return '<div class="' + (hi ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200') + ' p-2.5 rounded-lg border"><span class="' + (hi ? 'text-blue-800 font-bold' : 'text-slate-400') + ' text-[10px] block font-sans">' + label + '</span><strong class="' + (hi ? 'text-blue-900' : 'text-slate-800') + '">' + A.fix(v, 2) + '</strong></div>'; }
    var bounds = a && o && (o.lower_bound !== null && o.lower_bound !== undefined || o.upper_bound !== null && o.upper_bound !== undefined) ? '하한: ' + A.fix(o.lower_bound, 2) + ' | 상한: ' + A.fix(o.upper_bound, 2) : '평균: ' + A.fix(n.mean, 2) + ' | 표준편차: ±' + A.fix(n.std, 2);
    var samples = '';
    if (a && o && o.n_outliers > 0) {
      var idx = o.sample_indices || [], vals = o.sample_values || [];
      samples = '<div class="pt-2 border-t border-slate-100"><div class="text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between"><span>검출된 이상치 표본 (' + A.num(o.n_outliers) + '건, ' + (o.ratio * 100).toFixed(1) + '%' + (o.n_outliers > idx.length ? ', 상위 ' + idx.length + '건 표시' : '') + ')</span><span class="text-[10px] font-normal text-slate-400">탐지 기준: ' + A.esc(a.name) + '</span></div><div class="max-h-36 overflow-y-auto space-y-1">' +
        idx.slice(0, 20).map(function (ri, i) { return '<div class="flex items-center justify-between text-xs bg-blue-50/50 px-3 py-1.5 rounded border border-blue-100 font-mono gap-2"><span class="text-slate-600 font-bold shrink-0">#' + ri + '행</span><span class="text-slate-800 font-bold">관측값: ' + A.esc(vals[i]) + '</span></div>'; }).join('') + '</div></div>';
    }
    if (!a) samples = '<div class="pt-2 border-t border-slate-100 text-[11px] text-slate-400">이상치 분포는 위에서 탐지 기법을 선택하고 탐지를 실행하면 표시됩니다.</div>';
    card.innerHTML = '<div class="flex items-center justify-between flex-wrap gap-2"><h4 class="text-xs font-bold text-slate-900">[' + A.esc(n.column) + '] 통계 지표' + (a ? ' 및 이상치 분포' : '') + '</h4><span class="text-[10px] text-slate-500 font-mono">' + bounds + '</span></div>' +
      '<div class="grid grid-cols-5 gap-3 text-center text-xs font-mono">' + box('최솟값', n.min) + box('1사분위(Q1)', n.q1) + box('중앙값(Median)', n.median, true) + box('3사분위(Q3)', n.q3) + box('최댓값', n.max) + '</div>' + samples;
  }

  /* ---------------- 전처리 전략 ---------------- */
  function renderStrategies() {
    A.$('#strategy-grid').innerHTML = Object.keys(STRATS).map(function (k) {
      var g = STRATS[k];
      return '<div class="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2"><span class="text-xs font-bold text-slate-800 block">' + g.title + '</span><div class="space-y-1.5">' +
        g.opts.map(function (o) {
          var on = pcfg[k] === o[0];
          return '<label class="flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ' + (on ? 'bg-white border-blue-600 font-bold text-blue-900 shadow-2xs' : 'border-transparent text-slate-700 hover:bg-white/80') + '">' +
            '<div class="flex items-center gap-2"><input type="radio" name="' + k + '" value="' + o[0] + '" ' + (on ? 'checked' : '') + ' class="text-blue-600 focus:ring-blue-600"><span>' + o[1] + '</span></div><span class="text-[10px] text-slate-400 font-normal">' + o[2] + '</span></label>';
        }).join('') + '</div></div>';
    }).join('');
  }

  /** 진입 시: 이상치 탐지 없이 기본 품질 프로파일만 조회 */
  function loadProfile() {
    return A.get('/api/v1/datasets/' + encodeURIComponent(dsId) + '/profile' + A.qs({ include_outliers: false })).then(function (p) {
      profile = p;
      renderQuality();
      persist();
    });
  }
  /** '탐지 실행' 버튼: 선택한 기법·임계값으로 이상치 탐지 */
  function runDetect() {
    var req = { method: sel.method, threshold: sel.threshold };
    return A.get('/api/v1/datasets/' + encodeURIComponent(dsId) + '/outliers' + A.qs(req)).then(function (list) {
      profile.outliers = list || [];
      active = req;
      renderQuality();
      persist();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderAlgos();
    renderStrategies();
    A.$('#algo-grid').addEventListener('click', function (e) {
      if (e.target.closest('select')) return;
      var c = e.target.closest('[data-algo]');
      if (!c) return;
      var a = algo(c.getAttribute('data-algo'));
      if (sel.method !== a.id) { sel.method = a.id; sel.threshold = a.def; }
      renderAlgos();
      A.icons();
    });
    A.$('#algo-grid').addEventListener('change', function (e) {
      if (e.target.closest('select[data-thr]')) sel.threshold = Number(e.target.value);
    });
    A.$('#btn-detect').addEventListener('click', function () {
      var b = this;
      if (!profile) return;
      if (!sel.method) {   // 버튼은 항상 활성. 기법을 고르지 않았으면 안내만 표시
        var nm = A.$('#algo-sel-name');
        nm.textContent = '위 카드에서 탐지 기법을 먼저 선택하세요';
        nm.className = 'text-rose-600 font-bold';
        return;
      }
      b.disabled = true;
      b.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full spin inline-block"></span><span>알고리즘 연산 중...</span>';
      runDetect().then(function () {
        var ok = A.$('#detect-ok');
        ok.classList.remove('hidden'); ok.classList.add('flex');
        setTimeout(function () { ok.classList.add('hidden'); ok.classList.remove('flex'); }, 3000);
      }).catch(function (e) { if (!A.datasetGone(e)) A.toast(e.message, 'error'); }).then(function () {
        b.disabled = false;
        b.innerHTML = A.icon('shield-check', 'w-4 h-4') + '<span>선택 기법으로 이상치 탐지 실행</span>';
        A.icons();
      });
    });
    A.$('#var-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-col]');
      if (!tr) return;
      selectedCol = tr.getAttribute('data-col');
      renderQuality();
    });
    A.$('#strategy-grid').addEventListener('change', function (e) {
      var r = e.target;
      if (r.type !== 'radio') return;
      pcfg[r.name] = r.value === 'true' ? true : r.value === 'false' ? false : r.value;
      renderStrategies();
      persist();
      A.toast('전처리 규칙이 저장되었습니다.');
    });
    A.$('#btn-next').addEventListener('click', function () {
      var b = this, label = b.querySelector('span');
      persist();
      setMsg('');
      if (!needsPreprocess()) {   // 적용할 규칙이 없으면 원본 그대로 진행
        A.saveState({ datasetId: dsId, datasetName: dataset && dataset.name, datasetRows: dataset && dataset.n_rows, rawDatasetId: dsId, analysisId: null });
        location.href = A.ctx + '/analysis/step3';
        return;
      }
      b.disabled = true;
      label.textContent = '전처리 적용 중...';
      // 원본은 그대로 두고 전처리된 새 데이터셋(source_type=preprocessed)을 만든다. 이후 3·4단계는 이 데이터셋으로 진행
      A.post('/api/v1/datasets/' + encodeURIComponent(dsId) + '/preprocess', buildPreprocessRequest()).then(function (d) {
        A.saveState({ datasetId: d.id, datasetName: d.name, datasetRows: d.n_rows, rawDatasetId: dsId, analysisId: null });
        location.href = A.ctx + '/analysis/step3';
      }).catch(function (err) {
        if (A.datasetGone(err)) return;
        setMsg('전처리 적용에 실패했습니다: ' + err.message);
        b.disabled = false;
        label.textContent = '3단계 데이터 탐색(EDA) 진행';
      });
    });

    A.get('/api/v1/datasets/' + encodeURIComponent(dsId)).then(function (d) {
      dataset = d;
      return loadProfile();
    }).then(function () { A.icons(); }).catch(function (e) { if (!A.datasetGone(e)) A.toast(e.message, 'error'); });
    A.icons();
  });
})();
