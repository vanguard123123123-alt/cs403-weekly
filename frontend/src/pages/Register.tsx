import { useState } from "react";
import axios from "axios";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async () => {
        try {
            const response = await axios.post("http://localhost:8080/api/auth/register", {
                name: name,
                email: email,
                password: password,
            });
            console.log("สมัครสมาชิกสำเร็จ:", response.data);
        }catch (error){
            console.log("สมัครสมาชิกไม่สำเร็จ:", error);
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
            <button onClick={handleRegister}>สมัครสมาชิก</button>
        </div>
    );
}

export default Register;