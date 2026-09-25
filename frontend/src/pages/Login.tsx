import { useState } from "react";
import axios from "axios";

function Login(){
    const [email , setEmail] = useState("");
    const [password , setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const response = await axios.post("http://localhost:8080/api/auth/login", {
                email: email,
                password: password,
            });
            console.log("Login สำเร็จ:", response.data);
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