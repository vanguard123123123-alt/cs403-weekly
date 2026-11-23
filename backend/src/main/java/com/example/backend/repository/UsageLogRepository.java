package com.example.backend.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.UsageLog;

public interface UsageLogRepository extends JpaRepository<UsageLog, Integer> {

    long countByUserIdAndKindAndCreatedAtGreaterThanEqual(Integer userId, String kind, LocalDateTime since);
}
