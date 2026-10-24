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
    private static final String SYSTEM_PROMPT = """
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
            - ถ้าเนื้อหาที่ได้รับดูขาดหาย ไม่ปะติดปะต่อ หรืออ่านไม่รู้เรื่อง (เช่น มีแต่ตัวเลขหรือคำภาษาอังกฤษเป็นเศษ ๆ โดยไม่มีประโยคที่สมบูรณ์) ห้ามพยายามเดาหรือแต่งเนื้อหาที่ขาดไปขึ้นมาเอง ให้ตอบสั้น ๆ ว่าข้อความจากเอกสารไม่สมบูรณ์ และแนะนำให้ผู้ใช้ตรวจสอบไฟล์ต้นฉบับ
            - ถ้าเอกสารสั้นมาก ให้สรุปสั้นตามเนื้อหาจริง ไม่ต้องเขียนยืดให้ยาวเกินความจำเป็น
            - ใช้ภาษาที่อ่านง่าย ตรงไปตรงมา หลีกเลี่ยงศัพท์ซับซ้อนเกินความจำเป็น
            """;

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
