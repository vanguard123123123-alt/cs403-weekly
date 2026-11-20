package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.example.backend.dto.DashboardResponse;
import com.example.backend.dto.DocumentResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.repository.UserRepository;

// Seeds rows directly through the repositories (equivalent to raw SQL INSERTs; never calls
// OpenAiService) to verify the /api/documents and /api/dashboard statistics without a real
// PDF or network access. Every row created here is removed at the end of the test: documents
// through DocumentService.deleteDocument (the same path the DELETE endpoint uses), and the
// two throwaway users directly, since there is no user-delete endpoint.
@SpringBootTest
@TestPropertySource(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class DocumentAndDashboardStatsIntegrationTest {

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
    private EntityManagerFactory entityManagerFactory;

    private final List<Document> createdDocuments = new ArrayList<>();
    private final List<User> createdUsers = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (Document document : createdDocuments) {
            try {
                documentService.deleteDocument(document.getDocumentId(), document.getUser());
            } catch (RuntimeException ignored) {
                // already removed earlier in the test
            }
        }
        for (User user : createdUsers) {
            userRepository.deleteById(user.getUserId());
        }
    }

    @Test
    void documentAndDashboardStatsAreCorrectIsolatedAndFreeOfNPlusOne() {
        User owner = createUser("qa-stats-owner-" + UUID.randomUUID() + "@example.com");
        User otherUser = createUser("qa-stats-other-" + UUID.randomUUID() + "@example.com");

        // 1) PDF, one summary with no page range -> covers the whole file.
        Document wholeFileDoc = createDocument(owner, "pdf", 10);
        createSummary(wholeFileDoc, null, null);

        // 2) PDF, several overlapping/duplicate/adjacent ranges -> merge into [1,12].
        Document overlappingDoc = createDocument(owner, "pdf", 20);
        createSummary(overlappingDoc, 1, 5);
        createSummary(overlappingDoc, 1, 5); // duplicate
        createSummary(overlappingDoc, 3, 8); // partial overlap
        createSummary(overlappingDoc, 9, 12); // adjacent to [1,8]

        // 3) TXT document -> coveredPages must stay null even though it has a summary.
        Document txtDoc = createDocument(owner, "txt", null);
        createSummary(txtDoc, null, null);

        // 4) PDF with unknown page count -> coveredPages must stay null.
        Document unknownPageCountDoc = createDocument(owner, "pdf", null);
        createSummary(unknownPageCountDoc, 1, 2);

        // 5) Another user's own document+summary, to confirm no cross-user leakage.
        Document otherUsersDoc = createDocument(otherUser, "pdf", 5);
        createSummary(otherUsersDoc, null, null);

        List<DocumentResponse> documents = documentService.listForUser(owner);
        Map<Integer, DocumentResponse> byId = documents.stream()
                .collect(Collectors.toMap(DocumentResponse::getDocumentId, d -> d));

        assertEquals(4, documents.size(), "owner must only see their own 4 documents");
        assertTrue(documents.stream().noneMatch(d -> d.getDocumentId().equals(otherUsersDoc.getDocumentId())));

        DocumentResponse wholeFileResponse = byId.get(wholeFileDoc.getDocumentId());
        assertEquals(1, wholeFileResponse.getSummaryCount());
        assertEquals(10, wholeFileResponse.getCoveredPages());
        assertNotNull(wholeFileResponse.getLastSummaryAt());

        DocumentResponse overlappingResponse = byId.get(overlappingDoc.getDocumentId());
        assertEquals(4, overlappingResponse.getSummaryCount());
        assertEquals(12, overlappingResponse.getCoveredPages());

        DocumentResponse txtResponse = byId.get(txtDoc.getDocumentId());
        assertEquals(1, txtResponse.getSummaryCount());
        assertNull(txtResponse.getCoveredPages());

        DocumentResponse unknownPageCountResponse = byId.get(unknownPageCountDoc.getDocumentId());
        assertEquals(1, unknownPageCountResponse.getSummaryCount());
        assertNull(unknownPageCountResponse.getCoveredPages());

        // Cross-user isolation, checked from the other side too.
        List<DocumentResponse> otherUsersDocuments = documentService.listForUser(otherUser);
        assertEquals(1, otherUsersDocuments.size());
        assertEquals(otherUsersDoc.getDocumentId(), otherUsersDocuments.get(0).getDocumentId());

        DashboardResponse dashboard = dashboardService.getDashboard(owner);
        assertEquals(4, dashboard.getTotalDocuments());
        assertEquals(7, dashboard.getTotalSummaries());
        assertEquals(7, dashboard.getSummariesThisWeek(),
                "every seeded summary was created just now, inside the current week");
        assertEquals(4, dashboard.getDocuments().size());
        assertEquals(8, dashboard.getWeeklyActivity().size());
        assertEquals(7, dashboard.getWeeklyActivity().get(dashboard.getWeeklyActivity().size() - 1).count(),
                "the most recent week bucket must hold every summary created just now");

        DashboardResponse otherDashboard = dashboardService.getDashboard(otherUser);
        assertEquals(1, otherDashboard.getTotalDocuments());
        assertEquals(1, otherDashboard.getTotalSummaries());

        verifyQueryCountDoesNotGrowWithDocumentCount(owner);
    }

    // Confirms /api/documents and /api/dashboard issue the same number of SQL statements
    // regardless of how many documents/summaries the user has (no N+1).
    private void verifyQueryCountDoesNotGrowWithDocumentCount(User owner) {
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        Statistics statistics = sessionFactory.getStatistics();

        statistics.clear();
        documentService.listForUser(owner);
        long documentsQueryCount = statistics.getPrepareStatementCount();

        Document extraDocA = createDocument(owner, "pdf", 3);
        Document extraDocB = createDocument(owner, "pdf", 3);
        createSummary(extraDocB, 1, 2);

        statistics.clear();
        documentService.listForUser(owner);
        long documentsQueryCountAfterGrowth = statistics.getPrepareStatementCount();

        assertEquals(documentsQueryCount, documentsQueryCountAfterGrowth,
                "GET /api/documents must issue the same number of queries regardless of document count");

        statistics.clear();
        dashboardService.getDashboard(owner);
        long dashboardQueryCount = statistics.getPrepareStatementCount();

        Document extraDocC = createDocument(owner, "pdf", 3);
        createSummary(extraDocC, null, null);

        statistics.clear();
        dashboardService.getDashboard(owner);
        long dashboardQueryCountAfterGrowth = statistics.getPrepareStatementCount();

        assertEquals(dashboardQueryCount, dashboardQueryCountAfterGrowth,
                "GET /api/dashboard must issue the same number of queries regardless of document count");
    }

    private User createUser(String email) {
        User user = userRepository.save(new User("QA Stats Test", email, "not-a-real-hash", "user"));
        createdUsers.add(user);
        return user;
    }

    private Document createDocument(User owner, String fileType, Integer pageCount) {
        Document document = new Document(
                owner,
                "QA stats test doc " + UUID.randomUUID(),
                "qa-stats-test-" + UUID.randomUUID() + "." + fileType, // never actually written to disk
                fileType,
                LocalDateTime.now());
        document.setPageCount(pageCount);
        document = documentRepository.save(document);
        createdDocuments.add(document);
        return document;
    }

    private void createSummary(Document document, Integer startPage, Integer endPage) {
        summaryRepository.save(new Summary(
                document, document.getTitle(), "QA stats test content", LocalDateTime.now(),
                false, startPage, endPage, "text"));
    }
}
