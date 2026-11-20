import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axiosClient";
import { APP_NAME } from "../constants/app";
import Card from "../components/Card";
import TextInput from "../components/TextInput";
import Button, { buttonClasses } from "../components/Button";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";

function Register() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleRegister = async () => {
        setSubmitting(true);
        setErrorMessage(null);

        try {
            await api.post("/api/auth/register", { name, email, password });
            navigate("/login", {
                state: { registeredMessage: "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ" },
            });
        } catch (error) {
            if (!axios.isAxiosError(error)) {
                setErrorMessage("สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            } else if (!error.response) {
                setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
            } else if (error.response.status === 409) {
                setErrorMessage("อีเมลนี้ถูกใช้งานแล้ว");
            } else if (error.response.status === 400) {
                const fieldErrors: Record<string, string> = error.response.data;
                setErrorMessage(
                    Object.entries(fieldErrors)
                        .map(([field, message]) => `${field}: ${message}`)
                        .join(", ")
                );
            } else {
                setErrorMessage("สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
                    <h1 className="text-2xl leading-normal font-semibold text-ink">สมัครสมาชิก</h1>
                    <p className="text-sm text-ink-muted">สร้างบัญชีเพื่อเริ่มสรุปเอกสารด้วย AI</p>
                </div>

                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleRegister();
                    }}
                >
                    <TextInput
                        label="ชื่อ"
                        type="text"
                        name="name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextInput
                        label="อีเมล"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="flex flex-col gap-1">
                        <TextInput
                            label="รหัสผ่าน"
                            type="password"
                            name="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <p className="text-xs text-ink-muted">อย่างน้อย 8 ตัวอักษร</p>
                    </div>

                    <Alert variant="warning">
                        ระบบนี้ใช้ OpenAI ในการสรุปเอกสาร ไฟล์ที่อัปโหลด (รวมภาพหน้าเอกสารในโหมดอ่านแบบภาพ)
                        จะถูกส่งไปประมวลผล โปรดอย่าอัปโหลดเอกสารส่วนตัวหรือความลับ และอย่าใช้รหัสผ่านเดียวกับบัญชีอื่น
                        ระบบนี้เป็นโปรเจกต์ทดสอบเพื่อการศึกษา
                    </Alert>

                    {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? (
                            <>
                                <Spinner />
                                กำลังสมัคร...
                            </>
                        ) : (
                            "สมัครสมาชิก"
                        )}
                    </Button>
                </form>

                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-ink-muted">มีบัญชีแล้ว?</p>
                    <Link to="/login" className={buttonClasses("secondary", "w-full")}>
                        เข้าสู่ระบบ
                    </Link>
                </div>
            </Card>
        </div>
    );
}

export default Register;
