// 📄 src/pages/consultant-availability.jsx

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import dayjs from "dayjs";

export default function ConsultantAvailabilityPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [slotDuration, setSlotDuration] = useState(60); // นาที
  const [price, setPrice] = useState(500);
  const [availabilityList, setAvailabilityList] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const user = JSON.parse(stored);
      if (user.user_type === "ที่ปรึกษา") {
        setCurrentUser(user);
        fetchAvailability(user);
      } else {
        toast.error("❌ เฉพาะที่ปรึกษาเท่านั้นที่เข้าหน้านี้ได้");
      }
    }
  }, []);

  const fetchAvailability = async (user) => {
    const { data, error } = await supabase
      .from("consultant_availability")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) {
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } else {
      setAvailabilityList(data);
    }
  };

  const handleAddAvailability = async () => {
    if (!startTime || !endTime || !price || !slotDuration) return;

    const payload = {
      user_id: currentUser.id,
      date,
      start_time: startTime,
      end_time: endTime,
      slot_duration: parseInt(slotDuration),
      price: parseInt(price),
    };

    const { error } = await supabase
      .from("consultant_availability")
      .insert([payload]);

    if (error) {
      toast.error("บันทึกไม่สำเร็จ");
    } else {
      toast.success("✅ บันทึกช่วงเวลาสำเร็จ");
      fetchAvailability(currentUser);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📅 กรอกช่วงเวลาที่ว่าง</h1>

      <div className="space-y-4">
        <div>
          <label>📆 วันที่</label>
          <input type="date" className="border p-1 w-full" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label>⏰ เวลาเริ่ม</label>
            <input type="time" className="border p-1 w-full" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="flex-1">
            <label>⏰ เวลาสิ้นสุด</label>
            <input type="time" className="border p-1 w-full" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label>⏳ ความยาวสล็อต (นาที)</label>
            <select className="border p-1 w-full" value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)}>
              <option value={30}>30 นาที</option>
              <option value={60}>1 ชั่วโมง</option>
              <option value={90}>1.5 ชั่วโมง</option>
              <option value={120}>2 ชั่วโมง</option>
            </select>
          </div>

          <div className="flex-1">
            <label>💰 ค่าบริการ (บาท)</label>
            <input type="number" className="border p-1 w-full" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <button onClick={handleAddAvailability} className="bg-green-600 text-white px-4 py-2 rounded">
          ➕ เพิ่มช่วงเวลาว่าง
        </button>

        <hr className="my-4" />

        <h2 className="text-lg font-bold">📖 รายการที่บันทึกไว้</h2>
        <ul className="space-y-2">
          {availabilityList.map((item) => (
            <li key={item.id} className="border rounded p-2">
              {item.date} เวลา {item.start_time} - {item.end_time} | {item.slot_duration} นาที | {item.price} บาท
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
