package com.example.backend.dto;

import java.util.List;

public class OverviewRequest {

    private List<Integer> summaryIds;

    public List<Integer> getSummaryIds() {
        return summaryIds;
    }

    public void setSummaryIds(List<Integer> summaryIds) {
        this.summaryIds = summaryIds;
    }
}
