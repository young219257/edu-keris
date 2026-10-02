package kr.or.keris.statistics;

import javax.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * /api/v1/** 와 /health 를 외부 통계분석 API 로 그대로 전달하는 프록시.
 * 무거운 요청은 외부 API 가 202 + 작업(JobRead)을 돌려주며, 작업 상태 조회(/api/v1/jobs/**)도 이 프록시를 거친다.
 * 세션 토큰(X-Session-Token / Authorization)과 접근 쿠키(keris_testlab_access)만 넘긴다.
 */
@Controller
public class ApiProxyController {
    @Autowired
    private Upstream upstream;

    @RequestMapping({"/api/v1/**", "/health"})
    public ResponseEntity<byte[]> proxy(HttpServletRequest request) throws Exception {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String prefix = Config.basePath();
        if (!prefix.isEmpty() && path.startsWith(prefix)) path = path.substring(prefix.length());
        if (request.getQueryString() != null) path += "?" + request.getQueryString();

        Upstream.Result r = upstream.call(request, request.getMethod(), path,
                Upstream.readAll(request.getInputStream()), request.getContentType());
        ResponseEntity.BodyBuilder out = ResponseEntity.status(r.status).header(HttpHeaders.CONTENT_TYPE, r.contentType);
        if (r.contentDisposition != null) out.header(HttpHeaders.CONTENT_DISPOSITION, r.contentDisposition);
        // 백그라운드 작업(202 Accepted): 재조회 간격과 작업 위치를 브라우저에 그대로 전달
        if (r.retryAfter != null) out.header(HttpHeaders.RETRY_AFTER, r.retryAfter);
        if (r.location != null) out.header(HttpHeaders.LOCATION, r.location);
        return out.body(r.body);
    }
}
