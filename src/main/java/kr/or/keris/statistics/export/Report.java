package kr.or.keris.statistics.export;

import java.util.ArrayList;
import java.util.List;

/** PDF / Excel 공통 문서 모델 (섹션 = 키-값 목록 + 표 + 이미지) */
public class Report {
    public String title;
    public String subtitle;
    public final List<Section> sections = new ArrayList<Section>();

    public Section section(String title) {
        Section s = new Section(title);
        sections.add(s);
        return s;
    }

    public static class Section {
        public final String title;
        public final List<Object[]> kv = new ArrayList<Object[]>();      // {라벨, 값}
        public final List<Table> tables = new ArrayList<Table>();
        public final List<Img> images = new ArrayList<Img>();            // PDF 전용

        Section(String title) {
            this.title = title;
        }

        public Section put(String label, Object value) {
            kv.add(new Object[]{label, value});
            return this;
        }
    }

    public static class Table {
        public final String title;
        public final List<String> headers = new ArrayList<String>();
        public final List<List<Object>> rows = new ArrayList<List<Object>>();
        /** true 면 Excel 에만 넣는다 (차트 원본 데이터·원시데이터처럼 PDF 에는 너무 큰 표) */
        public boolean excelOnly;

        public Table(String title) {
            this.title = title;
        }
    }

    public static class Img {
        public final String title;
        public final byte[] png;

        public Img(String title, byte[] png) {
            this.title = title;
            this.png = png;
        }
    }
}
