package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

// Asserts on the literal prompt text (package-private static fields on OpenAiService) rather
// than calling the real OpenAI API, so this never makes a network call. It only checks that
// the required instructions are present in the prompt text sent to the model; it cannot
// verify the model will actually follow them (see the written report for that caveat).
class OpenAiPromptContentTest {

    @Test
    void textPromptCoversAllRequiredRules() {
        String prompt = OpenAiService.TEXT_SYSTEM_PROMPT;

        assertTrue(prompt.contains("[INCOMPLETE_TEXT]"), "must document the incomplete-text marker");
        assertTrue(prompt.contains("ภาษาเดียวกับเอกสาร"), "must require answering in the document's language");
        assertTrue(prompt.contains("ห้ามแต่งข้อมูล"), "must forbid fabricating content");
        assertTrue(prompt.contains("ชื่อไฟล์"), "must forbid using the filename as information");
        assertTrue(prompt.contains("ห้ามตัดหัวข้อ"), "must forbid dropping numbered topics to save length");
        assertTrue(prompt.contains("ตรวจสอบตัวเอง"), "must instruct the model to self-check before answering");
        assertFalse(prompt.contains("ส่วนที่ผู้เรียนจด/เน้นไว้"), "the handwriting/highlight section is vision-only");
        assertTrue(prompt.contains("ห้ามคัดลอก"), "must forbid copying the original text verbatim");
        assertTrue(prompt.contains("2-3 ตัวอย่าง"), "must instruct picking only 2-3 representative examples");
        assertTrue(prompt.contains("ห้ามตั้งเลขหัวข้อใหม่"), "must forbid inventing new topic numbers");
        assertTrue(prompt.contains("เก็บนิยามและทฤษฎีบทให้ครบ"), "must require keeping all definitions and theorems");
        assertTrue(prompt.contains("ห้ามเปลี่ยนตัวละคร จำนวน สิ่งของ หรือเงื่อนไข"),
                "example problem statements must be copied verbatim, not altered");
        assertTrue(prompt.contains("[ตรวจกับต้นฉบับ]"),
                "text mode only: unsure spelling fixes must be flagged with this marker");
        assertTrue(prompt.contains("ห้ามเดาส่วนที่ขาดไปเอง"), "must skip examples that are only partially visible, not guess");
        assertTrue(prompt.contains("ห้ามย้ายไปไว้ใต้หัวข้ออื่น"), "examples must stay under their original topic heading");
        assertTrue(prompt.contains("กฎการคูณ (multiplication rule)"),
                "must require keeping the original English parenthetical for technical terms");
        assertTrue(prompt.contains("ห้ามสร้างหัวข้อ"), "must forbid inventing topics not present in the document");
        assertTrue(prompt.contains("ห้ามผสมความหมาย"),
                "each takeaway item must map to exactly one definition/theorem, not a blend of several");
    }

    @Test
    void visionPromptCoversAllRequiredRulesAndTheHighlightsSectionButNotTheMarker() {
        String prompt = OpenAiService.VISION_SYSTEM_PROMPT;

        assertFalse(prompt.contains("[INCOMPLETE_TEXT]"),
                "vision mode never had the incomplete-text marker contract; it must not be added");
        assertTrue(prompt.contains("ภาษาเดียวกับเอกสาร"), "must require answering in the document's language");
        assertTrue(prompt.contains("ห้ามแต่งข้อมูล"), "must forbid fabricating content");
        assertTrue(prompt.contains("ชื่อไฟล์"), "must forbid using the filename as information");
        assertTrue(prompt.contains("ห้ามตัดหัวข้อ"), "must forbid dropping numbered topics to save length");
        assertTrue(prompt.contains("ตรวจสอบตัวเอง"), "must instruct the model to self-check before answering");
        assertTrue(prompt.contains("ส่วนที่ผู้เรียนจด/เน้นไว้"), "vision mode must keep the handwriting/highlight section");
        assertTrue(prompt.contains("ให้บอกตรง ๆ ว่าส่วนนั้นอ่านไม่ออก"),
                "must keep the existing instruction to say plainly when part of the image can't be read");
        assertTrue(prompt.contains("ห้ามคัดลอก"), "must forbid copying the original text verbatim");
        assertTrue(prompt.contains("2-3 ตัวอย่าง"), "must instruct picking only 2-3 representative examples");
        assertTrue(prompt.contains("ห้ามตั้งเลขหัวข้อใหม่"), "must forbid inventing new topic numbers");
        assertTrue(prompt.contains("เก็บนิยามและทฤษฎีบทให้ครบ"), "must require keeping all definitions and theorems");
        assertTrue(prompt.contains("ห้ามเปลี่ยนตัวละคร จำนวน สิ่งของ หรือเงื่อนไข"),
                "example problem statements must be copied verbatim, not altered");
        assertTrue(prompt.contains("ห้ามเดาส่วนที่ขาดไปเอง"), "must skip examples that are only partially visible, not guess");
        assertTrue(prompt.contains("ห้ามย้ายไปไว้ใต้หัวข้ออื่น"), "examples must stay under their original topic heading");
        assertTrue(prompt.contains("กฎการคูณ (multiplication rule)"),
                "must require keeping the original English parenthetical for technical terms");
        assertTrue(prompt.contains("ห้ามสร้างหัวข้อ"), "must forbid inventing topics not present in the image");
        assertTrue(prompt.contains("ห้ามผสมความหมาย"),
                "each takeaway item must map to exactly one definition/theorem, not a blend of several");
    }
}
