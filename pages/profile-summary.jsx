// 📄 pages/profile-summary.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import MainMenu from "../components/MainMenu";

export default function ProfileSummary() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("logged_in_user"));
    setUser(u);
  }, []);

  if (!user) return <p className="p-4">กำลังโหลดข้อมูล...</p>;

  return (
    <div className="p-4">
      <MainMenu />
      <div className="p-6 max-w-md mx-auto bg-white shadow rounded mt-6">
        <h1 className="text-xl font-bold mb-4 text-center">👤 ข้อมูลผู้ใช้</h1>
        <p>
          <strong>ชื่อผู้ใช้:</strong> {user.username}
        </p>
        <p>
          <strong>ชื่อเล่น:</strong> {user.nickname || "-"}
        </p>
        <p>
          <strong>ชื่อเต็ม (full name):</strong> {user.full_name || "-"}
        </p>
        {(user.first_name || user.last_name) && (
          <p>
            <strong>ชื่อจริง:</strong> {user.first_name || "-"}{" "}
            {user.last_name || ""}
          </p>
        )}
        <p>
          <strong>ประเภทผู้ใช้:</strong> {user.user_type_booking || "-"}
        </p>
        {user.description && (
          <p>
            <strong>คำอธิบาย:</strong> {user.description}
          </p>
        )}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/login-to-consultant-booking")}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            ไปหน้าเริ่มต้น
          </button>
        </div>
      </div>
    </div>
  );
}
