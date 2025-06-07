// 📄 src/pages/admin-dashboard.jsx

import React from "react";
import Link from "next/link";
import { toast } from "react-toastify";

export default function AdminDashboard() {
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

        <Link href="/admin-hospitals">
          <button className="w-full px-4 py-3 bg-gray-700 text-white rounded shadow">
            🏥 โรงพยาบาล
          </button>
        </Link>

        <Link href="/admin-wards">
          <button className="w-full px-4 py-3 bg-gray-700 text-white rounded shadow">
            🏬 วอร์ด
          </button>
        </Link>

        <Link href="/nurse-manager">
          <button className="w-full px-4 py-3 bg-gray-700 text-white rounded shadow">
            🧑‍⚕️ พยาบาล
          </button>
        </Link>

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
