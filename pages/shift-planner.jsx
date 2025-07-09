// 📄 src/pages/shift-planner.jsx

import React, { useState, useEffect, useRef } from "react"; // ✅ เพิ่ม useRef
import dayjs from "dayjs";
import { supabase } from "../lib/supabaseClient";
import NoSSR from "../components/NoSSR";
import Link from "next/link";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { useRouter } from "next/router";
import * as XLSX from "xlsx";
import {
  DEFAULT_HOSPITAL_ID,
  DEFAULT_WARD_ID,
  DEFAULT_HOSPITAL_NAME,
  DEFAULT_WARD_NAME,
} from "../config";
import "dayjs/locale/th";
dayjs.locale("th");

// 👇 Merge assignments โดยคงวันแรกๆ ตามที่กำหนด
function mergeAssignmentsPreserveDays(
  oldAssign,
  newAssign,
  preserveDays = [1, 2]
) {
  const merged = { ...newAssign };
  Object.keys(oldAssign).forEach((nurseId) => {
    if (!merged[nurseId]) merged[nurseId] = {};
    preserveDays.forEach((day) => {
      if (oldAssign[nurseId]?.[day]) {
        // Copy shift-level detail (เช้า/บ่าย/ดึก) จาก oldAssign มาทับทุก shift ในวันนั้น
        merged[nurseId][day] = { ...oldAssign[nurseId][day] };
      }
    });
  });
  return merged;
}
function markHolidaysDisabled(assignments, nurseHolidays, year, month) {
  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const yearMonth = dayjs(`${year}-${month}-01`).format("YYYY-MM");
  for (const nurseId of Object.keys(assignments)) {
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, "0")}`;
      const isHoliday =
        nurseHolidays?.[nurseId]?.has?.(dateStr) ||
        (Array.isArray(nurseHolidays?.[nurseId]) &&
          nurseHolidays[nurseId].includes(dateStr));
      if (isHoliday) {
        if (!assignments[nurseId][d]) assignments[nurseId][d] = {};
        for (const s of ["morning", "evening", "night"]) {
          assignments[nurseId][d][s] = {
            ...(assignments[nurseId][d][s] || {}),
            value: false,
            disabled: true,
            reason: "ลางาน",
          };
        }
      }
    }
  }
  return assignments;
}

const shifts = ["morning", "evening", "night"];
const shiftLabels = {
  morning: "เช้า",
  evening: "บ่าย",
  night: "ดึก",
};

const currentYear = dayjs().year();
const currentMonth = dayjs().month() + 1;

function ShiftPlanner() {
  const router = useRouter();
  const [assignments, setAssignments] = useState({});
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [statusMessage, setStatusMessage] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const handleConfirmClear = () => {
    // setAssignments({});
    setAssignments({ __placeholder__: true }); // 👈 ทำให้ length > 0
    setStatusMessage("🗑 ล้างข้อมูลเรียบร้อยแล้ว (ยังไม่บันทึก)");
    setShowConfirm(false);
    setSummaryText(""); // 🧼 ล้างสรุปเวร
    setCleared(false); // 👈 แสดงส่วนที่ถูกซ่อนไว้
    setEditingPlan(true); // 👈 ต้องให้สามารถบันทึก/จัดอัตโนมัติได้
    setRefPlan(null); // ✅ ให้ปุ่ม "บันทึกเป็นตารางเวรใหม่" ใช้งานได้
  };

  const [planId, setPlanId] = useState(null);
  const [planList, setPlanList] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [shiftPlanName, setShiftPlanName] = useState("");

  const [editingPlan, setEditingPlan] = useState(false);
  const [refPlan, setRefPlan] = useState(null); // ตารางเวรเก่า
  const [disableSave, setDisableSave] = useState(false); // ควบคุมปุ่มบันทึก

  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const yearMonth = dayjs(`${year}-${month}-01`).format("YYYY-MM");

  const [nurseList, setNurseList] = useState([]);
  const [nurseMap, setNurseMap] = useState({});

  const [hospitalId, setHospitalId] = useState(null);
  const [nurseHolidays, setNurseHolidays] = useState({});

  const [wardId, setWardId] = useState(null);
  const [hospitalName, setHospitalName] = useState("");
  const [wardName, setWardName] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const lastWarnings = useRef(new Set());
  const [userShiftWardID, setUserShiftWardID] = useState("");
  const [userHospitalID, setUserHospitalID] = useState("");
  const [showReset, setShowReset] = useState(true);
  const [selectedHospitalId, setSelectedHospitalId] = useState(
    userHospitalID || ""
  );
  const [selectedWardId, setSelectedWardId] = useState(userShiftWardID || "");

  const [allHospitals, setAllHospitals] = useState([]);
  const [allWards, setAllWards] = useState([]);
  const [userRole, setUserRole] = useState("");

  const [isHospitalLocked, setIsHospitalLocked] = useState(true);
  const [isWardLocked, setIsWardLocked] = useState(true);

  const [wardConfig, setWardConfig] = useState(null);

  const [existingPlans, setExistingPlans] = useState([]);

  const [showEditShiftModal, setShowEditShiftModal] = useState(false);

  const [summaryText, setSummaryText] = useState("");

  const [viewingPlan, setViewingPlan] = useState(null); // ข้อมูลตารางเวรที่กำลังดู
  const [viewingAssignments, setViewingAssignments] = useState({});

  // ✅ สำหรับการแก้ไขเวร
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [isOt, setIsOt] = useState(false);
  const [replacementNurseId, setReplacementNurseId] = useState("");
  const [note, setNote] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

  const [editShiftDetail, setEditShiftDetail] = useState(null);

  // เมื่อ setYear/setMonth ให้ save ลง localStorage ด้วย
  const setYearAndSave = (newYear) => {
    setYear(newYear);
    localStorage.setItem(
      "shift_plan_year_month",
      JSON.stringify({ year: newYear, month })
    );
  };
  const setMonthAndSave = (newMonth) => {
    setMonth(newMonth);
    localStorage.setItem(
      "shift_plan_year_month",
      JSON.stringify({ year, month: newMonth })
    );
  };

  const [cleared, setCleared] = useState(false);

  // 👇 ฟังก์ชันสำหรับเวรที่มี id (โหลดจาก Supabase)
  const openEditShiftFromDatabase = async (shiftId) => {
    console.log("🔍 โหลดเวรจากฐานข้อมูล:", shiftId);
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("is_ot, replacement_nurse_id, note")
      .eq("id", shiftId)
      .single();

    if (error || !data) {
      toast.error("❌ โหลดข้อมูลไม่สำเร็จ");
      return;
    }

    setEditingShiftId(shiftId);
    setIsOt(data.is_ot || false);
    setReplacementNurseId(data.replacement_nurse_id || "");
    setNote(data.note || "");
    setShowEditModal(true);
  };

  // 👇 ฟังก์ชันสำหรับเวรลอยจาก assignments (ยังไม่มี id)
  const openEditShiftFromAssignments = ({ nurseId, date, shiftType }) => {
    const shiftArray = assignments[date]?.[nurseId] || [];
    const shift = shiftArray.find((s) => s.type === shiftType);

    if (!shift) {
      toast.error("❌ ไม่พบข้อมูลเวรนี้ใน assignments");
      return;
    }

    setEditingShiftId(null); // ไม่มี id เพราะยังไม่ถูกบันทึก
    setIsOt(shift.is_ot || false);
    setReplacementNurseId(shift.replacement_nurse_id || "");
    setNote(shift.note || "");
    setEditShiftDetail({ nurseId, date, shiftType });
    setShowEditModal(true);
  };

  const canEdit =
    userRole === "admin" ||
    currentUser?.user_type === "หัวหน้าพยาบาล" ||
    currentUser?.user_type === "หัวหน้าวอร์ด";

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
    setSummaryText(""); // 🧼 ล้างสรุปเวร
  };

  const saveToExistingPlan = async () => {
    if (!planId || !hospitalId || !wardId) {
      toast.error("❌ ไม่มี plan_id หรือ hospital/ward");
      return;
    }

    try {
      const nurseDisplayOrder = nurseList.reduce((acc, nurse, index) => {
        acc[nurse.id] = index;
        return acc;
      }, {});

      const rows = [];

      for (const nurse of nurseList) {
        const nurseId = nurse.id;
        const displayOrder = nurseDisplayOrder[nurseId];

        // หาเวรทั้งหมดที่พยาบาลนี้มีใน assignments
        const shiftsForNurse = [];
        for (const [date, nurses] of Object.entries(assignments)) {
          const nurseShifts = nurses[nurseId];
          if (nurseShifts && nurseShifts.length > 0) {
            for (const shift of nurseShifts) {
              shiftsForNurse.push({ date, shift });
            }
          }
        }

        if (shiftsForNurse.length > 0) {
          // บันทึกเวรตามปกติ
          for (const s of shiftsForNurse) {
            rows.push({
              plan_id: planId, // 🔧 เปลี่ยนจาก newPlanId เป็น planId (ใช้ของเดิม)
              nurse_id: nurseId,
              shift_date: s.date,
              shift_type: s.shift,
              display_order: displayOrder,
              hospital_id: hospitalId,
              ward_id: wardId,
            });
          }
        } else {
          // ไม่มีเวรเลย → บันทึก placeholder
          rows.push({
            plan_id: planId,
            nurse_id: nurseId,
            shift_date: null,
            shift_type: null,
            display_order: displayOrder,
            hospital_id: hospitalId,
            ward_id: wardId,
          });
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

  useEffect(() => {
    // load year/month ล่าสุดจาก localStorage ถ้ามี
    const raw = localStorage.getItem("shift_plan_year_month");
    if (raw) {
      try {
        const ypm = JSON.parse(raw);
        if (ypm.year && ypm.month) {
          setYear(ypm.year);
          setMonth(ypm.month);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("logged_in_user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      console.log("🔍 logged_in_user (parsed):", user);
      console.log("👤 role:", user.role); // ← ใช้ .role แทน .user_role
      console.log("👤 user_type:", user.user_type);
      console.log("👤 username:", user.username);

      setCurrentUser(user);
      setUserRole(user.role || "");
      setUserShiftWardID(user.shift_ward_id || user.ward_id || ""); // ✅ ใช้ fallback
      setUserHospitalID(user.hospital_id || "");

      // 🔒 ตั้งค่า lock โดยตรง
      setIsHospitalLocked(user.role !== "admin");
      setIsWardLocked(
        user.role !== "admin" && user.user_type !== "หัวหน้าพยาบาล"
      );

      // 🟡 ตั้ง selected hospital/ward ทันที
      setSelectedHospitalId(user.hospital_id || "");
      setSelectedWardId(user.shift_ward_id || "");
    }
  }, []);

  useEffect(() => {
    // ถ้า selectedWardId ยังว่าง และมี ward id ที่ควรเลือก

    // 🔍 ตรวจสอบประเภทข้อมูล
    console.log("✅ typeof userShiftWardID:", typeof userShiftWardID);
    console.log(
      "✅ allWards id types:",
      allWards.map((w) => typeof w.id)
    );
    console.log("✅ allWards:", allWards);
    // ✅ wait for allWards to load before setting selected ward
    if (
      allWards.length > 0 &&
      userShiftWardID &&
      !selectedWardId &&
      allWards.some((w) => String(w.id) === String(userShiftWardID))
    ) {
      setSelectedWardId(userShiftWardID);
    }
  }, [allWards, selectedWardId, userShiftWardID]);

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

  // 🚀 โหลดแผนจาก Supabase
  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("shift_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("❌ โหลดข้อมูลแผนไม่สำเร็จ");
      } else {
        setPlanList(data);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchWardConfig = async () => {
      if (!currentUser?.ward_id) return;

      const { data, error } = await supabase
        .from("wards")
        .select("*")
        .eq("id", currentUser.ward_id)
        .single();

      if (!error && data) setWardConfig(data);
    };

    fetchWardConfig();
  }, [currentUser]);

  const fetchExistingPlans = async () => {
    const { data, error } = await supabase
      .from("shift_plans")
      .select("*")
      .eq("hospital_id", hospitalId)
      .eq("ward_id", wardId)
      .eq("year", year)
      .eq("month", month)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setExistingPlans(data);
    }
  };

  const loadExistingPlans = async () => {
    const { data, error } = await supabase
      .from("shift_plans")
      .select("*")
      .eq("hospital_id", selectedHospitalId)
      .eq("ward_id", selectedWardId)
      .eq("year", year)
      .eq("month", month)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Failed to load shift plans:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดแผนเวร");
      return;
    }

    setExistingPlans(data);
  };

  useEffect(() => {
    if (!hospitalId || !wardId) return;
    fetchExistingPlans(); // ✅ เรียกใช้ได้ตามเดิม
  }, [hospitalId, wardId, year, month]);

  // 🚀 ลบแผน
  const deletePlan = async (planId) => {
    const confirmed = await Swal.fire({
      title: "🗑 ยืนยันการลบแผนนี้?",
      text: "การลบแผนจะไม่สามารถกู้คืนได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
    });

    if (confirmed.isConfirmed) {
      const { error } = await supabase
        .from("shift_plans")
        .delete()
        .eq("id", planId);

      if (error) {
        toast.error("❌ ลบแผนไม่สำเร็จ");
      } else {
        toast.success("🗑 ลบแผนเรียบร้อย");
        // อัปเดต UI โดยการลบแผนออกจาก state
        setPlanList((prev) => prev.filter((plan) => plan.id !== planId));
      }
    }
  };

  useEffect(() => {
    const loadHospitalsAndWards = async () => {
      const { data: hospitals } = await supabase.from("hospitals").select("*");
      const { data: wards } = await supabase.from("wards").select("*");
      setAllHospitals(hospitals);
      setAllWards(wards);
    };

    if (userRole === "admin") {
      loadHospitalsAndWards();
    }
  }, [userRole]);

  useEffect(() => {
    const loadHolidays = async () => {
      if (!hospitalId || !wardId) return;

      const { data, error } = await supabase
        .from("nurse_holidays")
        .select("nurse_id, date")
        .eq("year", year);

      if (!data) return;

      const holidayMap = {};
      data.forEach((row) => {
        const d = dayjs(row.date).format("YYYY-MM-DD");
        if (!holidayMap[row.nurse_id]) holidayMap[row.nurse_id] = new Set();
        holidayMap[row.nurse_id].add(d);
      });

      console.log("📆 [DEBUG] โหลดวันลาพยาบาลจาก DB:", data);
      console.log("📆 [DEBUG] nurseHolidays (holidayMap):", holidayMap);

      // setStatusMessage(
      //   `[DEBUG] โหลดวันลาพยาบาล: ${JSON.stringify(holidayMap)}`
      // );
      setNurseHolidays(holidayMap);
      // LOG: รายชื่อพยาบาลและวันลาที่โหลดได้
      if (nurseList && nurseList.length > 0) {
        console.log("[LOG] รายชื่อพยาบาลและวันลาที่โหลดจาก DB:");
        Object.entries(holidayMap).forEach(([nurseId, daysSet]) => {
          const nurse = nurseList.find((n) => n.id === nurseId);
          const name = nurse?.display_name || nurse?.name || nurseId;
          const daysArr = Array.from(daysSet);
          console.log(`- ${name}:`, daysArr.join(", "));
        });
      } else {
        console.log(
          "[LOG] (ยังไม่มี nurseList, จะแสดงวันลาหลัง nurseList โหลด)"
        );
      }

      console.log("✅ [DEBUG] setNurseHolidays:", holidayMap);
    };

    loadHolidays();
  }, [hospitalId, wardId, year]);

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

  /* ==========================================================
   📡  โหลดเวรจาก nurse_shifts (ตาม planId) แล้ว map → assignments
   ========================================================== */
  useEffect(() => {
    if (!hospitalId || !wardId || !planId || !nurseList.length) return;

    const fetchFromSupabase = async () => {
      lastWarnings.current.clear(); // ล้างเตือนเก่า

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

      if (!data?.length) {
        /* 👉 ไม่มีเวรเก่า → เริ่มจากแถวว่างทุกคน */
        const blank = {};
        nurseList.forEach((n) => (blank[n.id] = {}));
        setAssignments(markHolidaysDisabled(blank, nurseHolidays, year, month));
        setStatusMessage("🆕 ไม่มีข้อมูลเก่าในเดือนนี้");
        return;
      }

      /* 👉 มีเวรเก่า → map เป็น assignments */
      const loaded = {};
      data.forEach((row) => {
        const nurseId = row.nurse_id;
        const dateKey = row.shift_date; // YYYY-MM-DD

        if (!loaded[nurseId]) loaded[nurseId] = {};
        if (!loaded[nurseId][dateKey]) loaded[nurseId][dateKey] = [];

        loaded[nurseId][dateKey].push(row.shift_type);
      });

      /* 👉 เติมแถวคนที่ไม่มีเวรเลย */
      nurseList.forEach((n) => {
        if (!loaded[n.id]) loaded[n.id] = {};
      });

      setAssignments(loaded);
      setStatusMessage("✅ โหลดข้อมูลแล้ว");
    };

    fetchFromSupabase();
  }, [hospitalId, wardId, planId, year, month, nurseList]); // ← เพิ่ม nurseList

  // 🧠 สุ่มอาร์เรย์แบบ Fisher–Yates
  // ---------- helper for auto-scheduling ----------
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* เคารพ allow_morning / evening / night 
  ให้วันพักตรงกับ  month_rest_days ของวอร์ด (rest  ≠ holiday จริง)
  PATTERN 10 วัน  (ช,ช,พัก,พัก,บ,บ,ด,ด,พัก,พัก)
  เช้า ➜ เช้า ➜ พัก ➜ พัก ➜ บ่าย ➜ บ่าย ➜ ดึก ➜ ดึก ➜ พัก ➜ พัก … (วนใหม่)
  ถ้าเวรนั้นถูก ปฏิเสธ (allow_*) หรือโควตาวันนั้นเต็ม จะข้ามเป็นพักอัตโนมัติ
  พอครบทุกคนแล้ว (รอบ 1) ถ้ายังขาดคนต่อเวรใดก็ใช้ “รอบ 2” เติมแบบสุ่มเหมือนเดิม 
  กระจาย offset ให้แต่ละพยาบาล → พัก (=null) จะเฉลี่ยเท่ากัน  
  ข้ามเสาร์-อาทิตย์ถ้า nurse.allow_weekend == false
  จัดคน normal ก่อน  → low_priority ต่อท้าย
  1️⃣ พยายามอุดโควตาด้วยพยาบาลปกติก่อน (คนที่ low_priority === false)
  2️⃣ ถ้ายังไม่เต็ม จึงค่อยดึงคน low_priority มาช่วยอุด*/
  /* -------------------------------------------------------------
     𝐛𝐮𝐢𝐥𝐝𝐀𝐮𝐭𝐨𝐀𝐬𝐬𝐢𝐠𝐧𝐦𝐞𝐧𝐭𝐬  (เวอร์ชัน balance rest / fill gaps)
     ------------------------------------------------------------- */
  /* ---------- helper สำหรับเวรอัตโนมัติ ---------- */
  /* ---------- helper สำหรับเวรอัตโนมัติ (v3) ---------- */
  function buildAutoAssignments() {
    /* 1) ค่าพื้นฐาน */
    const maxPerShift = {
      morning: wardConfig?.max_morning_shift_per_day ?? 4,
      evening: wardConfig?.max_evening_shift_per_day ?? 3,
      night: wardConfig?.max_night_shift_per_day ?? 3,
    };
    const minRestDays =
      Array.isArray(wardConfig?.month_rest_days) &&
      wardConfig.month_rest_days.length === 12
        ? wardConfig.month_rest_days[month - 1]
        : 8;

    const PATTERN = [
      "morning",
      "morning",
      null,
      null,
      "evening",
      "evening",
      "night",
      "night",
      null,
      null,
    ];
    const LEN = PATTERN.length;
    const SHIFTS = ["morning", "evening", "night"];

    const isWeekend = (d) =>
      [0, 6].includes(
        dayjs(
          `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(
            2,
            "0"
          )}`
        ).day()
      );

    /* 2) เตรียมตัวแปร */
    const assignments = {};
    const remain = {}; // โควตาเวรที่ลงได้อีก
    nurseList.forEach((n) => {
      assignments[n.id] = {};

      // ถ้าติ๊ก “พักยืดหยุ่น” → ไม่มีวันพักขั้นต่ำ
      const mustRest = n.rest_flexible ? 0 : minRestDays;
      remain[n.id] = Math.max(0, daysInMonth - mustRest);
    });

    nurseList.forEach((n) => {
      assignments[n.id] = {};
      // --- กำหนด quota งานต่อคน ------------------------------------
      //   • core           → ต้องเหลือวันพักขั้นต่ำ (minRestDays)
      //   • rest_flexible  → ทำงานได้เต็มทั้งเดือน (ใช้ 30 วัน)
      //   • low_priority   → quota เท่า core แต่จะถูกใช้เป็นลำดับท้าย
      const workCap = (n) =>
        n.rest_flexible ? daysInMonth : Math.max(0, daysInMonth - minRestDays);

      nurseList.forEach((n) => {
        assignments[n.id] = {};
        remain[n.id] = workCap(n); // ← ใช้ฟังก์ชัน workCap
      });
    });

    // --- แบ่งกลุ่ม ---
    const wkMorning = nurseList.filter(
      // จ-ศ เช้า
      (n) => !n.allow_weekend && !n.low_priority && n.allow_morning
    );
    const coreNurses = nurseList.filter(
      // ต้องได้วันพักขั้นต่ำ
      (n) => !n.low_priority && !n.rest_flexible && !wkMorning.includes(n)
    );
    const flexNurses = nurseList.filter(
      // พักยืดหยุ่น
      (n) => n.rest_flexible && !n.low_priority
    );
    const lowPri = nurseList.filter((n) => n.low_priority);

    // ลำดับการจับเวร
    const normal = [...coreNurses, ...flexNurses];

    // --- สุ่ม offset เพื่อเลื่อน PATTERN ให้กระจายตัว ---
    const offsets = {};
    [...coreNurses, ...flexNurses, ...lowPri].forEach(
      (n, i) => (offsets[n.id] = i % LEN)
    );

    /* 4) ลูปตามวัน */
    for (let day = 1; day <= daysInMonth; day++) {
      const used = { morning: 0, evening: 0, night: 0 };

      /* 4-A) ใส่เวรเช้า จ-ศ ให้กลุ่ม week-day morning */
      if (!isWeekend(day)) {
        for (const n of wkMorning) {
          if (used.morning >= maxPerShift.morning) break;
          if (remain[n.id] === 0) continue;

          assignments[n.id][day] = assignments[n.id][day] || {};
          assignments[n.id][day].morning = { value: true };
          used.morning += 1;
          remain[n.id] -= 1;
        }
      }

      /* 4-B) เติม PATTERN ทีละกลุ่ม */
      const fillPattern = (arr) => {
        for (const n of arr) {
          if (remain[n.id] === 0) continue;
          if (isWeekend(day) && !n.allow_weekend) continue;

          // 🚫 หยุดตรงนี้ถ้าวันนี้เป็นวันหยุดของพยาบาล n
          const ymd = `${yearMonth}-${String(day).padStart(2, "0")}`;
          const isHoliday =
            nurseHolidays?.[n.id]?.has?.(ymd) ||
            nurseHolidays?.[n.id]?.includes?.(ymd); // เผื่อเป็น Set หรือ Array
          if (isHoliday) continue;

          const want = PATTERN[(day - 1 + offsets[n.id]) % LEN];
          if (!want) continue;
          if (!n[`allow_${want}`]) continue;
          if (used[want] >= maxPerShift[want]) continue;

          assignments[n.id][day] = assignments[n.id][day] || {};
          assignments[n.id][day][want] = { value: true };
          used[want] += 1;
          remain[n.id] -= 1;
        }
      };
      fillPattern(normal);
      fillPattern(lowPri); // เผื่อ PATTERN ช่วยอุดได้เอง

      /* 4-C) PATCH-PASS – อุดช่องที่ยังขาด */
      for (const shift of SHIFTS) {
        let need = maxPerShift[shift] - used[shift];
        if (need <= 0) continue;

        /* เรียงคนที่เหลือ quota มาก → น้อย, non-lowPri ก่อน */
        const ymd = `${yearMonth}-${String(day).padStart(2, "0")}`;
        const cand = [...nurseList]
          .filter(
            (n) =>
              remain[n.id] > 0 &&
              (!isWeekend(day) || n.allow_weekend) &&
              n[`allow_${shift}`] &&
              !assignments[n.id][day]?.[shift] &&
              !(
                nurseHolidays?.[n.id]?.has?.(ymd) ||
                nurseHolidays?.[n.id]?.includes?.(ymd)
              )
          )
          .sort((a, b) => {
            /* 1) เหลือ quota มากก่อน */
            const diff = remain[b.id] - remain[a.id];
            if (diff !== 0) return diff;
            /* 2) ไม่ใช่ low_priority ก่อน */
            return a.low_priority === b.low_priority
              ? 0
              : a.low_priority
              ? 1
              : -1;
          });

        for (let i = 0; i < need && i < cand.length; i++) {
          const n = cand[i];
          assignments[n.id][day] = assignments[n.id][day] || {};
          assignments[n.id][day][shift] = { value: true };
          used[shift] += 1;
          remain[n.id] -= 1;
        }
      }
    }

    return assignments;
  }

  function assignEqualShift(skipFirstDays = 0) {
    const maxPerShift = {
      morning: wardConfig?.max_morning_shift_per_day ?? 4,
      evening: wardConfig?.max_evening_shift_per_day ?? 3,
      night: wardConfig?.max_night_shift_per_day ?? 3,
    };
    const minRestDays =
      Array.isArray(wardConfig?.month_rest_days) &&
      wardConfig.month_rest_days.length === 12
        ? wardConfig.month_rest_days[month - 1]
        : 8;

    const SHIFTS = ["morning", "evening", "night"];
    const isWeekend = (d) =>
      [0, 6].includes(
        dayjs(
          `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(
            2,
            "0"
          )}`
        ).day()
      );

    // 2. เตรียม assignment และ remain
    const assignments = {};
    const remain = {};
    nurseList.forEach((n) => {
      assignments[n.id] = {};
      // quota ต่อเดือน
      const mustRest = n.rest_flexible ? 0 : minRestDays;
      remain[n.id] = Math.max(0, daysInMonth - mustRest);
    });

    // 3. ลูปวัน
    for (let day = 1 + skipFirstDays; day <= daysInMonth; day++) {
      const used = { morning: 0, evening: 0, night: 0 };

      for (const shift of SHIFTS) {
        const max = maxPerShift[shift];
        let assignedToday = 0;

        // สุ่มลำดับ nurse
        const shuffledNurses = [...nurseList].sort(() => Math.random() - 0.5);

        for (const nurse of shuffledNurses) {
          if (assignedToday >= max) break;
          if (remain[nurse.id] === 0) continue;

          // เช็ควันหยุด/ลา
          const ymd = `${yearMonth}-${String(day).padStart(2, "0")}`;
          const isHoliday =
            nurseHolidays?.[nurse.id]?.has?.(ymd) ||
            nurseHolidays?.[nurse.id]?.includes?.(ymd);
          if (isHoliday) continue;

          // เช็ค allow เวร
          if (!nurse[`allow_${shift}`]) continue;
          if (isWeekend(day) && !nurse.allow_weekend) continue;

          // เช็คห้ามเวรต่อเนื่อง
          if (
            shift === "night" &&
            wardConfig?.rule_no_evening_to_night &&
            day > 1
          ) {
            const prev = assignments[nurse.id]?.[day - 1];
            if (prev?.evening?.value) continue;
          }
          if (
            shift === "morning" &&
            wardConfig?.rule_no_night_to_morning &&
            day > 1
          ) {
            const prev = assignments[nurse.id]?.[day - 1];
            if (prev?.night?.value) continue;
          }

          // เช็คว่ายังไม่มีเวรอื่นวันนี้
          const todayAssign = assignments[nurse.id]?.[day] || {};
          let hasShift = false;
          for (const s of SHIFTS) {
            if (todayAssign[s]?.value) hasShift = true;
          }
          if (hasShift) continue;

          // แจกเวร
          assignments[nurse.id][day] = assignments[nurse.id][day] || {};
          assignments[nurse.id][day][shift] = { value: true };
          used[shift] += 1;
          remain[nurse.id] -= 1;
          assignedToday++;
        }
      }
    }
    return assignments;
  }

  function toggleShift(nurse, day, shift) {
    // 1) ถ้าพยาบาลไม่อนุญาตเวรนี้ → เตือนแล้วออก
    if (!nurse[`allow_${shift}`]) {
      toast.warn(`⛔ พยาบาลนี้ไม่ขึ้นเวร${shiftLabels[shift]}`);
      return;
    }

    const nurseId = nurse.id;
    const dateKey = `${yearMonth}-${String(day).padStart(2, "0")}`;

    const newAssignments = { ...assignments };

    // ตรวจสอบ holiday หรือ disabled ใน assignments (กันกดเวรในวันลา)
    if (
      nurseHolidays?.[nurseId]?.has?.(dateKey) ||
      assignments[nurseId]?.[day]?.[shift]?.disabled
    ) {
      console.log(
        `[DEBUG] [toggleShift] BLOCKED: nurseId=${nurseId}, day=${day}, shift=${shift}, dateKey=${dateKey}, nurseHolidays=`,
        nurseHolidays[nurseId]
      );
      toast.warning(`⛔ วันที่ ${day}/${month} เป็นวันลางาน`);
      return;
    }

    // เตรียมข้อมูลสำหรับพยาบาลและวันนั้น
    if (!newAssignments[nurseId]) newAssignments[nurseId] = {};
    if (!newAssignments[nurseId][day]) newAssignments[nurseId][day] = {};
    const shiftData = newAssignments[nurseId][day][shift] || {
      value: false,
      is_ot: false,
      note: "",
      replacement_nurse_id: null,
    };

    // ตรวจสอบ shift ต่อเนื่องต้องห้าม
    const prevDay = String(day - 1).padStart(2, "0");
    const prevShiftData = newAssignments[nurseId]?.[day - 1]?.["night"];
    if (
      wardConfig?.rule_no_night_to_morning &&
      shift === "morning" &&
      prevShiftData?.value
    ) {
      toast.warning(`⛔ ห้ามเวรดึกต่อเช้า (${day}/${month})`);
      return;
    }

    const currentShifts =
      Object.entries(newAssignments[nurseId]?.[day] || {}).filter(
        ([_, s]) => s.value
      ) || [];

    if (
      wardConfig?.rule_no_evening_to_night &&
      ((shift === "evening" &&
        newAssignments[nurseId]?.[day]?.["night"]?.value) ||
        (shift === "night" &&
          newAssignments[nurseId]?.[day]?.["evening"]?.value))
    ) {
      toast.warning(`⛔ ห้ามเวรบ่ายต่อดึก (${day}/${month})`);
      return;
    }

    // ตรวจสอบจำนวนคนใน shift นั้น ๆ (ในวันนั้น)
    let countThisShift = 0;
    for (const otherNurseId in newAssignments) {
      const dayShifts = newAssignments[otherNurseId]?.[day];
      if (dayShifts?.[shift]?.value) countThisShift++;
    }

    const maxPerShift = {
      morning: wardConfig?.max_morning_shift_per_day ?? 4,
      evening: wardConfig?.max_evening_shift_per_day ?? 3,
      night: wardConfig?.max_night_shift_per_day ?? 3,
    };

    if (!shiftData.value && countThisShift >= maxPerShift[shift]) {
      toast.warning(
        `⚠️ วันที่ ${day}/${month} มีเวร${shiftLabels[shift]}ครบแล้ว`
      );
      return;
    }

    // toggle shift
    shiftData.value = !shiftData.value;
    newAssignments[nurseId][day][shift] = shiftData;
    setAssignments(
      markHolidaysDisabled(newAssignments, nurseHolidays, year, month)
    );
  }

  const saveToSupabase = async (optionalPlanName) => {
    console.log("💾 เริ่มบันทึกเวรใหม่...");
    console.log(
      "📋 [DEBUG] assignments ก่อนบันทึก saveToSupabase:",
      assignments
    );

    let shiftCount = 0;
    const assignmentRows = [];

    for (const [nurseId, days] of Object.entries(assignments)) {
      for (const [day, shiftData] of Object.entries(days)) {
        const shift_date = dayjs(`${year}-${month}-${day}`).format(
          "YYYY-MM-DD"
        );

        for (const shiftType of ["morning", "evening", "night"]) {
          const shiftEntry = shiftData[shiftType];
          if (!shiftEntry?.value) continue; // ถ้ายังไม่กำหนด shift นี้

          shiftCount++;

          assignmentRows.push({
            nurse_id: nurseId,
            shift_date,
            shift_type: shiftType,
            is_ot: shiftEntry.is_ot || false,
            note: shiftEntry.note || "",
            replacement_nurse_id:
              shiftEntry.replacement_nurse_id?.trim() !== ""
                ? shiftEntry.replacement_nurse_id
                : null,
            plan_id: null, // ใส่หลังจาก insert plan
            hospital_id: hospitalId,
            ward_id: wardId,
          });
        }
      }
    }

    if (shiftCount === 0) {
      toast.error("⚠️ ยังไม่มีเวรใดถูกกำหนด จึงไม่สามารถบันทึกได้");
      return;
    }

    const planNameToUse = optionalPlanName || shiftPlanName;
    if (!planNameToUse || planNameToUse.trim() === "") {
      toast.error("⚠️ กรุณาตั้งชื่อตารางเวรก่อนบันทึก");
      return;
    }

    const { data: plan, error: planError } = await supabase
      .from("shift_plans")
      .insert([
        {
          name: planNameToUse,
          hospital_id: hospitalId,
          ward_id: wardId,
          year,
          month,
        },
      ])
      .select()
      .single();

    if (planError || !plan) {
      toast.error("❌ บันทึกชื่อแผนเวรไม่สำเร็จ");
      console.error("🛑 shift_plans insert error:", planError);
      return;
    }

    // plan_id ให้ทุกแถว
    assignmentRows.forEach((row) => (row.plan_id = plan.id));

    // 🔍 ตรวจ uuid
    assignmentRows.forEach((row, i) => {
      [
        "nurse_id",
        "plan_id",
        "hospital_id",
        "ward_id",
        "replacement_nurse_id",
      ].forEach((field) => {
        const val = row[field];
        if (val && typeof val === "string" && !/^[0-9a-fA-F-]{36}$/.test(val)) {
          console.warn(`⚠️ [INVALID UUID] Row ${i} ${field} =`, val);
        }
      });
    });

    console.log("📦 assignmentRows:", assignmentRows);

    const { error: insertError } = await supabase
      .from("nurse_shifts")
      .insert(assignmentRows);

    if (insertError) {
      toast.error("❌ บันทึกเวรไม่สำเร็จ");
      console.error("🛑 nurse_shifts insert error:", insertError);
    } else {
      toast.success("✅ บันทึกเวรเรียบร้อยแล้ว");
      setPlanId(plan.id);
    }

    setEditingPlan(true);
  };

  useEffect(() => {
    const fetchHospitalsAndWards = async () => {
      const { data: hospitals } = await supabase.from("hospitals").select("*");
      const { data: wards } = await supabase.from("wards").select("*");
      setAllHospitals(hospitals || []);
      setAllWards(wards || []);
    };

    fetchHospitalsAndWards();
  }, []);
  const fetchNurseList = async (hId = hospitalId, wId = wardId) => {
    if (!hId || !wId) return;

    console.log("🔍 Fetching nurses for hospital_id:", hId, "ward_id:", wId);
    const { data: nurses, error: nurseError } = await supabase
      .from("nurses")
      .select(
        "id, display_name, display_order, allow_morning, allow_evening, allow_night, allow_weekend, low_priority, rest_flexible"
      )
      .eq("hospital_id", hId)
      .eq("ward_id", wId)
      .eq("is_active_for_shift", true)
      .order("display_order", { ascending: true });

    if (nurseError) {
      console.error("Fetch nurses error:", nurseError);
      toast.error("ไม่สามารถโหลดรายชื่อพยาบาลได้");
      return false;
    }

    console.log("✅ Loaded nurses:", nurses);

    const map = {};
    nurses.forEach((n) => {
      map[n.id] = n.display_name;
    });
    setNurseMap(map);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = dayjs(startDate).daysInMonth();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;
    console.log("[DEBUG] startDate:", startDate, "endDate:", endDate);

    // 🟠 ใช้ nurseHolidays ที่ global state แทน ไม่ query DB ซ้ำ
    const nurseHolidayMap = nurseHolidays;
    console.log(
      "[DEBUG] ใช้ nurseHolidayMap (จาก global state):",
      nurseHolidayMap
    );

    console.log("📆 [DEBUG] โหลดวันลาจาก nurse_holidays:", nurseHolidayMap);

    const assignmentsInit = {};
    for (const nurse of nurses) {
      const nurseId = nurse.id;
      assignmentsInit[nurseId] = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
          d
        ).padStart(2, "0")}`;
        // 🟡 ใช้ nurseHolidayMap แทน holidays
        const isHoliday =
          nurseHolidayMap?.[nurseId]?.has?.(dateStr) ||
          nurseHolidayMap?.[nurseId]?.includes?.(dateStr);
        assignmentsInit[nurseId][d] = {
          morning: {
            value: false,
            disabled: !!isHoliday,
            reason: isHoliday ? "ลางาน" : null,
          },
          evening: {
            value: false,
            disabled: !!isHoliday,
            reason: isHoliday ? "ลางาน" : null,
          },
          night: {
            value: false,
            disabled: !!isHoliday,
            reason: isHoliday ? "ลางาน" : null,
          },
        };
        if (isHoliday) {
          console.log(
            `[DEBUG] ลา: nurse=${nurseMap[nurseId] || nurseId}, วัน=${dateStr}`
          );
        }
      }
    }
    console.log("[DEBUG] assignmentsInit หลัง mark วันลา:", assignmentsInit);

    const sortedNurses = [...nurses].sort((a, b) => {
      const aOrder = a.display_order ?? 9999;
      const bOrder = b.display_order ?? 9999;
      return aOrder - bOrder;
    });

    setNurseList(sortedNurses);
    setAssignments(
      markHolidaysDisabled(assignmentsInit, nurseHolidays, year, month)
    );

    // [LOG] รายชื่อพยาบาล+วันลา แบบแน่นอนหลัง nurseList ถูกโหลด
    if (nurseHolidayMap && sortedNurses.length > 0) {
      console.log("[LOG] [Final] รายชื่อพยาบาลและวันลาหลัง nurseList โหลด:");
      Object.entries(nurseHolidayMap).forEach(([nurseId, daysSet]) => {
        const nurse = sortedNurses.find((n) => n.id === nurseId);
        const name = nurse?.display_name || nurse?.name || nurseId;
        const daysArr = Array.from(daysSet);
        console.log(`- ${name}: ${daysArr.join(", ")}`);
      });
    }

    console.log("✅ [DEBUG] setAssignments (holiday):", assignmentsInit);
    console.log(
      "📋 [DEBUG] assignments หลังจาก fetchNurseList:",
      assignmentsInit
    );
    setStatusMessage(
      `[DEBUG] assignmentsInit (holiday): ${JSON.stringify(assignmentsInit)}`
    );
    return true;
  };

  useEffect(() => {
    if (!nurseList.length) return; // ยังไม่มีรายชื่อ

    setAssignments((prev) => {
      // ถ้ายังไม่มี assignment เลย ให้เริ่มเป็น object ว่าง
      const cloned = { ...prev };

      nurseList.forEach((n) => {
        if (!cloned[n.id]) cloned[n.id] = {}; // แถวเปล่า
      });
      return cloned; // ✅ setAssignments ใหม่
    });
  }, [nurseList]); // ← รันทุกครั้งที่ nurseList เปลี่ยน

  const loadPlanById = async (planId) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .eq("plan_id", planId);

    if (error || !data) {
      console.error("❌ Failed to load plan:", error);
      return;
    }

    const newAssignments = {};

    /* ----------------- แปลงผล query เป็น newAssignments ----------------- */
    data.forEach((row) => {
      const nurseId = row.nurse_id;
      const shiftDate = row.shift_date; // "YYYY-MM-DD"
      const day = new Date(shiftDate).getDate(); // 1–31
      const shift = row.shift_type; // "morning" | "evening" | "night"

      if (!nurseId || !shiftDate || !shift) return;

      if (!newAssignments[nurseId]) newAssignments[nurseId] = {};
      if (!newAssignments[nurseId][day]) newAssignments[nurseId][day] = {};

      newAssignments[nurseId][day][shift] = {
        value: true,
        is_ot: row.is_ot || false,
        note: row.note || "",
        replacement_nurse_id: row.replacement_nurse_id || null,
        replacement_name: nurseMap?.[row.replacement_nurse_id] || "",
      };
    });

    /* -------- เติม nurse ที่ไม่มีเวรเลย ให้มีแถวว่างในตาราง -------- */
    if (nurseList && nurseList.length) {
      nurseList.forEach((n) => {
        if (!newAssignments[n.id]) newAssignments[n.id] = {}; // แถวเปล่า
      });
    }

    setAssignments(
      markHolidaysDisabled(newAssignments, nurseHolidays, year, month)
    );

    setPlanId(planId);
  };

  const getHospitalName = (id) => {
    const h = allHospitals.find((h) => h.id === id);
    return h ? h.name : "(ไม่พบชื่อโรงพยาบาล)";
  };

  const getWardName = (id) => {
    const w = allWards.find((w) => w.id === id);
    return w ? w.name : "(ไม่พบชื่อวอร์ด)";
  };

  const openEditShiftModal = (nurseId, dateKey, shift) => {
    const day = Number(dateKey.split("-")[2]); // แปลงเป็น day 1-31
    const current = assignments[nurseId]?.[day]?.[shift] || {};

    Swal.fire({
      title: "✏️ แก้ไขเวร",
      html: `
      <div style="text-align: left">
        <label><input type="checkbox" id="is_ot" ${
          current.is_ot ? "checked" : ""
        }/> OT</label><br/>
        <label>แทนโดย: <input type="text" id="replacement" value="${
          current.replacement_name || ""
        }" class="swal2-input"/></label>
        <label>หมายเหตุ: <textarea id="note" class="swal2-textarea">${
          current.note || ""
        }</textarea></label>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      preConfirm: () => {
        return {
          is_ot: document.getElementById("is_ot").checked,
          replacement_name: document.getElementById("replacement").value,
          note: document.getElementById("note").value,
        };
      },
    }).then((result) => {
      if (!result.isConfirmed) return;

      const newAssignments = { ...assignments };
      if (!newAssignments[nurseId]) newAssignments[nurseId] = {};
      if (!newAssignments[nurseId][day]) newAssignments[nurseId][day] = {};
      if (!newAssignments[nurseId][day][shift])
        newAssignments[nurseId][day][shift] = { value: true };

      newAssignments[nurseId][day][shift] = {
        ...newAssignments[nurseId][day][shift],
        ...result.value,
        value: true,
      };

      setAssignments(
        markHolidaysDisabled(newAssignments, nurseHolidays, year, month)
      );

      toast.success("✅ อัปเดตเวรเรียบร้อย");
    });
  };
  const exportToExcel = () => {
    // header
    const ws_data = [
      [
        "ชื่อพยาบาล",
        ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()),
      ],
    ];

    nurseList.forEach((nurse) => {
      const row = [nurse.display_name || nurse.name];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayObj = assignments[nurse.id]?.[d] || {};
        let txt = "";
        if (dayObj.morning?.value) txt += "ช";
        if (dayObj.evening?.value) txt += "บ";
        if (dayObj.night?.value) txt += "ด";
        row.push(txt || "-");
      }
      ws_data.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ตารางเวร");
    const fileName = `ตารางเวร_${yearMonth}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="overflow-auto p-4">
      {/* หัวเรื่อง + ปุ่มลิงก์ admin */}
      <div className="flex flex-wrap items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📅 จัดตารางเวรพยาบาล</h1>
        {/* 
        {hospitalId && wardId && (
          <div className="text-sm text-gray-600">
            🏥 โรงพยาบาล: <strong>{hospitalName}</strong> | 🏬 วอร์ด:{" "}
            <strong>{wardName}</strong>
          </div>
        )} */}

        <div className="flex flex-wrap gap-2 mt-2">
          <Link href="/admin-dashboard">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded">
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
            <div className="flex items-center gap-4">
              {/* 👤 ข้อความผู้ใช้ อยู่หน้าปุ่ม */}
              <span className="text-white bg-gray-700 px-3 py-1 rounded text-sm">
                ผู้ใช้: {currentUser.username}
                {currentUser.user_type ? ` (${currentUser.user_type})` : ""}
              </span>

              {/* 🔴 ปุ่มออกจากระบบ */}
              <button
                onClick={() => {
                  localStorage.removeItem("logged_in_user");
                  setCurrentUser(null);
                  toast.success("👋 ออกจากระบบเรียบร้อย");
                  window.location.href = "/login";
                }}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                ออกจากระบบ
              </button>
            </div>
          )}
          {/* <button
            onClick={() => {
              setShowReset(false);
              setTimeout(() => {
                window.location.href = "/shift-planner";
              }, 500);
            }}
          >
            🧹 ล้างระบบ
          </button> */}
        </div>
      </div>

      {/* ควบคุมปี / เดือน / ปุ่มคำสั่ง */}
      <div className="mb-4 flex gap-4 flex-wrap items-center">
        {/* 🔘 เลือกปีและเดือน */}
        <select
          className="border p-2"
          value={year}
          onChange={(e) => setYearAndSave(Number(e.target.value))}
        >
          {[...Array(5)].map((_, i) => {
            const y = new Date().getFullYear() + 543 - 2 + i;
            return (
              <option key={y} value={y - 543}>
                {y}
              </option>
            );
          })}
        </select>
        <select
          className="border p-2"
          value={month}
          onChange={(e) => setMonthAndSave(Number(e.target.value))}
        >
          {[
            "มกราคม",
            "กุมภาพันธ์",
            "มีนาคม",
            "เมษายน",
            "พฤษภาคม",
            "มิถุนายน",
            "กรกฎาคม",
            "สิงหาคม",
            "กันยายน",
            "ตุลาคม",
            "พฤศจิกายน",
            "ธันวาคม",
          ].map((name, index) => (
            <option key={index + 1} value={index + 1}>
              {name}
            </option>
          ))}
        </select>

        <>
          {userRole === "admin" ? (
            <select
              className="border p-2"
              value={selectedHospitalId}
              onChange={(e) => {
                console.log("🏥 Hospital selected:", e.target.value); // ✅ log
                setSelectedHospitalId(e.target.value);
                setSelectedWardId(""); // reset วอร์ดเมื่อเปลี่ยนโรงพยาบาล
              }}
            >
              <option value="">เลือกโรงพยาบาล</option>
              {allHospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          ) : (
            <select className="border p-2" disabled>
              <option value={userHospitalID}>{hospitalName}</option>
            </select>
          )}
          {userRole === "admin" ||
          currentUser?.user_type === "หัวหน้าพยาบาล" ? (
            <select
              className="border p-2"
              value={selectedWardId}
              onChange={(e) => {
                console.log("🏥 Ward selected:", e.target.value); // ✅ log
                setSelectedWardId(e.target.value);
              }}
              disabled={
                userRole === "admin" ? !selectedHospitalId : !userHospitalID
              }
            >
              <option value="">เลือกวอร์ด</option>
              {(userRole === "admin"
                ? allWards.filter((w) => w.hospital_id === selectedHospitalId)
                : allWards.filter((w) => w.hospital_id === userHospitalID)
              ).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <select className="border p-2" disabled>
              <option value={userShiftWardID}>{wardName}</option>
            </select>
          )}
        </>
        <button
          onClick={() => {
            setCleared(true);
            setEditingPlan(false);
            setAssignments({});
            setPlanId(null);
            setShiftPlanName("");
            // toast.info("🧹 ซ่อนตารางเวรและปุ่มทั้งหมดชั่วคราว");
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded mr-2"
        >
          🧹 เคลียร์
        </button>

        {/* ♻️ ปุ่มจัดเวรใหม่ - เฉพาะ role/admin หรือ user_type หัวหน้า ที่เลือก ward แล้ว */}
        {(["admin"].includes(userRole) ||
          ["หัวหน้าพยาบาล", "หัวหน้าวอร์ด"].includes(
            currentUser?.user_type
          )) && (
          <>
            <button
              onClick={() => {
                /* ---------- STEP 1: ตรวจความครบถ้วนก่อน ---------- */
                const isAdmin = userRole === "admin";
                const isHeadNurse = currentUser?.user_type === "หัวหน้าพยาบาล";

                // (1) admin → ต้องเลือกโรงพยาบาล
                if (isAdmin && !selectedHospitalId) {
                  toast.warn("⚠️ กรุณาเลือกโรงพยาบาลก่อนกด “จัดเวรใหม่”");
                  return;
                }

                // (2) admin / หัวหน้าพยาบาล → ต้องเลือก “วอร์ดที่อยู่ในโรงพยาบาลนั้นจริง ๆ”
                const wardBelongs =
                  selectedWardId &&
                  allWards.some(
                    (w) =>
                      String(w.id) === String(selectedWardId) &&
                      String(w.hospital_id) ===
                        String(selectedHospitalId || hospitalId)
                  );

                if ((isAdmin || isHeadNurse) && !wardBelongs) {
                  toast.warn("⚠️ กรุณาเลือกวอร์ดก่อนกด “จัดเวรใหม่”");
                  return;
                }

                /* ---------- STEP 2: ค่าที่จะใช้จริง ---------- */
                const hId = isAdmin ? selectedHospitalId : hospitalId;
                const wId = isAdmin || isHeadNurse ? selectedWardId : wardId;

                // ดักกรณีอื่น ๆ อีกชั้น (ไม่ควรเกิดแล้ว แต่กันพลาด)
                if (!hId || !wId) {
                  toast.warn("⚠️ กรุณาเลือกโรงพยาบาลและวอร์ดก่อนจัดเวรใหม่");
                  return;
                }

                /* ---------- STEP 3: เริ่มกระบวนการจัดเวร ---------- */
                setHospitalId(hId);
                setWardId(wId);

                setEditingPlan(true);
                setCleared(false);
                setShiftPlanName("");
                setSummaryText("");
                setAssignments({});
                setPlanId(null);
                setRefPlan(null);
                setStatusMessage("🆕 เริ่มจัดเวรใหม่แล้ว (ยังไม่บันทึก)");

                fetchNurseList(hId, wId); // โหลดรายชื่อพยาบาลตาม ward ที่เลือก
              }}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
            >
              ♻️ จัดเวรใหม่
            </button>
          </>
        )}

        {existingPlans.length > 0 && (
          <button
            onClick={async () => {
              const wrapper = document.createElement("div");
              wrapper.style.textAlign = "left";

              existingPlans.forEach((plan) => {
                const container = document.createElement("div");
                container.style.marginBottom = "8px";

                const title = document.createElement("b");
                title.innerText = `📌 ${plan.name}`;
                container.appendChild(title);

                const yearBE = plan.year + 543;
                const month = plan.month;
                const hospitalName = getHospitalName(plan.hospital_id);
                const wardName = getWardName(plan.ward_id);

                const meta = document.createElement("div");
                meta.innerText = `พ.ศ. ${yearBE} เดือน ${month}, รพ. ${hospitalName}, วอร์ด ${wardName}`;
                meta.style.color = "#888";
                meta.style.fontSize = "0.9em";

                container.appendChild(meta);
                container.appendChild(document.createElement("br"));

                const actions = canEdit
                  ? [
                      { label: "✏️ แก้ไขเวร", action: "edit" },
                      { label: "📝 เปลี่ยนชื่อ", action: "rename" },
                      { label: "🗑 ลบเวร", action: "delete" },
                    ]
                  : [
                      {
                        label: "👁 ดูตารางเวร",
                        action: "edit",
                        highlighted: true, // เพิ่ม flag เพื่อใช้ style เด่นขึ้น
                      },
                    ];

                const buttonRow = document.createElement("div");
                buttonRow.style.display = "flex";
                buttonRow.style.flexWrap = "wrap";
                buttonRow.style.gap = "6px";
                buttonRow.style.marginTop = "4px";

                actions.forEach(({ label, action }) => {
                  const btn = document.createElement("button");
                  btn.textContent = label;

                  btn.className = `px-3 py-1 border border-gray-300 rounded text-sm text-gray-800 hover:text-green-600 bg-white`;

                  btn.onclick = async () => {
                    console.log("📋 plan.hospital_id:", plan.hospital_id);
                    console.log("📋 plan.ward_id:", plan.ward_id);

                    const hId = plan.hospital_id;
                    const wId = plan.ward_id;
                    const y = plan.year;
                    const m = plan.month;

                    if (!hId || !wId) {
                      toast.error("❗️แผนเวรนี้ไม่มี hospital_id หรือ ward_id");
                      return;
                    }

                    const hospital = allHospitals.find((h) => h.id === hId);
                    const ward = allWards.find((w) => w.id === wId);
                    const hospitalName = hospital
                      ? hospital.name
                      : "(ไม่พบชื่อโรงพยาบาล)";
                    const wardName = ward ? ward.name : "(ไม่พบชื่อวอร์ด)";

                    const notMatch =
                      selectedHospitalId !== hId ||
                      selectedWardId !== wId ||
                      year !== y ||
                      month !== m;

                    // ตรวจสอบว่า selected บนหน้าจอตรงกับของแผนหรือไม่
                    if (notMatch) {
                      await Swal.fire({
                        icon: "warning",
                        title: "⚠️ ข้อมูลบนหน้าจอไม่ตรงกับแผน",
                        html: `
        <p>กรุณาเลือก <strong>ปี</strong>, <strong>เดือน</strong>, <strong>โรงพยาบาล</strong> และ <strong>วอร์ด</strong> ให้ตรงกับแผนเวรเดิมก่อนทำรายการ</p>
        <p><strong>แผนนี้อยู่ที่:</strong></p>
        <ul style="text-align: left;">
          <li>📅 ปี: ${y} เดือน: ${m}</li>
          <li>🏥 โรงพยาบาล: ${hospitalName}</li>
          <li>🛏️ วอร์ด: ${wardName}</li>
        </ul>
      `,
                      });
                      return;
                    }

                    // ✅ ตั้งค่าปี เดือน ก่อน
                    setYear(y);
                    setMonth(m);

                    // ✅ ตั้งค่าวอร์ด โรงพยาบาล ก่อนโหลด
                    setHospitalId(hId);
                    setWardId(wId);
                    setSelectedHospitalId(hId);
                    setSelectedWardId(wId);

                    console.log("✅ setSelectedHospitalId/wardId:", hId, wId);

                    // ✅ รอ React อัปเดต state เสร็จก่อน แล้วค่อย fetch
                    setTimeout(async () => {
                      const success = await fetchNurseList(hId, wId);
                      if (!success) return;

                      if (action === "edit") {
                        await loadPlanById(plan.id);
                        setCleared(false); // 👈 แสดงส่วนที่ถูกซ่อนไว้
                        setEditingPlan(true);
                        setShiftPlanName(plan.name);
                        setSummaryText(""); // 🧼 ล้างสรุปเวร
                        Swal.close();
                      } else if (action === "rename") {
                        const { value: newName } = await Swal.fire({
                          title: "📝 เปลี่ยนชื่อแผนเวร",
                          input: "text",
                          inputValue: plan.name,
                          showCancelButton: true,
                        });
                        if (newName) {
                          await supabase
                            .from("shift_plans")
                            .update({ name: newName })
                            .eq("id", plan.id);
                          toast.success("✅ เปลี่ยนชื่อแล้ว");
                          setExistingPlans((prev) =>
                            prev.map((p) =>
                              p.id === plan.id ? { ...p, name: newName } : p
                            )
                          );
                          Swal.close();
                        }
                      } else if (action === "delete") {
                        const confirm = await Swal.fire({
                          title: "🗑 ลบแผนเวร?",
                          text: `ต้องการลบ "${plan.name}" หรือไม่?`,
                          showCancelButton: true,
                          confirmButtonText: "ลบ",
                        });
                        if (confirm.isConfirmed) {
                          // 🔥 ลบแผนเวรออกจาก shift_plans และ nurse_shifts
                          await supabase
                            .from("shift_plans")
                            .delete()
                            .eq("id", plan.id);
                          await supabase
                            .from("nurse_shifts")
                            .delete()
                            .eq("plan_id", plan.id);

                          // ✅ รีโหลดรายการแผนเวรใหม่
                          loadExistingPlans(); // <-- ฟังก์ชันที่โหลด existingPlans

                          // 🔁 ยกเลิกการอ้างแผนที่ลบไป
                          setRefPlan(null);
                          // setRefAssignments({});

                          // 🧼 ปิดสถานะแผนที่กำลังแก้ไข
                          setEditingPlan(false);
                          // 🎉 แจ้งเตือน
                          toast.success("🗑 ลบแผนเวรแล้ว");

                          // ❌ ปิด Swal (ถ้ายังเปิดอยู่)
                          Swal.close();
                        }
                      }
                    }, 100); // ✅ หน่วง 100ms เพื่อรอให้ React อัปเดต state เสร็จก่อน
                  };

                  buttonRow.appendChild(btn);
                });

                container.appendChild(buttonRow); // เพิ่มปุ่มแนวนอนทั้งหมดลง container

                wrapper.appendChild(container);
              });

              await Swal.fire({
                title: "📄 ตารางเวรเก่า",
                html: wrapper,
                showConfirmButton: false,
              });
            }}
            className="bg-violet-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            📄 ตารางเวรเก่า
          </button>
        )}

        {currentUser &&
          planId &&
          Object.entries(assignments).some(([dateStr, nurseShifts]) => {
            const date = dayjs(dateStr);
            const yearMatch = date.year() === year;
            const monthMatch = date.month() + 1 === month;
            const hasAssignments = Object.keys(nurseShifts).length > 0;
            return yearMatch && monthMatch && hasAssignments;
          }) &&
          hospitalId === DEFAULT_HOSPITAL_ID &&
          wardId === DEFAULT_WARD_ID && ( // ✅ เพิ่มเงื่อนไขตรวจสอบ รพ./วอร์ด
            <button
              onClick={() => setShowEditShiftModal(true)}
              className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
            >
              🛠 แก้ไขเวร
            </button>
          )}
      </div>

      {/* 📝 ปุ่มเพิ่มเติมจะแสดงเมื่อมี nurseList แล้ว */}
      {!cleared && nurseList.length > 0 && (
        <div className="mb-4 flex gap-4 flex-wrap items-center">
          {canEdit && nurseList.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700"
            >
              🗑 ล้างข้อมูล
            </button>
          )}

          {(["admin"].includes(userRole) ||
            ["หัวหน้าพยาบาล", "หัวหน้าวอร์ด"].includes(
              currentUser?.user_type
            )) &&
            editingPlan && ( // ต้องกำลังแก้ไขแผนเวรอยู่
              <button
                onClick={() => {
                  if (!nurseList.length) {
                    toast.error("⚠️ ยังไม่มีรายชื่อพยาบาลในวอร์ดนี้");
                    return;
                  }

                  const newAssignments = buildAutoAssignments();
                  setAssignments(
                    markHolidaysDisabled(
                      newAssignments,
                      nurseHolidays,
                      year,
                      month
                    )
                  );

                  /* ---- ทำสรุปเพื่อแสดง/คัดลอก (REST version) ------------------ */
                  const summaryDaily = [];
                  const summaryNurse = [];

                  /* quota/วัน */
                  const maxPerShift = {
                    morning: wardConfig?.max_morning_shift_per_day ?? 4,
                    evening: wardConfig?.max_evening_shift_per_day ?? 3,
                    night: wardConfig?.max_night_shift_per_day ?? 3,
                  };

                  let missM = 0,
                    missE = 0,
                    missN = 0;

                  /* ---------- 1) สรุปรายวัน ---------- */
                  for (let day = 1; day <= daysInMonth; day++) {
                    const list = { morning: [], evening: [], night: [] };

                    nurseList.forEach((n) => {
                      const d = newAssignments[n.id]?.[day];
                      if (d?.morning?.value) list.morning.push(n.display_name);
                      if (d?.evening?.value) list.evening.push(n.display_name);
                      if (d?.night?.value) list.night.push(n.display_name);
                    });

                    const cM = list.morning.length,
                      cE = list.evening.length,
                      cN = list.night.length;
                    const needM = Math.max(0, maxPerShift.morning - cM);
                    const needE = Math.max(0, maxPerShift.evening - cE);
                    const needN = Math.max(0, maxPerShift.night - cN);

                    missM += needM;
                    missE += needE;
                    missN += needN;

                    const dateStr = `${year}-${String(month).padStart(
                      2,
                      "0"
                    )}-${String(day).padStart(2, "0")}`;
                    summaryDaily.push(
                      `📅 ${dateStr}
- เช้า  (${cM}/${maxPerShift.morning})${needM ? ` ขาด ${needM}` : ""}: ${
                        cM ? list.morning.join(", ") : "-"
                      }
- บ่าย (${cE}/${maxPerShift.evening})${needE ? ` ขาด ${needE}` : ""}: ${
                        cE ? list.evening.join(", ") : "-"
                      }
- ดึก  (${cN}/${maxPerShift.night})${needN ? ` ขาด ${needN}` : ""}: ${
                        cN ? list.night.join(", ") : "-"
                      }`
                    );
                  }

                  /* ---------- 2) สรุปรายพยาบาล ---------- */
                  nurseList.forEach((n) => {
                    let m = 0,
                      e = 0,
                      ni = 0;
                    for (let d = 1; d <= daysInMonth; d++) {
                      const a = newAssignments[n.id]?.[d] || {};
                      if (a.morning?.value) m++;
                      if (a.evening?.value) e++;
                      if (a.night?.value) ni++;
                    }
                    const rest = daysInMonth - (m + e + ni);
                    summaryNurse.push(
                      `- ${n.display_name}: เช้า ${m} | บ่าย ${e} | ดึก ${ni} | พัก ${rest}`
                    );
                  });

                  /* ---------- 3) รวม & ส่งเข้า state ---------- */
                  const missingLines = [];
                  if (missM) missingLines.push(`- เช้า  : ${missM} เวร`);
                  if (missE) missingLines.push(`- บ่าย : ${missE} เวร`);
                  if (missN) missingLines.push(`- ดึก  : ${missN} เวร`);

                  setSummaryText(
                    summaryDaily.join("\n\n") +
                      `\n\n👩‍⚕️ สรุปรายพยาบาล (${nurseList.length} คน)\n` +
                      summaryNurse.join("\n") +
                      (missingLines.length
                        ? `\n\n📊 สรุปเวรที่ยังขาด\n${missingLines.join("\n")}`
                        : "") // ← ถ้าไม่ขาดจะไม่แสดงบล็อกนี้
                  );
                  setStatusMessage("✅ จัดเวรอัตโนมัติและสร้างสรุปแล้ว");
                  /* --------------------------------------------------------------- */
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 ml-2"
              >
                🤖🎲 1. จัดเวรอัตโนมัติ 🪄🧠
                <span className="block text-xs mt-1 text-indigo-200 font-normal">
                  (ช,ช,พัก,พัก,บ,บ,ด,ด,พัก,พัก)
                </span>
              </button>
            )}

          {(["admin"].includes(userRole) ||
            ["หัวหน้าพยาบาล", "หัวหน้าวอร์ด"].includes(
              currentUser?.user_type
            )) &&
            editingPlan && (
              <button
                onClick={() => {
                  if (!nurseList.length) {
                    toast.error("⚠️ ยังไม่มีรายชื่อพยาบาลในวอร์ดนี้");
                    return;
                  }

                  // ปุ่ม 2: เว้น 2 วันแรก
                  const newAssignments = assignEqualShift(2);
                  setAssignments(
                    markHolidaysDisabled(
                      mergeAssignmentsPreserveDays(
                        assignments,
                        newAssignments,
                        [1, 2]
                      ),
                      nurseHolidays,
                      year,
                      month
                    )
                  );

                  // ---- สรุปเวรเหมือนปุ่ม 1 ----
                  const summaryDaily = [];
                  const summaryNurse = [];
                  let missM = 0,
                    missE = 0,
                    missN = 0;

                  const maxPerShift = {
                    morning: wardConfig?.max_morning_shift_per_day ?? 4,
                    evening: wardConfig?.max_evening_shift_per_day ?? 3,
                    night: wardConfig?.max_night_shift_per_day ?? 3,
                  };

                  for (let day = 1; day <= daysInMonth; day++) {
                    const list = { morning: [], evening: [], night: [] };

                    nurseList.forEach((n) => {
                      const d = newAssignments[n.id]?.[day];
                      if (d?.morning?.value) list.morning.push(n.display_name);
                      if (d?.evening?.value) list.evening.push(n.display_name);
                      if (d?.night?.value) list.night.push(n.display_name);
                    });

                    const cM = list.morning.length,
                      cE = list.evening.length,
                      cN = list.night.length;
                    const needM = Math.max(0, maxPerShift.morning - cM);
                    const needE = Math.max(0, maxPerShift.evening - cE);
                    const needN = Math.max(0, maxPerShift.night - cN);

                    missM += needM;
                    missE += needE;
                    missN += needN;

                    const dateStr = `${year}-${String(month).padStart(
                      2,
                      "0"
                    )}-${String(day).padStart(2, "0")}`;
                    summaryDaily.push(
                      `📅 ${dateStr}
- เช้า  (${cM}/${maxPerShift.morning})${needM ? ` ขาด ${needM}` : ""}: ${
                        cM ? list.morning.join(", ") : "-"
                      }
- บ่าย (${cE}/${maxPerShift.evening})${needE ? ` ขาด ${needE}` : ""}: ${
                        cE ? list.evening.join(", ") : "-"
                      }
- ดึก  (${cN}/${maxPerShift.night})${needN ? ` ขาด ${needN}` : ""}: ${
                        cN ? list.night.join(", ") : "-"
                      }`
                    );
                  }

                  nurseList.forEach((n) => {
                    let m = 0,
                      e = 0,
                      ni = 0;
                    for (let d = 1; d <= daysInMonth; d++) {
                      const a = newAssignments[n.id]?.[d] || {};
                      if (a.morning?.value) m++;
                      if (a.evening?.value) e++;
                      if (a.night?.value) ni++;
                    }
                    const rest = daysInMonth - (m + e + ni);
                    summaryNurse.push(
                      `- ${n.display_name}: เช้า ${m} | บ่าย ${e} | ดึก ${ni} | พัก ${rest}`
                    );
                  });

                  const missingLines = [];
                  if (missM) missingLines.push(`- เช้า  : ${missM} เวร`);
                  if (missE) missingLines.push(`- บ่าย : ${missE} เวร`);
                  if (missN) missingLines.push(`- ดึก  : ${missN} เวร`);

                  setSummaryText(
                    summaryDaily.join("\n\n") +
                      `\n\n👩‍⚕️ สรุปรายพยาบาล (${nurseList.length} คน)\n` +
                      summaryNurse.join("\n") +
                      (missingLines.length
                        ? `\n\n📊 สรุปเวรที่ยังขาด\n${missingLines.join("\n")}`
                        : "")
                  );
                  setStatusMessage(
                    `✅ จัดเวรอัตโนมัติ (สุ่มวน quota เว้น 2 วันแรก) และสร้างสรุปแล้ว`
                  );
                }}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-700 ml-2"
              >
                🤖🧮 2. จัดเวรอัตโนมัติ (วนเท่าเทียม)
                <span className="block text-xs mt-1 text-yellow-200 font-normal">
                  เว้น 2 วันแรก
                </span>
              </button>
            )}

          {(["admin"].includes(userRole) ||
            ["หัวหน้าพยาบาล", "หัวหน้าวอร์ด"].includes(
              currentUser?.user_type
            )) &&
            editingPlan && (
              <button
                onClick={() => {
                  if (!nurseList.length) {
                    toast.error("⚠️ ยังไม่มีรายชื่อพยาบาลในวอร์ดนี้");
                    return;
                  }

                  // ปุ่ม 3: แจกทุกวัน
                  const newAssignments = assignEqualShift(0);

                  setAssignments(
                    markHolidaysDisabled(
                      newAssignments,
                      nurseHolidays,
                      year,
                      month
                    )
                  );

                  // ---- สรุปเวรเหมือนปุ่ม 1 ----
                  const summaryDaily = [];
                  const summaryNurse = [];
                  let missM = 0,
                    missE = 0,
                    missN = 0;

                  const maxPerShift = {
                    morning: wardConfig?.max_morning_shift_per_day ?? 4,
                    evening: wardConfig?.max_evening_shift_per_day ?? 3,
                    night: wardConfig?.max_night_shift_per_day ?? 3,
                  };

                  for (let day = 1; day <= daysInMonth; day++) {
                    const list = { morning: [], evening: [], night: [] };

                    nurseList.forEach((n) => {
                      const d = newAssignments[n.id]?.[day];
                      if (d?.morning?.value) list.morning.push(n.display_name);
                      if (d?.evening?.value) list.evening.push(n.display_name);
                      if (d?.night?.value) list.night.push(n.display_name);
                    });

                    const cM = list.morning.length,
                      cE = list.evening.length,
                      cN = list.night.length;
                    const needM = Math.max(0, maxPerShift.morning - cM);
                    const needE = Math.max(0, maxPerShift.evening - cE);
                    const needN = Math.max(0, maxPerShift.night - cN);

                    missM += needM;
                    missE += needE;
                    missN += needN;

                    const dateStr = `${year}-${String(month).padStart(
                      2,
                      "0"
                    )}-${String(day).padStart(2, "0")}`;
                    summaryDaily.push(
                      `📅 ${dateStr}
- เช้า  (${cM}/${maxPerShift.morning})${needM ? ` ขาด ${needM}` : ""}: ${
                        cM ? list.morning.join(", ") : "-"
                      }
- บ่าย (${cE}/${maxPerShift.evening})${needE ? ` ขาด ${needE}` : ""}: ${
                        cE ? list.evening.join(", ") : "-"
                      }
- ดึก  (${cN}/${maxPerShift.night})${needN ? ` ขาด ${needN}` : ""}: ${
                        cN ? list.night.join(", ") : "-"
                      }`
                    );
                  }

                  nurseList.forEach((n) => {
                    let m = 0,
                      e = 0,
                      ni = 0;
                    for (let d = 1; d <= daysInMonth; d++) {
                      const a = newAssignments[n.id]?.[d] || {};
                      if (a.morning?.value) m++;
                      if (a.evening?.value) e++;
                      if (a.night?.value) ni++;
                    }
                    const rest = daysInMonth - (m + e + ni);
                    summaryNurse.push(
                      `- ${n.display_name}: เช้า ${m} | บ่าย ${e} | ดึก ${ni} | พัก ${rest}`
                    );
                  });

                  const missingLines = [];
                  if (missM) missingLines.push(`- เช้า  : ${missM} เวร`);
                  if (missE) missingLines.push(`- บ่าย : ${missE} เวร`);
                  if (missN) missingLines.push(`- ดึก  : ${missN} เวร`);

                  setSummaryText(
                    summaryDaily.join("\n\n") +
                      `\n\n👩‍⚕️ สรุปรายพยาบาล (${nurseList.length} คน)\n` +
                      summaryNurse.join("\n") +
                      (missingLines.length
                        ? `\n\n📊 สรุปเวรที่ยังขาด\n${missingLines.join("\n")}`
                        : "")
                  );
                  setStatusMessage(
                    `✅ จัดเวรอัตโนมัติ (สุ่มวน quota แจกทุกวัน) และสร้างสรุปแล้ว`
                  );
                }}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-700 ml-2"
              >
                🤖🧮 3. จัดเวรอัตโนมัติ (วนเท่าเทียม)
                <span className="block text-xs mt-1 text-yellow-200 font-normal">
                  จัดทุกวัน
                </span>
              </button>
            )}
          {canEdit && editingPlan && Object.keys(assignments).length > 0 && (
            <>
              {/* ✅ แสดงเฉพาะตอนมี planId (แปลว่าแก้แผนเดิมอยู่) */}
              {planId && (
                <button
                  onClick={saveToExistingPlan}
                  className="px-4 py-2 bg-green-700 text-white rounded"
                >
                  💾 บันทึกทับตารางเวรเดิม
                </button>
              )}

              {/* ✅ ปุ่มนี้ใช้สำหรับจัดเวรใหม่หรือคัดลอก แล้วต้องตั้งชื่อใหม่ */}
              <button
                onClick={async () => {
                  const { value: newName } = await Swal.fire({
                    title: "📄 ตั้งชื่อแผนเวรใหม่",
                    input: "text",
                    inputValue: shiftPlanName,
                    inputPlaceholder: "เช่น เวรเดือนกรกฎาคม",
                    showCancelButton: true,
                    confirmButtonText: "💾 บันทึก",
                    inputValidator: (value) => !value.trim() && "กรุณาระบุชื่อ",
                  });

                  if (!newName) return;

                  const trimmedName = newName.trim();

                  // ตรวจสอบชื่อซ้ำ
                  const { data: existing, error: checkError } = await supabase
                    .from("shift_plans")
                    .select("id")
                    .eq("hospital_id", hospitalId)
                    .eq("ward_id", wardId)
                    .eq("name", trimmedName)
                    .eq("year", year)
                    .eq("month", month);

                  if (checkError) {
                    toast.error("❌ เกิดข้อผิดพลาดระหว่างตรวจสอบชื่อ");
                    return;
                  }

                  if (existing && existing.length > 0) {
                    Swal.fire(
                      "⚠️ ชื่อซ้ำ",
                      "มีแผนเวรชื่อนี้อยู่แล้ว",
                      "warning"
                    );
                    return;
                  }

                  try {
                    setShiftPlanName(trimmedName);
                    setEditingPlan(false);

                    // 🔽 บันทึกเวรจริงทั้งหมด
                    const result = await saveToSupabase(trimmedName); // 👈 ส่งชื่อใหม่ไปให้ saveToSupabase

                    if (result?.error) {
                      if (
                        result.error.message.includes("duplicate key") ||
                        result.error.message.includes("unique_nurse_shift")
                      ) {
                        toast.error("❌ ข้อมูลซ้ำ: กรุณาตรวจสอบเวรที่ซ้ำกัน");
                      } else {
                        toast.error(
                          "❌ บันทึกผิดพลาด: " + result.error.message
                        );
                      }
                    } else {
                      // toast.success("✅ บันทึกตารางเวรใหม่เรียบร้อยแล้ว");
                      await fetchExistingPlans(); // โหลดตารางเก่าทั้งหมดใหม่
                      setRefPlan(null); // เคลียร์ refPlan เพราะเป็นแผนใหม่
                      setEditingPlan(false);
                    }
                  } catch (e) {
                    toast.error("❌ เกิดข้อผิดพลาด: " + e.message);
                  }
                }}
                className={`px-4 py-2 rounded ${
                  !editingPlan || Object.keys(assignments).length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white"
                }`}
              >
                🆕 บันทึกเป็นตารางเวรใหม่
              </button>
              <button
                onClick={exportToExcel}
                className="bg-green-600 text-white px-4 py-1 rounded ml-2"
              >
                📥 Export Excel
              </button>
            </>
          )}
        </div>
      )}

      {/* ตารางเวรพยาบาล */}
      {!cleared && (
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
                  {nurse.display_name || nurseMap[nurse.id] || nurse.name}
                </td>

                {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                  const day = dayIndex + 1;
                  const dateKey = `${yearMonth}-${day
                    .toString()
                    .padStart(2, "0")}`;
                  const weekday = dayjs(dateKey).day();
                  const isSaturday = weekday === 6;
                  const isSunday = weekday === 0;
                  const isPersonalHoliday =
                    (nurseHolidays?.[nurse.id] &&
                      (nurseHolidays[nurse.id] instanceof Set
                        ? nurseHolidays[nurse.id].has(dateKey)
                        : Array.isArray(nurseHolidays[nurse.id])
                        ? nurseHolidays[nurse.id].includes(dateKey)
                        : false)) ||
                    false;

                  if (isPersonalHoliday) {
                    console.log(
                      `[LOG] [Render] Cell ปิดเวร: ${
                        nurse.display_name || nurse.name || nurse.id
                      } | วันลา: ${dateKey}`
                    );
                  }

                  if (isPersonalHoliday) {
                    const nurseName =
                      nurse.display_name || nurse.name || nurse.id;
                    console.log(
                      `[LOG] [Render] ปิด cell: ${nurseName} | วันลา: ${dateKey}`
                    );
                  }

                  const isWeekend = isSaturday || isSunday;
                  const isBlockedByWeekendRule =
                    isWeekend && nurse.allow_weekend === false;

                  return (
                    <td
                      key={dayIndex}
                      className={`border px-1 py-1 text-center text-sm min-w-[36px] ${
                        isPersonalHoliday
                          ? "bg-red-100 text-gray-400 cursor-not-allowed"
                          : isSaturday
                          ? "bg-violet-200"
                          : isSunday
                          ? "bg-violet-300"
                          : ""
                      }`}
                    >
                      {shifts.map((shift) => {
                        const dayObj = assignments[nurse.id]?.[day] || {};
                        const isAssigned = dayObj?.[shift]?.value === true;
                        const isShiftNotAllowed =
                          nurse[`allow_${shift}`] === false;
                        // **Fix: วันลา = disabled ทุก shift**
                        const isHolidayShift =
                          isPersonalHoliday || dayObj?.[shift]?.disabled;
                        const isBlockedShift =
                          isHolidayShift ||
                          isBlockedByWeekendRule ||
                          isShiftNotAllowed;

                        const bgColor = isBlockedShift
                          ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                          : isAssigned
                          ? shift === "morning"
                            ? "bg-blue-300"
                            : shift === "evening"
                            ? "bg-orange-300"
                            : "bg-purple-300"
                          : "bg-gray-100";

                        let tooltip = "";
                        if (isHolidayShift)
                          tooltip = dayObj?.[shift]?.reason || "ลางาน";
                        else if (isBlockedByWeekendRule)
                          tooltip = "ห้ามขึ้นเวรวันหยุด";
                        else if (isShiftNotAllowed)
                          tooltip = "พยาบาลนี้ไม่ได้รับอนุญาตขึ้นเวรนี้";

                        return (
                          <div
                            key={shift}
                            onClick={() => {
                              // 🚫 ถ้าวันลา หรือ disabled = ห้ามคลิกเด็ดขาด
                              if (isHolidayShift) {
                                console.log(
                                  `[LOG] [CLICK BLOCKED] คลิก cell วันลา: ${
                                    nurse.display_name || nurse.name || nurse.id
                                  }, ${dateKey}, shift=${shift}`
                                );
                                toast.warn(
                                  `⛔ วันที่นี้ (${day}/${month}) พยาบาลลางาน`
                                );
                                return;
                              }
                              if (!canEdit) return;
                              if (isBlockedShift) return;
                              toggleShift(nurse, day, shift);
                            }}
                            className={`text-sm rounded px-1 mb-0.5 ${bgColor} ${
                              canEdit && !isBlockedShift && !isHolidayShift
                                ? "cursor-pointer"
                                : "cursor-not-allowed"
                            }`}
                            title={tooltip}
                          >
                            {isAssigned ? (
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-black">
                                  {shiftLabels[shift]}
                                </span>
                                <button
                                  className="text-xs text-gray-600 hover:text-blue-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditShiftModal(
                                      nurse.id,
                                      dateKey,
                                      shift
                                    );
                                  }}
                                  title="แก้ไขเวร"
                                >
                                  ✏️
                                </button>
                              </div>
                            ) : (
                              <span className="text-black">
                                {shiftLabels[shift]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {summaryText && (
        <div className="mt-6 bg-gray-100 p-4 rounded border text-sm text-black max-w-[500px] mx-auto">
          <details>
            <summary className="cursor-pointer font-semibold">
              📋 แสดง/ซ่อนสรุปเวรรายวัน
            </summary>
            <div className="mt-2">
              <pre className="whitespace-pre-wrap">{summaryText}</pre>
              <button
                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                onClick={() => {
                  navigator.clipboard.writeText(summaryText);
                  toast.success("📋 คัดลอกข้อความสรุปแล้ว");
                }}
              >
                📎 คัดลอกข้อความ
              </button>
            </div>
          </details>
        </div>
      )}

      <br />
      {/* ✅ Modal ยืนยัน */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4 text-red-600">
              ยืนยันการล้างข้อมูล
            </h2>
            <p className="mb-6 text-sm text-black">
              คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลของเดือนนี้? <br />
              (การเปลี่ยนแปลงจะยังไม่ถูกบันทึกจนกดปุ่มบันทึก)
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded"
              >
                🗑 ล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ข้อความสถานะ */}

      {!cleared && statusMessage && (
        <div className="mb-4 text-sm text-white bg-gray-800 p-2 rounded">
          {statusMessage}
        </div>
      )}

      {showEditShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white max-w-3xl w-full p-6 rounded shadow-lg overflow-y-auto max-h-[80vh]">
            <h2 className="text-xl font-bold text-black mb-4">
              📝 แก้ไขรายละเอียดเวร
            </h2>
            <table className="w-full table-auto border-collapse mb-4 text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border text-black px-2 py-1">👩‍⚕️ พยาบาล</th>
                  <th className="border text-black px-2 py-1">📅 วันที่</th>
                  <th className="border text-black px-2 py-1">⏰ เวร</th>
                  <th className="border text-black px-2 py-1">🛠 ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(assignments).flatMap(([shift_date, nurses]) =>
                  Object.entries(nurses).flatMap(([nurse_id, shiftArray]) =>
                    Array.isArray(shiftArray)
                      ? shiftArray.map((shiftInfo, idx) => {
                          const shift_id = shiftInfo.id;
                          const shift_type = shiftInfo.type;

                          return (
                            <tr
                              key={
                                shift_id || `${nurse_id}-${shift_type}-${idx}`
                              }
                            >
                              <td className="border text-black px-2 py-1">
                                {nurseMap[nurse_id] || "ไม่ทราบชื่อ"}
                              </td>
                              <td className="border text-black px-2 py-1">
                                {shift_date}
                              </td>
                              <td className="border text-black px-2 py-1">
                                {shiftLabels[shift_type] || shift_type}
                              </td>
                              <td className="border text-black px-2 py-1 text-center">
                                <button
                                  onClick={() => {
                                    if (shift_id) {
                                      openEditShiftFromDatabase(shift_id);
                                    } else {
                                      openEditShiftFromAssignments({
                                        date: shift_date,
                                        nurseId: nurse_id,
                                        shiftType: shift_type,
                                      });
                                    }
                                  }}
                                  className="text-blue-600 hover:underline"
                                >
                                  แก้ไข
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      : []
                  )
                )}
              </tbody>
            </table>

            <div className="text-right">
              <button
                onClick={() => setShowEditShiftModal(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                ❌ ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NoSSR(ShiftPlanner);
