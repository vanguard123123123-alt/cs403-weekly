import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";

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
}

function DocumentDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [documentInfo, setDocumentInfo] = useState<DocumentItem | null>(null);
    const [summary, setSummary] = useState<SummaryItem | null>(null);
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
                    const summaries = summariesResponse.data;

                    if (summaries.length === 0) {
                        setSummaryMessage("เอกสารนี้ยังไม่มีสรุป");
                        return;
                    }

                    const latest = [...summaries].sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )[0];
                    setSummary(latest);
                } catch (summaryError) {
                    console.log("โหลดสรุปไม่สำเร็จ:", summaryError);
                    setSummaryMessage("โหลดสรุปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
        return <p>ไม่พบเอกสารนี้</p>;
    }

    return (
        <div style={{ display: "flex", gap: "2rem" }}>
            <div style={{ flex: 1 }}>
                <h2>ข้อมูลเอกสาร</h2>
                <p>ชื่อเอกสาร: {documentInfo.title}</p>
                <p>ชนิดไฟล์: {documentInfo.fileType}</p>
            </div>
            <div style={{ flex: 2 }}>
                <h2>สรุปเอกสาร</h2>
                {summary ? <p>{summary.contentSum}</p> : <p>{summaryMessage}</p>}
            </div>
        </div>
    );
}

export default DocumentDetail;
