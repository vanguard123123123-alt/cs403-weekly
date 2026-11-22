package com.example.backend.exception;

public class InvalidSummaryLabelException extends RuntimeException {

    public InvalidSummaryLabelException(String message) {
        super(message);
    }
}
