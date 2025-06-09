// 📄 pages/consultant-booking.jsx

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { supabase } from "../lib/supabaseClient";
import { toast } from "react-toastify";
import { useRouter } from "next/router"; // ✅ ต้องมี
import Modal from "react-modal";
import MainMenu from "../components/MainMenu";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const hours = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

export default function ConsultantBooking() {
  const [consultants, setConsultants] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD")
  );

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const router = useRouter();

  useEffect(() => {
    Modal.setAppElement("body"); // เพื่อป้องกัน warning accessibility
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("logged_in_user"));
    if (user) setCurrentUser(user);
  }, []);

  const handleBook = (consultant, time) => {
    const slotInfo = availabilities.find(
      (slot) =>
        slot.user_id === consultant.id &&
        dayjs(`${selectedDate} ${time}`).isSameOrAfter(
          dayjs(`${selectedDate} ${slot.start_time}`)
        ) &&
        dayjs(`${selectedDate} ${time}`).isBefore(
          dayjs(`${selectedDate} ${slot.end_time}`)
        )
    );
    setSelectedSlot({ consultant, time, slotInfo });
  };

  const confirmBooking = async () => {
    if (!currentUser) {
      router.push("/register");
      return;
    }

    // 🧠 1. ตรวจสอบว่าผู้ใช้จองซ้ำหรือไม่
    const { data: existing, error: checkError } = await supabase
      .from("appointments")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("consultant_id", selectedSlot.consultant.id)
      .eq("date", selectedDate)
      .eq("time", selectedSlot.time)
      .in("status", ["pending", "confirmed"]); // 👈 ตรวจสอบเฉพาะสถานะที่ยังไม่ยกเลิก

    if (checkError) {
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบ");
      return;
    }

    if (existing.length > 0) {
      toast.warn("⚠️ คุณได้จองเวลานี้ไปแล้ว");
      return;
    }

    // 🧠 2. ตรวจสอบว่าผู้ใช้คนอื่นจอง slot นี้ไปแล้วหรือยัง (กันชน)
    const { data: otherBookings, error: doubleError } = await supabase
      .from("appointments")
      .select("id")
      .eq("consultant_id", selectedSlot.consultant.id)
      .eq("date", selectedDate)
      .eq("time", selectedSlot.time)
      .in("status", ["pending", "confirmed"]);

    if (doubleError) {
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบจองซ้ำ");
      return;
    }

    if (otherBookings.length > 0) {
      toast.warn("⚠️ มีผู้ใช้คนอื่นจองช่วงเวลานี้ไปแล้ว");
      return;
    }

    // ✅ หากไม่มีการจองซ้ำ ดำเนินการ insert
    const { error } = await supabase.from("appointments").insert([
      {
        user_id: currentUser.id,
        consultant_id: selectedSlot.consultant.id,
        date: selectedDate,
        time: selectedSlot.time,
        price: selectedSlot.slotInfo?.price || 0,
        status: "pending",
      },
    ]);

    if (error) {
      toast.error("❌ การจองล้มเหลว");
    } else {
      toast.success("✅ จองสำเร็จแล้ว");
      setSelectedSlot(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    // 1. ดึงรายชื่อที่ปรึกษา
    const { data: users } = await supabase
      .from("profiles")
      .select("id, username, nickname, first_name, last_name, description")
      .eq("user_type_booking", "ที่ปรึกษา");

    // 2. ดึงช่วงเวลาที่เปิดจองของที่ปรึกษาในวันนั้น
    const { data: slots } = await supabase
      .from("consultant_availability")
      .select("user_id, start_time, end_time, price")
      .eq("date", selectedDate);

    // 3. ดึงรายการที่ถูกจองแล้ว (appointments)
    const { data: bookings } = await supabase
      .from("appointments")
      .select("consultant_id, time, status")
      .eq("date", selectedDate);

    // 4. เซ็ตข้อมูลให้ state
    setConsultants(users || []);
    setAvailabilities(slots || []);
    setAppointments(bookings || []);
  };

  const isSlotAvailable = (consultantId, time) => {
    const t = dayjs(`${selectedDate} ${time}`);
    return availabilities.some((slot) => {
      const start = dayjs(`${selectedDate} ${slot.start_time}`);
      const end = dayjs(`${selectedDate} ${slot.end_time}`);
      return (
        slot.user_id === consultantId &&
        t.isSameOrAfter(start) &&
        t.isBefore(end)
      );
    });
  };

  const isSlotBooked = (consultantId, time) => {
    return appointments.some((a) => {
      const bookedTime = dayjs(`${selectedDate} ${a.time}`).format("HH:mm");
      return (
        a.consultant_id === consultantId &&
        bookedTime === time &&
        a.status !== "cancelled"
      );
    });
  };

  return (
    <div className="p-4">
      <MainMenu />
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
              <th className="border px-2 py-1 bg-gray-100 text-black">
                👤 ที่ปรึกษา
              </th>
              {hours.map((h) => (
                <th
                  key={h}
                  className="border px-2 py-1 text-sm text-black bg-gray-100"
                >
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
                      isSlotBooked(c.id, h) ? (
                        <button
                          disabled
                          className="bg-red-500 text-white text-sm px-2 py-1 rounded opacity-60 cursor-not-allowed"
                        >
                          จองแล้ว
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBook(c, h)}
                          className="bg-green-500 hover:bg-green-600 text-white text-sm px-2 py-1 rounded"
                        >
                          จอง
                          <br />
                          <span className="text-xs">
                            ฿
                            {availabilities.find(
                              (slot) =>
                                slot.user_id === c.id &&
                                dayjs(`${selectedDate} ${h}`).isSameOrAfter(
                                  dayjs(`${selectedDate} ${slot.start_time}`)
                                ) &&
                                dayjs(`${selectedDate} ${h}`).isBefore(
                                  dayjs(`${selectedDate} ${slot.end_time}`)
                                )
                            )?.price ?? "-"}
                          </span>
                        </button>
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <Modal
          isOpen={!!selectedSlot}
          onRequestClose={() => setSelectedSlot(null)}
          className="bg-white p-6 max-w-md mx-auto rounded shadow"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        >
          {selectedSlot && (
            <div>
              <h2 className="text-xl text-black font-bold mb-4">
                ยืนยันการจอง
              </h2>
              <p className="text-black">
                <strong>วันที่:</strong> {selectedDate}
              </p>
              <p className="text-black">
                <strong>เวลา:</strong> {selectedSlot.time}
              </p>
              <p className="text-black">
                <strong>ราคา:</strong> ฿{selectedSlot.slotInfo.price}
              </p>
              <p className="text-black">
                <strong>ชื่อ:</strong>{" "}
                {selectedSlot.consultant.first_name || "-"}{" "}
                {selectedSlot.consultant.last_name || ""}
              </p>
              <p className="text-black">
                <strong>ชื่อเล่น:</strong>{" "}
                {selectedSlot.consultant.nickname ||
                  selectedSlot.consultant.username}
              </p>
              <p className="text-black">
                <strong>สรรพคุณ:</strong>{" "}
                {selectedSlot.consultant.description || "-"}
              </p>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="bg-gray-400 px-3 py-1 rounded text-white"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmBooking}
                  className="bg-blue-600 px-3 py-1 rounded text-white"
                >
                  จอง
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
