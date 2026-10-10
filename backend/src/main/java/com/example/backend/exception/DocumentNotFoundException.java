package com.example.backend.exception;

public class DocumentNotFoundException extends RuntimeException {

    public DocumentNotFoundException(Integer documentId) {
        super("Document not found: id=" + documentId);
    }
}
