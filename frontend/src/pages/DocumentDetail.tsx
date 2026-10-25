import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";

interface DocumentItem {
    documentId: number;
    title: string;
    fileType: string;
    uploadDate: string;
}

interface SummaryItem {
    summaryId: number;
    documentId: number;
    summaryLabel: string;
    contentSum: string;
    createdAt: string;
    startPage: number | null;
    endPage: number | null;
    mode: string | null;
}

function pageRangeLabel(summary: SummaryItem): string {
    if (summary.startPage == null || summary.endPage == null) {
        return "ทั้งไฟล์";
    }
    return `หน้า ${summary.startPage}-${summary.endPage}`;
}

function DocumentDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [documentInfo, setDocumentInfo] = useState<DocumentItem | null>(null);
    const [summaries, setSummaries] = useState<SummaryItem[]>([]);
    const [selectedSummaryId, setSelectedSummaryId] = useState<number | null>(null);
    const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        const documentId = Number(id);

        const load = async () => {
            try {
                const documentsResponse = await api.get<DocumentItem[]>("/api/documents");
                const found = documentsResponse.data.find((doc) => doc.documentId === documentId);

                if (!found) {
                    setNotFound(true);
                    return;
                }
                setDocumentInfo(found);

                try {
                    const summariesResponse = await api.get<SummaryItem[]>(
                        `/api/documents/${documentId}/summaries`
                    );
                    const sorted = [...summariesResponse.data].sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );

                    if (sorted.length === 0) {
                        setSummaryMessage("เอกสารนี้ยังไม่มีสรุป");
                        return;
                    }

                    setSummaries(sorted);
                    setSelectedSummaryId(sorted[0].summaryId);
                } catch (summaryError) {
                    console.log("โหลดสรุปไม่สำเร็จ:", summaryError);
                    setSummaryMessage(getErrorMessage(summaryError, "โหลดสรุปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
                }
            } catch (error) {
                console.log("โหลดข้อมูลเอกสารไม่สำเร็จ:", error);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id, navigate]);

    if (loading) {
        return <p>กำลังโหลด...</p>;
    }

    if (notFound || !documentInfo) {
        return (
            <div>
                <button onClick={() => navigate("/documents")}>กลับไปรายการเอกสาร</button>
                <p>ไม่พบเอกสารนี้</p>
            </div>
        );
    }

    const selectedSummary = summaries.find((s) => s.summaryId === selectedSummaryId) ?? null;

    return (
        <div>
            <button onClick={() => navigate("/documents")}>กลับไปรายการเอกสาร</button>

            <div style={{ display: "flex", gap: "2rem" }}>
                <div style={{ flex: 1 }}>
                    <h2>ข้อมูลเอกสาร</h2>
                    <p>ชื่อเอกสาร: {documentInfo.title}</p>
                    <p>ชนิดไฟล์: {documentInfo.fileType}</p>
                </div>
                <div style={{ flex: 2 }}>
                    <h2>สรุปเอกสาร</h2>
                    {summaries.length === 0 ? (
                        <p>{summaryMessage}</p>
                    ) : (
                        <div style={{ display: "flex", gap: "1.5rem" }}>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, minWidth: "160px" }}>
                                {summaries.map((s) => (
                                    <li key={s.summaryId} style={{ marginBottom: "8px" }}>
                                        <button
                                            onClick={() => setSelectedSummaryId(s.summaryId)}
                                            style={{
                                                fontWeight: s.summaryId === selectedSummaryId ? "bold" : "normal",
                                            }}
                                        >
                                            {pageRangeLabel(s)}
                                            {s.mode === "vision" && (
                                                <>
                                                    {" "}
                                                    <span style={{ color: "darkorange" }}>[อ่านแบบภาพ]</span>
                                                </>
                                            )}
                                            <br />
                                            {new Date(s.createdAt).toLocaleString("th-TH")}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="markdown-summary" style={{ flex: 1 }}>
                                {selectedSummary && <ReactMarkdown>{selectedSummary.contentSum}</ReactMarkdown>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocumentDetail;
