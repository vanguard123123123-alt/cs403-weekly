package com.example.backend.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.example.backend.entity.UsageLog;
import com.example.backend.repository.UsageLogRepository;
import com.example.backend.util.BangkokTime;

@Service
public class UsageLogService {

    private final UsageLogRepository usageLogRepository;

    public UsageLogService(UsageLogRepository usageLogRepository) {
        this.usageLogRepository = usageLogRepository;
    }

    // REQUIRES_NEW on its own bean (never called as a self-invocation) so this commits
    // immediately in its own transaction, independent of whatever the caller does next.
    // The usage row must still exist even if the caller's later OpenAI call fails.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordUsage(Integer userId, String kind) {
        usageLogRepository.save(new UsageLog(userId, kind, LocalDateTime.now()));
    }

    // createdAt is stored via LocalDateTime.now(), so this boundary is only correct if
    // the server's default JVM time zone is also Asia/Bangkok (see BangkokTime).
    public long countToday(Integer userId, String kind) {
        return usageLogRepository.countByUserIdAndKindAndCreatedAtGreaterThanEqual(
                userId, kind, BangkokTime.startOfToday());
    }
}
