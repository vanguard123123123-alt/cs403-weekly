package com.example.backend.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.backend.dto.RecentSummaryItem;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;

public interface SummaryRepository extends JpaRepository<Summary, Integer> {

    List<Summary> findByDocument(Document document);

    // Excludes vision-mode summaries so the general (text) daily limit and the
    // vision-specific daily limit are fully independent quotas, as intended.
    @Query("SELECT COUNT(s) FROM Summary s WHERE s.document.user = :user AND s.createdAt >= :since "
            + "AND (s.mode IS NULL OR s.mode <> 'vision')")
    long countByDocument_UserAndCreatedAtGreaterThanEqual(@Param("user") User user, @Param("since") LocalDateTime since);

    long countByDocument_UserAndModeAndCreatedAtGreaterThanEqual(User user, String mode, LocalDateTime since);

    long countByDocument_User(User user);

    @Query("SELECT new com.example.backend.dto.RecentSummaryItem("
            + "s.summaryId, s.document.documentId, s.summaryLabel, s.createdAt, s.contentSum) "
            + "FROM Summary s WHERE s.document.user = :user ORDER BY s.createdAt DESC")
    List<RecentSummaryItem> findRecentByUser(@Param("user") User user, Pageable pageable);
}
