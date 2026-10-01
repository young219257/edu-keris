package kr.or.keris.statistics;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import javax.servlet.http.HttpServletRequest;
import org.apache.http.Header;
import org.apache.http.HttpResponse;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.client.methods.RequestBuilder;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.entity.ContentType;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

/** 외부 통계분석 API(UPSTREAM_API_BASE) 호출 공통 클라이언트. 프록시와 내보내기(PDF/Excel)가 함께 쓴다. */
@Component
public class Upstream implements DisposableBean {
    private static final String BASE =
            Config.get("UPSTREAM_API_BASE", "https://testlab-edmgr.kr/apps/1").replaceAll("/+$", "");
    private static final String ACCESS_COOKIE = "keris_testlab_access";

    private final CloseableHttpClient client = HttpClients.custom()
            .setDefaultRequestConfig(RequestConfig.custom()
                    .setConnectTimeout(10000).setSocketTimeout(120000).build())
            .build();

    /** 외부 API 응답 */
    public static class Result {
        public final int status;
        public final String contentType;
        public final String contentDisposition;
        public final byte[] body;

        Result(int status, String contentType, String contentDisposition, byte[] body) {
            this.status = status;
            this.contentType = contentType;
            this.contentDisposition = contentDisposition;
            this.body = body;
        }
    }

    /** path 는 /api/v1/... 처럼 외부 API 기준 주소 뒤에 붙는 경로(쿼리 포함). 인증 헤더·쿠키는 들어온 요청에서 그대로 전달한다. */
    public Result call(HttpServletRequest in, String method, String path, byte[] body, String contentType) throws IOException {
        RequestBuilder builder = RequestBuilder.create(method).setUri(URI.create(BASE + path)).addHeader("Accept", "application/json");
        if (body != null && body.length > 0) {
            builder.setEntity(new ByteArrayEntity(body,
                    contentType != null ? ContentType.parse(contentType) : ContentType.APPLICATION_OCTET_STREAM));
        }
        forwardHeader(in, builder, "X-Session-Id");
        forwardHeader(in, builder, "X-Session-Token");
        forwardHeader(in, builder, "Authorization");
        String access = readCookie(in.getHeader("Cookie"), ACCESS_COOKIE);
        if (access != null) builder.addHeader("Cookie", ACCESS_COOKIE + "=" + access);

        HttpUriRequest request = builder.build();
        HttpResponse response = client.execute(request);
        try {
            byte[] payload = response.getEntity() == null ? new byte[0] : EntityUtils.toByteArray(response.getEntity());
            Header ct = response.getFirstHeader("Content-Type");
            Header cd = response.getFirstHeader("Content-Disposition");
            return new Result(response.getStatusLine().getStatusCode(),
                    ct != null ? ct.getValue() : "application/json", cd != null ? cd.getValue() : null, payload);
        } finally {
            EntityUtils.consumeQuietly(response.getEntity());
        }
    }

    public static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static String readCookie(String header, String name) {
        if (header == null) return null;
        for (String part : header.split(";")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2 && pair[0].equals(name)) return pair[1];
        }
        return null;
    }

    private static void forwardHeader(HttpServletRequest request, RequestBuilder builder, String name) {
        String value = request.getHeader(name);
        if (value != null && !value.trim().isEmpty()) builder.addHeader(name, value);
    }

    @Override
    public void destroy() throws IOException {
        client.close();
    }
}
