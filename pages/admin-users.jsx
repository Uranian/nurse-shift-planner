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
    shift_ward_id: "", // ✅ เพิ่ม
    role: "customer",
    user_type: "พยาบาล", // ✅ เพิ่ม
  });

  const [currentUser, setCurrentUser] = useState(null);

  const [editUser, setEditUser] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const [showAddUserForm, setShowAddUserForm] = useState(false);

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
      .select(
        `
    id, username, email, phone, hospital_id, ward_id, shift_ward_id, role, user_type,
    hospitals(name),
    wards!profiles_ward_id_fkey(name),
    shift_wards:wards!profiles_shift_ward_id_fkey(name)
  `
      )
      .order("email", { ascending: true });

    if (user?.role === "admin") {
      // admin เห็นทั้งหมด
    } else if (user.user_type === "หัวหน้าพยาบาล") {
      query = query.eq("hospital_id", user.hospital_id).neq("role", "admin");
    } else if (user.user_type === "หัวหน้าวอร์ด") {
      query = query.eq("hospital_id", user.hospital_id).neq("role", "admin");
      if (user.ward_id) {
        query = query.eq("ward_id", user.ward_id);
      } else {
        query = query.is("ward_id", null);
      }
    } else {
      query = query.eq("id", user.id);
    }

    const { data: usersData, error } = await query;

    if (error) {
      console.error("❌ โหลดผู้ใช้ล้มเหลว", error.message, error.details);
    } else {
      console.log("✅ โหลดผู้ใช้สำเร็จ", usersData.length, "คน");
    }

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
      toast.error("รหัสผ่าน (ต้องเป็นตัวเลข 8 หลัก)");
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
        "กรุณากรอก Username, รหัสผ่าน (เลข 8 หลัก), โรงพยาบาล, วอร์ด และประเภทผู้ใช้"
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
      shift_ward_id: "", // ✅ เพิ่มตรงนี้
      role: "customer",
      user_type: "พยาบาล",
    });
    fetchData(currentUser);
  };

  const handleUpdate = async () => {
    if (
      !editUser.username ||
      !editUser.hospital_id ||
      !editUser.ward_id ||
      !editUser.shift_ward_id
    )
      return;

    const updatedFields = {
      email: editUser.email,
      username: editUser.username,
      phone: editUser.phone,
      hospital_id: editUser.hospital_id,
      ward_id: editUser.ward_id,
      shift_ward_id: editUser.shift_ward_id, // ✅ เพิ่มตรงนี้
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
      <h1 className="text-2xl font-bold mb-2">👥 จัดการผู้ใช้</h1>

      {currentUser && (
        <p className="text-sm text-white mb-4">
          ผู้ใช้: <span className="font-semibold">{currentUser.username}</span>{" "}
          (<span className="italic">{currentUser.role}</span>
          {currentUser.user_type ? ` / ${currentUser.user_type}` : ""})
        </p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหา email, username, เบอร์โทร"
        className="border px-2 py-1 mb-2 w-full"
      />

      {showAddUserForm && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white text-black p-4 rounded">
          {/* Username */}
          <div>
            <label className="block font-semibold mb-1">👤 Username</label>
            <input
              value={newUser.username}
              onChange={(e) => handleChange("username", e.target.value)}
              className="border px-2 py-1 w-full"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block font-semibold mb-1">
              🔒 รหัสผ่าน (ต้องเป็นตัวเลข 8 หลัก)
            </label>
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className="border px-2 py-1 w-full"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block font-semibold mb-1">📧 Email</label>
            <input
              value={newUser.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="border px-2 py-1 w-full"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block font-semibold mb-1">📱 เบอร์โทร</label>
            <input
              value={newUser.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="border px-2 py-1 w-full"
            />
          </div>

          {/* Hospital */}
          <div>
            <label className="block font-semibold mb-1">🏥 โรงพยาบาล</label>
            <select
              value={newUser.hospital_id}
              onChange={(e) => handleChange("hospital_id", e.target.value)}
              className="border px-2 py-1 w-full"
              disabled={currentUser?.role !== "admin"}
            >
              <option value="">เลือกโรงพยาบาล</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ward */}
          <div>
            <label className="block font-semibold mb-1">
              🏨 วอร์ดที่สังกัด
            </label>
            <select
              value={newUser.ward_id}
              onChange={(e) => handleChange("ward_id", e.target.value)}
              className="border px-2 py-1 w-full"
            >
              <option value="">เลือกวอร์ด</option>
              {filteredWardsForNewUser.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shift Ward */}
          <div>
            <label className="block font-semibold mb-1">
              📋 วอร์ดที่จัดเวร
            </label>
            <select
              value={newUser.shift_ward_id}
              onChange={(e) => handleChange("shift_ward_id", e.target.value)}
              className="border px-2 py-1 w-full"
            >
              <option value="">เลือกวอร์ด</option>
              {filteredWardsForNewUser.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* User Type */}
          <div>
            <label className="block font-semibold mb-1">👩‍⚕️ ประเภทผู้ใช้</label>
            <select
              value={newUser.user_type}
              onChange={(e) => handleChange("user_type", e.target.value)}
              className="border px-2 py-1 w-full"
            >
              <option value="หัวหน้าพยาบาล">หัวหน้าพยาบาล</option>
              <option value="หัวหน้าวอร์ด">หัวหน้าวอร์ด</option>
              <option value="พยาบาล">พยาบาล</option>
              <option value="ผู้ช่วยเหลือคนไข้">ผู้ช่วยเหลือคนไข้</option>
              <option value="คนงาน">คนงาน</option>
            </select>
          </div>

          {/* Role (admin only) */}
          {currentUser?.role === "admin" && (
            <div>
              <label className="block font-semibold mb-1">🛠️ สิทธิ์ระบบ</label>
              <select
                value={newUser.role}
                onChange={(e) => handleChange("role", e.target.value)}
                className="border px-2 py-1 w-full"
              >
                <option value="customer">customer</option>
                <option value="admin">admin</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* ปุ่มเพิ่ม/บันทึก/ยกเลิก */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            if (showAddUserForm) {
              handleAdd();
              setShowAddUserForm(false);
            } else {
              setNewUser((prev) => ({
                ...prev,
                hospital_id: currentUser?.hospital_id || "", // ✅ ล็อกโรงพยาบาล
              }));
              setShowAddUserForm(true);
            }
          }}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          {showAddUserForm ? "💾 บันทึกผู้ใช้ใหม่" : "➕ เพิ่มผู้ใช้"}
        </button>

        {showAddUserForm && (
          <button
            onClick={() => {
              // ยกเลิกและเคลียร์ข้อมูล
              setShowAddUserForm(false);
              setNewUser({
                username: "",
                email: "",
                password: "",
                phone: "",
                hospital_id: "",
                ward_id: "",
                shift_ward_id: "",
                role: "customer",
                user_type: "พยาบาล",
              });
            }}
            className="bg-gray-400 text-black px-4 py-2 rounded"
          >
            ❌ ยกเลิก
          </button>
        )}
      </div>

      {editUser && (
        <div className="mb-4 border p-4 bg-gray-200 rounded text-black">
          <h2 className="text-lg font-semibold mb-4 text-black">
            ✏️ แก้ไขผู้ใช้
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Username */}
            <div>
              <label className="block font-semibold mb-1">👤 Username</label>
              <input
                value={editUser.username || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, username: e.target.value })
                }
                className="border px-2 py-1 w-full"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold mb-1">📧 Email</label>
              <input
                value={editUser.email || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, email: e.target.value })
                }
                className="border px-2 py-1 w-full"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block font-semibold mb-1">📱 เบอร์โทร</label>
              <input
                value={editUser.phone || ""}
                onChange={(e) =>
                  setEditUser({ ...editUser, phone: e.target.value })
                }
                className="border px-2 py-1 w-full"
              />
            </div>

            {/* Hospital */}
            <div>
              <label className="block font-semibold mb-1">🏥 โรงพยาบาล</label>
              <select
                value={editUser.hospital_id}
                onChange={(e) =>
                  setEditUser({ ...editUser, hospital_id: e.target.value })
                }
                className="border px-2 py-1 w-full"
                disabled={currentUser?.role !== "admin"}
              >
                <option value="">เลือกโรงพยาบาล</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ward */}
            <div>
              <label className="block font-semibold mb-1">
                🏨 วอร์ดที่สังกัด
              </label>
              <select
                value={editUser.ward_id}
                onChange={(e) =>
                  setEditUser({ ...editUser, ward_id: e.target.value })
                }
                className="border px-2 py-1 w-full"
                disabled={
                  !(
                    currentUser?.role === "admin" ||
                    currentUser?.role === "customer-admin"
                  )
                }
              >
                <option value="">เลือกวอร์ด</option>
                {filteredWardsForEditUser.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Ward */}
            <div>
              <label className="block font-semibold mb-1">
                📋 วอร์ดที่จัดเวร
              </label>
              <select
                value={editUser.shift_ward_id}
                onChange={(e) =>
                  setEditUser({ ...editUser, shift_ward_id: e.target.value })
                }
                className="border px-2 py-1 w-full"
                disabled={
                  !(
                    currentUser?.role === "admin" ||
                    currentUser?.role === "customer-admin"
                  )
                }
              >
                <option value="">เลือกวอร์ด</option>
                {filteredWardsForEditUser.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Type */}
            <div>
              <label className="block font-semibold mb-1">
                👩‍⚕️ ประเภทผู้ใช้
              </label>
              <select
                value={editUser.user_type}
                onChange={(e) =>
                  setEditUser({ ...editUser, user_type: e.target.value })
                }
                className="border px-2 py-1 w-full"
              >
                <option value="หัวหน้าพยาบาล">หัวหน้าพยาบาล</option>
                <option value="หัวหน้าวอร์ด">หัวหน้าวอร์ด</option>
                <option value="พยาบาล">พยาบาล</option>
                <option value="ผู้ช่วยเหลือคนไข้">ผู้ช่วยเหลือคนไข้</option>
                <option value="คนงาน">คนงาน</option>
              </select>
            </div>

            {/* Role (admin only) */}
            {currentUser?.role === "admin" && (
              <div>
                <label className="block font-semibold mb-1">
                  🛠️ สิทธิ์ระบบ
                </label>
                <select
                  value={editUser.role}
                  onChange={(e) =>
                    setEditUser({ ...editUser, role: e.target.value })
                  }
                  className="border px-2 py-1 w-full"
                >
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-4">
            <button
              onClick={handleUpdate}
              className="bg-blue-600 text-white px-4 py-2 rounded"
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
        </div>
      )}

      <table className="table-auto w-full border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">Username</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">เบอร์โทร</th>
            <th className="border px-2 py-1">โรงพยาบาล</th>
            <th className="border px-2 py-1">วอร์ดที่สังกัด</th>
            <th className="border px-2 py-1">วอร์ดที่จัดเวร</th>
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
              <td className="border px-2 py-1">
                {
                  wards.find((w) => w.id === user.shift_ward_id)?.name || "-" // แสดงชื่อวอร์ดจัดเวร
                }
              </td>

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
