// 📄 src/pages/shift-planner.jsx

import React, { useState, useEffect, useRef } from "react"; // ✅ เพิ่ม useRef
import dayjs from "dayjs";
import { supabase } from "../lib/supabaseClient";
import NoSSR from "../components/NoSSR";
import Link from "next/link";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { useRouter } from "next/router"; // เพิ่ม
import {
  DEFAULT_HOSPITAL_ID,
  DEFAULT_WARD_ID,
  DEFAULT_HOSPITAL_NAME,
  DEFAULT_WARD_NAME,
} from "../config";
import "dayjs/locale/th";
dayjs.locale("th");

const shifts = ["morning", "evening", "night"];
const shiftLabels = {
  morning: "เช้า",
  evening: "บ่าย",
  night: "ดึก",
};

const currentYear = dayjs().year();
const currentMonth = dayjs().month() + 1;

function ShiftPlanner() {
  const router = useRouter(); // เพิ่ม
  const [assignments, setAssignments] = useState({});
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [statusMessage, setStatusMessage] = useState("");

  const [planId, setPlanId] = useState(null);
  const [shiftPlanName, setShiftPlanName] = useState("");
  const [editingPlan, setEditingPlan] = useState(false);

  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const yearMonth = dayjs(`${year}-${month}-01`).format("YYYY-MM");

  const [nurseList, setNurseList] = useState([]);
  const [nurseMap, setNurseMap] = useState({});

  const [hospitalId, setHospitalId] = useState(null);
  const [wardId, setWardId] = useState(null);
  const [hospitalName, setHospitalName] = useState("");
  const [wardName, setWardName] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const [viewingPlan, setViewingPlan] = useState(null); // ข้อมูลตารางเวรที่กำลังดู
  const [viewingAssignments, setViewingAssignments] = useState({});

  const lastWarnings = useRef(new Set());

  const viewPlanDetails = async (planId, name) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .eq("plan_id", planId);

    if (error || !data) {
      toast.error("❌ โหลดตารางเวรไม่สำเร็จ");
      return;
    }

    const result = {};
    data.forEach((row) => {
      const date = row.shift_date;
      if (!result[date]) result[date] = {};
      if (!result[date][row.nurse_id]) result[date][row.nurse_id] = [];
      result[date][row.nurse_id].push(row.shift_type);
    });

    setViewingAssignments(result);
    setViewingPlan({ id: planId, name });
  };

  const loadPlanForEdit = async (planIdToLoad, name) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .eq("plan_id", planIdToLoad);

    if (error || !data) {
      toast.error("❌ โหลดข้อมูลไม่สำเร็จ");
      return;
    }

    const loaded = {};
    data.forEach((row) => {
      const date = row.shift_date;
      if (!loaded[date]) loaded[date] = {};
      if (!loaded[date][row.nurse_id]) loaded[date][row.nurse_id] = [];
      loaded[date][row.nurse_id].push(row.shift_type);
    });

    setAssignments(loaded);
    setPlanId(planIdToLoad);
    setShiftPlanName(name);
    setEditingPlan(true);
    setStatusMessage("🛠 กำลังแก้ไขตารางเวรเดิม");
    setShowPlanDialog(false);
  };

  const saveToExistingPlan = async () => {
    if (!planId || !hospitalId || !wardId) {
      toast.error("❌ ไม่มี plan_id หรือ hospital/ward");
      return;
    }

    try {
      const rows = [];
      for (const [date, nurses] of Object.entries(assignments)) {
        for (const [nurse, shiftList] of Object.entries(nurses)) {
          for (const shift of shiftList) {
            rows.push({
              plan_id: planId,
              nurse_id: nurse,
              shift_date: date,
              shift_type: shift,
              hospital_id: hospitalId,
              ward_id: wardId,
            });
          }
        }
      }

      await supabase.from("nurse_shifts").delete().eq("plan_id", planId);

      const { error } = await supabase.from("nurse_shifts").insert(rows);
      if (error) {
        toast.error("❌ บันทึกทับตารางเวรเดิมไม่สำเร็จ");
      } else {
        toast.success("✅ บันทึกทับตารางเวรเดิมเรียบร้อย");
      }
    } catch (e) {
      toast.error("❌ บันทึกผิดพลาด: " + e.message);
    }
  };

  const deletePlan = async (planIdToDelete) => {
    const result = await Swal.fire({
      title: "ลบตารางเวรนี้?",
      text: "คุณจะไม่สามารถกู้คืนข้อมูลได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#aaa",
      confirmButtonText: "🗑 ลบเลย",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase
      .from("shift_plans")
      .delete()
      .eq("id", planIdToDelete);

    if (error) {
      toast.error("❌ ลบตารางเวรไม่สำเร็จ");
    } else {
      toast.success("🗑 ลบตารางเวรเรียบร้อย");
      setAvailablePlans((prev) => prev.filter((p) => p.id !== planIdToDelete));
    }
  };

  const editPlanName = async (planIdToEdit, oldName) => {
    const { value: newName } = await Swal.fire({
      title: "✏️ แก้ไขชื่อตารางเวร",
      input: "text",
      inputLabel: "ชื่อใหม่ของตารางเวร",
      inputValue: oldName,
      inputPlaceholder: "ระบุชื่อตารางเวรใหม่",
      showCancelButton: true,
      confirmButtonText: "💾 บันทึก",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (!value || value.trim() === "") {
          return "กรุณาระบุชื่อตารางเวรใหม่";
        }
      },
    });

    if (!newName) return;

    const { error } = await supabase
      .from("shift_plans")
      .update({ name: newName.trim() })
      .eq("id", planIdToEdit);

    if (error) {
      toast.error("❌ แก้ไขชื่อไม่สำเร็จ");
    } else {
      toast.success("✏️ แก้ไขชื่อเรียบร้อย");
      setAvailablePlans((prev) =>
        prev.map((p) =>
          p.id === planIdToEdit ? { ...p, name: newName.trim() } : p
        )
      );
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("logged_in_user");
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  // 🌐 โหลด context จาก localStorage
  useEffect(() => {
    const loadContext = async () => {
      const raw = localStorage.getItem("shift_planner_context");
      let prefs = raw ? JSON.parse(raw) : null;

      if (!prefs) {
        // ถ้ายังไม่มีใน localStorage → โหลดจาก hospitals
        const hospitalRes = await supabase
          .from("hospitals")
          .select("id, name, shift_default_ward_id, shift_default_ward_name")
          .eq("id", DEFAULT_HOSPITAL_ID) // หรือ hospitalId จาก login
          .single();

        const h = hospitalRes.data;
        if (h) {
          prefs = {
            hospital_id: h.id,
            ward_id: h.shift_default_ward_id || DEFAULT_WARD_ID,
            hospital_name: h.name,
            ward_name: h.shift_default_ward_name || DEFAULT_WARD_NAME,
          };
          localStorage.setItem("shift_planner_context", JSON.stringify(prefs));
        }
      }

      if (prefs) {
        setHospitalId(prefs.hospital_id);
        setWardId(prefs.ward_id);
        setHospitalName(prefs.hospital_name);
        setWardName(prefs.ward_name);
      }
    };

    loadContext();
  }, []);

  useEffect(() => {
    const loadNurses = async () => {
      console.log("📌 hospitalId =", hospitalId);
      console.log("📌 wardId =", wardId);

      if (!hospitalId || !wardId) {
        console.warn("❌ ยังไม่มี hospitalId หรือ wardId");
        return;
      }

      const { data, error } = await supabase
        .from("nurses")
        .select("id, name, display_order")
        .eq("hospital_id", hospitalId)
        .eq("ward_id", wardId)
        .eq("is_active_for_shift", true)
        .order("display_order", { ascending: true });

      if (error || !data) {
        console.error(
          "โหลดรายชื่อพยาบาลผิดพลาด:",
          error?.message || "ไม่มีข้อมูล"
        );
        setStatusMessage("⚠️ โหลดรายชื่อพยาบาลไม่สำเร็จ");
      } else if (data.length === 0) {
        setStatusMessage("⚠️ ไม่พบรายชื่อพยาบาลในวอร์ดนี้");
        setNurseList([]);
        setNurseMap({});
      } else {
        setNurseList(data.map((n) => n.id));
        const map = {};
        data.forEach((n) => (map[n.id] = n.name));
        setNurseMap(map);
      }
    };

    loadNurses();
  }, [hospitalId, wardId]);

  useEffect(() => {
    if (!hospitalId || !wardId) return;

    const loadPlanId = async () => {
      const { data, error } = await supabase
        .from("shift_plans")
        .select("id, name")
        .eq("hospital_id", hospitalId)
        .eq("ward_id", wardId)
        .eq("month", month)
        .eq("year", year)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setPlanId(null);
        setShiftPlanName("");
        setStatusMessage("⚠️ ยังไม่มีตารางเวรของเดือนนี้ กรุณาสร้างก่อน");
      } else {
        setPlanId(data.id);
        setShiftPlanName(data.name);
      }
    };

    loadPlanId();
  }, [hospitalId, wardId, year, month]);

  useEffect(() => {
    const fetchFromSupabase = async () => {
      // 🧼 เคลียร์คำเตือนเดิมทุกครั้งที่เปลี่ยนเดือน
      lastWarnings.current.clear();

      if (!hospitalId || !wardId) return;
      const monthStart = `${yearMonth}-01`;
      const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

      if (!planId) return;
      const { data, error } = await supabase
        .from("nurse_shifts")
        .select("*")
        .eq("hospital_id", hospitalId)
        .eq("ward_id", wardId)
        .eq("plan_id", planId);

      if (error) {
        setStatusMessage("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        return;
      }

      if (!data || data.length === 0) {
        setAssignments({});
        setStatusMessage("🆕 ไม่มีข้อมูลเก่าในเดือนนี้");
        return;
      }

      const loaded = {};
      for (const row of data) {
        const date = row.shift_date;
        if (!loaded[date]) loaded[date] = {};
        if (!loaded[date][row.nurse_id]) loaded[date][row.nurse_id] = [];
        loaded[date][row.nurse_id].push(row.shift_type);
      }

      setAssignments(loaded);
      setStatusMessage("✅ โหลดข้อมูลแล้ว");
    };

    fetchFromSupabase();
  }, [year, month, hospitalId, wardId]);

  const toggleShift = (nurseId, day, shift) => {
    const dateKey = `${yearMonth}-${day.toString().padStart(2, "0")}`;

    // 🧼 เคลียร์ warning เดิมก่อนเตือนใหม่
    lastWarnings.current.clear();

    setAssignments((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));

      if (!updated[dateKey]) updated[dateKey] = {};
      if (!updated[dateKey][nurseId]) updated[dateKey][nurseId] = [];

      const current = updated[dateKey][nurseId];
      const index = current.indexOf(shift);
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(shift);
      }

      // ✅ เรียก validate จาก updated ทันที
      setTimeout(() => {
        validateSingleChange(nurseId, day, updated);
      }, 10); // ✅ หน่วงนิดนึงเพื่อให้ UI ตอบสนองก่อน
      // ✅ ตรวจข้ามวันด้วย: ถ้าคลิกเวรดึก → ต้องดูวันพรุ่งนี้ด้วย
      if (shift === "night" && day < daysInMonth) {
        setTimeout(() => {
          validateSingleChange(nurseId, day + 1, updated);
        }, 10); // ✅ หน่วงนิดนึงเพื่อให้ UI ตอบสนองก่อน
      }
      // ✅ ถ้าคลิกเวรเช้า → ต้องดูวันก่อนด้วย
      if (shift === "morning" && day > 1) {
        setTimeout(() => {
          validateSingleChange(nurseId, day - 1, updated);
        }, 10); // ✅ หน่วงนิดนึงเพื่อให้ UI ตอบสนองก่อน
      }

      return updated;
    });
  };

  const validateSingleChange = (nurseId, day, assignmentsState) => {
    const dateKey = `${yearMonth}-${day.toString().padStart(2, "0")}`;
    const prevDateKey =
      day > 1 ? `${yearMonth}-${(day - 1).toString().padStart(2, "0")}` : null;
    const nextDateKey =
      day < daysInMonth
        ? `${yearMonth}-${(day + 1).toString().padStart(2, "0")}`
        : null;

    const todayShifts = assignmentsState[dateKey]?.[nurseId] || [];
    const prevShifts = prevDateKey
      ? assignmentsState[prevDateKey]?.[nurseId] || []
      : [];
    const nextShifts = nextDateKey
      ? assignmentsState[nextDateKey]?.[nurseId] || []
      : [];

    const shiftCount = { morning: 0, evening: 0, night: 0 };
    nurseList.forEach((n) => {
      const shifts = assignmentsState[dateKey]?.[n] || [];
      shifts.forEach((s) => shiftCount[s]++);
    });

    // ⚠️ เตือนเวรเกิน
    const keyOver = `over-${dateKey}`;
    if (
      shiftCount.morning > 4 ||
      shiftCount.evening > 3 ||
      shiftCount.night > 3
    ) {
      if (!lastWarnings.current.has(keyOver)) {
        toast.warn(`⚠️ วันที่ ${day} มีเวรเกินที่กำหนด`);
        lastWarnings.current.add(keyOver);
      }
    }

    // ⛔ ห้ามดึกต่อเช้า
    const keyNightMorning = `nm-${nurseId}-${day}`;
    if (todayShifts.includes("night") && nextShifts.includes("morning")) {
      if (!lastWarnings.current.has(keyNightMorning)) {
        toast.warn(
          `⛔ ${nurseMap[nurseId]} ห้ามเวรดึกต่อเช้า (วันที่ ${day} → ${
            day + 1
          })`
        );
        lastWarnings.current.add(keyNightMorning);
      }
    }

    // ⛔ ห้ามบ่ายต่อดึก
    const keyEveningNight = `en-${nurseId}-${day}`;
    if (prevShifts.includes("evening") && todayShifts.includes("night")) {
      if (!lastWarnings.current.has(keyEveningNight)) {
        toast.warn(`⛔ ${nurseMap[nurseId]} ห้ามเวรบ่ายต่อดึก (วันที่ ${day})`);
        lastWarnings.current.add(keyEveningNight);
      }
    }
  };

  const saveToSupabase = async () => {
    if (!hospitalId || !wardId) {
      toast.error("⚠️ ไม่มี hospital_id หรือ ward_id ในบริบทผู้ใช้");
      return;
    }

    try {
      if (!shiftPlanName.trim()) {
        toast.error("⚠️ กรุณาตั้งชื่อตารางเวรก่อนบันทึก");
        return;
      }

      // สร้างตารางเวรใหม่
      const { data: plan, error: planError } = await supabase
        .from("shift_plans")
        .insert([
          {
            hospital_id: hospitalId,
            ward_id: wardId,
            name: shiftPlanName.trim(),
            month,
            year,
          },
        ])
        .select()
        .single();

      if (planError || !plan) {
        toast.error("❌ สร้างตารางเวรไม่สำเร็จ");
        return;
      }

      const newPlanId = plan.id;
      setPlanId(newPlanId); // ใช้ในการ insert shift

      const rows = [];
      for (const [date, nurses] of Object.entries(assignments)) {
        for (const [nurse, shiftList] of Object.entries(nurses)) {
          for (const shift of shiftList) {
            rows.push({
              plan_id: newPlanId,
              nurse_id: nurse,
              shift_date: date,
              shift_type: shift,
              hospital_id: hospitalId,
              ward_id: wardId,
            });
          }
        }
      }

      const monthStart = `${yearMonth}-01`;
      const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

      await supabase.from("nurse_shifts").delete().eq("plan_id", newPlanId);

      const { error } = await supabase.from("nurse_shifts").insert(rows);
      if (error) {
        toast.error("❌ เกิดข้อผิดพลาด: " + error.message);
      } else {
        toast.success("✅ บันทึกข้อมูลสำเร็จ");
      }
    } catch (e) {
      toast.error("⚠️ บันทึกล้มเหลว: " + e.message);
    }
  };

  const clearAssignments = () => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลของเดือนนี้?")) {
      setAssignments({});
      setStatusMessage("🗑 ล้างข้อมูลเรียบร้อยแล้ว (ยังไม่บันทึก)");
    }
  };

  const copyFromPreviousMonth = async () => {
    const prev = dayjs(`${year}-${month}-01`).subtract(1, "month");
    const prevMonthStart = prev.startOf("month").format("YYYY-MM-DD");
    const prevMonthEnd = prev.endOf("month").format("YYYY-MM-DD");

    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .gte("date", prevMonthStart)
      .lte("date", prevMonthEnd);

    if (error || !data || data.length === 0) {
      toast.error("⚠️ ไม่พบข้อมูลในเดือนก่อนหน้า");
      return;
    }

    const copied = {};
    data.forEach((row) => {
      const day = dayjs(row.date).date();
      const newDate = `${yearMonth}-${day.toString().padStart(2, "0")}`;
      if (!copied[newDate]) copied[newDate] = {};
      if (!copied[newDate][row.nurse_id]) copied[newDate][row.nurse_id] = [];
      copied[newDate][row.nurse_id].push(row.shift);
    });

    setAssignments(copied);
    setStatusMessage("🔁 คัดลอกจากเดือนก่อนหน้าแล้ว (ยังไม่บันทึก)");
  };

  const printReport = () => {
    const summary = {};
    Object.entries(assignments).forEach(([date, nurses]) => {
      Object.entries(nurses).forEach(([nurse, shifts]) => {
        if (!summary[nurse]) summary[nurse] = [];
        shifts.forEach((s) => {
          summary[nurse].push({ date, shift: s });
        });
      });
    });

    let output = `📄 รายงานเวรพยาบาลประจำเดือน ${yearMonth}\n\n`;
    for (const nurse of nurseList) {
      output += `👩‍⚕️ ${nurseMap[nurse] || nurse}\n`;
      const records = summary[nurse] || [];
      records.sort((a, b) => a.date.localeCompare(b.date));
      records.forEach((r) => {
        output += `- ${r.date} : ${shiftLabels[r.shift]}\n`;
      });
      output += "\n";
    }

    toast.info(output);
  };

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const summary = [];
    Object.entries(assignments).forEach(([date, nurses]) => {
      Object.entries(nurses).forEach(([nurse, shifts]) => {
        shifts.forEach((s) => {
          summary.push({
            พยาบาล: nurseMap[nurse] || nurse,
            วันที่: date,
            เวร: shiftLabels[s],
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(summary);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "เวรพยาบาล");
    XLSX.writeFile(workbook, `nurse-shifts-${yearMonth}.xlsx`);
  };
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);

  const openCopyPlanDialog = async () => {
    if (!hospitalId || !wardId) return;
    const { data, error } = await supabase
      .from("shift_plans")
      .select("*")
      .eq("hospital_id", hospitalId)
      .eq("ward_id", wardId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      toast.error("⚠️ โหลดตารางเวรไม่สำเร็จ");
      return;
    }

    setAvailablePlans(data);
    setShowPlanDialog(true);
  };

  const copyFromPlanId = async (copyPlanId) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .eq("plan_id", copyPlanId);

    if (error || !data || data.length === 0) {
      toast.error("⚠️ ไม่พบข้อมูลในตารางเวรนี้");
      return;
    }

    const copied = {};
    data.forEach((row) => {
      const day = dayjs(row.shift_date).date();
      const newDate = `${yearMonth}-${day.toString().padStart(2, "0")}`;
      if (!copied[newDate]) copied[newDate] = {};
      if (!copied[newDate][row.nurse_id]) copied[newDate][row.nurse_id] = [];
      copied[newDate][row.nurse_id].push(row.shift_type);
    });

    setAssignments(copied);
    setStatusMessage("🔁 คัดลอกจากตารางเวรสำเร็จ (ยังไม่บันทึก)");
    setShowPlanDialog(false);
  };

  return (
    <div className="overflow-auto p-4">
      {showPlanDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded max-h-[80vh] overflow-y-auto w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-black">
              รายการตารางเวรเก่า
            </h2>
            {availablePlans.map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center py-2 border-b gap-2"
              >
                <div className="flex-1 text-black">
                  🗓 {p.name} ({p.month}/{p.year})
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => copyFromPlanId(p.id)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
                  >
                    ✅ คัดลอก
                  </button>
                  <button
                    onClick={() => loadPlanForEdit(p.id, p.name)}
                    className="bg-teal-600 text-white px-2 py-1 rounded text-sm"
                  >
                    🛠 แก้เวร
                  </button>
                  <button
                    onClick={() => editPlanName(p.id, p.name)}
                    className="bg-orange-500 text-white px-2 py-1 rounded text-sm"
                  >
                    ✏️ แก้ชื่อ
                  </button>
                  <button
                    onClick={() => viewPlanDetails(p.id, p.name)}
                    className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                  >
                    👁 ดู
                  </button>
                  <button
                    onClick={() => deletePlan(p.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded text-sm"
                  >
                    🗑 ลบ
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowPlanDialog(false)}
              className="mt-4 bg-gray-500 text-white px-3 py-2 rounded"
            >
              ❌ ยกเลิก
            </button>
          </div>
        </div>
      )}
      {viewingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded max-h-[80vh] overflow-y-auto w-full max-w-4xl">
            <h2 className="text-lg font-bold mb-4 text-center text-black">
              👁 ตารางเวร: {viewingPlan.name}
            </h2>
            <table className="table-auto border-collapse text-sm mx-auto mb-4">
              <thead>
                <tr>
                  <th className="border px-2 py-1 bg-gray-200 text-black sticky left-0 z-10">
                    👩‍⚕️ พยาบาล
                  </th>
                  {Array.from({ length: 31 }, (_, i) => (
                    <th
                      key={i + 1}
                      className="border px-2 py-1 bg-gray-100 text-black"
                    >
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nurseList.map((nurse, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="border px-2 py-1 sticky left-0 bg-white text-black z-10">
                      {nurseMap[nurse] || nurse}
                    </td>
                    {Array.from({ length: 31 }, (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const dateKey = `${year}-${month
                        .toString()
                        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                      const assigned =
                        viewingAssignments[dateKey]?.[nurse] || [];
                      return (
                        <td
                          key={dayIndex}
                          className="border px-1 py-1 text-center bg-white"
                        >
                          {assigned.map((s) => (
                            <div
                              key={s}
                              className={`text-xs rounded px-1 mb-0.5 text-black ${
                                s === "morning"
                                  ? "bg-blue-300"
                                  : s === "evening"
                                  ? "bg-orange-300"
                                  : "bg-purple-300"
                              }`}
                            >
                              {shiftLabels[s]}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-center">
              <button
                onClick={() => setViewingPlan(null)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                ❌ ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* หัวเรื่อง + ปุ่มลิงก์ admin */}
      <div className="flex flex-wrap items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          📅 ตารางจัดเวรพยาบาล (
          {dayjs(`${year}-${month}-01`).format("MMMM YYYY")})
          {shiftPlanName && (
            <>
              {" "}
              - <span className="text-blue-300">{shiftPlanName}</span>
            </>
          )}
        </h1>

        {hospitalId && wardId && (
          <div className="text-sm text-gray-600">
            🏥 โรงพยาบาล: <strong>{hospitalName}</strong> | 🏬 วอร์ด:{" "}
            <strong>{wardName}</strong>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          {/* <Link href="/admin-hospitals">
            <button className="px-3 py-2 bg-gray-700 text-white rounded">
              🏥 โรงพยาบาล
            </button>
          </Link>
          <Link href="/admin-wards">
            <button className="px-3 py-2 bg-gray-700 text-white rounded">
              🏬 วอร์ด
            </button>
          </Link>
          <Link href="/nurse-manager">
            <button className="px-3 py-2 bg-gray-700 text-white rounded">
              🧑‍⚕️ พยาบาล
            </button>
          </Link>
          <Link href="/massage-planner">
            <button className="px-3 py-2 bg-green-700 text-white rounded">
              💆‍♀️ จัดคิวนวด
            </button>
          </Link>
          0
          <Link href="/admin-users">
            <button className="px-3 py-2 bg-gray-700 text-white rounded">
              👤 ผู้ใช้
            </button>
          </Link>
          <Link href="/system-settings">
            <button className="px-3 py-2 bg-gray-700 text-white rounded">
              ⚙️ ตั้งค่าระบบ
            </button>
          </Link> */}
          <Link href="/admin-dashboard">
            <button className="px-3 py-2 bg-gray-800 text-white rounded">
              🛠️ แผงควบคุมระบบ
            </button>
          </Link>
          {!currentUser ? (
            <button
              onClick={() => router.push("/login")}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              🔐 เข้าสู่ระบบ
            </button>
          ) : (
            <button
              onClick={() => {
                // ลบข้อมูลผู้ใช้
                localStorage.removeItem("logged_in_user");

                // ลบ state ปัจจุบัน
                setCurrentUser(null);
                toast.success("👋 ออกจากระบบเรียบร้อย");

                window.location.href = "/login"; // ย้อนกลับไปหน้าล็อกอิน
                // window.location.href = "/shift-planner"; // ไปหน้า shift-planner ทันที
              }}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              ออกจากระบบ
            </button>
          )}
          {/* <button
            onClick={() => {
              const defaultContext = {
                hospital_id: DEFAULT_HOSPITAL_ID,
                ward_id: DEFAULT_WARD_ID,
                hospital_name: DEFAULT_HOSPITAL_NAME,
                ward_name: DEFAULT_WARD_NAME,
              };
              localStorage.setItem(
                "shift_planner_context",
                JSON.stringify(defaultContext)
              );
              toast.success(
                "✅ รีเซ็ตการตั้งค่าเรียบร้อยแล้ว กำลังกลับไปหน้าจัดเวร..."
              );
              window.location.href = "/shift-planner"; // ไปหน้า shift-planner ทันที
            }}
            className="px-3 py-2 bg-red-500 text-white rounded"
          >
            🧹 ล้างระบบ
          </button> */}
        </div>
      </div>

      {/* ควบคุมปี / เดือน / ปุ่มคำสั่ง */}
      <div className="mb-4 flex gap-4 flex-wrap items-center">
        <label>ปี พ.ศ.:</label>
        <select
          className="border px-2 py-1"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[...Array(6)].map((_, i) => {
            const y = currentYear - 2 + i;
            return (
              <option key={y} value={y}>
                {y + 543}
              </option>
            );
          })}
        </select>

        <label>เดือน:</label>
        <select
          className="border px-2 py-1"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {dayjs().month(i).locale("th").format("MMMM")}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="ตั้งชื่อตารางเวร เช่น เวรกลางคืนเดือนนี้"
          value={shiftPlanName}
          onChange={(e) => setShiftPlanName(e.target.value)}
          className="border px-2 py-1 rounded"
          style={{ minWidth: "200px" }}
        />

        {editingPlan ? (
          <>
            <button
              onClick={saveToExistingPlan}
              className="px-4 py-2 bg-green-700 text-white rounded"
            >
              💾 บันทึกทับตารางเวรเดิม
            </button>
            <button
              onClick={() => {
                setPlanId(null);
                setEditingPlan(false);
                toast.info("🆕 กำลังบันทึกเป็นตารางเวรใหม่");
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              📄 บันทึกเป็นตารางเวรใหม่
            </button>
          </>
        ) : (
          <button
            onClick={saveToSupabase}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            💾 บันทึกตารางเวร
          </button>
        )}

        <button
          onClick={openCopyPlanDialog}
          className="px-4 py-2 bg-yellow-400 text-black rounded"
        >
          🧾 ดูตารางเวรเก่า
        </button>

        <button
          onClick={clearAssignments}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          🗑 ล้างเดือนนี้
        </button>

        <button
          onClick={printReport}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          📄 รายงานเวร
        </button>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-pink-500 text-white rounded"
        >
          🖨 ส่งออกเป็น PDF
        </button>

        <button
          onClick={() => exportToExcel()}
          className="px-4 py-2 bg-emerald-500 text-white rounded"
        >
          📊 ส่งออกเป็น Excel
        </button>
      </div>

      {/* ข้อความสถานะ */}
      {statusMessage && (
        <div className="mb-4 text-sm text-white bg-gray-800 p-2 rounded">
          {statusMessage}
        </div>
      )}

      {/* ตารางเวรพยาบาล */}
      <table className="table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1 bg-gray-200 text-black sticky left-0 z-10">
              👩‍⚕️ พยาบาล
            </th>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <th key={i} className="border px-2 py-1 bg-gray-100 text-black">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nurseList.map((nurse, rowIndex) => (
            <tr key={rowIndex}>
              <td className="border px-2 py-1 sticky left-0 bg-white text-black z-10">
                {nurseMap[nurse] || nurse}
              </td>
              {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                const day = dayIndex + 1;
                const dateKey = `${yearMonth}-${day
                  .toString()
                  .padStart(2, "0")}`;
                const assigned = assignments[dateKey]?.[nurse] || [];
                return (
                  <td key={dayIndex} className="border px-1 py-1 text-center">
                    {shifts.map((shift) => (
                      <div
                        key={shift}
                        onClick={() => toggleShift(nurse, day, shift)}
                        className={`cursor-pointer text-sm rounded px-1 mb-0.5 text-black ${
                          assigned.includes(shift)
                            ? shift === "morning"
                              ? "bg-blue-300"
                              : shift === "evening"
                              ? "bg-orange-300"
                              : "bg-purple-300"
                            : "bg-gray-100"
                        }`}
                      >
                        {shiftLabels[shift]}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default NoSSR(ShiftPlanner);
