package kr.or.keris.statistics.export;

import com.lowagie.text.pdf.BaseFont;
import java.io.File;
import javax.servlet.ServletContext;

/** PDF 한글 폰트 탐색: PDF_FONT_PATH → /WEB-INF/fonts/ → OS 기본 폰트 순. 못 찾으면 null (영문 폰트로 대체) */
public final class FontResolver {
    private FontResolver() { }

    private static final String[] SYSTEM = {
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
        "/Library/Fonts/NanumGothic.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/nanum/NanumGothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc,0",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc,0",
        "C:/Windows/Fonts/malgun.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc,0"
    };

    public static BaseFont resolve(String configured, ServletContext ctx) {
        if (configured != null) {
            BaseFont f = tryLoad(configured);
            if (f != null) return f;
        }
        if (ctx != null) {
            String dir = ctx.getRealPath("/WEB-INF/fonts");
            if (dir != null) {
                File[] files = new File(dir).listFiles();
                if (files != null) {
                    for (File f : files) {
                        String n = f.getName().toLowerCase();
                        if (n.endsWith(".ttf") || n.endsWith(".otf") || n.endsWith(".ttc")) {
                            BaseFont bf = tryLoad(f.getAbsolutePath() + (n.endsWith(".ttc") ? ",0" : ""));
                            if (bf != null) return bf;
                        }
                    }
                }
            }
        }
        for (String p : SYSTEM) {
            BaseFont f = tryLoad(p);
            if (f != null) return f;
        }
        return null;
    }

    private static BaseFont tryLoad(String path) {
        try {
            String file = path.contains(",") ? path.substring(0, path.indexOf(',')) : path;
            if (!new File(file).isFile()) return null;
            return BaseFont.createFont(path, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
        } catch (Exception e) {
            return null;
        }
    }
}
