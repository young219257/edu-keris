/* 1단계: 데이터 준비 및 반입 — /api/v1/datasets, /api/v1/data-cards */
(function () {
  'use strict';
  var A = window.App;

  var ROLES = [['numeric', '수치형 (Numeric)'], ['categorical', '범주형 (Categorical)'], ['boolean', '논리형 (Boolean)'], ['datetime', '일시형 (Datetime)'], ['text', '문자형 (Text)'], ['identifier', '식별자 (Identifier)'], ['constant', '상수 (Constant)']];
  var PAGE = 20;
  var ALLOWED = /\.(csv|tsv|txt|xlsx|xls|json|parquet)$/i;

  var current = null;                       // DatasetDetail (컬럼 포함)
  var datasets = [];                        // 세션에 반입된 데이터셋 (upload / merged)
  var cards = [];                           // 데이터관리카드 (DatasetRead)
  var uploadError = null, dragging = false, uploading = false;
  var preview = { dsId: null, rows: [], cols: [], total: 0, loading: false };

  /* ---------------- 데이터관리카드 ---------------- */
  function loadCards() {
    var q = A.$('#mgmt-search').value || '';
    return A.get('/api/v1/data-cards' + A.qs({ limit: 100, q: q })).then(function (p) {
      cards = p.items || [];
      A.$('#mgmt-total').textContent = '총 ' + A.num(p.total) + '건';
      renderCards();
    }).catch(function (e) { A.$('#mgmt-list').innerHTML = '<div class="p-4 text-xs text-rose-600">' + A.esc(e.message) + '</div>'; });
  }

  function renderCards() {
    var html = cards.map(function (c) {
      var sel = current && current.id === c.id;
      return '<div data-card="' + A.esc(c.id) + '" class="p-3 flex items-center justify-between transition-colors cursor-pointer select-none ' + (sel ? 'bg-blue-50/80 text-blue-950 font-semibold' : 'hover:bg-slate-50/80 text-slate-700') + '">' +
        '<div class="flex items-center gap-2.5 min-w-0 pr-2"><div class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ' + (sel ? 'border-blue-600 bg-blue-600' : 'border-slate-300') + '">' + (sel ? '<div class="w-1 h-1 rounded-full bg-white"></div>' : '') + '</div>' +
        '<span class="text-xs truncate" title="' + A.esc(c.name) + '">' + A.esc(c.name) + '</span></div>' +
        '<span class="text-[10px] font-mono text-slate-400 shrink-0">' + A.num(c.n_rows) + '행</span></div>';
    }).join('') || '<div class="p-4 text-xs text-slate-400 text-center">등록된 데이터관리카드가 없습니다. 우측 하단 \'카드 동기화\'로 불러올 수 있습니다.</div>';
    A.$('#mgmt-list').innerHTML = html;
    var isCard = current && current.source_type === 'data_card';
    A.$('#mgmt-status').innerHTML = '선택 상태: <strong class="' + (isCard ? 'text-blue-700' : 'text-slate-400') + '">' + (isCard ? A.esc(current.name) : '선택 안 됨 (선택 사항)') + '</strong>';
    A.$('#mgmt-release').classList.toggle('hidden', !isCard);
  }

  function syncCards() {
    var b = A.$('#mgmt-sync');
    b.disabled = true;
    b.textContent = '동기화 중...';
    A.post('/api/v1/data-cards/sync', {}).then(function (r) {
      A.toast('데이터관리카드 동기화 완료 (성공 ' + r.succeeded + ' / 실패 ' + r.failed + ')', r.failed ? 'error' : undefined);
      return loadCards();
    }).catch(function (e) { A.toast(e.message, 'error'); }).then(function () { b.disabled = false; b.textContent = '카드 동기화'; });
  }

  /* ---------------- 반입 데이터셋 목록 ---------------- */
  function loadDatasets() {
    return Promise.all([
      A.get('/api/v1/datasets' + A.qs({ limit: 100, source_type: 'upload' })),
      A.get('/api/v1/datasets' + A.qs({ limit: 100, source_type: 'merged' }))
    ]).then(function (r) {
      datasets = (r[0].items || []).concat(r[1].items || []);
      A.$('#ds-total').textContent = datasets.length + '건';
      renderDatasets();
    }).catch(function (e) { A.toast(e.message, 'error'); });
  }

  function renderDatasets() {
    A.$('#ds-list').innerHTML = datasets.map(function (d) {
      var sel = current && current.id === d.id;
      return '<div data-ds="' + A.esc(d.id) + '" class="p-3 flex items-center justify-between gap-2 cursor-pointer transition-colors ' + (sel ? 'bg-blue-50/80' : 'hover:bg-slate-50/80') + '">' +
        '<div class="min-w-0"><div class="text-xs font-bold text-slate-900 truncate">' + A.esc(d.name) + '</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">' + A.num(d.n_rows) + '행 · ' + d.n_cols + '변수 · ' + A.esc(d.source_format) + '</div></div>' +
        '<div class="flex items-center gap-2 shrink-0">' + (sel ? '<span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">분석 대상</span>' : '') +
        '<button type="button" data-del="' + A.esc(d.id) + '" class="p-1 text-slate-300 hover:text-rose-600 cursor-pointer" title="삭제">' + A.icon('trash-2', 'w-3.5 h-3.5') + '</button></div></div>';
    }).join('') || '<div class="p-4 text-xs text-slate-400 text-center">반입된 데이터셋이 없습니다. 파일을 업로드해 주세요.</div>';
    A.icons();
  }

  /* ---------------- 업로드 ---------------- */
  function renderUpload() {
    var html;
    if (uploading) {
      html = '<div class="border-2 border-dashed border-blue-300 bg-blue-50/40 p-8 rounded-2xl text-center text-xs text-blue-800 font-semibold flex items-center justify-center gap-2"><span class="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full spin inline-block"></span>파일을 분석하고 있습니다...</div>';
    } else {
      html = '<label id="dropzone" class="block border-2 border-dashed p-8 rounded-2xl transition-all cursor-pointer text-center ' + (dragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400 bg-slate-50/40 hover:bg-blue-50/20') + '">' +
        '<input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.parquet" class="hidden" id="file-input">' +
        '<div class="flex flex-col items-center justify-center space-y-2.5"><div class="w-10 h-10 rounded-2xl bg-white text-blue-600 flex items-center justify-center border border-slate-200 shadow-2xs">' + A.icon('upload', 'w-5 h-5') + '</div>' +
        '<div><div class="text-xs font-bold text-slate-800">클릭하여 파일 선택 또는 여기로 드래그 앤 드롭</div><div class="text-[11px] text-slate-400 mt-1" id="upload-limit">인코딩·구분자·변수 역할을 자동으로 판별합니다.</div></div></div>' +
        (uploadError ? '<div class="mt-3 text-xs font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">' + A.esc(uploadError) + '</div>' : '') + '</label>';
    }
    A.$('#upload-area').innerHTML = html;
    A.icons();
  }

  function handleFile(file) {
    if (!ALLOWED.test(file.name)) { uploadError = '지원하지 않는 파일 형식입니다. (CSV, TSV, XLSX, JSON 등)'; renderUpload(); return; }
    uploadError = null;
    uploading = true;
    renderUpload();
    var fd = new FormData();
    fd.append('file', file);
    A.api('POST', '/api/v1/datasets/upload', fd).then(function (d) {
      uploading = false;
      A.toast('반입 및 변수 자동 인식이 완료되었습니다.');
      return loadDatasets().then(function () { return select(d.id); });
    }).catch(function (e) { uploading = false; uploadError = e.message; renderUpload(); });
  }

  /* ---------------- 데이터셋 선택 ---------------- */
  function select(id) {
    return A.get('/api/v1/datasets/' + encodeURIComponent(id)).then(function (d) {
      current = d;
      A.saveState({ datasetId: d.id, datasetName: d.name, datasetRows: d.n_rows, analysisId: null });
      preview = { dsId: null, rows: [], cols: [], total: d.n_rows, loading: false };
      renderAll();
    }).catch(function (e) { A.toast(e.message, 'error'); });
  }

  /* ---------------- 변수 정의 테이블 ---------------- */
  function renderColumns() {
    var body = A.$('#col-body');
    if (!current) { body.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">데이터셋을 선택해 주세요.</td></tr>'; return; }
    var q = (A.$('#col-search').value || '').toLowerCase();
    var cols = current.columns || [];
    A.$('#col-title').textContent = '변수 속성 및 데이터 타입 정의 (' + cols.length + '개 변수)';
    A.$('#col-dsname').textContent = current.name;
    body.innerHTML = cols.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).map(function (c) {
      return '<tr class="hover:bg-slate-50/70 transition-colors"><td class="py-2 px-4 font-mono font-semibold text-slate-800">' + A.esc(c.name) + '</td><td class="py-2 px-4 text-slate-500 font-mono">' + A.esc(c.dtype) + '</td>' +
        '<td class="py-2 px-4 text-right font-mono ' + (c.n_missing > 0 ? 'text-amber-600 font-bold' : 'text-slate-400') + '">' + A.num(c.n_missing) + '</td><td class="py-2 px-4 text-right font-mono text-slate-500">' + A.num(c.n_unique) + '</td>' +
        '<td class="py-2 px-4"><select data-col="' + A.esc(c.name) + '" class="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer">' +
        ROLES.map(function (o) { return '<option value="' + o[0] + '"' + (c.role === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td></tr>';
    }).join('');
  }

  /* ---------------- 미리보기 ---------------- */
  function loadPreview() {
    if (!current || preview.loading) return;
    if (preview.dsId !== current.id) preview = { dsId: current.id, rows: [], cols: [], total: current.n_rows, loading: false };
    if (preview.rows.length >= preview.total && preview.rows.length > 0) { renderPreview(); return; }
    preview.loading = true;
    var more = A.$('#preview-more');
    more.classList.remove('hidden'); more.classList.add('flex');
    var id = current.id;
    A.get('/api/v1/datasets/' + encodeURIComponent(id) + '/preview' + A.qs({ limit: PAGE, offset: preview.rows.length })).then(function (r) {
      if (!current || current.id !== id) return;
      preview.rows = preview.rows.concat(r.rows || []);
      preview.cols = r.columns || preview.cols;
      preview.total = r.total_rows;
      preview.loading = false;
      more.classList.add('hidden'); more.classList.remove('flex');
      renderPreview();
    }).catch(function (e) { preview.loading = false; more.classList.add('hidden'); more.classList.remove('flex'); A.toast(e.message, 'error'); });
  }

  function renderPreview() {
    if (!current) return;
    A.$('#preview-name').textContent = current.name;
    A.$('#preview-count').textContent = '(' + preview.rows.length + ' / ' + A.num(preview.total) + ' 행 표출)';
    var cols = preview.cols;
    A.$('#preview-head').innerHTML = '<tr class="text-slate-600 text-[11px] font-semibold"><th class="py-2 px-3 text-slate-400 w-10 text-center font-mono">#</th>' +
      cols.map(function (c) { return '<th class="py-2 px-3 text-slate-800 whitespace-nowrap">' + A.esc(c) + '</th>'; }).join('') + '</tr>';
    A.$('#preview-body').innerHTML = preview.rows.map(function (r, i) {
      return '<tr class="hover:bg-slate-50/70 transition-colors"><td class="py-1.5 px-3 text-slate-400 text-center">' + (i + 1) + '</td>' +
        cols.map(function (c) {
          var v = r[c];
          return '<td class="py-1.5 px-3 truncate max-w-[160px] whitespace-nowrap ' + (v === null || v === undefined ? 'text-rose-300' : 'text-slate-700') + '">' + (v === null || v === undefined ? '결측' : A.esc(v)) + '</td>';
        }).join('') + '</tr>';
    }).join('');
  }

  function renderAll() {
    A.$('#s1-current-name').textContent = current ? current.name : '선택 안 됨';
    A.$('#s1-target-name').textContent = current ? current.name + ' (' + A.num(current.n_rows) + '행)' : '없음';
    A.$('#btn-proceed').disabled = !current;
    renderCards();
    renderDatasets();
    renderColumns();
    if (current) loadPreview();
    A.icons();
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    A.$('#mgmt-search').addEventListener('input', A.debounce(loadCards, 300));
    A.$('#col-search').addEventListener('input', renderColumns);
    A.$('#mgmt-list').addEventListener('click', function (e) {
      var c = e.target.closest('[data-card]');
      if (c) select(c.getAttribute('data-card'));
    });
    A.$('#mgmt-sync').addEventListener('click', syncCards);
    A.$('#mgmt-release').addEventListener('click', function () {
      current = null;
      A.saveState({ datasetId: null, datasetName: null });
      renderAll();
    });

    var ua = A.$('#upload-area');
    ua.addEventListener('change', function (e) {
      if (e.target.id === 'file-input' && e.target.files.length) handleFile(e.target.files[0]);
    });
    ua.addEventListener('dragover', function (e) { if (e.target.closest('#dropzone')) { e.preventDefault(); if (!dragging) { dragging = true; renderUpload(); } } });
    ua.addEventListener('dragleave', function (e) { if (e.target.closest('#dropzone') && dragging) { dragging = false; renderUpload(); } });
    ua.addEventListener('drop', function (e) {
      if (!e.target.closest('#dropzone')) return;
      e.preventDefault();
      dragging = false;
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    A.$('#ds-list').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        var id = del.getAttribute('data-del');
        if (!window.confirm('이 데이터셋과 관련 분석 결과를 삭제할까요?')) return;
        A.del('/api/v1/datasets/' + encodeURIComponent(id)).then(function () {
          if (current && current.id === id) { current = null; A.saveState({ datasetId: null, datasetName: null }); }
          A.toast('데이터셋이 삭제되었습니다.');
          return loadDatasets().then(renderAll);
        }).catch(function (err) { A.toast(err.message, 'error'); });
        return;
      }
      var c = e.target.closest('[data-ds]');
      if (c) select(c.getAttribute('data-ds'));
    });

    A.$('#col-body').addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-col]');
      if (!sel || !current) return;
      A.patch('/api/v1/datasets/' + encodeURIComponent(current.id) + '/columns/types', { columns: [{ name: sel.getAttribute('data-col'), role: sel.value }] }).then(function (d) {
        current = d;
        renderColumns();
        A.toast('변수 타입이 변경되었습니다.');
      }).catch(function (err) { A.toast(err.message, 'error'); renderColumns(); });
    });

    A.$('#preview-scroll').addEventListener('scroll', function () {
      var el = this;
      if (el.scrollHeight - el.scrollTop <= el.clientHeight + 50 && preview.rows.length < preview.total) loadPreview();
    });

    A.$('#btn-proceed').addEventListener('click', function () {
      if (!current) { A.toast('분석할 데이터셋을 선택해 주세요.', 'error'); return; }
      location.href = A.ctx + '/analysis/step2';
    });

    renderUpload();
    renderColumns();
    A.get('/api/v1/datasets/meta/limits').then(function (l) {
      var el = A.$('#upload-limit');
      if (el && l) el.textContent = '인코딩·구분자·변수 역할 자동 판별 · ' + Object.keys(l).map(function (k) { return k + ': ' + l[k]; }).join(' · ');
    }).catch(function () { /* ignore */ });

    // 초기 로딩: 카드/데이터셋 목록 + 이전에 선택한 데이터셋 복원
    Promise.all([loadCards(), loadDatasets()]).then(function () {
      if (A.state.datasetId) return select(A.state.datasetId).then(function () { if (!current) A.saveState({ datasetId: null }); });
    }).then(renderAll);
    A.icons();
  });
})();
