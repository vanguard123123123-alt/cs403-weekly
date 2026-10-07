package com.example.backend.service;

import java.io.IOException;
import java.nio.file.Path;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import com.example.backend.exception.PdfExtractionException;

@Service
public class PdfTextExtractionService {

    public String extractText(Path pdfPath) {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (IOException ex) {
            throw new PdfExtractionException("Failed to extract text from PDF: " + pdfPath, ex);
        }
    }
}
