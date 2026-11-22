package com.example.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.example.backend.dto.DashboardResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.security.JwtService;
import com.example.backend.service.DashboardService;
import com.example.backend.service.DocumentService;

// Exercises PATCH/DELETE /api/summaries/{id} over real HTTP (MockMvc, real security filter
// chain). Every document/summary row here is seeded directly through the repositories
// (never through POST /summarize) so this never calls the real OpenAI API, and no file is ever
// written under the uploads folder (filePath values below are never actually read from disk).
// Cleanup removes documents through DocumentService.deleteDocument (same path as the DELETE
// endpoint; it also cascades any remaining summaries) and removes the throwaway users directly.
@SpringBootTest
@AutoConfigureMockMvc
class SummaryControllerTest {

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DocumentRepository documentRepository;
    @Autowired
    private SummaryRepository summaryRepository;
    @Autowired
    private DocumentService documentService;
    @Autowired
    private DashboardService dashboardService;
    @Autowired
    private JwtService jwtService;

    private final List<Document> createdDocuments = new ArrayList<>();
    private final List<User> createdUsers = new ArrayList<>();

    @AfterEach
    void cleanUp() {
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
    void renameWithValidNameTrimsAndPersists() throws Exception {
        User owner = createUser("summary-rename-ok-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, null, null);

        mockMvc.perform(patch("/api/summaries/{id}", summary.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"  My renamed round  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summaryLabel").value("My renamed round"))
                .andExpect(jsonPath("$.summaryId").value(summary.getSummaryId()));
    }

    @Test
    void renameWithBlankNameReturns400() throws Exception {
        User owner = createUser("summary-rename-blank-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, null, null);

        mockMvc.perform(patch("/api/summaries/{id}", summary.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void renameWithNameLongerThan100CharactersReturns400() throws Exception {
        User owner = createUser("summary-rename-long-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, null, null);
        String tooLong = "a".repeat(101); // contains no characters that need JSON escaping

        mockMvc.perform(patch("/api/summaries/{id}", summary.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + tooLong + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void renameByNonOwnerReturns403() throws Exception {
        User owner = createUser("summary-rename-owner-");
        User otherUser = createUser("summary-rename-other-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, null, null);

        mockMvc.perform(patch("/api/summaries/{id}", summary.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(otherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"hijacked\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void renameNonExistentSummaryReturns404() throws Exception {
        User owner = createUser("summary-rename-missing-");

        mockMvc.perform(patch("/api/summaries/{id}", 2_000_000_000)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"whatever\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteByOwnerReturns204AndUpdatesStatsEverywhere() throws Exception {
        User owner = createUser("summary-delete-ok-");
        Document document = createDocument(owner, "pdf", 10);
        Summary keep = createSummary(document, 1, 5);
        Summary toDelete = createSummary(document, 6, 10);

        mockMvc.perform(delete("/api/summaries/{id}", toDelete.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isNoContent());

        // GET /api/documents/{id}/summaries must only list the remaining round, with its
        // summaryLabel intact.
        MvcResult result = mockMvc.perform(get("/api/documents/{id}/summaries", document.getDocumentId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].summaryId").value(keep.getSummaryId()))
                .andExpect(jsonPath("$[0].summaryLabel").value(keep.getSummaryLabel()))
                .andReturn();
        assertTrue(result.getResponse().getContentAsString().contains(keep.getSummaryLabel()));

        // Dashboard-level aggregates must reflect the deletion too (same underlying queries
        // GET /api/dashboard uses), since nothing here is cached.
        DashboardResponse dashboard = dashboardService.getDashboard(owner);
        var documentItem = dashboard.getDocuments().stream()
                .filter(d -> d.documentId().equals(document.getDocumentId()))
                .findFirst()
                .orElseThrow();
        assertEquals(1, documentItem.summaryCount());
        assertEquals(5, documentItem.coveredPages(), "only pages 1-5 remain covered after deleting 6-10");
        // Compared at second precision: the DB column rounds sub-second precision on
        // round-trip, so the in-memory value from save() can differ by a few microseconds
        // from what a fresh query returns.
        assertEquals(
                keep.getCreatedAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS),
                documentItem.firstSummaryAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
        assertEquals(
                keep.getCreatedAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS),
                documentItem.lastSummaryAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
    }

    @Test
    void deleteByNonOwnerReturns403AndLeavesSummaryIntact() throws Exception {
        User owner = createUser("summary-delete-owner-");
        User otherUser = createUser("summary-delete-other-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, null, null);

        mockMvc.perform(delete("/api/summaries/{id}", summary.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(otherUser)))
                .andExpect(status().isForbidden());

        assertTrue(summaryRepository.findById(summary.getSummaryId()).isPresent());
    }

    @Test
    void deleteNonExistentSummaryReturns404() throws Exception {
        User owner = createUser("summary-delete-missing-");

        mockMvc.perform(delete("/api/summaries/{id}", 2_000_000_000)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteWithoutTokenReturns401() throws Exception {
        User owner = createUser("summary-delete-notoken-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, null, null);

        mockMvc.perform(delete("/api/summaries/{id}", summary.getSummaryId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void lastSummaryDeletedLeavesCoveredPagesAndDatesNull() throws Exception {
        User owner = createUser("summary-delete-last-");
        Document document = createDocument(owner, "pdf", 10);
        Summary summary = createSummary(document, 1, 10);

        mockMvc.perform(delete("/api/summaries/{id}", summary.getSummaryId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isNoContent());

        DashboardResponse dashboard = dashboardService.getDashboard(owner);
        var documentItem = dashboard.getDocuments().stream()
                .filter(d -> d.documentId().equals(document.getDocumentId()))
                .findFirst()
                .orElseThrow();
        assertEquals(0, documentItem.summaryCount());
        // DocumentStatsCalculator.coveredPages returns 0 (not null) for a known-page-count PDF
        // with zero summaries; null is reserved for "coverage can't be computed" (unknown page
        // count or a non-paginated file type), which no longer applies once summaryCount is 0.
        assertEquals(0, documentItem.coveredPages());
        assertNull(documentItem.firstSummaryAt());
        assertNull(documentItem.lastSummaryAt());
        assertFalse(summaryRepository.findById(summary.getSummaryId()).isPresent());
    }

    private User createUser(String emailPrefix) {
        User user = userRepository.save(
                new User("Summary Test", emailPrefix + UUID.randomUUID() + "@example.com", "not-a-real-hash", "user"));
        createdUsers.add(user);
        return user;
    }

    private String tokenFor(User user) {
        return jwtService.generateToken(user.getUserId(), user.getEmail(), user.getRole());
    }

    private Document createDocument(User owner, String fileType, Integer pageCount) {
        Document document = new Document(
                owner,
                "Summary endpoint test doc " + UUID.randomUUID(),
                "summary-endpoint-test-" + UUID.randomUUID() + "." + fileType, // never written to disk
                fileType,
                LocalDateTime.now());
        document.setPageCount(pageCount);
        document = documentRepository.save(document);
        createdDocuments.add(document);
        return document;
    }

    private Summary createSummary(Document document, Integer startPage, Integer endPage) {
        return summaryRepository.save(new Summary(
                document, document.getTitle() + " · test round", "Summary endpoint test content",
                LocalDateTime.now(), false, startPage, endPage, "text"));
    }
}
