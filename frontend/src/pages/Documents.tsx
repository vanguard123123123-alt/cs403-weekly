import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";

interface DocumentItem {
    documentId: number;
    title: string;
    uploadDate: string;
}

interface SummaryItem {
    summaryId: number;
    documentId: number;
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
                [documentId]: getErrorMessage(error, "เกิดข้อผิดพลาดระหว่างสรุปเอกสาร กรุณาลองใหม่อีกครั้ง"),
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
                            {" "}
                            <button
                                onClick={() => handleDelete(doc.documentId, doc.title)}
                                disabled={deletingId === doc.documentId}
                            >
                                {deletingId === doc.documentId ? "กำลังลบ..." : "ลบ"}
                            </button>
                            {summarizeErrors[doc.documentId] && (
                                <p style={{ color: "red" }}>{summarizeErrors[doc.documentId]}</p>
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
