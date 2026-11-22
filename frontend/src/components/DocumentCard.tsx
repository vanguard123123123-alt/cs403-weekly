import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "./Badge";
import Button from "./Button";
import Spinner from "./Spinner";
import { coverToneForTitle } from "../utils/coverTone";

export interface DocumentCardItem {
    documentId: number;
    title: string;
    fileType: string;
    uploadDate?: string;
    pageCount: number | null;
    summaryCount: number;
    coveredPages: number | null;
    lastSummaryAt: string | null;
}

interface DocumentCardProps {
    item: DocumentCardItem;
    onSummarizeClick: (item: DocumentCardItem) => void;
    // Only asks the page to open the shared delete-confirmation dialog; the
    // actual DELETE call happens from there, not from this card.
    onDelete: (documentId: number, title: string) => void;
    deleting: boolean;
}

const TONE_CLASSES: Record<string, string> = {
    lavender: "bg-lavender",
    peach: "bg-peach",
    blush: "bg-blush",
};

const FILE_TYPE_ICON: Record<string, string> = {
    pdf: "📄",
    txt: "📝",
};

function DocumentCard({ item, onSummarizeClick, onDelete, deleting }: DocumentCardProps) {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    const tone = coverToneForTitle(item.title);
    const progressPercent =
        item.coveredPages != null && item.pageCount != null && item.pageCount > 0
            ? Math.min(100, Math.round((item.coveredPages / item.pageCount) * 100))
            : null;

    const goToDetail = () => navigate(`/documents/${item.documentId}`);

    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
            <div
                role="link"
                tabIndex={0}
                onClick={goToDetail}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        goToDetail();
                    }
                }}
                className="cursor-pointer"
            >
                <div className={`relative flex h-24 items-center justify-center ${TONE_CLASSES[tone]}`}>
                    <span className="text-3xl" aria-hidden="true">
                        {FILE_TYPE_ICON[item.fileType] ?? "📁"}
                    </span>
                    <span className="absolute top-2 right-2">
                        <Badge variant="neutral">{item.fileType.toUpperCase()}</Badge>
                    </span>
                </div>
                <div className="flex flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-sm leading-normal font-semibold text-ink">
                        {item.title}
                    </h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                        {item.pageCount != null && <span>{item.pageCount} หน้า</span>}
                        <span>สรุปแล้ว {item.summaryCount} รอบ</span>
                    </div>
                    {progressPercent != null && (
                        <div className="flex flex-col gap-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                                <div
                                    className="h-full rounded-full bg-primary-500"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <span className="text-xs text-ink-muted">
                                อ่านแล้ว {item.coveredPages}/{item.pageCount} หน้า
                            </span>
                        </div>
                    )}
                    {item.lastSummaryAt && (
                        <span className="text-xs text-ink-muted">
                            สรุปล่าสุด {new Date(item.lastSummaryAt).toLocaleDateString("th-TH")}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-auto flex items-center gap-2 border-t border-border p-3">
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={(event) => {
                        event.stopPropagation();
                        onSummarizeClick(item);
                    }}
                >
                    สรุป
                </Button>
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        aria-label="ตัวเลือกเพิ่มเติม"
                        onClick={(event) => {
                            event.stopPropagation();
                            setMenuOpen((open) => !open);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-background hover:text-ink"
                    >
                        ⋯
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 bottom-full z-10 mb-1 w-32 rounded-lg border border-border bg-surface py-1 shadow-md">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setMenuOpen(false);
                                    onDelete(item.documentId, item.title);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-700 transition-colors hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {deleting && <Spinner />}
                                ลบ
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocumentCard;
