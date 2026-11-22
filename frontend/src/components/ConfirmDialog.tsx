import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { buttonClasses } from "./Button";
import Alert from "./Alert";
import Spinner from "./Spinner";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    // Caller owns the actual delete request, so it also owns these two: true while
    // that request is in flight, and whatever error it produced (cleared by the
    // caller before each attempt). The dialog never calls the API itself.
    loading?: boolean;
    errorMessage?: string | null;
}

function WarningIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
        >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
    );
}

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared confirmation dialog for any destructive action (deleting a document, a
// summary, etc). Unlike Modal, this is deliberately non-dismissible while
// `loading` is true, traps Tab focus inside itself, starts focus on "cancel"
// (never the destructive button), and restores focus to whatever opened it.
// The caller supplies `loading`/`errorMessage` and keeps its own delete logic;
// this component only renders the confirmation UI and calls onConfirm/onCancel.
function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "ลบ",
    cancelLabel = "ยกเลิก",
    onConfirm,
    onCancel,
    loading = false,
    errorMessage,
}: ConfirmDialogProps) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    // Focus "cancel" on open, lock background scroll, and hand focus back to
    // whatever opened the dialog once it closes (for any reason).
    useEffect(() => {
        if (!open) {
            return;
        }

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        cancelButtonRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
            previouslyFocusedRef.current?.focus();
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Tab") {
                const container = dialogRef.current;
                if (!container) {
                    return;
                }
                const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
                if (focusable.length === 0) {
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
                return;
            }

            // Not dismissible mid-delete: Esc is ignored entirely while loading.
            if (event.key === "Escape" && !loading) {
                event.preventDefault();
                onCancel();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, loading, onCancel]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
            onClick={() => !loading && onCancel()}
        >
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                onClick={(event) => event.stopPropagation()}
                className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl sm:p-6"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                            <WarningIcon />
                        </span>
                        <h2 id={titleId} className="min-w-0 pt-1.5 text-base leading-normal font-semibold text-ink">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        aria-label="ปิด"
                        className="flex-shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-background hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        ✕
                    </button>
                </div>

                <p id={descriptionId} className="text-sm leading-relaxed text-ink-muted">
                    {message}
                </p>

                {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className={buttonClasses("secondary", "w-full sm:w-auto")}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={buttonClasses("danger", "w-full sm:w-auto")}
                    >
                        {loading && <Spinner />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ConfirmDialog;
