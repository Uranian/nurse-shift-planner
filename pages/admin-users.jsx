// 📄 src/pages/admin-users.jsx

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../lib/supabaseClient";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [wards, setWards] = useState([]);
  const [search, setSearch] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    hospital_id: "",
    ward_id: "",
    role: "staff",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: usersData } = await supabase
      .from("users")
      .select("*, hospitals(name), wards(name)")
      .order("email", { ascending: true });
    setUsers(usersData || []);

    const { data: hospitalsData } = await supabase.from("hospitals").select();
    setHospitals(hospitalsData || []);

    const { data: wardsData } = await supabase.from("wards").select();
    setWards(wardsData || []);
  };

  const handleChange = (field, value) => {
    setNewUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleAdd = async () => {
    if (
      !newUser.email ||
      !newUser.password ||
      !newUser.hospital_id ||
      !newUser.ward_id
    )
      return;
    await supabase.from("users").insert([newUser]);
    setNewUser({
      email: "",
      password: "",
      hospital_id: "",
      ward_id: "",
      role: "staff",
    });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm("ยืนยันลบผู้ใช้นี้?")) return;
    await supabase.from("users").delete().eq("id", id);
    fetchData();
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">👥 จัดการผู้ใช้</h1>

      <div className="mb-4 flex gap-2 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา email"
          className="border px-2 py-1"
        />
        <input
          value={newUser.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="email"
          className="border px-2 py-1"
        />
        <input
          value={newUser.password}
          onChange={(e) => handleChange("password", e.target.value)}
          placeholder="password"
          className="border px-2 py-1"
          type="password"
        />
        <select
          value={newUser.hospital_id}
          onChange={(e) => handleChange("hospital_id", e.target.value)}
          className="border px-2 py-1"
        >
          <option value="">เลือกโรงพยาบาล</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          value={newUser.ward_id}
          onChange={(e) => handleChange("ward_id", e.target.value)}
          className="border px-2 py-1"
        >
          <option value="">เลือกวอร์ด</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={newUser.role}
          onChange={(e) => handleChange("role", e.target.value)}
          className="border px-2 py-1"
        >
          <option value="staff">staff</option>
          <option value="admin">admin</option>
        </select>
        <button
          onClick={handleAdd}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          ➕ เพิ่มผู้ใช้
        </button>
      </div>

      <table className="table-auto w-full border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">วอร์ด</th>
            <th className="border px-2 py-1">Role</th>
            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => (
            <tr key={user.id}>
              <td className="border px-2 py-1">{user.email}</td>
              <td className="border px-2 py-1">
                {user.hospitals?.name || "-"}
              </td>
              <td className="border px-2 py-1">{user.wards?.name || "-"}</td>
              <td className="border px-2 py-1">{user.role}</td>
              <td className="border px-2 py-1">
                <button
                  onClick={() => handleDelete(user.id)}
                  className="text-red-500 hover:underline"
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
