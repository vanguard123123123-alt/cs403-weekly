package com.example.backend.dto;

import java.time.LocalDateTime;

import com.example.backend.entity.Document;

public class DocumentResponse {

    private Integer documentId;
    private Integer userId;
    private String title;
    private String filePath;
    private String fileType;
    private LocalDateTime uploadDate;
    private Integer pageCount;

    public DocumentResponse(
            Integer documentId,
            Integer userId,
            String title,
            String filePath,
            String fileType,
            LocalDateTime uploadDate,
            Integer pageCount) {
        this.documentId = documentId;
        this.userId = userId;
        this.title = title;
        this.filePath = filePath;
        this.fileType = fileType;
        this.uploadDate = uploadDate;
        this.pageCount = pageCount;
    }

    public static DocumentResponse fromEntity(Document document) {
        return new DocumentResponse(
                document.getDocumentId(),
                document.getUser().getUserId(),
                document.getTitle(),
                document.getFilePath(),
                document.getFileType(),
                document.getUploadDate(),
                document.getPageCount());
    }

    public Integer getDocumentId() {
        return documentId;
    }

    public Integer getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getFilePath() {
        return filePath;
    }

    public String getFileType() {
        return fileType;
    }

    public LocalDateTime getUploadDate() {
        return uploadDate;
    }

    public Integer getPageCount() {
        return pageCount;
    }
}
