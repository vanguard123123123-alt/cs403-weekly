package com.example.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.example.backend.exception.FileStorageException;

@Component
public class UploadPathResolver {

    // Documents created before file.upload-dir became independently configurable
    // were always written relative to the JVM's working directory, under a
    // directory literally named "uploads" — not necessarily the same place
    // file.upload-dir points to now. Resolve those rows the same way the old
    // code always did (relative to the working directory), regardless of how
    // file.upload-dir is configured today.
    private static final String LEGACY_PREFIX = "uploads/";

    private final Path uploadDir;

    public UploadPathResolver(@Value("${file.upload-dir}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();

        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException ex) {
            throw new FileStorageException("Could not create upload directory", ex);
        }
    }

    public Path getUploadDir() {
        return uploadDir;
    }

    public Path resolve(String storedFilePath) {
        Path path = Path.of(storedFilePath);
        if (path.isAbsolute()) {
            return path;
        }

        if (storedFilePath.startsWith(LEGACY_PREFIX)) {
            return path.toAbsolutePath().normalize();
        }

        return uploadDir.resolve(storedFilePath);
    }
}
