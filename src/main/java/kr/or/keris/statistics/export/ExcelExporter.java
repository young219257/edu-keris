package kr.or.keris.statistics.export;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** Report → .xlsx (요약 시트 + 표마다 시트 1개). POI 3.17 (Java 7 호환) */
public final class ExcelExporter {
    private ExcelExporter() { }

    private static final int MAX_CELL = 32000;

    public static byte[] write(Report report) throws IOException {
        XSSFWorkbook wb = new XSSFWorkbook();
        try {
            Font bold = wb.createFont();
            bold.setBold(true);
            Font title = wb.createFont();
            title.setBold(true);
            title.setFontHeightInPoints((short) 14);

            CellStyle titleStyle = wb.createCellStyle();
            titleStyle.setFont(title);
            CellStyle sectionStyle = wb.createCellStyle();
            sectionStyle.setFont(bold);
            sectionStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            sectionStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            CellStyle head = wb.createCellStyle();
            head.setFont(bold);
            head.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            head.setBorderBottom(BorderStyle.THIN);
            head.setAlignment(HorizontalAlignment.CENTER);
            CellStyle labelStyle = wb.createCellStyle();
            labelStyle.setFont(bold);
            CellStyle intStyle = wb.createCellStyle();
            intStyle.setDataFormat(wb.createDataFormat().getFormat("#,##0"));
            CellStyle dblStyle = wb.createCellStyle();
            dblStyle.setDataFormat(wb.createDataFormat().getFormat("#,##0.0000"));

            Set<String> used = new HashSet<String>();
            Sheet summary = wb.createSheet(unique("요약", used));
            int r = 0;
            Row t = summary.createRow(r++);
            cell(t, 0, report.title, titleStyle, intStyle, dblStyle);
            if (report.subtitle != null) cell(summary.createRow(r++), 0, report.subtitle, null, intStyle, dblStyle);
            r++;

            int[] widths = {24, 60};
            for (Report.Section s : report.sections) {
                boolean hasContent = !s.kv.isEmpty() || !s.tables.isEmpty();
                if (!hasContent) continue;
                Row h = summary.createRow(r++);
                cell(h, 0, s.title, sectionStyle, intStyle, dblStyle);
                cell(h, 1, null, sectionStyle, intStyle, dblStyle);
                for (Object[] kv : s.kv) {
                    Row row = summary.createRow(r++);
                    cell(row, 0, kv[0], labelStyle, intStyle, dblStyle);
                    cell(row, 1, kv[1], null, intStyle, dblStyle);
                }
                for (Report.Table tb : s.tables) {
                    Row row = summary.createRow(r++);
                    cell(row, 0, "▶ 표: " + tb.title, null, intStyle, dblStyle);
                    cell(row, 1, "별도 시트 참조 (" + tb.rows.size() + "행)", null, intStyle, dblStyle);
                }
                r++;
            }
            summary.setColumnWidth(0, widths[0] * 256);
            summary.setColumnWidth(1, widths[1] * 256);

            for (Report.Section s : report.sections) {
                for (Report.Table tb : s.tables) {
                    Sheet sh = wb.createSheet(unique(tb.title, used));
                    Row hr = sh.createRow(0);
                    int[] w = new int[tb.headers.size()];
                    for (int c = 0; c < tb.headers.size(); c++) {
                        cell(hr, c, tb.headers.get(c), head, intStyle, dblStyle);
                        w[c] = Math.max(8, len(tb.headers.get(c)) + 2);
                    }
                    int rn = 1;
                    for (List<Object> rowData : tb.rows) {
                        Row row = sh.createRow(rn++);
                        for (int c = 0; c < rowData.size(); c++) {
                            cell(row, c, rowData.get(c), null, intStyle, dblStyle);
                            if (c < w.length) w[c] = Math.min(60, Math.max(w[c], len(rowData.get(c)) + 2));
                        }
                    }
                    for (int c = 0; c < w.length; c++) sh.setColumnWidth(c, w[c] * 256);
                    sh.createFreezePane(0, 1);
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        } finally {
            wb.close();
        }
    }

    private static int len(Object v) {
        if (v == null) return 1;
        String s = String.valueOf(v);
        int n = 0;
        for (int i = 0; i < s.length(); i++) n += s.charAt(i) > 0x2E80 ? 2 : 1;   // 한글은 2배 폭
        return Math.min(n, 60);
    }

    private static void cell(Row row, int col, Object v, CellStyle style, CellStyle intStyle, CellStyle dblStyle) {
        Cell c = row.createCell(col);
        if (v == null) {
            c.setCellValue("");
        } else if (v instanceof Long || v instanceof Integer) {
            c.setCellValue(((Number) v).doubleValue());
            c.setCellStyle(style != null ? style : intStyle);
            return;
        } else if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) c.setCellValue("");
            else c.setCellValue(d);
            c.setCellStyle(style != null ? style : dblStyle);
            return;
        } else if (v instanceof Boolean) {
            c.setCellValue((Boolean) v);
        } else {
            String s = String.valueOf(v);
            c.setCellValue(s.length() > MAX_CELL ? s.substring(0, MAX_CELL) : s);
        }
        if (style != null) c.setCellStyle(style);
    }

    /** 시트 이름: 31자 이내, 금지문자 치환, 중복 시 번호 부여 */
    private static String unique(String name, Set<String> used) {
        String base = (name == null || name.trim().isEmpty() ? "시트" : name).replaceAll("[\\\\/?*\\[\\]:]", "_").trim();
        if (base.length() > 28) base = base.substring(0, 28);
        String n = base;
        int i = 2;
        while (used.contains(n.toLowerCase())) n = base + "_" + (i++);
        used.add(n.toLowerCase());
        return n;
    }
}
