"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type LotRow = {
  id: string;
  created_at: string;
  slaughter_company: string | null;
  qty_kg: number;
  expected_yield_pct: number | null;
  finished: boolean | null;
  // من الاستعلام المجمّع
  actual_net_sum: number | null;
}

export default function ReportsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [showFinished, setShowFinished] = useState<"all"|"open"|"finished">("all");
  const [rows, setRows] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string>("");

  // تحميل الدور ثم البيانات
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();

      const r = profile?.role ?? "employee";
      setRole(r);
      if (r !== "factory_manager") {
        // فقط المدير العام يسمح له برؤية التقارير
        window.location.href = "/dashboard";
        return;
      }

      await loadData();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setMsg("");
    // نبني شروط التاريخ
    const filters: any[] = [];
    if (fromDate) filters.push({ col: "created_at", op: ">=", val: fromDate });
    if (toDate)   filters.push({ col: "created_at", op: "<",  val: toDate + " 23:59:59" });

    // نجلب اللوطات مع مجموع الصافي من lot_process_logs
    let q = supabase
      .from("raw_receipt_lines")
      .select(`
        id,
        created_at,
        slaughter_company,
        qty_kg,
        expected_yield_pct,
        finished,
        lot_process_logs ( output_net_kg )
      `)
      .order("created_at", { ascending: false });

    // تطبيق الفلاتر
    if (showFinished === "open")   q = q.eq("finished", false);
    if (showFinished === "finished") q = q.eq("finished", true);

    // تطبيق فلاتر التاريخ
    for (const f of filters) {
      q = (q as any).gte && f.op === ">=" ? (q as any).gte(f.col, f.val)
        : (q as any).lte && f.op === "<=" ? (q as any).lte(f.col, f.val)
        : (q as any).lt  && f.op === "<"  ? (q as any).lt(f.col, f.val)
        : (q as any).gte ? (q as any).gte(f.col, f.val)
        : q;
    }

    const { data, error } = await q;
    if (error) { console.error(error); setMsg("❌ فشل تحميل البيانات"); return; }

    // نحسب مجموع الصافي لكل لوط
    const mapped: LotRow[] = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      slaughter_company: r.slaughter_company,
      qty_kg: r.qty_kg,
      expected_yield_pct: r.expected_yield_pct ?? 64,
      finished: r.finished,
      actual_net_sum: (r.lot_process_logs || []).reduce(
        (sum: number, x: any) => sum + Number(x.output_net_kg || 0), 0
      ),
    }));

    setRows(mapped);
  };

  const grand = useMemo(() => {
    const totals = rows.reduce((acc, r) => {
      const exp = (r.qty_kg || 0) * ((r.expected_yield_pct ?? 64) / 100);
      const act = r.actual_net_sum || 0;
      const sh  = Math.max(0, exp - act);
      acc.expected += exp;
      acc.actual   += act;
      acc.shortage += sh;
      return acc;
    }, { expected: 0, actual: 0, shortage: 0 });
    return {
      expected: Number(totals.expected.toFixed(2)),
      actual:   Number(totals.actual.toFixed(2)),
      shortage: Number(totals.shortage.toFixed(2)),
    };
  }, [rows]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>📊 تقارير اللوطات</h1>

      {/* فلاتر */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
          <div>
            <label>من تاريخ</label>
            <input type="date" className="border p-2 w-full" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
          </div>
          <div>
            <label>إلى تاريخ</label>
            <input type="date" className="border p-2 w-full" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
          </div>
          <div>
            <label>الحالة</label>
            <select className="border p-2 w-full" value={showFinished} onChange={(e)=>setShowFinished(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="open">مفتوحة فقط</option>
              <option value="finished">منتهية فقط</option>
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <button onClick={loadData} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200">تطبيق الفلاتر</button>
          </div>
          <div style={{ alignSelf: "end", color: msg.startsWith("❌") ? "crimson" : "#444" }}>
            {msg}
          </div>
        </div>
      </div>

      {/* المجاميع */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>إجماليات</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div>المتوقّع الكلي (64%): <b>{grand.expected} كغ</b></div>
          <div>الصافي الكلي: <b>{grand.actual} كغ</b></div>
          <div>العجز الكلي: <b style={{ color: grand.shortage > 0 ? "crimson" : "green" }}>{grand.shortage} كغ</b></div>
        </div>
      </div>

      {/* جدول */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>تفصيل اللوطات</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-right">التاريخ</th>
                <th className="border p-2 text-right">شركة الذبح</th>
                <th className="border p-2 text-right">البروتو (كغ)</th>
                <th className="border p-2 text-right">متوقّع 64% (كغ)</th>
                <th className="border p-2 text-right">صافي فعلي (كغ)</th>
                <th className="border p-2 text-right">العجز (كغ)</th>
                <th className="border p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td className="border p-2" colSpan={7}>لا توجد بيانات</td></tr>
              )}
              {rows.map((r) => {
                const expected = (r.qty_kg || 0) * ((r.expected_yield_pct ?? 64) / 100);
                const actual   = r.actual_net_sum || 0;
                const shortage = Math.max(0, expected - actual);
                return (
                  <tr key={r.id}>
                    <td className="border p-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="border p-2">{r.slaughter_company || "-"}</td>
                    <td className="border p-2">{r.qty_kg}</td>
                    <td className="border p-2">{expected.toFixed(2)}</td>
                    <td className="border p-2">{actual.toFixed(2)}</td>
                    <td className="border p-2" style={{ color: shortage > 0 ? "crimson" : "green" }}>
                      {shortage.toFixed(2)}
                    </td>
                    <td className="border p-2">{r.finished ? "منتهٍ" : "مفتوح"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        ملاحظة: تحتاج سياسات SELECT على الجدولين raw_receipt_lines و lot_process_logs (سبق أضفناها).
      </div>
    </div>
  );
}