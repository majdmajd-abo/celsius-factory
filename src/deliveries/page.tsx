"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Delivery = {
  id: string;
  order_no: string | null;
  customer_name: string | null;
  delivery_date: string | null;
  photo_url: string | null;
  signed_at: string | null;
  created_at: string;
};

export default function DeliveriesPage() {
  const [orderNo, setOrderNo] = useState("");
  const [customer, setCustomer] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<Delivery[]>([]);
  const [saving, setSaving] = useState(false);

  const loadRows = async () => {
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, order_no, customer_name, delivery_date, photo_url, signed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setRows((data as Delivery[]) || []);
  };

  useEffect(() => { loadRows(); }, []);

  const save = async () => {
    setMsg("");
    if (!orderNo.trim() || !customer.trim() || !date.trim() || !file)
      return setMsg("⚠️ رقم الإرسالية والعميل والتاريخ والصورة مطلوبة");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setMsg("❌ يلزم تسجيل الدخول");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}-${orderNo}.${ext}`;

      // رفع الصورة إلى bucket proofs
      const { error: upErr } = await supabase.storage.from("proofs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) { console.error(upErr); return setMsg("❌ فشل رفع الصورة"); }

      // لنفترض أن البكت Public: نستخرج رابط عام
      const { data: pub } = supabase.storage.from("proofs").getPublicUrl(path);
      const photoUrl = pub?.publicUrl || null;

      const { error: insErr } = await supabase.from("deliveries").insert({
        order_no: orderNo.trim(),
        customer_name: customer.trim(),
        delivery_date: date,
        photo_url: photoUrl,
        signed_at: new Date().toISOString(),
        created_by: user.id,
      });
      if (insErr) { console.error(insErr); return setMsg("❌ فشل حفظ السجل"); }

      setMsg("✅ تم الحفظ");
      setOrderNo(""); setCustomer(""); setDate(""); setFile(null);
      await loadRows();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>🚚 إثباتات التسليم</h1>

      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div>
            <label>رقم الإرسالية *</label>
            <input className="border p-2 w-full" value={orderNo} onChange={(e)=>setOrderNo(e.target.value)} />
          </div>
          <div>
            <label>اسم العميل *</label>
            <input className="border p-2 w-full" value={customer} onChange={(e)=>setCustomer(e.target.value)} />
          </div>
          <div>
            <label>تاريخ التسليم *</label>
            <input type="date" className="border p-2 w-full" value={date} onChange={(e)=>setDate(e.target.value)} />
          </div>
          <div>
            <label>صورة التوقيع/الاستلام *</label>
            <input type="file" accept="image/*" className="border p-2 w-full"
                   onChange={(e)=>setFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={save} disabled={saving} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>

        <div style={{ marginTop: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>{msg}</div>
      </div>

      {/* آخر التسليمات */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>آخر 20 تسليم</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {rows.map((r) => (
            <div key={r.id} className="border rounded p-3">
              <div><b>إرسالية:</b> {r.order_no || "-"}</div>
              <div><b>عميل:</b> {r.customer_name || "-"}</div>
              <div><b>تاريخ:</b> {r.delivery_date || "-"}</div>
              {r.photo_url && (
                <div style={{ marginTop: 8 }}>
                  <img src={r.photo_url} alt="proof" style={{ maxWidth: "100%", borderRadius: 8 }} />
                </div>
              )}
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                محفوظ: {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))}
          {rows.length === 0 && <div>لا توجد بيانات</div>}
        </div>
      </div>
    </div>
  );
}