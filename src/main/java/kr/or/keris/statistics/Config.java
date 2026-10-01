package kr.or.keris.statistics;

/** 환경변수 → 시스템 프로퍼티(-Dxxx) 순서로 설정값을 읽는다. (Tomcat 에서는 setenv.sh 의 JAVA_OPTS 로도 지정 가능) */
final class Config {
    private Config() { }

    static String get(String name, String defaultValue) {
        String v = System.getenv(name);
        if (v == null || v.trim().isEmpty()) v = System.getProperty(name);
        return v == null || v.trim().isEmpty() ? defaultValue : v.trim();
    }

    /** 앞에 / 를 붙이고 뒤의 / 를 제거한다. 비어 있거나 "/" 이면 빈 문자열. */
    static String normalizePath(String value) {
        if (value == null || value.trim().isEmpty() || value.trim().equals("/")) return "";
        String result = value.trim();
        if (!result.startsWith("/")) result = "/" + result;
        return result.replaceAll("/+$", "");
    }

    static String basePath() {
        return normalizePath(get("APP_BASE_PATH", ""));
    }
}
