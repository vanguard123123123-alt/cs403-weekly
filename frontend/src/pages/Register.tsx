import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axiosClient";

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
        <div>
            <h1>สมัครสมาชิก</h1>
            <input
                type="text"
                placeholder="ชื่อ"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <input
                type="email"
                placeholder="อีเมล"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <input
                type="password"
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleRegister} disabled={submitting}>
                สมัครสมาชิก
            </button>
            {submitting && <p>กำลังสมัคร...</p>}
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
        </div>
    );
}

export default Register;
