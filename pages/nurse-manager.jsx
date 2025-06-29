// 📄 pages/nurse-manager.jsx

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";

export default function NurseManagerPage() {
  const [nurses, setNurses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [filterHospitalId, setFilterHospitalId] = useState("");
  const [filterWardId, setFilterWardId] = useState("");

  const [formData, setFormData] = useState({
    prefix: "",
    name: "",
    first_name: "",
    last_name: "",
    position: "",
    qualification: "",
    phone: "",
    line_id: "",
    display_order: 0,
    display_name: "",
    hospital_id: "",
    ward_id: "",
    is_active_for_shift: true,
    is_active_for_massage: false,
    allow_morning: true,
    allow_evening: true,
    allow_night: true,
  });

  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [editId, setEditId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const isAdmin = currentUser?.role === "admin";
  const isHeadNurse = currentUser?.user_type === "หัวหน้าพยาบาล";
  const isWardHead = currentUser?.user_type === "หัวหน้าวอร์ด";
  // 🏥 ค่ารหัส รพ.ที่ "กำลังใช้" ในหน้า (แอดมิน = filter, หัวหน้า = ของตัวเอง)
  const activeHospitalId =
    isAdmin || isHeadNurse
      ? filterHospitalId || currentUser?.hospital_id
      : currentUser?.hospital_id;

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      setFormData((prev) => ({
        ...prev,
        hospital_id: user.hospital_id || "",
        ward_id: user.ward_id || "",
      }));
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchHospitals();
    fetchNurses();
  }, [currentUser, filterHospitalId, filterWardId]);

  useEffect(() => {
    if (!currentUser) return;

    // ไม่มี รพ. = ไม่ต้องโหลดวอร์ด
    if (!activeHospitalId) {
      setWards([]);
      return;
    }

    // โหลดวอร์ดภายใต้ activeHospitalId
    supabase
      .from("wards")
      .select("id, name, hospital_id")
      .eq("hospital_id", activeHospitalId)
      .then(({ data, error }) => {
        if (error) console.error("Ward fetch error", error);
        setWards(data || []);
      });
  }, [activeHospitalId, currentUser]);

  async function fetchHospitals() {
    if (!currentUser) return;

    let query = supabase.from("hospitals").select();

    if (currentUser.role !== "admin") {
      query = query.eq("id", currentUser.hospital_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ Hospital fetch error:", error);
      setHospitals([]);
    } else {
      setHospitals(data || []);
    }
  }

  async function fetchNurses() {
    setLoading(true);

    let query = supabase
      .from("nurses")
      .select("*", { count: "exact" })
      .order("display_order", { ascending: true });

    if (filterHospitalId) query = query.eq("hospital_id", filterHospitalId);
    if (filterWardId) query = query.eq("ward_id", filterWardId);

    if (currentUser?.role !== "admin") {
      if (currentUser?.user_type === "หัวหน้าพยาบาล") {
        query = query.eq("hospital_id", currentUser.hospital_id);
      } else if (currentUser?.user_type === "หัวหน้าวอร์ด") {
        query = query
          .eq("hospital_id", currentUser.hospital_id)
          .eq("ward_id", currentUser.ward_id);
      } else {
        query = query.eq("id", "");
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ fetchNurses error:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดรายชื่อพยาบาล");
      setNurses([]);
    } else {
      setNurses(data || []);
    }

    setLoading(false);
  }

  async function saveNurse() {
    if (!formData.display_name || formData.display_name.trim() === "") {
      toast.error("กรุณากรอก ชื่อที่แสดงในตารางเวร");
      return;
    }
    if (formData.display_order === null || isNaN(formData.display_order)) {
      toast.error("กรุณากรอก ลำดับในตารางเวร");
      return;
    }

    if (!formData.hospital_id) {
      toast.error("กรุณาเลือก โรงพยาบาล");
      return;
    }
    if (!formData.ward_id) {
      toast.error("กรุณาเลือก วอร์ด");
      return;
    }

    const updatedFields = {
      prefix: formData.prefix,
      name: formData.name,
      first_name: formData.first_name,
      last_name: formData.last_name,
      position: formData.position,
      qualification: formData.qualification,
      phone: formData.phone,
      line_id: formData.line_id,
      display_order: formData.display_order,
      display_name: formData.display_name,
      is_active_for_shift: formData.is_active_for_shift,
      is_active_for_massage: formData.is_active_for_massage,
      allow_morning: formData.allow_morning,
      allow_evening: formData.allow_evening,
      allow_night: formData.allow_night,
    };

    if (formData.hospital_id) {
      updatedFields.hospital_id = formData.hospital_id;
    }
    if (formData.ward_id) {
      updatedFields.ward_id = formData.ward_id;
    }

    let error = null;
    if (editId) {
      const res = await supabase
        .from("nurses")
        .update(updatedFields)
        .eq("id", editId);
      error = res.error;
    } else {
      const res = await supabase.from("nurses").insert([updatedFields]);
      error = res.error;
    }

    if (!error) {
      resetForm();
      setEditId(null);
      setAddingNew(false);
      fetchNurses();
    } else {
      console.error("Save error", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูลพยาบาล");
    }
  }

  function resetForm() {
    setFormData({
      prefix: "",
      name: "",
      first_name: "",
      last_name: "",
      position: "",
      qualification: "",
      phone: "",
      line_id: "",
      display_order: 0,
      display_name: "",
      hospital_id: null,
      ward_id: null,
      is_active_for_shift: true,
      is_active_for_massage: false,
      allow_morning: true,
      allow_evening: true,
      allow_night: true,
    });
  }

  function confirmDeleteNurse(id) {
    setDeleteId(id);
    setShowConfirm(true);
  }

  async function deleteNurseConfirmed() {
    await supabase.from("nurses").delete().eq("id", deleteId);
    setShowConfirm(false);
    setDeleteId(null);
    fetchNurses();
  }

  const filteredNurses = nurses.filter((n) => {
    const matchName = `${n.prefix || ""} ${n.first_name} ${n.last_name}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchHospital = filterHospitalId
      ? n.hospital_id === filterHospitalId
      : true;

    const matchWard = filterWardId ? n.ward_id === filterWardId : true;

    return matchName && matchHospital && matchWard;
  });

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">🧑‍⚕️ จัดการรายชื่อพยาบาล</h1>
      {/* 🔍 ฟิลเตอร์ + ค้นหา */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* เลือกโรงพยาบาล */}
        <select
          className="border px-2 py-1 text-black bg-white"
          value={filterHospitalId}
          onChange={(e) => {
            setFilterWardId(""); // รีเซ็ตวอร์ดก่อน
            setFilterHospitalId(e.target.value);
          }}
          disabled={!isAdmin && !isHeadNurse}
        >
          <option value="">🏥 ทุกโรงพยาบาล</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        {/* เลือกวอร์ด */}
        <select
          className="border px-2 py-1 text-black bg-white"
          value={filterWardId}
          onChange={(e) => setFilterWardId(e.target.value)}
          disabled={
            !filterHospitalId || (!isAdmin && !isHeadNurse && !isWardHead)
          }
        >
          <option value="">🛏️ ทุกวอร์ด</option>
          {wards
            .filter((w) =>
              filterHospitalId ? w.hospital_id === filterHospitalId : true
            )
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
        </select>

        {/* ช่องค้นหาเดิม */}
        <input
          type="text"
          className="border px-3 py-1 flex-1"
          placeholder="ค้นหาชื่อพยาบาล..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {(addingNew || editId) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 bg-white p-4 text-black">
          <input
            placeholder="ชื่อที่แสดงในตารางเวร"
            value={formData.display_name}
            onChange={(e) =>
              setFormData({ ...formData, display_name: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />
          <input
            placeholder="ชื่อเรียก (ชื่อเล่น)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="border px-2 py-1 bg-white text-black"
          />
          <select
            value={formData.prefix}
            onChange={(e) =>
              setFormData({ ...formData, prefix: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          >
            <option value="">คำนำหน้า</option>
            <option value="นาย">นาย</option>
            <option value="นาง">นาง</option>
            <option value="น.ส.">น.ส.</option>
            <option value="พญ.">พญ.</option>
            <option value="นพ.">นพ.</option>
            {/* เพิ่มตามต้องการ */}
          </select>

          <input
            placeholder="ชื่อจริง"
            value={formData.first_name}
            onChange={(e) =>
              setFormData({ ...formData, first_name: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />
          <input
            placeholder="นามสกุล"
            value={formData.last_name}
            onChange={(e) =>
              setFormData({ ...formData, last_name: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />
          <label className="text-sm font-semibold">
            ลำดับในตารางเวร
            <input
              type="number"
              placeholder="ลำดับในตารางเวร"
              value={formData.display_order}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  display_order: parseInt(e.target.value, 10),
                })
              }
              className="border px-2 py-1 bg-white text-black w-full"
            />
          </label>
          <div className="flex items-center space-x-4">
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
          </div>

          <input
            placeholder="ตำแหน่ง"
            value={formData.position}
            onChange={(e) =>
              setFormData({ ...formData, position: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />
          <input
            placeholder="คุณวุฒิ"
            value={formData.qualification}
            onChange={(e) =>
              setFormData({ ...formData, qualification: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />
          <input
            placeholder="เบอร์โทร"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />
          <input
            placeholder="LINE ID"
            value={formData.line_id}
            onChange={(e) =>
              setFormData({ ...formData, line_id: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
          />

          <select
            value={formData.hospital_id}
            onChange={(e) =>
              setFormData({ ...formData, hospital_id: e.target.value })
            }
            className="border px-2 py-1 bg-white text-black"
            disabled={!isAdmin} // สำหรับโรงพยาบาล
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
            className="border px-2 py-1 bg-white text-black"
            disabled={!isAdmin && !isHeadNurse} // สำหรับวอร์ด
          >
            <option value="">เลือกวอร์ด</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.allow_morning}
                onChange={(e) =>
                  setFormData({ ...formData, allow_morning: e.target.checked })
                }
              />
              <span>ขึ้นเวรเช้า</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.allow_evening}
                onChange={(e) =>
                  setFormData({ ...formData, allow_evening: e.target.checked })
                }
              />
              <span>ขึ้นเวรบ่าย</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.allow_night}
                onChange={(e) =>
                  setFormData({ ...formData, allow_night: e.target.checked })
                }
              />
              <span>ขึ้นเวรดึก</span>
            </label>
          </div>
        </div>
      )}
      {!editId && !addingNew ? (
        <button
          onClick={() => setAddingNew(true)}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          ➕ เพิ่มพยาบาล
        </button>
      ) : (
        <>
          <button
            onClick={saveNurse}
            className="px-4 py-2 bg-orange-500 text-white rounded"
          >
            💾 บันทึกพยาบาลใหม่
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditId(null);
              setAddingNew(false);
            }}
            className="ml-2 px-4 py-2 bg-gray-500 text-white rounded"
          >
            ❌ ยกเลิก
          </button>
        </>
      )}

      <hr className="my-4" />

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-white text-black dark:bg-gray-900 dark:text-white">
              <th className="border p-1">
                ชื่อแสดงผลในตารางเวร - ชื่อเล่น (ชื่อเรียก)
              </th>
              <th className="border p-1">ลำดับในตารางเวร</th>
              <th className="border p-1">ตำแหน่ง</th>
              <th className="border p-1">วอร์ด</th>
              {/* ✅ ใหม่ – สิทธิ์ขึ้นเวรแต่ละช่วง */}
              <th className="border p-1">เช้า</th>
              <th className="border p-1">บ่าย</th>
              <th className="border p-1">ดึก</th>
              <th className="border p-1">ขึ้นเวร</th>
              <th className="border p-1">นวด</th>
              <th className="border p-1">กระทำการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredNurses.map((n) => (
              <tr key={n.id}>
                <td className="border p-1 text-white">
                  {n.display_name}
                  {n.name ? ` (${n.name})` : ""}
                </td>
                <td className="border p-1 text-white">{n.display_order}</td>
                <td className="border p-1 text-white">{n.position}</td>
                <td className="border p-1 text-white">
                  {wards.find((w) => w.id === n.ward_id)?.name || "-"}
                </td>

                {/* ✅ ใหม่ – โชว์สิทธิ์ขึ้นเวร */}
                <td className="border p-1 text-center">
                  {n.allow_morning ? "✅" : "❌"}
                </td>
                <td className="border p-1 text-center">
                  {n.allow_evening ? "✅" : "❌"}
                </td>
                <td className="border p-1 text-center">
                  {n.allow_night ? "✅" : "❌"}
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
                        prefix: n.prefix || "",
                        name: n.name || "",
                        display_name: n.display_name || "",
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
                        allow_morning: n.allow_morning,
                        allow_evening: n.allow_evening,
                        allow_night: n.allow_night,
                      });
                      setEditId(n.id);
                    }}
                    className="text-blue-500"
                  >
                    ✏️ แก้ไข
                  </button>

                  <button
                    onClick={() => confirmDeleteNurse(n.id)}
                    className="text-red-600 hover:underline"
                  >
                    ลบ
                  </button>

                  <Link href={`/nurse-holidays/${n.id}`}>
                    <button className="text-yellow-500 hover:underline">
                      📅 วันหยุด
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-80 text-center">
            <h2 className="text-lg font-semibold mb-4 text-black">
              ยืนยันการลบ
            </h2>
            <p className="mb-6 text-black">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพยาบาลนี้?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={deleteNurseConfirmed}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                ลบ
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-300 text-black px-4 py-2 rounded"
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
