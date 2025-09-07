"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
};

export default function NewOrderPage() {
  // بيانات العملاء
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  // حقول الطلب
  const [customerName, setCustomerName] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [sex, setSex] = useState("זכר"); // male/female (نكتبها ضمن product_type)
  const [form, setForm] = useState("שלם"); // whole/cut   (نكتبها ضمن product_type)
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  // تحميل العملاء
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, city")
        .order("created_at", { ascending: false });
      if (!error && data) setCustomers(data as Customer[]);
    })();
  }, []);

  // فلترة بسيطة بالاسم/الهاتف/المدينة
  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const s = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.phone || "").toLowerCase().includes(s) ||
        (c.city || "").toLowerCase().includes(s)
    );
  }, [customers, search]);

  // عند اختيار عميل من القائمة نملأ حقل الاسم
  useEffect(() => {
    if (!selectedId) return;
    const c = customers.find((x) => x.id === selectedId);
    if (c) setCustomerName(c.name);
  }, [selectedId, customers]);

  const save = async () => {
    setMsg("");
    if (!customerName || !pricePerKg || !qtyKg) {
      setMsg("⚠️ חובה למלא: לקוח, מחיר, כמות");
      return;
    }

    const productType = `${sex}/${form}`;

    const { error } = await supabase.from("orders").insert({
      customer_name: customerName,
      product_type: productType,
      qty_kg: Number(qtyKg),
      price_per_kg: Number(pricePerKg),
      note: note || null,
    });

    if (error) {
      setMsg("❌ שגיאה: " + error.message);
      return;
    }

    setMsg("✅ ההזמנה נשמרה בהצלחה");
    setSelectedId("");
    setCustomerName("");
    setPricePerKg("");
    setQtyKg("");
    setSex("זכר");
    setForm("שלם");
    setNote("");
  };

  return (
    <div style={{ maxWidth: 720, margin: "20px auto" }}>
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>➕ יצירת הזמנה חדשה</h2>

      {msg && (
        <div style={{ margin: "10px 0", color: msg.startsWith("✅") ? "green" : "crimson" }}>
          {msg}
        </div>
      )}

      {/* اختيار عميل من القائمة */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <b>בחירת לקוח:</b>
          <Link href="/customers" className="border px-2 py-1 bg-gray-100 hover:bg-gray-200">
            ניהול לקוחות
          </Link>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input
            className="border p-2"
            placeholder="חיפוש (שם/טלפון/עיר)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border p-2"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— בחר לקוח —</option>
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.city ? `• ${c.city}` : ""} {c.phone ? `• ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
          ניתן גם לכתוב שם חופשי בשדה למטה – לא חובה לבחור מהרשימה.
        </div>
      </div>

      {/* تفاصيل الطلب */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3">
          <label>לקוח (אפשר לערוך ידנית):</label>
          <input
            className="border p-2 w-full"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="שם לקוח"
          />
        </div>

        <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>מחיר לק״ג (₪):</label>
            <input
              type="number"
              className="border p-2 w-full"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
            />
          </div>
          <div>
            <label>כמות (ק״ג):</label>
            <input
              type="number"
              className="border p-2 w-full"
              value={qtyKg}
              onChange={(e) => setQtyKg(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>סוג סחורה:</label>
            <select className="border p-2 w-full" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option>זכר</option>
              <option>נקבה</option>
            </select>
          </div>
          <div>
            <label>חתוך / שלם:</label>
            <select className="border p-2 w-full" value={form} onChange={(e) => setForm(e.target.value)}>
              <option>שלם</option>
              <option>חתוך</option>
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label>הערה:</label>
          <textarea
            className="border p-2 w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button onClick={save} className="bg-blue-500 text-white px-4 py-2 rounded">
          שמור הזמנה
        </button>
      </div>
    </div>
  );
}