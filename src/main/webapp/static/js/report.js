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

  /** result 를 구조별(행 배열→표, 스칼라 객체→카드, 그 외→트리)로 나눠 제목 있는 카드로 만든다 */
  function buildSections(obj) {
    var sections = [], scalarKeys = [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (A.viz.isPrim(v)) { scalarKeys.push(k); return; }
      if (isRowArray(v)) { sections.push({ title: A.viz.label(k), icon: 'table-2', body: A.viz.table(v) }); return; }
      if (isPlainObj(v) && Object.keys(v).length) { sections.push({ title: A.viz.label(k), icon: 'list-tree', body: A.viz.metricsGrid(v, 20) || A.viz.tree(v, 0) }); return; }
      sections.push({ title: A.viz.label(k), icon: 'braces', body: A.viz.tree(v, 0) });
    });
    if (scalarKeys.length) {
      var sub = {}; scalarKeys.forEach(function (k) { sub[k] = obj[k]; });
      sections.unshift({ title: '추가 지표', icon: 'hash', body: A.viz.metricsGrid(sub, 20) });
    }
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
  function statCard(titleHtml, tableHtml, footnotes) {
    return '<div class="card-modern p-5 space-y-3"><div class="flex items-center gap-2 pb-2 border-b border-slate-100"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span><h4 class="text-xs font-bold text-slate-900">' + titleHtml + '</h4></div>' +
      '<div class="overflow-x-auto border border-slate-200 rounded-lg">' + tableHtml + '</div>' +
      '<div class="text-[10px] text-slate-500 space-y-0.5 pt-1">' + footnotes.map(function (f) { return '<div>' + f + '</div>'; }).join('') + '</div></div>';
  }
  var TH = 'p-2.5 border border-slate-200 bg-slate-50 font-semibold text-slate-700 align-middle';
  var SUB_TH = 'p-1.5 border border-slate-200 bg-slate-50 font-semibold text-slate-600 text-[10px] align-middle';
  var TD = 'p-2.5 border border-slate-200';

  function renderModelSummary(ms, targetLabel, featureLabels) {
    if (!ms) return '';
    var predictorsFootnote = 'a. 예측값: (상수)' + (featureLabels.length ? ', ' + featureLabels.map(A.esc).join(', ') : '');
    var targetFootnote = 'b. 종속변수: ' + A.esc(targetLabel);
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' +
      '<tr><th rowspan="2" class="' + TH + '">모형</th><th rowspan="2" class="' + TH + '">R</th><th rowspan="2" class="' + TH + '">R 제곱</th><th rowspan="2" class="' + TH + '">수정된 R 제곱</th><th rowspan="2" class="' + TH + '">추정값의 표준오차</th><th colspan="4" class="' + TH + ' border-l border-slate-200">변화량 통계량</th><th rowspan="2" class="' + TH + '">Durbin-Watson</th></tr>' +
      '<tr><th class="' + SUB_TH + ' border-l border-slate-200">R 제곱 변화량</th><th class="' + SUB_TH + '">F 변화량</th><th class="' + SUB_TH + '">df1</th><th class="' + SUB_TH + '">df2</th></tr>' +
      '</thead><tbody class="font-mono"><tr class="hover:bg-slate-50/50">' +
      '<td class="' + TD + ' font-sans font-semibold">1</td>' +
      '<td class="' + TD + '">' + spssNum(ms.r) + '<sup class="text-blue-600">a</sup></td>' +
      '<td class="' + TD + ' font-bold">' + spssNum(ms.r2) + '</td>' +
      '<td class="' + TD + '">' + spssNum(ms.adj_r2) + '</td>' +
      '<td class="' + TD + '">' + spssNum(ms.se) + '</td>' +
      '<td class="' + TD + ' border-l border-slate-100">' + spssNum(ms.r2_change) + '</td>' +
      '<td class="' + TD + '">' + spssNum(ms.f_change) + '</td>' +
      '<td class="' + TD + '">' + (ms.df1 != null ? A.esc(ms.df1) : '') + '</td>' +
      '<td class="' + TD + '">' + (ms.df2 != null ? A.esc(ms.df2) : '') + '</td>' +
      '<td class="' + TD + '">' + spssNum(ms.durbin_watson) + '</td></tr></tbody></table>';
    return statCard('모형 요약 (Model Summary) <sup class="text-blue-600">b</sup>', table, [predictorsFootnote, targetFootnote]);
  }

  function renderAnova(anova, targetLabel, featureLabels) {
    if (!anova || !anova.rows || !anova.rows.length) return '';
    var rows = anova.rows;
    var body = rows.map(function (row, i) {
      return '<tr class="hover:bg-slate-50/50">' + (i === 0 ? '<td class="' + TD + ' font-sans font-semibold" rowspan="' + rows.length + '">1</td>' : '') +
        '<td class="' + TD + ' text-left font-sans ' + (row.source && row.source.indexOf('총계') >= 0 ? 'font-bold' : '') + '">' + A.esc(row.source) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.ss) + '</td>' +
        '<td class="' + TD + '">' + (row.df != null ? A.esc(row.df) : '') + '</td>' +
        '<td class="' + TD + '">' + (row.ms != null ? spssNum(row.ms) : '') + '</td>' +
        '<td class="' + TD + ' font-bold">' + (row.f != null ? spssNum(row.f) : '') + '</td>' +
        '<td class="' + TD + '">' + (row.sig != null ? sigFmt(row.sig) + '<sup class="text-blue-600">b</sup>' : '') + '</td></tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead><tr>' +
      '<th class="' + TH + '">모형</th><th class="' + TH + '">제곱합 (Sum of Squares)</th><th class="' + TH + '">자유도 (df)</th><th class="' + TH + '">평균제곱 (Mean Square)</th><th class="' + TH + '">F</th><th class="' + TH + '">유의확률 (Sig.)</th>' +
      '</tr></thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('ANOVA (분산분석) <sup class="text-blue-600">a</sup>', table, ['a. 종속변수: ' + A.esc(targetLabel), 'b. 예측값: (상수)' + (featureLabels.length ? ', ' + featureLabels.map(A.esc).join(', ') : '')]);
  }

  function renderCoefficients(co, targetLabel) {
    if (!co || !co.rows || !co.rows.length) return '';
    var rows = co.rows;
    var body = rows.map(function (row, i) {
      return '<tr class="hover:bg-slate-50/50">' + (i === 0 ? '<td class="' + TD + ' font-sans font-semibold align-middle" rowspan="' + rows.length + '">1</td>' : '') +
        '<td class="' + TD + ' text-left font-sans">' + A.esc(row.name) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + spssNum(row.b) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.se) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + (row.beta != null ? spssNum(row.beta) : '') + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100 font-bold">' + spssNum(row.t) + '</td>' +
        '<td class="' + TD + '">' + sigFmt(row.sig) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + spssNum(row.ci_lower) + '</td>' +
        '<td class="' + TD + '">' + spssNum(row.ci_upper) + '</td>' +
        '<td class="' + TD + ' border-l border-slate-100">' + (row.tolerance != null ? spssNum(row.tolerance) : '') + '</td>' +
        '<td class="' + TD + '">' + (row.vif != null ? spssNum(row.vif) : '') + '</td></tr>';
    }).join('');
    var table = '<table class="w-full text-center text-xs border-collapse"><thead>' +
      '<tr><th rowspan="2" class="' + TH + ' text-left">모형</th><th colspan="2" class="' + TH + ' border-l border-slate-200">비표준화 계수</th><th rowspan="2" class="' + TH + ' border-l border-slate-200">표준화 계수<br><span class="font-normal text-[10px]">베타 (Beta)</span></th><th rowspan="2" class="' + TH + ' border-l border-slate-200">t</th><th rowspan="2" class="' + TH + '">유의확률</th><th colspan="2" class="' + TH + ' border-l border-slate-200">95.0% 신뢰구간</th><th colspan="2" class="' + TH + ' border-l border-slate-200">공선성 통계량</th></tr>' +
      '<tr><th class="' + SUB_TH + ' border-l border-slate-200">B</th><th class="' + SUB_TH + '">표준오차</th><th class="' + SUB_TH + ' border-l border-slate-200">하한</th><th class="' + SUB_TH + '">상한</th><th class="' + SUB_TH + ' border-l border-slate-200">공차 (Tolerance)</th><th class="' + SUB_TH + '">VIF</th></tr>' +
      '</thead><tbody class="font-mono">' + body + '</tbody></table>';
    return statCard('계수 (Coefficients) <sup class="text-blue-600">a</sup>', table, ['a. 종속변수: ' + A.esc(targetLabel), '*. 유의확률 p &lt; .05, **. p &lt; .01, ***. p &lt; .001']);
  }

  function renderResultTab() {
    var r = res, result = r.result || {};
    var target = (r.params && r.params.target) || '-';
    var features = (r.params && r.params.features) || [];
    var SPECIAL = ['model_summary', 'anova', 'coefficients', 'predicted', 'residuals'];
    var special = [renderModelSummary(result.model_summary, target, features), renderAnova(result.anova, target, features), renderCoefficients(result.coefficients, target)].filter(Boolean);

    var rest = {};
    Object.keys(result).forEach(function (k) { if (SPECIAL.indexOf(k) < 0) rest[k] = result[k]; });
    var sections = buildSections(rest);
    A.$('#rp-result').innerHTML = special.join('') + sections.map(sectionCard).join('');
  }

  /* ---------------- 표본별 원시데이터 및 잔차 ---------------- */
  function residualColumns(r) {
    // result 안에서 데이터셋 행수와 길이가 같은 배열(잔차·예측값 등)을 찾아 원시데이터 옆에 덧붙인다
    var out = {};
    Object.keys(r.result || {}).forEach(function (k) {
      var v = r.result[k];
      if (Array.isArray(v) && v.length === raw.total && v.every(function (x) { return x === null || typeof x !== 'object'; })) out[k] = v;
    });
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
      (A.viz.metricsGrid(r.metrics, 24) || '<div class="text-xs text-slate-400">표시할 스칼라 지표가 없습니다. \'표준 통계 결과표\' 탭을 확인하세요.</div>');
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
