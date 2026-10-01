<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><c:out value="${pageTitle}"/> | 교육데이터플랫폼 이용자통계분석 서비스</title>
  <meta name="description" content="공공기관 및 연구자를 위한 데이터 반입, 탐색적 데이터 분석(EDA), 다변량 고급 통계 분석 및 결과 리포트 생성 웹 서비스">
  <link rel="icon" type="image/svg+xml" href="${ctx}/static/vendor/edmgr-header-logo.svg">
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
  <link rel="stylesheet" href="${ctx}/static/css/app.css">
  <!-- 폐쇄망 배포를 위해 라이브러리를 /static/vendor 에 포함 (Tailwind v4 browser build, Highcharts, Lucide) -->
  <script src="${ctx}/static/vendor/tailwind-browser.js"></script>
  <script src="${ctx}/static/vendor/lucide.min.js"></script>
  <script src="${ctx}/static/vendor/highcharts.js"></script>
  <script src="${ctx}/static/vendor/highcharts-more.js"></script>
  <script src="${ctx}/static/vendor/heatmap.js"></script>
  <script src="${ctx}/static/vendor/exporting.js"></script>
</head>
<body class="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900 antialiased">

<%-- ============================ 1. 상단 헤더 ============================ --%>
<header class="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50" id="site-header">
  <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
    <div class="flex items-center gap-6">
      <a href="${ctx}/analysis/step1" class="flex items-center gap-3 cursor-pointer select-none group">
        <img src="${ctx}/static/vendor/edmgr-header-logo.svg" alt="교육데이터플랫폼" class="h-8 sm:h-9 w-auto object-contain transition-opacity group-hover:opacity-90">
        <div class="hidden xl:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs font-semibold text-slate-700">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          <span>통계분석 서비스</span>
        </div>
      </a>

      <nav class="hidden lg:flex items-center gap-1 xl:gap-2" id="gnb"></nav>
    </div>

    <div class="flex items-center gap-2.5 sm:gap-3 text-xs font-medium text-slate-700">
      <div class="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200/80 text-[11px] font-semibold">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>OpenAPI 3.1.0</span>
      </div>
      <button type="button" id="btn-search" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer" title="통합 검색">
        <i data-lucide="search" class="w-4 h-4 text-slate-500"></i><span class="hidden sm:inline font-semibold">검색</span>
      </button>
      <button type="button" id="btn-sitemap" class="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer">
        <i data-lucide="menu" class="w-4 h-4 text-slate-500"></i><span class="font-semibold">사이트맵</span>
      </button>
      <button type="button" id="btn-help" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer" title="도움말 및 이용 가이드">
        <i data-lucide="help-circle" class="w-4 h-4 text-slate-500"></i><span class="hidden md:inline">이용안내</span>
      </button>
      <div class="h-4 w-px bg-slate-200 mx-0.5"></div>
      <button type="button" id="btn-login" class="px-3.5 py-1.5 bg-[#003876] hover:bg-[#002855] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer">
        <i data-lucide="log-in" class="w-3.5 h-3.5"></i><span>로그인</span>
      </button>
    </div>
  </div>

  <div id="search-bar" class="hidden bg-slate-900 text-white p-3 border-t border-slate-800 shadow-xl anim-in">
    <div class="max-w-3xl mx-auto flex items-center gap-3">
      <i data-lucide="search" class="w-4 h-4 text-blue-400 shrink-0"></i>
      <input type="text" id="search-input" placeholder="교육통계, 학교알리미 데이터셋, 학생 맞춤형 변수 검색..." class="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-400 px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none">
      <button type="button" id="search-go" class="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer">검색</button>
      <button type="button" id="search-close" class="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>
  </div>

  <div id="sitemap-modal" class="hidden fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 items-start justify-center pt-16 px-4">
    <div class="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden anim-in">
      <div class="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <img src="${ctx}/static/vendor/edmgr-header-logo.svg" alt="교육데이터플랫폼" class="h-6 w-auto object-contain">
          <span class="text-slate-300">|</span>
          <h3 class="text-sm font-bold text-slate-900">전체 사이트맵 서비스 목록</h3>
        </div>
        <button type="button" data-close="sitemap-modal" class="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <div class="p-6 grid grid-cols-2 md:grid-cols-5 gap-6" id="sitemap-body"></div>
      <div class="p-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">국가 교육데이터 통합 플랫폼 · 대한민국 교육부 &amp; 한국교육개발원</div>
    </div>
  </div>
</header>

<%-- ============================ 2. 5단계 진행 바 ============================ --%>
<c:set var="stepIdx" value="${activeStep == 'import' ? 0 : activeStep == 'preprocess' ? 1 : activeStep == 'eda' ? 2 : activeStep == 'modeling' ? 3 : 4}" />
<nav aria-label="분석 진행 단계" class="border-b border-slate-200/80 sticky top-15 z-40 backdrop-blur-md bg-white/90">
  <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between overflow-x-auto py-2.5 gap-4">
      <div class="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl shrink-0">
        <c:set var="stepNames" value="${fn:split('1. 데이터 반입,2. 품질 및 전처리,3. 데이터 탐색,4. 통계 모델링,5. 결과 관리', ',')}" />
        <c:set var="stepUrls" value="${fn:split('step1,step2,step3,step4,step5', ',')}" />
        <c:forEach var="nm" items="${stepNames}" varStatus="st">
          <c:set var="i" value="${st.index}" />
          <a href="${ctx}/analysis/${stepUrls[i]}"
             class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none whitespace-nowrap ${i == stepIdx ? 'bg-white text-[#003876] shadow-sm font-bold' : (i < stepIdx ? 'text-slate-700 hover:text-slate-950 hover:bg-white/60' : 'text-slate-400 hover:text-slate-600')}">
            <div class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${i == stepIdx ? 'bg-[#003876] text-white' : (i < stepIdx ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600')}">
              <c:choose>
                <c:when test="${i < stepIdx}"><i data-lucide="check" class="w-2.5 h-2.5" style="stroke-width:3"></i></c:when>
                <c:otherwise>${i + 1}</c:otherwise>
              </c:choose>
            </div>
            <span class="${i == stepIdx ? 'text-[#003876]' : ''}"><c:out value="${nm}"/></span>
          </a>
        </c:forEach>
      </div>

      <c:if test="${activeStep == 'modeling'}">
        <div class="hidden md:flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl shrink-0">
          <a href="${ctx}/analysis/step4" class="px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors cursor-pointer ${subTab == 'run' ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}">모형 설정·실행</a>
          <a href="${ctx}/analysis/step4/report" class="px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors cursor-pointer ${subTab == 'report' ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}">추천 차트 상세 리포트</a>
        </div>
      </c:if>
    </div>
  </div>
</nav>

<%-- ============================ 3. 메인: 사이드바 + 본문 ============================ --%>
<div class="flex-1 flex flex-col lg:flex-row w-full max-w-[1720px] mx-auto">
  <%@ include file="sidebar.jsp" %>
  <main id="main-content" class="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 overflow-y-auto">
