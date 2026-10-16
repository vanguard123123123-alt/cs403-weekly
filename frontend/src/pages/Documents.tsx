import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [uploading, setUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDocuments = useCallback(async () => {
        try {
            const response = await api.get<DocumentItem[]>("/api/documents");
            setDocuments(response.data);
        } catch (error) {
            console.log("โหลดรายการเอกสารไม่สำเร็จ:", error);
        } finally {
            setLoading(false);
        }
    }, []);

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
            setErrorMessage("กรุณาเลือกไฟล์ PDF ก่อนอัปโหลด");
            return;
        }

        if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
            setErrorMessage("รองรับเฉพาะไฟล์ PDF เท่านั้น");
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
                    accept=".pdf"
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
                            {doc.title} — {new Date(doc.uploadDate).toLocaleString("th-TH")}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Documents;
