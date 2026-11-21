package com.example.backend.exception;

// Deliberately carries no path information in its message, so a 404 response
// never leaks where documents are stored on disk.
public class OriginalFileNotFoundException extends RuntimeException {

    public OriginalFileNotFoundException() {
        super("Original file not found");
    }
}
