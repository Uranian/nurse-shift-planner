// 📄 pages/index.jsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-center p-6">
      <h1 className="text-2xl text-black font-bold mb-6">ระบบศูนย์รวมบริการ</h1>

      <div className="flex flex-col space-y-6">
        <div>
          <Link href="/shift-planner">
            <button className="bg-blue-600 text-white px-6 py-3 rounded shadow">
              🏥 จัดตารางเวรพยาบาลในวอร์ด
            </button>
          </Link>
        </div>

        <div>
          <Link href="/massage-planner">
            <button className="bg-green-600 text-white px-6 py-3 rounded shadow">
              💆 นัดคิวนวดแผนโบราณ
            </button>
          </Link>
        </div>

        <div>
          <Link href="/login-to-consultant-booking">
            <button className="bg-purple-600 text-white px-6 py-3 rounded shadow">
              🧠 นัดที่ปรึกษา
            </button>
          </Link>
          <p className="text-sm text-gray-700 mt-1">
            (แพทย์, นักจิตวิทยา, นักกายภาพ, นักกฏหมาย, หมอดู)
          </p>
        </div>
      </div>
    </div>
  );
}
