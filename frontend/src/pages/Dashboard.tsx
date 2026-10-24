import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { getErrorMessage } from "../api/errorMessage";
import { stripMarkdown } from "../utils/stripMarkdown";

interface RecentSummaryItem {
    summaryId: number;
    documentId: number;
    summaryLabel: string;
    createdAt: string;
    contentSum: string;
}

interface DashboardData {
    totalDocuments: number;
    totalSummaries: number;
    summariesToday: number;
    dailyLimit: number;
    recentSummaries: RecentSummaryItem[];
}

function Dashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        const load = async () => {
            try {
                const response = await api.get<DashboardData>("/api/dashboard");
                setData(response.data);
            } catch (error) {
                setErrorMessage(getErrorMessage(error, "โหลดข้อมูล Dashboard ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    if (loading) {
        return <p>กำลังโหลด...</p>;
    }

    return (
        <div>
            <button onClick={handleLogout}>ออกจากระบบ</button>
            <h1>Dashboard</h1>
            <button onClick={() => navigate("/documents")}>ไปหน้ารายการเอกสาร</button>

            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

            {data && (
                <>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                        <div style={{ border: "1px solid #ccc", padding: "1rem" }}>
                            <p>เอกสารทั้งหมด</p>
                            <p>{data.totalDocuments}</p>
                        </div>
                        <div style={{ border: "1px solid #ccc", padding: "1rem" }}>
                            <p>สรุปทั้งหมด</p>
                            <p>{data.totalSummaries}</p>
                        </div>
                        <div style={{ border: "1px solid #ccc", padding: "1rem" }}>
                            <p>สรุปวันนี้</p>
                            <p>
                                {data.summariesToday} / {data.dailyLimit}
                            </p>
                        </div>
                    </div>

                    <h2 style={{ marginTop: "1.5rem" }}>สรุปล่าสุด</h2>
                    {data.recentSummaries.length === 0 ? (
                        <p>ยังไม่มีสรุป</p>
                    ) : (
                        <ul>
                            {data.recentSummaries.map((summary) => (
                                <li
                                    key={summary.summaryId}
                                    onClick={() => navigate(`/documents/${summary.documentId}`)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <strong>{summary.summaryLabel}</strong> —{" "}
                                    {new Date(summary.createdAt).toLocaleString("th-TH")}
                                    <p>{stripMarkdown(summary.contentSum)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}

export default Dashboard;
