import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";
import { formatDateTime, pageRangeLabel } from "../utils/roundFormatting";
import Layout from "../components/Layout";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import SummarizeForm from "../components/SummarizeForm";

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
    summaryLabel: string;
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
    };

    if (loading) {
        return (
            <Layout>
                <p>กำลังโหลด...</p>
            </Layout>
        );
    }

    if (notFound || !documentInfo) {
        return (
            <Layout>
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
    const pageFragment = selectedRound?.startPage != null ? `#page=${selectedRound.startPage}` : "";
    const iframeSrc = fileBlobUrl ? `${fileBlobUrl}${pageFragment}` : undefined;

    return (
        <Layout>
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

                <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
                    <div
                        className={`${activeTab === "original" ? "flex" : "hidden"} min-h-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 lg:flex lg:h-full lg:overflow-y-auto`}
                    >
                        {fileLoading && (
                            <div className="flex items-center gap-2 text-sm text-ink-muted">
                                <Spinner />
                                กำลังโหลดไฟล์ต้นฉบับ...
                            </div>
                        )}

                        {!fileLoading && fileLoadError && <Alert variant="error">{fileLoadError}</Alert>}

                        {!fileLoading && !fileLoadError && documentInfo.fileType === "pdf" && (
                            <iframe
                                key={iframeKey}
                                src={iframeSrc}
                                title={`ต้นฉบับ: ${documentInfo.title}`}
                                className="min-h-[480px] flex-1 rounded-lg border border-border"
                            />
                        )}

                        {!fileLoading && !fileLoadError && documentInfo.fileType === "txt" && (
                            <pre className="min-h-[480px] flex-1 overflow-y-auto rounded-lg border border-border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-ink">
                                {fileTextContent}
                            </pre>
                        )}

                        {!fileLoading &&
                            !fileLoadError &&
                            documentInfo.fileType !== "pdf" &&
                            documentInfo.fileType !== "txt" && (
                                <Alert variant="warning">ไม่รองรับการแสดงตัวอย่างไฟล์ชนิดนี้</Alert>
                            )}

                        {fileBlobUrl && (
                            <a
                                href={fileBlobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary-700 underline"
                            >
                                เปิดต้นฉบับในแท็บใหม่
                            </a>
                        )}
                    </div>

                    <div
                        className={`${activeTab === "summary" ? "flex" : "hidden"} min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4 lg:flex lg:h-full lg:overflow-y-auto`}
                    >
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
                                            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                                round.summaryId === selectedSummaryId
                                                    ? "border-primary-600 bg-primary-50 text-primary-700"
                                                    : "border-border bg-surface text-ink-muted hover:bg-background"
                                            }`}
                                        >
                                            รอบที่ {round.roundNumber}
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
                                        <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
                                            <span className="font-medium text-ink">
                                                รอบที่ {selectedRound.roundNumber}
                                            </span>
                                            <span>·</span>
                                            <span>{pageRangeLabel(selectedRound)}</span>
                                            <span>·</span>
                                            <span>{formatDateTime(selectedRound.createdAt)}</span>
                                            {selectedRound.mode === "vision" && (
                                                <Badge variant="warning">อ่านแบบภาพ</Badge>
                                            )}
                                        </div>
                                        <div className="markdown-summary">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                                            >
                                                {selectedRound.contentSum}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default DocumentDetail;
