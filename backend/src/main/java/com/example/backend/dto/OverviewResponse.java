package com.example.backend.dto;

public class OverviewResponse {

    private final String overviewMarkdown;

    public OverviewResponse(String overviewMarkdown) {
        this.overviewMarkdown = overviewMarkdown;
    }

    public String getOverviewMarkdown() {
        return overviewMarkdown;
    }
}
