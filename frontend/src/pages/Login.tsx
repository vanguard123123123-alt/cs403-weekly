import { useState } from "react";

function Login(){
    const [email , setEmail] = useState("");
    const [password , setPassword] = useState("");

    const handleLogin = () => {
        console.log("อีเมลที่กรอก:", email);
        console.log("รหัสผ่านที่กรอก:", password);
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