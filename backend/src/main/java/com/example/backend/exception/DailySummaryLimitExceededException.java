package com.example.backend.exception;

public class DailySummaryLimitExceededException extends RuntimeException {

    public DailySummaryLimitExceededException(int dailyLimit) {
        super("Daily summary limit reached (" + dailyLimit
                + " per day). Please try again after midnight (Asia/Bangkok time).");
    }
}
