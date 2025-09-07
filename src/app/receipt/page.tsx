"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  supplier: string | null;
  shipment_number: string | null;
  qty_kg: number | null;
  temp_c: number | null;
  slaughter_date: string | null;
  expiry_date: string | null;
  created_at: string;
};

export default function ReceiptsPage() {
  const [supplier, setSupplier] = useState("");
  const [shipment, setShipment] = useState("");
  const [qty, setQty] = useState<string>("");
  const [temp, setTemp] = useState<string>("");
  const [slaughterDate, setSlaughterDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const { data, error } = await supabase
      .from("raw_receipt_lines")
      .select("id,supplier,shipment_number,qty_kg,temp_c,slaughter_date,expiry_date,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setMsg("❌ فشل التحميل: " + error.message);
      return;
    }
    setRows((data as Row[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setMsg("");
    if (!supplier.trim() || !shipment.trim() || !qty) {
      setMsg("⚠️ الحقول المطلوبة: المورد، رقم الإرسالية، الكمية (كغ)");
      return;
    }

    const payload = {
      supplier: supplier.trim(),
      shipment_number: shipment.trim(),
      qty_kg: Number(qty),
      temp_c: temp ? Number(temp) : null,
      slaughter_date: slaughterDate || null,
      expiry_date: expiryDate || null,
      finished: false,
    };

    const { error } = await supabase.from("raw_receipt_lines").insert(payload);

    if (error) {
      setMsg("❌ فشل الحفظ: " + error.message);
      return;
    }

    setMsg("✅ تم الحفظ");
    setSupplier("");
    setShipment("");
    setQty("");
    setTemp("");
    setSlaughterDate("");
    setExpiryDate("");
    load();
  };

  return (
    <div style={{ maxWidth: 1000, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 10 }}>📦 قيود/استلام لحم</h1>

      {msg && (
        <div style={{ marginBottom: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>
          {msg}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div>
            <label>المورد *</label>
            <input className="border p-2 w-full" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>

          <div>
            <label>رقم الإرسالية *</label>
            <input className="border p-2 w-full" value={shipment} onChange={(e) => setShipment(e.target.value)} />
          </div>

          <div>
            <label>الكمية (كغ) *</label>
            <input type="number" className="border p-2 w-full" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div>
            <label>الحرارة (°C)</label>
            <input type="number" className="border p-2 w-full" value={temp} onChange={(e) => setTemp(e.target.value)} />
          </div>

          <div>
            <label>تاريخ الذبح</label>
            <input type="date" className="border p-2 w-full" value={slaughterDate} onChange={(e) => setSlaughterDate(e.target.value)} />
          </div>

          <div>
            <label>تاريخ الانتهاء</label>
            <input type="date" className="border p-2 w-full" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-3">
          <button className="border px-3 py-2 bg-gray-100 hover:bg-gray-200" onClick={save}>حفظ</button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>آخر القيود</h3>
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-50">
              <th className="border p-2">الإنشاء</th>
              <th className="border p-2">المورد</th>
              <th className="border p-2">رقم الإرسالية</th>
              <th className="border p-2">الوزن (كغ)</th>
              <th className="border p-2">الحرارة</th>
              <th className="border p-2">تاريخ الذبح</th>
              <th className="border p-2">تاريخ الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="border p-2 text-center">لا توجد بيانات</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="border p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="border p-2">{r.supplier || "-"}</td>
                <td className="border p-2">{r.shipment_number || "-"}</td>
                <td className="border p-2">{r.qty_kg ?? "-"}</td>
                <td className="border p-2">{r.temp_c ?? "-"}</td>
                <td className="border p-2">{r.slaughter_date || "-"}</td>
                <td className="border p-2">{r.expiry_date || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}