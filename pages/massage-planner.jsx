import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import "dayjs/locale/th";
dayjs.locale("th");

export default function MassagePlannerPage() {
  const router = useRouter();
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1); // 1-based
  const [nurses, setNurses] = useState([]);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [dateRangeIndex, setDateRangeIndex] = useState(0);
  const [dateChunks, setDateChunks] = useState([]);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalId, setHospitalId] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null); // { nurseId, date, time }
  const [showModal, setShowModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(1); // 1, 1.5, 2
  const [bookings, setBookings] = useState([]);

  const isSlotWithinBooking = (nurseId, date, time) => {
    const booking = bookings.find((b) => {
      if (b.nurse_id !== nurseId || b.date !== date) return false;
      const [h, m] = b.start_time.split(":").map(Number);
      const start = dayjs(`${date}T${b.start_time}`);
      const durationMins = b.duration_hours * 60;
      const end = start.add(durationMins, "minute");

      const slotTime = dayjs(`${date}T${time}`);
      return (
        slotTime.isAfter(start.subtract(1, "minute")) && slotTime.isBefore(end)
      );
    });

    return booking;
  };

  useEffect(() => {
    if (!hospitalId) return;

    const fetchBookings = async () => {
      const startDate = dayjs(`${year}-${month}-01`).format("YYYY-MM-DD");
      const endDate = dayjs(`${year}-${month}-01`)
        .endOf("month")
        .format("YYYY-MM-DD");

      const { data, error } = await supabase
        .from("massage_bookings")
        .select("id, nurse_id, date, start_time, duration_hours")
        .gte("date", startDate)
        .lte("date", endDate);

      if (!error) setBookings(data);
    };

    fetchBookings();
  }, [hospitalId, year, month]);
 
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefs = JSON.parse(localStorage.getItem("user_context"));
    if (prefs?.hospital_id) {
      setHospitalId(prefs.hospital_id);
      setHospitalName(prefs.hospital_name || "");
    }
  }, [router]);

  useEffect(() => {
    if (!hospitalId) return;

    const getNurses = async () => {
      const { data, error } = await supabase
        .from("nurses")
        .select("id, name, first_name, last_name")
        .eq("is_active_for_massage", true)
        .eq("hospital_id", hospitalId);

      if (!error) setNurses(data);
    };

    getNurses();
  }, [hospitalId]);

  useEffect(() => {
    const days = dayjs(`${year}-${month}-01`).daysInMonth();
    const chunked = [];
    for (let i = 1; i <= days; i += 16) {
      const end = Math.min(i + 15, days);
      const range = [];
      for (let d = i; d <= end; d++) {
        range.push(dayjs(`${year}-${month}-${String(d).padStart(2, "0")}`));
      }
      chunked.push(range);
    }
    setDaysInMonth(days);
    setDateChunks(chunked);
    setDateRangeIndex(0);
  }, [year, month]);

  const timeSlots = [];
  for (let h = 8; h < 16; h++) {
    timeSlots.push(`${h.toString().padStart(2, "0")}:00`);
    timeSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  const currentRange = dateChunks[dateRangeIndex] || [];

  async function handleConfirmBooking() {
    if (!selectedSlot) return;

    const { nurseId, date, time } = selectedSlot;

    const { error } = await supabase.from("massage_bookings").insert([
      {
        nurse_id: nurseId,
        date,
        start_time: time,
        duration_hours: selectedDuration,
      },
    ]);

    if (error) {
      toast.success("⚠️ เกิดข้อผิดพลาดในการจอง: " + error.message);
    } else {
      toast.error("🎉 จองสำเร็จ!");
      setShowModal(false);
      // TODO: reload bookings
    }
  }

  return (
    <div className="p-4 min-h-screen bg-white text-black dark:bg-black dark:text-white">
      <h1 className="text-2xl font-bold mb-1">💆‍♀️ จัดคิวนวดแผนไทย</h1>
      <p className="mb-4">
        🏥 <strong>{hospitalName}</strong>
      </p>

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <label>ปี พ.ศ.:</label>
        <select
          className="border px-2 py-1"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[...Array(3)].map((_, i) => {
            const y = today.year() + i - 1;
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
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {dayjs(`${year}-${i + 1}-01`).format("MMMM")}
            </option>
          ))}
        </select>

        <label>ช่วงวันที่:</label>
        <select
          className="border px-2 py-1"
          value={dateRangeIndex}
          onChange={(e) => setDateRangeIndex(Number(e.target.value))}
        >
          {dateChunks.map((range, i) => (
            <option key={i} value={i}>
              {range[0].format("D MMM")} -{" "}
              {range[range.length - 1].format("D MMM")}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-auto">
        <table className="table-auto border w-full">
          <thead>
            <tr>
              <th className="border px-2 py-1 bg-gray-100 text-black dark:text-white">
                หมอนวด
              </th>
              {currentRange.map((d) => {
                const dow = d.day(); // 0 = Sunday, 6 = Saturday
                let textColor = "text-black dark:text-white";
                if (dow === 0)
                  textColor = "text-red-500 font-semibold"; // Sunday
                else if (dow === 6) textColor = "text-gray-500"; // Saturday
                return (
                  <th
                    key={d.format("YYYY-MM-DD")}
                    className={`border px-2 py-1 ${textColor}`}
                  >
                    {d.format("D MMM")}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {nurses.map((nurse) => (
              <tr key={nurse.id}>
                <td className="border px-2 py-1 whitespace-nowrap">
                  {nurse.name} - {nurse.first_name} {nurse.last_name}
                </td>

                {currentRange.map((d) => (
                  <td key={d.format("YYYY-MM-DD")} className="border px-1 py-1">
                    {timeSlots.map((t) => {
                      const dateStr = d.format("YYYY-MM-DD");
                      const booking = isSlotWithinBooking(nurse.id, dateStr, t);

                      if (booking) {
                        const isStart = booking.start_time === t;

                        return (
                          <div
                            key={t}
                            className={`text-xs border rounded mb-1 px-1 py-0.5 text-white ${
                              isStart ? "bg-red-500" : "bg-red-300"
                            } cursor-pointer`}
                            onClick={() => {
                              if (!isStart) return; // ยกเลิกได้เฉพาะจุดเริ่ม
                              const confirmDelete = confirm("ยกเลิกการจองนี้?");
                              if (confirmDelete) {
                                supabase
                                  .from("massage_bookings")
                                  .delete()
                                  .eq("id", booking.id)
                                  .then(() => {
                                    toast.info("🗑️ ยกเลิกสำเร็จ");
                                    // โหลดใหม่
                                    setBookings((prev) =>
                                      prev.filter((b) => b.id !== booking.id)
                                    );
                                  });
                              }
                            }}
                          >
                            {isStart
                              ? `${t} 🚫 ${booking.duration_hours} ชม.`
                              : ""}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={t}
                          className="text-xs border rounded mb-1 px-1 py-0.5 hover:bg-blue-100 cursor-pointer"
                          onClick={() => {
                            setSelectedSlot({
                              nurseId: nurse.id,
                              date: dateStr,
                              time: t,
                            });
                            setSelectedDuration(1);
                            setShowModal(true);
                          }}
                        >
                          {t}
                        </div>
                      );
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-80">
            <h2 className="text-lg font-bold mb-2">จองคิว</h2>
            <p className="mb-2">
              👩‍⚕️ หมอนวด:{" "}
              <strong>
                {(() => {
                  const nurse = nurses.find(
                    (n) => n.id === selectedSlot.nurseId
                  );
                  return nurse
                    ? `${nurse.name} - ${nurse.first_name} ${nurse.last_name}`
                    : "";
                })()}
              </strong>
              <br />
              📅 วันที่: {dayjs(selectedSlot.date).format("D MMM")}
              <br />⏰ เวลา: {selectedSlot.time}
            </p>
            <label className="block mb-2">เลือกเวลานวด:</label>
            <select
              className="w-full border px-2 py-1 mb-4"
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(Number(e.target.value))}
            >
              <option value={1}>1 ชั่วโมง</option>
              <option value={1.5}>1.5 ชั่วโมง</option>
              <option value={2}>2 ชั่วโมง</option>
            </select>

            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 bg-gray-400 text-white rounded"
                onClick={() => setShowModal(false)}
              >
                ยกเลิก
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded"
                onClick={handleConfirmBooking}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
