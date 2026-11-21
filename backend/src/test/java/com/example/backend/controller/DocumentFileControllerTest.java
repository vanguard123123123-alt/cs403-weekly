package com.example.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.example.backend.entity.Document;
import com.example.backend.entity.User;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.security.JwtService;
import com.example.backend.service.DocumentService;
import com.example.backend.service.UploadPathResolver;

// Exercises GET /api/documents/{id}/file over real HTTP (MockMvc, with the real
// security filter chain) since the "no token -> 401" case can only be observed there.
// Files are written only under the already-configured upload directory with a unique
// name and removed by that exact name afterwards; documents are removed through
// DocumentService.deleteDocument, the same path DELETE /api/documents/{id} uses.
@SpringBootTest
@AutoConfigureMockMvc
class DocumentFileControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DocumentRepository documentRepository;
    @Autowired
    private DocumentService documentService;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private UploadPathResolver uploadPathResolver;

    private final List<Document> createdDocuments = new ArrayList<>();
    private final List<User> createdUsers = new ArrayList<>();
    private final List<Path> createdFiles = new ArrayList<>();

    @AfterEach
    void cleanUp() throws IOException {
        for (Document document : createdDocuments) {
            try {
                documentService.deleteDocument(document.getDocumentId(), document.getUser());
            } catch (RuntimeException ignored) {
                // already removed by the test itself (e.g. the "document not found" case)
            }
        }
        for (Path file : createdFiles) {
            Files.deleteIfExists(file);
        }
        for (User user : createdUsers) {
            userRepository.deleteById(user.getUserId());
        }
    }

    @Test
    void ownFileReturns200WithPdfContentType() throws Exception {
        User owner = createUser("file-endpoint-owner-pdf-");
        Path file = writeRealFile("%PDF-1.4 fake content for a file-serving test, not a real PDF");
        Document document = createDocument(owner, "pdf", file.getFileName().toString());

        mockMvc.perform(get("/api/documents/{id}/file", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline"));
    }

    @Test
    void otherUsersFileReturns403() throws Exception {
        User owner = createUser("file-endpoint-owner2-");
        User otherUser = createUser("file-endpoint-other-");
        Path file = writeRealFile("secret");
        Document document = createDocument(owner, "txt", file.getFileName().toString());

        mockMvc.perform(get("/api/documents/{id}/file", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(otherUser)))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonExistentDocumentReturns404() throws Exception {
        User owner = createUser("file-endpoint-missingdoc-");
        Document throwaway = createDocument(owner, "txt", "does-not-matter.txt");
        Integer missingId = throwaway.getDocumentId();
        documentService.deleteDocument(missingId, owner);

        mockMvc.perform(get("/api/documents/{id}/file", missingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void fileMissingFromDiskReturns404WithoutLeakingPath() throws Exception {
        User owner = createUser("file-endpoint-nofile-");
        Document document = createDocument(owner, "txt", "never-written-" + UUID.randomUUID() + ".txt");

        mockMvc.perform(get("/api/documents/{id}/file", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Original file not found"));
    }

    @Test
    void missingTokenReturns401() throws Exception {
        User owner = createUser("file-endpoint-notoken-");
        Path file = writeRealFile("hello");
        Document document = createDocument(owner, "txt", file.getFileName().toString());

        mockMvc.perform(get("/api/documents/{id}/file", document.getDocumentId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void thaiTxtContentIsReturnedByteForByteCorrect() throws Exception {
        User owner = createUser("file-endpoint-thai-");
        String thaiContent = "สวัสดีครับ นี่คือไฟล์ทดสอบภาษาไทย ๆ ฿๑๒๓";
        Path file = writeRealFile(thaiContent);
        Document document = createDocument(owner, "txt", file.getFileName().toString());

        MvcResult result = mockMvc.perform(get("/api/documents/{id}/file", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(new MediaType("text", "plain", StandardCharsets.UTF_8)))
                .andReturn();

        String body = new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        assertEquals(thaiContent, body);
    }

    @Test
    void unsupportedFileTypeReturns415() throws Exception {
        User owner = createUser("file-endpoint-unsupported-");
        Document document = createDocument(owner, "jpg", "whatever-" + UUID.randomUUID() + ".jpg");

        mockMvc.perform(get("/api/documents/{id}/file", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isUnsupportedMediaType());
    }

    private User createUser(String emailPrefix) {
        User user = userRepository.save(
                new User("File Endpoint Test", emailPrefix + UUID.randomUUID() + "@example.com", "not-a-real-hash", "user"));
        createdUsers.add(user);
        return user;
    }

    private String tokenFor(User user) {
        return jwtService.generateToken(user.getUserId(), user.getEmail(), user.getRole());
    }

    private Document createDocument(User owner, String fileType, String storedFileName) {
        Document document = new Document(
                owner, "File endpoint test " + UUID.randomUUID(), storedFileName, fileType, LocalDateTime.now());
        document = documentRepository.save(document);
        createdDocuments.add(document);
        return document;
    }

    private Path writeRealFile(String content) throws IOException {
        String fileName = "file-endpoint-test-" + UUID.randomUUID() + ".txt";
        Path path = uploadPathResolver.getUploadDir().resolve(fileName);
        Files.writeString(path, content, StandardCharsets.UTF_8);
        createdFiles.add(path);
        return path;
    }
}
