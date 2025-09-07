"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Lot = {
  id: string;
  slaughter_company: string | null;
  qty_kg: number;
  slaughter_date: string | null;
  expiry_date: string | null;
  expected_yield_pct: number | null;
  finished: boolean | null;
};

type LogRow = {
  id: string;
  proc_date: string;
  output_net_kg: number;
  note: string | null;
};

export default function ProductionLotsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [currentLot, setCurrentLot] = useState<Lot | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const [lotSlaughter, setLotSlaughter] = useState<string>("");
  const [lotExpiry, setLotExpiry] = useState<string>("");

  const [formDate, setFormDate] = useState<string>("");
  const [formNet, setFormNet] = useState<string>("");
  const [formNote, setFormNote] = useState<string>("");

  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [finishing, setFinishing] = useState<boolean>(false);

  const canEdit = role === "production_manager" || role === "factory_manager";

  const expectedNet = useMemo(() => {
    if (!currentLot) return 0;
    const pct = (currentLot.expected_yield_pct ?? 64) / 100;
    return (currentLot.qty_kg || 0) * pct;
  }, [currentLot]);

  const actualNetSum = useMemo(
    () => logs.reduce((s, r) => s + Number(r.output_net_kg || 0), 0),
    [logs]
  );

  const shortage = useMemo(() => Math.max(0, Number((expectedNet - actualNetSum).toFixed(2))), [expectedNet, actualNetSum]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      
const { data: myRole, error: roleErr } = await supabase.rpc("get_my_role");
if (roleErr) {
  console.error(roleErr);
  setRole(null); // أو "employee" مؤقتاً
} else {
  setRole(myRole || "employee");
}
      const { data: openLots } = await supabase
        .from("raw_receipt_lines")
        .select("id, slaughter_company, qty_kg, slaughter_date, expiry_date, expected_yield_pct, finished")
        .eq("finished", false)
        .order("created_at", { ascending: false });

      setLots((openLots as Lot[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedLotId) { setCurrentLot(null); setLogs([]); return; }
    (async () => {
      setMsg("");
      const { data: lot } = await supabase
        .from("raw_receipt_lines")
        .select("id, slaughter_company, qty_kg, slaughter_date, expiry_date, expected_yield_pct, finished")
        .eq("id", selectedLotId).single();
      setCurrentLot(lot as Lot);

      setLotSlaughter((lot as any)?.slaughter_date ?? "");
      setLotExpiry((lot as any)?.expiry_date ?? "");

      const { data: lgs } = await supabase
        .from("lot_process_logs")
        .select("id, proc_date, output_net_kg, note")
        .eq("receipt_line_id", selectedLotId)
        .order("proc_date", { ascending: true });
      setLogs((lgs as LogRow[]) || []);
    })();
  }, [selectedLotId]);

  const saveLotDates = async () => {
    if (!canEdit || !currentLot) return;
    const { error } = await supabase
      .from("raw_receipt_lines")
      .update({ slaughter_date: lotSlaughter || null, expiry_date: lotExpiry || null })
      .eq("id", currentLot.id);
    if (error) setMsg("❌ فشل حفظ التواريخ"); else setMsg("✅ تم حفظ التواريخ");
  };

  const addDailyLog = async () => {
    setMsg("");
    if (!canEdit) return setMsg("❌ ليس لديك صلاحية الإضافة");
    if (!currentLot) return setMsg("❌ اختر لوط أولًا");
    const d = formDate || new Date().toISOString().slice(0, 10);
    const net = Number(formNet);
    if (!net) return setMsg("⚠️ أدخل الصافي (كغ)");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setMsg("❌ الجلسة منتهية");

      const { error } = await supabase.from("lot_process_logs").insert({
        receipt_line_id: currentLot.id,
        proc_date: d,
        output_net_kg: net,
        note: formNote || null,
        created_by: user.id
      });
      if (error) { console.error(error); return setMsg("❌ خطأ: " + error.message); }

      const { data: lgs } = await supabase
        .from("lot_process_logs")
        .select("id, proc_date, output_net_kg, note")
        .eq("receipt_line_id", currentLot.id)
        .order("proc_date", { ascending: true });
      setLogs((lgs as LogRow[]) || []);
      setMsg("✅ تمت الإضافة");
      setFormDate(""); setFormNet(""); setFormNote("");
    } finally {
      setSaving(false);
    }
  };

  const finishLot = async () => {
    if (!canEdit || !currentLot) return;
    setFinishing(true);
    try {
      const { error } = await supabase.from("raw_receipt_lines").update({ finished: true }).eq("id", currentLot.id);
      if (error) { console.error(error); setMsg("❌ فشل إنهاء اللوط"); return; }
      setMsg("✅ تم إنهاء اللوط");
      setLots(prev => prev.filter(l => l.id !== currentLot.id));
      setSelectedLotId(null); setCurrentLot(null); setLogs([]);
    } finally { setFinishing(false); }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 980, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>🏭 يوميات الإنتاج</h1>

      {/* اختيار اللوط */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <label>اختر لوط مفتوح</label>
        <select value={selectedLotId ?? ""} onChange={(e)=>setSelectedLotId(e.target.value || null)} className="border p-2 w-full mt-1">
          <option value="">— اختر —</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>
              {l.slaughter_company || "بدون اسم"} — بروتو: {l.qty_kg} كغ
            </option>
          ))}
        </select>
        {!lots.length && <div style={{ marginTop: 8, color: "#666" }}>لا توجد لوطات مفتوحة.</div>}
      </div>

      {currentLot && (
        <>
          {/* تفاصيل اللوط */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>تفاصيل اللوط</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <div><div>شركة الذبح:</div><b>{currentLot.slaughter_company || "-"}</b></div>
              <div><div>البروتو (كغ):</div><b>{currentLot.qty_kg}</b></div>
              <div><div>نسبة متوقعة:</div><b>{currentLot.expected_yield_pct ?? 64}%</b></div>
              <div><div>الحالة:</div><b>{currentLot.finished ? "منتهٍ" : "مفتوح"}</b></div>
            </div>

            <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <div>
                <label>تاريخ الذبح</label>
                <input type="date" className="border p-2 w-full" value={lotSlaughter || ""} onChange={(e)=>setLotSlaughter(e.target.value)} />
              </div>
              <div>
                <label>تاريخ الانتهاء</label>
                <input type="date" className="border p-2 w-full" value={lotExpiry || ""} onChange={(e)=>setLotExpiry(e.target.value)} />
              </div>
              <div style={{ alignSelf: "end" }}>
                <button onClick={saveLotDates} disabled={!canEdit} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">حفظ التواريخ</button>
              </div>
              <div style={{ alignSelf: "end" }}>
                <button onClick={finishLot} disabled={!canEdit || finishing} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                  {finishing ? "جارٍ الإنهاء…" : "إنهاء اللوط"}
                </button>
              </div>
            </div>
          </div>

          {/* بطاقة حساب 64% */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>حساب 64% (للإدارة)</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div>متوقّع: <b>{expectedNet.toFixed(2)} كغ</b></div>
              <div>صافي فعلي: <b>{actualNetSum.toFixed(2)} كغ</b></div>
              <div>العجز: <b style={{ color: shortage > 0 ? "crimson" : "green" }}>{shortage.toFixed(2)} كغ</b></div>
            </div>
          </div>

          {/* إضافة يومية (بدون كمية مفكوكة) */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>إضافة تشغيل يومي</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 2fr" }}>
              <div>
                <label>التاريخ</label>
                <input type="date" className="border p-2 w-full" value={formDate} onChange={(e)=>setFormDate(e.target.value)} />
              </div>
              <div>
                <label>الصافي (كغ) *</label>
                <input type="number" className="border p-2 w-full" value={formNet} onChange={(e)=>setFormNet(e.target.value)} />
              </div>
              <div>
                <label>ملاحظة</label>
                <input className="border p-2 w-full" value={formNote} onChange={(e)=>setFormNote(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={addDailyLog} disabled={!canEdit || saving} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                {saving ? "جارٍ الحفظ…" : "إضافة"}
              </button>
            </div>
            <div style={{ marginTop: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>{msg}</div>
          </div>

          {/* جدول اليوميات */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>تفاصيل الأيام لهذا اللوط</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-right">التاريخ</th>
                    <th className="border p-2 text-right">الصافي (كغ)</th>
                    <th className="border p-2 text-right">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (<tr><td className="border p-2" colSpan={3}>لا يوجد تشغيل لهذا اللوط بعد.</td></tr>)}
                  {logs.map(r => (
                    <tr key={r.id}>
                      <td className="border p-2">{r.proc_date}</td>
                      <td className="border p-2">{r.output_net_kg}</td>
                      <td className="border p-2">{r.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}