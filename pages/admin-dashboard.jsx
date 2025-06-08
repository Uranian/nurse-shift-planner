// 📄 src/pages/admin-dashboard.jsx

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { toast } from "react-toastify";

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHeadNurse, setIsHeadNurse] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      setIsAdmin(user.role === "admin");
      setIsHeadNurse(
        user.user_type === "หัวหน้าวอร์ด" || user.user_type === "หัวหน้าพยาบาล"
      );
    }
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧭 แผงควบคุมผู้ดูแลระบบ</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Link href="/shift-planner">
          <button className="w-full px-4 py-3 bg-green-700 text-white rounded shadow">
            📅 จัดตารางเวรพยาบาล
          </button>
        </Link>

        <Link href="/massage-planner">
          <button className="w-full px-4 py-3 bg-green-700 text-white rounded shadow">
            💆‍♀️ จัดคิวนวดแผนไทย
          </button>
        </Link>
        {isAdmin && (
          <Link href="/admin-hospitals">
            <button className="w-full px-4 py-3 rounded shadow bg-gray-700 text-white">
              🏥 โรงพยาบาล
            </button>
          </Link>
        )}

        {isAdmin && (
          <Link href="/admin-wards">
            <button className="w-full px-4 py-3 rounded shadow bg-gray-700 text-white">
              🏬 วอร์ด
            </button>
          </Link>
        )}
        <button
          className="w-full px-4 py-3 bg-gray-700 text-white rounded shadow"
          onClick={() => {
            if (isHeadNurse || currentUser?.role === "admin") {
              router.push("/nurse-manager");
            } else {
              toast.warn(
                "❌ คุณไม่มีสิทธิ์ใช้งานหน้านี้ เพราะคุณไม่ใช่หัวหน้าวอร์ด/หัวหน้าพยาบาล"
              );
            }
          }}
        >
          🧑‍⚕️ พยาบาล
        </button>

        <Link href="/admin-users">
          <button className="w-full px-4 py-3 bg-gray-700 text-white rounded shadow">
            👤 ผู้ใช้
          </button>
        </Link>

        <Link href="/system-settings">
          <button className="w-full px-4 py-3 bg-gray-700 text-white rounded shadow">
            ⚙️ ตั้งค่าระบบ
          </button>
        </Link>
      </div>
    </div>
  );
}
