import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axiosClient";

interface DocumentItem {
    documentId: number;
    title: string;
    uploadDate: string;
}

interface SummaryItem {
    summaryId: number;
    documentId: number;
}

function getSummarizeErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const serverMessage: string | undefined = error.response?.data?.message;

        if (status === 404) {
            return "ไม่พบเอกสารนี้";
        }
        if (status === 403) {
            return "คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้";
        }
        if (status === 400) {
            if (serverMessage?.toLowerCase().includes("no extractable text")) {
                return "ไม่พบข้อความในเอกสารนี้ (อาจเป็นไฟล์สแกนที่ไม่มีข้อความ)";
            }
            if (serverMessage?.toLowerCase().includes("not supported")) {
                return "ไฟล์ประเภทนี้ยังไม่รองรับการสรุป";
            }
            return serverMessage ?? "คำขอไม่ถูกต้อง";
        }
        return "เกิดข้อผิดพลาดระหว่างสรุปเอกสาร กรุณาลองใหม่อีกครั้ง";
    }
    return "เกิดข้อผิดพลาดระหว่างสรุปเอกสาร กรุณาลองใหม่อีกครั้ง";
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
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                const serverMessage = error.response?.data?.message;

                if (status === 413) {
                    setErrorMessage("ไฟล์มีขนาดใหญ่เกิน 10MB");
                } else if (status === 400) {
                    setErrorMessage("ไฟล์ไม่ถูกต้อง: " + (serverMessage ?? "กรุณาตรวจสอบไฟล์ที่เลือก"));
                } else {
                    setErrorMessage(serverMessage ?? "อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
                }
            } else {
                setErrorMessage("อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
        } finally {
            setUploading(false);
        }
    };

    const handleSummarize = async (documentId: number) => {
        setSummarizingId(documentId);
        setSummarizeErrors((prev) => ({ ...prev, [documentId]: "" }));

        try {
            await api.post(`/api/documents/${documentId}/summarize`);
            setSummaryExists((prev) => ({ ...prev, [documentId]: true }));
            navigate(`/documents/${documentId}`);
        } catch (error) {
            setSummarizeErrors((prev) => ({
                ...prev,
                [documentId]: getSummarizeErrorMessage(error),
            }));
        } finally {
            setSummarizingId(null);
        }
    };

    if (loading) {
        return <p>กำลังโหลด...</p>;
    }

    return (
        <div>
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
                        <li key={doc.documentId}>
                            {doc.title} — {new Date(doc.uploadDate).toLocaleString("th-TH")}{" "}
                            {summaryExists[doc.documentId] ? (
                                <button onClick={() => navigate(`/documents/${doc.documentId}`)}>
                                    ดูสรุป
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSummarize(doc.documentId)}
                                    disabled={summarizingId === doc.documentId}
                                >
                                    {summarizingId === doc.documentId ? "กำลังสรุป..." : "สรุป"}
                                </button>
                            )}
                            {summarizeErrors[doc.documentId] && (
                                <p style={{ color: "red" }}>{summarizeErrors[doc.documentId]}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Documents;
