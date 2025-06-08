// 📄 pages/nurse-manager.jsx

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

export default function NurseManagerPage() {
  const [nurses, setNurses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
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
    is_active_for_massage: false, // ✅ เพิ่มตรงนี้
  });

  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [editId, setEditId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // 👈 เพิ่มบนสุดก่อน useEffect

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);

      // ตั้งค่า hospital_id และ ward_id ตาม user
      setFormData((prev) => ({
        ...prev,
        hospital_id: user.hospital_id || "",
        ward_id: user.ward_id || "",
      }));
    }

    fetchHospitals();
    fetchWards();
    fetchNurses();
  }, []);

  useEffect(() => {
    fetchHospitals();
    fetchWards();
    fetchNurses();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchWards();
    }
  }, [formData.hospital_id]);

  async function fetchHospitals() {
    const { data } = await supabase.from("hospitals").select();
    setHospitals(data);
  }

  async function fetchWards() {
    let query = supabase.from("wards").select();
    //currentUser.hospital_id

    if (currentUser?.role !== "admin") {
      if (currentUser?.user_type === "หัวหน้าพยาบาล") {
        if (formData.hospital_id) {
          query = query.eq("hospital_id", formData.hospital_id);
        } else {
          setWards([]); // ยังไม่ได้เลือกโรงพยาบาล
          return;
        }
      } else if (currentUser?.user_type === "หัวหน้าวอร์ด") {
        query = query.eq("id", currentUser.ward_id);
      } else {
        setWards([]); // คนอื่นไม่ให้เลือกวอร์ด
        return;
      }
    }

    const { data } = await query;
    setWards(data || []);
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
    const updatedFields = {
      name: formData.name,
      first_name: formData.first_name,
      last_name: formData.last_name,
      position: formData.position,
      qualification: formData.qualification,
      phone: formData.phone,
      line_id: formData.line_id,
      display_order: formData.display_order,
      is_active_for_shift: formData.is_active_for_shift,
      is_active_for_massage: formData.is_active_for_massage,
    };

    // เฉพาะกรณีมีค่า hospital_id
    if (formData.hospital_id) {
      updatedFields.hospital_id = formData.hospital_id;
    }
    // เฉพาะกรณีมีค่า ward_id
    if (formData.ward_id) {
      updatedFields.ward_id = formData.ward_id;
    }

    if (editId) {
      console.log("Updating nurse:", formData);

      const { error } = await supabase
        .from("nurses")
        .update(updatedFields)
        .eq("id", editId);
      if (!error) {
        console.error("Update error:", error);
        setEditId(null);
        resetForm();
        fetchNurses();
      }
    } else {
      const { error } = await supabase.from("nurses").insert([formData]);
      if (!error) {
        resetForm();
        fetchNurses();
      }
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      first_name: "",
      last_name: "",
      position: "",
      qualification: "",
      phone: "",
      line_id: "",
      display_order: 0,
      hospital_id: null,
      ward_id: null,
      is_active_for_shift: true,
      is_active_for_massage: false,
    });
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
          placeholder="ชื่อเรียก (ชื่อเล่น)"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="border px-2 py-1"
        />

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
          disabled={currentUser?.role !== "admin"} // ✅ ใส่ตรงนี้
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
          disabled={
            currentUser?.role !== "admin" &&
            currentUser?.user_type !== "หัวหน้าพยาบาล"
          } // ❗ ห้ามให้หัวหน้าวอร์ดแก้
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
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_active_for_massage}
            onChange={(e) =>
              setFormData({
                ...formData,
                is_active_for_massage: e.target.checked,
              })
            }
          />
          <span>ใช้งานในนัดนวด</span>
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
        className={`px-4 py-2 ${
          editId ? "bg-yellow-500" : "bg-green-600"
        } text-white rounded`}
      >
        {editId ? "💾 บันทึกการแก้ไข" : "💾 เพิ่มพยาบาล"}
      </button>
      {editId && (
        <button
          onClick={() => {
            setEditId(null);
            resetForm();
          }}
          className="ml-2 px-4 py-2 bg-gray-500 text-white rounded"
        >
          ❌ ยกเลิก
        </button>
      )}

      <hr className="my-4" />

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-white text-black dark:bg-gray-900 dark:text-white">
              <th className="border p-1">ชื่อเรียก - ชื่อ นามสกุล</th>
              <th className="border p-1">ตำแหน่ง</th>
              <th className="border p-1">วอร์ด</th>
              <th className="border p-1">ขึ้นเวร</th>
              <th className="border p-1">นวด</th>
              <th className="border p-1">ลบ</th>
            </tr>
          </thead>
          <tbody>
            {filteredNurses.map((n) => (
              <tr key={n.id}>
                <td className="border p-1 text-white">
                  {n.name} - {n.first_name} {n.last_name}
                </td>
                <td className="border p-1 text-white">{n.position}</td>
                <td className="border p-1 text-white">
                  {wards.find((w) => w.id === n.ward_id)?.name || "-"}
                </td>
                <td className="border p-1 text-center">
                  {n.is_active_for_shift ? "✅" : "❌"}
                </td>
                <td className="border p-1 text-center">
                  {n.is_active_for_massage ? "✅" : "❌"}
                </td>
                <td className="border p-1 text-center space-x-2">
                  <button
                    onClick={() => {
                      setFormData({
                        name: n.name || "",
                        first_name: n.first_name || "",
                        last_name: n.last_name || "",
                        position: n.position || "",
                        qualification: n.qualification || "",
                        phone: n.phone || "",
                        line_id: n.line_id || "",
                        display_order: n.display_order || 0,
                        hospital_id: n.hospital_id || "",
                        ward_id: n.ward_id || "",
                        is_active_for_shift: n.is_active_for_shift,
                        is_active_for_massage: n.is_active_for_massage,
                      });
                      setEditId(n.id);
                    }}
                    className="text-blue-500"
                  >
                    ✏️ แก้ไข
                  </button>

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
