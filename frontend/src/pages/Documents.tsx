import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { getErrorMessage, getErrorStatus } from "../api/errorMessage";

interface DocumentItem {
    documentId: number;
    title: string;
    uploadDate: string;
    fileType: string;
    pageCount: number | null;
}

interface SummaryItem {
    summaryId: number;
    documentId: number;
}

interface PageRangeInput {
    start: string;
    end: string;
}

function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [uploading, setUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [summaryExists, setSummaryExists] = useState<Record<number, boolean>>({});
    const [summarizingId, setSummarizingId] = useState<number | null>(null);
    const [summarizeErrors, setSummarizeErrors] = useState<Record<number, string>>({});
    const [incompleteTextDocIds, setIncompleteTextDocIds] = useState<Record<number, boolean>>({});
    const [pageRangeInputs, setPageRangeInputs] = useState<Record<number, PageRangeInput>>({});
    const [visionInputs, setVisionInputs] = useState<Record<number, boolean>>({});

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleteErrors, setDeleteErrors] = useState<Record<number, string>>({});

    const loadSummaryStatus = useCallback(async (docs: DocumentItem[]) => {
        const results = await Promise.all(
            docs.map(async (doc) => {
                try {
                    const response = await api.get<SummaryItem[]>(
                        `/api/documents/${doc.documentId}/summaries`
                    );
                    return [doc.documentId, response.data.length > 0] as const;
                } catch {
                    return [doc.documentId, false] as const;
                }
            })
        );
        setSummaryExists(Object.fromEntries(results));
    }, []);

    const fetchDocuments = useCallback(async () => {
        try {
            const response = await api.get<DocumentItem[]>("/api/documents");
            setDocuments(response.data);
            await loadSummaryStatus(response.data);
        } catch (error) {
            console.log("โหลดรายการเอกสารไม่สำเร็จ:", error);
        } finally {
            setLoading(false);
        }
    }, [loadSummaryStatus]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        fetchDocuments();
    }, [navigate, fetchDocuments]);

    const handleUpload = async () => {
        if (!selectedFile) {
            setErrorMessage("กรุณาเลือกไฟล์ PDF หรือ TXT ก่อนอัปโหลด");
            return;
        }

        const lowerName = selectedFile.name.toLowerCase();
        if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".txt")) {
            setErrorMessage("รองรับเฉพาะไฟล์ PDF และ TXT เท่านั้น");
            return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        if (title.trim()) {
            formData.append("title", title.trim());
        }

        setUploading(true);
        setErrorMessage(null);

        try {
            await api.post("/api/documents/upload", formData);

            setSelectedFile(null);
            setTitle("");
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            await fetchDocuments();
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setUploading(false);
        }
    };

    const updatePageRangeInput = (documentId: number, field: "start" | "end", value: string) => {
        setPageRangeInputs((prev) => ({
            ...prev,
            [documentId]: {
                start: field === "start" ? value : prev[documentId]?.start ?? "",
                end: field === "end" ? value : prev[documentId]?.end ?? "",
            },
        }));
    };

    const handleSummarize = async (documentId: number, pageCount: number | null) => {
        const range = pageRangeInputs[documentId] ?? { start: "", end: "" };
        const visionChecked = visionInputs[documentId] ?? false;
        const startRaw = range.start.trim();
        const endRaw = range.end.trim();

        if (visionChecked && (!startRaw || !endRaw)) {
            setSummarizeErrors((prev) => ({
                ...prev,
                [documentId]: "กรุณาระบุช่วงหน้าเมื่อเลือกอ่านแบบภาพ",
            }));
            return;
        }

        let body: { startPage?: number; endPage?: number; mode?: string } | undefined;

        if (startRaw || endRaw) {
            if (!startRaw || !endRaw) {
                setSummarizeErrors((prev) => ({ ...prev, [documentId]: "กรุณากรอกทั้งหน้าเริ่มและหน้าจบ" }));
                return;
            }

            const startPage = Number(startRaw);
            const endPage = Number(endRaw);

            if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1) {
                setSummarizeErrors((prev) => ({ ...prev, [documentId]: "หน้าเริ่มและหน้าจบต้องเป็นจำนวนเต็มบวก" }));
                return;
            }

            if (endPage < startPage) {
                setSummarizeErrors((prev) => ({ ...prev, [documentId]: "หน้าจบต้องไม่น้อยกว่าหน้าเริ่ม" }));
                return;
            }

            if (pageCount != null && endPage > pageCount) {
                setSummarizeErrors((prev) => ({
                    ...prev,
                    [documentId]: `เอกสารนี้มี ${pageCount} หน้า กรุณากรอกหน้าจบไม่เกิน ${pageCount}`,
                }));
                return;
            }

            body = { startPage, endPage };
        }

        if (visionChecked) {
            body = { ...(body ?? {}), mode: "vision" };
        }

        setSummarizingId(documentId);
        setSummarizeErrors((prev) => ({ ...prev, [documentId]: "" }));
        setIncompleteTextDocIds((prev) => ({ ...prev, [documentId]: false }));

        try {
            if (body) {
                await api.post(`/api/documents/${documentId}/summarize`, body);
            } else {
                await api.post(`/api/documents/${documentId}/summarize`);
            }
            setSummaryExists((prev) => ({ ...prev, [documentId]: true }));
            navigate(`/documents/${documentId}`);
        } catch (error) {
            setSummarizeErrors((prev) => ({
                ...prev,
                [documentId]: getErrorMessage(error, "เกิดข้อผิดพลาดระหว่างสรุปเอกสาร กรุณาลองใหม่อีกครั้ง"),
            }));
            setIncompleteTextDocIds((prev) => ({
                ...prev,
                [documentId]: getErrorStatus(error) === 422,
            }));
        } finally {
            setSummarizingId(null);
        }
    };

    const handleDelete = async (documentId: number, title: string) => {
        const confirmed = window.confirm(`ต้องการลบเอกสาร "${title}" ใช่หรือไม่?`);
        if (!confirmed) {
            return;
        }

        setDeletingId(documentId);
        setDeleteErrors((prev) => ({ ...prev, [documentId]: "" }));

        try {
            await api.delete(`/api/documents/${documentId}`);
            await fetchDocuments();
        } catch (error) {
            setDeleteErrors((prev) => ({
                ...prev,
                [documentId]: getErrorMessage(error, "ลบเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"),
            }));
        } finally {
            setDeletingId(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    if (loading) {
        return <p>กำลังโหลด...</p>;
    }

    return (
        <div>
            <button onClick={handleLogout}>ออกจากระบบ</button>
            <button onClick={() => navigate("/dashboard")}>ไปหน้า Dashboard</button>
            <h1>เอกสารของฉัน</h1>

            <div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <input
                    type="text"
                    placeholder="ชื่อเอกสาร (ไม่บังคับ)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <button onClick={handleUpload} disabled={uploading}>
                    อัปโหลด
                </button>
                {uploading && <p>กำลังอัปโหลด...</p>}
                {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
            </div>

            {documents.length === 0 ? (
                <p>ยังไม่มีเอกสาร</p>
            ) : (
                <ul>
                    {documents.map((doc) => (
                        <li key={doc.documentId} style={{ marginBottom: "12px" }}>
                            {doc.title} — {new Date(doc.uploadDate).toLocaleString("th-TH")}
                            <br />
                            {doc.fileType === "pdf" && (
                                <>
                                    {doc.pageCount != null && <>เอกสารนี้ {doc.pageCount} หน้า{" "}</>}
                                    <input
                                        type="number"
                                        placeholder="หน้าเริ่ม"
                                        style={{ width: "5rem" }}
                                        value={pageRangeInputs[doc.documentId]?.start ?? ""}
                                        onChange={(e) =>
                                            updatePageRangeInput(doc.documentId, "start", e.target.value)
                                        }
                                    />
                                    {" - "}
                                    <input
                                        type="number"
                                        placeholder="หน้าจบ"
                                        style={{ width: "5rem" }}
                                        value={pageRangeInputs[doc.documentId]?.end ?? ""}
                                        onChange={(e) =>
                                            updatePageRangeInput(doc.documentId, "end", e.target.value)
                                        }
                                    />
                                    {" "}
                                    (เว้นว่าง = ทั้งไฟล์){" "}
                                    <br />
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={visionInputs[doc.documentId] ?? false}
                                            onChange={(e) =>
                                                setVisionInputs((prev) => ({
                                                    ...prev,
                                                    [doc.documentId]: e.target.checked,
                                                }))
                                            }
                                        />
                                        {" "}อ่านแบบภาพ (สำหรับไฟล์สแกน ลายมือ หรือสูตร)
                                    </label>
                                    {visionInputs[doc.documentId] && (
                                        <p style={{ color: "darkorange" }}>
                                            ใช้เวลานานกว่าและเสียค่าใช้จ่ายมากกว่าการอ่านแบบข้อความปกติ
                                            ต้องระบุช่วงหน้าเสมอเมื่อเลือกโหมดนี้
                                        </p>
                                    )}
                                </>
                            )}
                            <button
                                onClick={() => handleSummarize(doc.documentId, doc.pageCount)}
                                disabled={summarizingId === doc.documentId}
                            >
                                {summarizingId === doc.documentId ? "กำลังสรุป..." : "สรุป"}
                            </button>
                            {" "}
                            {summaryExists[doc.documentId] && (
                                <button onClick={() => navigate(`/documents/${doc.documentId}`)}>
                                    ดูสรุป
                                </button>
                            )}
                            {" "}
                            <button
                                onClick={() => handleDelete(doc.documentId, doc.title)}
                                disabled={deletingId === doc.documentId}
                            >
                                {deletingId === doc.documentId ? "กำลังลบ..." : "ลบ"}
                            </button>
                            {summarizeErrors[doc.documentId] && (
                                <p style={{ color: "red" }}>
                                    {summarizeErrors[doc.documentId]}
                                    {incompleteTextDocIds[doc.documentId] && (
                                        <>
                                            {" "}
                                            <button
                                                onClick={() =>
                                                    setVisionInputs((prev) => ({
                                                        ...prev,
                                                        [doc.documentId]: true,
                                                    }))
                                                }
                                            >
                                                ติ๊กอ่านแบบภาพให้เอกสารนี้
                                            </button>
                                        </>
                                    )}
                                </p>
                            )}
                            {deleteErrors[doc.documentId] && (
                                <p style={{ color: "red" }}>{deleteErrors[doc.documentId]}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Documents;
