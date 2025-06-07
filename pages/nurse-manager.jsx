// 📄 pages/nurse-manager.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function NurseManagerPage() {
  const [nurses, setNurses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    position: "",
    qualification: "",
    phone: "",
    line_id: "",
    display_order: 0,
    hospital_id: "",
    ward_id: "",
    is_active_for_shift: true,
  });

  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    fetchHospitals();
    fetchWards();
    fetchNurses();
  }, []);

  async function fetchHospitals() {
    const { data } = await supabase.from("hospitals").select();
    setHospitals(data);
  }

  async function fetchWards() {
    const { data } = await supabase.from("wards").select();
    setWards(data);
  }

  async function fetchNurses() {
    setLoading(true);
    const { data } = await supabase
      .from("nurses")
      .select("*")
      .order("display_order");
    setNurses(data);
    setLoading(false);
  }

  async function saveNurse() {
    const { data, error } = await supabase.from("nurses").insert([formData]);
    if (!error) {
      setFormData({
        first_name: "",
        last_name: "",
        position: "",
        qualification: "",
        phone: "",
        line_id: "",
        display_order: 0,
        hospital_id: "",
        ward_id: "",
        is_active_for_shift: true,
      });
      fetchNurses();
    }
  }

  async function deleteNurse(id) {
    if (confirm("ลบข้อมูลพยาบาลนี้?")) {
      await supabase.from("nurses").delete().eq("id", id);
      fetchNurses();
    }
  }

  const filteredNurses = nurses.filter((n) =>
    `${n.first_name} ${n.last_name}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">🧑‍⚕️ จัดการรายชื่อพยาบาล</h1>

      <input
        type="text"
        placeholder="ค้นหาชื่อพยาบาล..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="border px-3 py-1 mb-3 w-full"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <input
          placeholder="ชื่อ"
          value={formData.first_name}
          onChange={(e) =>
            setFormData({ ...formData, first_name: e.target.value })
          }
          className="border px-2 py-1"
        />
        <input
          placeholder="นามสกุล"
          value={formData.last_name}
          onChange={(e) =>
            setFormData({ ...formData, last_name: e.target.value })
          }
          className="border px-2 py-1"
        />
        <input
          placeholder="ตำแหน่ง"
          value={formData.position}
          onChange={(e) =>
            setFormData({ ...formData, position: e.target.value })
          }
          className="border px-2 py-1"
        />
        <input
          placeholder="คุณวุฒิ"
          value={formData.qualification}
          onChange={(e) =>
            setFormData({ ...formData, qualification: e.target.value })
          }
          className="border px-2 py-1"
        />
        <input
          placeholder="เบอร์โทร"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="border px-2 py-1"
        />
        <input
          placeholder="LINE ID"
          value={formData.line_id}
          onChange={(e) =>
            setFormData({ ...formData, line_id: e.target.value })
          }
          className="border px-2 py-1"
        />
        <select
          value={formData.hospital_id}
          onChange={(e) =>
            setFormData({ ...formData, hospital_id: e.target.value })
          }
          className="border px-2 py-1"
        >
          <option value="">เลือกโรงพยาบาล</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          value={formData.ward_id}
          onChange={(e) =>
            setFormData({ ...formData, ward_id: e.target.value })
          }
          className="border px-2 py-1"
        >
          <option value="">เลือกวอร์ด</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_active_for_shift}
            onChange={(e) =>
              setFormData({
                ...formData,
                is_active_for_shift: e.target.checked,
              })
            }
          />
          <span>ใช้งานในตารางเวร</span>
        </label>
        <input
          type="number"
          placeholder="ลำดับแสดงผล"
          value={formData.display_order}
          onChange={(e) =>
            setFormData({ ...formData, display_order: Number(e.target.value) })
          }
          className="border px-2 py-1"
        />
      </div>

      <button
        onClick={saveNurse}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        💾 เพิ่มพยาบาล
      </button>

      <hr className="my-4" />

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-1">ชื่อ</th>
              <th className="border p-1">ตำแหน่ง</th>
              <th className="border p-1">วอร์ด</th>
              <th className="border p-1">ขึ้นเวร</th>
              <th className="border p-1">ลบ</th>
            </tr>
          </thead>
          <tbody>
            {filteredNurses.map((n) => (
              <tr key={n.id}>
                <td className="border p-1">
                  {n.first_name} {n.last_name}
                </td>
                <td className="border p-1">{n.position}</td>
                <td className="border p-1">
                  {wards.find((w) => w.id === n.ward_id)?.name || "-"}
                </td>
                <td className="border p-1 text-center">
                  {n.is_active_for_shift ? "✅" : "❌"}
                </td>
                <td className="border p-1 text-center">
                  <button
                    onClick={() => deleteNurse(n.id)}
                    className="text-red-600"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
