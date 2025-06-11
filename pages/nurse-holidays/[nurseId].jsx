// 📄 pages/nurse-holidays/[nurseId].jsx

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
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

  const leaveTypes = ["ลาป่วย", "ลากิจ", "ลาพักร้อน"];

  const toggleDate = (dateStr) => {
    setSelectedDates((prev) => {
      const existing = prev[dateStr];
      if (existing) {
        const nextType =
          leaveTypes[(leaveTypes.indexOf(existing) + 1) % leaveTypes.length];
        return { ...prev, [dateStr]: nextType };
      } else {
        return { ...prev, [dateStr]: leaveTypes[0] };
      }
    });
  };

  const saveHolidays = async () => {
    setLoading(true);
    await supabase
      .from("nurse_holidays")
      .delete()
      .eq("nurse_id", nurseId)
      .eq("year", year);
    const inserts = Object.entries(selectedDates).map(([date, type]) => ({
      nurse_id: nurseId,
      date,
      year,
      type,
    }));
    if (inserts.length > 0) {
      await supabase.from("nurse_holidays").insert(inserts);
    }
    setLoading(false);
    toast.success("บันทึกวันหยุดแล้ว", {
      autoClose: 2000,
    });
  };

  const loadExisting = async () => {
    const { data } = await supabase
      .from("nurse_holidays")
      .select("*")
      .eq("nurse_id", nurseId)
      .eq("year", year);
    const initial = {};
    data?.forEach((d) => {
      initial[d.date] = d.type;
    });
    setSelectedDates(initial);
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
        </div>
      </div>

      <div className="text-sm text-black">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, i) =>
            String(i + 1).padStart(2, "0")
          ).map((month) => {
            const days = groupedByMonth[month] || [];
            if (days.length === 0) return null;

            return (
              <div key={month} className="mb-6">
                <h2 className="text-lg font-bold mb-2 text-white">
                  {dayjs(`${year}-${month}-01`).locale("th").format("MMM")}{" "}
                  {year + 543}
                </h2>
                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {days.map((d) => {
                    const dateStr = d.format("YYYY-MM-DD");
                    const label = d.format("D");
                    const selectedType = selectedDates[dateStr];
                    return (
                      <div
                        key={dateStr}
                        onClick={() => toggleDate(dateStr)}
                        className={`border w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-sm sm:text-base cursor-pointer rounded text-center ${
                          selectedType === "ลาป่วย"
                            ? "bg-red-200"
                            : selectedType === "ลากิจ"
                            ? "bg-yellow-200"
                            : selectedType === "ลาพักร้อน"
                            ? "bg-green-200"
                            : "bg-white"
                        }`}
                        title={selectedType || ""}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
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
