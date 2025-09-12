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
  const [orderNo, setOrderNo]   = useState<string>("");
  const [customer, setCustomer] = useState<string>("");
  const [date, setDate]         = useState<string>("");
  const [file, setFile]         = useState<File | null>(null);

  const [rows, setRows]   = useState<Delivery[]>([]);
  const [msg, setMsg]     = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  async function loadRows() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, order_no, customer_name, delivery_date, photo_url, signed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setRows([]);
      setMsg("❌ שגיאה בטעינת הנתונים: " + error.message);
    } else {
      setRows((data as Delivery[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => { void loadRows(); }, []);

  async function save() {
    setMsg("");

    if (!orderNo.trim() || !customer.trim() || !date.trim() || !file) {
      setMsg("⚠️ שדות חובה: מס׳ משלוח, לקוח, תאריך ותמונה");
      return;
    }

    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) {
        setMsg("❌ יש להתחבר למערכת");
        return;
      }

      // נתיב לקובץ בבאקט
      const ext  = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${orderNo}.${ext}`;

      // העלאה ל-bucket בשם "proofs"
      const { error: upErr } = await supabase.storage.from("proofs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) {
        setMsg("❌ כשל בהעלאת התמונה: " + upErr.message);
        return;
      }

      // קבלת קישור ציבורי (בהנחה שה-bucket ציבורי)
      const pub = supabase.storage.from("proofs").getPublicUrl(path);
      const photoUrl = pub?.data?.publicUrl ?? null;

      // הכנסת רשומה
      const { error: insErr } = await supabase.from("deliveries").insert({
        order_no: orderNo.trim(),
        customer_name: customer.trim(),
        delivery_date: date,
        photo_url: photoUrl,
        signed_at: new Date().toISOString(),
        created_by: userId,
      });

      if (insErr) {
        setMsg("❌ שמירת הרשומה נכשלה: " + insErr.message);
        return;
      }

      setMsg("✅ נשמר בהצלחה");
      setOrderNo(""); setCustomer(""); setDate(""); setFile(null);
      await loadRows();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg("❌ שגיאה בלתי צפויה: " + m);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 12, direction: "rtl" }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>🚚 הוכחות מסירה</h1>

      {/* טופס הוספה */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div>
            <label>מס׳ משלוח *</label>
            <input className="border p-2 w-full" value={orderNo} onChange={(e)=>setOrderNo(e.target.value)} />
          </div>
          <div>
            <label>שם לקוח *</label>
            <input className="border p-2 w-full" value={customer} onChange={(e)=>setCustomer(e.target.value)} />
          </div>
          <div>
            <label>תאריך מסירה *</label>
            <input type="date" className="border p-2 w-full" value={date} onChange={(e)=>setDate(e.target.value)} />
          </div>
          <div>
            <label>תמונת חתימה/מסירה *</label>
            <input
              type="file"
              accept="image/*"
              className="border p-2 w-full"
              onChange={(e)=>setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמור"}
          </button>
        </div>

        {msg && (
          <div style={{ marginTop: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>
            {msg}
          </div>
        )}
      </div>

      {/* רשימת אחרונים */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>אחרוני המסירות (20)</h2>

        {loading ? (
          <div>טוען…</div>
        ) : rows.length === 0 ? (
          <div>אין נתונים להצגה</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {rows.map((r) => (
              <div key={r.id} className="border rounded p-3">
                <div><b>משלוח:</b> {r.order_no || "-"}</div>
                <div><b>לקוח:</b> {r.customer_name || "-"}</div>
                <div><b>תאריך:</b> {r.delivery_date || "-"}</div>

                {r.photo_url && (
                  <div style={{ marginTop: 8 }}>
                    {/* אזהרת Next על <img> היא רק Warning, לא שגיאה */}
                    <img src={r.photo_url} alt="proof" style={{ maxWidth: "100%", borderRadius: 8 }} />
                  </div>
                )}

                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  נשמר: {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}