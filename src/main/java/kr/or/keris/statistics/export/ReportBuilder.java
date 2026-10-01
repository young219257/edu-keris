package kr.or.keris.statistics.export;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** API 응답(JSON)을 Report 로 변환. metrics/result/chart_data 는 구조가 가변이라 스칼라는 키-값, 객체 배열은 표로 옮긴다. */
public final class ReportBuilder {
    private ReportBuilder() { }

    private static final Map<String, String> LABELS = new HashMap<String, String>();
    static {
        String[][] l = {
            {"r2", "R²"}, {"r_squared", "R²"}, {"adj_r2", "수정 R²"}, {"adj_r_squared", "수정 R²"}, {"rmse", "RMSE"}, {"mae", "MAE"}, {"mse", "MSE"},
            {"accuracy", "정확도"}, {"precision", "정밀도"}, {"recall", "재현율"}, {"f1", "F1"}, {"f1_score", "F1"}, {"auc", "AUC"}, {"roc_auc", "ROC-AUC"},
            {"n_samples", "표본 수"}, {"n_obs", "관측치 수"}, {"n_features", "변수 수"}, {"n_clusters", "군집 수"}, {"aic", "AIC"}, {"bic", "BIC"},
            {"p_value", "p-value"}, {"f_statistic", "F-통계량"}, {"silhouette", "실루엣"}, {"silhouette_score", "실루엣"}, {"inertia", "군집내 제곱합"},
            {"coefficients", "회귀계수"}, {"intercept", "절편"}, {"feature_importance", "변수 중요도"}, {"target", "종속변수"}, {"features", "독립변수"},
            {"missing_strategy", "결측 처리"}, {"outlier_treatment", "이상치 처리"}, {"outlier_method", "이상치 탐지 기법"}, {"outlier_threshold", "이상치 임계값"},
            {"scaling", "스케일링"}, {"encoding", "인코딩"}, {"drop_duplicates", "중복 제거"}, {"test_size", "검증 비율"}, {"random_state", "난수 시드"}
        };
        for (String[] p : l) LABELS.put(p[0], p[1]);
    }

    static String label(String key) {
        String v = LABELS.get(key);
        return v != null ? v : key.replace('_', ' ');
    }

    /** JSON 스칼라 → Java 값 (null 유지) */
    static Object scalar(JsonNode n) {
        if (n == null || n.isNull() || n.isMissingNode()) return null;
        if (n.isBoolean()) return n.booleanValue();
        if (n.isIntegralNumber()) return n.longValue();
        if (n.isNumber()) return n.doubleValue();
        return n.asText();
    }

    static boolean isScalar(JsonNode n) {
        return n == null || n.isValueNode();
    }

    static boolean isObjectArray(JsonNode n) {
        if (n == null || !n.isArray() || n.size() == 0) return false;
        for (JsonNode x : n) if (!x.isObject()) return false;
        return true;
    }

    static boolean isMatrix(JsonNode n) {
        if (n == null || !n.isArray() || n.size() == 0) return false;
        for (JsonNode r : n) {
            if (!r.isArray() || r.size() == 0) return false;
            for (JsonNode c : r) if (!c.isNumber() && !c.isNull()) return false;
        }
        return true;
    }

    static boolean isScalarArray(JsonNode n) {
        if (n == null || !n.isArray()) return false;
        for (JsonNode x : n) if (!x.isValueNode()) return false;
        return true;
    }

