import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import api from "../api/axiosClient";
import { getErrorMessage, getErrorStatus } from "../api/errorMessage";
import { formatDateTime, pageRangeLabel, summaryDisplayLabel } from "../utils/roundFormatting";
import Layout from "../components/Layout";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import SummarizeForm from "../components/SummarizeForm";
import ConfirmDialog from "../components/ConfirmDialog";

interface DocumentInfo {
    documentId: number;
    title: string;
    fileType: string;
    uploadDate: string;
    pageCount: number | null;
    summaryCount: number;
    coveredPages: number | null;
    lastSummaryAt: string | null;
}

interface SummaryItem {
    summaryId: number;
    documentId: number;
    summaryLabel: string | null;
    contentSum: string;
    createdAt: string;
    truncated: boolean;
    startPage: number | null;
    endPage: number | null;
    mode: string | null;
}

interface Round extends SummaryItem {
    roundNumber: number;
}

type Tab = "original" | "summary";

// One key shared by every document (not per-document): whether the original
// pane should be shown at lg+. Reading/writing are both wrapped in try/catch
// so the page still renders correctly if localStorage is unavailable.
const ORIGINAL_VISIBLE_STORAGE_KEY = "documentDetail.originalVisible";

function readStoredOriginalVisible(): boolean {
    try {
        const stored = localStorage.getItem(ORIGINAL_VISIBLE_STORAGE_KEY);
        return stored === null ? true : stored === "true";
    } catch {
        return true;
    }
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
    return (
        <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
        >
            {direction === "left" ? <path d="M12 4l-6 6 6 6" /> : <path d="M8 4l6 6-6 6" />}
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
        >
            <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" />
        </svg>
    );
}

function DocumentDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [rounds, setRounds] = useState<Round[]>([]);
    const [loadingRounds, setLoadingRounds] = useState(true);
    const [roundsError, setRoundsError] = useState<string | null>(null);
    const [selectedSummaryId, setSelectedSummaryId] = useState<number | null>(null);
    const [showSummarizeForm, setShowSummarizeForm] = useState(false);

    const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
    const [fileTextContent, setFileTextContent] = useState<string | null>(null);
    const [fileLoading, setFileLoading] = useState(false);
    const [fileLoadError, setFileLoadError] = useState<string | null>(null);
    const [iframeKey, setIframeKey] = useState(0);

    const [activeTab, setActiveTab] = useState<Tab>("summary");
    const [originalVisible, setOriginalVisible] = useState<boolean>(readStoredOriginalVisible);

    const [editingLabel, setEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState("");
    const [labelError, setLabelError] = useState<string | null>(null);
    const [savingLabel, setSavingLabel] = useState(false);
    const [showReplaceForm, setShowReplaceForm] = useState(false);
    const [deletingSummary, setDeletingSummary] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(ORIGINAL_VISIBLE_STORAGE_KEY, String(originalVisible));
        } catch {
            // localStorage unavailable (private mode, quota, etc.) — keep working in-memory only.
        }
    }, [originalVisible]);

    const fetchRounds = useCallback(async (documentId: number): Promise<Round[]> => {
        setLoadingRounds(true);
        setRoundsError(null);

        try {
            const response = await api.get<SummaryItem[]>(`/api/documents/${documentId}/summaries`);
            const sorted = [...response.data].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            const withRoundNumbers = sorted.map((summary, index) => ({ ...summary, roundNumber: index + 1 }));
            setRounds(withRoundNumbers);
            return withRoundNumbers;
        } catch (error) {
            console.log("โหลดสรุปไม่สำเร็จ:", error);
            setRoundsError(getErrorMessage(error, "โหลดสรุปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
            return [];
        } finally {
            setLoadingRounds(false);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        const documentId = Number(id);

        (async () => {
            try {
                const documentsResponse = await api.get<DocumentInfo[]>("/api/documents");
                const found = documentsResponse.data.find((doc) => doc.documentId === documentId);

                if (!found) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                setDocumentInfo(found);
                setLoading(false);

                const loadedRounds = await fetchRounds(documentId);
                if (loadedRounds.length > 0) {
                    setSelectedSummaryId(loadedRounds[loadedRounds.length - 1].summaryId);
                }
            } catch (error) {
                console.log("โหลดข้อมูลเอกสารไม่สำเร็จ:", error);
                setNotFound(true);
                setLoading(false);
            }
        })();
    }, [id, navigate, fetchRounds]);

    // Fetches the original file once we know the document exists, as a blob: the
    // same object URL is used for the <iframe>/<pre> preview and the "open in a
    // new tab" link, and is revoked on cleanup (document change or leaving the page).
    useEffect(() => {
        if (!documentInfo) {
            return;
        }

        let objectUrl: string | null = null;
        let cancelled = false;

        const loadFile = async () => {
            setFileLoading(true);
            setFileLoadError(null);
            setFileBlobUrl(null);
            setFileTextContent(null);

            try {
                const response = await api.get<Blob>(`/api/documents/${documentInfo.documentId}/file`, {
                    responseType: "blob",
                });
                if (cancelled) {
                    return;
                }

                objectUrl = URL.createObjectURL(response.data);
                setFileBlobUrl(objectUrl);

                if (documentInfo.fileType === "txt") {
                    const text = await response.data.text();
                    if (!cancelled) {
                        setFileTextContent(text);
                    }
                }
            } catch (error) {
                console.log("โหลดไฟล์ต้นฉบับไม่สำเร็จ:", error);
                if (!cancelled) {
                    setFileLoadError("ไม่พบไฟล์ต้นฉบับ");
                }
            } finally {
                if (!cancelled) {
                    setFileLoading(false);
                }
            }
        };

        loadFile();

        return () => {
            cancelled = true;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [documentInfo?.documentId, documentInfo?.fileType]);

    // Best-effort: ask the browser's PDF viewer to open on the round's first page.
    // Not reliable across browsers (notably blob: URLs in Chrome), so it's purely
    // additive — nothing else depends on it, and it never blocks rendering.
    useEffect(() => {
        setIframeKey((key) => key + 1);
    }, [selectedSummaryId]);

    const handleSummarized = async (documentId: number) => {
        const updated = await fetchRounds(documentId);
        if (updated.length > 0) {
            setSelectedSummaryId(updated[updated.length - 1].summaryId);
        }
        setShowSummarizeForm(false);
        setShowReplaceForm(false);
    };

    // Switching rounds abandons any in-progress rename/replace for the previous one.
    useEffect(() => {
        setEditingLabel(false);
        setLabelError(null);
        setShowReplaceForm(false);
        setDeleteError(null);
        setShowDeleteConfirm(false);
    }, [selectedSummaryId]);

    const startEditingLabel = (round: Round) => {
        setLabelInput(summaryDisplayLabel(round, documentInfo?.title ?? ""));
        setLabelError(null);
        setEditingLabel(true);
    };

    const cancelEditingLabel = () => {
        setEditingLabel(false);
        setLabelError(null);
    };

    const saveLabel = async (round: Round) => {
        const trimmed = labelInput.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            setLabelError("ชื่อต้องมีความยาว 1-100 ตัวอักษร");
            return;
        }

        setSavingLabel(true);
        setLabelError(null);
        try {
            const response = await api.patch<SummaryItem>(`/api/summaries/${round.summaryId}`, { name: trimmed });
            setRounds((prev) =>
                prev.map((r) => (r.summaryId === round.summaryId ? { ...r, summaryLabel: response.data.summaryLabel } : r))
            );
            setEditingLabel(false);
        } catch (error) {
            setLabelError(getErrorMessage(error, "เปลี่ยนชื่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setSavingLabel(false);
        }
    };

    // Opens the shared confirmation dialog; the DELETE call itself happens in
    // confirmDeleteSelected below once the user confirms there.
    const requestDeleteSelected = () => {
        setDeleteError(null);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteSelected = async () => {
        if (!documentInfo || !selectedRound) {
            return;
        }
        const round = selectedRound;

        setDeletingSummary(true);
        setDeleteError(null);

        try {
            await api.delete(`/api/summaries/${round.summaryId}`);
        } catch (error) {
            if (getErrorStatus(error) !== 404) {
                setDeleteError(getErrorMessage(error, "ลบสรุปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
                setDeletingSummary(false);
                return;
            }
            // 404: someone/something already deleted it — just refresh quietly below.
        }

        const updated = await fetchRounds(documentInfo.documentId);
        setSelectedSummaryId(updated.length > 0 ? updated[updated.length - 1].summaryId : null);
        setDeletingSummary(false);
        setShowDeleteConfirm(false);
    };

    if (loading) {
        return (
            <Layout wide>
                <p>กำลังโหลด...</p>
            </Layout>
        );
    }

    if (notFound || !documentInfo) {
        return (
            <Layout wide>
                <Link
                    to="/documents"
                    className="inline-flex items-center gap-1 self-start rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-background hover:text-ink"
                >
                    <span aria-hidden="true">←</span>
                    เอกสารของฉัน
                </Link>
                <p>ไม่พบเอกสารนี้</p>
            </Layout>
        );
    }

    const selectedRound = rounds.find((r) => r.summaryId === selectedSummaryId) ?? null;
    const roundsNewestFirst = [...rounds].reverse();
    // Best-effort viewer hints for blob: URLs — see the report on whether these
    // actually have any effect in the browsers this was checked in.
    const viewerFragmentParts = selectedRound?.startPage != null ? [`page=${selectedRound.startPage}`] : [];
    viewerFragmentParts.push("view=FitH");
    const iframeSrc = fileBlobUrl ? `${fileBlobUrl}#${viewerFragmentParts.join("&")}` : undefined;
    const summaryPaneHeightClass = rounds.length === 0 ? "lg:self-start" : "lg:h-full";
    // The rail is its own grid column, always leftmost (col-start-1) regardless of
    // state. The other two columns' order/count still differs between "original
    // visible" (3 columns: rail, original, summary) and "original hidden" (2
    // columns: rail, summary) — original/summary get an explicit lg:col-start per
    // state instead of relying on auto-placement.
    const gridColsClass = !originalVisible
        ? "lg:grid-cols-[3rem_1fr]"
        : rounds.length === 0
          ? "lg:grid-cols-[3rem_3fr_2fr]"
          : "lg:grid-cols-[3rem_2fr_3fr]";
    const summaryColStartClass = originalVisible ? "lg:col-start-3" : "lg:col-start-2";

    return (
        <Layout wide>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        to="/documents"
                        className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-background hover:text-ink"
                    >
                        <span aria-hidden="true">←</span>
                        เอกสารของฉัน
                    </Link>
                    <h1 className="line-clamp-1 flex-1 text-xl leading-normal font-semibold text-ink">
                        {documentInfo.title}
                    </h1>
                    <Badge variant="neutral">{documentInfo.fileType.toUpperCase()}</Badge>
                    {documentInfo.pageCount != null && (
                        <span className="text-sm text-ink-muted">{documentInfo.pageCount} หน้า</span>
                    )}

                    {!originalVisible && fileBlobUrl && (
                        <a
                            href={fileBlobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden text-sm font-medium text-primary-700 underline lg:inline"
                        >
                            เปิดต้นฉบับในแท็บใหม่
                        </a>
                    )}
                </div>

                <div className="flex gap-2 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setActiveTab("original")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === "original"
                                ? "border-primary-600 bg-primary-50 text-primary-700"
                                : "border-border bg-surface text-ink-muted"
                        }`}
                    >
                        ต้นฉบับ
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("summary")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === "summary"
                                ? "border-primary-600 bg-primary-50 text-primary-700"
                                : "border-border bg-surface text-ink-muted"
                        }`}
                    >
                        สรุป
                    </button>
                </div>

                <div className={`grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 ${gridColsClass}`}>
                    <div
                        className="hidden min-h-0 flex-col items-center justify-center lg:col-start-1 lg:flex lg:h-full"
                    >
                        <button
                            type="button"
                            onClick={() => setOriginalVisible((visible) => !visible)}
                            aria-expanded={originalVisible}
                            aria-label={originalVisible ? "ซ่อนต้นฉบับ" : "แสดงต้นฉบับ"}
                            className="flex flex-col items-center gap-1 rounded-md p-2 text-ink-muted/60 transition-colors hover:text-ink-muted focus-visible:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                        >
                            <ChevronIcon direction={originalVisible ? "left" : "right"} />
                            <span className="text-center text-xs leading-tight">
                                {originalVisible ? (
                                    <>
                                        ซ่อน
                                        <br />
                                        ต้นฉบับ
                                    </>
                                ) : (
                                    <>
                                        แสดง
                                        <br />
                                        ต้นฉบับ
                                    </>
                                )}
                            </span>
                        </button>
                    </div>

                    <div
                        className={`${activeTab === "original" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface lg:col-start-2 lg:h-full ${
                            originalVisible ? "lg:flex" : "lg:hidden"
                        }`}
                    >
                        {fileBlobUrl && (
                            <div className="flex items-center justify-end border-b border-border px-3 py-1.5">
                                <a
                                    href={fileBlobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-primary-700 underline"
                                >
                                    เปิดต้นฉบับในแท็บใหม่
                                </a>
                            </div>
                        )}

                        <div className="flex min-h-0 flex-1 flex-col p-1">
                            {fileLoading && (
                                <div className="flex items-center gap-2 p-3 text-sm text-ink-muted">
                                    <Spinner />
                                    กำลังโหลดไฟล์ต้นฉบับ...
                                </div>
                            )}

                            {!fileLoading && fileLoadError && (
                                <div className="p-3">
                                    <Alert variant="error">{fileLoadError}</Alert>
                                </div>
                            )}

                            {!fileLoading && !fileLoadError && documentInfo.fileType === "pdf" && (
                                <iframe
                                    key={iframeKey}
                                    src={iframeSrc}
                                    title={`ต้นฉบับ: ${documentInfo.title}`}
                                    className="min-h-[480px] flex-1 rounded-lg border-0"
                                />
                            )}

                            {!fileLoading && !fileLoadError && documentInfo.fileType === "txt" && (
                                <pre className="min-h-[480px] flex-1 overflow-y-auto rounded-lg bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-ink">
                                    {fileTextContent}
                                </pre>
                            )}

                            {!fileLoading &&
                                !fileLoadError &&
                                documentInfo.fileType !== "pdf" &&
                                documentInfo.fileType !== "txt" && (
                                    <div className="p-3">
                                        <Alert variant="warning">ไม่รองรับการแสดงตัวอย่างไฟล์ชนิดนี้</Alert>
                                    </div>
                                )}
                        </div>
                    </div>

                    <div
                        className={`${activeTab === "summary" ? "flex" : "hidden"} min-h-0 flex-col rounded-2xl border border-border bg-surface p-4 lg:flex lg:overflow-y-auto ${summaryColStartClass} ${summaryPaneHeightClass}`}
                    >
                      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
                        {loadingRounds && (
                            <div className="flex items-center gap-2 text-sm text-ink-muted">
                                <Spinner />
                                กำลังโหลด...
                            </div>
                        )}

                        {!loadingRounds && roundsError && <Alert variant="error">{roundsError}</Alert>}

                        {!loadingRounds && !roundsError && rounds.length === 0 && (
                            <>
                                <p className="text-sm text-ink-muted">เอกสารนี้ยังไม่มีสรุป</p>
                                <SummarizeForm
                                    key={`new-${documentInfo.documentId}`}
                                    document={documentInfo}
                                    onSummarized={handleSummarized}
                                />
                            </>
                        )}

                        {!loadingRounds && !roundsError && rounds.length > 0 && (
                            <>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {roundsNewestFirst.map((round) => (
                                        <button
                                            key={round.summaryId}
                                            type="button"
                                            onClick={() => setSelectedSummaryId(round.summaryId)}
                                            title={summaryDisplayLabel(round, documentInfo.title)}
                                            className={`max-w-[220px] flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                                round.summaryId === selectedSummaryId
                                                    ? "border-primary-600 bg-primary-50 text-primary-700"
                                                    : "border-border bg-surface text-ink-muted hover:bg-background"
                                            }`}
                                        >
                                            <span className="block truncate">
                                                {summaryDisplayLabel(round, documentInfo.title)}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {!showSummarizeForm ? (
                                    <Button variant="secondary" onClick={() => setShowSummarizeForm(true)}>
                                        สรุปเพิ่ม
                                    </Button>
                                ) : (
                                    <SummarizeForm
                                        key={`more-${documentInfo.documentId}`}
                                        document={documentInfo}
                                        onCancel={() => setShowSummarizeForm(false)}
                                        onSummarized={handleSummarized}
                                    />
                                )}

                                {selectedRound && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                {editingLabel ? (
                                                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={labelInput}
                                                            disabled={savingLabel}
                                                            onChange={(e) => setLabelInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    saveLabel(selectedRound);
                                                                } else if (e.key === "Escape") {
                                                                    e.preventDefault();
                                                                    cancelEditingLabel();
                                                                }
                                                            }}
                                                            autoFocus
                                                            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-base font-semibold text-ink"
                                                        />
                                                        <Button onClick={() => saveLabel(selectedRound)} disabled={savingLabel}>
                                                            บันทึก
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            disabled={savingLabel}
                                                            onClick={cancelEditingLabel}
                                                        >
                                                            ยกเลิก
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h2 className="line-clamp-1 min-w-0 flex-1 text-base font-semibold text-ink">
                                                            {summaryDisplayLabel(selectedRound, documentInfo.title)}
                                                        </h2>
                                                        <button
                                                            type="button"
                                                            aria-label="แก้ไขชื่อสรุป"
                                                            onClick={() => startEditingLabel(selectedRound)}
                                                            className="flex-shrink-0 rounded-md p-1 text-ink-muted transition-colors hover:bg-background hover:text-ink"
                                                        >
                                                            <PencilIcon />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={requestDeleteSelected}
                                                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-danger-200 bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-600"
                                            >
                                                ลบสรุปนี้
                                            </button>
                                        </div>

                                        {labelError && <Alert variant="error">{labelError}</Alert>}

                                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
                                            <span>{pageRangeLabel(selectedRound)}</span>
                                            <span>·</span>
                                            <span>{formatDateTime(selectedRound.createdAt)}</span>
                                            {selectedRound.mode === "vision" && (
                                                <Badge variant="warning">อ่านแบบภาพ</Badge>
                                            )}
                                        </div>

                                        {!showReplaceForm ? (
                                            <Button variant="secondary" onClick={() => setShowReplaceForm(true)}>
                                                สรุปใหม่
                                            </Button>
                                        ) : (
                                            <SummarizeForm
                                                key={`replace-${selectedRound.summaryId}`}
                                                document={documentInfo}
                                                replaceTarget={{
                                                    summaryId: selectedRound.summaryId,
                                                    startPage: selectedRound.startPage,
                                                    endPage: selectedRound.endPage,
                                                    mode: selectedRound.mode,
                                                }}
                                                onCancel={() => setShowReplaceForm(false)}
                                                onSummarized={handleSummarized}
                                            />
                                        )}

                                        <div className="markdown-summary">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                                            >
                                                {selectedRound.contentSum}
                                            </ReactMarkdown>
                                        </div>

                                        <ConfirmDialog
                                            open={showDeleteConfirm}
                                            title="ลบสรุปนี้?"
                                            message={
                                                <>
                                                    ลบสรุป &ldquo;
                                                    <span className="font-medium text-ink">
                                                        {summaryDisplayLabel(selectedRound, documentInfo.title)}
                                                    </span>
                                                    &rdquo; การลบไม่สามารถย้อนกลับได้
                                                </>
                                            }
                                            confirmLabel="ลบสรุป"
                                            onConfirm={confirmDeleteSelected}
                                            onCancel={() => setShowDeleteConfirm(false)}
                                            loading={deletingSummary}
                                            errorMessage={deleteError}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                      </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default DocumentDetail;
