package com.example.backend.service;

import java.io.IOException;
import java.nio.file.Path;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.example.backend.exception.TextExtractionException;

@Service
public class PdfTextExtractionService implements TextExtractor {

    private static final Logger log = LoggerFactory.getLogger(PdfTextExtractionService.class);

    @Override
    public boolean supports(String fileType) {
        return "pdf".equalsIgnoreCase(fileType);
    }

    @Override
    public String extractText(Path pdfPath) {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (IOException ex) {
            log.error("Failed to extract text from PDF: {}", pdfPath, ex);
            throw new TextExtractionException(
                    "Failed to extract text from PDF: " + pdfPath
                            + " (cause: " + ex.getClass().getSimpleName() + ": " + ex.getMessage() + ")",
                    ex);
        }
    }
}
