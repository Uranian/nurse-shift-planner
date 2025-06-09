// 📄 src/pages/appointment-booking.jsx

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";

const hours = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

export default function AppointmentBooking() {
  const [consultants, setConsultants] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, username, nickname")
      .eq("user_type", "ที่ปรึกษา");

    const { data: slots } = await supabase
      .from("availability")
      .select("consultant_id, start_time, end_time, price")
      .eq("date", selectedDate);

    setConsultants(users);
    setAvailabilities(slots);
  };

  const isSlotAvailable = (consultantId, time) => {
    const t = dayjs(`${selectedDate} ${time}`);
    return availabilities.some((slot) => {
      const start = dayjs(`${selectedDate} ${slot.start_time}`);
      const end = dayjs(`${selectedDate} ${slot.end_time}`);
      return (
        slot.consultant_id === consultantId &&
        t.isSameOrAfter(start) &&
        t.isBefore(end)
      );
    });
  };

  const handleBook = (consultant, time) => {
    toast.success(
      `📅 คุณเลือกจอง ${consultant.nickname || consultant.username} เวลา ${time}`
    );
    // TODO: แสดง Modal ยืนยันการจอง + แสดงราคา + ปุ่มยืนยันการโอน
  };

  return (
    <div className="p-4 max-w-full overflow-x-auto">
      <h1 className="text-2xl font-bold mb-4">📋 ตารางจองเวลาที่ปรึกษา</h1>

      <div className="mb-4">
        <label className="font-semibold mr-2">เลือกวันที่:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border px-2 py-1"
        />
      </div>

      <table className="min-w-max table-auto border border-collapse border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1 bg-gray-100">👤 ที่ปรึกษา</th>
            {hours.map((h) => (
              <th key={h} className="border px-2 py-1 text-sm bg-gray-100">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {consultants.map((c) => (
            <tr key={c.id}>
              <td className="border px-2 py-1 font-semibold">
                {c.nickname || c.username}
              </td>
              {hours.map((h) => (
                <td key={h} className="border px-1 py-1 text-center">
                  {isSlotAvailable(c.id, h) ? (
                    <button
                      onClick={() => handleBook(c, h)}
                      className="bg-green-500 hover:bg-green-600 text-white text-sm px-2 py-1 rounded"
                    >
                      จอง
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
