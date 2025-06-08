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
    username: "",
    email: "",
    password: "",
    phone: "",
    hospital_id: "",
    ward_id: "",
    role: "customer",
    user_type: "พยาบาล", // ✅ เพิ่ม
  });

  const [currentUser, setCurrentUser] = useState(null);

  const [editUser, setEditUser] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("logged_in_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setCurrentUser(parsed);
      fetchData(parsed); // ✅ ส่ง currentUser ไปเลย
    } else {
      fetchData(null);
    }
  }, []);

  const fetchData = async (user) => {
    let query = supabase
      .from("profiles")
      .select("*, hospitals(name), wards(name)")
      .order("email", { ascending: true });

    if (user?.role === "admin") {
      // แอดมินดูได้ทุกคน
      // ไม่ต้องกรองอะไรเพิ่ม
    } else if (user.user_type === "หัวหน้าพยาบาล") {
      query = query.eq("hospital_id", user.hospital_id).neq("role", "admin"); // ดูทั้งโรงพยาบาล
    } else if (user.user_type === "หัวหน้าวอร์ด") {
      query = query
        .eq("hospital_id", user.hospital_id)
        .eq("ward_id", user.ward_id)
        .neq("role", "admin"); // ดูเฉพาะในวอร์ด
    } else {
      // พยาบาล/คนงาน → ดูได้เฉพาะตัวเอง
      query = query.eq("id", user.id);
    }

    console.log(
      "กำลังโหลดผู้ใช้สำหรับ",
      user.user_type,
      "ใน",
      user.hospital_id,
      "/",
      user.ward_id
    );

    const { data: usersData } = await query;
    setUsers(usersData || []);

    // โหลดโรงพยาบาลทั้งหมด (admin ดูได้หมด, customer ดูเฉพาะที่ตัวเอง)
    const hospitalQuery =
      user?.role === "admin"
        ? supabase.from("hospitals").select()
        : supabase.from("hospitals").select().eq("id", user.hospital_id);
    const { data: hospitalsData } = await hospitalQuery;
    setHospitals(hospitalsData || []);

    const wardQuery =
      user?.role === "admin"
        ? supabase.from("wards").select()
        : supabase.from("wards").select().eq("hospital_id", user.hospital_id);
    const { data: wardsData } = await wardQuery;
    setWards(wardsData || []);
  };

  const handleChange = (field, value) => {
    setNewUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleAdd = async () => {
    if (!/^[0-9]{8}$/.test(newUser.password)) {
      toast.error("รหัสผ่านต้องเป็นตัวเลข 8 หลัก");
      return;
    }

    if (
      !newUser.username ||
      !newUser.password ||
      !newUser.hospital_id ||
      !newUser.ward_id ||
      !newUser.user_type ||
      (currentUser?.role !== "admin" && !newUser.role)
    ) {
      toast.error(
        "กรุณากรอก Username, รหัสผ่าน 8 หลัก, โรงพยาบาล, วอร์ด และประเภทผู้ใช้"
      );
      return;
    }

    const payload = { ...newUser };
    if (currentUser?.role !== "admin") {
      delete payload.role; // ✅ ลบ role ถ้าไม่ใช่ admin
    }

    await supabase.from("profiles").insert([payload]);
    setNewUser({
      username: "",
      email: "",
      password: "",
      phone: "",
      hospital_id: "",
      ward_id: "",
      role: "customer",
      user_type: "พยาบาล",
    });
    fetchData(currentUser);
  };

  const handleUpdate = async () => {
    if (!editUser.email || !editUser.hospital_id || !editUser.ward_id) return;

    const updatedFields = {
      email: editUser.email,
      username: editUser.username,
      phone: editUser.phone,
      hospital_id: editUser.hospital_id,
      ward_id: editUser.ward_id,
      user_type: editUser.user_type,
      updated_at: new Date().toISOString(),
    };

    // ✅ อนุญาตให้แก้ role ได้เฉพาะ admin
    if (currentUser?.role === "admin") {
      updatedFields.role = editUser.role;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updatedFields)
      .eq("id", editUser.id);

    if (error) {
      console.error("Update failed:", error);
    }

    setEditUser(null);
    fetchData(currentUser);
  };

  const handleDelete = (id) => {
    setDeletingUserId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    await supabase.from("profiles").delete().eq("id", deletingUserId);
    fetchData(currentUser);
    setShowDeleteModal(false);
    setDeletingUserId(null);
  };

  const filtered = users.filter((u) =>
    [u.email, u.username, u.phone].some((field) =>
      field?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const filteredWardsForNewUser = wards.filter(
    (w) => w.hospital_id === newUser.hospital_id
  );

  const filteredWardsForEditUser = wards.filter(
    (w) => w.hospital_id === editUser?.hospital_id
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">👥 จัดการผู้ใช้</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหา email, username, เบอร์โทร"
        className="border px-2 py-1 mb-2 w-full"
      />

      <div className="mb-4 flex gap-2 flex-wrap items-center bg-white text-black p-4 rounded">
        <input
          value={newUser.username}
          onChange={(e) => handleChange("username", e.target.value)}
          placeholder="username"
          className="border px-2 py-1"
        />

        <input
          value={newUser.password}
          onChange={(e) => handleChange("password", e.target.value)}
          placeholder="รหัสผ่าน 8 หลัก"
          className="border px-2 py-1"
          type="password"
        />
        <input
          value={newUser.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="email"
          className="border px-2 py-1"
        />
        <input
          value={newUser.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="เบอร์โทร"
          className="border px-2 py-1"
        />
        <select
          value={newUser.hospital_id}
          onChange={(e) => handleChange("hospital_id", e.target.value)}
          className="border px-2 py-1"
          disabled={currentUser?.role !== "admin"} // ✅
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
          disabled={currentUser?.role !== "admin"} // ✅
        >
          {newUser.hospital_id ? (
            filteredWardsForNewUser.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))
          ) : (
            <option value="">กรุณาเลือกโรงพยาบาลก่อน</option>
          )}
        </select>
        <select
          value={newUser.user_type}
          onChange={(e) => handleChange("user_type", e.target.value)}
          className="border px-2 py-1"
        >
          <option value="หัวหน้าพยาบาล">หัวหน้าพยาบาล</option>
          <option value="หัวหน้าวอร์ด">หัวหน้าวอร์ด</option>
          <option value="พยาบาล">พยาบาล</option>
          <option value="ผู้ช่วยเหลือคนไข้">ผู้ช่วยเหลือคนไข้</option>
          <option value="คนงาน">คนงาน</option>
        </select>

        {currentUser?.role === "admin" && (
          <select
            value={newUser.role}
            onChange={(e) => handleChange("role", e.target.value)}
            className="border px-2 py-1"
          >
            <option value="customer">customer</option>
            <option value="admin">admin</option>
          </select>
        )}

        <button
          onClick={handleAdd}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          ➕ เพิ่มผู้ใช้
        </button>
      </div>

      {editUser && (
        <div className="mb-4 border p-4 bg-gray-200 rounded text-black">
          <h2 className="text-lg font-semibold mb-2 text-black">
            ✏️ แก้ไขผู้ใช้
          </h2>
          <input
            value={editUser.username || ""}
            onChange={(e) =>
              setEditUser({ ...editUser, username: e.target.value })
            }
            placeholder="username"
            className="border px-2 py-1 mr-2"
          />
          <input
            value={editUser.email || ""}
            onChange={(e) =>
              setEditUser({ ...editUser, email: e.target.value })
            }
            placeholder="email"
            className="border px-2 py-1 mr-2"
          />
          <input
            value={editUser.phone || ""}
            onChange={(e) =>
              setEditUser({ ...editUser, phone: e.target.value })
            }
            placeholder="เบอร์โทร"
            className="border px-2 py-1 mr-2"
          />
          <select
            value={editUser.hospital_id}
            onChange={(e) =>
              setEditUser({ ...editUser, hospital_id: e.target.value })
            }
            className="border px-2 py-1 mr-2"
            disabled={currentUser?.role !== "admin"} // ✅
          >
            <option value="">เลือกโรงพยาบาล</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select
            value={editUser.ward_id}
            onChange={(e) =>
              setEditUser({ ...editUser, ward_id: e.target.value })
            }
            className="border px-2 py-1 mr-2"
            disabled={currentUser?.role !== "admin"} // ✅
          >
            <option value="">เลือกวอร์ด</option>
            {filteredWardsForEditUser.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            value={editUser.user_type}
            onChange={(e) =>
              setEditUser({ ...editUser, user_type: e.target.value })
            }
            className="border px-2 py-1 mr-2"
          >
            <option value="หัวหน้าพยาบาล">หัวหน้าพยาบาล</option>
            <option value="หัวหน้าวอร์ด">หัวหน้าวอร์ด</option>
            <option value="พยาบาล">พยาบาล</option>
            <option value="ผู้ช่วยเหลือคนไข้">ผู้ช่วยเหลือคนไข้</option>
            <option value="คนงาน">คนงาน</option>
          </select>

          {currentUser?.role === "admin" && (
            <select
              value={editUser.role}
              onChange={(e) =>
                setEditUser({ ...editUser, role: e.target.value })
              }
              className="border px-2 py-1 mr-2"
            >
              <option value="customer">customer</option>
              <option value="admin">admin</option>
            </select>
          )}

          <button
            onClick={handleUpdate}
            className="bg-blue-600 text-white px-3 py-1 rounded mr-2"
          >
            💾 บันทึก
          </button>
          <button
            onClick={() => setEditUser(null)}
            className="text-gray-600 underline"
          >
            ยกเลิก
          </button>
        </div>
      )}

      <table className="table-auto w-full border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">Username</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">เบอร์โทร</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">วอร์ด</th>
            <th className="border px-2 py-1">ประเภท</th>
            {currentUser?.role === "admin" && (
              <th className="border px-2 py-1">Role</th>
            )}

            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => (
            <tr key={user.id}>
              <td className="border px-2 py-1">{user.username || "-"}</td>
              <td className="border px-2 py-1">{user.email}</td>
              <td className="border px-2 py-1">{user.phone || "-"}</td>
              <td className="border px-2 py-1">
                {user.hospitals?.name || "-"}
              </td>
              <td className="border px-2 py-1">{user.wards?.name || "-"}</td>
              <td className="border px-2 py-1">{user.user_type || "-"}</td>
              {currentUser?.role === "admin" && (
                <td className="border px-2 py-1">{user.role}</td>
              )}

              <td className="border px-2 py-1">
                <button
                  onClick={() => setEditUser(user)}
                  className="text-blue-600 hover:underline mr-2"
                >
                  แก้ไข
                </button>
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

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[90%] max-w-sm">
            <h2 className="text-xl font-semibold mb-4 text-center text-black">
              ยืนยันการลบผู้ใช้
            </h2>
            <p className="text-center mb-6 text-black">
              คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                ลบ
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
