package com.example.backend.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
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
    public String extractText(Path pdfPath, Integer startPage, Integer endPage) {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            if (startPage != null) {
                stripper.setStartPage(startPage);
            }
            if (endPage != null) {
                stripper.setEndPage(endPage);
            }
            return stripper.getText(document);
        } catch (IOException ex) {
            log.error("Failed to extract text from PDF: {}", pdfPath, ex);
            throw new TextExtractionException(
                    "Failed to extract text from PDF: " + pdfPath
                            + " (cause: " + ex.getClass().getSimpleName() + ": " + ex.getMessage() + ")",
                    ex);
        }
    }

    public int countPages(Path pdfPath) {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            return document.getNumberOfPages();
        } catch (IOException ex) {
            log.error("Failed to count pages in PDF: {}", pdfPath, ex);
            throw new TextExtractionException(
                    "Failed to count pages in PDF: " + pdfPath
                            + " (cause: " + ex.getClass().getSimpleName() + ": " + ex.getMessage() + ")",
                    ex);
        }
    }

    /**
     * Renders pages [startPage, endPage] (1-based, inclusive) to in-memory JPEG bytes.
     * Nothing is written to disk.
     */
    public List<byte[]> renderPagesAsJpeg(Path pdfPath, int startPage, int endPage, float dpi) {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            PDFRenderer renderer = new PDFRenderer(document);
            List<byte[]> images = new ArrayList<>();

            for (int pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
                BufferedImage image = renderer.renderImageWithDPI(pageNumber - 1, dpi);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ImageIO.write(image, "jpg", out);
                images.add(out.toByteArray());
            }

            return images;
        } catch (IOException ex) {
            log.error("Failed to render PDF pages to images: {}", pdfPath, ex);
            throw new TextExtractionException(
                    "Failed to render PDF pages to images: " + pdfPath
                            + " (cause: " + ex.getClass().getSimpleName() + ": " + ex.getMessage() + ")",
                    ex);
        }
    }
}
