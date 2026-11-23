package com.example.backend.exception;

public class OverviewDailyLimitExceededException extends RuntimeException {

    public OverviewDailyLimitExceededException(int dailyLimit) {
        super("Daily overview limit reached (" + dailyLimit
                + " per day). Please try again after midnight (Asia/Bangkok time).");
    }
}
