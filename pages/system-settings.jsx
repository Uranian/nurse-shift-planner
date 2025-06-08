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
  const router = useRouter();

  useEffect(() => {
    const prefs = JSON.parse(localStorage.getItem("user_context"));
    if (prefs) {
      setSelectedHospital(prefs.hospital_id);
      setSelectedWard(prefs.ward_id);
    }
  }, []);

  useEffect(() => {
    const fetchHospitals = async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("id, name")
        .order("name");
      if (!error) setHospitals(data);
    };
    fetchHospitals();
  }, []);

  useEffect(() => {
    const fetchWards = async () => {
      if (!selectedHospital) return;
      const { data, error } = await supabase
        .from("wards")
        .select("id, name")
        .eq("hospital_id", selectedHospital)
        .order("name");
      if (!error) setWards(data);
    };
    fetchWards();
  }, [selectedHospital]);

  const saveSettings = () => {
    if (!selectedHospital || !selectedWard) {
      toast.info("กรุณาเลือกโรงพยาบาลและวอร์ดก่อนบันทึก");
      return;
    }

    const hospital = hospitals.find((h) => h.id === selectedHospital);
    const ward = wards.find((w) => w.id === selectedWard);

    localStorage.setItem(
      "user_context",
      JSON.stringify({
        hospital_id: selectedHospital,
        hospital_name: hospital?.name || "",
        ward_id: selectedWard,
        ward_name: ward?.name || "",
      })
    );

    toast.success("✅ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว");
    router.push("/shift-planner");
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

      <button
        className="w-full bg-gray-600 text-white py-2 rounded mb-6"
        onClick={() => router.push("/admin-hospitals")}
      >
        🏥 จัดการโรงพยาบาล
      </button>

      <label className="block mb-2 font-semibold">
        🏬 เลือกวอร์ด สำหรับจัดตารางเวรพยาบาล (ต้องเลือก)
      </label>
      <select
        className="w-full border p-2 rounded mb-4 bg-white text-black"
        value={selectedWard}
        onChange={(e) => setSelectedWard(e.target.value)}
        disabled={!selectedHospital}
      >
        <option value="">-- เลือกวอร์ด --</option>
        {wards.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      <button
        className="w-full bg-gray-600 text-white py-2 rounded mb-6"
        onClick={() => router.push("/admin-wards")}
      >
        🏬 จัดการวอร์ด
      </button>

      <button
        onClick={saveSettings}
        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        💾 บันทึกการตั้งค่า
      </button>
    </div>
  );
}
