import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import api from "../api/axiosClient";
import { getErrorMessage, getErrorStatus } from "../api/errorMessage";
import { uncoveredPageRanges } from "../utils/pageRangeMerger";
import { formatDateTime, pageRangeLabel, summaryDisplayLabel, uncoveredPagesLabel } from "../utils/roundFormatting";
import { overviewCacheKey } from "../utils/overviewCacheKey";
import Layout from "../components/Layout";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import WeeklyActivityChart, { type WeeklyActivityPoint } from "../components/WeeklyActivityChart";
import SummarizeModal from "../components/SummarizeModal";
import type { DocumentCardItem } from "../components/DocumentCard";

interface DashboardDocumentItem {
    documentId: number;
    title: string;
    fileType: string;
    pageCount: number | null;
    summaryCount: number;
    coveredPages: number | null;
    firstSummaryAt: string | null;
    lastSummaryAt: string | null;
}

interface DashboardData {
    totalDocuments: number;
    totalSummaries: number;
    summariesThisWeek: number;
    summariesToday: number;
    dailyLimit: number;
    documents: DashboardDocumentItem[];
    weeklyActivity: WeeklyActivityPoint[];
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

// navigator.clipboard requires a secure context; this covers http/older browsers.
function copyWithFallbackTextarea(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!succeeded) {
        throw new Error("execCommand copy failed");
    }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            copyWithFallbackTextarea(text);
        }
        return true;
    } catch {
        try {
            copyWithFallbackTextarea(text);
            return true;
        } catch {
            return false;
        }
    }
}

interface OverviewResult {
    overviewMarkdown: string;
}

// The AI's overviewMarkdown already has URLs stripped server-side, but this is a
// second, defensive layer: links are never rendered as clickable here regardless of
// what the model returns, so AI-controlled content can never produce an actual
// <a href> in the page.
function PlainTextLink({ children }: { children?: ReactNode }) {
    return <>{children}</>;
}

const overviewMarkdownComponents = { a: PlainTextLink };

// Mirrors the backend's summary.overview-max-items default (12) so the button can
// be disabled before ever making the request, instead of letting it fail with 400.
const MAX_OVERVIEW_SUMMARIES = 12;

function pickDefaultDocument(documents: DashboardDocumentItem[]): DashboardDocumentItem | null {
    const mostRecentlySummarized = [...documents]
        .filter((doc) => doc.lastSummaryAt != null)
        .sort(
            (a, b) => new Date(b.lastSummaryAt as string).getTime() - new Date(a.lastSummaryAt as string).getTime()
        )[0];

    return mostRecentlySummarized ?? documents[0] ?? null;
}

