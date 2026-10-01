/* 교육데이터 이용자통계분석 서비스 - 공통 스크립트 (API 클라이언트 / 세션 토큰 / 헤더 / 모달 / 토스트) */
(function () {
  'use strict';

  var App = window.App = window.App || {};
  App.ctx = window.__CTX__ || '';

  /* ------------------------------------------------------------ 유틸 */
  App.esc = function (v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  App.num = function (v, d) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '-';
    return Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 2 : d });
  };
  App.fix = function (v, d) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '-';
    return Number(v).toFixed(d === undefined ? 2 : d);
  };
  App.pFmt = function (p) {
    if (p === null || p === undefined || isNaN(p)) return '-';
    return p < 0.001 ? '< 0.001' : Number(p).toFixed(4);
  };
  App.date = function (iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    function z(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  };
  App.icons = function () {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  };
  App.icon = function (name, cls) {
    return '<i data-lucide="' + name + '" class="' + (cls || 'w-4 h-4') + '"></i>';
  };
  App.$ = function (sel, root) { return (root || document).querySelector(sel); };
  App.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  App.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, c = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(c, a); }, ms);
    };
  };
  App.isNum = function (v) { return typeof v === 'number' && isFinite(v); };
  App.qs = function (obj) {
    var parts = [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v.forEach(function (x) { parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)); });
      else parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  };

  /* ------------------------------------------------------------ 브라우저 탭 상태 (sessionStorage) */
  var STATE_KEY = 'edu.state', TOKEN_KEY = 'edu.sessionToken';
  function readJson(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  App.state = readJson(STATE_KEY) || {};
  App.saveState = function (patch) {
    if (patch) Object.keys(patch).forEach(function (k) { App.state[k] = patch[k]; });
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(App.state)); } catch (e) { /* ignore */ }
    return App.state;
  };
  App.resetState = function () {
    App.state = {};
    try { sessionStorage.removeItem(STATE_KEY); } catch (e) { /* ignore */ }
  };

  /* ------------------------------------------------------------ 세션 토큰 (쿠키 저장) + API 클라이언트 */
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=' + (App.ctx || '/') + '; SameSite=Lax';
  }
  function readCookieJson(name) {
    try { return JSON.parse(getCookie(name) || 'null'); } catch (e) { return null; }
  }

  var session = readCookieJson(TOKEN_KEY);        // { token, header }
  var issuing = null;

  function errMsg(body, status) {
    var d = body && body.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map(function (x) { return (x.loc ? x.loc.slice(1).join('.') + ': ' : '') + (x.msg || ''); }).join(' / ');
    if (body && body.message) return body.message;
    return '요청 처리에 실패했습니다. (' + status + ')';
  }
  function stripHtml(s) {
    return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** POST /api/v1/sessions — 토큰 발급 (쿠키에 보관, 브라우저의 모든 탭이 공유) */
  App.ensureSession = function (force) {
    if (session && session.token && !force) return Promise.resolve(session);
    if (issuing) return issuing;
    issuing = fetch(App.ctx + '/api/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (j) {
          if (!res.ok || !j || !j.session_token) throw new Error(errMsg(j, res.status));
          session = { token: j.session_token, header: j.token_header || 'X-Session-Token' };
          try { setCookie(TOKEN_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
          if (force) App.resetState();
          return session;
        });
      })
      .then(function (s) { issuing = null; return s; }, function (e) { issuing = null; throw e; });
    return issuing;
  };

  function send(method, url, body, opts, retried) {
    return App.ensureSession().then(function (s) {
      var init = { method: method, headers: {}, credentials: 'same-origin' };
      init.headers[s.header] = s.token;
      if (body instanceof FormData) init.body = body;
      else if (body !== undefined && body !== null) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      return fetch(App.ctx + url, init).then(function (res) {
        if (res.status === 401 && !retried) {           // 세션 만료 → 재발급 후 1회 재시도 (이전 세션의 데이터는 삭제된 상태)
          return App.ensureSession(true).then(function () {
            App.toast('세션이 만료되어 새로 시작했습니다. 데이터를 다시 반입해 주세요.', 'error');
            return send(method, url, body, opts, true);
          });
        }
        if (opts.raw) return res;
        if (res.status === 204) return null;
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('json') >= 0) {
          return res.json().then(function (j) {
            if (!res.ok) { var e = new Error(errMsg(j, res.status)); e.status = res.status; throw e; }
            return j;
          });
        }
        if (!res.ok) {
          return res.text().then(function (t) {
            var clean = t ? stripHtml(t).slice(0, 300) : '';
            var e2 = new Error(clean || '요청 처리에 실패했습니다. (' + res.status + ')');
            e2.status = res.status;
            throw e2;
          }, function () {
            var e2 = new Error('요청 처리에 실패했습니다. (' + res.status + ')'); e2.status = res.status; throw e2;
          });
        }
        return res.text();
      });
    });
  }
  App.api = function (method, url, body, opts) { return send(method, url, body, opts || {}, false); };
  App.get = function (u) { return App.api('GET', u); };
  App.post = function (u, b) { return App.api('POST', u, b === undefined ? {} : b); };
  App.patch = function (u, b) { return App.api('PATCH', u, b === undefined ? {} : b); };
  App.del = function (u) { return App.api('DELETE', u); };

  /** 세션 유지: 5분마다 heartbeat (토큰이 있을 때만) */
  setInterval(function () {
    if (session && session.token) App.api('POST', '/api/v1/sessions/current/heartbeat', {}).catch(function () { /* ignore */ });
  }, 5 * 60 * 1000);

  /* ------------------------------------------------------------ 토스트 */
  var toastTimer;
  App.toast = function (msg, kind) {
    var t = document.getElementById('toast');
    if (!t) return;
    document.getElementById('toast-msg').textContent = msg;
    var ic = t.querySelector('svg, i');
    t.classList.remove('hidden');
    t.classList.add('flex');
    t.style.borderColor = kind === 'error' ? '#be123c' : '';
    if (ic) ic.style.color = kind === 'error' ? '#fb7185' : '#34d399';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); t.classList.remove('flex'); }, kind === 'error' ? 5000 : 3000);
  };
  App.toastFlash = function (msg) {
    try { sessionStorage.setItem('flashToast', msg); } catch (e) { /* ignore */ }
  };

  /* ------------------------------------------------------------ 모달 */
  App.openModal = function (id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
  };
  App.closeModal = function (id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
  };

  /* ------------------------------------------------------------ 파일 저장 (클라이언트 생성) */
  App.saveText = function (filename, text, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  /** 서버가 생성하는 파일(PDF/Excel) 다운로드: 세션 토큰 헤더가 필요하므로 fetch → Blob 으로 저장 */
  App.downloadFile = function (method, url, body, fallbackName) {
    return App.api(method, url, body, { raw: true }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (j) { throw new Error(errMsg(j, res.status)); });
      }
      var cd = res.headers.get('content-disposition') || '';
      var m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      var name = fallbackName;
      if (m) { try { name = decodeURIComponent(m[1]); } catch (e) { /* ignore */ } }
      return res.blob().then(function (b) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        return name;
      });
    });
  };

  /** 현재 분석 대상 데이터셋이 없으면 1단계로 안내 */
  // TEMP: 로컬 테스트를 위해 가드 비활성화. 테스트 끝나면 아래 원래 구현으로 되돌릴 것.
  App.requireDataset = function () {
    return true;
    /*
    if (App.state.datasetId) return true;
    App.toastFlash('먼저 1단계에서 분석할 데이터셋을 선택하거나 업로드해 주세요.');
    location.href = App.ctx + '/analysis/step1';
    return false;
    */
  };
  /** 데이터셋 조회 실패(404 등: 세션 만료로 삭제된 경우)를 공통 처리 */
  App.datasetGone = function (e) {
    if (e && (e.status === 404 || e.status === 401)) {
      App.saveState({ datasetId: null, datasetName: null });
      App.toastFlash('선택한 데이터셋을 찾을 수 없습니다. 다시 선택해 주세요.');
      location.href = App.ctx + '/analysis/step1';
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------ 헤더 메뉴 */
  var MENUS = [
    { id: 'intro', title: '플랫폼소개', items: ['포털 소개 및 비전', '법적 근거 및 정책', '이용 절차 안내', '공지사항 및 소식'] },
    { id: 'search', title: '데이터검색', items: ['통합 데이터 카탈로그', '교육통계 데이터셋', '학술연구 원천자료', '메타데이터 사전'] },
    { id: 'open', title: '데이터개방', items: ['공공데이터 개방목록', 'OpenAPI 연계 신청', '데이터 품질 인증', '개방데이터 요청'] },
    { id: 'utilization', title: '데이터활용', items: ['우수 분석사례 갤러리', '통계 시각화 대시보드', '가명결합 신청 및 심의', '연구성과 공유소'] },
    {
      id: 'support', title: '분석지원', items: [
        { name: '교육데이터 통계분석 서비스', active: true, desc: '5단계 표준 통계·예측 분석 파이프라인' },
        { name: '원격 분석 환경(R/Python)', desc: '가상 클라우드 컴퓨팅' },
        { name: '분석 컨설팅 및 기술지원', desc: '전문 통계 전문가 자문' },
        { name: '통계 분석 가이드북', desc: '분석 매뉴얼 및 튜토리얼' }
      ]
    }
  ];

  function renderGnb() {
    var nav = document.getElementById('gnb');
    if (!nav) return;
    nav.innerHTML = MENUS.map(function (m) {
      var support = m.id === 'support';
      var items = m.items.map(function (it) {
        if (typeof it === 'string') {
          return '<button type="button" data-go="' + (support ? 'home' : '') + '" class="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors font-medium flex items-center justify-between cursor-pointer"><span>' + it + '</span>' + App.icon('chevron-right', 'w-3.5 h-3.5 text-slate-300') + '</button>';
        }
        return '<button type="button" data-go="home" class="w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-start gap-2 cursor-pointer ' + (it.active ? 'bg-blue-50/80 text-blue-900 font-semibold' : 'text-slate-700 hover:bg-slate-50') + '"><div class="flex-1"><div class="font-bold flex items-center gap-1.5"><span>' + it.name + '</span>' + (it.active ? '<span class="text-[9px] bg-blue-600 text-white px-1.5 rounded-full font-mono">선택됨</span>' : '') + '</div><div class="text-[11px] text-slate-500 font-normal mt-0.5">' + it.desc + '</div></div></button>';
      }).join('');
      return '<div class="relative" data-menu="' + m.id + '">' +
        '<button type="button" class="gnb-btn flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer select-none ' + (support ? 'text-blue-900 bg-blue-50/80' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50') + '"><span>' + m.title + '</span>' + App.icon('chevron-down', 'w-3.5 h-3.5 text-slate-400 transition-transform') + '</button>' +
        '<div class="gnb-panel hidden absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-xl py-2 z-50 anim-in"><div class="px-3.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">' + m.title + '</div>' + items + '</div></div>';
    }).join('');

    var sm = document.getElementById('sitemap-body');
    if (sm) sm.innerHTML = MENUS.map(function (m) {
      return '<div class="space-y-2.5"><div class="text-xs font-bold text-slate-900 pb-1.5 border-b border-slate-100">' + m.title + '</div><ul class="space-y-1.5 text-xs text-slate-600">' +
        m.items.map(function (it) {
          var name = typeof it === 'string' ? it : it.name, act = typeof it !== 'string' && it.active;
          return '<li><button type="button" data-go="' + (m.id === 'support' ? 'home' : '') + '" class="w-full text-left py-1 hover:text-blue-700 transition-colors cursor-pointer flex items-center justify-between ' + (act ? 'font-bold text-blue-700' : '') + '"><span>' + name + '</span>' + (act ? '<span class="text-[9px] bg-blue-100 text-blue-800 px-1.5 rounded-full font-mono">LIVE</span>' : '') + '</button></li>';
        }).join('') + '</ul></div>';
    }).join('');

    nav.addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]');
      if (go) {
        if (go.getAttribute('data-go') === 'home') location.href = App.ctx + '/analysis/step1';
        else closeAllMenus();
        return;
      }
      var btn = e.target.closest('.gnb-btn');
      if (!btn) return;
      var wrap = btn.parentElement;
      var panel = wrap.querySelector('.gnb-panel');
      var open = !panel.classList.contains('hidden');
      closeAllMenus();
      if (!open) {
        panel.classList.remove('hidden');
        btn.classList.add('bg-slate-50');
        var ch = btn.querySelector('svg');
        if (ch) ch.style.transform = 'rotate(180deg)';
      }
    });
    var sitemapBody = document.getElementById('sitemap-body');
    if (sitemapBody) sitemapBody.addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]');
      if (go && go.getAttribute('data-go') === 'home') location.href = App.ctx + '/analysis/step1';
      else if (go) App.closeModal('sitemap-modal');
    });
  }

  function closeAllMenus() {
    App.$$('#gnb .gnb-panel').forEach(function (p) { p.classList.add('hidden'); });
    App.$$('#gnb .gnb-btn svg').forEach(function (s) { s.style.transform = ''; });
  }

  function initHeader() {
    renderGnb();
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#gnb')) closeAllMenus();
    });
    var bs = document.getElementById('btn-search');
    if (bs) bs.addEventListener('click', function () {
      var bar = document.getElementById('search-bar');
      bar.classList.toggle('hidden');
      if (!bar.classList.contains('hidden')) document.getElementById('search-input').focus();
    });
    var sc = document.getElementById('search-close');
    if (sc) sc.addEventListener('click', function () { document.getElementById('search-bar').classList.add('hidden'); });
    var sg = document.getElementById('search-go');
    if (sg) sg.addEventListener('click', function () {
      var v = document.getElementById('search-input').value;
      App.toast("'" + v + "'에 대한 통합 검색 결과 화면으로 이동합니다.");
      document.getElementById('search-bar').classList.add('hidden');
    });
    var si = document.getElementById('search-input');
    if (si) si.addEventListener('keydown', function (e) { if (e.key === 'Enter') sg.click(); });
    var map = { 'btn-sitemap': 'sitemap-modal', 'btn-help': 'help-modal', 'btn-login': 'login-modal' };
    Object.keys(map).forEach(function (bid) {
      var b = document.getElementById(bid);
      if (b) b.addEventListener('click', function () { App.openModal(map[bid]); });
    });
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-close]');
      if (c) App.closeModal(c.getAttribute('data-close'));
      if (e.target.id === 'help-modal' || e.target.id === 'login-modal' || e.target.id === 'sitemap-modal') App.closeModal(e.target.id);
    });
    var gp = document.getElementById('login-gpki');
    if (gp) gp.addEventListener('click', function () { App.toast('GPKI 전자서명 인증이 갱신되었습니다.'); App.closeModal('login-modal'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') ['help-modal', 'login-modal', 'sitemap-modal'].forEach(App.closeModal);
    });
  }

  /* ------------------------------------------------------------ 사이드바 */
  function initSidebar() {
    var sb = document.getElementById('main-sidebar');
    var btn = document.getElementById('sb-toggle');
    if (!sb || !btn) return;
    function apply(collapsed) {
      sb.classList.toggle('w-60', !collapsed);
      sb.classList.toggle('w-14', collapsed);
      App.$$('.sb-full', sb).forEach(function (el) { el.style.display = collapsed ? 'none' : ''; });
      var ic = document.getElementById('sb-toggle-icon');
      if (ic) ic.style.transform = collapsed ? 'rotate(180deg)' : '';
      App.$$('a', sb).forEach(function (a) { a.style.justifyContent = collapsed ? 'center' : ''; });
    }
    var saved = false;
    try { saved = localStorage.getItem('sbCollapsed') === '1'; } catch (e) { /* ignore */ }
    apply(saved);
    btn.addEventListener('click', function () {
      saved = !saved;
      try { localStorage.setItem('sbCollapsed', saved ? '1' : '0'); } catch (e) { /* ignore */ }
      apply(saved);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    initSidebar();
    try {
      var f = sessionStorage.getItem('flashToast');
      if (f) { sessionStorage.removeItem('flashToast'); App.toast(f); }
    } catch (e) { /* ignore */ }
    App.icons();
  });
})();
