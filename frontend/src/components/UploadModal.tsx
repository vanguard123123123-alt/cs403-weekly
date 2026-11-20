import { useRef, useState } from "react";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";
import Modal from "./Modal";
import Button from "./Button";
import TextInput from "./TextInput";
import Alert from "./Alert";
import Spinner from "./Spinner";

interface UploadModalProps {
    open: boolean;
    onClose: () => void;
    onUploaded: () => Promise<void> | void;
}

function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [uploading, setUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetAndClose = () => {
        setSelectedFile(null);
        setTitle("");
        setErrorMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        onClose();
    };

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

            await onUploaded();
            onClose();
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal open={open} onClose={resetAndClose} title="อัปโหลดเอกสาร" dismissible={!uploading}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-ink">ไฟล์เอกสาร (PDF หรือ TXT)</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt"
                        disabled={uploading}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700"
                    />
                </div>
                <TextInput
                    label="ชื่อเอกสาร (ไม่บังคับ)"
                    value={title}
                    disabled={uploading}
                    onChange={(e) => setTitle(e.target.value)}
                />
                {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={resetAndClose} disabled={uploading}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleUpload} disabled={uploading}>
                        {uploading ? (
                            <>
                                <Spinner />
                                กำลังอัปโหลด...
                            </>
                        ) : (
                            "อัปโหลด"
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default UploadModal;
