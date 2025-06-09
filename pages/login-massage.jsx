// 📄 pages/login-massage.jsx
import React, { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function LoginMassage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, username, hospital_id, ward_id, shift_ward_id, user_type, role"
      )
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !profile) {
      alert("เข้าสู่ระบบไม่สำเร็จ");
      return;
    }

    const finalWardId = profile.shift_ward_id || profile.ward_id;

    const { data: hospital } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", profile.hospital_id)
      .single();

    const { data: ward } = await supabase
      .from("wards")
      .select("name")
      .eq("id", finalWardId)
      .single();

    // ✅ บันทึก context สำหรับระบบ massage
    const context = {
      hospital_id: profile.hospital_id,
      hospital_name: hospital?.name || "",
      ward_id: finalWardId,
      ward_name: ward?.name || "",
    };
    localStorage.setItem("massage_planner_context", JSON.stringify(context));

    // ✅ เก็บผู้ใช้ลง localStorage เผื่อใช้ในระบบทั่วไป
    localStorage.setItem("logged_in_user", JSON.stringify(profile));

    // ✅ ไปที่ระบบนัดหมอนวด
    router.push("/massage-planner");
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">🔐 เข้าสู่ระบบ (ระบบนวด)</h1>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="border px-3 py-2 mb-2 w-full"
      />
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="border px-3 py-2 mb-4 w-full"
      />
      <button
        onClick={handleLogin}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        เข้าสู่ระบบ
      </button>
    </div>
  );
}
