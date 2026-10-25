package com.example.backend.exception;

public class InvalidPageRangeException extends RuntimeException {

    public InvalidPageRangeException(String message) {
        super(message);
    }
}
