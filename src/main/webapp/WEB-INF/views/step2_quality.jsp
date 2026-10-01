<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="layout/top.jsp" %>

<div class="space-y-6 max-w-7xl mx-auto" id="step2-root">

  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/60">
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Step 02</span>
        <span class="text-xs text-slate-400">|</span>
        <span class="text-xs text-slate-500 font-medium">데이터 품질 진단 및 전처리</span>
      </div>
      <h2 class="text-xl font-bold text-slate-900 tracking-tight">데이터 품질 진단 및 전처리 규칙 수립</h2>
    </div>
  </div>

  <%-- 이상치 탐지 알고리즘 선택 (7대 기법) --%>
  <div class="card-modern p-5">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
      <div class="flex items-center gap-2">
        <i data-lucide="calculator" class="w-4 h-4 text-blue-600"></i>
        <h3 class="text-xs font-bold text-slate-900">이상치 탐지 알고리즘 선택</h3>
        <span class="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">7대 표준 기법 지원</span>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 items-stretch" id="algo-grid"></div>

    <div class="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/60 border border-blue-200 rounded-xl p-3 shadow-2xs">
      <div class="flex items-center gap-2 flex-wrap">
        <i data-lucide="calculator" class="w-4 h-4 text-blue-600"></i>
        <span class="text-xs font-bold text-slate-800">선택 알고리즘: <span class="text-blue-700 font-bold" id="algo-sel-name"></span></span>
        <span id="detect-ok" class="hidden text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold items-center gap-1 animate-pulse">
          <i data-lucide="check" class="w-3 h-3"></i> 적용 및 정밀 재탐지 완료!
        </span>
      </div>
      <button type="button" id="btn-detect" class="px-4 py-2 bg-[#003876] hover:bg-[#002855] disabled:bg-slate-400 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0">
        <i data-lucide="shield-check" class="w-4 h-4"></i><span>선택 기법으로 이상치 재탐지 실행</span>
      </button>
    </div>
  </div>

  <%-- 품질 진단 요약 --%>
  <div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card-modern p-4"><span class="text-xs font-medium text-slate-400 block">총 관측치</span><span class="text-lg font-bold text-slate-900 font-mono mt-0.5 block" id="card-rows">-</span></div>
      <div class="card-modern p-4"><span class="text-xs font-medium text-slate-400 block">결측치 (Missing)</span><span class="text-lg font-bold font-mono mt-0.5 block" id="card-missing">-</span></div>
      <div class="card-modern p-4"><span class="text-xs font-medium text-slate-400 block" id="card-out-label">이상치 검출</span><span class="text-lg font-bold font-mono mt-0.5 block" id="card-outliers">-</span></div>
      <div class="card-modern p-4"><span class="text-xs font-medium text-slate-400 block">중복 행</span><span class="text-lg font-bold font-mono mt-0.5 block" id="card-dups">-</span></div>
    </div>

    <div class="card-modern p-5">
      <div class="pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
        <div>
          <h4 class="text-xs font-bold text-slate-900">변수별 결측치 및 이상치 진단 현황</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">현재 적용 알고리즘: <span class="font-bold text-slate-700" id="applied-name"></span> (<span id="applied-formula" class="font-mono"></span>)</p>
        </div>
        <span class="text-[11px] text-slate-400 font-medium">클릭 시 상세 분석</span>
      </div>
      <div class="overflow-x-auto max-h-64">
        <table class="w-full text-left text-xs border-collapse">
          <thead><tr class="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px]">
            <th class="py-2.5 px-3">변수명</th><th class="py-2.5 px-3 text-right">결측치</th><th class="py-2.5 px-3 text-right" id="th-out">이상치</th><th class="py-2.5 px-3 text-right">상태</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-100 font-mono text-[11px]" id="var-body"></tbody>
        </table>
      </div>
    </div>

    <div class="card-modern p-5 space-y-3" id="detail-card"></div>
  </div>

  <%-- 정제 전략 설정 --%>
  <div class="card-modern p-5 space-y-4">
    <div class="flex items-center justify-between pb-3 border-b border-slate-100">
      <div class="flex items-center gap-2">
        <i data-lucide="sliders-horizontal" class="w-4 h-4 text-[#003876]"></i>
        <h3 class="text-xs font-bold text-slate-900">데이터 정제 및 전처리 규칙 설정</h3>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" id="strategy-grid"></div>
  </div>

  <div class="flex items-center justify-between pt-2">
    <a href="${ctx}/analysis/step1" class="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5">
      <i data-lucide="arrow-left" class="w-4 h-4"></i><span>1단계 데이터 반입으로 돌아가기</span>
    </a>
    <button type="button" id="btn-next" class="px-5 py-2.5 bg-[#003876] hover:bg-[#002855] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-2">
      <span>3단계 데이터 탐색(EDA) 진행</span><i data-lucide="arrow-right" class="w-4 h-4"></i>
    </button>
  </div>
</div>

<%@ include file="layout/bottom.jsp" %>
<script src="${ctx}/static/js/step2.js"></script>
</body>
</html>
