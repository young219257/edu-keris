/* 4-2단계: 분석 결과 상세 리포트 — GET /api/v1/analyses/{id}, POST /api/v1/packages */
(function () {
  'use strict';
  var A = window.App;
  var res = null, tab = 'charts';

  function tabsHtml() {
    var tabs = [['charts', 'bar-chart-3', '진단 시각화 차트', String((res.chart_recommendations || []).length)], ['result', 'table-2', '상세 결과표', ''], ['raw', 'file-json', '요청 조건 · 원본', '']];
    return tabs.map(function (t) {
      var on = tab === t[0];
      return '<button type="button" data-tab="' + t[0] + '" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ' + (on ? 'bg-white text-[#003876] shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50') + '">' + A.icon(t[1], 'w-3.5 h-3.5') + '<span>' + t[2] + '</span>' + (t[3] ? '<span class="px-1.5 rounded text-[10px] font-mono ' + (on ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/80 text-slate-600') + '">' + t[3] + '</span>' : '') + '</button>';
    }).join('');
  }

  function applyTab() {
    A.$('#rp-tabs').innerHTML = tabsHtml();
    A.$('#rp-charts').classList.toggle('hidden', tab !== 'charts');
    A.$('#rp-result').classList.toggle('hidden', tab !== 'result');
    A.$('#rp-raw').classList.toggle('hidden', tab !== 'raw');
    A.icons();
  }

  function build() {
    var r = res;
    A.$('#rp-method').textContent = r.method;
    A.$('#rp-title').textContent = r.name;
    A.$('#btn-save').classList.remove('hidden'); A.$('#btn-save').classList.add('flex');
    ['#btn-json', '#btn-pdf', '#btn-xlsx'].forEach(function (id) { A.$(id).classList.remove('hidden'); A.$(id).classList.add('flex'); });
    var failed = r.status === 'failed';
    A.$('#rp-diag').innerHTML = '<div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100"><div class="flex items-center gap-2">' + A.icon(failed ? 'alert-triangle' : 'file-text', 'w-4 h-4 ' + (failed ? 'text-rose-600' : 'text-blue-600')) + '<h4 class="text-xs font-bold text-slate-900">분석 결과 요약</h4>' +
      '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ' + (failed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200') + '">' + A.esc(r.status) + '</span></div>' +
      '<div class="text-[10px] text-slate-500 font-mono">' + A.esc(r.id) + ' · 데이터셋 ' + A.esc(r.dataset_id) + ' · ' + A.date(r.completed_at || r.created_at) + (r.duration_ms !== null && r.duration_ms !== undefined ? ' · ' + A.num(r.duration_ms) + 'ms' : '') + '</div></div>' +
      (r.error ? '<div class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 font-mono whitespace-pre-wrap">' + A.esc(r.error) + '</div>' : '') +
      (A.viz.metricsGrid(r.metrics, 24) || '<div class="text-xs text-slate-400">스칼라 지표가 없습니다. \'상세 결과표\' 탭을 확인하세요.</div>');
    A.charts.gallery(A.$('#rp-charts'), r);
    A.$('#rp-result').innerHTML = '<div class="flex items-center gap-2 pb-2 border-b border-slate-100">' + A.icon('table-2', 'w-4 h-4 text-blue-600') + '<h4 class="text-xs font-bold text-slate-900">상세 결과 (result · metrics)</h4></div>' +
      '<div class="space-y-3"><div><div class="text-[11px] font-bold text-slate-700 mb-1">metrics</div>' + A.viz.tree(r.metrics || {}, 0) + '</div><div><div class="text-[11px] font-bold text-slate-700 mb-1">result</div>' + A.viz.tree(r.result || {}, 0) + '</div></div>';
    A.$('#rp-raw').innerHTML = '<div class="flex items-center gap-2 pb-2 border-b border-slate-100">' + A.icon('file-json', 'w-4 h-4 text-blue-600') + '<h4 class="text-xs font-bold text-slate-900">요청 조건</h4></div>' +
      '<div class="space-y-3"><div><div class="text-[11px] font-bold text-slate-700 mb-1">params</div>' + A.viz.tree(r.params || {}, 0) + '</div><div><div class="text-[11px] font-bold text-slate-700 mb-1">preprocessing</div>' + A.viz.tree(r.preprocessing || {}, 0) + '</div></div>' +
      '<details class="text-[11px]"><summary class="cursor-pointer text-slate-500">전체 응답 JSON</summary><pre class="mt-1.5 p-3 bg-slate-900 text-slate-100 rounded-lg overflow-auto max-h-96 text-[10px]">' + A.esc(JSON.stringify(r, null, 2)) + '</pre></details>';
    applyTab();
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
    A.$('#btn-json').addEventListener('click', function () {
      if (res) A.saveText('analysis_' + res.id + '.json', JSON.stringify(res, null, 2));
    });
    function chartImages() {
      // 화면에 그려진 차트(canvas)를 PNG 로 캡처해 PDF 에 삽입
      return A.$$('#rp-charts canvas').map(function (cv) {
        var card = cv.closest('.rounded-xl'), h = card && card.querySelector('h5');
        try { return { title: h ? h.textContent : '', data: cv.toDataURL('image/png') }; } catch (e) { return null; }
      }).filter(Boolean);
    }
    function exportFile(btn, method, url, body, fallback) {
      var label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full spin inline-block"></span><span>생성 중...</span>';
      A.downloadFile(method, url, body, fallback).then(function (name) { A.toast("'" + name + "' 파일이 다운로드되었습니다."); })
        .catch(function (e) { A.toast(e.message, 'error'); })
        .then(function () { btn.disabled = false; btn.innerHTML = label; A.icons(); });
    }
    A.$('#btn-pdf').addEventListener('click', function () {
      if (res) exportFile(this, 'POST', '/export/analysis/' + encodeURIComponent(res.id) + '/pdf', { images: chartImages() }, 'analysis_' + res.id + '.pdf');
    });
    A.$('#btn-xlsx').addEventListener('click', function () {
      if (res) exportFile(this, 'GET', '/export/analysis/' + encodeURIComponent(res.id) + '/excel', null, 'analysis_' + res.id + '.xlsx');
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
