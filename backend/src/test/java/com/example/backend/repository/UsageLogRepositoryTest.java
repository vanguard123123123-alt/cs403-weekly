package com.example.backend.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.example.backend.entity.UsageLog;
import com.example.backend.util.BangkokTime;

// Verifies the exact day-boundary semantics the overview daily quota relies on: a row from
// 23:59 "yesterday" (Asia/Bangkok) must NOT count toward today's total, while a row from 00:01
// "today" must. Seeds real rows through the repository against the real database (never
// through OpenAI or any endpoint) and removes them again afterward. usage_id has no foreign
// key to users, so a sentinel user id far outside the real range is used and never touches
// the users table.
@SpringBootTest
class UsageLogRepositoryTest {

    private static final Integer SENTINEL_USER_ID = -987_654;
    private static final String KIND = "overview";

    @Autowired
    private UsageLogRepository usageLogRepository;

    @AfterEach
    void cleanUp() {
        usageLogRepository.findAll().stream()
                .filter(row -> SENTINEL_USER_ID.equals(row.getUserId()))
                .forEach(row -> usageLogRepository.deleteById(row.getId()));
    }

    @Test
    void rowFromBeforeMidnightIsExcludedAndRowFromAfterMidnightIsIncluded() {
        var startOfToday = BangkokTime.startOfToday();

        UsageLog yesterdayAt2359 = usageLogRepository.save(
                new UsageLog(SENTINEL_USER_ID, KIND, startOfToday.minusMinutes(1)));
        UsageLog todayAt0001 = usageLogRepository.save(
                new UsageLog(SENTINEL_USER_ID, KIND, startOfToday.plusMinutes(1)));

        long countToday = usageLogRepository.countByUserIdAndKindAndCreatedAtGreaterThanEqual(
                SENTINEL_USER_ID, KIND, startOfToday);

        assertEquals(1, countToday, "only the 00:01-today row should count, not the 23:59-yesterday row");

        // Sanity check that both rows were actually persisted distinctly (i.e. the assertion
        // above isn't vacuously true because nothing was saved).
        assertEquals(2, usageLogRepository.findAllById(
                java.util.List.of(yesterdayAt2359.getId(), todayAt0001.getId())).size());
    }
}
