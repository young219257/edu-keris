package kr.or.keris.statistics;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import kr.or.keris.statistics.export.ExcelExporter;
import kr.or.keris.statistics.export.FontResolver;
import kr.or.keris.statistics.export.PdfExporter;
import kr.or.keris.statistics.export.Report;
import kr.or.keris.statistics.export.ReportBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.Base64Utils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * 분석 결과 / 패키지를 PDF · Excel(.xlsx) 로 내보낸다. 외부 API 에는 없는 기능이라 이 웹 서버에서 직접 생성한다.
 * 데이터는 요청에 실린 세션 토큰으로 외부 API 를 다시 조회해서 만든다.
 *
 *   GET  /export/analysis/{id}/{pdf|excel}
 *   POST /export/analysis/{id}/pdf      본문 {"images":[{"title":"...","data":"data:image/png;base64,..."}]} (화면 차트 이미지 삽입)
 *   GET  /export/package/{id}/{pdf|excel}
 */
@Controller
public class ExportController {
    private static final String PDF = "application/pdf";
    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final int RAW_ROWS = 1000;

    @Autowired
    private Upstream upstream;
    @Autowired
    private ServletContext servletContext;
    private final ObjectMapper mapper = new ObjectMapper();

    private static class ApiException extends Exception {
        final int status;

        ApiException(int status, String message) {
            super(message);
            this.status = status;
        }
    }

    @RequestMapping(value = "/export/analysis/{id}/{fmt}", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<byte[]> analysis(@PathVariable("id") String id, @PathVariable("fmt") String fmt,
                                           HttpServletRequest request) {
        try {
            boolean pdf = isPdf(fmt);
            JsonNode a = getJson(request, "/api/v1/analyses/" + enc(id));
            JsonNode dataset = null, raw = null;
            String dsId = a.hasNonNull("dataset_id") ? a.get("dataset_id").asText() : null;
            if (dsId != null) {
                try { dataset = getJson(request, "/api/v1/datasets/" + enc(dsId)); } catch (ApiException ignore) { /* 선택 항목 */ }
                if (!pdf) {
                    try { raw = getJson(request, "/api/v1/datasets/" + enc(dsId) + "/preview?limit=" + RAW_ROWS + "&offset=0"); } catch (ApiException ignore) { /* 선택 항목 */ }
                }
            }
            List<Report.Img> images = pdf ? readImages(request) : null;
            Report report = ReportBuilder.forAnalysis(a, dataset, raw, images);
            return file(report, pdf, "분석결과_" + text(a, "name", id));
        } catch (ApiException e) {
            return error(e.status, e.getMessage());
        } catch (Exception e) {
            return error(500, "내보내기 파일을 만들지 못했습니다: " + e.getMessage());
        }
    }

    @RequestMapping(value = "/export/package/{id}/{fmt}", method = RequestMethod.GET)
    public ResponseEntity<byte[]> pkg(@PathVariable("id") String id, @PathVariable("fmt") String fmt,
                                      HttpServletRequest request) {
        try {
            boolean pdf = isPdf(fmt);
            JsonNode p = getJson(request, "/api/v1/packages/" + enc(id));
            List<JsonNode> analyses = new ArrayList<JsonNode>();
            List<JsonNode> datasets = new ArrayList<JsonNode>();
            JsonNode ids = p.get("analysis_ids");
            if (ids != null) {
                for (JsonNode aid : ids) {
                    JsonNode a = getJson(request, "/api/v1/analyses/" + enc(aid.asText()));
                    analyses.add(a);
                    JsonNode ds = null;
                    if (a.hasNonNull("dataset_id")) {
                        try { ds = getJson(request, "/api/v1/datasets/" + enc(a.get("dataset_id").asText())); } catch (ApiException ignore) { /* 선택 항목 */ }
                    }
                    datasets.add(ds);
                }
            }
            Report report = ReportBuilder.forPackage(p, analyses, datasets);
            return file(report, pdf, "분석패키지_" + text(p, "name", id));
        } catch (ApiException e) {
            return error(e.status, e.getMessage());
        } catch (Exception e) {
            return error(500, "내보내기 파일을 만들지 못했습니다: " + e.getMessage());
        }
    }

    /* ------------------------------------------------------------------ */

    private ResponseEntity<byte[]> file(Report report, boolean pdf, String baseName) throws Exception {
        byte[] body = pdf
                ? PdfExporter.write(report, FontResolver.resolve(Config.get("PDF_FONT_PATH", null), servletContext))
                : ExcelExporter.write(report);
        String name = baseName.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_") + (pdf ? ".pdf" : ".xlsx");
        String encoded = URLEncoder.encode(name, "UTF-8").replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, pdf ? PDF : XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"export" + (pdf ? ".pdf" : ".xlsx") + "\"; filename*=UTF-8''" + encoded)
                .body(body);
    }

    private ResponseEntity<byte[]> error(int status, String message) {
        String json;
        try {
            json = mapper.writeValueAsString(java.util.Collections.singletonMap("detail", message));
        } catch (Exception e) {
            json = "{\"detail\":\"error\"}";
        }
        try {
            return ResponseEntity.status(status).header(HttpHeaders.CONTENT_TYPE, "application/json;charset=UTF-8").body(json.getBytes("UTF-8"));
        } catch (java.io.UnsupportedEncodingException e) {
            return ResponseEntity.status(status).body(new byte[0]);
        }
    }

    private static boolean isPdf(String fmt) throws ApiException {
        if ("pdf".equalsIgnoreCase(fmt)) return true;
        if ("excel".equalsIgnoreCase(fmt) || "xlsx".equalsIgnoreCase(fmt)) return false;
        throw new ApiException(400, "지원하지 않는 형식입니다: " + fmt + " (pdf, excel)");
    }

    private JsonNode getJson(HttpServletRequest request, String path) throws IOException, ApiException {
        Upstream.Result r = upstream.call(request, "GET", path, null, null);
        String body = new String(r.body, "UTF-8");
        if (r.status < 200 || r.status >= 300) {
            String msg = "외부 API 오류 (" + r.status + ")";
            try {
                JsonNode e = mapper.readTree(body);
                if (e.hasNonNull("detail")) msg = e.get("detail").isTextual() ? e.get("detail").asText() : e.get("detail").toString();
            } catch (Exception ignore) { /* 본문이 JSON 이 아님 */ }
            throw new ApiException(r.status, msg);
        }
        return mapper.readTree(body);
    }

    private List<Report.Img> readImages(HttpServletRequest request) {
        List<Report.Img> out = new ArrayList<Report.Img>();
        if (!"POST".equals(request.getMethod())) return out;
        try {
            JsonNode root = mapper.readTree(Upstream.readAll(request.getInputStream()));
            JsonNode images = root == null ? null : root.get("images");
            if (images == null) return out;
            for (JsonNode im : images) {
                String data = im.hasNonNull("data") ? im.get("data").asText() : "";
                int comma = data.indexOf(',');
                if (!data.startsWith("data:image/") || comma < 0) continue;
                out.add(new Report.Img(im.hasNonNull("title") ? im.get("title").asText() : "", Base64Utils.decodeFromString(data.substring(comma + 1))));
                if (out.size() >= 30) break;
            }
        } catch (Exception ignore) {
            /* 이미지 없이 진행 */
        }
        return out;
    }

    private static String enc(String s) throws IOException {
        return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
    }

    private static String text(JsonNode n, String field, String fallback) {
        return n.hasNonNull(field) ? n.get(field).asText() : fallback;
    }
}
