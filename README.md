# 교육데이터 이용자통계분석 서비스 (Spring 4 / JSP)

외부 통계분석 API(`/api/v1/**`, OpenAPI 3.1)를 프록시로 연결하는 JSP 화면 프로젝트입니다.
Java 7 · Spring MVC 4.3 (Spring Boot 아님) · WAR 배포.

## 구조
```
src/main/java/kr/or/keris/statistics/
  ApiProxyController  /api/v1/**, /health → 외부 API 로 그대로 전달 (Apache HttpClient, PATCH·multipart 지원)
  BasePathFilter      리버스 프록시 하위 경로(APP_BASE_PATH) 제거 후 forward
  Upstream            외부 API 호출 공통 클라이언트 (프록시·내보내기가 공유)
  ExportController    PDF / Excel 내보내기 (외부 API 에 없는 기능 → 이 서버에서 직접 생성)
  export/             Report(문서 모델) · ReportBuilder(JSON→문서) · PdfExporter(iText 2.1.7) · ExcelExporter(POI 3.17) · FontResolver
  PageController      JSP 6개 화면 (step1~5, step4/report) — 데이터는 화면 JS 가 /api/v1 을 직접 호출
  Config              환경변수 → -D 시스템 프로퍼티 순으로 설정 읽기
src/main/webapp/WEB-INF/   web.xml, dispatcher-servlet.xml, views/*.jsp
src/main/webapp/static/js/ common.js(세션 토큰·API 클라이언트) step1~5.js report.js charts.js viz.js
```

## 설정 (환경변수 또는 -D 옵션)
| 이름 | 기본값 | 설명 |
|---|---|---|
| `UPSTREAM_API_BASE` | `https://testlab-edmgr.kr/apps/1` | 프록시 대상 (외부 API 기준 주소) |
| `APP_BASE_PATH` | (없음) | 리버스 프록시가 붙이는 하위 경로. 예: `/apps/9` |

Tomcat 에서는 `bin/setenv.sh` 에 `export UPSTREAM_API_BASE=...` 또는 `JAVA_OPTS="-DUPSTREAM_API_BASE=..."` 로 지정합니다.
외부 API 의 접근 쿠키(`keris_testlab_access`)와 `X-Session-Token`/`Authorization` 헤더만 전달됩니다.

## 빌드
```bash
mvn clean package            # → target/app.war  (JDK 7 + Maven 3.x 필요)
```
JDK 8 이상에서 컴파일만 확인하려면: `mvn -Dmaven.compiler.source=8 -Dmaven.compiler.target=8 clean package`

## 세션 / 화면 상태
* 화면이 처음 열릴 때 `POST /api/v1/sessions` 로 토큰을 발급받아 `sessionStorage` 에 보관하고, 모든 호출에 `X-Session-Token` 을 붙입니다 (5분마다 heartbeat).
* 선택한 데이터셋·전처리 규칙·모형 설정·마지막 분석 ID 도 브라우저 탭의 `sessionStorage` 에 보관합니다 (서버는 상태를 갖지 않음).
* 세션은 마지막 요청 후 1시간 뒤 만료되며 데이터셋·분석 결과가 함께 삭제됩니다 (공유 중인 패키지는 7일 유지).

## 화면 ↔ API
| 화면 | 사용 API |
|---|---|
| 1단계 반입 | `GET/POST /data-cards(/sync)`, `GET /datasets`, `POST /datasets/upload`, `GET/DELETE /datasets/{id}`, `PATCH /datasets/{id}/columns/types`, `GET /datasets/{id}/preview` |
| 2단계 품질·전처리 | `GET /datasets/{id}/profile` (이상치 7기법). 전처리 선택값은 `PreprocessingSpec` 으로 저장했다가 분석 요청에 전달 |
| 3단계 EDA | `GET /datasets/{id}/profile`, `GET /datasets/{id}/correlation` |
| 4-1 모델링 | `POST/GET/DELETE /analyses` (14개 기법) |
| 4-2 리포트 | `GET /analyses/{id}` (`chart_recommendations` + `chart_data`), `POST /packages` |
| 5단계 결과 관리 | `GET/POST/DELETE /packages`, `POST /packages/{id}/reproduce`, `POST/DELETE /packages/{id}/share` |

## PDF / Excel 내보내기
| 위치 | 엔드포인트 | 내용 |
|---|---|---|
| 4-2 리포트 | `POST /export/analysis/{id}/pdf` | 개요·지표·요청조건·상세결과·추천차트 + **화면에 그려진 차트 이미지** |
| 4-2 리포트 | `GET /export/analysis/{id}/excel` | 요약 시트 + 결과 표마다 시트, 차트 원본 데이터, 원시데이터(상위 1,000행) |
| 5단계 패키지 | `GET /export/package/{id}/{pdf\|excel}` | 패키지 매니페스트 + 포함된 모든 분석 (A1, A2 … 접두어) |

세션 토큰으로 외부 API 를 다시 조회해서 서버가 파일을 만듭니다.
**PDF 한글 폰트**: `PDF_FONT_PATH`(예: `/opt/fonts/NanumGothic.ttf`) → `WEB-INF/fonts/*.ttf` → OS 폰트(AppleGothic, NanumGothic, Noto CJK, 맑은 고딕) 순으로 찾습니다.
서버에 한글 폰트가 없으면 위 둘 중 하나로 지정하세요. 못 찾으면 PDF 에서 한글이 표시되지 않고 안내 문구가 들어갑니다.

## 알려진 한계
* `metrics` / `result` / `chart_data` 의 세부 구조는 명세에 정의되어 있지 않아, 스칼라 지표는 카드로, 나머지는 표·트리로 표시하고 차트는 자주 쓰는 형태(배열·`{x,y}` 행·히스토그램·행렬 등)를 추정해서 그립니다.
  실제 응답을 확인한 뒤 `static/js/charts.js` 의 `plan()` 과 `static/js/viz.js` 를 맞추면 됩니다.
* PDF 표는 표당 60행·9열까지만 담고(초과분은 안내 문구), 전체는 Excel 로 내보냅니다. ZIP 재현 번들은 제공하지 않습니다.
