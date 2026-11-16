import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../api/axiosClient";
import { APP_NAME } from "../constants/app";

function Login(){
    const navigate = useNavigate();
    const location = useLocation();
    const [email , setEmail] = useState("");
    const [password , setPassword] = useState("");
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
            navigate("/dashboard");
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
    return(
        <div>
            <Link to="/" className="text-sm font-semibold text-primary-700">
                {APP_NAME}
            </Link>
            <h1>เข้าสู่ระบบ</h1>
            {successMessage && <p className="text-success-800">{successMessage}</p>}
            <input
                 type = "email"
                 placeholder = "อีเมล"
                 value = {email}
                 onChange={(e) => setEmail(e.target.value)}
            />
            <input
                 type="password"
                 placeholder = "รหัสผ่าน"
                 value = {password}
                 onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleLogin} disabled={submitting}>เข้าสู่ระบบ</button>
            {submitting && <p>กำลังเข้าสู่ระบบ...</p>}
            {errorMessage && <p className="text-danger-700">{errorMessage}</p>}
            <p className="mt-3 text-sm text-ink-muted">
                ยังไม่มีบัญชี?{" "}
                <Link to="/register" className="text-primary-600 underline">
                    สมัครสมาชิก
                </Link>
            </p>
        </div>
    );
}

export default Login;
