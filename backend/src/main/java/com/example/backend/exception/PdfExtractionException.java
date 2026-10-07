package com.example.backend.exception;

public class PdfExtractionException extends RuntimeException {

    public PdfExtractionException(String message, Throwable cause) {
        super(message, cause);
    }
}
