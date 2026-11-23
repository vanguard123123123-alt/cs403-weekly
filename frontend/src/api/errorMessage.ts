import axios from "axios";

// Builds a RegExp that matches `template` literally, except that each "{n}"
// placeholder becomes a capturing group for one or more digits.
function template(strWithPlaceholders: string): RegExp {
    const escaped = strWithPlaceholders.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withGroups = escaped.replace(/\\\{n\\\}/g, "(\\d+)");
    return new RegExp(`^${withGroups}$`);
}

interface TranslationRule {
    pattern: RegExp;
    translate: (match: RegExpMatchArray) => string;
}

// Every pattern below is copied verbatim from an actual backend exception message
// (see backend/.../exception/*Exception.java and GlobalExceptionHandler.java), not
// guessed — each has a comment pointing at its source. Numbers embedded in a
// message (page counts, limits, ids) are captured via {n} and re-inserted into the
// Thai text. A message that matches no rule is returned unchanged by
// translateBackendMessage, so getErrorMessage's old behavior is preserved exactly
// for anything not covered here.
const TRANSLATION_RULES: TranslationRule[] = [
    // DailySummaryLimitExceededException(dailyLimit) — SummaryService.java:335
    {
        pattern: template(
            "Daily summary limit reached ({n} per day). Please try again after midnight (Asia/Bangkok time)."
        ),
        translate: (m) => `ใช้โควต้าสรุปของวันนี้ครบแล้ว (สูงสุด ${m[1]} ครั้งต่อวัน) ลองใหม่ได้หลังเที่ยงคืน (เวลาไทย)`,
    },
    // DailySummaryLimitExceededException(visionDailyLimit, "vision") — SummaryService.java:344
    {
        pattern: template(
            "Daily vision summary limit reached ({n} per day). Please try again after midnight (Asia/Bangkok time)."
        ),
        translate: (m) =>
            `ใช้โควต้าสรุปแบบอ่านภาพของวันนี้ครบแล้ว (สูงสุด ${m[1]} ครั้งต่อวัน) ลองใหม่ได้หลังเที่ยงคืน (เวลาไทย)`,
    },
    // OverviewDailyLimitExceededException(dailyLimit) — not currently reachable via
    // getErrorMessage (Dashboard's AI overview card detects 429 by status and never
    // reads this message), kept for completeness/future reuse.
    {
        pattern: template(
            "Daily overview limit reached ({n} per day). Please try again after midnight (Asia/Bangkok time)."
        ),
        translate: (m) => `ใช้โควต้าภาพรวมของวันนี้ครบแล้ว (สูงสุด ${m[1]} ครั้งต่อวัน) ลองใหม่ได้หลังเที่ยงคืน (เวลาไทย)`,
    },
    // IncompleteTextException() — SummaryService.java:135
    {
        pattern: template("Could not read this document's text properly. Try the 'อ่านแบบภาพ' (vision) option."),
        translate: () => "ไม่สามารถอ่านข้อความจากเอกสารนี้ได้อย่างสมบูรณ์ ลองใช้โหมด 'อ่านแบบภาพ' แทน",
    },
    // InvalidPageRangeException — SummaryService.java:321 (vision mode page limit)
    {
        pattern: template(
            "Requested range covers {n} pages, which exceeds the vision mode limit of {n} pages per request"
        ),
        translate: (m) =>
            `ช่วงหน้าที่เลือกมี ${m[1]} หน้า เกินเพดานโหมดอ่านแบบภาพ (สูงสุด ${m[2]} หน้าต่อครั้ง) ลองแบ่งเป็นหลายช่วง หรือลองโหมดข้อความ`,
    },
    // InvalidPageRangeException — SummaryService.java:282 (text mode page limit)
    {
        pattern: template("Requested range covers {n} pages, which exceeds the limit of {n} pages per request"),
        translate: (m) =>
            `ช่วงหน้าที่เลือกมี ${m[1]} หน้า เกินเพดานต่อคำขอ (สูงสุด ${m[2]} หน้าต่อครั้ง) ลองแบ่งเป็นหลายช่วง`,
    },
    // InvalidPageRangeException — SummaryService.java:256
    {
        pattern: template("mode must be either 'text' or 'vision'"),
        translate: () => "ค่าของ mode ต้องเป็น 'text' หรือ 'vision' เท่านั้น",
    },
    // InvalidPageRangeException — SummaryService.java:264
    {
        pattern: template("Page ranges are only supported for PDF documents"),
        translate: () => "การเลือกช่วงหน้าใช้ได้เฉพาะไฟล์ PDF เท่านั้น",
    },
    // InvalidPageRangeException — SummaryService.java:268 / 310
    {
        pattern: template("Both startPage and endPage must be provided together"),
        translate: () => "ต้องระบุทั้งหน้าเริ่มและหน้าจบพร้อมกัน",
    },
    // InvalidPageRangeException — SummaryService.java:275 / 314
    {
        pattern: template(
            "startPage and endPage must satisfy 1 <= startPage <= endPage <= {n} (this document has {n} pages)"
        ),
        translate: (m) => `หน้าเริ่มและหน้าจบต้องอยู่ในช่วง 1 ถึง ${m[1]} (เอกสารนี้มี ${m[2]} หน้า)`,
    },
    // InvalidPageRangeException — SummaryService.java:292
    {
        pattern: template("Vision mode is only supported for PDF documents"),
        translate: () => "โหมดอ่านแบบภาพใช้ได้เฉพาะไฟล์ PDF เท่านั้น",
    },
    // InvalidPageRangeException — SummaryService.java:301
    {
        pattern: template(
            "Vision mode requires a page range for documents longer than {n} pages. This document has {n} pages; please specify startPage and endPage."
        ),
        translate: (m) =>
            `โหมดอ่านแบบภาพต้องระบุช่วงหน้าสำหรับเอกสารที่ยาวกว่า ${m[1]} หน้า (เอกสารนี้มี ${m[2]} หน้า) กรุณาระบุหน้าเริ่มและหน้าจบ`,
    },
    // InvalidSummaryLabelException — SummaryService.java:183
    {
        pattern: template("name must be between 1 and {n} characters after trimming"),
        translate: (m) => `ชื่อสรุปต้องมีความยาว 1 ถึง ${m[1]} ตัวอักษร (หลังตัดช่องว่างหัวท้าย)`,
    },
    // InvalidSummaryReplaceException — SummaryService.java:206
    {
        pattern: template("replaceSummaryId {n} does not belong to document {n}"),
        translate: (m) => `สรุปที่จะแทนที่ (id ${m[1]}) ไม่ใช่ของเอกสารนี้`,
    },
    // EmptyDocumentException — SummaryService.java:110
    {
        pattern: template("No extractable text was found in this document"),
        translate: () => "ไม่พบข้อความที่สามารถดึงออกมาได้จากเอกสารนี้",
    },
    // InvalidFileTypeException — DocumentService.java:81
    {
        pattern: template("File must not be empty"),
        translate: () => "ไฟล์ต้องไม่ว่างเปล่า",
    },
    // InvalidFileTypeException — DocumentService.java:88
    {
        pattern: template("Only PDF, TXT and image files (jpg, png, gif, webp) are allowed"),
        translate: () => "รองรับเฉพาะไฟล์ PDF, TXT และรูปภาพ (jpg, png, gif, webp) เท่านั้น",
    },
    // InvalidFileTypeException — DocumentService.java:123
    {
        pattern: template("Could not read this PDF. It may be corrupted or password-protected."),
        translate: () => "ไม่สามารถอ่านไฟล์ PDF นี้ได้ ไฟล์อาจเสียหายหรือมีรหัสผ่านป้องกันอยู่",
    },
    // InvalidFileTypeException — DocumentService.java:207
    {
        pattern: template("File must have an extension"),
        translate: () => "ไฟล์ต้องมีนามสกุลไฟล์",
    },
    // InvalidFileTypeException — SummaryService.java:352
    {
        pattern: /^Summarizing \.(\w+) files is not supported yet$/,
        translate: (m) => `ยังไม่รองรับการสรุปไฟล์ประเภท .${m[1]}`,
    },
    // UnservableFileTypeException — DocumentService.java:180
    {
        pattern: /^Cannot serve files of type: (.+)$/,
        translate: (m) => `ไม่รองรับการเปิดไฟล์ประเภทนี้: ${m[1]}`,
    },
    // OriginalFileNotFoundException — OriginalFileNotFoundException.java
    {
        pattern: template("Original file not found"),
        translate: () => "ไม่พบไฟล์ต้นฉบับ",
    },
    // DocumentNotFoundException — DocumentService.java:166
    {
        pattern: template("Document not found: id={n}"),
        translate: (m) => `ไม่พบเอกสาร (id ${m[1]})`,
    },
    // SummaryNotFoundException — SummaryService.java:171
    {
        pattern: template("Summary not found: id={n}"),
        translate: (m) => `ไม่พบสรุป (id ${m[1]})`,
    },
    // ForbiddenException — DocumentService.java:169
    {
        pattern: template("You do not have access to this document"),
        translate: () => "คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้",
    },
    // InvalidCredentialsException — AuthService.java
    {
        pattern: template("Invalid email or password"),
        translate: () => "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    },
    // EmailAlreadyExistsException — AuthService.java:33
    {
        pattern: /^Email already registered: (.+)$/,
        translate: (m) => `อีเมลนี้ถูกใช้ลงทะเบียนแล้ว: ${m[1]}`,
    },
    // MaxUploadSizeExceededException — GlobalExceptionHandler.java:83 (hardcoded, not from an exception message)
    {
        pattern: template("File is too large"),
        translate: () => "ไฟล์มีขนาดใหญ่เกินไป",
    },
    // InvalidOverviewRequestException — OverviewService.java:123. Not currently
    // reachable via getErrorMessage (Dashboard's AI overview card shows its own
    // hardcoded 400 message without reading this one), kept for completeness.
    {
        pattern: template("summaryIds must contain at least 1 item"),
        translate: () => "ต้องเลือกสรุปอย่างน้อย 1 รายการ",
    },
    // InvalidOverviewRequestException — OverviewService.java:126
    {
        pattern: template("summaryIds contains {n} items, which exceeds the limit of {n}"),
        translate: (m) => `เลือกสรุป ${m[1]} รายการ ซึ่งเกินเพดาน ${m[2]} รายการ`,
    },
    // InvalidOverviewRequestException — OverviewService.java:136
    {
        pattern: template("summaryId {n} does not belong to document {n}"),
        translate: (m) => `สรุป (id ${m[1]}) ไม่ใช่ของเอกสารนี้`,
    },
    // InvalidOverviewRequestException — OverviewService.java:144
    {
        pattern: template(
            "Combined content of the selected summaries is {n} characters, which exceeds the limit of {n} characters. Select fewer summaries."
        ),
        translate: (m) =>
            `เนื้อหารวมของสรุปที่เลือกมี ${m[1]} ตัวอักษร ซึ่งเกินเพดาน ${m[2]} ตัวอักษร ลองเลือกสรุปให้น้อยลง`,
    },
];

// Maps a known English backend error message to Thai. Numbers inside the original
// message (page counts, limits, ids) are carried over into the translated text.
// A message that isn't recognized is returned unchanged.
export function translateBackendMessage(message: string): string {
    for (const rule of TRANSLATION_RULES) {
        const match = message.match(rule.pattern);
        if (match) {
            return rule.translate(match);
        }
    }
    return message;
}

export function getErrorMessage(error: unknown, genericMessage: string): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const serverMessage: string | undefined = error.response?.data?.message;

        if (status !== undefined && status < 500 && serverMessage) {
            return translateBackendMessage(serverMessage);
        }
    }
    return genericMessage;
}

export function getErrorStatus(error: unknown): number | undefined {
    return axios.isAxiosError(error) ? error.response?.status : undefined;
}
