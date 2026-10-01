package kr.or.keris.statistics.export;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.HeaderFooter;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

/** Report → PDF (iText 2.1.7). 한글 표시에는 TTF 폰트가 필요하다(FontResolver 참고). */
public final class PdfExporter {
    private PdfExporter() { }

    private static final int MAX_ROWS = 60;
    private static final int MAX_COLS = 9;

    public static byte[] write(Report report, BaseFont base) throws DocumentException, IOException {
        boolean korean = base != null;
        if (base == null) base = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
        Font fTitle = new Font(base, 18, Font.BOLD, new Color(0, 56, 118));
        Font fSub = new Font(base, 10, Font.NORMAL, Color.GRAY);
        Font fSection = new Font(base, 12, Font.BOLD, Color.WHITE);
        Font fBody = new Font(base, 9);
        Font fBold = new Font(base, 9, Font.BOLD);
        Font fSmall = new Font(base, 7.5f);
        Font fHead = new Font(base, 7.5f, Font.BOLD);
        Font fNote = new Font(base, 8, Font.ITALIC, Color.GRAY);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 36, 36, 40, 44);
        PdfWriter.getInstance(doc, out);
        HeaderFooter footer = new HeaderFooter(new Phrase("- ", fSmall), new Phrase(" -", fSmall));
        footer.setAlignment(Element.ALIGN_CENTER);
        footer.setBorder(Rectangle.NO_BORDER);
        doc.setFooter(footer);
        doc.open();

        doc.add(new Paragraph(nz(report.title), fTitle));
        if (report.subtitle != null) doc.add(new Paragraph(report.subtitle, fSub));
        if (!korean) doc.add(new Paragraph("※ 한글 폰트를 찾지 못해 한글이 표시되지 않습니다. 서버에 PDF_FONT_PATH 또는 /WEB-INF/fonts/ 에 TTF 폰트를 지정하세요.", fNote));
        doc.add(Chunk.NEWLINE);

        for (Report.Section s : report.sections) {
            boolean any = !s.kv.isEmpty() || !s.images.isEmpty();
            for (Report.Table t : s.tables) if (!t.excelOnly) any = true;
            if (!any) continue;

            PdfPTable bar = new PdfPTable(1);
            bar.setWidthPercentage(100);
            PdfPCell bc = new PdfPCell(new Phrase(s.title, fSection));
            bc.setBackgroundColor(new Color(0, 56, 118));
            bc.setBorder(Rectangle.NO_BORDER);
            bc.setPadding(5);
            bar.addCell(bc);
            bar.setSpacingBefore(8);
            bar.setSpacingAfter(4);
            doc.add(bar);

            if (!s.kv.isEmpty()) {
                PdfPTable kv = new PdfPTable(new float[]{28, 72});
                kv.setWidthPercentage(100);
                for (Object[] row : s.kv) {
                    kv.addCell(cell(String.valueOf(row[0]), fBold, new Color(238, 242, 247)));
                    kv.addCell(cell(fmt(row[1]), fBody, null));
                }
                doc.add(kv);
            }
            for (Report.Table t : s.tables) {
                if (t.excelOnly) continue;
                doc.add(table(t, fHead, fSmall, fBold, fNote));
            }
            for (Report.Img img : s.images) {
                Paragraph cap = new Paragraph(nz(img.title), fBold);
                cap.setSpacingBefore(6);
                doc.add(cap);
                try {
                    Image im = Image.getInstance(img.png);
                    im.scaleToFit(500, 260);
                    im.setAlignment(Element.ALIGN_CENTER);
                    doc.add(im);
                } catch (Exception e) {
                    doc.add(new Paragraph("(차트 이미지를 불러오지 못했습니다)", fNote));
                }
            }
        }
        doc.close();
        return out.toByteArray();
    }

    private static PdfPTable table(Report.Table t, Font fHead, Font fCell, Font fBold, Font fNote) throws DocumentException {
        int cols = Math.min(t.headers.size(), MAX_COLS);
        Paragraph wrap = null;
        PdfPTable tb = new PdfPTable(Math.max(cols, 1));
        tb.setWidthPercentage(100);
        tb.setSpacingBefore(6);
        tb.setHeaderRows(2);
        PdfPCell title = new PdfPCell(new Phrase(t.title, fBold));
        title.setColspan(Math.max(cols, 1));
        title.setBorder(Rectangle.NO_BORDER);
        title.setPaddingBottom(3);
        tb.addCell(title);
        for (int c = 0; c < cols; c++) tb.addCell(cell(t.headers.get(c), fHead, new Color(226, 232, 240)));
        int shown = Math.min(t.rows.size(), MAX_ROWS);
        for (int r = 0; r < shown; r++) {
            List<Object> row = t.rows.get(r);
            for (int c = 0; c < cols; c++) tb.addCell(cell(c < row.size() ? fmt(row.get(c)) : "", fCell, null));
        }
        StringBuilder note = new StringBuilder();
        if (t.rows.size() > shown) note.append("전체 ").append(t.rows.size()).append("행 중 ").append(shown).append("행만 표시했습니다. ");
        if (t.headers.size() > cols) note.append("열 ").append(t.headers.size()).append("개 중 ").append(cols).append("개만 표시했습니다. ");
        if (note.length() > 0) {
            note.append("전체 내용은 Excel 내보내기를 이용하세요.");
            PdfPCell nc = new PdfPCell(new Phrase(note.toString(), fNote));
            nc.setColspan(Math.max(cols, 1));
            nc.setBorder(Rectangle.NO_BORDER);
            tb.addCell(nc);
        }
        return tb;
    }

    private static PdfPCell cell(String text, Font f, Color bg) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setPadding(3);
        c.setBorderColor(new Color(203, 213, 225));
        if (bg != null) c.setBackgroundColor(bg);
        return c;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    static String fmt(Object v) {
        if (v == null) return "-";
        if (v instanceof Boolean) return ((Boolean) v) ? "예" : "아니오";
        if (v instanceof Double || v instanceof Float) {
            double d = ((Number) v).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) return "-";
            String s = String.format(Locale.ROOT, "%.4f", d);
            s = s.replaceAll("0+$", "").replaceAll("\\.$", "");
            return s;
        }
        String s = String.valueOf(v);
        return s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