function Dashboard() {
    const navigate = useNavigate();

    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [dashboardError, setDashboardError] = useState<string | null>(null);

    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
    const [rounds, setRounds] = useState<Round[]>([]);
    const [loadingRounds, setLoadingRounds] = useState(false);
    const [roundsError, setRoundsError] = useState<string | null>(null);

    const [selectedRoundIds, setSelectedRoundIds] = useState<Set<number>>(new Set());

    // AI overview ("ภาพรวมโดย AI"): cache lives in a ref (not state) so writing to it
    // never itself triggers a render; aiOverviewCacheVersion is bumped after every
    // write purely to force a re-render so the cache.get() read below picks it up.
    const aiOverviewCacheRef = useRef<Map<string, OverviewResult>>(new Map());
    const [aiOverviewCacheVersion, setAiOverviewCacheVersion] = useState(0);
    const [aiOverviewLoading, setAiOverviewLoading] = useState(false);
    const [aiOverviewError, setAiOverviewError] = useState<{ key: string; message: string } | null>(null);
    const [aiOverviewCopyStatus, setAiOverviewCopyStatus] = useState<"idle" | "copied" | "error">("idle");
    const aiOverviewCopyTimeoutRef = useRef<number | null>(null);
    // Holds the live selectedRoundIds so an in-flight request can tell, once it
    // resolves, whether the user is still looking at the set it was asked for.
    const selectedRoundIdsRef = useRef<Set<number>>(new Set());

    const [summarizeTarget, setSummarizeTarget] = useState<DocumentCardItem | null>(null);

    useEffect(() => {
        return () => {
            if (aiOverviewCopyTimeoutRef.current != null) {
                window.clearTimeout(aiOverviewCopyTimeoutRef.current);
            }
        };
    }, []);

    // A fresh document means a fresh set of summaries, so any cached overview (keyed
    // only by summary id, not document id) would be meaningless for the new one.
    useEffect(() => {
        aiOverviewCacheRef.current.clear();
        setAiOverviewCacheVersion((v) => v + 1);
        setAiOverviewError(null);
        setAiOverviewLoading(false);
    }, [selectedDocumentId]);

    const loadDashboard = useCallback(async () => {
        try {
            const response = await api.get<DashboardData>("/api/dashboard");
            setDashboard(response.data);
            setDashboardError(null);
            return response.data;
        } catch (error) {
            setDashboardError(getErrorMessage(error, "โหลดข้อมูล Dashboard ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
            return null;
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        (async () => {
            const data = await loadDashboard();
            if (data) {
                const defaultDoc = pickDefaultDocument(data.documents);
                setSelectedDocumentId(defaultDoc ? defaultDoc.documentId : null);
            }
            setLoadingDashboard(false);
        })();
    }, [navigate, loadDashboard]);

    const fetchRounds = useCallback(async (documentId: number) => {
        setLoadingRounds(true);
        setRoundsError(null);
        setSelectedRoundIds(new Set());

        try {
            const response = await api.get<SummaryItem[]>(`/api/documents/${documentId}/summaries`);
            const sorted = [...response.data].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            setRounds(sorted.map((summary, index) => ({ ...summary, roundNumber: index + 1 })));
        } catch (error) {
            setRoundsError(getErrorMessage(error, "โหลดประวัติสรุปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        } finally {
            setLoadingRounds(false);
        }
    }, []);

    useEffect(() => {
        if (selectedDocumentId != null) {
            fetchRounds(selectedDocumentId);
        } else {
            setRounds([]);
        }
    }, [selectedDocumentId, fetchRounds]);

    useEffect(() => {
        selectedRoundIdsRef.current = selectedRoundIds;
    }, [selectedRoundIds]);

    const toggleRoundSelected = (summaryId: number) => {
        setSelectedRoundIds((prev) => {
            const next = new Set(prev);
            if (next.has(summaryId)) {
                next.delete(summaryId);
            } else {
                next.add(summaryId);
            }
            return next;
        });
    };

    const handleSelectAll = () => setSelectedRoundIds(new Set(rounds.map((r) => r.summaryId)));
    const handleSelectLastThree = () =>
        setSelectedRoundIds(new Set(rounds.slice(-3).map((r) => r.summaryId)));
    const handleClearSelection = () => setSelectedRoundIds(new Set());

    // Shared by the first "สร้างภาพรวม" and the later "สร้างใหม่": both just ask the
    // AI to write an overview for whatever is ticked right now and cache it under
    // that set's key. Never called automatically from a tick change, only on click.
    const handleGenerateOverview = async (documentId: number, summaryIds: number[]) => {
        if (aiOverviewLoading) {
            return;
        }
        const key = overviewCacheKey(summaryIds);
        setAiOverviewLoading(true);
        setAiOverviewError(null);

        try {
            const response = await api.post<OverviewResult>(`/api/documents/${documentId}/overview`, {
                summaryIds,
            });
            // Always cached under the request's own key, even if the user has since
            // ticked a different set — see the module comment on selectedRoundIdsRef.
            aiOverviewCacheRef.current.set(key, response.data);
            setAiOverviewCacheVersion((v) => v + 1);
        } catch (error) {
            const currentKey = overviewCacheKey(Array.from(selectedRoundIdsRef.current));
            // Only surface the error if the user is still looking at the set that
            // failed; otherwise it would be shown next to an unrelated selection.
            if (currentKey === key) {
                const status = getErrorStatus(error);
                let message: string;
                if (status === 429) {
                    message = "ใช้โควต้าภาพรวมของวันนี้ครบแล้ว ลองใหม่ได้พรุ่งนี้";
                } else if (status === 400) {
                    message = "เลือกสรุปมากเกินไปหรือเนื้อหารวมยาวเกินไป ลองเลือกให้น้อยลง";
                } else {
                    // Covers both 502 (AI response failures) and network errors.
                    message = getErrorMessage(error, "สร้างภาพรวมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
                }
                setAiOverviewError({ key, message });
            }
        } finally {
            setAiOverviewLoading(false);
        }
    };

    const handleCopyOverview = async (markdown: string) => {
        const succeeded = await copyTextToClipboard(markdown);
        setAiOverviewCopyStatus(succeeded ? "copied" : "error");
        if (aiOverviewCopyTimeoutRef.current != null) {
            window.clearTimeout(aiOverviewCopyTimeoutRef.current);
        }
        aiOverviewCopyTimeoutRef.current = window.setTimeout(() => setAiOverviewCopyStatus("idle"), 2000);
    };

    const handleSummarized = async (documentId: number) => {
        setSummarizeTarget(null);
        await loadDashboard();
        await fetchRounds(documentId);
    };

    if (loadingDashboard) {
        return (
            <Layout>
                <p>กำลังโหลด...</p>
            </Layout>
        );
    }

    if (!dashboard) {
        return (
            <Layout>
                {dashboardError && <Alert variant="error">{dashboardError}</Alert>}
            </Layout>
        );
    }

    const selectedDocument = dashboard.documents.find((doc) => doc.documentId === selectedDocumentId) ?? null;
    const selectedRounds = rounds.filter((round) => selectedRoundIds.has(round.summaryId));

    const documentProgressPercent =
        selectedDocument?.coveredPages != null && selectedDocument.pageCount != null && selectedDocument.pageCount > 0
            ? Math.min(100, Math.round((selectedDocument.coveredPages / selectedDocument.pageCount) * 100))
            : null;

    // "ยังไม่ได้สรุป" is computed from every round of the document (not just the
    // ticked ones), and only makes sense for a PDF whose page count is known.
    const showUncoveredStat =
        selectedDocument != null &&
        selectedDocument.fileType === "pdf" &&
        selectedDocument.pageCount != null &&
        !loadingRounds;
    const uncoveredLabel = showUncoveredStat
        ? uncoveredPagesLabel(
              uncoveredPageRanges(
                  rounds.map((r) => ({ startPage: r.startPage, endPage: r.endPage })),
                  selectedDocument!.pageCount as number
              )
          )
        : null;

    // Re-read on every render (including the version bump after a cache write) so
    // ticking back to an already-generated set shows its result immediately, with
    // no API call. aiOverviewCacheVersion itself is only a render trigger here.
    void aiOverviewCacheVersion;
    const currentOverviewKey = overviewCacheKey(selectedRounds.map((round) => round.summaryId));
    const cachedOverview = aiOverviewCacheRef.current.get(currentOverviewKey) ?? null;

    return (
        <Layout>
            <h1 className="text-2xl leading-normal font-semibold text-ink">Dashboard</h1>

            {dashboardError && <Alert variant="error">{dashboardError}</Alert>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="flex flex-col gap-1 p-4">
                    <span className="text-xs text-ink-muted">เอกสารทั้งหมด</span>
                    <span className="text-2xl font-semibold text-ink">{dashboard.totalDocuments}</span>
                </Card>
                <Card className="flex flex-col gap-1 p-4">
                    <span className="text-xs text-ink-muted">รอบสรุปทั้งหมด</span>
                    <span className="text-2xl font-semibold text-ink">{dashboard.totalSummaries}</span>
                </Card>
                <Card className="flex flex-col gap-1 p-4">
                    <span className="text-xs text-ink-muted">สรุปสัปดาห์นี้</span>
                    <span className="text-2xl font-semibold text-ink">{dashboard.summariesThisWeek}</span>
                </Card>
                <Card className="flex flex-col gap-1 p-4">
                    <span className="text-xs text-ink-muted">โควต้าวันนี้</span>
                    <span className="text-2xl font-semibold text-ink">
                        {dashboard.summariesToday}/{dashboard.dailyLimit}
                    </span>
                </Card>
            </div>

            <Card className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-ink">กิจกรรมรายสัปดาห์</h2>
                <WeeklyActivityChart data={dashboard.weeklyActivity} />
            </Card>

            {dashboard.documents.length === 0 ? (
                <Card className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-sm text-ink-muted">ยังไม่มีเอกสาร อัปโหลดเอกสารแรกของคุณเพื่อเริ่มดูสถิติ</p>
                    <Button onClick={() => navigate("/documents")}>ไปที่เอกสารของฉัน</Button>
                </Card>
            ) : (
                <>
                    <Card className="flex flex-col gap-3">
                        <h2 className="text-base font-semibold text-ink">เลือกเอกสาร</h2>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {dashboard.documents.map((doc) => (
                                <button
                                    key={doc.documentId}
                                    type="button"
                                    onClick={() => setSelectedDocumentId(doc.documentId)}
                                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                        doc.documentId === selectedDocumentId
                                            ? "border-primary-600 bg-primary-50 text-primary-700"
                                            : "border-border bg-surface text-ink-muted hover:bg-background"
                                    }`}
                                >
                                    <span className="line-clamp-1 max-w-[160px]">{doc.title}</span>
                                    <span className="text-xs text-ink-muted">({doc.summaryCount})</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {selectedDocument && selectedDocument.summaryCount === 0 && (
                        <Card className="flex flex-col items-center gap-3 py-8 text-center">
                            <p className="text-sm text-ink-muted">เอกสาร "{selectedDocument.title}" ยังไม่เคยสรุป</p>
                            <Button
                                onClick={() =>
                                    setSummarizeTarget({
                                        documentId: selectedDocument.documentId,
                                        title: selectedDocument.title,
                                        fileType: selectedDocument.fileType,
                                        pageCount: selectedDocument.pageCount,
                                        summaryCount: selectedDocument.summaryCount,
                                        coveredPages: selectedDocument.coveredPages,
                                        lastSummaryAt: selectedDocument.lastSummaryAt,
                                    })
                                }
                            >
                                ไปสรุป
                            </Button>
                        </Card>
                    )}

                    {selectedDocument && selectedDocument.summaryCount > 0 && (
                        <>
                            <Card className="flex flex-col gap-4">
                                <h2 className="text-base font-semibold text-ink">{selectedDocument.title}</h2>
                                <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
                                    <span>จำนวนสรุป: {selectedDocument.summaryCount}</span>
                                    {selectedDocument.coveredPages != null && selectedDocument.pageCount != null && (
                                        <span>
                                            หน้าที่สรุปแล้ว {selectedDocument.coveredPages}/{selectedDocument.pageCount}
                                        </span>
                                    )}
                                    {selectedDocument.firstSummaryAt && selectedDocument.lastSummaryAt && (
                                        <span>
                                            ช่วงวันที่ {formatDateTime(selectedDocument.firstSummaryAt)} —{" "}
                                            {formatDateTime(selectedDocument.lastSummaryAt)}
                                        </span>
                                    )}
                                </div>
                                {documentProgressPercent != null && (
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                                        <div
                                            className="h-full rounded-full bg-primary-500"
                                            style={{ width: `${documentProgressPercent}%` }}
                                        />
                                    </div>
                                )}

                                {showUncoveredStat && (
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        {uncoveredLabel ? (
                                            <>
                                                <span className="text-ink-muted">ยังไม่ได้สรุป: {uncoveredLabel}</span>
                                                <Link
                                                    to={`/documents/${selectedDocument.documentId}`}
                                                    className="font-medium text-primary-700 underline"
                                                >
                                                    สรุปต่อ
                                                </Link>
                                            </>
                                        ) : (
                                            <span className="font-medium text-success-800">สรุปครบทุกหน้าแล้ว</span>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="secondary" onClick={handleSelectAll}>
                                        เลือกทั้งหมด
                                    </Button>
                                    <Button variant="secondary" onClick={handleSelectLastThree}>
                                        3 รอบล่าสุด
                                    </Button>
                                    <Button variant="secondary" onClick={handleClearSelection}>
                                        ล้างการเลือก
                                    </Button>
                                </div>

                                {roundsError && <Alert variant="error">{roundsError}</Alert>}

                                {loadingRounds ? (
                                    <div className="flex items-center gap-2 text-sm text-ink-muted">
                                        <Spinner />
                                        กำลังโหลด...
                                    </div>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {rounds.map((round) => (
                                            <li key={round.summaryId}>
                                                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-background">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-0.5"
                                                        checked={selectedRoundIds.has(round.summaryId)}
                                                        onChange={() => toggleRoundSelected(round.summaryId)}
                                                    />
                                                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-ink">
                                                        <span
                                                            className="min-w-0 max-w-full truncate font-medium"
                                                            title={summaryDisplayLabel(round, selectedDocument.title)}
                                                        >
                                                            {summaryDisplayLabel(round, selectedDocument.title)}
                                                        </span>
                                                        <span className="text-ink-muted">·</span>
                                                        <span>{pageRangeLabel(round)}</span>
                                                        <span className="text-ink-muted">·</span>
                                                        <span className="text-ink-muted">
                                                            {formatDateTime(round.createdAt)}
                                                        </span>
                                                        {round.mode === "vision" && (
                                                            <Badge variant="warning">อ่านแบบภาพ</Badge>
                                                        )}
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            {selectedRounds.length > 0 && (
                                <Card className="flex flex-col gap-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h2 className="text-base font-semibold text-ink">ภาพรวมโดย AI</h2>
                                        <span className="text-sm text-ink-muted">
                                            เลือกแล้ว {selectedRounds.length} สรุป
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button
                                            variant={cachedOverview ? "secondary" : "primary"}
                                            disabled={
                                                aiOverviewLoading || selectedRounds.length > MAX_OVERVIEW_SUMMARIES
                                            }
                                            onClick={() =>
                                                handleGenerateOverview(
                                                    selectedDocument.documentId,
                                                    selectedRounds.map((round) => round.summaryId)
                                                )
                                            }
                                        >
                                            {cachedOverview ? "สร้างใหม่" : "สร้างภาพรวม"}
                                        </Button>
                                        {selectedRounds.length > MAX_OVERVIEW_SUMMARIES ? (
                                            <span className="text-xs text-danger-700">
                                                เลือกได้สูงสุด 12 สรุปต่อภาพรวม
                                            </span>
                                        ) : (
                                            <span className="text-xs text-ink-muted">
                                                นับเป็นโควต้าภาพรวมของวัน
                                            </span>
                                        )}
                                    </div>

                                    {aiOverviewLoading && (
                                        <div className="flex items-center gap-2 text-sm text-ink-muted">
                                            <Spinner />
                                            กำลังเขียนภาพรวม อาจใช้เวลาถึง 30 วินาที
                                        </div>
                                    )}

                                    {aiOverviewError && aiOverviewError.key === currentOverviewKey && (
                                        <Alert variant="error">{aiOverviewError.message}</Alert>
                                    )}

                                    {cachedOverview && (
                                        <div className="flex flex-col gap-4">
                                            <Alert variant="warning">
                                                สร้างโดย AI จากสรุปที่เลือก อาจคลาดเคลื่อน ควรตรวจกับสรุปต้นฉบับ
                                            </Alert>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => handleCopyOverview(cachedOverview.overviewMarkdown)}
                                                >
                                                    {aiOverviewCopyStatus === "copied"
                                                        ? "คัดลอกแล้ว"
                                                        : "คัดลอกภาพรวม"}
                                                </Button>
                                            </div>

                                            {aiOverviewCopyStatus === "error" && (
                                                <Alert variant="error">คัดลอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</Alert>
                                            )}

                                            <div className="markdown-summary mx-auto w-full max-w-[700px] min-w-0">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkMath]}
                                                    rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                                                    components={overviewMarkdownComponents}
                                                >
                                                    {cachedOverview.overviewMarkdown}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            )}
                        </>
                    )}
                </>
            )}

            <SummarizeModal
                document={summarizeTarget}
                onClose={() => setSummarizeTarget(null)}
                onSummarized={handleSummarized}
            />
        </Layout>
    );
}

export default Dashboard;
