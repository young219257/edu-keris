/* 5단계: 결과 관리 및 패키징 — /api/v1/packages (생성·조회·재현·공유·삭제) */
(function () {
  'use strict';
  var A = window.App;
  var items = [], selected = null, detail = null, repro = null, busy = null;

  function notice(msg) {
    A.$('#pk-notice-msg').textContent = msg;
    var n = A.$('#pk-notice');
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
        '<div class="text-[10px] text-slate-400 font-mono truncate">' + A.esc(it.id) + ' · 분석 ' + (it.analysis_ids || []).length + '건</div></div>' +
        (it.share_token ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">공유 중</span>' : '') + '</div>' +
        '<div class="text-[10px] text-slate-400 mt-1.5">' + A.date(it.created_at) + '</div></div>';
    }).join('') : '<div class="text-center py-10 text-slate-400 text-xs">저장된 분석 패키지가 없습니다.</div>';
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
      '<div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono"><span>' + A.esc(s.id) + '</span><span>•</span><span>' + A.date(s.created_at) + '</span><span>•</span><span>데이터셋 ' + A.esc(s.dataset_id || '-') + '</span></div></div>' +
      '<button type="button" data-act="reproduce" ' + (busy ? 'disabled' : '') + ' class="px-3.5 py-2 bg-[#003876] hover:bg-[#002855] disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0">' + A.icon('rotate-ccw', 'w-3.5 h-3.5') + '<span>' + (busy === 'reproduce' ? '재현 실행 중...' : '이 조건으로 재현 실행') + '</span></button></div>';

    var reproBox = '';
    if (repro && repro.package_id === s.id) {
      reproBox = '<div class="p-3.5 rounded-xl border ' + (repro.matched ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200') + ' space-y-2"><div class="text-xs font-bold ' + (repro.matched ? 'text-emerald-800' : 'text-amber-800') + '">' +
        (repro.matched ? '✔ 재현 결과가 원본과 일치합니다.' : '⚠ 재현 결과가 원본과 일치하지 않는 항목이 있습니다.') + '</div>' +
        '<div class="text-[11px] text-slate-600 font-mono">재현 데이터셋 ' + A.esc(repro.dataset_id) + ' · 분석 ' + (repro.analysis_ids || []).map(A.esc).join(', ') + '</div>' +
        (repro.comparisons && repro.comparisons.length ? A.viz.table(repro.comparisons) : '') + '</div>';
    }

    var manifest = '<div class="space-y-2"><div class="text-xs font-bold text-slate-800 flex items-center gap-1.5">' + A.icon('folder-archive', 'w-3.5 h-3.5 text-blue-700') + '패키지 매니페스트 (분석 조건 · 전처리 로직 · 결과 지표)</div><div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-[380px] overflow-y-auto">' + A.viz.tree(s.manifest || {}, 0) + '</div></div>';

    var share = '<div class="pt-4 border-t border-slate-200 space-y-2.5"><div class="flex items-center justify-between"><span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">' + A.icon('share-2', 'w-3.5 h-3.5 text-blue-700') + '공유 및 내보내기</span></div>' +
      (shareUrl ? '<div class="flex items-center gap-2"><input readonly value="' + A.esc(shareUrl) + '" class="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-700"><button type="button" data-act="copy" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer">복사</button></div>' +
        '<div class="text-[10px] text-slate-500">공유 링크는 세션이 종료되어도 7일간 유지됩니다. 링크로는 읽기 전용 조회만 가능합니다.</div>' : '') +
      '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">' +
      '<button type="button" data-act="pdf" class="p-3 bg-red-50/80 hover:bg-red-100/90 text-red-800 border border-red-200 rounded-xl text-xs font-bold cursor-pointer text-left"><span class="block">PDF 보고서</span><span class="block text-[10px] font-normal opacity-80 mt-0.5">' + (busy === 'pdf' ? '생성 중...' : '종합 요약 · 지표 · 결과표') + '</span></button>' +
      '<button type="button" data-act="excel" class="p-3 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer text-left"><span class="block">Excel 통계표</span><span class="block text-[10px] font-normal opacity-80 mt-0.5">' + (busy === 'excel' ? '생성 중...' : '다중 시트 결과표') + '</span></button>' +
      (s.share_token ? '<button type="button" data-act="unshare" class="p-3 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold cursor-pointer">공유 해제</button>' : '<button type="button" data-act="share" class="p-3 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer">공유 링크 발급</button>') +
      '<button type="button" data-act="json" class="p-3 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold cursor-pointer">매니페스트 JSON 저장</button>' +
      '<button type="button" data-act="delete" class="p-3 bg-rose-50/80 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer">패키지 삭제</button></div></div>';

    box.innerHTML = head + reproBox + manifest + share;
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

  document.addEventListener('DOMContentLoaded', function () {
    A.$('#pk-list').addEventListener('click', function (e) {
      var c = e.target.closest('[data-id]');
      if (c) { repro = null; select(c.getAttribute('data-id')); }
    });
    A.$('#pk-detail').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || !selected) return;
      var act = b.getAttribute('data-act'), id = selected.id, p = '/api/v1/packages/' + encodeURIComponent(id);
      if (act === 'reproduce') {
        busy = 'reproduce'; renderDetail();
        A.post(p + '/reproduce', {}).then(function (r) { repro = r; notice(r.matched ? '재현 결과가 원본과 일치합니다.' : '재현을 완료했습니다. 일부 결과가 원본과 다릅니다.'); })
          .catch(function (err) { A.toast(err.message, 'error'); }).then(function () { busy = null; renderDetail(); });
      } else if ((act === 'pdf' || act === 'excel') && !busy) {
        busy = act; renderDetail();
        A.downloadFile('GET', '/export/package/' + encodeURIComponent(id) + '/' + act, null, 'package_' + id + (act === 'pdf' ? '.pdf' : '.xlsx'))
          .then(function (name) { notice("'" + name + "' 파일이 다운로드되었습니다."); })
          .catch(function (err) { A.toast(err.message, 'error'); }).then(function () { busy = null; renderDetail(); });
      } else if (act === 'share') {
        A.post(p + '/share', {}).then(function () { return A.get(p); }).then(function (d) { refreshSelected(d); notice('공유 링크가 발급되었습니다.'); }).catch(function (err) { A.toast(err.message, 'error'); });
      } else if (act === 'unshare') {
        A.del(p + '/share').then(function () { return A.get(p); }).then(function (d) { refreshSelected(d); notice('공유가 해제되었습니다.'); }).catch(function (err) { A.toast(err.message, 'error'); });
      } else if (act === 'copy') {
        var inp = A.$('#pk-detail input[readonly]');
        var done = function () { A.toast('공유 링크가 복사되었습니다.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, done); else { inp.select(); document.execCommand('copy'); done(); }
      } else if (act === 'json') {
        A.saveText('package_' + id + '.json', JSON.stringify(detail || selected, null, 2));
      } else if (act === 'delete') {
        if (!window.confirm("'" + selected.name + "' 패키지를 삭제할까요?")) return;
        A.del(p).then(function () { selected = null; detail = null; repro = null; notice('패키지가 삭제되었습니다.'); return loadPackages(); }).then(renderDetail).catch(function (err) { A.toast(err.message, 'error'); });
      }
    });

    loadPackages().then(function () {
      if (items.length) select(items[0].id); else renderDetail();
    });
    A.icons();
  });
})();
