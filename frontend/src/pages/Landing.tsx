import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>ระบบสรุปบทเรียนรายสัปดาห์</h1>
      <button onClick={() => navigate("/login")}>เข้าสู่ระบบ</button>
      <button onClick={() => navigate("/register")}>สมัครสมาชิก</button>
    </div>
  );
}

export default Landing;