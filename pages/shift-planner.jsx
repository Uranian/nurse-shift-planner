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

  const [showConfirm, setShowConfirm] = useState(false);
  const handleConfirmClear = () => {
    setAssignments({});
    setStatusMessage("🗑 ล้างข้อมูลเรียบร้อยแล้ว (ยังไม่บันทึก)");
    setShowConfirm(false);
  };

  const [planId, setPlanId] = useState(null);
  const [planList, setPlanList] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [shiftPlanName, setShiftPlanName] = useState("");

  const [editingPlan, setEditingPlan] = useState(false);

  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const yearMonth = dayjs(`${year}-${month}-01`).format("YYYY-MM");

  const [nurseList, setNurseList] = useState([]);
  const [nurseMap, setNurseMap] = useState({});

  const [hospitalId, setHospitalId] = useState(null);
  const [nurseHolidays, setNurseHolidays] = useState({}); // 👈 เพิ่ม

  const [wardId, setWardId] = useState(null);
  const [hospitalName, setHospitalName] = useState("");
  const [wardName, setWardName] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const [viewingPlan, setViewingPlan] = useState(null); // ข้อมูลตารางเวรที่กำลังดู
  const [viewingAssignments, setViewingAssignments] = useState({});

  const lastWarnings = useRef(new Set());

  const [showReset, setShowReset] = useState(true);

  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState(null);
  const [allHospitals, setAllHospitals] = useState([]);
  const [allWards, setAllWards] = useState([]);
  const [userRole, setUserRole] = useState("");

  const [wardConfig, setWardConfig] = useState(null);

  const [existingPlans, setExistingPlans] = useState([]);

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
  };

  const loadPlanForEdit = async (planId, name) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .eq("plan_id", planId);

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
    setPlanId(planId);
    setShiftPlanName(name);
    setEditingPlan(true);
    setStatusMessage("🛠 กำลังแก้ไขแผนเวรเดิม");
  };

  const copyFromPlanId = async (planId) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")

      .eq("plan_id", planId);

    if (error || !data || data.length === 0) {
      toast.error("⚠️ ไม่พบข้อมูลในแผนเวรนี้");
      return;
    }

    const copied = {};
    data.forEach((row) => {
      const date = row.shift_date;
      if (!copied[date]) copied[date] = {};
      if (!copied[date][row.nurse_id]) copied[date][row.nurse_id] = [];
      copied[date][row.nurse_id].push(row.shift_type);
    });

    setAssignments(copied);
    setStatusMessage("🔁 คัดลอกจากแผนเวรสำเร็จ (ยังไม่บันทึก)");
  };

  const saveToExistingPlan = async () => {
    if (!planId || !hospitalId || !wardId) {
      toast.error("❌ ไม่มี plan_id หรือ hospital/ward");
      return;
    }

    try {
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
              plan_id: newPlanId,
              nurse_id: nurseId,
              shift_date: s.date,
              shift_type: s.shift,
              display_order: displayOrder,
              hospital_id: hospitalId,
              ward_id: wardId,
            });
          }
        } else {
          // ไม่มีเวรเลย → บันทึก placeholder (shift_date/shift_type = null)
          rows.push({
            plan_id: newPlanId,
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
    const storedUser = localStorage.getItem("logged_in_user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      console.log("🔍 logged_in_user (parsed):", user);
      console.log("👤 role:", user.role); // ← ใช้ .role แทน .user_role
      console.log("👤 user_type:", user.user_type);
      console.log("👤 username:", user.username);

      setCurrentUser(user);
      setUserRole(user.role || ""); // ← เปลี่ยนตรงนี้ด้วย
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

  // 🚀 แก้ไขชื่อแผน
  const editPlanName = async (planId, oldName) => {
    const { value: newName } = await Swal.fire({
      title: "✏️ แก้ไขชื่อตารางเวร",
      input: "text",
      inputLabel: "ชื่อใหม่ของแผน",
      inputValue: oldName,
      inputPlaceholder: "ระบุชื่อแผนใหม่",
      showCancelButton: true,
      confirmButtonText: "💾 บันทึก",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (!value || value.trim() === "") {
          return "กรุณาระบุชื่อใหม่";
        }
      },
    });

    if (!newName) return;

    const { error } = await supabase
      .from("shift_plans")
      .update({ name: newName.trim() })
      .eq("id", planId);

    if (error) {
      toast.error("❌ แก้ไขชื่อแผนไม่สำเร็จ");
    } else {
      toast.success("✏️ แก้ไขชื่อแผนเรียบร้อย");
      // อัปเดต UI โดยการแก้ชื่อแผนใน state
      setPlanList((prev) =>
        prev.map((plan) =>
          plan.id === planId ? { ...plan, name: newName.trim() } : plan
        )
      );
    }
  };

  // 🚀 คัดลอกแผน
  const copyPlan = async (planId) => {
    const { data: planData, error } = await supabase
      .from("shift_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (error || !planData) {
      toast.error("❌ คัดลอกแผนไม่สำเร็จ");
      return;
    }

    const { name, hospital_id, ward_id, year, month } = planData;

    const { data: newPlan, error: insertError } = await supabase
      .from("shift_plans")
      .insert([
        {
          name: `${name} - คัดลอก`,
          hospital_id,
          ward_id,
          year,
          month,
        },
      ])
      .select()
      .single();

    if (insertError) {
      toast.error("❌ คัดลอกแผนไม่สำเร็จ");
    } else {
      toast.success("✅ คัดลอกแผนเรียบร้อย");
      // เพิ่มแผนใหม่ใน state
      setPlanList((prev) => [newPlan, ...prev]);
    }
  };

  // 🚀 บันทึกแผนใหม่
  const saveNewPlan = async () => {
    if (!shiftPlanName) {
      toast.error("⚠️ กรุณาระบุชื่อแผน");
      return;
    }

    const { data: newPlan, error } = await supabase
      .from("shift_plans")
      .insert([
        {
          name: shiftPlanName,
          hospital_id: 1, // สมมติว่าใช้ ID ของโรงพยาบาลจาก context หรือที่เลือก
          ward_id: 1, // สมมติว่าใช้ ID ของวอร์ดจาก context หรือที่เลือก
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        },
      ])
      .select()
      .single();

    if (error) {
      toast.error("❌ บันทึกแผนใหม่ไม่สำเร็จ");
    } else {
      toast.success("✅ บันทึกแผนใหม่เรียบร้อย");
      // เพิ่มแผนใหม่ใน state
      setPlanList((prev) => [newPlan, ...prev]);
      setShiftPlanName(""); // รีเซ็ตชื่อแผนหลังบันทึก
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

      setNurseHolidays(holidayMap);
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

  function toggleShift(nurse, day, shift) {
    const dateKey = `${yearMonth}-${String(day).padStart(2, "0")}`;
    const current = assignments[dateKey]?.[nurse.id] || [];

    const newAssignments = { ...assignments };

    // ตรวจสอบ holiday
    if (nurseHolidays?.[nurse.id]?.has?.(dateKey)) {
      toast.warning(`⛔ วันที่ ${day}/${month} เป็นวันลางาน`);
      return;
    }

    // ตรวจสอบ shift ต่อเนื่องต้องห้าม (สำหรับแต่ละคน)
    if (shift === "morning") {
      const prevDateKey = `${yearMonth}-${String(day - 1).padStart(2, "0")}`;
      const prevShifts = assignments[prevDateKey]?.[nurse.id] || [];
      if (
        wardConfig?.rule_no_night_to_morning &&
        prevShifts.includes("night")
      ) {
        toast.warning(`⛔ ห้ามเวรดึกต่อเช้า (${day}/${month})`);
        return;
      }
    }

    if (
      wardConfig?.rule_no_evening_to_night &&
      ((shift === "evening" && current.includes("night")) ||
        (shift === "night" && current.includes("evening")))
    ) {
      toast.warning(`⛔ ห้ามเวรบ่ายต่อดึก (${day}/${month})`);
      return;
    }

    // ตรวจสอบจำนวนคนต่อเวร (ระดับ ward)
    const countThisShift = Object.values(assignments[dateKey] || {}).filter(
      (shifts) => shifts.includes(shift)
    ).length;

    const maxPerShift = {
      morning: wardConfig?.max_morning_shift_per_day ?? 4,
      evening: wardConfig?.max_evening_shift_per_day ?? 3,
      night: wardConfig?.max_night_shift_per_day ?? 3,
    };

    if (!current.includes(shift)) {
      if (countThisShift >= maxPerShift[shift]) {
        toast.warning(
          `⚠️ วันที่ ${day}/${month} มีเวร${shiftLabels[shift]}ครบแล้ว`
        );
        return;
      }
    }

    // toggle shift
    const updatedShifts = current.includes(shift)
      ? current.filter((s) => s !== shift)
      : [...current, shift];

    if (!newAssignments[dateKey]) newAssignments[dateKey] = {};
    newAssignments[dateKey][nurse.id] = updatedShifts;

    setAssignments(newAssignments);
  }

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

  // ✅ ส่วนการบันทึกแผนเวรใหม่ (ฟังก์ชัน saveToSupabase)
  const saveToSupabase = async (optionalPlanName) => {
    if (!hospitalId || !wardId) {
      toast.error("⚠️ ไม่มี hospital_id หรือ ward_id ในบริบทผู้ใช้");
      return;
    }

    const planNameToUse = optionalPlanName || shiftPlanName;
    if (!planNameToUse || planNameToUse.trim() === "") {
      toast.error("⚠️ กรุณาตั้งชื่อตารางเวรก่อนบันทึก");
      return;
    }

    try {
      const { data: plan, error: planError } = await supabase
        .from("shift_plans")
        .insert([
          {
            hospital_id: hospitalId,
            ward_id: wardId,
            name: planNameToUse.trim(),
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
      setPlanId(newPlanId);

      const nurseDisplayOrder = {};
      nurseList.forEach((n, i) => {
        nurseDisplayOrder[n.id] = i + 1;
      });

      const rows = [];

      for (const [date, nurses] of Object.entries(assignments)) {
        for (const [nurseId, shiftList] of Object.entries(nurses)) {
          if (Array.isArray(shiftList)) {
            for (const shift of shiftList) {
              rows.push({
                plan_id: newPlanId,
                nurse_id: nurseId,
                shift_date: date,
                shift_type: shift,
                display_order: nurseDisplayOrder[nurseId] || 0,
                hospital_id: hospitalId,
                ward_id: wardId,
              });
            }
          }
        }
      }

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

  useEffect(() => {
    const fetchHospitalsAndWards = async () => {
      const { data: hospitals } = await supabase.from("hospitals").select("*");
      const { data: wards } = await supabase.from("wards").select("*");
      setAllHospitals(hospitals || []);
      setAllWards(wards || []);
    };

    fetchHospitalsAndWards();
  }, []);

  const fetchNurseList = async () => {
    if (!hospitalId || !wardId) return;

    const { data: nurses, error: nurseError } = await supabase
      .from("nurses")
      .select("id, display_name, display_order")
      .eq("hospital_id", hospitalId)
      .eq("ward_id", wardId)
      .eq("is_active_for_shift", true)
      .order("display_order", { ascending: true });

    if (nurseError) {
      console.error("Fetch nurses error:", nurseError);
      toast.error("ไม่สามารถโหลดรายชื่อพยาบาลได้");
      return;
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = dayjs(startDate).daysInMonth();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;

    const { data: holidays, error: holidayError } = await supabase
      .from("nurse_holidays")
      .select("nurse_id, date, type")
      .gte("date", startDate)
      .lte("date", endDate);

    if (holidayError) {
      console.error("Fetch holidays error:", holidayError);
      toast.error("ไม่สามารถโหลดวันลาพยาบาลได้");
      return;
    }

    const assignmentsInit = {};
    for (const nurse of nurses) {
      const nurseId = nurse.id;
      assignmentsInit[nurseId] = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
          d
        ).padStart(2, "0")}`;
        const holiday = holidays.find(
          (h) => h.nurse_id === nurseId && h.date === dateStr
        );

        assignmentsInit[nurseId][d] = {
          morning: {
            value: false,
            disabled: !!holiday,
            reason: holiday ? holiday.type : null,
          },
          evening: {
            value: false,
            disabled: !!holiday,
            reason: holiday ? holiday.type : null,
          },
          night: {
            value: false,
            disabled: !!holiday,
            reason: holiday ? holiday.type : null,
          },
        };
      }
    }

    // fallback สำหรับ null display_order
    const sortedNurses = [...nurses].sort((a, b) => {
      const aOrder = a.display_order ?? 9999;
      const bOrder = b.display_order ?? 9999;
      return aOrder - bOrder;
    });

    setNurseList(sortedNurses);
    setAssignments(assignmentsInit);
    setStatusMessage(`📋 จัดเวรใหม่: ${sortedNurses.length} คน`);
  };

  const loadPlanById = async (planId) => {
    const { data, error } = await supabase
      .from("nurse_shifts")
      .select("*")
      .eq("plan_id", planId);

    if (error || !data) return;

    const newAssignments = {};

    data.forEach((row) => {
      // ข้ามรายการที่เป็น placeholder
      if (!row.shift_date || !row.shift_type) return;

      if (!newAssignments[row.shift_date]) {
        newAssignments[row.shift_date] = {};
      }
      if (!newAssignments[row.shift_date][row.nurse_id]) {
        newAssignments[row.shift_date][row.nurse_id] = [];
      }
      newAssignments[row.shift_date][row.nurse_id].push(row.shift_type);
    });

    setAssignments(newAssignments);
    setPlanId(planId);
  };

  return (
    <div className="overflow-auto p-4">
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
                      {nurseMap[nurse.id] || `${nurse.name}`}
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
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded">
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
          onChange={(e) => setYear(Number(e.target.value))}
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
          onChange={(e) => setMonth(Number(e.target.value))}
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
        {/* 🔽 เงื่อนไขการเลือกโรงพยาบาลและวอร์ด */}
        <>
          {/* 🔹 admin: แสดงทุกโรงพยาบาล */}
          {userRole === "admin" ? (
            <select
              className="border p-2"
              value={selectedHospitalId || ""}
              onChange={(e) => {
                setSelectedHospitalId(e.target.value);
                setSelectedWardId("");
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
            // 🔹 หัวหน้าพยาบาล: แสดงโรงพยาบาลเดียวที่ล็อกไว้
            <select className="border p-2" disabled>
              <option value={hospitalId}>{hospitalName}</option>
            </select>
          )}

          {/* 🔸 วอร์ด */}
          {userRole === "admin" ||
          currentUser?.user_type === "หัวหน้าพยาบาล" ? (
            <select
              className="border p-2"
              value={selectedWardId || ""}
              onChange={(e) => setSelectedWardId(e.target.value)}
              disabled={
                userRole === "admin" ? !selectedHospitalId : !hospitalId
              }
            >
              <option value="">เลือกวอร์ด</option>
              {(userRole === "admin"
                ? allWards.filter((w) => w.hospital_id === selectedHospitalId)
                : allWards.filter((w) => w.hospital_id === hospitalId)
              ).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            // 🔸 ไม่ใช่หัวหน้าพยาบาล: ล็อกวอร์ดเดียว
            <select className="border p-2" disabled>
              <option value={wardId}>{wardName}</option>
            </select>
          )}
        </>

        {/* 🔄 ปุ่มจัดเวรใหม่ - เฉพาะ role/admin หรือ user_type หัวหน้า ที่เลือก ward แล้ว */}
        {(["admin"].includes(userRole) ||
          ["หัวหน้าพยาบาล", "หัวหน้าวอร์ด"].includes(currentUser?.user_type)) &&
          ((userRole === "admin" && selectedWardId) ||
            (userRole !== "admin" &&
              hospitalId &&
              (selectedWardId || wardId))) && (
            <button
              onClick={() => {
                setHospitalId(
                  userRole === "admin" ? selectedHospitalId : hospitalId
                );
                setWardId(
                  userRole === "admin" ||
                    currentUser?.user_type === "หัวหน้าพยาบาล"
                    ? selectedWardId
                    : wardId
                );
                setEditingPlan(false); // 🧠 สำคัญ
                setShiftPlanName(""); // 🧠 สำคัญ
                setAssignments({}); // 🧠 สำคัญ
                setPlanId(null); // 🧠 สำคัญ
                fetchNurseList();
              }}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
            >
              🔄 จัดเวรใหม่
            </button>
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
                container.appendChild(document.createElement("br"));

                const actions = canEdit
                  ? [
                      { label: "✏️ แก้ไข", action: "edit" },
                      { label: "📄 คัดลอก", action: "copy" },
                      { label: "📝 เปลี่ยนชื่อ", action: "rename" },
                      { label: "🗑 ลบ", action: "delete" },
                    ]
                  : [
                      {
                        label: "👁 ดูตารางเวร",
                        action: "edit",
                        highlighted: true, // เพิ่ม flag เพื่อใช้ style เด่นขึ้น
                      },
                    ];

                actions.forEach(({ label, action }) => {
                  const btn = document.createElement("button");
                  btn.textContent = label;

                  // ✅ ใส่ className ตรงนี้ เพื่อปรับสไตล์แบบที่เราต้องการ
                  btn.className = `text-left px-4 py-2 border-b border-gray-200 text-gray-800 hover:text-green-600 ${
                    action.highlighted
                      ? "inline-block font-semibold text-green-600"
                      : "block w-full"
                  }`;

                  btn.style.marginRight = "4px";

                  btn.onclick = async () => {
                    if (action === "edit") {
                      await fetchNurseList(); // โหลดรายชื่อพยาบาลก่อน
                      await loadPlanById(plan.id);
                      setEditingPlan(true);
                      setShiftPlanName(plan.name);
                      Swal.close();
                    } else if (action === "copy") {
                      await fetchNurseList(); // โหลดรายชื่อพยาบาลก่อน
                      await loadPlanById(plan.id);
                      setEditingPlan(false);
                      setShiftPlanName(`${plan.name} (คัดลอก)`);
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
                        await supabase
                          .from("shift_plans")
                          .delete()
                          .eq("id", plan.id);
                        await supabase
                          .from("nurse_shifts")
                          .delete()
                          .eq("plan_id", plan.id);
                        toast.success("✅ ลบแผนเวรแล้ว");
                        setExistingPlans((prev) =>
                          prev.filter((p) => p.id !== plan.id)
                        );
                        Swal.close();
                      }
                    }
                  };
                  container.appendChild(btn);
                });

                wrapper.appendChild(container);
              });

              await Swal.fire({
                title: "📄 ตารางเวรเก่า",
                html: wrapper,
                showConfirmButton: false,
              });
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            📄 ตารางเวรเก่า
          </button>
        )}
      </div>

      {/* 📝 ปุ่มเพิ่มเติมจะแสดงเมื่อมี nurseList แล้ว */}
      {nurseList.length > 0 && (
        <div className="mb-4 flex gap-4 flex-wrap items-center">
          {canEdit && nurseList.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700"
            >
              🗑 ล้างหน้าจอ
            </button>
          )}

          {canEdit &&
            (editingPlan ? (
              <>
                <button
                  onClick={saveToExistingPlan}
                  className="px-4 py-2 bg-green-700 text-white rounded"
                >
                  💾 บันทึกทับตารางเวรเดิม
                </button>
                <button
                  onClick={async () => {
                    const { value: newName } = await Swal.fire({
                      title: "📄 ตั้งชื่อแผนเวรใหม่",
                      input: "text",
                      inputValue: shiftPlanName,
                      inputPlaceholder: "เช่น เวรเดือนกรกฎาคม",
                      showCancelButton: true,
                      confirmButtonText: "💾 บันทึก",
                      inputValidator: (value) =>
                        !value.trim() && "กรุณาระบุชื่อ",
                    });
                    if (!newName) return;

                    // ตรวจสอบชื่อซ้ำก่อน
                    const { data: existing } = await supabase
                      .from("shift_plans")
                      .select("id")
                      .eq("hospital_id", hospitalId)
                      .eq("ward_id", wardId)
                      .eq("name", newName.trim())
                      .eq("year", year)
                      .eq("month", month);

                    if (existing && existing.length > 0) {
                      Swal.fire(
                        "⚠️ ชื่อซ้ำ",
                        "มีแผนเวรชื่อนี้อยู่แล้ว",
                        "warning"
                      );
                      return;
                    }

                    setShiftPlanName(newName); // อัปเดตชื่อใหม่
                    setEditingPlan(false); // เปลี่ยนเป็นแผนใหม่
                    toast.info("📄 กำลังบันทึกเป็นตารางเวรใหม่");
                    await saveToSupabase(newName); // บันทึก
                    await fetchExistingPlans(); // โหลดใหม่
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  🆕 บันทึกเป็นตารางเวรใหม่
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  const { value: newPlanName } = await Swal.fire({
                    title: "📄 ตั้งชื่อแผนเวรใหม่",
                    input: "text",
                    inputValue: shiftPlanName,
                    inputPlaceholder: "เช่น เวรเดือนกรกฎาคม",
                    showCancelButton: true,
                    confirmButtonText: "💾 บันทึก",
                    inputValidator: (value) =>
                      !value.trim() && "กรุณาระบุชื่อแผนเวร",
                  });
                  if (!newPlanName) return;

                  // ตรวจสอบชื่อซ้ำก่อน
                  const { data: existing } = await supabase
                    .from("shift_plans")
                    .select("id")
                    .eq("hospital_id", hospitalId)
                    .eq("ward_id", wardId)
                    .eq("name", newPlanName.trim())
                    .eq("year", year)
                    .eq("month", month);

                  if (existing && existing.length > 0) {
                    Swal.fire(
                      "⚠️ ชื่อซ้ำ",
                      "มีแผนเวรชื่อนี้อยู่แล้ว",
                      "warning"
                    );
                    return;
                  }

                  setShiftPlanName(newPlanName); // ตั้งชื่อแผนเวรใหม่
                  await saveToSupabase(newPlanName); // บันทึกใหม่
                  await fetchExistingPlans(); // โหลดรายการใหม่
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                💾 บันทึกตารางเวรใหม่
              </button>
            ))}
        </div>
      )}

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
                ✅ ล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
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
                {nurse.display_name || nurseMap[nurse.id] || nurse.name}
              </td>

              {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                const day = dayIndex + 1;
                const dateKey = `${yearMonth}-${day
                  .toString()
                  .padStart(2, "0")}`;
                const assigned = assignments[dateKey]?.[nurse.id] || [];
                return (
                  <td
                    key={dayIndex}
                    className="border px-1 py-1 text-center text-black"
                  >
                    {shifts.map((shift) => {
                      const dateKey = `${yearMonth}-${day
                        .toString()
                        .padStart(2, "0")}`;
                      const assigned = assignments[dateKey]?.[nurse.id] || [];
                      const isHoliday =
                        nurseHolidays?.[nurse.id]?.has?.(dateKey);
                      const isAssigned = assigned.includes(shift);

                      const bgColor = isHoliday
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : isAssigned
                        ? shift === "morning"
                          ? "bg-blue-300"
                          : shift === "evening"
                          ? "bg-orange-300"
                          : "bg-purple-300"
                        : "bg-gray-100";

                      return (
                        <div
                          key={shift}
                          onClick={() => {
                            if (!canEdit) return; // 🔒 ห้ามคลิกถ้าไม่มีสิทธิ์
                            if (!isHoliday) toggleShift(nurse, day, shift);
                          }}
                          className={`text-sm rounded px-1 mb-0.5 ${bgColor} ${
                            canEdit && !isHoliday
                              ? "cursor-pointer"
                              : "cursor-default"
                          }`}
                          title={isHoliday ? "ลางาน" : ""}
                        >
                          {shiftLabels[shift]}
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
    </div>
  );
}

export default NoSSR(ShiftPlanner);
