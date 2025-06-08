// 📄 src/pages/login.jsx

import React, { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select()
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      alert("เข้าสู่ระบบไม่สำเร็จ");
      return;
    }

    localStorage.setItem("logged_in_user", JSON.stringify(data));

    // → เช็กว่า shift_planner_context มีค่าหรือไม่
    const finalContext = localStorage.getItem("shift_planner_context");
    if (!finalContext) {
      router.push("/system-settings");
    } else {
      router.push("/shift-planner");
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">🔐 เข้าสู่ระบบ</h1>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="border px-3 py-2 mb-2 w-full"
      />
      <input
        type="password"
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
