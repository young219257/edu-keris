<%@ page pageEncoding="UTF-8" %>
<c:set var="mIdx" value="${activeStep == 'import' ? 0 : activeStep == 'preprocess' ? 1 : activeStep == 'eda' ? 2 : activeStep == 'modeling' ? 3 : 4}" />
<%-- 펼침 상태 --%>
<aside id="main-sidebar" class="w-60 bg-white border-r border-slate-200/80 flex flex-col shrink-0 select-none transition-all duration-300">
  <div class="p-4 flex-1 flex flex-col space-y-6">
    <div class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider sb-full">분석 파이프라인</span>
        <button type="button" id="sb-toggle" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer" title="사이드바 접기/펼치기">
          <i data-lucide="chevron-left" class="w-3.5 h-3.5" id="sb-toggle-icon"></i>
        </button>
      </div>

      <div class="space-y-1">
        <%-- 1 --%>
        <a href="${ctx}/analysis/step1" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${mIdx == 0 ? 'bg-[#003876] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}" title="1. 데이터 반입">
          <div class="flex items-center gap-2.5"><i data-lucide="database" class="w-4 h-4 shrink-0 ${mIdx == 0 ? 'text-white' : 'text-slate-400'}"></i><span class="sb-full">1. 데이터 반입</span></div>
          <c:if test="${mIdx == 0}"><span class="w-1.5 h-1.5 rounded-full bg-blue-300 sb-full"></span></c:if>
        </a>
        <%-- 2 --%>
        <a href="${ctx}/analysis/step2" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${mIdx == 1 ? 'bg-[#003876] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}" title="2. 품질 및 전처리">
          <div class="flex items-center gap-2.5"><i data-lucide="shield-check" class="w-4 h-4 shrink-0 ${mIdx == 1 ? 'text-white' : 'text-slate-400'}"></i><span class="sb-full">2. 품질 및 전처리</span></div>
          <c:if test="${mIdx == 1}"><span class="w-1.5 h-1.5 rounded-full bg-blue-300 sb-full"></span></c:if>
        </a>
        <%-- 3 --%>
        <a href="${ctx}/analysis/step3" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${mIdx == 2 ? 'bg-[#003876] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}" title="3. 데이터 탐색">
          <div class="flex items-center gap-2.5"><i data-lucide="bar-chart-2" class="w-4 h-4 shrink-0 ${mIdx == 2 ? 'text-white' : 'text-slate-400'}"></i><span class="sb-full">3. 데이터 탐색</span></div>
          <c:if test="${mIdx == 2}"><span class="w-1.5 h-1.5 rounded-full bg-blue-300 sb-full"></span></c:if>
        </a>
        <%-- 4 (그룹) --%>
        <div class="space-y-1">
          <a href="${ctx}/analysis/step4" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${mIdx == 3 && subTab != 'report' ? 'bg-[#003876] text-white shadow-xs' : (mIdx == 3 ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}" title="4. 통계 모델링">
            <div class="flex items-center gap-2.5"><i data-lucide="cpu" class="w-4 h-4 shrink-0 ${mIdx == 3 && subTab != 'report' ? 'text-white' : 'text-slate-400'}"></i><span class="sb-full">4. 통계 모델링</span></div>
          </a>
          <div class="pl-3.5 space-y-0.5 border-l border-slate-200 ml-4 py-0.5 sb-full">
            <a href="${ctx}/analysis/step4" class="w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer ${mIdx == 3 && subTab != 'report' ? 'text-blue-700 font-bold bg-blue-50/60' : 'text-slate-500 hover:text-slate-900'}">
              <i data-lucide="sliders" class="w-3 h-3"></i><span>4-1. 모형 설정·실행</span>
            </a>
            <a href="${ctx}/analysis/step4/report" class="w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer ${mIdx == 3 && subTab == 'report' ? 'text-blue-700 font-bold bg-blue-50/60' : 'text-slate-500 hover:text-slate-900'}">
              <i data-lucide="file-text" class="w-3 h-3"></i><span>4-2. 차트·원시데이터</span>
            </a>
          </div>
        </div>
        <%-- 5 --%>
        <a href="${ctx}/analysis/step5" class="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${mIdx == 4 ? 'bg-[#003876] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}" title="5. 결과 관리">
          <div class="flex items-center gap-2.5"><i data-lucide="archive" class="w-4 h-4 shrink-0 ${mIdx == 4 ? 'text-white' : 'text-slate-400'}"></i><span class="sb-full">5. 결과 관리</span></div>
          <c:if test="${mIdx == 4}"><span class="w-1.5 h-1.5 rounded-full bg-blue-300 sb-full"></span></c:if>
        </a>
      </div>
    </div>
  </div>
</aside>
