package com.example.backend.service;

import java.nio.file.Path;

public interface TextExtractor {

    boolean supports(String fileType);

    String extractText(Path path);
}
