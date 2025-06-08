// 📄 src/pages/system-settings.jsx

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import { toast } from "react-toastify";

export default function SystemSettingsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedWard, setSelectedWard] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      if (user.role !== "admin") {
        setSelectedHospital(user.hospital_id);
        setSelectedWard(user.ward_id);
      }
    }
    const shiftPlanner = localStorage.getItem("shift_planner_context");
    if (shiftPlanner) {
      const context = JSON.parse(shiftPlanner);
      setSelectedHospital(context.hospital_id);
      setSelectedWard(context.ward_id);
    }
  }, []);

  useEffect(() => {
    const fetchHospitals = async () => {
      if (!currentUser) return;

      let query = supabase.from("hospitals").select("id, name").order("name");

      if (currentUser.role !== "admin") {
        query = query.eq("id", currentUser.hospital_id);
      }

      const { data, error } = await query;
      if (!error) setHospitals(data);
    };

    fetchHospitals();
  }, [currentUser]);

  useEffect(() => {
    const fetchWards = async () => {
      if (!selectedHospital || !currentUser) return;

      let query = supabase.from("wards").select("id, name").order("name");

      if (currentUser.role !== "admin") {
        if (currentUser.user_type === "หัวหน้าพยาบาล") {
          query = query.eq("hospital_id", selectedHospital);
        } else if (currentUser.user_type === "หัวหน้าวอร์ด") {
          query = query.eq("id", currentUser.ward_id);
        } else {
          setWards([]);
          return;
        }
      } else {
        query = query.eq("hospital_id", selectedHospital);
      }

      const { data, error } = await query;
      if (!error) setWards(data);
    };

    fetchWards();
  }, [selectedHospital, currentUser]);

  const saveSettings = async () => {
    if (!selectedHospital || !selectedWard) {
      toast.info("กรุณาเลือกโรงพยาบาลและวอร์ดก่อนบันทึก");
      return;
    }

    const hospital = hospitals.find((h) => h.id === selectedHospital);
    const ward = wards.find((w) => w.id === selectedWard);

    localStorage.setItem(
      "shift_planner_context",
      JSON.stringify({
        hospital_id: selectedHospital,
        hospital_name: hospital?.name || "",
        ward_id: selectedWard,
        ward_name: ward?.name || "",
      })
    );

    // 👇 อัปเดตค่า shift_default_ward_id และ name ในตาราง hospitals
    const { error } = await supabase
      .from("hospitals")
      .update({
        shift_default_ward_id: selectedWard,
        shift_default_ward_name: ward?.name || "",
      })
      .eq("id", selectedHospital);

    if (error) {
      toast.error("❌ บันทึกค่า default ward ไม่สำเร็จ: " + error.message);
    } else {
      toast.success("✅ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว");
      router.push("/shift-planner");
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        ⚙️ ตั้งค่าระบบโรงพยาบาล / วอร์ด
      </h1>

      <label className="block mb-2 font-semibold">
        🏥 เลือกโรงพยาบาล (ต้องเลือก)
      </label>
      <select
        className="w-full border p-2 rounded mb-4 bg-white text-black"
        value={selectedHospital}
        onChange={(e) => {
          setSelectedHospital(e.target.value);
          setSelectedWard("");
        }}
      >
        <option value="">-- เลือกโรงพยาบาล --</option>
        {hospitals.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>

      {currentUser?.role === "admin" && (
        <button
          className="w-full bg-gray-600 text-white py-2 rounded mb-6"
          onClick={() => router.push("/admin-hospitals")}
        >
          🏥 จัดการโรงพยาบาล
        </button>
      )}

      <label className="block mb-2 font-semibold">
        🏬 เลือกวอร์ด สำหรับจัดตารางเวรพยาบาล (ต้องเลือก)
      </label>
      <select
        className="w-full border p-2 rounded mb-4 bg-white text-black"
        value={selectedWard}
        onChange={(e) => setSelectedWard(e.target.value)}
        disabled={
          !selectedHospital || currentUser?.user_type === "หัวหน้าวอร์ด"
        }
      >
        <option value="">-- เลือกวอร์ด --</option>
        {wards.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      {currentUser?.role === "admin" && (
        <button
          className="w-full bg-gray-600 text-white py-2 rounded mb-6"
          onClick={() => router.push("/admin-wards")}
        >
          🏬 จัดการวอร์ด
        </button>
      )}

      <button
        onClick={saveSettings}
        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        💾 บันทึกการตั้งค่า
      </button>
    </div>
  );
}
