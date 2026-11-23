package com.example.backend.exception;

public class InvalidOverviewRequestException extends RuntimeException {

    public InvalidOverviewRequestException(String message) {
        super(message);
    }
}
