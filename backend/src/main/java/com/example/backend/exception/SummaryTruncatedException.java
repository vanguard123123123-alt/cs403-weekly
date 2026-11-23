package com.example.backend.exception;

// Thrown when OpenAI's response was cut off before it finished (finish_reason="length",
// i.e. it hit the max_tokens cap mid-generation) rather than a genuine failure to call the
// API at all. Deliberately not 422: SummarizeForm.tsx on the frontend shows the "switch to
// vision mode" shortcut for every 422 response, which would be misleading here since this
// has nothing to do with the text being unreadable.
public class SummaryTruncatedException extends RuntimeException {

    public SummaryTruncatedException() {
        super("The AI's response was cut off before it finished (hit the output length limit). "
                + "Try summarizing a smaller page range, or try again.");
    }
}
