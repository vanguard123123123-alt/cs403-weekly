import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";

function Login(){
    const navigate = useNavigate();
    const [email , setEmail] = useState("");
    const [password , setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const response = await api.post("/api/auth/login", {
                email: email,
                password: password,
            });
            localStorage.setItem("token", response.data.token);
            navigate("/documents");
        } catch (error) {
            console.log("Login ไม่สำเร็จ:", error);
        }
    };
    return(
        <div>
            <h1>เข้าสู่ระบบ</h1>
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
            <button onClick={handleLogin}>เข้าสู่ระบบ</button>
        </div>
    );
}

export default Login;
