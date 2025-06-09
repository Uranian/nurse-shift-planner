// 📄 pages/register-user.jsx

import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import MainMenu from "../components/MainMenu";

export default function RegisterUser() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    nickname: "",
    full_name: "",
    first_name: "",
    last_name: "",
  });

  const router = useRouter();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", form.username)
      .maybeSingle();

    if (existing) {
      toast.error("มี username นี้ในระบบแล้ว");
      return;
    }

    const { error } = await supabase.from("profiles").insert([
      {
        username: form.username,
        password: form.password,
        nickname: form.nickname,
        full_name: form.full_name,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        user_type_booking: "general",
        role: "customer",
        registered_at: new Date().toISOString(),
      },
    ]);

    if (!error) {
      // ✅ เก็บข้อมูลไว้ใน localStorage (ล็อกอินทันที)
      const newUser = {
        username: form.username,
        nickname: form.nickname,
        full_name: form.full_name,
        first_name: form.first_name || "",
        last_name: form.last_name || "",
        user_type_booking: "general",
      };
      localStorage.setItem("logged_in_user", JSON.stringify(newUser));

      router.push("/profile-summary");
    } else {
      toast.error("เกิดข้อผิดพลาดในการสมัคร");
    }
  };

  return (
    <div className="p-4">
      <MainMenu />
      <div className="max-w-md mx-auto mt-10 p-4 border rounded">
        <h2 className="text-xl font-bold mb-4">🙋‍♀️ สมัครเป็นผู้ใช้บริการ</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            name="username"
            onChange={handleChange}
            placeholder="Username"
            required
            className="w-full border px-2 py-1"
          />
          <input
            name="password"
            type="password"
            onChange={handleChange}
            placeholder="Password"
            required
            className="w-full border px-2 py-1"
          />
          <input
            name="nickname"
            onChange={handleChange}
            placeholder="ชื่อเล่น"
            className="w-full border px-2 py-1"
          />
          <input
            name="full_name"
            onChange={handleChange}
            placeholder="ชื่อ-นามสกุล"
            className="w-full border px-2 py-1"
          />
          {/* สามารถเพิ่มช่องชื่อจริง/นามสกุลแยกได้ภายหลัง */}
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            สมัคร
          </button>
        </form>
      </div>
    </div>
  );
}
