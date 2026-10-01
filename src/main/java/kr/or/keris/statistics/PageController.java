package kr.or.keris.statistics;

import javax.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * JSP 화면 컨트롤러. 모든 데이터는 화면(JS)이 /api/v1/** 를 직접 호출해서 가져오므로
 * 서버는 뷰 이름과 하위 경로(basePath)만 전달한다.
 */
@Controller
public class PageController {

    @RequestMapping({"/", "/dashboard", "/analysis", "/analysis/"})
    public String root() {
        return "forward:/analysis/step1";
    }

    @RequestMapping("/analysis/step1")
    public String step1(HttpServletRequest request, Model model) {
        return page(request, model, "import", "", "1단계 데이터 반입", "step1_import");
    }

    @RequestMapping("/analysis/step2")
    public String step2(HttpServletRequest request, Model model) {
        return page(request, model, "preprocess", "", "2단계 품질 및 전처리", "step2_quality");
    }

    @RequestMapping("/analysis/step3")
    public String step3(HttpServletRequest request, Model model) {
        return page(request, model, "eda", "", "3단계 데이터 탐색(EDA)", "step3_eda");
    }

    @RequestMapping("/analysis/step4")
    public String step4(HttpServletRequest request, Model model) {
        return page(request, model, "modeling", "run", "4단계 통계 모델링", "step4_modeling");
    }

    @RequestMapping({"/analysis/step4/report", "/analysis/step4-2"})
    public String step4Report(HttpServletRequest request, Model model) {
        return page(request, model, "modeling", "report", "4단계 분석 결과 상세 리포트", "step4_report");
    }

    @RequestMapping("/analysis/step5")
    public String step5(HttpServletRequest request, Model model) {
        return page(request, model, "packaging", "", "5단계 결과 관리", "step5_packaging");
    }

    private String page(HttpServletRequest request, Model model, String step, String sub, String title, String view) {
        // 리버스 프록시가 붙이는 하위 경로: 헤더(X-Forwarded-Prefix) 우선, 없으면 APP_BASE_PATH
        String forwarded = request.getHeader("X-Forwarded-Prefix");
        String prefix = Config.normalizePath(forwarded != null && !forwarded.trim().isEmpty()
                ? forwarded : Config.basePath());
        model.addAttribute("ctx", request.getContextPath() + prefix);
        model.addAttribute("activeStep", step);
        model.addAttribute("subTab", sub);
        model.addAttribute("pageTitle", title);
        return view;
    }
}
