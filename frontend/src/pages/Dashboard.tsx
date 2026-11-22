import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";
import { coveredPagesForSummaries, uncoveredPageRanges } from "../utils/pageRangeMerger";
import { formatDateTime, pageRangeLabel, summaryDisplayLabel, uncoveredPagesLabel } from "../utils/roundFormatting";
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

// A round's own range, or (when it covers the whole file) 1..pageCount so it can
// still be compared/sorted against partial ranges. null only when the file has no
// known page count at all (a TXT file), in which case page math doesn't apply.
function effectivePageRange(round: SummaryItem, pageCount: number | null): { start: number; end: number } | null {
    if (round.startPage != null && round.endPage != null) {
        return { start: round.startPage, end: round.endPage };
    }
    return pageCount != null ? { start: 1, end: pageCount } : null;
}

// Shared by the "รวมต่อเนื่อง" view and the "คัดลอกสรุปที่เลือก" button so both
// always agree on the same order: by start page ascending (a whole-file round
// counts as starting at page 1), ties broken by when it was created.
function sortRoundsForCombinedView(rounds: Round[]): Round[] {
    return [...rounds].sort((a, b) => {
        const startA = a.startPage ?? 1;
        const startB = b.startPage ?? 1;
        if (startA !== startB) {
            return startA - startB;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

function buildCombinedMarkdown(rounds: Round[], documentTitle: string): string {
    return sortRoundsForCombinedView(rounds)
        .map((round) => `## ${summaryDisplayLabel(round, documentTitle)}\n\n${round.contentSum}`)
        .join("\n\n---\n\n");
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
    const [expandedRoundIds, setExpandedRoundIds] = useState<Set<number>>(new Set());
    const [overviewViewMode, setOverviewViewMode] = useState<"separate" | "combined">("separate");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
    const copyStatusTimeoutRef = useRef<number | null>(null);

    const [summarizeTarget, setSummarizeTarget] = useState<DocumentCardItem | null>(null);

    useEffect(() => {
        return () => {
            if (copyStatusTimeoutRef.current != null) {
                window.clearTimeout(copyStatusTimeoutRef.current);
            }
        };
    }, []);

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
        setExpandedRoundIds(new Set());

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

    const toggleRoundExpanded = (summaryId: number) => {
        setExpandedRoundIds((prev) => {
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

    const handleCopySelected = async (documentTitle: string, roundsToCopy: Round[]) => {
        if (roundsToCopy.length === 0) {
            return;
        }
        const markdown = buildCombinedMarkdown(roundsToCopy, documentTitle);

        let succeeded = true;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(markdown);
            } else {
                copyWithFallbackTextarea(markdown);
            }
        } catch {
            try {
                copyWithFallbackTextarea(markdown);
            } catch {
                succeeded = false;
            }
        }

        setCopyStatus(succeeded ? "copied" : "error");
        if (copyStatusTimeoutRef.current != null) {
            window.clearTimeout(copyStatusTimeoutRef.current);
        }
        copyStatusTimeoutRef.current = window.setTimeout(() => setCopyStatus("idle"), 2000);
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

    const selectedOverviewCoveredPages =
        selectedDocument && selectedRounds.length > 0
            ? coveredPagesForSummaries(
                  selectedRounds.map((round) => ({ startPage: round.startPage, endPage: round.endPage })),
                  selectedDocument.pageCount
              )
            : null;

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

    const sortedSelectedRounds = sortRoundsForCombinedView(selectedRounds);
    const combinedEffectiveRanges = selectedDocument
        ? selectedRounds
              .map((round) => effectivePageRange(round, selectedDocument.pageCount))
              .filter((range): range is { start: number; end: number } => range != null)
        : [];
    const combinedMinStart =
        combinedEffectiveRanges.length > 0 ? Math.min(...combinedEffectiveRanges.map((r) => r.start)) : null;
    const combinedMaxEnd =
        combinedEffectiveRanges.length > 0 ? Math.max(...combinedEffectiveRanges.map((r) => r.end)) : null;

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
                                        <h2 className="text-base font-semibold text-ink">ภาพรวมที่เลือก</h2>
                                        <div className="flex flex-wrap gap-2">
                                            <div className="flex overflow-hidden rounded-lg border border-border text-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => setOverviewViewMode("separate")}
                                                    aria-pressed={overviewViewMode === "separate"}
                                                    className={`px-3 py-1.5 font-medium transition-colors ${
                                                        overviewViewMode === "separate"
                                                            ? "bg-primary-50 text-primary-700"
                                                            : "bg-surface text-ink-muted hover:bg-background"
                                                    }`}
                                                >
                                                    แยกรายสรุป
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setOverviewViewMode("combined")}
                                                    aria-pressed={overviewViewMode === "combined"}
                                                    className={`border-l border-border px-3 py-1.5 font-medium transition-colors ${
                                                        overviewViewMode === "combined"
                                                            ? "bg-primary-50 text-primary-700"
                                                            : "bg-surface text-ink-muted hover:bg-background"
                                                    }`}
                                                >
                                                    รวมต่อเนื่อง
                                                </button>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                disabled={selectedRounds.length === 0}
                                                onClick={() =>
                                                    handleCopySelected(selectedDocument.title, sortedSelectedRounds)
                                                }
                                            >
                                                {copyStatus === "copied" ? "คัดลอกแล้ว" : "คัดลอกสรุปที่เลือก"}
                                            </Button>
                                        </div>
                                    </div>

                                    {copyStatus === "error" && (
                                        <Alert variant="error">คัดลอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</Alert>
                                    )}

                                    <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
                                        <span>จำนวนสรุปที่เลือก: {selectedRounds.length}</span>
                                        {selectedOverviewCoveredPages != null && (
                                            <span>หน้ารวม (ไม่ซ้ำ): {selectedOverviewCoveredPages} หน้า</span>
                                        )}
                                        <span>
                                            ช่วงวันที่ {formatDateTime(selectedRounds[0].createdAt)} —{" "}
                                            {formatDateTime(selectedRounds[selectedRounds.length - 1].createdAt)}
                                        </span>
                                    </div>

                                    {overviewViewMode === "separate" ? (
                                        <div className="flex flex-col gap-3">
                                            {selectedRounds.map((round) => {
                                                const expanded = expandedRoundIds.has(round.summaryId);
                                                return (
                                                    <div
                                                        key={round.summaryId}
                                                        className="rounded-xl border border-border"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRoundExpanded(round.summaryId)}
                                                                className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left text-sm font-medium text-ink"
                                                            >
                                                                <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                                                                <span
                                                                    className="min-w-0 max-w-full truncate"
                                                                    title={summaryDisplayLabel(round, selectedDocument.title)}
                                                                >
                                                                    {summaryDisplayLabel(round, selectedDocument.title)}
                                                                </span>
                                                                <span className="text-ink-muted">·</span>
                                                                <span className="text-ink-muted">{pageRangeLabel(round)}</span>
                                                                <span className="text-ink-muted">·</span>
                                                                <span className="text-ink-muted">
                                                                    {formatDateTime(round.createdAt)}
                                                                </span>
                                                                {round.mode === "vision" && (
                                                                    <Badge variant="warning">อ่านแบบภาพ</Badge>
                                                                )}
                                                            </button>
                                                            <Button
                                                                variant="secondary"
                                                                onClick={() => navigate(`/documents/${round.documentId}`)}
                                                            >
                                                                เปิดหน้าเอกสาร
                                                            </Button>
                                                        </div>
                                                        {expanded && (
                                                            <div className="markdown-summary border-t border-border p-3">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkMath]}
                                                                    rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                                                                >
                                                                    {round.contentSum}
                                                                </ReactMarkdown>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <p className="text-sm font-medium text-ink">
                                                {selectedDocument.pageCount != null &&
                                                combinedMinStart != null &&
                                                combinedMaxEnd != null
                                                    ? `ครอบคลุมหน้า ${combinedMinStart}-${combinedMaxEnd} (${
                                                          selectedOverviewCoveredPages ?? 0
                                                      } หน้า) · ${selectedRounds.length} สรุป`
                                                    : `${selectedRounds.length} สรุป`}
                                            </p>
                                            <div className="mx-auto flex w-full max-w-[700px] min-w-0 flex-col rounded-xl border border-border p-4">
                                                {sortedSelectedRounds.map((round, index) => (
                                                    <div
                                                        key={round.summaryId}
                                                        className={index > 0 ? "mt-4 border-t border-border pt-4" : ""}
                                                    >
                                                        <h3
                                                            className="mb-2 min-w-0 truncate text-sm font-semibold text-ink"
                                                            title={summaryDisplayLabel(round, selectedDocument.title)}
                                                        >
                                                            {summaryDisplayLabel(round, selectedDocument.title)}
                                                        </h3>
                                                        <div className="markdown-summary">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkMath]}
                                                                rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                                                            >
                                                                {round.contentSum}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </div>
                                                ))}
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
