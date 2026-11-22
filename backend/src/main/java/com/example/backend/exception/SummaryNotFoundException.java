package com.example.backend.exception;

public class SummaryNotFoundException extends RuntimeException {

    public SummaryNotFoundException(Integer summaryId) {
        super("Summary not found: id=" + summaryId);
    }
}
