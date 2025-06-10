// 📄 pages/edit-profile.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
import MainMenu from "../components/MainMenu";

export default function EditProfile() {
  const [form, setForm] = useState({
    username: "",
    nickname: "",
    full_name: "",
    first_name: "",
    last_name: "",
    description: "",
    user_type_booking: "", // "ที่ปรึกษา" หรือ "general"
  });

  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("logged_in_user"));
    if (user) {
      setForm((prev) => ({ ...prev, ...user }));
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!form.username) {
      toast.error("ไม่พบข้อมูลผู้ใช้");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        nickname: form.nickname,
        full_name: form.full_name,
        first_name: form.first_name,
        last_name: form.last_name,
        description:
          form.user_type_booking === "ที่ปรึกษา" ? form.description : null,
      })
      .eq("username", form.username);

    if (error) {
      toast.error("❌ แก้ไขไม่สำเร็จ");
    } else {
      toast.success("✅ แก้ไขโปรไฟล์เรียบร้อย");

      // อัปเดต localStorage
      const updatedUser = {
        ...form,
        description:
          form.user_type_booking === "ที่ปรึกษา" ? form.description : null,
      };
      localStorage.setItem("logged_in_user", JSON.stringify(updatedUser));
      router.push("/login-to-consultant-booking");
    }
  };

  return (
    <div className="p-4">
      <MainMenu />
      <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-6">
        <h1 className="text-xl font-bold mb-4 text-center text-black">
          ✏️ แก้ไขโปรไฟล์
        </h1>
        <div className="mb-3">
          <label className="block font-semibold text-black">
            ชื่อผู้ใช้ (username):
          </label>
          <input
            type="text"
            name="username"
            value={form.username}
            disabled
            className="border px-2 py-1 w-full bg-gray-100"
          />
        </div>
        <div className="mb-3">
          <label className="block font-semibold text-black">ชื่อเล่น:</label>
          <input
            type="text"
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            className="border px-2 py-1 w-full"
          />
        </div>
        <div className="mb-3">
          <label className="block font-semibold text-black">
            ฉายา/ชื่อในวงการ/ชื่ออื่น ๆ ที่ต้องการใช้:
          </label>
          <input
            type="text"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            className="border px-2 py-1 w-full"
          />
        </div>
        <div className="mb-3">
          <label className="block font-semibold text-black">ชื่อจริง:</label>
          <input
            type="text"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            className="border px-2 py-1 w-full"
          />
        </div>
        <div className="mb-3">
          <label className="block font-semibold text-black">นามสกุลจริง:</label>
          <input
            type="text"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            className="border px-2 py-1 w-full"
          />
        </div>
        {form.user_type_booking === "ที่ปรึกษา" && (
          <div className="mb-3">
            <label className="block font-semibold text-black">
              คำอธิบาย/ความถนัด/ความเชี่ยวชาญ:
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="border px-2 py-1 w-full"
            />
          </div>
        )}
        <div className="text-center mt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>
    </div>
  );
}
