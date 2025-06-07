// 📄 src/pages/shift-planner.jsx

import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { supabase } from "../lib/supabaseClient";
import NoSSR from "../components/NoSSR";
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
  const [assignments, setAssignments] = useState({});
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [statusMessage, setStatusMessage] = useState("");

  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const yearMonth = dayjs(`${year}-${month}-01`).format("YYYY-MM");

  const [nurseList, setNurseList] = useState([]);
  const [nurseMap, setNurseMap] = useState({});

  useEffect(() => {
    const loadNurses = async () => {
      const { data, error } = await supabase
        .from("nurses")
        .select("id, name, display_order")
        .order("display_order", { ascending: true });

      if (error) {
        setStatusMessage("⚠️ โหลดรายชื่อพยาบาลไม่สำเร็จ");
      } else {
        setNurseList(data.map((n) => n.id));
        const map = {};
        data.forEach((n) => (map[n.id] = n.name));
        setNurseMap(map);
      }
    };

    loadNurses();
  }, []);

  useEffect(() => {
    const fetchFromSupabase = async () => {
      const monthStart = `${yearMonth}-01`;
      const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

      const { data, error } = await supabase
        .from("nurse_shifts")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);

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
        if (!loaded[row.date]) loaded[row.date] = {};
        if (!loaded[row.date][row.nurse_id])
          loaded[row.date][row.nurse_id] = [];
        loaded[row.date][row.nurse_id].push(row.shift);
      }

      setAssignments(loaded);
      setStatusMessage("✅ โหลดข้อมูลแล้ว");
    };

    fetchFromSupabase();
  }, [year, month]);

  const toggleShift = (nurse, day, shift) => {
    const key = `${yearMonth}-${day.toString().padStart(2, "0")}`;
    setAssignments((prev) => {
      const current = prev[key] || {};
      const nurseShifts = current[nurse] || [];
      const has = nurseShifts.includes(shift);
      const updatedShifts = has
        ? nurseShifts.filter((s) => s !== shift)
        : [...nurseShifts, shift];
      return {
        ...prev,
        [key]: {
          ...current,
          [nurse]: updatedShifts,
        },
      };
    });
  };

  const saveToSupabase = async () => {
    try {
      const rows = [];
      for (const [date, nurses] of Object.entries(assignments)) {
        for (const [nurse, shiftList] of Object.entries(nurses)) {
          for (const shift of shiftList) {
            rows.push({ nurse_id: nurse, date, shift });
          }
        }
      }

      const monthStart = `${yearMonth}-01`;
      const monthEnd = dayjs(monthStart).endOf("month").format("YYYY-MM-DD");

      await supabase
        .from("nurse_shifts")
        .delete()
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const { error } = await supabase.from("nurse_shifts").insert(rows);
      if (error) {
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
      } else {
        alert("✅ บันทึกข้อมูลสำเร็จ");
      }
    } catch (e) {
      alert("⚠️ บันทึกล้มเหลว: " + e.message);
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
      alert("ไม่พบข้อมูลในเดือนก่อนหน้า");
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

    alert(output);
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

  return (
    <div className="overflow-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        📅 แผนผังจัดเวรพยาบาล (
        {dayjs(`${year}-${month}-01`).format("MMMM YYYY")})
      </h1>

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
        <button
          onClick={() => (window.location.href = "/nurse-manager")}
          className="px-4 py-2 bg-gray-700 text-white rounded"
        >
          🧑‍⚕️ จัดการรายชื่อพยาบาล
        </button>
        <button
          onClick={saveToSupabase}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          💾 บันทึกตารางเวร
        </button>

        <button
          onClick={copyFromPreviousMonth}
          className="px-4 py-2 bg-yellow-400 text-black rounded"
        >
          🔁 คัดลอกจากเดือนก่อน
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

      {statusMessage && (
        <div className="mb-4 text-sm text-white bg-gray-800 p-2 rounded">
          {statusMessage}
        </div>
      )}

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
