import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import UploadModal from "../components/UploadModal";
import SummarizeModal from "../components/SummarizeModal";
import ConfirmDialog from "../components/ConfirmDialog";
import DocumentCard, { type DocumentCardItem } from "../components/DocumentCard";

function DocumentCardSkeleton() {
    return (
        <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="h-24 bg-background" />
            <div className="flex flex-col gap-2 p-4">
                <div className="h-4 w-3/4 rounded bg-background" />
                <div className="h-3 w-1/2 rounded bg-background" />
                <div className="h-3 w-full rounded bg-background" />
            </div>
        </div>
    );
}

function UploadCard({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-ink-muted transition-colors hover:border-primary-400 hover:text-primary-600"
        >
            <span className="text-2xl" aria-hidden="true">
                +
            </span>
            <span className="text-sm font-medium">อัปโหลดเอกสาร</span>
        </button>
    );
}

function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<DocumentCardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [summarizeTarget, setSummarizeTarget] = useState<DocumentCardItem | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleteErrors, setDeleteErrors] = useState<Record<number, string>>({});
    const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ documentId: number; title: string } | null>(
        null
    );

    const fetchDocuments = useCallback(async () => {
        try {
            const response = await api.get<DocumentCardItem[]>("/api/documents");
            setDocuments(response.data);
            setLoadErrorMessage(null);
        } catch (error) {
            console.log("โหลดรายการเอกสารไม่สำเร็จ:", error);
            setLoadErrorMessage(getErrorMessage(error, "โหลดรายการเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
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

    // Opens the shared confirmation dialog; the DELETE call itself happens in
    // confirmDelete below once the user confirms there.
    const requestDelete = (documentId: number, title: string) => {
        setDeleteErrors((prev) => ({ ...prev, [documentId]: "" }));
        setConfirmDeleteTarget({ documentId, title });
    };

    const confirmDelete = async () => {
        if (!confirmDeleteTarget) {
            return;
        }
        const { documentId } = confirmDeleteTarget;

        setDeletingId(documentId);
        setDeleteErrors((prev) => ({ ...prev, [documentId]: "" }));

        try {
            await api.delete(`/api/documents/${documentId}`);
            await fetchDocuments();
            setConfirmDeleteTarget(null);
        } catch (error) {
            setDeleteErrors((prev) => ({
                ...prev,
                [documentId]: getErrorMessage(error, "ลบเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"),
            }));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Layout>
            <h1 className="text-2xl leading-normal font-semibold text-ink">เอกสารของฉัน</h1>

            {loadErrorMessage && <Alert variant="error">{loadErrorMessage}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <UploadCard onClick={() => setUploadModalOpen(true)} />

                {loading &&
                    Array.from({ length: 4 }).map((_, index) => <DocumentCardSkeleton key={index} />)}

                {!loading &&
                    documents.map((document) => (
                        <DocumentCard
                            key={document.documentId}
                            item={document}
                            onSummarizeClick={setSummarizeTarget}
                            onDelete={requestDelete}
                            deleting={deletingId === document.documentId}
                        />
                    ))}
            </div>

            {!loading && documents.length === 0 && (
                <p className="text-sm text-ink-muted">
                    ยังไม่มีเอกสาร อัปโหลดเอกสารแรกของคุณได้จากการ์ดด้านบน
                </p>
            )}

            <UploadModal
                open={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                onUploaded={fetchDocuments}
            />

            <SummarizeModal
                document={summarizeTarget}
                onClose={() => setSummarizeTarget(null)}
                onSummarized={(documentId) => {
                    setSummarizeTarget(null);
                    navigate(`/documents/${documentId}`);
                }}
            />

            <ConfirmDialog
                open={confirmDeleteTarget !== null}
                title="ลบเอกสารนี้?"
                message={
                    confirmDeleteTarget && (
                        <>
                            ลบเอกสาร &ldquo;
                            <span className="font-medium text-ink">{confirmDeleteTarget.title}</span>
                            &rdquo; จะลบสรุปทั้งหมดของเอกสารนี้ไปด้วย การลบไม่สามารถย้อนกลับได้
                        </>
                    )
                }
                confirmLabel="ลบเอกสาร"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmDeleteTarget(null)}
                loading={confirmDeleteTarget != null && deletingId === confirmDeleteTarget.documentId}
                errorMessage={confirmDeleteTarget ? deleteErrors[confirmDeleteTarget.documentId] || null : null}
            />
        </Layout>
    );
}

export default Documents;
