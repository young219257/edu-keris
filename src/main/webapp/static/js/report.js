/* 4-2단계: 분석 결과 상세 리포트 — GET /api/v1/analyses/{id}, POST /api/v1/packages */
(function () {
  'use strict';
  var A = window.App;
  var res = null, tab = 'overview';
  var raw = { loaded: false, rows: [], cols: [], total: 0, q: '' };

  function tabsHtml() {
    var tabs = [
      ['overview', 'layout-grid', '전체 종합 리포트', ''],
      ['result', 'table-2', '표준 통계 결과표', ''],
      ['charts', 'bar-chart-3', '진단 시각화 차트', String((res.chart_recommendations || []).length)],
      ['raw', 'file-spreadsheet', '표본별 원시데이터 및 잔차', raw.total ? String(raw.total) : '']
    ];
    return tabs.map(function (t) {
      var on = tab === t[0];
      return '<button type="button" data-tab="' + t[0] + '" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ' + (on ? 'bg-white text-[#003876] shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50') + '">' + A.icon(t[1], 'w-3.5 h-3.5') + '<span>' + t[2] + '</span>' + (t[3] ? '<span class="px-1.5 rounded text-[10px] font-mono ' + (on ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/80 text-slate-600') + '">' + t[3] + '</span>' : '') + '</button>';
    }).join('');
  }

  function applyTab() {
    A.$('#rp-tabs').innerHTML = tabsHtml();
    A.$('#rp-result').classList.toggle('hidden', tab !== 'overview' && tab !== 'result');
    A.$('#rp-charts').classList.toggle('hidden', tab !== 'overview' && tab !== 'charts');
    A.$('#rp-rawdata').classList.toggle('hidden', tab !== 'raw');
    A.icons();
  }

  function isRowArray(v) { return Array.isArray(v) && v.length && v.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }); }
  function isPlainObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  /** 의사결정나무류의 재귀 노드 구조(node_id + children[])를 감지 */
  function isTreeNode(v) { return isPlainObj(v) && v.node_id !== undefined && Array.isArray(v.children); }

  /** result.tree(node_id/children 재귀 구조)를 Highcharts treegraph 로 그린다. 왼쪽 가지 = 조건 참(<=), 오른쪽 = 거짓 */
  var pendingTrees = [];
  function drawTree(id, root) {
    var data = [], leaves = 0, maxDepth = 0;
    (function walk(n, parent, depth) {
      var pred = n.predicted_value !== undefined ? n.predicted_value : n.predicted_class;
      if (typeof pred === 'number') pred = Number(pred.toFixed(3));
      var label = n.is_leaf ? '예측 ' + pred : n.condition;
      data.push({ id: String(n.node_id), parent: parent, name: label, n: n.n_samples, impurity: n.impurity, pred: pred, leaf: n.is_leaf, color: n.is_leaf ? '#2563eb' : '#64748b' });
      if (n.is_leaf) leaves++;
      if (depth > maxDepth) maxDepth = depth;
      (n.children || []).forEach(function (c) { walk(c, String(n.node_id), depth + 1); });
    })(root, undefined, 0);
    Highcharts.chart(id, {
      chart: { inverted: true, height: Math.max(320, leaves * 56), spacingRight: 140 },
      title: { text: null }, credits: { enabled: false },
      tooltip: { pointFormatter: function () { return '<b>' + this.name + '</b><br/>표본수: ' + this.n + '<br/>불순도: ' + (this.impurity != null ? Number(this.impurity).toFixed(4) : '-') + '<br/>예측값: ' + this.pred; } },
      series: [{
        type: 'treegraph', data: data, marker: { symbol: 'circle', radius: 6 },
        link: { color: '#cbd5e1', lineWidth: 1.5 },
        dataLabels: { pointFormat: '{point.name}<br/><span style="font-weight:400;color:#64748b">n={point.n}</span>', style: { fontSize: '11px', fontWeight: '600', color: '#0f172a', textOutline: 'none', whiteSpace: 'nowrap' }, align: 'left', x: 10, crop: false, overflow: 'allow' },
        levels: [{ level: 1, dataLabels: { align: 'left' } }]
      }]
    });
  }


  /** result.tree 를 노드 단위 표로 펼친다. 분기: 부모 조건의 참(첫째 자식)/거짓(둘째 자식) */
  function treeTable(root) {
    var rows = [];
    (function walk(n, parent, branch) {
      var pred = n.predicted_value !== undefined ? n.predicted_value : n.predicted_class;
      rows.push({ n: n, parent: parent, branch: branch, pred: pred });
      (n.children || []).forEach(function (c, i) { walk(c, n, i === 0 ? '참' : '거짓'); });
    })(root, null, '');
    var body = rows.map(function (r) {
      var n = r.n;
      return '<tr class="hover:bg-slate-50/50' + (n.is_leaf ? ' bg-blue-50/40' : '') + '">' +
        '<td class="' + TD + ' font-sans font-semibold">' + A.esc(n.node_id) + '</td>' +
        '<td class="' + TD + '">' + A.esc(n.depth) + '</td>' +
        '<td class="' + TD + ' text-left font-sans">' + (r.parent ? A.esc(r.parent.condition) + ' → <b>' + r.branch + '</b>' : '-') + '</td>' +
        '<td class="' + TD + ' text-left font-sans">' + (n.is_leaf ? '<span class="text-blue-700 font-semibold">리프</span>' : A.esc(n.condition)) + '</td>' +
        '<td class="' + TD + '">' + A.num(n.n_samples) + '</td>' +
        '<td class="' + TD + '">' + spssNum(n.impurity, 4) + '</td>' +
        '<td class="' + TD + ' font-bold">' + (typeof r.pred === 'number' ? spssNum(r.pred, 3) : A.esc(r.pred)) + '</td></tr>';
    }).join('');
    return '<div class="matrix-scroll border border-slate-200 rounded-lg"><table class="w-full text-center text-xs border-collapse"><thead><tr>' +
      '<th class="' + TH + '">노드</th><th class="' + TH + '">깊이</th><th class="' + TH + '">상위 분기</th><th class="' + TH + '">분할 조건</th><th class="' + TH + '">표본수</th><th class="' + TH + '">불순도</th><th class="' + TH + '">예측값</th>' +
      '</tr></thead><tbody class="font-mono">' + body + '</tbody></table></div>';
  }

  /** result 를 구조별(행 배열→표, 트리 노드→평탄화 표, 스칼라 객체→카드, 그 외→트리)로 나눠 제목 있는 카드로 만든다 */
  function buildSections(obj) {
    var sections = [], scalarKeys = [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (A.viz.isPrim(v)) { scalarKeys.push(k); return; }
      if (isTreeNode(v)) { var cid = 'dt-chart-' + pendingTrees.length; pendingTrees.push({ id: cid, node: v }); sections.push({ title: '의사결정나무', icon: 'git-branch', body: '<div id="' + cid + '"></div>' }); sections.push({ title: '트리 노드 표', icon: 'table-2', body: treeTable(v) }); return; }
      if (k === 'rules') return; // 트리 차트·노드 표로 대체
      if (isRowArray(v)) { sections.push({ title: A.viz.label(k), icon: 'table-2', body: A.viz.table(v) }); return; }
      if (isPlainObj(v) && Object.keys(v).length) {
        // 스칼라만 있으면 칩으로, 배열/객체가 섞여 있으면 트리로 (칩은 스칼라가 아닌 값을 조용히 누락시키므로 섞인 경우엔 쓰면 안 됨)
        var allPrim = Object.keys(v).every(function (kk) { return A.viz.isPrim(v[kk]); });
        sections.push({ title: A.viz.label(k), icon: 'list-tree', body: allPrim ? A.viz.metricsGrid(v, 20) : A.viz.tree(v, 0) });
        return;
      }
      sections.push({ title: A.viz.label(k), icon: 'braces', body: A.viz.tree(v, 0) });
    });
    return sections;
  }

  function sectionCard(s) {
    return '<div class="card-modern p-5 space-y-3"><div class="flex items-center gap-2 pb-2 border-b border-slate-100">' + A.icon(s.icon, 'w-4 h-4 text-blue-600') + '<h4 class="text-xs font-bold text-slate-900">' + A.esc(s.title) + '</h4></div>' + s.body + '</div>';
  }

  /* ---------------- SPSS 스타일 통계표 (model_summary / anova / coefficients) ---------------- */
  function spssNum(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '';
    var s = Number(v).toFixed(d === undefined ? 3 : d);
    if (Math.abs(Number(v)) < 1) s = s.replace(/^(-?)0\./, '$1.');
    return s;
  }
  function sigFmt(p) {
    if (p === null || p === undefined || isNaN(p)) return '';
    var s = p < 0.0005 ? '.000' : spssNum(p);
    var stars = p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
    return s + stars;
  }
  /** scroll=true: 행렬처럼 커질 수 있는 표 — 최대 높이를 넘으면 스크롤 (머리행·첫 열 고정, app.css .matrix-scroll) */
  function statCard(titleHtml, tableHtml, footnotes, scroll) {
    return '<div class="card-modern p-5 space-y-3"><div class="flex items-center gap-2 pb-2 border-b border-slate-100"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span><h4 class="text-xs font-bold text-slate-900">' + titleHtml + '</h4></div>' +
      '<div class="' + (scroll ? 'matrix-scroll' : 'overflow-x-auto') + ' border border-slate-200 rounded-lg">' + tableHtml + '</div>' +
      '<div class="text-[10px] text-slate-500 space-y-0.5 pt-1">' + footnotes.map(function (f) { return '<div>' + f + '</div>'; }).join('') + '</div></div>';
  }
  var TH = 'p-2.5 border border-slate-200 bg-slate-50 font-semibold text-slate-700 align-middle';
  var SUB_TH = 'p-1.5 border border-slate-200 bg-slate-50 font-semibold text-slate-600 text-[10px] align-middle';
  var TD = 'p-2.5 border border-slate-200';

  /** 실제 API: metrics.{r_squared,adjusted_r_squared,rmse,mse,f_statistic,durbin_watson}, result.anova.{df_model,df_residual} */
  function renderModelSummary(metrics, anova, targetLabel, featureLabels) {
    var r2 = metrics.r_squared, adjR2 = metrics.adjusted_r_squared;
    if (r2 === undefined || r2 === null) return '';
    var predictorsFootnote = 'a. 예측값: (상수)' + (featureLabels.length ? ', ' + featureLabels.map(A.esc).join(', ') : '');
    var targetFootnote = 'b. 종속변수: ' + A.esc(targetLabel);
    var df1 = anova && anova.df_model, df2 = anova && anova.df_residual;
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' +
      '<tr><th rowspan="2" class="' + TH + '">모형</th><th rowspan="2" class="' + TH + '">R 제곱</th><th rowspan="2" class="' + TH + '">수정된 R 제곱</th><th rowspan="2" class="' + TH + '">추정값의 표준오차</th><th colspan="2" class="' + TH + ' border-l border-slate-200">변화량 통계량</th><th rowspan="2" class="' + TH + '">Durbin-Watson</th></tr>' +
      '<tr><th class="' + SUB_TH + ' border-l border-slate-200">F</th><th class="' + SUB_TH + '">유의확률</th></tr>' +
      '</thead><tbody class="font-mono"><tr class="hover:bg-slate-50/50">' +
      '<td class="' + TD + ' font-sans font-semibold">1</td>' +
      '<td class="' + TD + ' font-bold">' + spssNum(r2) + '</td>' +
      '<td class="' + TD + '">' + spssNum(adjR2) + '</td>' +
      '<td class="' + TD + '">' + spssNum(metrics.rmse, 2) + '</td>' +
      '<td class="' + TD + ' border-l border-slate-100">' + spssNum(metrics.f_statistic, 2) + '</td>' +
      '<td class="' + TD + '">' + sigFmt(metrics.f_pvalue) + '</td>' +
      '<td class="' + TD + '">' + spssNum(metrics.durbin_watson) + '</td></tr></tbody></table>';
    return statCard('모형 요약 (Model Summary) <sup class="text-blue-600">b</sup>', table, [predictorsFootnote, targetFootnote, '· 추정값의 표준오차는 RMSE 기준입니다.']);
  }

  /** 실제 API 가 주는 df_model/df_residual/f_statistic/f_pvalue 만 표시한다 (제곱합은 응답에 없으므로 역산하지 않음) */
  function renderAnova(anova, metrics, nObs, targetLabel, featureLabels) {
    if (!anova || anova.f_statistic === undefined) return '';
    var df1 = anova.df_model, df2 = anova.df_residual;
    var body = '<tr class="hover:bg-slate-50/50"><td class="' + TD + ' font-sans font-semibold">1</td><td class="' + TD + ' text-left font-sans">회귀 (Regression)</td><td class="' + TD + '">' + A.esc(df1) + '</td><td class="' + TD + '">' + A.esc(df2) + '</td><td class="' + TD + ' font-bold">' + spssNum(anova.f_statistic) + '</td><td class="' + TD + '">' + sigFmt(anova.f_pvalue) + '<sup class="text-blue-600">b</sup></td></tr>';
    var table = '<table class="w-full text-center text-xs border-collapse"><thead><tr>' +
      '<th class="' + TH + '">모형</th><th class="' + TH + '">구분</th><th class="' + TH + '">자유도(모형)</th><th class="' + TH + '">자유도(잔차)</th>' + '<th class="' + TH + '">F</th><th class="' + TH + '">유의확률 (Sig.)</th>' +
      '</tr></thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('ANOVA (분산분석) <sup class="text-blue-600">a</sup>', table, ['a. 종속변수: ' + A.esc(targetLabel), 'b. 예측값: (상수)' + (featureLabels.length ? ', ' + featureLabels.map(A.esc).join(', ') : '')]);
  }

  /** 실제 API: result.coefficients = [{term, source_variable, coefficient, std_error, t_value, p_value, ci_lower, ci_upper, significant}],
   *  VIF 는 result.diagnostics.vif = [{term, vif}] 에서 term 으로 매칭. 표준화 계수(Beta)는 API가 주지 않아 표시하지 않는다(임의 계산 금지). */
  function renderCoefficients(rows, vifRows, targetLabel) {
    // 선형회귀류(term/coefficient 플랫 구조)에만 적용. 로지스틱 다항 분류 등 다른 모양(class+terms[])은 generic 렌더러로 폴백.
    if (!rows || !rows.length || rows[0].coefficient === undefined || rows[0].z_value !== undefined) return '';
    var vifMap = {};
    (vifRows || []).forEach(function (v) { vifMap[v.term] = v.vif; });
    var body = rows.map(function (row, i) {
      var vif = vifMap[row.term];
      var name = row.source_variable || row.term;
      return '<tr class="hover:bg-slate-50/50">' + (i === 0 ? '<td class="' + TD + ' font-sans font-semibold align-middle" rowspan="' + rows.length + '">1</td>' : '') +
        '<td class="' + TD + ' text-left font-sans">' + A.esc(name) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + spssNum(row.coefficient) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.std_error) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100 font-bold">' + spssNum(row.t_value) + '</td>' +
        '<td class="' + TD + '">' + sigFmt(row.p_value) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + spssNum(row.ci_lower) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.ci_upper) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100' + (vif > 10 ? ' text-red-600 font-bold' : '') + '">' + (vif != null ? spssNum(vif) : '') + '</td></tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' +
      '<tr><th rowspan="2" class="' + TH + ' text-left">모형</th><th colspan="2" class="' + TH + ' border-l border-slate-200">비표준화 계수</th><th rowspan="2" class="' + TH + ' border-l border-slate-200">t</th><th rowspan="2" class="' + TH + '">유의확률</th><th colspan="2" class="' + TH + ' border-l border-slate-200">95.0% 신뢰구간</th><th rowspan="2" class="' + TH + ' border-l border-slate-200">VIF</th></tr>' +
      '<tr><th class="' + SUB_TH + ' border-l border-slate-200">B</th><th class="' + SUB_TH + '">표준오차</th><th class="' + SUB_TH + ' border-l border-slate-200">하한</th><th class="' + SUB_TH + '">상한</th></tr>' +
      '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('계수 (Coefficients) <sup class="text-blue-600">a</sup>', table, ['a. 종속변수: ' + A.esc(targetLabel), '*. 유의확률 p &lt; .05, **. p &lt; .01, ***. p &lt; .001', 'VIF 10 초과(붉은색)는 다중공선성이 의심됩니다.', '※ 표준화 계수(Beta)는 API 응답에 포함되지 않아 생략했습니다.']);
  }


  /** 로지스틱 모형 적합도: metrics.{mcfadden, log_likelihood, llr_pvalue, aic, bic} (이진 모형에서만 제공) */
  function renderLogisticFit(metrics) {
    if (!has(metrics.mcfadden) && !has(metrics.log_likelihood)) return '';
    var ll = metrics.log_likelihood;
    var table = '<table class="w-full text-center text-xs border-collapse"><thead><tr>' +
      '<th class="' + TH + '">-2 로그 우도</th><th class="' + TH + '">로그 우도</th><th class="' + TH + '">McFadden R²</th><th class="' + TH + '">우도비 검정 유의확률</th><th class="' + TH + '">AIC</th><th class="' + TH + '">BIC</th>' +
      '</tr></thead><tbody class="font-mono"><tr class="hover:bg-slate-50/50">' +
      '<td class="' + TD + '">' + (has(ll) ? spssNum(-2 * ll, 3) : '') + '</td>' +
      '<td class="' + TD + '">' + spssNum(ll, 3) + '</td>' +
      '<td class="' + TD + ' font-bold">' + spssNum(metrics.mcfadden) + '</td>' +
      '<td class="' + TD + '">' + sigFmt(metrics.llr_pvalue) + '</td>' +
      '<td class="' + TD + '">' + spssNum(metrics.aic, 3) + '</td>' +
      '<td class="' + TD + '">' + spssNum(metrics.bic, 3) + '</td></tr></tbody></table>';
    return statCard('모형 적합도 (Model Fit)', table, ['우도비 검정: 절편만 있는 모형 대비 전체 모형의 유의성 (LLR p-value)', 'McFadden R²는 유사 결정계수로 0.2~0.4 이면 양호한 적합으로 봅니다.']);
  }

  /** 이진 로지스틱 계수표 (SPSS '방정식에 있는 변수'): coefficient, std_error, z_value, p_value, odds_ratio, or_ci_lower, or_ci_upper */
  function renderLogisticCoefficients(rows, targetLabel, positive) {
    if (!rows || !rows.length || rows[0].z_value === undefined) return '';
    var body = rows.map(function (row) {
      return '<tr class="hover:bg-slate-50/50"><td class="' + TD + ' text-left font-sans">' + A.esc(row.source_variable || row.term) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + spssNum(row.coefficient) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.std_error) + '</td>' +
        '<td class="' + TD + ' font-bold">' + spssNum(row.z_value) + '</td>' +
        '<td class="' + TD + '">' + sigFmt(row.p_value) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100 font-bold">' + spssNum(row.odds_ratio) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.or_ci_lower) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.or_ci_upper) + '</td></tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' +
      '<tr><th rowspan="2" class="' + TH + ' text-left">변수</th><th rowspan="2" class="' + TH + ' border-l border-slate-200">B</th><th rowspan="2" class="' + TH + '">표준오차</th><th rowspan="2" class="' + TH + '">z</th><th rowspan="2" class="' + TH + '">유의확률</th><th rowspan="2" class="' + TH + ' border-l border-slate-200">Exp(B)</th><th colspan="2" class="' + TH + '">Exp(B) 95% 신뢰구간</th></tr>' +
      '<tr><th class="' + SUB_TH + '">하한</th><th class="' + SUB_TH + '">상한</th></tr>' +
      '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('방정식에 있는 변수 (Variables in the Equation) <sup class="text-blue-600">a</sup>', table,
      ['a. 종속변수: ' + A.esc(targetLabel) + (positive != null ? ' (양성 범주: ' + A.esc(positive) + ')' : ''), 'Exp(B) = 오즈비. 1보다 크면 해당 변수가 1단위 증가할 때 양성 범주일 오즈가 증가합니다.', '*. p &lt; .05, **. p &lt; .01, ***. p &lt; .001']);
  }

  /** 다항 로지스틱 회귀: result.coefficients = [{class, terms:[{term,coefficient,odds_ratio}]}] (범주별 계수) */
  function renderMultinomialCoefficients(rows, targetLabel) {
    if (!rows || !rows.length || !rows[0].terms) return '';
    var terms = rows[0].terms.map(function (t) { return t.term; });
    var head = '<tr><th rowspan="2" class="' + TH + ' text-left">변수</th>' + rows.map(function (r) { return '<th colspan="2" class="' + TH + ' border-l border-slate-200">' + A.esc(r.class) + '</th>'; }).join('') + '</tr>' +
      '<tr>' + rows.map(function () { return '<th class="' + SUB_TH + ' border-l border-slate-200">B</th><th class="' + SUB_TH + '">Exp(B)</th>'; }).join('') + '</tr>';
    var body = terms.map(function (term) {
      return '<tr class="hover:bg-slate-50/50"><td class="' + TD + ' text-left font-sans">' + A.esc(term) + '</td>' + rows.map(function (r) {
        var t = r.terms.filter(function (x) { return x.term === term; })[0] || {};
        return '<td class="' + TD + ' border-l border-slate-100">' + spssNum(t.coefficient) + '</td><td class="' + TD + '">' + spssNum(t.odds_ratio, 3) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' + head + '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('다항 로지스틱 회귀계수 (범주별)', table, ['종속변수: ' + A.esc(targetLabel), 'B=비표준화 계수, Exp(B)=오즈비(odds ratio)', '다중 분류 모형은 표준오차·유의확률을 제공하지 않습니다.']);
  }

  /** result.confusion_matrix = {labels:[...], matrix:[[...]]}. 로지스틱/분류트리 공용 */
  function renderConfusionMatrix(cm) {
    if (!cm || !cm.labels || !cm.matrix) return '';
    var labels = cm.labels, matrix = cm.matrix;
    var total = 0, correct = 0, maxVal = 0;
    matrix.forEach(function (row, i) { row.forEach(function (v, j) { total += v; if (i === j) correct += v; if (v > maxVal) maxVal = v; }); });
    var head = '<tr><th class="' + TH + ' mx-sticky">실제 \\ 예측</th>' + labels.map(function (l) { return '<th class="' + TH + '">' + A.esc(l) + '</th>'; }).join('') + '</tr>';
    var body = matrix.map(function (row, i) {
      return '<tr><th class="' + TH + ' text-left mx-sticky">' + A.esc(labels[i]) + '</th>' + row.map(function (v, j) {
        var ratio = maxVal ? v / maxVal : 0;
        var bg = i === j ? 'rgba(37,99,235,' + (0.12 + ratio * 0.55).toFixed(2) + ')' : (v > 0 ? 'rgba(239,68,68,' + (0.06 + ratio * 0.3).toFixed(2) + ')' : '');
        return '<td class="' + TD + ' text-center font-bold" style="background:' + bg + '">' + A.esc(v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' + head + '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('혼동행렬 (Confusion Matrix)', table, ['전체 정확도: ' + (total ? (correct / total * 100).toFixed(1) : '0.0') + '% (' + A.num(correct) + ' / ' + A.num(total) + ')', '행 = 실제값, 열 = 예측값 (대각선 = 정분류)'], true);
  }

  /** PCA: result.components = [{component, explained_variance, explained_variance_ratio, cumulative_ratio, loadings:{변수:적재값}}] */
  function renderPcaVariance(components) {
    if (!components || !components.length) return '';
    var body = components.map(function (c, i) {
      return '<tr class="hover:bg-slate-50/50"><td class="' + TD + ' text-center font-sans font-semibold">' + (i + 1) + '</td>' +
        '<td class="' + TD + ' text-left font-sans">' + A.esc(c.component) + '</td>' +
        '<td class="' + TD + '">' + spssNum(c.explained_variance, 3) + '</td>' +
        '<td class="' + TD + '">' + (c.explained_variance_ratio != null ? (c.explained_variance_ratio * 100).toFixed(2) + '%' : '') + '</td>' +
        '<td class="' + TD + ' font-bold">' + (c.cumulative_ratio != null ? (c.cumulative_ratio * 100).toFixed(2) + '%' : '') + '</td></tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead><tr>' +
      '<th class="' + TH + '">성분</th><th class="' + TH + '">이름</th><th class="' + TH + '">고유값(분산)</th><th class="' + TH + '">분산 설명률</th><th class="' + TH + '">누적 설명률</th>' +
      '</tr></thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('설명된 총분산 (Total Variance Explained)', table, ['추출 방법: 주성분분석 (PCA)']);
  }

  function renderPcaLoadings(components) {
    if (!components || !components.length || !components[0].loadings) return '';
    var features = Object.keys(components[0].loadings);
    var head = '<tr><th class="' + TH + ' text-left mx-sticky">변수</th>' + components.map(function (c) { return '<th class="' + TH + '">' + A.esc(c.component) + '</th>'; }).join('') + '</tr>';
    var body = features.map(function (f) {
      return '<tr class="hover:bg-slate-50/50"><td class="' + TD + ' text-left font-sans mx-sticky">' + A.esc(f) + '</td>' + components.map(function (c) {
        return '<td class="' + TD + '">' + spssNum(c.loadings[f]) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' + head + '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('성분 행렬 (Component Matrix)', table, ['각 변수가 주성분에 기여하는 적재값(loading)입니다.'], true);
  }

  function kpiCard(label, value, caption, colorClass) {
    return '<div class="flex-1 min-w-[130px] bg-white rounded-xl border border-slate-200 p-3.5">' +
      '<div class="text-[11px] font-semibold text-slate-500 mb-1.5 truncate">' + label + '</div>' +
      '<div class="text-xl font-extrabold font-mono ' + (colorClass || 'text-slate-900') + '">' + value + '</div>' +
      '<div class="text-[10px] text-slate-400 mt-1 truncate">' + caption + '</div></div>';
  }

  /** 회귀분석류 결과(metrics.r_squared 가 있을 때)만 이 카드 행을 쓰고, 그 외 기법은 기존 범용 칩으로 폴백한다 */
  function has(v) { return v !== undefined && v !== null; }

  /** 분류 계열(accuracy 보유): 로지스틱/의사결정나무(분류) */
  function renderClassificationCards(metrics, result) {
    var cards = [];
    var n = result.n_observations != null ? result.n_observations : metrics.n_samples;
    if (n != null) cards.push(kpiCard('표본수 (N)', A.num(n), '유효 관측치'));
    cards.push(kpiCard('정확도 (Accuracy)', (metrics.accuracy * 100).toFixed(1) + '%', '검증셋 기준', 'text-blue-600'));
    if (has(metrics.precision)) cards.push(kpiCard('정밀도 (Precision)', Number(metrics.precision).toFixed(3), '예측 양성 중 적중'));
    if (has(metrics.recall)) cards.push(kpiCard('재현율 (Recall)', Number(metrics.recall).toFixed(3), '실제 양성 중 적중'));
    if (has(metrics.f1)) cards.push(kpiCard('F1 점수', Number(metrics.f1).toFixed(3), '정밀도·재현율 조화평균', 'text-violet-600'));
    if (has(metrics.roc_auc)) cards.push(kpiCard('ROC-AUC', Number(metrics.roc_auc).toFixed(3), '분류 판별력', 'text-emerald-600'));
    if (has(metrics.log_loss)) cards.push(kpiCard('Log Loss', spssNum(metrics.log_loss, 3), '낮을수록 우수'));
    if (has(metrics.mcfadden)) cards.push(kpiCard('McFadden R²', spssNum(metrics.mcfadden, 3), '유사 결정계수', 'text-amber-600'));
    if (has(metrics.aic)) cards.push(kpiCard('AIC / BIC', spssNum(metrics.aic, 1), has(metrics.bic) ? 'BIC ' + spssNum(metrics.bic, 1) : ''));
    return cards;
  }

  /** 군집 계열(silhouette 보유): K-평균/계층적/DBSCAN */
  function renderClusterCards(metrics, result) {
    var cards = [];
    var n = result.n_observations != null ? result.n_observations : metrics.n_samples;
    if (n != null) cards.push(kpiCard('표본수 (N)', A.num(n), '유효 관측치'));
    if (has(metrics.n_clusters)) cards.push(kpiCard('군집 수', A.num(metrics.n_clusters), '', 'text-blue-600'));
    cards.push(kpiCard('실루엣 (Silhouette)', Number(metrics.silhouette).toFixed(3), '1에 가까울수록 우수', 'text-emerald-600'));
    if (has(metrics.calinski_harabasz)) cards.push(kpiCard('Calinski-Harabasz', spssNum(metrics.calinski_harabasz, 1), '클수록 우수'));
    if (has(metrics.davies_bouldin)) cards.push(kpiCard('Davies-Bouldin', Number(metrics.davies_bouldin).toFixed(3), '낮을수록 우수', 'text-violet-600'));
    if (has(metrics.variance_ratio)) cards.push(kpiCard('군집 간 분산 비율', (metrics.variance_ratio * 100).toFixed(1) + '%', 'between_ss / total_ss'));
    if (has(metrics.inertia)) cards.push(kpiCard('Inertia', spssNum(metrics.inertia, 1), '군집 내 제곱합'));
    if (has(metrics.n_noise)) cards.push(kpiCard('노이즈 점', A.num(metrics.n_noise), has(metrics.noise_ratio) ? (metrics.noise_ratio * 100).toFixed(1) + '%' : '', 'text-amber-600'));
    return cards;
  }


  /** 상관분석: result.{columns, matrix, pairs:[{x,y,coefficient,p_value,strength}], correlation_method, n_observations, interpretation} */
  function isCorrelation(result) { return Array.isArray(result.columns) && Array.isArray(result.matrix) && Array.isArray(result.pairs); }
  function corrMethodLabel(m) { return ({ pearson: 'Pearson', spearman: 'Spearman', kendall: 'Kendall' })[m] || m || 'Pearson'; }
  function stars(p) { return p == null ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : ''; }

  /** SPSS '상관관계' 표: 변수마다 상관계수 / 유의확률(양측) / N 3행 */
  function renderCorrelationMatrix(result) {
    if (!isCorrelation(result)) return '';
    var cols = result.columns, pMap = {}, n = result.n_observations, mLabel = corrMethodLabel(result.correlation_method);
    result.pairs.forEach(function (p) { pMap[p.x + '\u0000' + p.y] = p.p_value; pMap[p.y + '\u0000' + p.x] = p.p_value; });
    var head = '<tr><th class="' + TH + ' mx-sticky" colspan="2"></th>' + cols.map(function (c) { return '<th class="' + TH + '">' + A.esc(c) + '</th>'; }).join('') + '</tr>';
    var body = cols.map(function (rv, i) {
      var sub = [[mLabel + ' 상관계수', function (j) { var r = result.matrix[i][j]; return i === j ? '1' : '<span class="' + (Math.abs(r) >= 0.7 ? 'font-bold text-blue-700' : '') + '">' + spssNum(r) + stars(pMap[rv + '\u0000' + cols[j]]) + '</span>'; }],
                 ['유의확률 (양측)', function (j) { return i === j ? '' : sigFmt(pMap[rv + '\u0000' + cols[j]]).replace(/\*+$/, ''); }],
                 ['N', function () { return n != null ? A.num(n) : ''; }]];
      return sub.map(function (s, k) {
        return '<tr class="hover:bg-slate-50/50">' + (k === 0 ? '<td class="' + TD + ' text-left font-sans font-semibold align-middle mx-sticky" rowspan="3">' + A.esc(rv) + '</td>' : '') +
          '<td class="' + TD + ' text-left font-sans text-slate-600">' + s[0] + '</td>' + cols.map(function (_, j) { return '<td class="' + TD + '">' + s[1](j) + '</td>'; }).join('') + '</tr>';
      }).join('');
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' + head + '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('상관관계 (Correlations)', table, ['*. 상관계수는 0.05 수준(양측)에서 유의합니다. **. 0.01 수준, ***. 0.001 수준.', '굵은 파란색: |r| ≥ 0.7 (강한 상관)'], true);
  }

  /** 쌍별 상관계수 표: |r| 내림차순, 강도 분류 포함 */
  function renderCorrelationPairs(result) {
    if (!isCorrelation(result) || !result.pairs.length) return '';
    var rows = result.pairs.slice().sort(function (a, b) { return Math.abs(b.coefficient) - Math.abs(a.coefficient); });
    var body = rows.map(function (p, i) {
      var strong = Math.abs(p.coefficient) >= 0.7;
      return '<tr class="hover:bg-slate-50/50' + (strong ? ' bg-blue-50/50' : '') + '"><td class="' + TD + ' font-sans">' + (i + 1) + '</td>' +
        '<td class="' + TD + ' text-left font-sans">' + A.esc(p.x) + '</td><td class="' + TD + ' text-left font-sans">' + A.esc(p.y) + '</td>' +
        '<td class="' + TD + ' font-bold">' + spssNum(p.coefficient) + stars(p.p_value) + '</td>' +
        '<td class="' + TD + '">' + sigFmt(p.p_value).replace(/\*+$/, '') + '</td>' +
        '<td class="' + TD + ' font-sans">' + A.esc(p.strength || '') + '</td></tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead><tr>' +
      '<th class="' + TH + '">순위</th><th class="' + TH + '">변수 1</th><th class="' + TH + '">변수 2</th><th class="' + TH + '">상관계수 (r)</th><th class="' + TH + '">유의확률 (양측)</th><th class="' + TH + '">강도</th>' +
      '</tr></thead><tbody class="font-mono">' + body + '</tbody></table>';
    var notes = ['상관계수 절댓값 기준 내림차순 정렬', '*. p &lt; .05, **. p &lt; .01, ***. p &lt; .001'];
    if (result.interpretation) notes.unshift(A.esc(result.interpretation));
    return statCard('쌍별 상관계수 (Pairwise Correlations)', table, notes, true);
  }

  /** 상관분석 요약 카드: n_variables, n_pairs, n_strong_pairs, max_abs_coefficient */
  function renderCorrelationCards(metrics, result) {
    var cards = [];
    if (has(result.n_observations)) cards.push(kpiCard('표본수 (N)', A.num(result.n_observations), '유효 관측치'));
    if (has(metrics.n_variables)) cards.push(kpiCard('변수 수', A.num(metrics.n_variables), corrMethodLabel(result.correlation_method) + ' 상관'));
    if (has(metrics.n_pairs)) cards.push(kpiCard('변수 쌍 수', A.num(metrics.n_pairs), '분석된 조합'));
    if (has(metrics.n_strong_pairs)) cards.push(kpiCard('강한 상관 쌍', A.num(metrics.n_strong_pairs), '|r| ≥ 0.7', metrics.n_strong_pairs ? 'text-blue-600' : 'text-slate-900'));
    if (has(metrics.max_abs_coefficient)) cards.push(kpiCard('최대 |r|', Number(metrics.max_abs_coefficient).toFixed(3), '가장 강한 상관', 'text-violet-600'));
    return cards;
  }


  /** 지표정리표 '요약 지표' 카드: PCA / ANOVA / 다층 / 성장 / PSM */
  function renderOtherCards(metrics, result) {
    var c = [], sig = function (p) { return p == null ? '' : p < 0.001 ? 'p < .001' : 'p = ' + spssNum(p); };
    if (has(metrics.n_components) && has(metrics.total_explained_variance)) {
      if (has(result.n_observations)) c.push(kpiCard('표본수 (N)', A.num(result.n_observations), '유효 관측치'));
      c.push(kpiCard('주성분 수', A.num(metrics.n_components), '추출 성분'));
      c.push(kpiCard('누적 설명분산', (metrics.total_explained_variance * 100).toFixed(1) + '%', '전체 분산 중 설명 비율', 'text-blue-600'));
      if (has(metrics.first_component_ratio)) c.push(kpiCard('제1주성분 비율', (metrics.first_component_ratio * 100).toFixed(1) + '%', '첫 성분 설명력', 'text-violet-600'));
    } else if (has(metrics.model_r_squared)) {
      if (has(metrics.n_observations)) c.push(kpiCard('표본수 (N)', A.num(metrics.n_observations), '유효 관측치'));
      c.push(kpiCard('모형 R²', Number(metrics.model_r_squared).toFixed(3), '설명력 ' + (metrics.model_r_squared * 100).toFixed(1) + '%', 'text-blue-600'));
      if (has(metrics.n_significant_terms)) c.push(kpiCard('유의한 효과 수', A.num(metrics.n_significant_terms), 'p < .05'));
      if (has(metrics.max_eta_squared)) c.push(kpiCard('최대 효과크기 (η²)', Number(metrics.max_eta_squared).toFixed(3), '가장 큰 효과', 'text-violet-600'));
      if (has(metrics.levene_p_value)) c.push(kpiCard('Levene 등분산', 'p=' + spssNum(metrics.levene_p_value), metrics.levene_p_value >= 0.05 ? '등분산 충족' : '등분산 위배', 'text-amber-600'));
    } else if (has(metrics.n_individuals)) {
      c.push(kpiCard('개체 수', A.num(metrics.n_individuals), '관측치 ' + A.num(metrics.n_observations)));
      if (has(metrics.average_growth_rate)) c.push(kpiCard('평균 성장률', spssNum(metrics.average_growth_rate, 3), '시간 1단위당 · ' + sig(metrics.average_growth_rate_p_value), 'text-blue-600'));
      if (has(metrics.slope_variance)) c.push(kpiCard('기울기 분산', spssNum(metrics.slope_variance, 4), '개체 간 성장률 차이', 'text-violet-600'));
      if (has(metrics.aic)) c.push(kpiCard('AIC / BIC', spssNum(metrics.aic, 1), has(metrics.bic) ? 'BIC ' + spssNum(metrics.bic, 1) : ''));
    } else if (has(metrics.icc) && has(metrics.n_groups)) {
      c.push(kpiCard('집단 수', A.num(metrics.n_groups), '관측치 ' + A.num(metrics.n_observations)));
      c.push(kpiCard('ICC', Number(metrics.icc).toFixed(3), '집단 간 분산 비율', 'text-blue-600'));
      if (has(metrics.unconditional_icc)) c.push(kpiCard('무조건모형 ICC', Number(metrics.unconditional_icc).toFixed(3), '예측변수 투입 전', 'text-violet-600'));
      if (has(metrics.log_likelihood)) c.push(kpiCard('로그 우도', spssNum(metrics.log_likelihood, 2), has(metrics.aic) ? 'AIC ' + spssNum(metrics.aic, 1) : ''));
    } else if (has(metrics.n_treated)) {
      c.push(kpiCard('처치군', A.num(metrics.n_treated), '매칭 ' + A.num(metrics.n_matched_treated) + '명'));
      if (has(metrics.match_rate)) c.push(kpiCard('매칭률', (metrics.match_rate * 100).toFixed(1) + '%', '처치군 중 매칭 성공', 'text-blue-600'));
      if (has(metrics.mean_abs_smd_after)) c.push(kpiCard('평균 |SMD|', spssNum(metrics.mean_abs_smd_before) + ' → ' + spssNum(metrics.mean_abs_smd_after), metrics.mean_abs_smd_after < 0.1 ? '매칭 후 균형 양호' : '매칭 후 불균형', 'text-emerald-600'));
      if (has(metrics.att)) c.push(kpiCard('ATT', spssNum(metrics.att, 3) + stars(metrics.att_p_value), sig(metrics.att_p_value), 'text-violet-600'));
    }
    return c;
  }

  function renderSummaryCards(metrics, result) {
    var wrap = function (cards) { return '<div class="flex flex-wrap gap-3">' + cards.join('') + '</div>'; };
    if (!has(metrics.r_squared)) {
      if (has(metrics.accuracy)) return wrap(renderClassificationCards(metrics, result));
      if (has(metrics.silhouette)) return wrap(renderClusterCards(metrics, result));
      if (has(metrics.n_pairs) && has(metrics.max_abs_coefficient)) return wrap(renderCorrelationCards(metrics, result));
      var oc = renderOtherCards(metrics, result);
      return oc.length ? wrap(oc) : null;
    }
    var cards = [];
    var n = result.n_observations != null ? result.n_observations : metrics.n_samples;
    if (n != null) cards.push(kpiCard('표본수 (N)', A.num(n), '유효 관측치'));
    cards.push(kpiCard('결정계수 (R²)', Number(metrics.r_squared).toFixed(3), '설명력 ' + (metrics.r_squared * 100).toFixed(1) + '%', 'text-blue-600'));
    if (metrics.adjusted_r_squared != null) cards.push(kpiCard('수정 R² (Adj.)', Number(metrics.adjusted_r_squared).toFixed(3), '자유도 보정', 'text-violet-600'));
    if (metrics.f_statistic != null) {
      var fp = metrics.f_pvalue;
      var fStars = fp == null ? '' : fp < 0.001 ? '***' : fp < 0.01 ? '**' : fp < 0.05 ? '*' : '';
      var fCaption = fp == null ? '' : fp < 0.001 ? 'p < .001 (유의)' : fp < 0.01 ? 'p < .01 (유의)' : fp < 0.05 ? 'p < .05 (유의)' : 'p = ' + spssNum(fp) + ' (유의하지 않음)';
      cards.push(kpiCard('F 통계량', spssNum(metrics.f_statistic, 2) + fStars, fCaption));
    }
    if (metrics.rmse != null) cards.push(kpiCard('추정 표준오차', spssNum(metrics.rmse, 3), 'RMSE 추정치'));
    var norm = result.diagnostics && result.diagnostics.normality;
    if (norm && norm.statistic != null) cards.push(kpiCard('잔차 정규성 (S-W)', 'W=' + Number(norm.statistic).toFixed(3), 'p = ' + spssNum(norm.p_value) + (norm.normal ? ' (정규성 만족)' : ' (정규성 위배)'), 'text-emerald-600'));
    var homo = result.diagnostics && result.diagnostics.homoscedasticity;
    if (metrics.durbin_watson != null || homo) {
      var dwText = metrics.durbin_watson != null ? 'DW = ' + spssNum(metrics.durbin_watson, 3) : '-';
      var bpText = homo ? 'BP p=' + spssNum(homo.p_value) + (homo.homoscedastic ? ' (등분산 충족)' : ' (이분산 의심)') : '';
      cards.push(kpiCard('등분산 / 자기상관', dwText, bpText, 'text-amber-600'));
    }
    return '<div class="flex flex-wrap gap-3">' + cards.join('') + '</div>';
  }

  /* ---------------- 지표정리표(분석기법별지표정리.md) 기준 기법별 결과표 ---------------- */
  /** 범용 표: head = 머리칸 HTML 배열, rows = 셀 HTML 배열의 배열 (첫 열은 좌측 정렬 라벨) */
  function tbl(head, rows) {
    return '<table class="w-full text-center text-xs border-collapse"><thead><tr>' + head.map(function (h, i) { return '<th class="' + TH + (i === 0 ? ' text-left mx-sticky' : '') + '">' + h + '</th>'; }).join('') + '</tr></thead><tbody class="font-mono">' +
      rows.map(function (r) { return '<tr class="hover:bg-slate-50/50">' + r.map(function (c, i) { return '<td class="' + TD + (i === 0 ? ' text-left font-sans mx-sticky' : '') + '">' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  /** 지표 한 줄 표: items = [[머리, 값HTML], ...] 중 값이 있는 것만 */
  function kvRow(items) {
    items = items.filter(function (x) { return x[1] !== '' && x[1] != null; });
    if (!items.length) return '';
    return '<table class="w-full text-center text-xs border-collapse"><thead><tr>' + items.map(function (x) { return '<th class="' + TH + '">' + x[0] + '</th>'; }).join('') + '</tr></thead><tbody class="font-mono"><tr>' +
      items.map(function (x) { return '<td class="' + TD + '">' + x[1] + '</td>'; }).join('') + '</tr></tbody></table>';
  }
  function n0(v) { return has(v) ? A.num(v) : ''; }
  function pc(v) { return has(v) ? (v * 100).toFixed(1) + '%' : ''; }
  function yes(b, t, f) { return b == null ? '' : '<span class="font-sans font-semibold ' + (b ? 'text-emerald-700' : 'text-rose-600') + '">' + (b ? t : f) + '</span>'; }
  function noteOf(result) { return result.note ? [A.esc(result.note)] : []; }
  var SIG_NOTE = '*. p &lt; .05, **. p &lt; .01, ***. p &lt; .001';

  /* 선형 회귀: 적합도·예측 오차·모형 비교 / 잔차 진단 */
  function renderLinearFit(metrics) {
    var t = kvRow([['검증셋 R²', spssNum(metrics.holdout_r_squared)], ['RMSE', spssNum(metrics.rmse, 3)], ['MSE', spssNum(metrics.mse, 3)], ['MAE', spssNum(metrics.mae, 3)], ['MAPE', pc(metrics.mape)],
      ['AIC', spssNum(metrics.aic, 3)], ['BIC', spssNum(metrics.bic, 3)], ['로그 우도', spssNum(metrics.log_likelihood, 3)]]);
    if (!t) return '';
    return statCard('모형 적합도 및 예측 오차', t, [metrics.evaluation === 'in_sample' ? '검증셋을 따로 두지 않아 학습셋 기준으로 계산했습니다.' : 'R²·AIC 등은 학습셋, 검증셋 R²와 오차 지표(RMSE·MSE·MAE·MAPE)는 검증셋 기준입니다.']);
  }
  function renderLinearDiagnostics(metrics, diag) {
    diag = diag || {};
    var rows = [], norm = diag.normality, homo = diag.homoscedasticity, vif = diag.vif || [];
    if (has(metrics.durbin_watson)) rows.push(['자기상관', 'Durbin-Watson', spssNum(metrics.durbin_watson), '', yes(metrics.durbin_watson >= 1.5 && metrics.durbin_watson <= 2.5, '독립성 충족 (1.5~2.5)', '자기상관 의심')]);
    if (norm) rows.push(['잔차 정규성', A.esc(norm.test || 'Shapiro-Wilk'), spssNum(norm.statistic), sigFmt(norm.p_value), yes(norm.normal, '정규성 충족', '정규성 위배')]);
    if (homo) rows.push(['등분산성', A.esc(homo.test || 'Breusch-Pagan'), spssNum(homo.lm_statistic != null ? homo.lm_statistic : homo.statistic), sigFmt(homo.p_value), yes(homo.homoscedastic, '등분산 충족', '이분산 의심')]);
    if (vif.length) { var mx = Math.max.apply(null, vif.map(function (v) { return v.vif; })); rows.push(['다중공선성', '최대 VIF', spssNum(mx), '', yes(mx <= 10, 'VIF ≤ 10 (양호)', 'VIF > 10 (다중공선성 의심)')]); }
    if (!rows.length) return '';
    return statCard('회귀 진단 (Regression Diagnostics)', tbl(['진단 항목', '검정', '통계량', '유의확률', '판정'], rows), ['정규성·등분산성은 p ≥ .05 이면 가정을 충족한 것으로 봅니다.', '변수별 VIF는 계수표의 VIF 열을 참고하세요.']);
  }

  /* 고정효과 계수표 (다층모형·성장모형): coefficient, std_error, p_value, ci_lower, ci_upper */
  function renderFixedEffects(rows, targetLabel, title) {
    if (!rows || !rows.length) return '';
    var body = rows.map(function (r) { return [A.esc(r.source_variable || r.term), spssNum(r.coefficient), spssNum(r.std_error), '<b>' + sigFmt(r.p_value) + '</b>', spssNum(r.ci_lower), spssNum(r.ci_upper)]; });
    return statCard((title || '고정효과 (Fixed Effects)') + ' <sup class="text-blue-600">a</sup>', tbl(['모수', 'B', '표준오차', '유의확률', '95% CI 하한', '95% CI 상한'], body), ['a. 종속변수: ' + A.esc(targetLabel), SIG_NOTE]);
  }

  /* 의사결정나무: 구조 + 변수 중요도 + 트리 */
  function renderTreeStructure(metrics, result) {
    var t = kvRow([['트리 깊이', n0(result.tree_depth)], ['리프 노드 수', n0(result.n_leaves)], ['분할 기준', A.esc(result.criterion || '')], ['표본수', n0(result.n_observations)],
      ['결정계수 (R²)', spssNum(metrics.r_squared)], ['학습셋 R²', spssNum(metrics.train_r_squared)], ['RMSE', spssNum(metrics.rmse, 3)], ['MSE', spssNum(metrics.mse, 3)], ['MAE', spssNum(metrics.mae, 3)]]);
    if (!t) return '';
    if (!has(metrics.r_squared)) return statCard('모형 구조', t, ['분류 성능 지표는 상단 요약 카드를 참고하세요.']);
    return statCard('모형 구조 및 성능', t, [metrics.evaluation === 'in_sample' ? '검증셋을 따로 두지 않아 학습셋 기준으로 계산했습니다.' : '성능 지표는 검증셋 기준입니다.']);
  }
  function renderImportance(rows) {
    if (!rows || !rows.length) return '';
    var sorted = rows.slice().sort(function (a, b) { return b.importance - a.importance; });
    return statCard('변수 중요도 (Feature Importance)', tbl(['순위', '변수', '중요도', '비율'], sorted.map(function (r, i) {
      return [String(i + 1), A.esc(r.source_variable || r.feature), spssNum(r.importance), '<div class="flex items-center gap-2"><div class="flex-1 h-1.5 bg-slate-100 rounded"><div class="h-1.5 bg-blue-600 rounded" style="width:' + (r.importance * 100).toFixed(1) + '%"></div></div><span class="w-12 text-right">' + pc(r.importance) + '</span></div>'];
    })), ['불순도 감소량 기준(feature_importances_), 합계 = 100%'], true);
  }
  function renderTreeCards(tree) {
    if (!isTreeNode(tree)) return '';
    var cid = 'dt-chart-' + pendingTrees.length;
    pendingTrees.push({ id: cid, node: tree });
    return sectionCard({ title: '의사결정나무', icon: 'git-branch', body: '<div id="' + cid + '"></div>' }) + sectionCard({ title: '트리 노드 표 (분할 규칙)', icon: 'table-2', body: treeTable(tree) });
  }

  /* 군집분석: 품질 / 엘보표 / 군집 프로파일 / 군집 간 F 검정 */
  function renderClusterQuality(metrics, result) {
    var t = kvRow([['군집 수', n0(has(metrics.n_clusters) ? metrics.n_clusters : result.n_clusters)], ['실루엣', spssNum(metrics.silhouette)], ['Calinski-Harabasz', spssNum(metrics.calinski_harabasz, 2)], ['Davies-Bouldin', spssNum(metrics.davies_bouldin)],
      ['Inertia', spssNum(metrics.inertia, 2)], ['반복 횟수', n0(metrics.n_iter)], ['군집 간 SS', spssNum(metrics.between_ss, 2)], ['총 SS', spssNum(metrics.total_ss, 2)], ['분산 설명 비율', pc(metrics.variance_ratio)],
      ['노이즈 수', n0(metrics.n_noise)], ['노이즈 비율', pc(metrics.noise_ratio)], ['연결 방법', A.esc(result.linkage || '')], ['eps', has(result.eps) ? spssNum(result.eps) : ''], ['min_samples', n0(result.min_samples)]]);
    if (!t) return '';
    var notes = ['실루엣: 1에 가까울수록, Calinski-Harabasz: 클수록, Davies-Bouldin: 0에 가까울수록 군집이 잘 분리됨'];
    if (result.auto_selected) notes.push('군집 수는 엘보·실루엣 탐색으로 자동 선택되었습니다.');
    if (result.summary) notes.unshift(A.esc(result.summary));
    return statCard('군집 품질 (Cluster Quality)', t, notes);
  }
  function renderElbow(rows, k) {
    if (!rows || !rows.length) return '';
    return statCard('엘보 탐색표 (k별 Inertia · 실루엣)', tbl(['k', 'Inertia', '실루엣'], rows.map(function (r) {
      var sel = r.k === k;
      return [(sel ? '<b class="text-blue-700">' + r.k + ' (선택)</b>' : String(r.k)), spssNum(r.inertia, 2), sel ? '<b>' + spssNum(r.silhouette) + '</b>' : spssNum(r.silhouette)];
    })), ['Inertia 감소가 완만해지는 지점(엘보)과 실루엣이 높은 k를 함께 고려합니다.']);
  }
  function renderClusterProfiles(rows) {
    if (!rows || !rows.length || !rows[0].means) return '';
    var feats = Object.keys(rows[0].means);
    return statCard('군집 프로파일 (군집별 크기·변수 평균)', tbl(['군집', '크기', '비율'].concat(feats.map(A.esc)), rows.map(function (r) {
      return [A.esc(r.label || ('군집 ' + r.cluster)), A.num(r.size), pc(r.ratio)].concat(feats.map(function (f) {
        var z = r.z_means && r.z_means[f];
        return '<span title="표준화 평균 ' + spssNum(z) + '" class="' + (z >= 0.5 ? 'text-blue-700 font-bold' : z <= -0.5 ? 'text-rose-600 font-bold' : '') + '">' + spssNum(r.means[f], 3) + '</span>';
      }));
    })), ['변수 값은 군집별 평균(원 척도)입니다. 파란색/빨간색: 전체 평균 대비 표준화 평균이 +0.5 이상 / -0.5 이하'], true);
  }
  function renderClusterAnova(rows) {
    if (!Array.isArray(rows) || !rows.length || rows[0].feature === undefined) return '';
    return statCard('군집 간 차이 검정 (일원분산분석, f_oneway)', tbl(['변수', 'F', '유의확률'], rows.map(function (r) { return [A.esc(r.feature), '<b>' + spssNum(r.f_statistic, 3) + '</b>', sigFmt(r.p_value)]; })), ['유의확률이 작을수록 해당 변수가 군집을 구분하는 데 기여합니다.', SIG_NOTE], true);
  }

  /* ANOVA / ANCOVA */
  function renderAnovaTable(result, metrics) {
    var rows = result.anova_table;
    if (!rows || !rows.length) return '';
    var body = rows.map(function (r) {
      var resid = r.term === 'Residual';
      return [resid ? '오차 (Residual)' : A.esc(r.term.replace(/^Q\('(.*)'\)$/, '$1')), spssNum(r.sum_sq, 3), n0(r.df), resid ? '' : '<b>' + spssNum(r.f_statistic, 3) + '</b>', resid ? '' : sigFmt(r.p_value), resid ? '' : spssNum(r.eta_squared)];
    });
    var notes = ['a. 종속변수: ' + A.esc(result.target || '-'), 'R 제곱 = ' + spssNum(has(result.model_r_squared) ? result.model_r_squared : metrics.model_r_squared), 'Type II 제곱합, 효과크기 η² = 해당 항 제곱합 / 전체 제곱합', SIG_NOTE];
    if (result.covariates && result.covariates.length) notes.splice(1, 0, '공변량: ' + result.covariates.map(A.esc).join(', '));
    return statCard('개체-간 효과 검정 (Tests of Between-Subjects Effects) <sup class="text-blue-600">a</sup>', tbl(['소스', '제곱합', '자유도', 'F', '유의확률', 'η²'], body), notes);
  }
  function renderAssumptions(ac) {
    if (!ac) return '';
    var rows = [];
    if (ac.levene) rows.push(['등분산성', 'Levene' + (ac.levene.factor ? ' (' + A.esc(ac.levene.factor) + ')' : ''), sigFmt(ac.levene.p_value), yes(ac.levene.equal_variance, '등분산 충족', '등분산 위배')]);
    if (ac.normality) rows.push(['잔차 정규성', A.esc(ac.normality.test || 'Shapiro-Wilk'), sigFmt(ac.normality.p_value), yes(ac.normality.normal, '정규성 충족', '정규성 위배')]);
    return rows.length ? statCard('가정 검정 (Assumption Checks)', tbl(['가정', '검정', '유의확률', '판정'], rows), ['p ≥ .05 이면 가정을 충족한 것으로 봅니다.']) : '';
  }
  function renderGroupStats(means, boxes) {
    if (!means || !means.length) return '';
    var bmap = {};
    (boxes || []).forEach(function (b) { bmap[b.factor + '\u0000' + b.group] = b; });
    var multi = means.some(function (m) { return m.factor !== means[0].factor; });
    var hasBox = (boxes || []).length > 0;
    var head = ['집단', 'N', '평균', '표준편차', '95% CI 하한', '95% CI 상한'].concat(hasBox ? ['최솟값', 'Q1', '중앙값', 'Q3', '최댓값'] : []);
    return statCard('집단별 기술통계 (Descriptive Statistics)', tbl(head, means.map(function (m) {
      var b = bmap[m.factor + '\u0000' + m.group] || {};
      return [(multi ? A.esc(m.factor) + ': ' : '') + A.esc(m.group), A.num(m.n), '<b>' + spssNum(m.mean, 3) + '</b>', spssNum(m.std, 3), spssNum(m.ci_lower, 3), spssNum(m.ci_upper, 3)]
        .concat(hasBox ? [spssNum(b.min, 3), spssNum(b.q1, 3), spssNum(b.median, 3), spssNum(b.q3, 3), spssNum(b.max, 3)] : []);
    })), [], true);
  }
  function renderPostHoc(ph) {
    if (!ph || !Object.keys(ph).length) return '';
    return Object.keys(ph).map(function (f) {
      var rows = ph[f] || [];
      if (!rows.length) return '';
      return statCard('사후검정: Tukey HSD (' + A.esc(f) + ')', tbl(['(I) 집단', '(J) 집단', '평균차 (J-I)', '유의확률', '95% CI 하한', '95% CI 상한'], rows.map(function (r) {
        return [A.esc(r.group1), A.esc(r.group2), '<b>' + spssNum(r.mean_diff, 3) + (r.significant ? '*' : '') + '</b>', sigFmt(r.p_adj).replace(/\*+$/, ''), spssNum(r.ci_lower, 3), spssNum(r.ci_upper, 3)];
      })), ['*. 평균차는 0.05 수준에서 유의합니다 (Tukey 보정 p).'], true);
    }).join('');
  }

  /* 다층모형 / 성장모형 */
  function renderMultilevelInfo(metrics, result) {
    var fit = result.model_fit || {};
    var t = kvRow([[has(metrics.n_individuals) ? '개체 수' : '집단 수', n0(has(metrics.n_groups) ? metrics.n_groups : metrics.n_individuals)], ['관측치 수', n0(metrics.n_observations)], ['ICC', spssNum(metrics.icc)], ['무조건모형 ICC', spssNum(metrics.unconditional_icc)],
      ['평균 성장률', has(metrics.average_growth_rate) ? '<b>' + spssNum(metrics.average_growth_rate, 3) + '</b>' : ''], ['성장률 유의확률', sigFmt(metrics.average_growth_rate_p_value)],
      ['로그 우도', spssNum(has(metrics.log_likelihood) ? metrics.log_likelihood : fit.log_likelihood, 3)], ['AIC', has(metrics.aic) ? spssNum(metrics.aic, 3) : '-'], ['BIC', has(metrics.bic) ? spssNum(metrics.bic, 3) : '-'], ['수렴', yes(fit.converged, '수렴', '미수렴')]]);
    if (!t) return '';
    var title = has(metrics.n_individuals) ? '성장모형 요약 (개체 ' + A.num(metrics.n_individuals) + '명)' : '다층모형 요약';
    return statCard(title, t, ['AIC/BIC는 REML 추정에서는 제공되지 않아 "-"로 표시됩니다.'].concat(noteOf(result)));
  }
  function renderVarianceComponents(result, metrics) {
    var vc = result.variance_components, uv = result.unconditional_variance;
    if (!vc) return '';
    var rows = [['집단 간 분산 (τ00)', spssNum(vc.group_variance, 4), uv ? spssNum(uv.group_variance, 4) : null],
      ['개인 내 잔차 분산 (σ²)', spssNum(vc.residual_variance, 4), uv ? spssNum(uv.residual_variance, 4) : null],
      ['ICC = τ00 / (τ00 + σ²)', '<b>' + spssNum(vc.icc) + '</b>', uv ? spssNum(uv.icc) : null]];
    [['slope_variance', '기울기 분산 (τ11)'], ['intercept_slope_covariance', '절편-기울기 공분산 (τ01)'], ['intercept_slope_correlation', '절편-기울기 상관']].forEach(function (k) {
      var v = has(vc[k[0]]) ? vc[k[0]] : metrics[k[0]];
      if (has(v)) rows.push([k[1], spssNum(v, 4), uv ? '' : null]);
    });
    var head = ['분산 성분', uv ? '연구모형' : '추정값'].concat(uv ? ['무조건모형'] : []);
    return statCard('분산 성분 (Variance Components)', tbl(head, rows.map(function (r) { return uv ? r : r.slice(0, 2); })), uv ? ['무조건모형: 예측변수 없이 집단만 고려한 기준 모형'] : []);
  }
  function renderRandomEffects(rows) {
    if (!rows || !rows.length) return '';
    var keys = Object.keys(rows[0]).filter(function (k) { return k !== 'group'; });
    return statCard('확률효과 (집단별 확률절편' + (keys.length > 1 ? '·기울기' : '') + ')', tbl(['집단'].concat(keys.map(function (k) { return k === 'const' ? '확률절편' : A.esc(k); })), rows.map(function (r) {
      return [A.esc(r.group)].concat(keys.map(function (k) { return spssNum(r[k], 4); }));
    })), ['전체 평균(고정효과) 대비 각 집단의 편차입니다.'], true);
  }

  /* PSM */
  function renderPsmSummary(result, metrics) {
    var t = kvRow([['처치군', n0(result.n_treated)], ['대조군', n0(result.n_control)], ['매칭된 처치군', n0(result.n_matched_treated)], ['매칭률', pc(has(result.match_rate) ? result.match_rate : metrics.match_rate)],
      ['캘리퍼', spssNum(result.caliper, 4)], ['이웃 수', n0(result.n_neighbors)], ['복원 매칭', result.with_replacement == null ? '' : result.with_replacement ? '예' : '아니오'],
      ['평균 |SMD| (전)', spssNum(metrics.mean_abs_smd_before)], ['평균 |SMD| (후)', spssNum(metrics.mean_abs_smd_after)]]);
    return t ? statCard('매칭 요약 (처치: ' + A.esc(result.treatment_column || '') + ' = ' + A.esc(result.treated_label || '') + ')', t, []) : '';
  }
  function renderAtt(att, result) {
    if (!att || !has(att.att)) return '';
    return statCard('처치효과 (ATT: Average Treatment effect on the Treated)', tbl(['결과변수', 'ATT', '표준오차', 't', '유의확률', '95% CI 하한', '95% CI 상한', '매칭 쌍'],
      [[A.esc(result.outcome || '-'), '<b>' + spssNum(att.att, 3) + '</b>', spssNum(att.std_error), spssNum(att.t_statistic, 3), sigFmt(att.p_value), spssNum(att.ci_lower, 3), spssNum(att.ci_upper, 3), n0(att.n_pairs)]]),
      ['매칭된 처치군과 대조군 쌍의 평균 결과 차이', SIG_NOTE]);
  }
  function renderBalance(cb) {
    var rows = cb && cb.covariates;
    if (!rows || !rows.length) return '';
    return statCard('공변량 균형 진단 (Covariate Balance)', tbl(['공변량', 'SMD (매칭 전)', 'SMD (매칭 후)', '균형'], rows.map(function (r) {
      return [A.esc(r.covariate), spssNum(r.smd_before), '<b>' + spssNum(r.smd_after) + '</b>', yes(r.balanced, '양호', '불균형')];
    })), ['|SMD| &lt; 0.1 이면 균형이 양호한 것으로 판단합니다.', '평균 |SMD|: 매칭 전 ' + spssNum(cb.mean_abs_smd_before) + ' → 매칭 후 ' + spssNum(cb.mean_abs_smd_after)], true);
  }
  function renderPropensityModel(pm, result) {
    if (!pm || !pm.coefficients || !pm.coefficients.length) return '';
    return statCard('성향점수 모형 (로지스틱, 종속변수: ' + A.esc(result.treatment_column || '처치') + ')', tbl(['변수', 'B', '유의확률', '95% CI 하한', '95% CI 상한'], pm.coefficients.map(function (r) {
      return [A.esc(r.source_variable || r.term), spssNum(r.coefficient), sigFmt(r.p_value), spssNum(r.ci_lower), spssNum(r.ci_upper)];
    })), ['유사 R² (McFadden) = ' + spssNum(pm.pseudo_r_squared), SIG_NOTE]);
  }

  /** 기법별 결과표 구성. 알려진 기법은 지표정리표에 있는 항목만 표시하고, 모르는 기법만 범용 렌더링으로 폴백 */
  function renderResultTab() {
    var r = res, result = r.result || {}, metrics = r.metrics || {}, cd = r.chart_data || {};
    var target = (r.params && r.params.target) || result.target || '-';
    var features = (r.params && r.params.features) || result.features || [];
    var nObs = result.n_observations || metrics.n_samples;
    var diag = result.diagnostics || {};
    pendingTrees = [];
    var m = r.method, cards;
    switch (m) {
      case 'linear_regression':
        cards = [renderModelSummary(metrics, result.anova, target, features), renderAnova(result.anova, metrics, nObs, target, features), renderCoefficients(result.coefficients, diag.vif, target),
          renderLinearFit(metrics), renderLinearDiagnostics(metrics, diag)];
        break;
      case 'logistic_regression':
        cards = [renderLogisticFit(metrics), renderLogisticCoefficients(result.coefficients, target, result.binary ? ((r.params && r.params.positive_label) || (result.classes && result.classes[result.classes.length - 1])) : null),
          renderMultinomialCoefficients(result.coefficients, target), renderConfusionMatrix(result.confusion_matrix)];
        break;
      case 'decision_tree_regressor':
      case 'decision_tree_classifier':
        cards = [renderTreeStructure(metrics, result), renderImportance(result.feature_importance), renderConfusionMatrix(result.confusion_matrix), renderTreeCards(result.tree)];
        break;
      case 'kmeans':
      case 'hierarchical':
      case 'dbscan':
        cards = [renderClusterQuality(metrics, result), renderElbow(result.elbow, result.n_clusters), renderClusterProfiles(result.cluster_profiles), renderClusterAnova(result.anova)];
        break;
      case 'pca':
        cards = [renderPcaVariance(result.components), renderPcaLoadings(result.components)];   // 요약 지표는 상단 카드
        break;
      case 'correlation':
        cards = [renderCorrelationMatrix(result), renderCorrelationPairs(result)];
        break;
      case 'anova':
        cards = [renderAnovaTable(result, metrics), renderAssumptions(result.assumption_checks), renderGroupStats(result.group_means, cd.group_boxplots), renderPostHoc(result.post_hoc)];
        if (result.note) cards.push('<div class="text-[11px] text-slate-500 px-1">※ ' + A.esc(result.note) + '</div>');
        break;
      case 'multilevel':
        cards = [renderMultilevelInfo(metrics, result), renderFixedEffects(result.fixed_effects, target), renderVarianceComponents(result, metrics), renderRandomEffects(result.random_effects_preview || cd.random_effects)];
        break;
      case 'growth_curve':
        cards = [renderMultilevelInfo(metrics, result), renderFixedEffects(result.fixed_effects, target, '고정효과 (평균 성장 궤적)'), renderVarianceComponents(result, metrics)];
        break;
      case 'psm':
        cards = [renderPsmSummary(result, metrics), renderAtt(result.att, result), renderBalance(result.covariate_balance), renderPropensityModel(result.propensity_model, result)];
        if (result.note) cards.push('<div class="text-[11px] text-slate-500 px-1">※ ' + A.esc(result.note) + '</div>');
        break;
    }
    var html;
    if (cards) {
      html = cards.filter(Boolean).join('');
    } else {
      // 알 수 없는 기법: 기존 범용 렌더링
      var special = [renderModelSummary(metrics, result.anova, target, features), renderAnova(result.anova, metrics, nObs, target, features), renderCoefficients(result.coefficients, diag.vif, target), renderConfusionMatrix(result.confusion_matrix)].filter(Boolean);
      var SPECIAL = ['anova', 'coefficients', 'confusion_matrix', 'preprocessing_steps', 'equation', 'target', 'features', 'method', 'diagnostics'];
      var rest = {};
      Object.keys(result).forEach(function (k) { if (SPECIAL.indexOf(k) < 0) rest[k] = result[k]; });
      html = special.join('') + buildSections(rest).map(sectionCard).join('');
    }
    A.$('#rp-result').innerHTML = html || '<div class="card-modern p-8 text-center text-xs text-slate-400">표시할 결과가 없습니다.</div>';
    if (window.Highcharts) pendingTrees.forEach(function (t) { drawTree(t.id, t.node); });
  }

  /* ---------------- 표본별 원시데이터 및 잔차 ---------------- */
  function residualColumns(r) {
    // result 안에서 데이터셋 행수와 길이가 같은 배열(잔차·예측값 등)을 찾아 원시데이터 옆에 덧붙인다
    var out = {};
    Object.keys(r.result || {}).forEach(function (k) {
      var v = r.result[k];
      if (Array.isArray(v) && v.length === raw.total && v.every(function (x) { return x === null || typeof x !== 'object'; })) out[k] = v;
    });
    // 실제 API 는 잔차·예측값을 chart_data.predictions = [{actual,predicted,residual}] 형태로 준다 (길이가 일치할 때만 매칭)
    var preds = r.chart_data && r.chart_data.predictions;
    if (Array.isArray(preds) && preds.length === raw.total) {
      out.predicted = preds.map(function (p) { return p.predicted; });
      out.residual = preds.map(function (p) { return p.residual; });
    }
    return out;
  }

  function loadRawData() {
    if (raw.loaded || !A.state.datasetId) { renderRawData(); return; }
    A.get('/api/v1/datasets/' + encodeURIComponent(A.state.datasetId) + '/preview' + A.qs({ limit: 200, offset: 0 })).then(function (p) {
      raw.loaded = true;
      raw.rows = p.rows || []; raw.cols = p.columns || []; raw.total = p.total_rows || raw.rows.length;
      var extra = residualColumns(res);
      var extraKeys = Object.keys(extra);
      if (extraKeys.length) {
        raw.rows = raw.rows.map(function (row, i) {
          var m = Object.assign({}, row);
          extraKeys.forEach(function (k) { m[A.viz.label(k)] = extra[k][i]; });
          return m;
        });
        raw.cols = raw.cols.concat(extraKeys.map(A.viz.label));
      }
      applyTab();
      renderRawData();
    }).catch(function () { /* 원시데이터는 참고용이라 실패해도 조용히 무시 */ });
  }

  function renderRawData() {
    var el = A.$('#rp-rawdata');
    if (!raw.loaded) { el.innerHTML = '<div class="py-8 text-center text-xs text-slate-400">원시데이터를 불러오는 중...</div>'; return; }
    var q = raw.q.toLowerCase();
    var rows = !q ? raw.rows : raw.rows.filter(function (row) { return raw.cols.some(function (c) { var v = row[c]; return v !== null && v !== undefined && String(v).toLowerCase().indexOf(q) >= 0; }); });
    el.innerHTML = '<div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100"><div class="flex items-center gap-2">' + A.icon('file-spreadsheet', 'w-4 h-4 text-blue-600') +
      '<h4 class="text-xs font-bold text-slate-900">표본별 원시데이터 및 잔차</h4><span class="text-[10px] text-slate-400 font-mono">(' + A.num(rows.length) + ' / ' + A.num(raw.total) + '행, 상위 ' + A.num(raw.rows.length) + '건 조회)</span></div>' +
      '<input type="text" id="raw-search" value="' + A.esc(raw.q) + '" placeholder="검색..." class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"></div>' +
      A.viz.table(rows, 200);
    var inp = A.$('#raw-search');
    inp.addEventListener('input', function () { raw.q = this.value; renderRawData(); A.$('#rp-tabs') && (A.$('#rp-tabs').innerHTML = tabsHtml()); });
    var pos = inp.value.length; inp.focus(); inp.setSelectionRange(pos, pos);
  }

  function build() {
    var r = res;
    A.$('#rp-method').textContent = r.method;
    A.$('#rp-title').textContent = r.name;
    A.$('#btn-save').classList.remove('hidden'); A.$('#btn-save').classList.add('flex');
    var failed = r.status === 'failed';
    A.$('#rp-diag').innerHTML = '<div class="flex items-center gap-2 pb-2 border-b border-slate-100">' + A.icon(failed ? 'alert-triangle' : 'file-text', 'w-4 h-4 ' + (failed ? 'text-rose-600' : 'text-blue-600')) + '<h4 class="text-xs font-bold text-slate-900">분석 결과 요약</h4>' +
      '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ' + (failed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200') + '">' + A.esc(r.status) + '</span></div>' +
      (r.error ? '<div class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 font-mono whitespace-pre-wrap">' + A.esc(r.error) + '</div>' : '') +
      (renderSummaryCards(r.metrics || {}, r.result || {}) || A.viz.metricsGrid(r.metrics, 24) || '<div class="text-xs text-slate-400">표시할 스칼라 지표가 없습니다. \'표준 통계 결과표\' 탭을 확인하세요.</div>');
    renderResultTab();
    A.charts.gallery(A.$('#rp-charts'), r);
    applyTab();
    loadRawData();
  }

  function showEmpty() {
    A.$('#rp-body').classList.add('hidden');
    A.$('#rp-empty').classList.remove('hidden');
    A.$('#rp-title').textContent = '분석 결과 없음';
    A.icons();
  }

  document.addEventListener('DOMContentLoaded', function () {
    A.$('#rp-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      tab = b.getAttribute('data-tab');
      applyTab();
    });
    A.$('#btn-save').addEventListener('click', function () {
      if (!res) return;
      var b = this;
      b.disabled = true;
      A.post('/api/v1/packages', { name: res.name, description: res.method + ' 분석 결과 패키지', analysis_ids: [res.id] }).then(function (p) {
        b.innerHTML = A.icon('check', 'w-3.5 h-3.5') + '<span>저장 완료</span>';
        A.icons();
        A.toast('분석 패키지가 저장되었습니다. (' + p.id + ')');
        setTimeout(function () { b.disabled = false; b.innerHTML = A.icon('save', 'w-3.5 h-3.5') + '<span>결과 패키지 저장</span>'; A.icons(); }, 2500);
      }).catch(function (e) { b.disabled = false; A.toast(e.message, 'error'); });
    });

    var id = (location.search.match(/[?&]id=([^&]+)/) || [])[1] || A.state.analysisId;
    if (!id) { showEmpty(); return; }
    A.get('/api/v1/analyses/' + encodeURIComponent(decodeURIComponent(id))).then(function (r) {
      res = r;
      A.saveState({ analysisId: r.id });
      A.$('#rp-body').classList.remove('hidden');
      build();
    }).catch(function (e) { showEmpty(); A.toast(e.message, 'error'); });
  });
})();
