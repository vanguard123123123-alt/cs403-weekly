package com.example.backend.exception;

public class OpenAiException extends RuntimeException {

    public OpenAiException(String message, Throwable cause) {
        super(message, cause);
    }
}
