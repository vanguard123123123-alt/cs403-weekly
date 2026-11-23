import { describe, expect, it } from "vitest";
import { translateBackendMessage } from "./errorMessage";

describe("translateBackendMessage", () => {
    it("translates the daily summary limit message and keeps the number", () => {
        expect(
            translateBackendMessage(
                "Daily summary limit reached (10 per day). Please try again after midnight (Asia/Bangkok time)."
            )
        ).toBe("ใช้โควต้าสรุปของวันนี้ครบแล้ว (สูงสุด 10 ครั้งต่อวัน) ลองใหม่ได้หลังเที่ยงคืน (เวลาไทย)");
    });

    it("translates the daily vision summary limit message", () => {
        expect(
            translateBackendMessage(
                "Daily vision summary limit reached (10 per day). Please try again after midnight (Asia/Bangkok time)."
            )
        ).toBe("ใช้โควต้าสรุปแบบอ่านภาพของวันนี้ครบแล้ว (สูงสุด 10 ครั้งต่อวัน) ลองใหม่ได้หลังเที่ยงคืน (เวลาไทย)");
    });

    it("translates the daily overview limit message", () => {
        expect(
            translateBackendMessage(
                "Daily overview limit reached (5 per day). Please try again after midnight (Asia/Bangkok time)."
            )
        ).toBe("ใช้โควต้าภาพรวมของวันนี้ครบแล้ว (สูงสุด 5 ครั้งต่อวัน) ลองใหม่ได้หลังเที่ยงคืน (เวลาไทย)");
    });

    it("translates the incomplete text message", () => {
        expect(
            translateBackendMessage("Could not read this document's text properly. Try the 'อ่านแบบภาพ' (vision) option.")
        ).toBe("ไม่สามารถอ่านข้อความจากเอกสารนี้ได้อย่างสมบูรณ์ ลองใช้โหมด 'อ่านแบบภาพ' แทน");
    });

    it("translates the vision mode page-limit message and keeps both numbers", () => {
        expect(
            translateBackendMessage(
                "Requested range covers 20 pages, which exceeds the vision mode limit of 8 pages per request"
            )
        ).toBe("ช่วงหน้าที่เลือกมี 20 หน้า เกินเพดานโหมดอ่านแบบภาพ (สูงสุด 8 หน้าต่อครั้ง) ลองแบ่งเป็นหลายช่วง หรือลองโหมดข้อความ");
    });

    it("translates the text mode page-limit message and keeps both numbers", () => {
        expect(
            translateBackendMessage("Requested range covers 30 pages, which exceeds the limit of 25 pages per request")
        ).toBe("ช่วงหน้าที่เลือกมี 30 หน้า เกินเพดานต่อคำขอ (สูงสุด 25 หน้าต่อครั้ง) ลองแบ่งเป็นหลายช่วง");
    });

    it("translates the invalid mode message", () => {
        expect(translateBackendMessage("mode must be either 'text' or 'vision'")).toBe(
            "ค่าของ mode ต้องเป็น 'text' หรือ 'vision' เท่านั้น"
        );
    });

    it("translates the page-ranges-pdf-only message", () => {
        expect(translateBackendMessage("Page ranges are only supported for PDF documents")).toBe(
            "การเลือกช่วงหน้าใช้ได้เฉพาะไฟล์ PDF เท่านั้น"
        );
    });

    it("translates the missing start/end page message", () => {
        expect(translateBackendMessage("Both startPage and endPage must be provided together")).toBe(
            "ต้องระบุทั้งหน้าเริ่มและหน้าจบพร้อมกัน"
        );
    });

    it("translates the out-of-range page message and keeps the page count", () => {
        expect(
            translateBackendMessage(
                "startPage and endPage must satisfy 1 <= startPage <= endPage <= 12 (this document has 12 pages)"
            )
        ).toBe("หน้าเริ่มและหน้าจบต้องอยู่ในช่วง 1 ถึง 12 (เอกสารนี้มี 12 หน้า)");
    });

    it("translates the vision-pdf-only message", () => {
        expect(translateBackendMessage("Vision mode is only supported for PDF documents")).toBe(
            "โหมดอ่านแบบภาพใช้ได้เฉพาะไฟล์ PDF เท่านั้น"
        );
    });

    it("translates the vision-requires-range message and keeps both numbers", () => {
        expect(
            translateBackendMessage(
                "Vision mode requires a page range for documents longer than 8 pages. This document has 15 pages; please specify startPage and endPage."
            )
        ).toBe("โหมดอ่านแบบภาพต้องระบุช่วงหน้าสำหรับเอกสารที่ยาวกว่า 8 หน้า (เอกสารนี้มี 15 หน้า) กรุณาระบุหน้าเริ่มและหน้าจบ");
    });

    it("translates the label-length message and keeps the max length", () => {
        expect(translateBackendMessage("name must be between 1 and 100 characters after trimming")).toBe(
            "ชื่อสรุปต้องมีความยาว 1 ถึง 100 ตัวอักษร (หลังตัดช่องว่างหัวท้าย)"
        );
    });

    it("translates the replace-target-mismatch message and keeps the id", () => {
        expect(translateBackendMessage("replaceSummaryId 7 does not belong to document 3")).toBe(
            "สรุปที่จะแทนที่ (id 7) ไม่ใช่ของเอกสารนี้"
        );
    });

    it("translates the empty-document message", () => {
        expect(translateBackendMessage("No extractable text was found in this document")).toBe(
            "ไม่พบข้อความที่สามารถดึงออกมาได้จากเอกสารนี้"
        );
    });

    it("translates the empty-file message", () => {
        expect(translateBackendMessage("File must not be empty")).toBe("ไฟล์ต้องไม่ว่างเปล่า");
    });

    it("translates the unsupported-file-type-on-upload message", () => {
        expect(
            translateBackendMessage("Only PDF, TXT and image files (jpg, png, gif, webp) are allowed")
        ).toBe("รองรับเฉพาะไฟล์ PDF, TXT และรูปภาพ (jpg, png, gif, webp) เท่านั้น");
    });

    it("translates the corrupted-pdf message", () => {
        expect(translateBackendMessage("Could not read this PDF. It may be corrupted or password-protected.")).toBe(
            "ไม่สามารถอ่านไฟล์ PDF นี้ได้ ไฟล์อาจเสียหายหรือมีรหัสผ่านป้องกันอยู่"
        );
    });

    it("translates the missing-extension message", () => {
        expect(translateBackendMessage("File must have an extension")).toBe("ไฟล์ต้องมีนามสกุลไฟล์");
    });

    it("translates the unsupported-summarize-file-type message and keeps the extension", () => {
        expect(translateBackendMessage("Summarizing .docx files is not supported yet")).toBe(
            "ยังไม่รองรับการสรุปไฟล์ประเภท .docx"
        );
    });

    it("translates the unservable-file-type message and keeps the type", () => {
        expect(translateBackendMessage("Cannot serve files of type: docx")).toBe(
            "ไม่รองรับการเปิดไฟล์ประเภทนี้: docx"
        );
    });

    it("translates the original-file-not-found message", () => {
        expect(translateBackendMessage("Original file not found")).toBe("ไม่พบไฟล์ต้นฉบับ");
    });

    it("translates the document-not-found message and keeps the id", () => {
        expect(translateBackendMessage("Document not found: id=42")).toBe("ไม่พบเอกสาร (id 42)");
    });

    it("translates the summary-not-found message and keeps the id", () => {
        expect(translateBackendMessage("Summary not found: id=7")).toBe("ไม่พบสรุป (id 7)");
    });

    it("translates the forbidden-document message", () => {
        expect(translateBackendMessage("You do not have access to this document")).toBe(
            "คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้"
        );
    });

    it("translates the invalid-credentials message", () => {
        expect(translateBackendMessage("Invalid email or password")).toBe("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    });

    it("translates the email-already-registered message and keeps the email", () => {
        expect(translateBackendMessage("Email already registered: a@b.com")).toBe(
            "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว: a@b.com"
        );
    });

    it("translates the file-too-large message", () => {
        expect(translateBackendMessage("File is too large")).toBe("ไฟล์มีขนาดใหญ่เกินไป");
    });

    it("translates the overview empty-selection message", () => {
        expect(translateBackendMessage("summaryIds must contain at least 1 item")).toBe(
            "ต้องเลือกสรุปอย่างน้อย 1 รายการ"
        );
    });

    it("translates the overview too-many-items message and keeps both numbers", () => {
        expect(translateBackendMessage("summaryIds contains 15 items, which exceeds the limit of 12")).toBe(
            "เลือกสรุป 15 รายการ ซึ่งเกินเพดาน 12 รายการ"
        );
    });

    it("translates the overview wrong-document message and keeps the id", () => {
        expect(translateBackendMessage("summaryId 9 does not belong to document 4")).toBe(
            "สรุป (id 9) ไม่ใช่ของเอกสารนี้"
        );
    });

    it("translates the overview too-long-content message and keeps both numbers", () => {
        expect(
            translateBackendMessage(
                "Combined content of the selected summaries is 40000 characters, which exceeds the limit of 30000 characters. Select fewer summaries."
            )
        ).toBe("เนื้อหารวมของสรุปที่เลือกมี 40000 ตัวอักษร ซึ่งเกินเพดาน 30000 ตัวอักษร ลองเลือกสรุปให้น้อยลง");
    });

    it("returns an unrecognized message unchanged", () => {
        expect(translateBackendMessage("Some brand new backend message nobody mapped yet")).toBe(
            "Some brand new backend message nobody mapped yet"
        );
    });
});
