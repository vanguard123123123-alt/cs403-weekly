package com.example.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.Document;

public interface DocumentRepository extends JpaRepository<Document, Integer> {
}
