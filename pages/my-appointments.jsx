// 📄 pages/my-appointments.jsx

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import dayjs from "dayjs";
import MainMenu from "../components/MainMenu";

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("logged_in_user");
      if (stored) setCurrentUser(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetch = async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, consultant:profiles(first_name, last_name, nickname)")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });

      if (error) console.error(error);
      else setAppointments(data);

      setLoading(false);
    };

    fetch();
  }, [currentUser]);

  if (!currentUser) return <p>กรุณาเข้าสู่ระบบ</p>;
  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div className="p-4">
      <MainMenu />
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">🗓 ประวัติการจองของฉัน</h1>
        {appointments.length === 0 ? (
          <p>ยังไม่มีการจอง</p>
        ) : (
          <ul className="space-y-4">
            {appointments.map((a) => (
              <li key={a.id} className="border p-3 rounded shadow">
                <p>
                  <strong>วันที่:</strong> {a.date}
                </p>
                <p>
                  <strong>เวลา:</strong> {a.time}
                </p>
                <p>
                  <strong>ราคา:</strong> ฿{a.price}
                </p>
                <p>
                  <strong>ที่ปรึกษา:</strong>{" "}
                  {a.consultant.first_name || a.consultant.nickname}
                </p>
                <p>
                  <strong>สถานะ:</strong>{" "}
                  <span
                    className={`font-semibold ${
                      a.status === "confirmed"
                        ? "text-green-600"
                        : a.status === "pending"
                        ? "text-yellow-600"
                        : "text-gray-500"
                    }`}
                  >
                    {a.status}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
