// 📄 src/pages/nurse-manager.jsx

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function NurseManager() {
  const [nurses, setNurses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newNurse, setNewNurse] = useState("");
  const [orderMap, setOrderMap] = useState({});

  useEffect(() => {
    fetchNurses();
  }, []);

  const fetchNurses = async () => {
    const { data, error } = await supabase
      .from("nurses")
      .select("id, name, display_order")
      .order("display_order", { ascending: true });

    if (!error) {
      setNurses(data);
      const map = {};
      data.forEach((n) => (map[n.id] = n.display_order));
      setOrderMap(map);
    }
  };

  const addNurse = async () => {
    if (!newNurse.trim()) return;
    await supabase.from("nurses").insert({ name: newNurse });
    setNewNurse("");
    fetchNurses();
  };

  const deleteNurse = async (id) => {
    if (!confirm("ยืนยันลบพยาบาลคนนี้?")) return;
    await supabase.from("nurses").delete().eq("id", id);
    fetchNurses();
  };

  const updateOrder = async () => {
    const updates = nurses.map((n) => ({ id: n.id, display_order: orderMap[n.id] || 0 }));
    const { error } = await supabase.from("nurses").upsert(updates);
    if (!error) fetchNurses();
  };

  const filteredNurses = nurses.filter((n) =>
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">👩‍⚕️ จัดการรายชื่อพยาบาล</h1>

      <div className="mb-4 flex gap-4 flex-wrap items-center">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-2 py-1"
          placeholder="ค้นหา..."
        />
        <input
          value={newNurse}
          onChange={(e) => setNewNurse(e.target.value)}
          className="border px-2 py-1"
          placeholder="ชื่อพยาบาลใหม่"
        />
        <button onClick={addNurse} className="bg-green-600 text-white px-3 py-1 rounded">
          ➕ เพิ่มพยาบาล
        </button>
        <button onClick={updateOrder} className="bg-blue-600 text-white px-3 py-1 rounded">
          💾 บันทึกลำดับการแสดง
        </button>
      </div>

      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            <th className="border px-2 py-1">ชื่อ</th>
            <th className="border px-2 py-1">ลำดับ</th>
            <th className="border px-2 py-1">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filteredNurses.map((nurse) => (
            <tr key={nurse.id}>
              <td className="border px-2 py-1">{nurse.name}</td>
              <td className="border px-2 py-1">
                <input
                  type="number"
                  value={orderMap[nurse.id] || ""}
                  onChange={(e) =>
                    setOrderMap({ ...orderMap, [nurse.id]: parseInt(e.target.value) || 0 })
                  }
                  className="border px-2 py-1 w-16"
                />
              </td>
              <td className="border px-2 py-1">
                <button
                  onClick={() => deleteNurse(nurse.id)}
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
