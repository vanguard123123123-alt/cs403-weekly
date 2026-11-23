package com.example.backend.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

// Generic per-user usage counter for quotas that aren't tied to the summaries table
// (e.g. the /overview daily limit). Deliberately has no foreign key to users — userId
// is a plain column, per the feature's requirements — so this table can be queried/
// cleaned up independently of the users table.
@Entity
@Table(
        name = "usage_log",
        indexes = @Index(name = "idx_usage_log_user_kind_created_at", columnList = "user_id, kind, created_at"))
public class UsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "kind", nullable = false, length = 50)
    private String kind;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public UsageLog() {
    }

    public UsageLog(Integer userId, String kind, LocalDateTime createdAt) {
        this.userId = userId;
        this.kind = kind;
        this.createdAt = createdAt;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
