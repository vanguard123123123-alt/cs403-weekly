package com.example.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.UsageLog;
import com.example.backend.entity.User;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.repository.UsageLogRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.security.JwtService;
import com.example.backend.service.DocumentService;

// Exercises POST /api/documents/{id}/overview over real HTTP (MockMvc, real security filter
// chain), but only the rejection paths that never reach OpenAiService (400/403/404/429 and
// unauthenticated 401) — every document/summary/usage_log row here is seeded directly through
// the repositories, never through an endpoint that would call the real OpenAI API. The
// OpenAI-calling (happy-path / JSON-parsing / quota-then-usage-row) scenarios are covered by
// the pure-Mockito OverviewServiceTest instead, which mocks OpenAiService directly.
@SpringBootTest
@AutoConfigureMockMvc
class OverviewControllerTest {

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DocumentRepository documentRepository;
    @Autowired
    private SummaryRepository summaryRepository;
    @Autowired
    private UsageLogRepository usageLogRepository;
    @Autowired
    private DocumentService documentService;
    @Autowired
    private JwtService jwtService;

    private final List<Document> createdDocuments = new ArrayList<>();
    private final List<User> createdUsers = new ArrayList<>();
    private final List<Integer> createdUsageLogIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (Integer id : createdUsageLogIds) {
            usageLogRepository.deleteById(id);
        }
        for (Document document : createdDocuments) {
            try {
                documentService.deleteDocument(document.getDocumentId(), document.getUser());
            } catch (RuntimeException ignored) {
                // already removed by the test itself
            }
        }
        for (User user : createdUsers) {
            userRepository.deleteById(user.getUserId());
        }
    }

    @Test
    void summaryFromAnotherDocumentIsRejectedWith400() throws Exception {
        User owner = createUser("overview-wrongdoc-");
        Document document = createDocument(owner);
        Document otherDocument = createDocument(owner);
        Summary summaryOnOtherDocument = createSummary(otherDocument);

        mockMvc.perform(post("/api/documents/{id}/overview", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(summaryIdsBody(List.of(summaryOnOtherDocument.getSummaryId()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void summaryBelongingToAnotherUserIsForbiddenWith403() throws Exception {
        User owner = createUser("overview-owner-");
        User otherUser = createUser("overview-other-");
        Document ownerDocument = createDocument(owner);
        Document othersDocument = createDocument(otherUser);
        Summary summaryOnOthersDocument = createSummary(othersDocument);

        mockMvc.perform(post("/api/documents/{id}/overview", ownerDocument.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(summaryIdsBody(List.of(summaryOnOthersDocument.getSummaryId()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonExistentSummaryIdIsNotFound() throws Exception {
        User owner = createUser("overview-missing-");
        Document document = createDocument(owner);

        mockMvc.perform(post("/api/documents/{id}/overview", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(summaryIdsBody(List.of(2_000_000_000))))
                .andExpect(status().isNotFound());
    }

    @Test
    void moreThanTwelveSummaryIdsIsRejectedWith400() throws Exception {
        User owner = createUser("overview-toomany-");
        Document document = createDocument(owner);
        List<Integer> thirteenIds = IntStream.rangeClosed(1, 13).boxed().toList();

        mockMvc.perform(post("/api/documents/{id}/overview", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(summaryIdsBody(thirteenIds)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exceedingDailyQuotaIsRejectedWith429() throws Exception {
        User owner = createUser("overview-quota-");
        Document document = createDocument(owner);
        Summary summary = createSummary(document);

        // Default summary.overview-daily-limit is 5; seed exactly that many usage rows for
        // today so the next request is the one that goes over.
        for (int i = 0; i < 5; i++) {
            UsageLog row = usageLogRepository.save(new UsageLog(owner.getUserId(), "overview", LocalDateTime.now()));
            createdUsageLogIds.add(row.getId());
        }

        mockMvc.perform(post("/api/documents/{id}/overview", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(summaryIdsBody(List.of(summary.getSummaryId()))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void withoutTokenReturns401() throws Exception {
        User owner = createUser("overview-notoken-");
        Document document = createDocument(owner);

        mockMvc.perform(post("/api/documents/{id}/overview", document.getDocumentId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(summaryIdsBody(List.of(1))))
                .andExpect(status().isUnauthorized());
    }

    private String summaryIdsBody(List<Integer> ids) {
        String joined = ids.stream().map(String::valueOf).collect(Collectors.joining(","));
        return "{\"summaryIds\": [" + joined + "]}";
    }

    private User createUser(String emailPrefix) {
        User user = userRepository.save(
                new User("Overview Test", emailPrefix + UUID.randomUUID() + "@example.com", "not-a-real-hash", "user"));
        createdUsers.add(user);
        return user;
    }

    private String tokenFor(User user) {
        return jwtService.generateToken(user.getUserId(), user.getEmail(), user.getRole());
    }

    private Document createDocument(User owner) {
        Document document = new Document(
                owner,
                "Overview test doc " + UUID.randomUUID(),
                "overview-test-" + UUID.randomUUID() + ".pdf", // never written to disk
                "pdf",
                LocalDateTime.now());
        document.setPageCount(10);
        document = documentRepository.save(document);
        createdDocuments.add(document);
        return document;
    }

    private Summary createSummary(Document document) {
        return summaryRepository.save(new Summary(
                document, document.getTitle() + " · test round", "Overview test content",
                LocalDateTime.now(), false, null, null, "text"));
    }
}
