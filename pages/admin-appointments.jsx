// 📄 pages/admin-appointments.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import MainMenu from "../components/MainMenu";

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // ✅ ป้องกัน SSR error
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("logged_in_user");
      if (storedUser) setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") return;

    const fetch = async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "*, user:profiles(username, nickname), consultant:profiles(first_name, last_name)"
        )
        .order("date", { ascending: false });

      if (error) console.error(error);
      else setAppointments(data);

      setLoading(false);
    };

    fetch();
  }, [currentUser]);

  if (!currentUser || currentUser.role !== "admin")
    return <p>⛔️ ต้องเข้าสู่ระบบในฐานะแอดมิน</p>;
  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div className="p-4">
      <MainMenu />
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">📋 รายการการจองทั้งหมด</h1>
        <table className="w-full table-auto border border-collapse border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="border px-2 py-1">ผู้ใช้</th>
              <th className="border px-2 py-1">ที่ปรึกษา</th>
              <th className="border px-2 py-1">วันที่</th>
              <th className="border px-2 py-1">เวลา</th>
              <th className="border px-2 py-1">ราคา</th>
              <th className="border px-2 py-1">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className="text-sm text-center">
                <td className="border px-2 py-1">
                  {a.user.nickname || a.user.username}
                </td>
                <td className="border px-2 py-1">
                  {a.consultant.first_name} {a.consultant.last_name}
                </td>
                <td className="border px-2 py-1">{a.date}</td>
                <td className="border px-2 py-1">{a.time}</td>
                <td className="border px-2 py-1">฿{a.price}</td>
                <td className="border px-2 py-1">
                  <span
                    className={`font-semibold ${
                      a.status === "confirmed"
                        ? "text-green-600"
                        : a.status === "pending"
                        ? "text-yellow-600"
                        : "text-gray-600"
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
