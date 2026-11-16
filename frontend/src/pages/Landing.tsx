import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Card from "../components/Card";
import { APP_NAME, APP_TAGLINE } from "../constants/app";

type FeatureTone = "lavender" | "peach" | "blush";

interface Feature {
    icon: string;
    title: string;
    description: string;
    tone: FeatureTone;
}

const FEATURES: Feature[] = [
    {
        icon: "📄",
        title: "อัปโหลด PDF หรือ TXT",
        description: "นำไฟล์เอกสารหรือสไลด์เข้าสู่ระบบได้ง่าย ๆ ไม่กี่คลิก",
        tone: "lavender",
    },
    {
        icon: "📑",
        title: "เลือกช่วงหน้าที่เรียนในสัปดาห์นั้น",
        description: "สรุปเฉพาะเนื้อหาที่ต้องใช้ทบทวน ไม่ต้องอ่านทั้งเล่ม",
        tone: "peach",
    },
    {
        icon: "🖼️",
        title: "อ่านแบบภาพ สำหรับไฟล์สแกนและสูตร",
        description: "รองรับเอกสารที่เป็นภาพสแกนหรือมีสูตรคณิตศาสตร์ปนอยู่",
        tone: "blush",
    },
    {
        icon: "📊",
        title: "เก็บสรุปย้อนหลัง พร้อม Dashboard",
        description: "ดูสรุปที่เคยทำไว้ทั้งหมดและความคืบหน้าในที่เดียว",
        tone: "lavender",
    },
];

const STEPS = [
    { number: 1, title: "อัปโหลดเอกสาร" },
    { number: 2, title: "เลือกช่วงหน้า" },
    { number: 3, title: "ได้สรุป" },
];

function Landing() {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem("token")));
    const [imageError, setImageError] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsLoggedIn(false);
    };

    const primaryAction = isLoggedIn
        ? { label: "ไปที่ Dashboard", path: "/dashboard" }
        : { label: "เริ่มต้นทดลองใช้", path: "/register" };

    return (
        <div className="flex min-h-svh flex-col bg-background text-ink">
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link to="/" className="text-lg font-semibold text-primary-700">
                        {APP_NAME}
                    </Link>
                    {isLoggedIn ? (
                        <Button variant="secondary" onClick={handleLogout}>
                            ออกจากระบบ
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={() => navigate("/login")}>
                            เข้าสู่ระบบ
                        </Button>
                    )}
                </div>
            </header>

            <main className="flex-1">
                <section className="bg-gradient-to-br from-lavender via-blush to-peach">
                    <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-12 sm:px-6 md:flex-row md:py-20">
                        <div className="flex flex-col items-center gap-4 text-center md:w-1/2 md:items-start md:text-left">
                            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{APP_NAME}</h1>
                            <p className="text-base font-medium text-primary-600 sm:text-lg">{APP_TAGLINE}</p>
                            <p className="text-base text-ink-muted">
                                ไม่ต้องอ่านสไลด์ทั้งเทอมซ้ำ ได้สรุปรายสัปดาห์ที่ย้อนดูได้ทันที
                            </p>
                            <Button onClick={() => navigate(primaryAction.path)}>{primaryAction.label}</Button>
                        </div>

                        <div className="w-full md:w-1/2">
                            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
                                <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-2">
                                    <span className="h-3 w-3 rounded-full bg-danger-500" />
                                    <span className="h-3 w-3 rounded-full bg-warning-500" />
                                    <span className="h-3 w-3 rounded-full bg-success-500" />
                                </div>
                                <div className="aspect-[16/10] bg-background">
                                    {imageError ? (
                                        <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
                                            <span className="text-4xl" aria-hidden="true">
                                                🖥️
                                            </span>
                                            <p className="text-sm">ตัวอย่างหน้าจอ {APP_NAME}</p>
                                        </div>
                                    ) : (
                                        <img
                                            src="/images/hero.png"
                                            alt={`ตัวอย่างหน้าจอ ${APP_NAME}`}
                                            className="h-full w-full object-cover"
                                            onError={() => setImageError(true)}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {FEATURES.map((feature) => (
                            <Card key={feature.title} tone={feature.tone} className="flex flex-col gap-2">
                                <span className="text-2xl" aria-hidden="true">
                                    {feature.icon}
                                </span>
                                <h2 className="text-base font-semibold text-ink">{feature.title}</h2>
                                <p className="text-sm text-ink-muted">{feature.description}</p>
                            </Card>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
                    <h2 className="mb-6 text-center text-xl font-semibold text-ink">ใช้งานอย่างไร</h2>
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
                        {STEPS.map((step, index) => (
                            <div key={step.number} className="flex items-center gap-4">
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white">
                                        {step.number}
                                    </span>
                                    <p className="text-sm font-medium text-ink">{step.title}</p>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <span className="hidden text-ink-muted sm:inline" aria-hidden="true">
                                        &rarr;
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            <footer className="border-t border-border bg-surface px-4 py-10 text-center sm:px-6">
                <p className="mx-auto max-w-xl text-sm text-ink-muted">
                    โปรเจกต์ทดสอบเพื่อการศึกษา ไฟล์ที่อัปโหลดจะถูกส่งให้ OpenAI ประมวลผล โปรดอย่าอัปโหลดเอกสารส่วนตัว
                </p>
                <div className="mt-4">
                    <Button onClick={() => navigate(primaryAction.path)}>{primaryAction.label}</Button>
                </div>
            </footer>
        </div>
    );
}

export default Landing;
