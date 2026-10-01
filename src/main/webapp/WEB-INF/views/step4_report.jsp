<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="layout/top.jsp" %>

<div class="space-y-6 max-w-7xl mx-auto" id="report-root">

  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/60">
    <div>
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <span class="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Step 04-2</span>
        <span class="text-xs text-slate-400">|</span>
        <span class="text-xs text-slate-500 font-medium">분석 결과 상세 리포트</span>
        <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200" id="rp-method">통계 분석 모형</span>
      </div>
      <h2 class="text-xl font-bold text-slate-900 tracking-tight" id="rp-title">분석 결과를 불러오는 중...</h2>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button type="button" id="btn-pdf" class="hidden px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 rounded-xl text-xs font-semibold shadow-2xs transition-colors items-center gap-1.5 cursor-pointer">
        <i data-lucide="file-text" class="w-3.5 h-3.5"></i><span>PDF 보고서</span>
      </button>
      <button type="button" id="btn-xlsx" class="hidden px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold shadow-2xs transition-colors items-center gap-1.5 cursor-pointer">
        <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i><span>Excel 통계표</span>
      </button>
      <button type="button" id="btn-json" class="hidden px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors items-center gap-1.5 cursor-pointer">
        <i data-lucide="download" class="w-3.5 h-3.5"></i><span>결과 JSON 저장</span>
      </button>
      <button type="button" id="btn-save" class="hidden px-4 py-2 bg-[#003876] hover:bg-[#002b5c] disabled:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors items-center gap-1.5 cursor-pointer">
        <i data-lucide="save" class="w-3.5 h-3.5"></i><span>결과 패키지 저장</span>
      </button>
    </div>
  </div>

  <div id="rp-empty" class="hidden card-modern p-12 text-center text-slate-500 space-y-3">
    <i data-lucide="cpu" class="w-8 h-8 mx-auto text-slate-300"></i>
    <div class="text-sm font-semibold text-slate-700">표시할 분석 결과가 없습니다.</div>
    <div class="text-xs">4-1단계에서 모형을 설정하고 분석을 실행해 주세요.</div>
    <a href="${ctx}/analysis/step4" class="inline-block px-4 py-2 bg-[#003876] text-white rounded-xl text-xs font-bold">모형 설정·실행으로 이동</a>
  </div>

  <div id="rp-body" class="space-y-6 hidden">
    <div id="rp-diag" class="card-modern p-5 space-y-3"></div>

    <div class="flex items-center justify-between bg-slate-100/80 rounded-xl p-1 border border-slate-200/70">
      <div class="flex items-center gap-1 flex-wrap" id="rp-tabs"></div>
    </div>

    <div id="rp-charts"></div>
    <div id="rp-result" class="card-modern p-5 space-y-3"></div>
    <div id="rp-raw" class="card-modern p-5 space-y-3"></div>
  </div>

  <div class="flex justify-between items-center pt-1">
    <a href="${ctx}/analysis/step4" class="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-200 cursor-pointer flex items-center gap-1.5 shadow-2xs">
      <i data-lucide="arrow-left" class="w-4 h-4"></i><span>4-1단계 모형 설정 및 재실행</span>
    </a>
    <a href="${ctx}/analysis/step5" class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-2">
      <span>5단계 결과 관리 및 패키징</span><i data-lucide="arrow-right" class="w-4 h-4"></i>
    </a>
  </div>
</div>

<%@ include file="layout/bottom.jsp" %>
<script src="${ctx}/static/js/charts.js"></script>
<script src="${ctx}/static/js/report.js"></script>
</body>
</html>
