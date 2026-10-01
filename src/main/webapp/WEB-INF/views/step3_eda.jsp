<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="layout/top.jsp" %>

<div class="space-y-6 max-w-7xl mx-auto">

  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/60">
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Step 03</span>
        <span class="text-xs text-slate-400">|</span>
        <span class="text-xs text-slate-500 font-medium">데이터 탐색 (EDA)</span>
      </div>
      <h2 class="text-xl font-bold text-slate-900 tracking-tight">기초통계 요약 및 상관관계 분석</h2>
    </div>
    <div class="text-xs text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shrink-0" id="eda-badge">불러오는 중...</div>
  </div>

  <%-- 기초통계량 --%>
  <div class="card-modern overflow-hidden">
    <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
      <h4 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
        <span>전체 수치형 변수 기초통계량</span>
        <span class="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10px] font-bold rounded-full" id="stat-count">0개 변수</span>
      </h4>
      <div class="text-[11px] text-slate-500">총 관측치: <strong class="font-mono text-slate-800" id="stat-rows">-</strong></div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
            <th class="py-2.5 px-3">변수명</th>
            <th class="py-2.5 px-2.5 text-right font-medium">유효표본(N)</th>
            <th class="py-2.5 px-2.5 text-right font-medium text-slate-900">평균 (Mean)</th>
            <th class="py-2.5 px-2.5 text-right font-medium">표준편차 (SD)</th>
            <th class="py-2.5 px-2.5 text-right font-medium text-slate-500">최솟값 (Min)</th>
            <th class="py-2.5 px-2.5 text-right font-medium text-slate-600">Q1 (25%)</th>
            <th class="py-2.5 px-2.5 text-right font-medium text-blue-700">중앙값 (Median)</th>
            <th class="py-2.5 px-2.5 text-right font-medium text-slate-600">Q3 (75%)</th>
            <th class="py-2.5 px-2.5 text-right font-medium text-slate-500">최댓값 (Max)</th>
            <th class="py-2.5 px-2.5 text-right font-medium">왜도 (Skewness)</th>
            <th class="py-2.5 px-2.5 text-right font-medium">첨도 (Kurtosis)</th>
            <th class="py-2.5 px-3 text-right font-medium">결측치율</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-mono text-[11px]" id="stat-body">
          <tr><td colspan="12" class="py-8 text-center text-slate-400 font-sans">불러오는 중...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <%-- 범주형 요약 --%>
  <div class="card-modern overflow-hidden hidden" id="cat-card">
    <div class="p-4 border-b border-slate-100 bg-slate-50/50">
      <h4 class="text-xs font-bold text-slate-900">범주형 변수 요약 <span class="ml-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold rounded-full" id="cat-count"></span></h4>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead><tr class="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
          <th class="py-2.5 px-3">변수명</th><th class="py-2.5 px-2.5 text-right">유효표본(N)</th><th class="py-2.5 px-2.5 text-right">결측</th><th class="py-2.5 px-2.5 text-right">고유값</th><th class="py-2.5 px-2.5">최빈값</th><th class="py-2.5 px-3">상위 빈도</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100 text-[11px]" id="cat-body"></tbody>
      </table>
    </div>
  </div>

  <%-- 상관행렬 --%>
  <div class="card-modern overflow-hidden">
    <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
      <div>
        <h4 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <i data-lucide="trending-up" class="w-4 h-4 text-blue-600"></i>
          <span id="corr-title">상관계수 매트릭스 (Correlation Matrix)</span>
        </h4>
        <p class="text-[11px] text-slate-500 mt-0.5">변수 쌍 간의 상관계수(r)입니다. -1.0(완전 음의 상관)부터 +1.0(완전 양의 상관)까지 분포합니다.</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <select id="corr-method" class="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer">
          <option value="pearson">피어슨 (Pearson)</option>
          <option value="spearman">스피어만 (Spearman)</option>
          <option value="kendall">켄달 (Kendall)</option>
        </select>
        <div class="flex items-center gap-3 text-[10px] text-slate-600 flex-wrap">
          <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block"></span><span>강한 양의 상관 (r ≥ 0.7)</span></div>
          <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block"></span><span>보통 양의 상관 (0.4 ≤ r &lt; 0.7)</span></div>
          <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span><span>음의 상관 (r ≤ -0.4)</span></div>
        </div>
      </div>
    </div>
    <div class="overflow-x-auto p-4" id="corr-wrap"><div class="py-6 text-center text-xs text-slate-400">불러오는 중...</div></div>
    <div class="px-4 pb-4 hidden" id="pairs-wrap"></div>
  </div>

  <div class="flex items-center justify-between pt-2">
    <a href="${ctx}/analysis/step2" class="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5">
      <i data-lucide="arrow-left" class="w-4 h-4"></i><span>2단계 품질 및 전처리로 돌아가기</span>
    </a>
    <a href="${ctx}/analysis/step4" class="px-5 py-2.5 bg-[#003876] hover:bg-[#002855] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-2">
      <span>4단계 통계 모델링 진행</span><i data-lucide="arrow-right" class="w-4 h-4"></i>
    </a>
  </div>
</div>

<%@ include file="layout/bottom.jsp" %>
<script src="${ctx}/static/js/step3.js"></script>
</body>
</html>
