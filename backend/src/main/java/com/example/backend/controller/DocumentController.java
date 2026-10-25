package com.example.backend.controller;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.backend.dto.DocumentResponse;
import com.example.backend.dto.SummarizeRequest;
import com.example.backend.dto.SummaryResponse;
import com.example.backend.entity.User;
import com.example.backend.exception.InvalidCredentialsException;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.DocumentService;
import com.example.backend.service.SummaryService;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final SummaryService summaryService;
    private final UserRepository userRepository;

    public DocumentController(
            DocumentService documentService,
            SummaryService summaryService,
            UserRepository userRepository) {
        this.documentService = documentService;
        this.summaryService = summaryService;
        this.userRepository = userRepository;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            Authentication authentication) {

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(InvalidCredentialsException::new);

        DocumentResponse response = documentService.upload(file, title, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    @GetMapping
    public ResponseEntity<List<DocumentResponse>> list(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(InvalidCredentialsException::new);

        return ResponseEntity.ok(documentService.listForUser(user));
    }

    @PostMapping("/{id}/summarize")
    public ResponseEntity<SummaryResponse> summarize(
            @PathVariable Integer id,
            @RequestBody(required = false) SummarizeRequest request,
            Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(InvalidCredentialsException::new);

        SummaryResponse response = summaryService.summarizeDocument(id, user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    @GetMapping("/{id}/summaries")
public ResponseEntity<List<SummaryResponse>> getSummaries(@PathVariable Integer id, Authentication authentication) {
    User user = userRepository.findByEmail(authentication.getName())
            .orElseThrow(InvalidCredentialsException::new);

    return ResponseEntity.ok(summaryService.getSummariesByDocument(id, user));
}

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(InvalidCredentialsException::new);

        documentService.deleteDocument(id, user);
        return ResponseEntity.noContent().build();
    }
}
