<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="layout/top.jsp" %>

<div class="space-y-6 max-w-7xl mx-auto">

  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/60">
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Step 05</span>
        <span class="text-xs text-slate-400">|</span>
        <span class="text-xs text-slate-500 font-medium">결과 관리 및 패키징 (Management &amp; Packaging)</span>
      </div>
      <h2 class="text-xl font-bold text-slate-900 tracking-tight">분석 결과 관리 및 공공 연구 재현 패키지</h2>
    </div>
  </div>

  <div id="pk-notice" class="hidden p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 items-center gap-2 shadow-xs anim-in">
    <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i><span id="pk-notice-msg"></span>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
    <%-- 좌: 패키지 목록 + 새 패키지 --%>
    <div class="lg:col-span-5 space-y-4">
      <div class="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2"><i data-lucide="archive" class="w-4 h-4 text-blue-700"></i><h4 class="text-xs font-bold text-slate-900" id="pk-title">저장된 분석 패키지</h4></div>
        </div>
        <div class="space-y-2.5 max-h-[420px] overflow-y-auto pr-1" id="pk-list"></div>
      </div>
    </div>

    <%-- 우: 상세 --%>
    <div class="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-4" id="pk-detail"></div>
  </div>

  <div class="flex justify-start pt-1">
    <a href="${ctx}/analysis/step4" class="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition-colors border border-slate-200 cursor-pointer flex items-center gap-1.5 shadow-2xs">
      <i data-lucide="arrow-left" class="w-4 h-4"></i><span>4단계 통계 모델링으로 돌아가기</span>
    </a>
  </div>
</div>

<%@ include file="layout/bottom.jsp" %>
<script src="${ctx}/static/js/step5.js"></script>
</body>
</html>
