package com.example.backend.util;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

public final class BangkokTime {

    private static final ZoneId ZONE = ZoneId.of("Asia/Bangkok");

    private BangkokTime() {
    }

    // createdAt is stored via LocalDateTime.now(), so comparisons against this value
    // are only correct if the server's default JVM time zone is also Asia/Bangkok.
    public static LocalDateTime startOfToday() {
        return LocalDate.now(ZONE).atStartOfDay();
    }
}
