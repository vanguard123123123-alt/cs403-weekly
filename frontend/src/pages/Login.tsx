import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axiosClient";
import { APP_NAME } from "../constants/app";
import Card from "../components/Card";
import TextInput from "../components/TextInput";
import Button, { buttonClasses } from "../components/Button";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage] = useState<string | null>(
        (location.state as { registeredMessage?: string } | null)?.registeredMessage ?? null
    );

    const handleLogin = async () => {
        setSubmitting(true);
        setErrorMessage(null);

        try {
            const response = await api.post("/api/auth/login", {
                email: email,
                password: password,
            });
            localStorage.setItem("token", response.data.token);
            navigate("/documents");
        } catch (error) {
            console.log("Login ไม่สำเร็จ:", error);
            if (!axios.isAxiosError(error)) {
                setErrorMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            } else if (!error.response) {
                setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
            } else if (error.response.status === 401) {
                setErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            } else {
                setErrorMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-gradient-to-br from-lavender via-blush to-peach px-4 py-8">
            <div className="w-full max-w-[420px]">
                <Link
                    to="/"
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                >
                    <span aria-hidden="true">←</span>
                    กลับหน้าหลัก
                </Link>
            </div>
            <Card className="flex w-full max-w-[420px] flex-col gap-6">
                <div className="flex flex-col items-center gap-1 text-center">
                    <Link to="/" className="text-sm font-semibold text-primary-700">
                        {APP_NAME}
                    </Link>
                    <h1 className="text-2xl leading-normal font-semibold text-ink">เข้าสู่ระบบ</h1>
                    <p className="text-sm text-ink-muted">ยินดีต้อนรับกลับ เข้าสู่ระบบเพื่อดูสรุปเอกสารของคุณ</p>
                </div>

                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleLogin();
                    }}
                >
                    <TextInput
                        label="อีเมล"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextInput
                        label="รหัสผ่าน"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {successMessage && <Alert variant="success">{successMessage}</Alert>}
                    {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? (
                            <>
                                <Spinner />
                                กำลังเข้าสู่ระบบ...
                            </>
                        ) : (
                            "เข้าสู่ระบบ"
                        )}
                    </Button>
                </form>

                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-ink-muted">ยังไม่มีบัญชี?</p>
                    <Link to="/register" className={buttonClasses("secondary", "w-full")}>
                        สมัครสมาชิก
                    </Link>
                </div>
            </Card>
        </div>
    );
}

export default Login;
