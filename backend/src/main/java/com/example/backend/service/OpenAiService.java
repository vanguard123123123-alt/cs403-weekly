package com.example.backend.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.example.backend.exception.OpenAiException;

@Service
public class OpenAiService {

    private static final String CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
    private static final String SYSTEM_PROMPT =
            "You are a helpful assistant that writes clear, concise summaries of the text the user provides.";

    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    public OpenAiService(
            @Value("${openai.api.key}") String apiKey,
            @Value("${openai.api.model:gpt-4o-mini}") String model) {
        this.apiKey = apiKey;
        this.model = model;
        this.restClient = RestClient.create();
    }

    public String summarize(String text) {
        ChatCompletionRequest request = new ChatCompletionRequest(
                model,
                List.of(
                        new ChatMessage("system", SYSTEM_PROMPT),
                        new ChatMessage("user", text)));

        try {
            ChatCompletionResponse response = restClient.post()
                    .uri(CHAT_COMPLETIONS_URL)
                    .header("Authorization", "Bearer " + apiKey)
                    .body(request)
                    .retrieve()
                    .body(ChatCompletionResponse.class);

            if (response == null || response.choices() == null || response.choices().isEmpty()) {
                throw new OpenAiException("OpenAI returned no summary", null);
            }

            return response.choices().get(0).message().content();
        } catch (RestClientException ex) {
            throw new OpenAiException("Failed to call OpenAI API", ex);
        }
    }

    private record ChatCompletionRequest(String model, List<ChatMessage> messages) {
    }

    private record ChatMessage(String role, String content) {
    }

    private record ChatCompletionResponse(List<Choice> choices) {
    }

    private record Choice(ChatMessage message) {
    }
}
