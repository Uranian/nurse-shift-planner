import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

export default function AdminWards() {
  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [newWardName, setNewWardName] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingHospitalId, setEditingHospitalId] = useState("");

  useEffect(() => {
    fetchHospitals();
    fetchWards();
  }, []);

  const fetchHospitals = async () => {
    const { data, error } = await supabase
      .from("hospitals")
      .select("id, name")
      .order("name");
    if (error) toast.error("โหลดรายชื่อโรงพยาบาลล้มเหลว");
    else setHospitals(data);
  };

  const fetchWards = async () => {
    const { data, error } = await supabase
      .from("wards")
      .select("id, name, hospital_id, hospitals(name)")
      .order("name");
    if (error) toast.error("โหลดวอร์ดล้มเหลว");
    else setWards(data);
  };

  const addWard = async () => {
    if (!newWardName.trim() || !selectedHospitalId) {
      toast.warn("กรุณากรอกชื่อวอร์ดและเลือกโรงพยาบาล");
      return;
    }
    const { error } = await supabase.from("wards").insert({
      name: newWardName,
      hospital_id: selectedHospitalId,
    });
    if (error) toast.error("เพิ่มวอร์ดไม่สำเร็จ");
    else {
      toast.success("เพิ่มวอร์ดแล้ว");
      setNewWardName("");
      setSelectedHospitalId("");
      fetchWards();
    }
  };

  const updateWard = async (id) => {
    const { error } = await supabase
      .from("wards")
      .update({ name: editingName, hospital_id: editingHospitalId })
      .eq("id", id);
    if (error) toast.error("บันทึกไม่สำเร็จ");
    else {
      toast.success("บันทึกสำเร็จ");
      setEditingId(null);
      fetchWards();
    }
  };

  const deleteWard = async (id) => {
    if (!confirm("ยืนยันลบวอร์ดนี้?")) return;
    const { error } = await supabase.from("wards").delete().eq("id", id);
    if (error) toast.error("ลบไม่สำเร็จ");
    else {
      toast.success("ลบแล้ว");
      fetchWards();
    }
  };

  const filtered = wards.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.hospitals?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 max-w-4xl mx-auto">
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
        <button
          onClick={addWard}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          ➕ เพิ่มวอร์ด
        </button>
      </div>

      <table className="table-auto border-collapse w-full">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">ชื่อวอร์ด</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((w) => (
            <tr key={w.id}>
              <td className="border px-2 py-1">
                {editingId === w.id ? (
                  <input
                    className="border px-2 py-1 w-full"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  w.name
                )}
              </td>
              <td className="border px-2 py-1">
                {editingId === w.id ? (
                  <select
                    value={editingHospitalId}
                    onChange={(e) => setEditingHospitalId(e.target.value)}
                    className="border px-2 py-1 w-full"
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  w.hospitals?.name || ""
                )}
              </td>
              <td className="border px-2 py-1 whitespace-nowrap">
                {editingId === w.id ? (
                  <>
                    <button
                      onClick={() => updateWard(w.id)}
                      className="bg-blue-600 text-white px-2 py-1 rounded mr-1"
                    >
                      ✅
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-gray-600"
                    >
                      ✖
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(w.id);
                        setEditingName(w.name);
                        setEditingHospitalId(w.hospital_id);
                      }}
                      className="text-blue-600 hover:underline mr-2"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => deleteWard(w.id)}
                      className="text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
