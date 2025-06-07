import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    fetchHospitals();
  }, []);

  async function fetchHospitals() {
    const { data, error } = await supabase
      .from("hospitals")
      .select("*")
      .order("name");

    if (error) toast.error("เกิดข้อผิดพลาดในการโหลด", { autoClose: 2000 });
    else setHospitals(data);
  }

  async function addHospital() {
    if (!newName.trim()) return toast.warn("กรุณากรอกชื่อโรงพยาบาล", { autoClose: 2000 });
    const { error } = await supabase
      .from("hospitals")
      .insert({ name: newName });
    if (error) toast.error("เพิ่มไม่สำเร็จ", { autoClose: 2000 });
    else {
      toast.success("เพิ่มโรงพยาบาลแล้ว", { autoClose: 2000 });
      setNewName("");
      fetchHospitals();
    }
  }

  async function updateHospital(id, name) {
    if (!name.trim()) return toast.warn("ชื่อห้ามว่าง", { autoClose: 2000 });
    const { error } = await supabase
      .from("hospitals")
      .update({ name })
      .eq("id", id);
    if (error) toast.error("บันทึกไม่สำเร็จ");
    else {
      toast.success("บันทึกสำเร็จ", { autoClose: 2000 });
      setEditingId(null);
      setEditingName("");
      fetchHospitals();
    }
  }

  async function deleteHospital(id) {
    if (!confirm("ลบโรงพยาบาลนี้หรือไม่?")) return;
    const { error } = await supabase.from("hospitals").delete().eq("id", id);
    if (error) toast.error("ลบไม่สำเร็จ", { autoClose: 2000 });
    else {
      toast.success("ลบแล้ว", { autoClose: 2000 });
      fetchHospitals();
    }
  }

  const filtered = hospitals.filter((h) => h.name.includes(searchTerm));

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🏥 จัดการโรงพยาบาล</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="border px-3 py-1 rounded w-full"
          placeholder="ค้นหาโรงพยาบาล"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <input
          className="border px-3 py-1 rounded"
          placeholder="ชื่อโรงพยาบาลใหม่"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={addHospital}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          ➕ เพิ่ม
        </button>
      </div>

      <ul className="divide-y">
        {filtered.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-2">
            {editingId === h.id ? (
              <>
                <input
                  className="border px-2 py-1 rounded w-full mr-2"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={() => updateHospital(h.id, editingName)}
                  className="bg-blue-600 text-white px-2 py-1 rounded mr-1"
                >
                  ✅
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditingName("");
                  }}
                  className="text-gray-600"
                >
                  ✖
                </button>
              </>
            ) : (
              <>
                <span
                  onClick={() => {
                    setEditingId(h.id);
                    setEditingName(h.name);
                  }}
                  className="cursor-pointer w-full"
                >
                  {h.name}
                </span>
                <button
                  onClick={() => deleteHospital(h.id)}
                  className="text-red-600 ml-2"
                >
                  🗑️
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
