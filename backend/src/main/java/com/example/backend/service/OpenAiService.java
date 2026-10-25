package com.example.backend.service;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.example.backend.exception.OpenAiException;
import com.fasterxml.jackson.annotation.JsonProperty;

@Service
public class OpenAiService {

    private static final String CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

    /**
     * When the model judges the extracted text to be unreadable/incomplete, it is instructed
     * to prefix its entire reply with this literal token so SummaryService can detect the
     * case reliably (instead of trying to guess from free-form wording) and reject it.
     */
    public static final String INCOMPLETE_TEXT_MARKER = "[INCOMPLETE_TEXT]";

    private static final String TEXT_SYSTEM_PROMPT = """
            คุณเป็นผู้ช่วยสรุปเอกสารสำหรับผู้อ่านทั่วไป ใช้ได้กับเอกสารทุกประเภท เช่น บทเรียน/สไลด์, บทความ, \
            รายงาน, เอกสารทางธุรกิจ และอื่น ๆ โดยเน้นความชัดเจนสำหรับนักศึกษาที่ใช้ทบทวนเนื้อหา

            กฎการตอบ:
            - ใช้เฉพาะเนื้อหาที่ได้รับเท่านั้น ห้ามอ้างอิง เดา หรือสันนิษฐานเนื้อหาจากชื่อไฟล์หรือชื่อเอกสารโดยเด็ดขาด
            - ตอบเป็นภาษาเดียวกับเอกสารต้นฉบับ (ถ้าเอกสารเป็นภาษาไทยให้ตอบเป็นภาษาไทย ศัพท์เทคนิคสามารถคงไว้เป็นภาษาอังกฤษได้)
            - จัดรูปแบบคำตอบเป็น Markdown ประกอบด้วยหัวข้อต่อไปนี้ (ใช้ชื่อหัวข้อในภาษาเดียวกับเอกสารต้นฉบับ):
              1. หัวข้อ/ใจความหลักของเอกสาร
              2. ประเด็นสำคัญ เป็นรายการข้อ ๆ (bullet points)
              3. ศัพท์หรือแนวคิดสำคัญ พร้อมคำอธิบายสั้น ๆ (ใส่เฉพาะถ้ามีในเอกสาร)
              4. ตัวเลข สูตร หรือตัวอย่างสำคัญ (ใส่เฉพาะถ้ามีในเอกสาร)
            - ห้ามเพิ่มข้อมูล ความเห็น หรือข้อเท็จจริงที่ไม่มีอยู่ในเอกสารโดยเด็ดขาด
            - ถ้าเนื้อหาที่ได้รับดูขาดหาย ไม่ปะติดปะต่อ หรืออ่านไม่รู้เรื่อง (เช่น มีแต่ตัวเลขหรือคำภาษาอังกฤษเป็นเศษ ๆ โดยไม่มีประโยคที่สมบูรณ์) \
            ห้ามพยายามเดาหรือแต่งเนื้อหาที่ขาดไปขึ้นมาเอง ให้ขึ้นต้นคำตอบทั้งหมดด้วยโทเค็น [INCOMPLETE_TEXT] ทันที \
            (ต้องเป็นตัวแรกของคำตอบ ห้ามมีอะไรอยู่ก่อนหน้า) ตามด้วยคำอธิบายสั้น ๆ ว่าข้อความจากเอกสารไม่สมบูรณ์ \
            และแนะนำให้ผู้ใช้ตรวจสอบไฟล์ต้นฉบับหรือลองใช้โหมดอ่านแบบภาพ (vision) แทน
            - ถ้าเอกสารสั้นมาก ให้สรุปสั้นตามเนื้อหาจริง ไม่ต้องเขียนยืดให้ยาวเกินความจำเป็น
            - ใช้ภาษาที่อ่านง่าย ตรงไปตรงมา หลีกเลี่ยงศัพท์ซับซ้อนเกินความจำเป็น
            """;

