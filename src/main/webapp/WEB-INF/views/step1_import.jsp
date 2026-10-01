<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="layout/top.jsp" %>

<div class="space-y-6 max-w-7xl mx-auto" id="step1-root">

  <%-- 1. 상단 페이지 헤더 --%>
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/60">
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Step 01</span>
        <span class="text-xs text-slate-400">|</span>
        <span class="text-xs text-slate-500 font-medium">데이터 준비 및 반입</span>
      </div>
      <h2 class="text-xl font-bold text-slate-900 tracking-tight">분석 대상 데이터 준비</h2>
    </div>
    <div class="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shrink-0">
      현재 분석 대상: <strong class="text-slate-900" id="s1-current-name">선택 안 됨</strong>
    </div>
  </div>

  <%-- 2. 주 작업 영역 --%>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <%-- 좌측: 표준 데이터 관리 카드 --%>
    <div class="lg:col-span-5 card-modern p-5 flex flex-col justify-between space-y-4">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="database" class="w-4 h-4 text-blue-600"></i>
            <h3 class="text-xs font-bold text-slate-900">표준 데이터 관리 카드 연계</h3>
          </div>
          <span class="text-[11px] font-medium text-slate-400" id="mgmt-total"></span>
        </div>
        <div class="relative">
          <input type="text" id="mgmt-search" placeholder="통계 관리 카드 검색..." class="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 pl-8 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
        </div>
        <div id="mgmt-list" class="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[340px] overflow-y-auto bg-white"></div>
      </div>
      <div class="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
        <span class="truncate pr-2" id="mgmt-status"></span>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" id="mgmt-sync" class="text-blue-700 hover:text-blue-900 cursor-pointer text-[10px] underline">카드 동기화</button>
          <button type="button" id="mgmt-release" class="hidden text-slate-400 hover:text-rose-600 cursor-pointer text-[10px] underline">해제</button>
        </div>
      </div>
    </div>

    <%-- 우측: 파일 업로드 --%>
    <div class="lg:col-span-7 space-y-4">
      <div class="card-modern p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="upload" class="w-4 h-4 text-blue-600"></i>
            <h3 class="text-xs font-bold text-slate-900">데이터 파일 직접 업로드</h3>
          </div>
          <span class="text-[11px] text-slate-400">CSV, XLSX, JSON 지원</span>
        </div>
        <div id="upload-area"></div>
      </div>
      <div class="card-modern p-5 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="layers" class="w-4 h-4 text-blue-600"></i>
            <h3 class="text-xs font-bold text-slate-900">반입된 데이터셋</h3>
          </div>
          <span class="text-[11px] text-slate-400" id="ds-total"></span>
        </div>
        <div id="ds-list" class="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[200px] overflow-y-auto bg-white"></div>
      </div>
    </div>
  </div>

  <%-- 3. 변수 속성 및 타입 정의 --%>
  <div class="card-modern overflow-hidden" id="col-card">
    <div class="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
      <div class="flex items-center gap-2.5">
        <i data-lucide="sliders-horizontal" class="w-4 h-4 text-blue-600"></i>
        <div>
          <h3 class="text-xs font-bold text-slate-900" id="col-title">변수 속성 및 데이터 타입 정의</h3>
          <p class="text-[11px] text-slate-500">현재 열람: <strong class="text-slate-800" id="col-dsname"></strong></p>
        </div>
      </div>
      <div class="relative">
        <input type="text" id="col-search" placeholder="변수명 검색..." class="bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600">
        <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2"></i>
      </div>
    </div>
    <div class="overflow-x-auto max-h-[260px] overflow-y-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200/80">
          <tr class="text-slate-500 font-semibold text-[11px]">
            <th class="py-2.5 px-4">변수명</th>
            <th class="py-2.5 px-4">원본 자료형</th>
            <th class="py-2.5 px-4 text-right">결측</th>
            <th class="py-2.5 px-4 text-right">고유값</th>
            <th class="py-2.5 px-4 w-48">타입</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-[11px]" id="col-body"></tbody>
      </table>
    </div>
  </div>

  <%-- 4. 데이터 미리보기 --%>
  <div class="card-modern overflow-hidden" id="preview-card">
    <div class="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white">
      <div class="flex items-center gap-2">
        <i data-lucide="file-spreadsheet" class="w-4 h-4 text-blue-600"></i>
        <h3 class="text-xs font-bold text-slate-900">데이터 미리보기</h3>
        <span class="text-[11px] text-slate-400 font-mono" id="preview-count"></span>
      </div>
      <span class="text-[11px] text-slate-400" id="preview-name"></span>
    </div>
    <div id="preview-scroll" class="overflow-x-auto overflow-y-auto max-h-[280px]">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200/80" id="preview-head"></thead>
        <tbody class="divide-y divide-slate-100 font-mono text-[11px]" id="preview-body"></tbody>
      </table>
      <div id="preview-more" class="hidden p-2 text-center text-xs text-slate-400 items-center justify-center gap-2">
        <span class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full spin inline-block"></span><span>데이터 불러오는 중...</span>
      </div>
    </div>
  </div>

  <%-- 5. 하단 액션 --%>
  <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
    <div class="text-xs text-slate-500 flex items-center gap-2">
      <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
      <span>분석 투입 대상: <strong class="text-slate-900 font-bold" id="s1-target-name"></strong></span>
    </div>
    <button type="button" id="btn-proceed" class="px-6 py-2.5 bg-[#003876] hover:bg-[#002b5c] text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-2">
      <span>2단계 품질 및 전처리 진행</span><i data-lucide="arrow-right" class="w-4 h-4"></i>
    </button>
  </div>
</div>

<%@ include file="layout/bottom.jsp" %>
<script src="${ctx}/static/js/step1.js"></script>
</body>
</html>
