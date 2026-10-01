<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
  </main>
</div>

<%-- ============================ 푸터 ============================ --%>
<footer class="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-12 py-6 px-4 sm:px-8">
  <div class="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <span class="font-bold text-slate-200">교육데이터 통계분석 서비스</span>
      <span class="text-slate-600">|</span>
      <span class="text-slate-400">기술지원: 1644-7756 (평일 09:00~18:00)</span>
    </div>
    <div class="flex items-center gap-4 text-[11px] text-slate-500">
      <span class="flex items-center gap-1 text-slate-400"><i data-lucide="shield" class="w-3.5 h-3.5 text-emerald-400"></i><span>개인정보보호 및 가명정보 처리 표준 준수</span></span>
      <span>COPYRIGHT © STAT SERVICE. ALL RIGHTS RESERVED.</span>
    </div>
  </div>
</footer>

<%-- ============================ 도움말 모달 ============================ --%>
<div id="help-modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs items-center justify-center z-[60] p-4">
  <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden anim-in max-h-[90vh] flex flex-col">
    <div class="p-4 bg-slate-900 text-white flex items-center justify-between">
      <div class="font-bold text-sm flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-blue-400"></i>이용자통계분석 서비스 사용자 매뉴얼 및 가이드</div>
      <button type="button" data-close="help-modal" class="text-slate-400 hover:text-white p-1 rounded cursor-pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <div class="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
      <div class="p-3 bg-blue-50/80 rounded-lg border border-blue-200 text-blue-950">
        <div class="font-bold text-sm mb-1">통계분석 서비스 표준 프로세스 5단계</div>
        <p class="text-[11px] text-blue-900">본 시스템은 데이터 업로드부터 모델링, 지표 평가 및 기관 내 공유까지 원스톱으로 지원합니다.</p>
      </div>
      <div class="space-y-3">
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200"><div class="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs"><span class="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">1</span>데이터 반입 (Data Ingestion)</div><p class="text-[11px] text-slate-600">로컬의 CSV, Excel(.xlsx) 파일을 드래그하여 업로드하면 컬럼 속성(수치형, 범주형 등)이 자동 판별됩니다. <strong>최대 100만 행, 파일 용량 10MB</strong>까지 안정적으로 반입 처리됩니다.</p></div>
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200"><div class="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs"><span class="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">2</span>데이터 탐색 (EDA 대시보드)</div><p class="text-[11px] text-slate-600">평균, 표준편차, 사분위수 등 기술통계량과 결측치·이상치 비율, 피어슨 상관계수 매트릭스 및 인터랙티브 산점도를 통해 변수 간 관계를 시각적으로 확인합니다.</p></div>
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200"><div class="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs"><span class="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">3</span>고급 분석 설정 (Model Configuration)</div><p class="text-[11px] text-slate-600">선형회귀, 로지스틱 회귀, 의사결정나무, K-평균 군집분석 중 목적에 맞는 기법을 선택하고 종속변수 및 독립변수 다중선택, 가중치 등을 지정합니다.</p></div>
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200"><div class="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs"><span class="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">4</span>분석 결과 및 추천 시각화 (Results)</div><p class="text-[11px] text-slate-600">R², RMSE, 정확도 등 성능 지표와 회귀계수표(B, p-value, VIF)를 열람하고 최적화된 회귀선 산점도, 잔차 분포도, 의사결정나무 계층도를 확인 및 복사할 수 있습니다.</p></div>
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200"><div class="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs"><span class="w-4 h-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">5</span>분석 이력/저장 관리 (Reproducibility &amp; Sharing)</div><p class="text-[11px] text-slate-600">과거 분석 조건과 전처리 파라미터를 불러와 원클릭 재현(Re-run)하거나 행정망 내 협업 링크 생성, 분석 재현 패키지(.zip)를 다운로드합니다.</p></div>
      </div>
    </div>
    <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
      <button type="button" data-close="help-modal" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md text-xs transition-colors cursor-pointer">확인 및 닫기</button>
    </div>
  </div>
</div>

<%-- ============================ 로그인 모달 ============================ --%>
<div id="login-modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs items-center justify-center z-[60] p-4">
  <div class="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden anim-in">
    <div class="p-4 bg-slate-900 text-white flex items-center justify-between">
      <div class="font-bold text-sm flex items-center gap-2"><i data-lucide="lock" class="w-4 h-4 text-blue-400"></i>공공기관 전자서명 및 사용자 인증 안내</div>
      <button type="button" data-close="login-modal" class="text-slate-400 hover:text-white cursor-pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <div class="p-6 text-xs space-y-4">
      <div class="text-center py-2">
        <div class="w-12 h-12 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center mx-auto mb-3 border border-blue-200"><i data-lucide="shield-check" class="w-6 h-6"></i></div>
        <h4 class="text-sm font-bold text-slate-900">로그인이 필요한 공공 통계분석 서비스입니다.</h4>
        <p class="text-slate-500 mt-1 leading-relaxed">정부 GPKI/EPKI 행정전자서명 또는 공공데이터포털 통합회원 인증을 통해 보안 세션을 유지합니다.</p>
      </div>
      <div class="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-1">
        <div class="font-semibold text-slate-800">현재 접속 계정 정보:</div>
        <div class="text-slate-600 font-mono">• 홍길동 주무관 (교육부 교육통계담당관실)</div>
        <div class="text-slate-600 font-mono">• 보안 인가 등급: 공공데이터 분석관 (Level 2)</div>
      </div>
      <div class="space-y-2 pt-2">
        <button type="button" id="login-gpki" class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"><span>GPKI 행정전자서명 재인증</span></button>
        <button type="button" data-close="login-modal" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors cursor-pointer">닫기</button>
      </div>
    </div>
  </div>
</div>

<%-- 토스트 --%>
<div id="toast" class="hidden fixed bottom-6 right-6 z-[70] bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium border border-slate-700 items-center gap-2 anim-in max-w-md">
  <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400 shrink-0" id="toast-icon"></i><span id="toast-msg"></span>
</div>

<script>window.__CTX__ = '${ctx}';</script>
<script src="${ctx}/static/js/common.js"></script>
<script src="${ctx}/static/js/viz.js"></script>
