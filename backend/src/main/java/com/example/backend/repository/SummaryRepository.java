package com.example.backend.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;

public interface SummaryRepository extends JpaRepository<Summary, Integer> {

    List<Summary> findByDocument(Document document);

    long countByDocument_UserAndCreatedAtGreaterThanEqual(User user, LocalDateTime since);
}
