import { useState } from "react";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = () => {
        console.log("ชื่อ:", name);
        console.log("อีเมล:", email);
        console.log("รหัสผ่าน:", password);
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