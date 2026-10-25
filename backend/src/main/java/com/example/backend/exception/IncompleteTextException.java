package com.example.backend.exception;

public class IncompleteTextException extends RuntimeException {

    public IncompleteTextException() {
        super("Could not read this document's text properly. Try the 'อ่านแบบภาพ' (vision) option.");
    }
}
