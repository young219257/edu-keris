package kr.or.keris.statistics;

import javax.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * /api/v1/** 와 /health 를 외부 통계분석 API 로 그대로 전달하는 프록시.
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
        return out.body(r.body);
    }
}
