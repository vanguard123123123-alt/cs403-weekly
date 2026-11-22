package com.example.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.dto.RenameSummaryRequest;
import com.example.backend.dto.SummaryResponse;
import com.example.backend.entity.User;
import com.example.backend.exception.InvalidCredentialsException;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.SummaryService;

@RestController
@RequestMapping("/api/summaries")
public class SummaryController {

    private final SummaryService summaryService;
    private final UserRepository userRepository;

    public SummaryController(SummaryService summaryService, UserRepository userRepository) {
        this.summaryService = summaryService;
        this.userRepository = userRepository;
    }

    @PatchMapping("/{id}")
    public ResponseEntity<SummaryResponse> rename(
            @PathVariable Integer id,
            @RequestBody RenameSummaryRequest request,
            Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(InvalidCredentialsException::new);

        String name = request != null ? request.getName() : null;
        return ResponseEntity.ok(summaryService.renameSummary(id, user, name));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(InvalidCredentialsException::new);

        summaryService.deleteSummary(id, user);
        return ResponseEntity.noContent().build();
    }
}
