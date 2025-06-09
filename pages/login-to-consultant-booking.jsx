// pages/login-to-consultant-booking.jsx

import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import MainMenu from "../components/MainMenu";

export default function LoginToConsultantBooking() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!/^\d{8}$/.test(password)) {
      toast.error("❌ กรุณากรอกรหัสผ่าน 8 หลัก (เฉพาะตัวเลข)");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();

    if (error || !data) {
      toast.error("❌ ล็อกอินไม่สำเร็จ");
      return;
    }

    localStorage.setItem("logged_in_user", JSON.stringify(data));
    toast.success(`👋 สวัสดี ${data.nickname || data.username}`);

    if (data.user_type_booking === "ที่ปรึกษา") {
      window.location.href = "/consultant-availability";
    } else {
      window.location.href = "/consultant-booking";
    }
  };

  return (
    <div className="p-4">
      <MainMenu />
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          🔐 เข้าสู่ระบบเพื่อใช้งานระบบนัดหมาย
        </h1>

        <input
          type="text"
          placeholder="Username"
          className="border p-2 w-full mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Password (เลข 8 หลัก)"
          className="border p-2 w-full mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          ▶️ เข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}
