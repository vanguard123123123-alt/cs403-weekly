package com.example.backend.dto;

// weekStart is the Monday the week begins on (Asia/Bangkok), formatted yyyy-MM-dd.
public record WeeklyActivityItem(String weekStart, long count) {
}
