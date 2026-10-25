package com.example.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final String PDF_FILE_TYPE = "pdf";

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
    private final UploadPathResolver uploadPathResolver;
    private final PdfTextExtractionService pdfTextExtractionService;

    public DocumentService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            UploadPathResolver uploadPathResolver,
            PdfTextExtractionService pdfTextExtractionService) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.uploadPathResolver = uploadPathResolver;
        this.pdfTextExtractionService = pdfTextExtractionService;
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
        Path targetPath = uploadPathResolver.getUploadDir().resolve(storedFileName);

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
                storedFileName,
                extension,
                LocalDateTime.now());

        if (PDF_FILE_TYPE.equals(extension)) {
            try {
                document.setPageCount(pdfTextExtractionService.countPages(targetPath));
            } catch (RuntimeException ex) {
                log.warn("Rejecting upload: could not read PDF {}: {}", targetPath, ex.getMessage());

                try {
                    Files.deleteIfExists(targetPath);
                } catch (IOException deleteEx) {
                    log.warn("Failed to remove rejected PDF {}: {}", targetPath, deleteEx.getMessage());
                }

                throw new InvalidFileTypeException(
                        "Could not read this PDF. It may be corrupted or password-protected.");
            }
        }

        return DocumentResponse.fromEntity(documentRepository.save(document));
    }

    public List<DocumentResponse> listForUser(User user) {
        return documentRepository.findByUser(user)
                .stream()
                .map(this::ensurePageCount)
                .map(DocumentResponse::fromEntity)
                .toList();
    }

    public Document ensurePageCount(Document document) {
        if (document.getPageCount() != null || !PDF_FILE_TYPE.equalsIgnoreCase(document.getFileType())) {
            return document;
        }

        try {
            int pageCount = pdfTextExtractionService.countPages(uploadPathResolver.resolve(document.getFilePath()));
            document.setPageCount(pageCount);
            return documentRepository.save(document);
        } catch (RuntimeException ex) {
            log.warn(
                    "Could not count pages for document {} ({}): {}",
                    document.getDocumentId(), document.getFilePath(), ex.getMessage());
            return document;
        }
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
            Files.deleteIfExists(uploadPathResolver.resolve(document.getFilePath()));
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
