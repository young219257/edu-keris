package kr.or.keris.statistics;

import java.io.IOException;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 리버스 프록시가 붙이는 하위 경로(APP_BASE_PATH, 예: /apps/1)를 제거하고 내부 경로로 forward 한다.
 * 요청 URI 가 basePath 로 시작하지 않으면 그대로 통과시킨다.
 */
public class BasePathFilter extends OncePerRequestFilter {
    private final String basePath = Config.basePath();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!basePath.isEmpty()) {
            String uri = request.getRequestURI().substring(request.getContextPath().length());
            if (uri.equals(basePath) || uri.startsWith(basePath + "/")) {
                String target = uri.substring(basePath.length());
                if (target.isEmpty()) target = "/";
                request.getRequestDispatcher(target).forward(request, response);
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