    private static final String VISION_SYSTEM_PROMPT = """
            คุณเป็นผู้ช่วยสรุปเอกสารจากภาพหน้าเอกสารสำหรับผู้อ่านทั่วไป (เช่น หน้าที่สแกนมา, ลายมือ, หรือสูตรที่พิมพ์ \
            ข้อความธรรมดาดึงออกมาไม่ได้) โดยเน้นความชัดเจนสำหรับนักศึกษาที่ใช้ทบทวนเนื้อหา

            กฎการตอบ:
            - สรุปจากสิ่งที่เห็นในภาพเท่านั้น ห้ามอ้างอิง เดา หรือเพิ่มข้อมูลที่ไม่อยู่ในภาพโดยเด็ดขาด
            - ตอบเป็นภาษาเดียวกับเอกสารในภาพ (ศัพท์เทคนิคสามารถคงไว้เป็นภาษาอังกฤษได้)
            - จัดรูปแบบคำตอบเป็น Markdown โครงสร้างเดียวกับการสรุปจากข้อความทั่วไป (ใช้ชื่อหัวข้อในภาษาเดียวกับเอกสาร):
              1. หัวข้อ/ใจความหลักของเอกสาร
              2. ประเด็นสำคัญ เป็นรายการข้อ ๆ (bullet points)
              3. ศัพท์หรือแนวคิดสำคัญ พร้อมคำอธิบายสั้น ๆ (ใส่เฉพาะถ้ามีในภาพ)
              4. ตัวเลข สูตร หรือตัวอย่างสำคัญ (ใส่เฉพาะถ้ามีในภาพ)
            - เขียนสูตรคณิตศาสตร์เป็น LaTeX เท่านั้น: สูตรในบรรทัดใช้ $...$ และสูตรแยกบรรทัดใช้ $$...$$
            - ถ้าในภาพมีลายมือหรือส่วนที่ถูกเน้น/ไฮไลต์ไว้ ให้แยกอธิบายไว้ในหัวข้อย่อยชื่อ "ส่วนที่ผู้เรียนจด/เน้นไว้"
            - ถ้าภาพบางส่วนหรือทั้งหมดอ่านไม่ออก (เบลอ, ความละเอียดไม่พอ, ลายมืออ่านไม่ออก) ให้บอกตรง ๆ ว่าส่วนนั้นอ่านไม่ออก ห้ามเดาเนื้อหาที่อ่านไม่ออกขึ้นมาเอง
            - ถ้าเอกสารสั้นมาก ให้สรุปสั้นตามเนื้อหาจริง ไม่ต้องเขียนยืดให้ยาวเกินความจำเป็น
            - ใช้ภาษาที่อ่านง่าย ตรงไปตรงมา หลีกเลี่ยงศัพท์ซับซ้อนเกินความจำเป็น
            """;

    private static final String VISION_USER_PROMPT =
            "Please summarize the following document pages according to the rules above.";

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
                        new ChatMessage("system", TEXT_SYSTEM_PROMPT),
                        new ChatMessage("user", text)));

        return call(request);
    }

    public String summarizeImages(List<byte[]> jpegImages) {
        List<Object> contentParts = new ArrayList<>();
        contentParts.add(TextContentPart.of(VISION_USER_PROMPT));
        for (byte[] jpeg : jpegImages) {
            String base64 = Base64.getEncoder().encodeToString(jpeg);
            contentParts.add(ImageContentPart.of("data:image/jpeg;base64," + base64));
        }

        ChatCompletionRequest request = new ChatCompletionRequest(
                model,
                List.of(
                        new ChatMessage("system", VISION_SYSTEM_PROMPT),
                        new ChatMessage("user", contentParts)));

        return call(request);
    }

    public static boolean isIncompleteTextResponse(String content) {
        return content != null && content.trim().startsWith(INCOMPLETE_TEXT_MARKER);
    }

    private String call(ChatCompletionRequest request) {
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

            return (String) response.choices().get(0).message().content();
        } catch (RestClientException ex) {
            throw new OpenAiException("Failed to call OpenAI API", ex);
        }
    }

    private record ChatCompletionRequest(String model, List<ChatMessage> messages) {
    }

    private record ChatMessage(String role, Object content) {
    }

    private record ChatCompletionResponse(List<Choice> choices) {
    }

    private record Choice(ChatMessage message) {
    }

    private record TextContentPart(String type, String text) {
        static TextContentPart of(String text) {
            return new TextContentPart("text", text);
        }
    }

    private record ImageContentPart(String type, @JsonProperty("image_url") ImageUrlData imageUrl) {
        static ImageContentPart of(String dataUrl) {
            return new ImageContentPart("image_url", new ImageUrlData(dataUrl));
        }
    }

    private record ImageUrlData(String url) {
    }
}
