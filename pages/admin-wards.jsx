// 📄 pages/admin-wards.jsx

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

export default function AdminWards() {
  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [newWardName, setNewWardName] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");

  const [newMaxMorning, setNewMaxMorning] = useState(4);
  const [newMaxEvening, setNewMaxEvening] = useState(3);
  const [newMaxNight, setNewMaxNight] = useState(3);
  const [newNoEveningToNight, setNewNoEveningToNight] = useState(true);
  const [newNoNightToMorning, setNewNoNightToMorning] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingHospitalId, setEditingHospitalId] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [hospitalId, setHospitalId] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [deletingWardId, setDeletingWardId] = useState(null);

  const [editingMaxMorning, setEditingMaxMorning] = useState(4);
  const [editingMaxEvening, setEditingMaxEvening] = useState(3);
  const [editingMaxNight, setEditingMaxNight] = useState(3);
  const [editingNoEveningToNight, setEditingNoEveningToNight] = useState(true);
  const [editingNoNightToMorning, setEditingNoNightToMorning] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      setHospitalId(user.hospital_id);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchHospitals();
  }, [currentUser]);

  useEffect(() => {
    if (!hospitalId) return;
    const fetchWards = async () => {
      const { data, error } = await supabase
        .from("wards")
        .select("*")
        .eq("hospital_id", hospitalId)
        .order("name");

      if (!error) setWards(data);
    };

    fetchWards();
  }, [hospitalId]);

  useEffect(() => {
    fetchHospitals();
    fetchWards();
  }, []);

  const fetchHospitals = async () => {
    if (!currentUser) return;

    let query = supabase.from("hospitals").select("id, name").order("name");

    // 👇 กรองเฉพาะของผู้ใช้ ถ้าไม่ใช่ admin
    if (currentUser.role !== "admin") {
      query = query.eq("id", currentUser.hospital_id);
    }

    const { data, error } = await query;
    if (error) toast.error("โหลดรายชื่อโรงพยาบาลล้มเหลว");
    else {
      setHospitals(data);

      // ตั้งค่าค่าเริ่มต้นของโรงพยาบาลทันทีถ้ายังไม่มี
      if (!selectedHospitalId && data.length === 1) {
        setSelectedHospitalId(data[0].id);
      }
    }
  };

  const fetchWards = async () => {
    const { data, error } = await supabase.from("wards").select(`
      id,
      name,
      hospital_id,
      max_morning_shift_per_day,
      max_evening_shift_per_day,
      max_night_shift_per_day,
      rule_no_evening_to_night,
      rule_no_night_to_morning,
      hospitals!fk_wards_hospital (
        name
      )
    `);

    if (error) {
      console.error("❌ load wards error", error);
      toast.error("โหลดวอร์ดล้มเหลว");
    } else {
      const transformed = data.map((w) => ({
        ...w,
        hospital_name: w.hospitals?.name || "",
      }));
      setWards(transformed);
    }
  };

  const addWard = async () => {
    if (!newWardName.trim() || !selectedHospitalId) {
      toast.warn("กรุณากรอกชื่อวอร์ดและเลือกโรงพยาบาล");
      return;
    }
    const { error } = await supabase.from("wards").insert({
      name: newWardName,
      hospital_id: selectedHospitalId,
      max_morning_shift_per_day: newMaxMorning,
      max_evening_shift_per_day: newMaxEvening,
      max_night_shift_per_day: newMaxNight,
      rule_no_evening_to_night: newNoEveningToNight,
      rule_no_night_to_morning: newNoNightToMorning,
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
      .update({
        name: editingName,
        hospital_id: editingHospitalId,
        max_morning_shift_per_day: editingMaxMorning,
        max_evening_shift_per_day: editingMaxEvening,
        max_night_shift_per_day: editingMaxNight,
        rule_no_evening_to_night: editingNoEveningToNight,
        rule_no_night_to_morning: editingNoNightToMorning,
      })
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

  const deleteWardConfirmed = async () => {
    const { error } = await supabase
      .from("wards")
      .delete()
      .eq("id", deletingWardId);
    if (error) toast.error("ลบไม่สำเร็จ");
    else {
      toast.success("ลบแล้ว");
      fetchWards();
    }
    setShowConfirm(false);
    setDeletingWardId(null);
  };

  const filtered = wards.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.hospital_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const confirmDeleteWard = (id) => {
    setDeletingWardId(id);
    setShowConfirm(true);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🏥 จัดการวอร์ด</h1>

      <div className="mb-4 flex flex-col gap-2">
        {/* แถวที่ 1: ช่องค้นหา */}
        <div className="flex gap-2 flex-wrap items-center">
          <input
            className="border px-2 py-1"
            placeholder="ค้นหาวอร์ดหรือโรงพยาบาล"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* แถวที่ 2: ตัวเลือก รพ. + ชื่อวอร์ดใหม่ + ปุ่ม */}
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            className="border px-2 py-1"
            disabled={hospitals.length === 1 && currentUser?.role !== "admin"}
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
          <input
            className="border px-2 py-1 w-20"
            type="number"
            value={newMaxMorning}
            onChange={(e) =>
              setNewMaxMorning(Math.max(0, Number(e.target.value)))
            }
            placeholder="เช้า"
          />
          <input
            className="border px-2 py-1 w-20"
            type="number"
            value={newMaxEvening}
            onChange={(e) =>
              setNewMaxEvening(Math.max(0, Number(e.target.value)))
            }
            placeholder="บ่าย"
          />
          <input
            className="border px-2 py-1 w-20"
            type="number"
            value={newMaxNight}
            onChange={(e) =>
              setNewMaxNight(Math.max(0, Number(e.target.value)))
            }
            placeholder="ดึก"
          />
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={newNoEveningToNight}
              onChange={(e) => setNewNoEveningToNight(e.target.checked)}
              title="ห้ามเวรบ่ายต่อเวรดึก"
            />
            ❌บ→ด
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={newNoNightToMorning}
              onChange={(e) => setNewNoNightToMorning(e.target.checked)}
              title="ห้ามเวรดึกต่อเวรเช้า"
            />
            ❌ด→ช
          </label>

          <button
            onClick={addWard}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            ➕ เพิ่มวอร์ด
          </button>
        </div>
      </div>

      <table className="table-auto border-collapse w-full">
        <thead>
          <tr className="bg-gray-100 text-black">
            <th className="border px-2 py-1">ชื่อวอร์ด</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">เวรเช้า</th>
            <th className="border px-2 py-1">เวรบ่าย</th>
            <th className="border px-2 py-1">เวรดึก</th>
            <th className="border px-2 py-1" title="ห้ามเวรบ่ายต่อเวรดึก">
              ❌บ่าย→ดึก
            </th>
            <th className="border px-2 py-1" title="ห้ามเวรดึกต่อเวรเช้า">
              ❌ดึก→เช้า
            </th>
            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((w) => (
            <tr key={w.id}>
              <td className="border px-2 py-1">
                {editingId === w.id ? (
                  <input
                    className="border px-2 py-1 w-full bg-gray-800 text-white"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  w.name
                )}
              </td>

              <td className="border px-2 py-1 text-white">
                {editingId === w.id ? (
                  <select
                    value={editingHospitalId}
                    onChange={(e) => setEditingHospitalId(e.target.value)}
                    className="border px-2 py-1 w-full bg-gray-800 text-white"
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  w.hospital_name || ""
                )}
              </td>
              <td className="border px-2 py-1 text-center">
                {editingId === w.id ? (
                  <input
                    className="border px-2 py-1 w-16 text-white"
                    type="number"
                    value={editingMaxMorning}
                    onChange={(e) =>
                      setEditingMaxMorning(Math.max(0, Number(e.target.value)))
                    }
                  />
                ) : (
                  w.max_morning_shift_per_day
                )}
              </td>

              <td className="border px-2 py-1 text-center">
                {editingId === w.id ? (
                  <input
                    className="border px-2 py-1 w-16 text-white"
                    type="number"
                    value={editingMaxEvening}
                    onChange={(e) =>
                      setEditingMaxEvening(Math.max(0, Number(e.target.value)))
                    }
                  />
                ) : (
                  w.max_evening_shift_per_day
                )}
              </td>

              <td className="border px-2 py-1 text-center">
                {editingId === w.id ? (
                  <input
                    className="border px-2 py-1 w-16 text-white"
                    type="number"
                    value={editingMaxNight}
                    onChange={(e) =>
                      setEditingMaxNight(Math.max(0, Number(e.target.value)))
                    }
                  />
                ) : (
                  w.max_night_shift_per_day
                )}
              </td>

              <td className="border px-2 py-1 text-center">
                {editingId === w.id ? (
                  <input
                    type="checkbox"
                    checked={editingNoEveningToNight}
                    onChange={(e) =>
                      setEditingNoEveningToNight(e.target.checked)
                    }
                    title="ห้ามเวรบ่ายต่อเวรดึก"
                  />
                ) : w.rule_no_evening_to_night ? (
                  "✅"
                ) : (
                  "❌"
                )}
              </td>

              <td className="border px-2 py-1 text-center">
                {editingId === w.id ? (
                  <input
                    type="checkbox"
                    checked={editingNoNightToMorning}
                    onChange={(e) =>
                      setEditingNoNightToMorning(e.target.checked)
                    }
                    title="ห้ามเวรดึกต่อเวรเช้า"
                  />
                ) : w.rule_no_night_to_morning ? (
                  "✅"
                ) : (
                  "❌"
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
                        setEditingMaxMorning(w.max_morning_shift_per_day || 0);
                        setEditingMaxEvening(w.max_evening_shift_per_day || 0);
                        setEditingMaxNight(w.max_night_shift_per_day || 0);
                        setEditingNoEveningToNight(
                          !!w.rule_no_evening_to_night
                        );
                        setEditingNoNightToMorning(
                          !!w.rule_no_night_to_morning
                        );
                      }}
                      className="text-blue-600 hover:underline mr-2"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => confirmDeleteWard(w.id)}
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
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl text-center w-80">
            <h2 className="text-xl font-semibold mb-4 text-black">
              ยืนยันการลบ
            </h2>
            <p className="mb-6 text-black">
              คุณแน่ใจหรือไม่ว่าต้องการลบวอร์ดนี้?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={deleteWardConfirmed}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                ลบ
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
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
