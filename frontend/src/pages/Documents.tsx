import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";

interface DocumentItem {
    documentId: number;
    title: string;
    uploadDate: string;
}

function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        const fetchDocuments = async () => {
            try {
                const response = await api.get<DocumentItem[]>("/api/documents");
                setDocuments(response.data);
            } catch (error) {
                console.log("โหลดรายการเอกสารไม่สำเร็จ:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDocuments();
    }, [navigate]);

    if (loading) {
        return <p>กำลังโหลด...</p>;
    }

    return (
        <div>
            <h1>เอกสารของฉัน</h1>
            {documents.length === 0 ? (
                <p>ยังไม่มีเอกสาร</p>
            ) : (
                <ul>
                    {documents.map((doc) => (
                        <li key={doc.documentId}>
                            {doc.title} — {new Date(doc.uploadDate).toLocaleString("th-TH")}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Documents;
