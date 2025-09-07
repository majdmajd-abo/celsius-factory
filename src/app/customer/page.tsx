"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  note: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const [editing, setEditing] = useState<Record<string, Partial<Customer>>>({});

  const load = async () => {
    setMsg("");
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { setMsg("❌ שגיאה בטעינה"); return; }
    setRows((data as Customer[]) || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    setMsg("");
    if (!name.trim()) { setMsg("⚠️ חובה שם לקוח"); return; }
    const { error } = await supabase.from("customers").insert({
      name: name.trim(),
      phone: phone || null,
      city: city || null,
      note: note || null,
    });
    if (error) { setMsg("❌ שמירה נכשלה: " + error.message); return; }
    setName(""); setPhone(""); setCity(""); setNote("");
    setMsg("✅ נשמר");
    load();
  };

  const startEdit = (c: Customer) => {
    setEditing((e) => ({ ...e, [c.id]: { name: c.name, phone: c.phone || "", city: c.city || "", note: c.note || "" } }));
  };

  const cancelEdit = (id: string) => {
    setEditing((e) => { const cp = { ...e }; delete cp[id]; return cp; });
  };

  const saveEdit = async (id: string) => {
    const e = editing[id];
    if (!e) return;
    if (!e.name || e.name.trim() === "") { setMsg("⚠️ שם לקוח חובה"); return; }

    const { error } = await supabase.from("customers").update({
      name: e.name.trim(),
      phone: (e.phone || "").trim() || null,
      city: (e.city || "").trim() || null,
      note: (e.note || "").trim() || null,
    }).eq("id", id);

    if (error) { setMsg("❌ עדכון נכשל: " + error.message); return; }
    cancelEdit(id);
    setMsg("✅ עודכן");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("למחוק לקוח?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { setMsg("❌ מחיקה נכשלה: " + error.message); return; }
    setMsg("✅ נמחק");
    load();
  };

  return (
    <div style={{ maxWidth: 1000, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>👥 לקוחות</h1>

      {msg && <div style={{ marginBottom: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>{msg}</div>}

      {/* הוספת לקוח */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>➕ הוסף לקוח</h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 2fr auto" }}>
          <input className="border p-2" placeholder="שם לקוח" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border p-2" placeholder="טלפון" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="border p-2" placeholder="עיר" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="border p-2" placeholder="הערה" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="border px-3 py-2 bg-gray-100 hover:bg-gray-200" onClick={add}>שמור</button>
        </div>
      </div>

      {/* טבלת לקוחות */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-50">
              <th className="border p-2 text-right">שם</th>
              <th className="border p-2 text-right">טלפון</th>
              <th className="border p-2 text-right">עיר</th>
              <th className="border p-2 text-right">הערה</th>
              <th className="border p-2 text-right">נוצר</th>
              <th className="border p-2 text-right">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="border p-2" colSpan={6}>אין לקוחות עדיין.</td></tr>
            ) : rows.map((c) => {
              const e = editing[c.id];
              return (
                <tr key={c.id}>
                  <td className="border p-2">
                    {e ? <input className="border p-1 w-full" value={e.name as string} onChange={(ev)=>setEditing((st)=>({...st, [c.id]:{...st[c.id], name: ev.target.value}}))} />
                        : c.name}
                  </td>
                  <td className="border p-2">
                    {e ? <input className="border p-1 w-full" value={(e.phone as string) ?? ""} onChange={(ev)=>setEditing((st)=>({...st, [c.id]:{...st[c.id], phone: ev.target.value}}))} />
                        : (c.phone || "-")}
                  </td>
                  <td className="border p-2">
                    {e ? <input className="border p-1 w-full" value={(e.city as string) ?? ""} onChange={(ev)=>setEditing((st)=>({...st, [c.id]:{...st[c.id], city: ev.target.value}}))} />
                        : (c.city || "-")}
                  </td>
                  <td className="border p-2">
                    {e ? <input className="border p-1 w-full" value={(e.note as string) ?? ""} onChange={(ev)=>setEditing((st)=>({...st, [c.id]:{...st[c.id], note: ev.target.value}}))} />
                        : (c.note || "-")}
                  </td>
                  <td className="border p-2">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="border p-2">
                    {e ? (
                      <>
                        <button className="border px-2 py-1 mr-2 bg-gray-100 hover:bg-gray-200" onClick={()=>saveEdit(c.id)}>שמור</button>
                        <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200" onClick={()=>cancelEdit(c.id)}>בטל</button>
                      </>
                    ) : (
                      <>
                        <button className="border px-2 py-1 mr-2 bg-gray-100 hover:bg-gray-200" onClick={()=>startEdit(c)}>ערוך</button>
                        <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200" onClick={()=>remove(c.id)}>מחק</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}