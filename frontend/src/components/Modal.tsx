import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    // When false, the modal can't be dismissed via the ✕ button, Esc, or a
    // backdrop click — used while an upload/summarize request is in flight.
    dismissible?: boolean;
}

function Modal({ open, onClose, title, children, dismissible = true }: ModalProps) {
    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && dismissible) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, dismissible, onClose]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
            onClick={() => dismissible && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl sm:p-6"
            >
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg leading-normal font-semibold text-ink">{title}</h2>
                    {dismissible && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="ปิด"
                            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-background hover:text-ink"
                        >
                            ✕
                        </button>
                    )}
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default Modal;
