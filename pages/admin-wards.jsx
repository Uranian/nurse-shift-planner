// 📄 pages/admin-wards.jsx

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

/* =======================
   📋  ค่าคงที่ / helper
   ======================= */
const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/* =======================
   🏥  AdminWards component
   ======================= */
export default function AdminWards() {
  /* ----- state หลัก ----- */
  const [wards, setWards] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  /* ----- state ใช้ตอนเพิ่มวอร์ด ----- */
  const [newWardName, setNewWardName] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [newMaxMorning, setNewMaxMorning] = useState(4);
  const [newMaxEvening, setNewMaxEvening] = useState(3);
  const [newMaxNight, setNewMaxNight] = useState(3);
  const [newNoE2N, setNewNoE2N] = useState(true); // ห้ามบ่าย→ดึก
  const [newNoN2M, setNewNoN2M] = useState(true); // ห้ามดึก→เช้า
  const [newMonthRestDays, setNewMonthRestDays] = useState(Array(12).fill(8));

  /* ----- state ใช้ตอนแก้ไขวอร์ด ----- */
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingHospitalId, setEditingHospitalId] = useState("");
  const [editMaxMorning, setEditMaxMorning] = useState(4);
  const [editMaxEvening, setEditMaxEvening] = useState(3);
  const [editMaxNight, setEditMaxNight] = useState(3);
  const [editNoE2N, setEditNoE2N] = useState(true);
  const [editNoN2M, setEditNoN2M] = useState(true);
  const [editMonthRestDays, setEditMonthRestDays] = useState(Array(12).fill(0));

  /* ----- misc ----- */
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [deletingWardId, setDeletingWardId] = useState(null);

  /* =======================
     🔄  โหลดข้อมูลเบื้องต้น
     ======================= */
  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchHospitals();
  }, [currentUser]);

  const fetchHospitals = async () => {
    if (!currentUser) return;
    let q = supabase.from("hospitals").select("id, name").order("name");
    if (currentUser.role !== "admin") q = q.eq("id", currentUser.hospital_id);

    const { data, error } = await q;
    if (error) toast.error("โหลดรายชื่อโรงพยาบาลล้มเหลว");
    else {
      setHospitals(data);
      if (!selectedHospitalId && data.length === 1)
        setSelectedHospitalId(data[0].id);
    }
  };

  useEffect(() => {
    fetchWards();
  }, [selectedHospitalId]);

  const fetchWards = async () => {
    const { data, error } = await supabase
      .from("wards")
      .select(
        `
        id, name, hospital_id,
        max_morning_shift_per_day,
        max_evening_shift_per_day,
        max_night_shift_per_day,
        rule_no_evening_to_night,
        rule_no_night_to_morning,
        month_rest_days,
        hospitals!fk_wards_hospital ( name )
      `
      )
      .order("name");

    if (error) toast.error("โหลดวอร์ดล้มเหลว");
    else {
      setWards(
        data.map((w) => ({
          ...w,
          hospital_name: w.hospitals?.name || "",
          month_rest_days: w.month_rest_days || Array(12).fill(0),
        }))
      );
    }
  };

  /* =======================
     ➕  เพิ่มวอร์ด
     ======================= */
  const addWard = async () => {
    if (!newWardName.trim() || !selectedHospitalId) {
      toast.warn("กรุณากรอกชื่อวอร์ดและเลือกโรงพยาบาล");
      return;
    }
    const { error } = await supabase.from("wards").insert({
      name: newWardName.trim(),
      hospital_id: selectedHospitalId,
      max_morning_shift_per_day: newMaxMorning,
      max_evening_shift_per_day: newMaxEvening,
      max_night_shift_per_day: newMaxNight,
      rule_no_evening_to_night: newNoE2N,
      rule_no_night_to_morning: newNoN2M,
      month_rest_days: newMonthRestDays,
    });
    if (error) toast.error("เพิ่มวอร์ดไม่สำเร็จ");
    else {
      toast.success("เพิ่มวอร์ดแล้ว");
      /* reset */
      setNewWardName("");
      setSelectedHospitalId("");
      setNewMonthRestDays(Array(12).fill(8));
      fetchWards();
    }
  };

  /* =======================
     ✏️   แก้ไขวอร์ด
     ======================= */
  const updateWard = async (id) => {
    const { error } = await supabase
      .from("wards")
      .update({
        name: editingName.trim(),
        hospital_id: editingHospitalId,
        max_morning_shift_per_day: editMaxMorning,
        max_evening_shift_per_day: editMaxEvening,
        max_night_shift_per_day: editMaxNight,
        rule_no_evening_to_night: editNoE2N,
        rule_no_night_to_morning: editNoN2M,
        month_rest_days: editMonthRestDays,
      })
      .eq("id", id);

    if (error) toast.error("บันทึกไม่สำเร็จ");
    else {
      toast.success("บันทึกสำเร็จ");
      setEditingId(null);
      fetchWards();
    }
  };

  /* =======================
     🗑  ลบวอร์ด
     ======================= */
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

  /* =======================
     🔍  filter table rows
     ======================= */
  const filtered = wards.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.hospital_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* =======================
        🌐  UI เริ่มต้น
     ======================= */
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🏥 จัดการวอร์ด</h1>

      {/* ===== ค้นหา ===== */}
      <input
        className="border px-2 py-1 mb-4 w-full max-w-xs"
        placeholder="ค้นหาวอร์ดหรือโรงพยาบาล"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* ===== ฟอร์มเพิ่มวอร์ด ===== */}
      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">➕ เพิ่มวอร์ดใหม่</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {/* โรงพยาบาล */}
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

          {/* ชื่อวอร์ด */}
          <input
            className="border px-2 py-1"
            placeholder="ชื่อวอร์ด"
            value={newWardName}
            onChange={(e) => setNewWardName(e.target.value)}
          />

          {/* quota */}
          <input
            className="border px-1 w-16"
            type="number"
            value={newMaxMorning}
            onChange={(e) => setNewMaxMorning(Number(e.target.value))}
            placeholder="เช้า"
          />
          <input
            className="border px-1 w-16"
            type="number"
            value={newMaxEvening}
            onChange={(e) => setNewMaxEvening(Number(e.target.value))}
            placeholder="บ่าย"
          />
          <input
            className="border px-1 w-16"
            type="number"
            value={newMaxNight}
            onChange={(e) => setNewMaxNight(Number(e.target.value))}
            placeholder="ดึก"
          />

          {/* rule checkbox */}
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={newNoE2N}
              onChange={(e) => setNewNoE2N(e.target.checked)}
            />
            ❌บ→ด
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={newNoN2M}
              onChange={(e) => setNewNoN2M(e.target.checked)}
            />
            ❌ด→ช
          </label>

          {/* วันพักต่อเดือน (input 12 ช่อง) */}
          <div className="flex flex-wrap gap-1 items-center">
            {TH_MONTHS.map((m, idx) => (
              <input
                key={idx}
                title={`วันพักเดือน ${m}`}
                className="border px-1 w-12 text-center"
                type="number"
                min={0}
                value={newMonthRestDays[idx]}
                onChange={(e) => {
                  const arr = [...newMonthRestDays];
                  arr[idx] = Math.max(0, Number(e.target.value));
                  setNewMonthRestDays(arr);
                }}
              />
            ))}
          </div>

          <button
            onClick={addWard}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            บันทึก
          </button>
        </div>
      </div>

      {/* ===== ตารางวอร์ด ===== */}
      <table className="table-auto border-collapse w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-black">
            <th className="border px-2 py-1">วอร์ด</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">เช้า</th>
            <th className="border px-2 py-1">บ่าย</th>
            <th className="border px-2 py-1">ดึก</th>
            <th className="border px-2 py-1">❌บ→ด</th>
            <th className="border px-2 py-1">❌ด→ช</th>
            <th className="border px-2 py-1">วันพัก/เดือน</th>
            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((w) => (
            <tr key={w.id}>
              {/* ---------- ชื่อวอร์ด ---------- */}
              <td className="border px-2 py-1">
                {editingId === w.id ? (
                  <input
                    className="border px-1 w-full bg-gray-800 text-white"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  w.name
                )}
              </td>

              {/* ---------- โรงพยาบาล ---------- */}
              <td className="border px-2 py-1">
                {editingId === w.id ? (
                  <select
                    className="border px-1 bg-gray-800 text-white w-full"
                    value={editingHospitalId}
                    onChange={(e) => setEditingHospitalId(e.target.value)}
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  w.hospital_name
                )}
              </td>

              {/* ---------- quota ---------- */}
              {["Morning", "Evening", "Night"].map((label, i) => (
                <td key={i} className="border px-2 py-1 text-center">
                  {editingId === w.id ? (
                    <input
                      className="border px-1 w-16 text-white"
                      type="number"
                      value={[editMaxMorning, editMaxEvening, editMaxNight][i]}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value));
                        if (i === 0) setEditMaxMorning(v);
                        if (i === 1) setEditMaxEvening(v);
                        if (i === 2) setEditMaxNight(v);
                      }}
                    />
                  ) : (
                    [
                      w.max_morning_shift_per_day,
                      w.max_evening_shift_per_day,
                      w.max_night_shift_per_day,
                    ][i]
                  )}
                </td>
              ))}

              {/* ---------- rules ---------- */}
              <td className="border px-2 py-1 text-center">
                {editingId === w.id ? (
                  <input
                    type="checkbox"
                    checked={editNoE2N}
                    onChange={(e) => setEditNoE2N(e.target.checked)}
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
                    checked={editNoN2M}
                    onChange={(e) => setEditNoN2M(e.target.checked)}
                  />
                ) : w.rule_no_night_to_morning ? (
                  "✅"
                ) : (
                  "❌"
                )}
              </td>

              {/* ---------- rest days array ---------- */}
              <td className="border px-2 py-1 text-center whitespace-nowrap">
                {editingId === w.id ? (
                  <div className="flex flex-wrap gap-1">
                    {TH_MONTHS.map((m, idx) => (
                      <input
                        key={idx}
                        title={m}
                        className="border px-1 w-12 text-center text-white"
                        type="number"
                        min={0}
                        value={editMonthRestDays[idx] || 0}
                        onChange={(e) => {
                          const arr = [...editMonthRestDays];
                          arr[idx] = Math.max(0, Number(e.target.value));
                          setEditMonthRestDays(arr);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  w.month_rest_days.join(", ")
                )}
              </td>

              {/* ---------- action buttons ---------- */}
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
                        setEditMaxMorning(w.max_morning_shift_per_day);
                        setEditMaxEvening(w.max_evening_shift_per_day);
                        setEditMaxNight(w.max_night_shift_per_day);
                        setEditNoE2N(!!w.rule_no_evening_to_night);
                        setEditNoN2M(!!w.rule_no_night_to_morning);
                        setEditMonthRestDays(w.month_rest_days);
                      }}
                      className="text-blue-600 mr-2"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => {
                        setDeletingWardId(w.id);
                        setShowConfirm(true);
                      }}
                      className="text-red-600"
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

      {/* ===== modal ยืนยันลบ ===== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-80 text-center">
            <h2 className="font-semibold text-lg mb-4 text-black">
              ยืนยันการลบ
            </h2>
            <p className="mb-6 text-black">แน่ใจหรือไม่ที่จะลบวอร์ดนี้?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={deleteWardConfirmed}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                ลบ
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-300 px-4 py-2 rounded"
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