    /** 스칼라/스칼라 배열을 {라벨, 값} 목록으로 평탄화 (중첩 객체는 경로로 연결) */
    static void flatten(String prefix, JsonNode node, List<Object[]> out, int depth) {
        if (node == null || depth > 4) return;
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                String key = prefix.isEmpty() ? label(e.getKey()) : prefix + " · " + label(e.getKey());
                JsonNode v = e.getValue();
                if (v.isNull()) continue;
                if (v.isValueNode()) out.add(new Object[]{key, scalar(v)});
                else if (isScalarArray(v)) out.add(new Object[]{key, join(v, 30)});
                else if (v.isObject()) flatten(key, v, out, depth + 1);
            }
        }
    }

    static String join(JsonNode arr, int max) {
        StringBuilder sb = new StringBuilder();
        int i = 0;
        for (JsonNode x : arr) {
            if (i > 0) sb.append(", ");
            if (i >= max) { sb.append("… (총 ").append(arr.size()).append("개)"); break; }
            sb.append(x.asText());
            i++;
        }
        return sb.toString();
    }

    /** 객체 배열/행렬을 표로 수집 (중첩 구조는 재귀) */
    static void collectTables(String title, JsonNode node, List<Report.Table> out, boolean excelOnly, int depth) {
        if (node == null || depth > 4 || out.size() > 60) return;
        if (isObjectArray(node)) {
            Set<String> cols = new LinkedHashSet<String>();
            int probe = Math.min(node.size(), 50);
            for (int i = 0; i < probe; i++) {
                Iterator<String> names = node.get(i).fieldNames();
                while (names.hasNext()) cols.add(names.next());
            }
            Report.Table t = new Report.Table(title);
            t.excelOnly = excelOnly;
            for (String c : cols) t.headers.add(label(c));
            int max = Math.min(node.size(), 20000);
            for (int i = 0; i < max; i++) {
                List<Object> row = new ArrayList<Object>();
                for (String c : cols) {
                    JsonNode v = node.get(i).get(c);
                    if (v == null || v.isNull()) row.add(null);
                    else if (v.isValueNode()) row.add(scalar(v));
                    else row.add(v.toString().length() > 200 ? v.toString().substring(0, 200) + "…" : v.toString());
                }
                t.rows.add(row);
            }
            out.add(t);
        } else if (isMatrix(node)) {
            Report.Table t = new Report.Table(title);
            t.excelOnly = excelOnly;
            int width = node.get(0).size();
            for (int j = 0; j < width; j++) t.headers.add(String.valueOf(j + 1));
            for (JsonNode r : node) {
                List<Object> row = new ArrayList<Object>();
                for (JsonNode c : r) row.add(scalar(c));
                t.rows.add(row);
            }
            out.add(t);
        } else if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                JsonNode v = e.getValue();
                if (v.isValueNode() || isScalarArray(v)) continue;
                collectTables(title + " · " + label(e.getKey()), v, out, excelOnly, depth + 1);
            }
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    /**
     * 분석 1건 → 섹션들. prefix 는 패키지 내보내기에서 분석을 구분하기 위한 접두어(예: "A1 ").
     * dataset / rawPreview 는 없어도 된다.
     */
    public static void addAnalysis(Report r, String prefix, JsonNode a, JsonNode dataset, JsonNode rawPreview, List<Report.Img> images) {
        Report.Section ov = r.section(prefix + "분석 개요");
        ov.put("분석명", text(a, "name")).put("분석 ID", text(a, "id")).put("분석 기법", text(a, "method")).put("상태", text(a, "status"));
        if (dataset != null) ov.put("데이터셋", text(dataset, "name")).put("데이터셋 규모", text(dataset, "n_rows") + "행 × " + text(dataset, "n_cols") + "변수");
        else ov.put("데이터셋 ID", text(a, "dataset_id"));
        ov.put("생성 시각", text(a, "created_at")).put("완료 시각", text(a, "completed_at"));
        if (a.hasNonNull("duration_ms")) ov.put("소요 시간(ms)", a.get("duration_ms").asLong());
        if (a.hasNonNull("error")) ov.put("오류", text(a, "error"));

        JsonNode metrics = a.get("metrics");
        if (metrics != null && metrics.size() > 0) {
            Report.Section s = r.section(prefix + "핵심 지표");
            List<Object[]> kv = new ArrayList<Object[]>();
            flatten("", metrics, kv, 0);
            s.kv.addAll(kv);
            collectTables(prefix + "지표", metrics, s.tables, false, 0);
        }

        Report.Section req = r.section(prefix + "요청 조건");
        List<Object[]> kv = new ArrayList<Object[]>();
        flatten("", a.get("params"), kv, 0);
        req.kv.addAll(kv);
        List<Object[]> pre = new ArrayList<Object[]>();
        flatten("", a.get("preprocessing"), pre, 0);
        for (Object[] p : pre) req.put("전처리 · " + p[0], p[1]);

        JsonNode result = a.get("result");
        if (result != null && result.size() > 0) {
            Report.Section s = r.section(prefix + "상세 결과");
            List<Object[]> rk = new ArrayList<Object[]>();
            flatten("", result, rk, 0);
            s.kv.addAll(rk);
            collectTables(prefix + "결과", result, s.tables, false, 0);
        }

        JsonNode recs = a.get("chart_recommendations");
        if (recs != null && recs.size() > 0) {
            Report.Section s = r.section(prefix + "추천 차트");
            Report.Table t = new Report.Table(prefix + "추천 차트");
            t.headers.add("우선순위"); t.headers.add("종류"); t.headers.add("제목"); t.headers.add("추천 사유");
            for (JsonNode c : recs) {
                List<Object> row = new ArrayList<Object>();
                row.add(c.hasNonNull("priority") ? (Object) c.get("priority").asLong() : null);
                row.add(text(c, "kind")); row.add(text(c, "title")); row.add(text(c, "reason"));
                t.rows.add(row);
            }
            s.tables.add(t);
            if (images != null) s.images.addAll(images);
        }

        JsonNode cd = a.get("chart_data");
        if (cd != null && cd.size() > 0) {
            Report.Section s = r.section(prefix + "차트 원본 데이터");
            collectTables(prefix + "차트", cd, s.tables, true, 0);
            if (s.tables.isEmpty()) r.sections.remove(s);
        }

        if (rawPreview != null && rawPreview.has("rows")) {
            Report.Section s = r.section(prefix + "원시데이터");
            Report.Table t = new Report.Table(prefix + "원시데이터(상위 " + rawPreview.get("rows").size() + "행)");
            t.excelOnly = true;
            JsonNode cols = rawPreview.get("columns");
            List<String> names = new ArrayList<String>();
            if (cols != null) for (JsonNode c : cols) { names.add(c.asText()); t.headers.add(c.asText()); }
            for (JsonNode row : rawPreview.get("rows")) {
                List<Object> cells = new ArrayList<Object>();
                for (String n : names) cells.add(scalar(row.get(n)));
                t.rows.add(cells);
            }
            s.tables.add(t);
        }
    }

    public static Report forAnalysis(JsonNode a, JsonNode dataset, JsonNode rawPreview, List<Report.Img> images) {
        Report r = new Report();
        r.title = text(a, "name");
        r.subtitle = "분석 결과 보고서 · " + text(a, "method");
        addAnalysis(r, "", a, dataset, rawPreview, images);
        return r;
    }

    public static Report forPackage(JsonNode pkg, List<JsonNode> analyses, List<JsonNode> datasets) {
        Report r = new Report();
        r.title = text(pkg, "name");
        r.subtitle = "분석 패키지 보고서";
        Report.Section ov = r.section("패키지 개요");
        ov.put("패키지명", text(pkg, "name")).put("패키지 ID", text(pkg, "id"));
        if (text(pkg, "description") != null) ov.put("설명", text(pkg, "description"));
        ov.put("데이터셋 ID", text(pkg, "dataset_id")).put("포함 분석 수", analyses.size()).put("생성 시각", text(pkg, "created_at"));
        JsonNode manifest = pkg.get("manifest");
        if (manifest != null && manifest.size() > 0) {
            Report.Section s = r.section("패키지 매니페스트");
            List<Object[]> kv = new ArrayList<Object[]>();
            flatten("", manifest, kv, 0);
            s.kv.addAll(kv);
            collectTables("매니페스트", manifest, s.tables, false, 0);
        }
        for (int i = 0; i < analyses.size(); i++) {
            addAnalysis(r, "A" + (i + 1) + " ", analyses.get(i), i < datasets.size() ? datasets.get(i) : null, null, null);
        }
        return r;
    }
}
