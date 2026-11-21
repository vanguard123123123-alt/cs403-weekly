import { useState } from "react";
import Modal from "./Modal";
import SummarizeForm from "./SummarizeForm";
import type { DocumentCardItem } from "./DocumentCard";

interface SummarizeModalProps {
    document: DocumentCardItem | null;
    onClose: () => void;
    onSummarized: (documentId: number) => void;
}

function SummarizeModal({ document, onClose, onSummarized }: SummarizeModalProps) {
    const [submitting, setSubmitting] = useState(false);

    if (!document) {
        return (
            <Modal open={false} onClose={onClose} title="สรุปเอกสาร">
                <></>
            </Modal>
        );
    }

    return (
        <Modal open onClose={onClose} title={`สรุปเอกสาร: ${document.title}`} dismissible={!submitting}>
            <SummarizeForm
                key={document.documentId}
                document={document}
                onCancel={onClose}
                onSummarized={onSummarized}
                onSubmittingChange={setSubmitting}
            />
        </Modal>
    );
}

export default SummarizeModal;
