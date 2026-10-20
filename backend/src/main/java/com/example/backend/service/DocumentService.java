package com.example.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.backend.dto.DocumentResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.User;
import com.example.backend.exception.DocumentNotFoundException;
import com.example.backend.exception.FileStorageException;
import com.example.backend.exception.ForbiddenException;
import com.example.backend.exception.InvalidFileTypeException;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;

@Service
public class DocumentService {

    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "application/pdf", "pdf",
            "text/plain", "txt",
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/gif", "gif",
            "image/webp", "webp");

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "txt", "jpg", "jpeg", "png", "gif", "webp");

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final Path uploadDir;

    public DocumentService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            @Value("${file.upload-dir}") String uploadDir) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();

        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException ex) {
            throw new FileStorageException("Could not create upload directory", ex);
        }
    }

    public DocumentResponse upload(MultipartFile file, String title, User user) {
        if (file.isEmpty()) {
            throw new InvalidFileTypeException("File must not be empty");
        }

        String extension = extractExtension(file.getOriginalFilename());
        String contentType = file.getContentType();

        if (!ALLOWED_EXTENSIONS.contains(extension) || !ALLOWED_TYPES.containsKey(contentType)) {
            throw new InvalidFileTypeException("Only PDF, TXT and image files (jpg, png, gif, webp) are allowed");
        }

        String storedFileName = UUID.randomUUID() + "." + extension;
        Path targetPath = uploadDir.resolve(storedFileName);

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new FileStorageException("Failed to store file", ex);
        }

        String resolvedTitle = (title == null || title.isBlank())
                ? file.getOriginalFilename()
                : title;

        Document document = new Document(
                user,
                resolvedTitle,
                "uploads/" + storedFileName,
                extension,
                LocalDateTime.now());

        return DocumentResponse.fromEntity(documentRepository.save(document));
    }

    @Transactional
    public void deleteDocument(Integer documentId, User currentUser) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        if (!document.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("You do not have access to this document");
        }

        summaryRepository.deleteAll(summaryRepository.findByDocument(document));
        documentRepository.delete(document);

        try {
            Files.deleteIfExists(Path.of(document.getFilePath()));
        } catch (IOException ex) {
            throw new FileStorageException("Failed to delete file: " + document.getFilePath(), ex);
        }
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null || !originalFilename.contains(".")) {
            throw new InvalidFileTypeException("File must have an extension");
        }

        String extension = originalFilename.substring(originalFilename.lastIndexOf('.') + 1);
        return extension.toLowerCase(Locale.ROOT);
    }
}
