// 📄 pages/admin-hospitals.jsx

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchHospitals();
  }, []);

  async function fetchHospitals() {
    const { data, error } = await supabase.from('hospitals').select('*').order('name');
    if (error) console.error('Fetch error:', error);
    else setHospitals(data);
  }

  async function addHospital() {
    if (!newName) return;
    const { error } = await supabase.from('hospitals').insert({ name: newName });
    if (error) console.error('Insert error:', error);
    setNewName('');
    fetchHospitals();
  }

  async function updateHospital(id, name) {
    const { error } = await supabase.from('hospitals').update({ name }).eq('id', id);
    if (error) console.error('Update error:', error);
    setEditingId(null);
    fetchHospitals();
  }

  async function deleteHospital(id) {
    if (!confirm('ลบโรงพยาบาลนี้หรือไม่?')) return;
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) console.error('Delete error:', error);
    fetchHospitals();
  }

  const filtered = hospitals.filter(h => h.name.includes(searchTerm));

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🏥 จัดการโรงพยาบาล</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="border px-3 py-1 rounded w-full"
          placeholder="ค้นหาโรงพยาบาล"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <input
          className="border px-3 py-1 rounded"
          placeholder="ชื่อโรงพยาบาลใหม่"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button onClick={addHospital} className="bg-green-600 text-white px-3 py-1 rounded">➕ เพิ่ม</button>
      </div>

      <ul className="divide-y">
        {filtered.map(h => (
          <li key={h.id} className="flex items-center justify-between py-2">
            {editingId === h.id ? (
              <input
                className="border px-2 py-1 rounded w-full mr-2"
                defaultValue={h.name}
                onBlur={(e) => updateHospital(h.id, e.target.value)}
                autoFocus
              />
            ) : (
              <span onClick={() => setEditingId(h.id)} className="cursor-pointer">{h.name}</span>
            )}
            <button onClick={() => deleteHospital(h.id)} className="text-red-600">🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
