// 📄 pages/register-consultant.jsx
import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import MainMenu from "../components/MainMenu";

export default function RegisterConsultant() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    nickname: "",
    full_name: "",
    description: "",
  });
  const router = useRouter();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🔍 ตรวจสอบว่ามี username ซ้ำหรือไม่
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", form.username)
      .maybeSingle();

    if (existing) {
      toast.error("มี username นี้ในระบบแล้ว");
      return;
    }

    // ➕ เพิ่มใหม่
    const { error } = await supabase.from("profiles").insert([
      {
        username: form.username,
        password: form.password,
        nickname: form.nickname,
        full_name: form.full_name,
        first_name: form.first_name,
        last_name: form.last_name,
        description: form.description,
        user_type_booking: "ที่ปรึกษา",
        role: "consultant",
        registered_at: new Date().toISOString(),
      },
    ]);

    // หลังจาก insert สำเร็จแล้ว
    if (!error) {
      // ✅ เก็บข้อมูลไว้ใน localStorage (ล็อกอินทันที)
      const newUser = {
        username: form.username,
        nickname: form.nickname,
        full_name: form.full_name,
        first_name: form.first_name,
        last_name: form.last_name,
        user_type_booking: "ที่ปรึกษา",
        description: form.description,
      };
      localStorage.setItem("logged_in_user", JSON.stringify(newUser));

      // ✅ ไปยังหน้าแสดงข้อมูล
      router.push("/profile-summary");
    }
  };

  return (
    <div className="p-4">
      <MainMenu />
      <div className="max-w-md mx-auto mt-10 p-4 border rounded">
        <h2 className="text-xl font-bold mb-4">👩‍⚕️ สมัครเป็นที่ปรึกษา</h2>
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
            placeholder="ฉายา/ชื่อในวงการ/ชื่ออื่น ๆ ที่ต้องการใช้"
            className="w-full border px-2 py-1"
          />
          <input
            name="first_name"
            onChange={handleChange}
            placeholder="ชื่อจริง"
            className="w-full border px-2 py-1"
          />
          <input
            name="last_name"
            onChange={handleChange}
            placeholder="นามสกุลจริง"
            className="w-full border px-2 py-1"
          />

          <textarea
            name="description"
            onChange={handleChange}
            placeholder="คำอธิบาย/ความถนัด/ความเชี่ยวชาญ"
            className="w-full border px-2 py-1"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            สมัคร
          </button>
        </form>
      </div>
    </div>
  );
}
