package com.example.backend.dto;

public class SummarizeRequest {

    private Integer startPage;
    private Integer endPage;
    private String mode;
    private Integer replaceSummaryId;

    public Integer getStartPage() {
        return startPage;
    }

    public void setStartPage(Integer startPage) {
        this.startPage = startPage;
    }

    public Integer getEndPage() {
        return endPage;
    }

    public void setEndPage(Integer endPage) {
        this.endPage = endPage;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Integer getReplaceSummaryId() {
        return replaceSummaryId;
    }

    public void setReplaceSummaryId(Integer replaceSummaryId) {
        this.replaceSummaryId = replaceSummaryId;
    }
}
