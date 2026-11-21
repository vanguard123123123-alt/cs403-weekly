package com.example.backend.exception;

public class UnservableFileTypeException extends RuntimeException {

    public UnservableFileTypeException(String fileType) {
        super("Cannot serve files of type: " + fileType);
    }
}
