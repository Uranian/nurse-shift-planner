import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingHospitalId, setDeletingHospitalId] = useState(null);

  useEffect(() => {
    fetchHospitals();
  }, []);

  async function fetchHospitals() {
    const { data, error } = await supabase
      .from("hospitals")
      .select("*")
      .order("name");

    if (error) toast.error("เกิดข้อผิดพลาดในการโหลด");
    else setHospitals(data);
  }

  async function addHospital() {
    if (!newName.trim()) return toast.warn("กรุณากรอกชื่อโรงพยาบาล");
    const { error } = await supabase
      .from("hospitals")
      .insert({ name: newName });
    if (error) toast.error("เพิ่มไม่สำเร็จ");
    else {
      toast.success("เพิ่มโรงพยาบาลแล้ว");
      setNewName("");
      fetchHospitals();
    }
  }

  async function updateHospital(id, name) {
    if (!name.trim()) return toast.warn("ชื่อห้ามว่าง");
    const { error } = await supabase
      .from("hospitals")
      .update({ name })
      .eq("id", id);
    if (error) toast.error("บันทึกไม่สำเร็จ");
    else {
      toast.success("บันทึกสำเร็จ");
      setEditingId(null);
      setEditingName("");
      fetchHospitals();
    }
  }

  async function deleteHospital(id) {
    if (!confirm("ลบโรงพยาบาลนี้หรือไม่?")) return;
    const { error } = await supabase.from("hospitals").delete().eq("id", id);
    if (error) toast.error("ลบไม่สำเร็จ");
    else {
      toast.success("ลบแล้ว");
      fetchHospitals();
    }
  }

  const filtered = hospitals.filter((h) => h.name.includes(searchTerm));

  function handleDeleteHospital(id) {
    setDeletingHospitalId(id);
    setShowDeleteModal(true);
  }

  async function confirmDeleteHospital() {
    const { error } = await supabase
      .from("hospitals")
      .delete()
      .eq("id", deletingHospitalId);
    if (error) toast.error("ลบไม่สำเร็จ");
    else {
      toast.success("ลบแล้ว");
      fetchHospitals();
    }
    setShowDeleteModal(false);
    setDeletingHospitalId(null);
  }

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
                  onClick={() => handleDeleteHospital(h.id)}
                  className="text-red-600 ml-2"
                >
                  🗑️
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[90%] max-w-sm">
            <h2 className="text-xl font-semibold mb-4 text-center text-black">
              ยืนยันการลบ
            </h2>
            <p className="text-center mb-6 text-black">
              คุณแน่ใจหรือไม่ว่าต้องการลบโรงพยาบาลนี้?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={confirmDeleteHospital}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                ลบ
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
