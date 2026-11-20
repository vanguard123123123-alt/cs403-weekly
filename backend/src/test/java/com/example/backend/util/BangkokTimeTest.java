package com.example.backend.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class BangkokTimeTest {

    @Test
    void mondayOfReturnsSameDateWhenAlreadyMonday() {
        LocalDate monday = LocalDate.of(2026, 11, 16);
        assertEquals(monday, BangkokTime.mondayOf(monday));
    }

    @Test
    void mondayOfRollsBackToStartOfWeek() {
        LocalDate sunday = LocalDate.of(2026, 11, 22);
        assertEquals(LocalDate.of(2026, 11, 16), BangkokTime.mondayOf(sunday));
    }
}
