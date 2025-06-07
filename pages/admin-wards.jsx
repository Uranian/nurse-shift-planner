// 📄 src/pages/admin-wards.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminWards() {
  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [newWardName, setNewWardName] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchWards();
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    const { data } = await supabase.from("hospitals").select("id, name").order("name");
    if (data) setHospitals(data);
  };

  const fetchWards = async () => {
    const { data } = await supabase
      .from("wards")
      .select("id, name, hospital_id, hospitals(name)")
      .order("name");
    if (data) setWards(data);
  };

  const addWard = async () => {
    if (!newWardName.trim() || !selectedHospitalId) return;
    await supabase.from("wards").insert({ name: newWardName, hospital_id: selectedHospitalId });
    setNewWardName("");
    fetchWards();
  };

  const updateWard = async (id, name) => {
    await supabase.from("wards").update({ name }).eq("id", id);
    fetchWards();
  };

  const deleteWard = async (id) => {
    if (confirm("ยืนยันลบวอร์ดนี้?")) {
      await supabase.from("wards").delete().eq("id", id);
      fetchWards();
    }
  };

  const filtered = wards.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.hospitals?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">🏥 จัดการวอร์ด</h1>

      <div className="mb-4 flex gap-2 flex-wrap items-center">
        <input
          className="border px-2 py-1"
          placeholder="ค้นหาวอร์ดหรือโรงพยาบาล"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedHospitalId}
          onChange={(e) => setSelectedHospitalId(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="">เลือกโรงพยาบาล</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input
          className="border px-2 py-1"
          placeholder="ชื่อวอร์ดใหม่"
          value={newWardName}
          onChange={(e) => setNewWardName(e.target.value)}
        />
        <button onClick={addWard} className="bg-green-600 text-white px-3 py-1 rounded">
          ➕ เพิ่มวอร์ด
        </button>
      </div>

      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            <th className="border px-2 py-1">ชื่อวอร์ด</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((w) => (
            <tr key={w.id}>
              <td className="border px-2 py-1">
                <input
                  className="border px-2 py-1 w-full"
                  value={w.name}
                  onChange={(e) => updateWard(w.id, e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">{w.hospitals?.name}</td>
              <td className="border px-2 py-1">
                <button
                  onClick={() => deleteWard(w.id)}
                  className="text-red-600 hover:underline"
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
