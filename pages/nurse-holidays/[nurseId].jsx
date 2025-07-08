// 📄 pages/nurse-holidays/[nurseId].jsx

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { supabase } from "../../lib/supabaseClient";
import dayjs from "dayjs";
import "dayjs/locale/th";

dayjs.locale("th");

export default function NurseHolidaysPage() {
  const router = useRouter();
  const { nurseId } = router.query;
  const [year, setYear] = useState(dayjs().year());
  const [selectedDates, setSelectedDates] = useState({});
  const [nurse, setNurse] = useState(null);
  const [loading, setLoading] = useState(false);

  /* === กำหนดชนิดวันลา (value เก็บลง DB, label/สี แสดงบนจอ) === */
  /* =========================================================
   1) ENUM วันลา  – ใส่ค่าว่าง (null) นำหน้าไว้ก่อน
   ========================================================= */
  const LEAVE_TYPES = [
    { value: null, label: "— ไม่ลา —", color: "bg-white" },
    { value: "ลาป่วย", label: "ลาป่วย", color: "bg-red-200" },
    { value: "ลากิจ", label: "ลากิจ", color: "bg-yellow-200" },
    { value: "ลาพักร้อน", label: "ลาพักร้อน", color: "bg-green-200" },
    { value: "ลาอบรม", label: "ลาอบรม", color: "bg-blue-200" },
  ];

  const [notes, setNotes] = useState({}); // ⬅️ เก็บรายละเอียดแต่ละวันที่ key = date

  // 🔥 เอา Swal ออกจาก toggleDate
  /* === toggleDate – หมุนประเภทวันลา === */
  /* =========================================================
   2) toggleDate – หมุนสถานะ + ถ้าได้ค่าว่างให้ “ยกเลิก” (ลบ key)
   ========================================================= */
  const toggleDate = (dateStr) => {
    setSelectedDates((prev) => {
      /* หา index ของสถานะปัจจุบัน (ถ้า undefined ถือว่า index = -1) */
      const curIdx = LEAVE_TYPES.findIndex(
        (t) => t.value === (dateStr in prev ? prev[dateStr] : null)
      );
      /* สถานะถัดไปในวงรอบ */
      const nextVal = LEAVE_TYPES[(curIdx + 1) % LEAVE_TYPES.length].value;

      /* ── กรณี “ไม่ลา” → ลบ key ทิ้ง ────────────────────── */
      if (nextVal === null) {
        const { [dateStr]: _omit, ...rest } = prev; // ลบ field
        return rest;
      }

      /* ── กรณีอื่น → เซตค่าปกติ ─────────────────────────── */
      return { ...prev, [dateStr]: nextVal };
    });
  };

  const saveHolidays = async () => {
    setLoading(true);

    await supabase // ลบของเก่า
      .from("nurse_holidays")
      .delete()
      .eq("nurse_id", nurseId)
      .eq("year", year);

    const rows = Object.entries(selectedDates).map(([date, type]) => ({
      nurse_id: nurseId,
      date,
      year,
      type,
      note: notes[date] || null,
    }));

    let error = null;
    if (rows.length) {
      const res = await supabase.from("nurse_holidays").insert(rows);
      error = res.error;
    }

    setLoading(false);

    if (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } else {
      toast.success("✅ บันทึกวันหยุดแล้ว", { autoClose: 2000 });
      loadExisting(); // รีโหลดให้เห็นข้อมูลใหม่
    }
  };

  const loadExisting = async () => {
    const { data } = await supabase
      .from("nurse_holidays")
      .select("*")
      .eq("nurse_id", nurseId)
      .eq("year", year);

    const initial = {};
    const noteMap = {};
    data?.forEach((d) => {
      initial[d.date] = d.type;
      if (d.note) noteMap[d.date] = d.note;
    });
    setSelectedDates(initial);
    setNotes(noteMap); // ✅ โหลด note ด้วย
  };

  useEffect(() => {
    if (nurseId) {
      loadExisting();
      loadNurse(); // 👈 โหลดชื่อพยาบาล
    }
  }, [nurseId, year]);

  const loadNurse = async () => {
    const { data } = await supabase
      .from("nurses")
      .select("name, first_name, last_name")
      .eq("id", nurseId)
      .single();
    setNurse(data);
  };

  function getMonthGrid(daysArr) {
    if (!daysArr.length) return [];
    const first = daysArr[0];
    // dayjs().day(): 0 = อาทิตย์, 1 = จันทร์ ... 6 = เสาร์
    const prefix = (first.day() + 6) % 7; // 0=จันทร์, ..., 6=อาทิตย์
    return [...Array(prefix).fill(null), ...daysArr];
  }

  const daysInYear = [];
  const start = dayjs(`${year}-01-01`);
  for (let i = 0; i < 365 + 1; i++) {
    const d = start.add(i, "day");
    if (d.year() === year) daysInYear.push(d);
  }

  const groupedByMonth = daysInYear.reduce((acc, day) => {
    const month = day.format("MM"); // '01' - '12'
    if (!acc[month]) acc[month] = [];
    acc[month].push(day);
    return acc;
  }, {});

  const openNoteEditor = async (dateStr) => {
    const { value: note } = await Swal.fire({
      title: `📝 หมายเหตุ (${dateStr})`,
      input: "text",
      inputValue: notes[dateStr] || "",
      showCancelButton: true,
      confirmButtonText: "💾 บันทึก",
    });

    if (note !== undefined) {
      setNotes((prev) => ({ ...prev, [dateStr]: note }));
    }
  };

  const showMonthlyNotes = (days) => {
    const entries = days
      .map((d) => {
        if (!d) return null;
        const dateStr = d.format("YYYY-MM-DD");
        const note = notes[dateStr];
        return note ? `${dateStr} – ${note}` : null;
      })
      .filter(Boolean)
      .join("\n");

    Swal.fire({
      title: "📋 หมายเหตุประจำเดือน",
      html: `<pre style="text-align:left">${
        entries || "ไม่มีหมายเหตุในเดือนนี้"
      }</pre>`,
      confirmButtonText: "ปิด",
    });
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-4 flex flex-wrap items-center gap-2">
        📅 ตั้งวันหยุดของพยาบาล -
        <span className="text-blue-300">
          {nurse?.name ||
            `${nurse?.first_name || ""} ${nurse?.last_name || ""}` ||
            "..."}
        </span>
      </h1>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-6">
        {/* 🔘 ตัวเลือกปี */}
        <div className="flex items-center mb-2 sm:mb-0">
          <label className="mr-2 font-semibold">เลือกปี:</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="border p-2"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y + 543}
              </option>
            ))}
          </select>
        </div>

        {/* 🎨 Legend สีลางาน */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-200 border" /> ลาป่วย
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-200 border" /> ลากิจ
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-200 border" /> ลาพักร้อน
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-200 border" /> ลาอบรม
          </div>
        </div>
      </div>

      <div className="text-sm text-black">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, i) =>
            String(i + 1).padStart(2, "0")
          ).map((month) => {
            const daysRaw = groupedByMonth[month] || [];
            if (daysRaw.length === 0) return null;
            const days = getMonthGrid(daysRaw);

            return (
              <div key={month} className="mb-6">
                <h2 className="text-lg font-bold mb-2 text-white">
                  {dayjs(`${year}-${month}-01`).locale("th").format("MMM")}{" "}
                  {year + 543}
                </h2>
                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {/* Header ชื่อวัน */}
                  {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((wd) => (
                    <div
                      key={wd}
                      className="text-center font-semibold text-gray-600 bg-gray-50 rounded"
                    >
                      {wd}
                    </div>
                  ))}
                  {days.map((d, idx) => {
                    if (!d) return <div key={`pad-${idx}`} />;
                    const dateStr = d.format("YYYY-MM-DD");
                    const label = d.format("D");
                    const selectedType = selectedDates[dateStr];
                    const noteText = notes[dateStr];
                    const leaveInfo = LEAVE_TYPES.find(
                      (t) => t.value === selectedType
                    );
                    const weekday = d.day();
                    const isSaturday = weekday === 6;
                    const isSunday = weekday === 0;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => toggleDate(dateStr)}
                        className={`relative border w-10 h-10 sm:w-12 sm:h-12 flex items-center
          justify-center text-sm sm:text-base cursor-pointer rounded
          ${
            leaveInfo && leaveInfo.color !== "bg-white"
              ? leaveInfo.color
              : isSaturday
              ? "bg-violet-200"
              : isSunday
              ? "bg-violet-300"
              : "bg-white"
          }
        `}
                        title={leaveInfo ? leaveInfo.label : ""}
                      >
                        {label}
                        <div
                          className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center cursor-pointer text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNoteEditor(dateStr);
                          }}
                          title={
                            noteText ? `✏️ ${noteText}` : "📝 เพิ่มหมายเหตุ"
                          }
                        >
                          {noteText ? "✏️" : "📝"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {days.some((d) => d && notes[d.format("YYYY-MM-DD")]) && (
                  <button
                    className="mt-2 text-xs text-orange-700 underline"
                    onClick={() => showMonthlyNotes(days)}
                  >
                    📋 ดูหมายเหตุทั้งหมดของเดือนนี้
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={saveHolidays}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
        disabled={loading}
      >
        💾 บันทึกวันหยุด
      </button>
    </div>
  );
}
