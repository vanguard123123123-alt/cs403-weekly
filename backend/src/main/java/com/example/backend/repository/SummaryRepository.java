package com.example.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.Summary;

import com.example.backend.entity.Document;
import java.util.List;

public interface SummaryRepository extends JpaRepository<Summary, Integer> {
    List<Summary> findByDocument(Document document);
}
