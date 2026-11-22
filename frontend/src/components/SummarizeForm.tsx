import { useState } from "react";
import api from "../api/axiosClient";
import { getErrorMessage, getErrorStatus } from "../api/errorMessage";
import Button from "./Button";
import Alert from "./Alert";
import Spinner from "./Spinner";
import type { DocumentCardItem } from "./DocumentCard";

// A previous summary being re-run over (optionally) the same range, so the
// form can pre-fill from it and offer to replace it on success.
interface ReplaceTarget {
    summaryId: number;
    startPage: number | null;
    endPage: number | null;
    mode: string | null;
}

interface SummarizeFormProps {
    document: DocumentCardItem;
    onSummarized: (documentId: number) => void;
    // Shown as a secondary "ยกเลิก" button next to "สรุป" when provided (the modal
    // needs it to close itself; an always-visible inline form may omit it).
    onCancel?: () => void;
    // Lets a parent (e.g. a Modal) know when it's not safe to be dismissed.
    onSubmittingChange?: (submitting: boolean) => void;
    // "สรุปใหม่ช่วงนี้": pre-fills the page range/mode from this summary and shows a
    // "replace it on success" checkbox wired to replaceSummaryId. Omitted entirely
    // for a plain new summary (SummarizeModal, DocumentDetail's "สรุปเพิ่ม"), so
    // those never send replaceSummaryId.
    replaceTarget?: ReplaceTarget;
}

// The actual summarize form: page-range inputs, vision-mode toggle, and the
// submit button with its validation/error handling. Shared by SummarizeModal
// (wraps this in a Modal) and DocumentDetail (renders this inline, both for a
// plain new summary and for "สรุปใหม่ช่วงนี้" via replaceTarget) so the behavior
// never has to be written twice.
function SummarizeForm({ document, onSummarized, onCancel, onSubmittingChange, replaceTarget }: SummarizeFormProps) {
    const [start, setStart] = useState(replaceTarget?.startPage != null ? String(replaceTarget.startPage) : "");
    const [end, setEnd] = useState(replaceTarget?.endPage != null ? String(replaceTarget.endPage) : "");
    const [vision, setVision] = useState(replaceTarget?.mode === "vision");
    const [replaceOld, setReplaceOld] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [incompleteText, setIncompleteText] = useState(false);

    const setSubmittingState = (value: boolean) => {
        setSubmitting(value);
        onSubmittingChange?.(value);
    };

    const pageCount = document.pageCount;

    const handleSummarize = async () => {
        const startRaw = start.trim();
        const endRaw = end.trim();

        if (vision && (!startRaw || !endRaw)) {
            setErrorMessage("กรุณาระบุช่วงหน้าเมื่อเลือกอ่านแบบภาพ");
            return;
        }

        let body: { startPage?: number; endPage?: number; mode?: string; replaceSummaryId?: number } | undefined;

        if (startRaw || endRaw) {
            if (!startRaw || !endRaw) {
                setErrorMessage("กรุณากรอกทั้งหน้าเริ่มและหน้าจบ");
                return;
            }

            const startPage = Number(startRaw);
            const endPage = Number(endRaw);

            if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1) {
                setErrorMessage("หน้าเริ่มและหน้าจบต้องเป็นจำนวนเต็มบวก");
                return;
            }

            if (endPage < startPage) {
                setErrorMessage("หน้าจบต้องไม่น้อยกว่าหน้าเริ่ม");
                return;
            }

            if (pageCount != null && endPage > pageCount) {
                setErrorMessage(`เอกสารนี้มี ${pageCount} หน้า กรุณากรอกหน้าจบไม่เกิน ${pageCount}`);
                return;
            }

            body = { startPage, endPage };
        }

        if (vision) {
            body = { ...(body ?? {}), mode: "vision" };
        }

        if (replaceTarget && replaceOld) {
            body = { ...(body ?? {}), replaceSummaryId: replaceTarget.summaryId };
        }

        setSubmittingState(true);
        setErrorMessage(null);
        setIncompleteText(false);

        try {
            if (body) {
                await api.post(`/api/documents/${document.documentId}/summarize`, body);
            } else {
                await api.post(`/api/documents/${document.documentId}/summarize`);
            }
            onSummarized(document.documentId);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "เกิดข้อผิดพลาดระหว่างสรุปเอกสาร กรุณาลองใหม่อีกครั้ง"));
            setIncompleteText(getErrorStatus(error) === 422);
        } finally {
            setSubmittingState(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {document.fileType === "pdf" && (
                <>
                    {pageCount != null && (
                        <p className="text-sm text-ink-muted">เอกสารนี้ {pageCount} หน้า</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="number"
                            placeholder="หน้าเริ่ม"
                            value={start}
                            disabled={submitting}
                            onChange={(e) => setStart(e.target.value)}
                            className="w-20 min-w-0 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink"
                        />
                        <span className="text-ink-muted">-</span>
                        <input
                            type="number"
                            placeholder="หน้าจบ"
                            value={end}
                            disabled={submitting}
                            onChange={(e) => setEnd(e.target.value)}
                            className="w-20 min-w-0 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink"
                        />
                        <span className="text-xs text-ink-muted">(เว้นว่าง = ทั้งไฟล์)</span>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                            type="checkbox"
                            checked={vision}
                            disabled={submitting}
                            onChange={(e) => setVision(e.target.checked)}
                        />
                        อ่านแบบภาพ (สำหรับไฟล์สแกน ลายมือ หรือสูตร)
                    </label>
                    {vision && (
                        <Alert variant="warning">
                            ใช้เวลานานกว่าและเสียค่าใช้จ่ายมากกว่าการอ่านแบบข้อความปกติ
                            ต้องระบุช่วงหน้าเสมอเมื่อเลือกโหมดนี้
                        </Alert>
                    )}
                </>
            )}

            {replaceTarget && (
                <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={replaceOld}
                        disabled={submitting}
                        onChange={(e) => setReplaceOld(e.target.checked)}
                    />
                    แทนที่สรุปเดิม (ลบอันเดิมเมื่อสรุปใหม่สำเร็จ)
                </label>
            )}

            {errorMessage && (
                <Alert variant="error">
                    {errorMessage}
                    {incompleteText && (
                        <>
                            {" "}
                            <button
                                type="button"
                                onClick={() => setVision(true)}
                                className="font-medium underline"
                            >
                                ติ๊กอ่านแบบภาพให้เอกสารนี้
                            </button>
                        </>
                    )}
                </Alert>
            )}

            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button variant="secondary" onClick={onCancel} disabled={submitting}>
                        ยกเลิก
                    </Button>
                )}
                <Button onClick={handleSummarize} disabled={submitting}>
                    {submitting ? (
                        <>
                            <Spinner />
                            กำลังอ่านเอกสาร อาจใช้เวลาถึง 1 นาที
                        </>
                    ) : (
                        "สรุป"
                    )}
                </Button>
            </div>
        </div>
    );
}

export default SummarizeForm;
