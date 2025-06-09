// 📄 components/MainMenu.jsx
import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function MainMenu() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("logged_in_user"));
    if (user) setCurrentUser(user);
  }, []);

  const userType = currentUser?.user_type_booking;
  const role = currentUser?.role;

  return (
    <nav className="bg-gray-100 p-4 rounded shadow mb-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        {/* เมนูซ้าย */}
        <ul className="flex flex-wrap gap-4">
          <li>
            <Link href="/login-to-consultant-booking">
              <button className="bg-blue-500 text-white px-4 py-2 rounded">
                🏠 หน้าแรก
              </button>
            </Link>
          </li>

          {currentUser ? (
            <>
              <li>
                <Link href="/edit-profile">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded">
                    ✏️ แก้ไขโปรไฟล์
                  </button>
                </Link>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link href="/register-consultant">
                  <button className="bg-pink-500 text-white px-4 py-2 rounded">
                    👩‍⚕️ สมัครเป็นที่ปรึกษา
                  </button>
                </Link>
              </li>
              <li>
                <Link href="/register-user">
                  <button className="bg-orange-500 text-white px-4 py-2 rounded">
                    🙋‍♀️ สมัครเป็นผู้ใช้บริการ
                  </button>
                </Link>
              </li>
            </>
          )}

          {userType === "ที่ปรึกษา" && (
            <li>
              <Link href="/consultant-availability">
                <button className="bg-green-600 text-white px-4 py-2 rounded">
                  🗓️ จัดตารางให้คำปรึกษา
                </button>
              </Link>
            </li>
          )}

          <li>
            <Link href="/consultant-booking">
              <button className="bg-purple-600 text-white px-4 py-2 rounded">
                📋 จองเวลาที่ปรึกษา
              </button>
            </Link>
          </li>

          <li>
            <Link href="/my-appointments">
              <button className="bg-teal-600 text-white px-4 py-2 rounded">
                📑 ประวัติการจองของฉัน
              </button>
            </Link>
          </li>

          {role === "admin" && (
            <li>
              <Link href="/admin-appointments">
                <button className="bg-red-600 text-white px-4 py-2 rounded">
                  🧑‍💼 การจองทั้งหมด (admin)
                </button>
              </Link>
            </li>
          )}

          {currentUser && (
            <li>
              <button
                onClick={() => {
                  localStorage.removeItem("logged_in_user");
                  window.location.href = "/login-to-consultant-booking";
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                🚪 ออกจากระบบ
              </button>
            </li>
          )}
        </ul>

        {/* ชื่อผู้ใช้ด้านขวา */}
        {currentUser && (
          <div className="text-gray-800 font-semibold">
            👤 {currentUser.nickname || currentUser.username}
          </div>
        )}
      </div>
    </nav>
  );
}
