package com.example.backend.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.Document;
import com.example.backend.entity.User;

public interface DocumentRepository extends JpaRepository<Document, Integer> {
    List<Document> findByUser(User user);
}
