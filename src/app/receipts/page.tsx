"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type LineRow = {
  id: string;
  supplier: string | null;
  shipment_number: string | null;
  qty_kg: number | null;
  temp_c: number | null;
  slaughter_date: string | null; // YYYY-MM-DD
  expiry_date: string | null;    // YYYY-MM-DD
  expected_yield_pct: number | null;
  finished: boolean | null;
  created_at: string;

  male_qty_kg: number | null;
  female_qty_kg: number | null;
  male_unit_cost_per_kg: number | null;
  female_unit_cost_per_kg: number | null;
};

/** טיפוס להכנסה לטבלת raw_receipt_lines (בלי id/created_at) */
type InsertPayload = {
  supplier: string | null;
  shipment_number: string | null;
  qty_kg: number | null;
  temp_c: number | null;
  slaughter_date: string | null;
  expiry_date: string | null;
  expected_yield_pct: number | null;
  finished: boolean | null;
  male_qty_kg: number | null;
  female_qty_kg: number | null;
  male_unit_cost_per_kg: number | null;
  female_unit_cost_per_kg: number | null;
};

export default function ReceiptsPage() {
  // form state
  const [supplier, setSupplier] = useState("");
  const [shipment, setShipment] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [tempC, setTempC] = useState("");
  const [slaughterDate, setSlaughterDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // جديد: ذكر/أنثى + أسعار
  const [maleQty, setMaleQty] = useState("");
  const [femaleQty, setFemaleQty] = useState("");
  const [malePrice, setMalePrice] = useState("");
  const [femalePrice, setFemalePrice] = useState("");

  // UI state
  const [rows, setRows] = useState<LineRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  // default dates
  useEffect(() => {
    const today = new Date();
    const y = today.toISOString().slice(0, 10);
    const after = new Date(today);
    after.setDate(after.getDate() + 9);
    const exp = after.toISOString().slice(0, 10);
    setSlaughterDate(y);
    setExpiryDate(exp);
    loadRecent();
  }, []);

  async function loadRecent() {
    setMsg("");
    const { data, error } = await supabase
      .from("raw_receipt_lines")
      .select(`
        id,supplier,shipment_number,qty_kg,temp_c,slaughter_date,expiry_date,expected_yield_pct,finished,created_at,
        male_qty_kg,female_qty_kg,male_unit_cost_per_kg,female_unit_cost_per_kg
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setMsg(`❌ خطأ بجلب السجلات: ${error.message}`);
      setRows([]);
      return;
    }
    setRows((data as LineRow[]) || []);
  }

  // مجموع تلقائي للمساعدة في الـ UI فقط
  const autoSum = (() => {
    const m = Number(maleQty || 0);
    const f = Number(femaleQty || 0);
    const s = m + f;
    return isFinite(s) ? s : 0;
  })();

  async function save() {
    setMsg("");

    // فحوصات بسيطة
    const m = Number(maleQty || 0);
    const f = Number(femaleQty || 0);
    if ((maleQty !== "" && !isFinite(m)) || (femaleQty !== "" && !isFinite(f))) {
      setMsg("⚠️ أدخل كميات صحيحة للذكر/الأنثى");
      return;
    }
    if ((malePrice !== "" && !isFinite(Number(malePrice))) || (femalePrice !== "" && !isFinite(Number(femalePrice)))) {
      setMsg("⚠️ أدخل سعر/كغ صحيح للذكر/الأنثى");
      return;
    }

    // payload עם טיפוס מפורש (בלי any)
    const payload: InsertPayload = {
      supplier: supplier.trim() || null,
      shipment_number: shipment.trim() || null,
      qty_kg: qtyKg === "" ? null : Number(qtyKg),
      temp_c: tempC === "" ? null : Number(tempC),
      slaughter_date: slaughterDate || null,
      expiry_date: expiryDate || null,
      expected_yield_pct: null,
      finished: false,
      male_qty_kg: maleQty === "" ? null : Number(maleQty),
      female_qty_kg: femaleQty === "" ? null : Number(femaleQty),
      male_unit_cost_per_kg: malePrice === "" ? null : Number(malePrice),
      female_unit_cost_per_kg: femalePrice === "" ? null : Number(femalePrice),
    };

    const { error } = await supabase.from("raw_receipt_lines").insert([payload]);

    if (error) {
      setMsg(`❌ فشل الحفظ: ${error.message}`);
      return;
    }

    setMsg("✅ تم الحفظ بنجاح");
    // ניקוי חלקי של הטופס
    setShipment("");
    setQtyKg("");
    setTempC("");
    setMaleQty("");
    setFemaleQty("");
    setMalePrice("");
    setFemalePrice("");
    await loadRecent();
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: "8px 12px", direction: "rtl" }}>
      <h3 style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span>📦</span>
        <span>قبولات/استلام لحم</span>
      </h3>

      {msg && (
        <div
          style={{
            margin: "10px 0 16px",
            padding: "10px 12px",
            borderRadius: 8,
            background: msg.startsWith("✅") ? "#eaffea" : "#ffecec",
            border: "1px solid",
            borderColor: msg.startsWith("✅") ? "#9bd59b" : "#ffb3b3",
          }}
        >
          {msg}
        </div>
      )}

      {/* فورم الإدخال */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <label style={{ fontSize: 12 }}>المورد *</label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="اسم المورد / اسم المسلخ"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12 }}>رقم الإرسالية *</label>
            <input
              value={shipment}
              onChange={(e) => setShipment(e.target.value)}
              placeholder="مثال: 233"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12 }}>الحرارة (°C)</label>
            <input
              value={tempC}
              onChange={(e) => setTempC(e.target.value)}
              inputMode="numeric"
              placeholder="2"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12 }}>إجمالي بروتو (كغ)</label>
            <input
              value={qtyKg}
              onChange={(e) => setQtyKg(e.target.value)}
              inputMode="numeric"
              placeholder={`اتركه فارغًا لحساب ${autoSum} تلقائيًا`}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12 }}>תאריך الذبح</label>
            <input
              type="date"
              value={slaughterDate}
              onChange={(e) => setSlaughterDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12 }}>תאריך الانتهاء</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* ذكر/أنثى + أسعار */}
          <div>
            <label style={{ fontSize: 12 }}>كمية الذكر (كغ)</label>
            <input
              value={maleQty}
              onChange={(e) => setMaleQty(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12 }}>كمية الأنثى (كغ)</label>
            <input
              value={femaleQty}
              onChange={(e) => setFemaleQty(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12 }}>سعر الذكر / كغ</label>
            <input
              value={malePrice}
              onChange={(e) => setMalePrice(e.target.value)}
              inputMode="numeric"
              placeholder="₪"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12 }}>سعر الأنثى / كغ</label>
            <input
              value={femalePrice}
              onChange={(e) => setFemalePrice(e.target.value)}
              inputMode="numeric"
              placeholder="₪"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 13, color: "#444" }}>
          الإجمالي (مساعد): <b>{autoSum.toFixed(2)} كغ</b> — إذا تركت “إجمالي بروتو” فارغًا، سيتم اعتماده تلقائيًا.
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={save} style={saveBtn}>
            💾 حفظ
          </button>
        </div>
      </div>

      {/* جدول آخر القيود */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ marginBottom: 8, fontWeight: 600 }}>آخر القيود</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>الحالة</Th>
                <Th>ת. الانتهاء</Th>
                <Th>ת. الذبح</Th>
                <Th>°C</Th>
                <Th>إجمالي بروتو</Th>
                <Th>ذكر (كغ)</Th>
                <Th>أنثى (كغ)</Th>
                <Th>سعر ذكر</Th>
                <Th>سعر أنثى</Th>
                <Th>رقم الإرسالية</Th>
                <Th>المورد</Th>
                <Th>الإنشاء</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: 12 }}>
                    لا توجد بيانات
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td style={{ textAlign: "center" }}>{r.finished ? "✅" : "⏳"}</Td>
                  <Td>{fmtDate(r.expiry_date)}</Td>
                  <Td>{fmtDate(r.slaughter_date)}</Td>
                  <Td>{r.temp_c ?? "-"}</Td>
                  <Td>{r.qty_kg ?? "-"}</Td>
                  <Td>{r.male_qty_kg ?? "-"}</Td>
                  <Td>{r.female_qty_kg ?? "-"}</Td>
                  <Td>{r.male_unit_cost_per_kg ?? "-"}</Td>
                  <Td>{r.female_unit_cost_per_kg ?? "-"}</Td>
                  <Td>{r.shipment_number ?? "-"}</Td>
                  <Td>{r.supplier ?? "-"}</Td>
                  <Td>{fmtDateTime(r.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========== helpers / styles ========== */

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return (d.length > 10 ? d.slice(0, 10) : d).replaceAll("-", "/");
}

function fmtDateTime(ts?: string | null) {
  if (!ts) return "-";
  try {
    const dt = new Date(ts);
    return dt.toLocaleString();
  } catch {
    return ts;
  }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 8,
  outline: "none",
};

const saveBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #ccc",
  background: "#f7f7f7",
  cursor: "pointer",
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "right",
        fontWeight: 600,
        fontSize: 13,
        padding: "8px 6px",
        borderBottom: "1px solid #eee",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        fontSize: 13,
        padding: "8px 6px",
        borderBottom: "1px solid #f2f2f2",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
