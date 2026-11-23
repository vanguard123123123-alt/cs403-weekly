package com.example.backend.dto;

import java.util.List;

public class OverviewResponse {

    private final String overviewMarkdown;
    private final List<String> practiceTopics;

    public OverviewResponse(String overviewMarkdown, List<String> practiceTopics) {
        this.overviewMarkdown = overviewMarkdown;
        this.practiceTopics = practiceTopics;
    }

    public String getOverviewMarkdown() {
        return overviewMarkdown;
    }

    public List<String> getPracticeTopics() {
        return practiceTopics;
    }
}
