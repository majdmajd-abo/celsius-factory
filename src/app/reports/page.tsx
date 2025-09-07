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
  lot_process_logs: { output_net_kg: number }[] | null;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // فلاتر
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "finished">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      // تأكد من تسجيل الدخول
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      await loadData();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setMsg("");

    let q = supabase
      .from("raw_receipt_lines")
      .select(
        `
        id,
        created_at,
        slaughter_company,
        qty_kg,
        expected_yield_pct,
        finished,
        lot_process_logs ( output_net_kg )
      `
      )
      .order("created_at", { ascending: false });

    // الحالة
    if (status === "open") q = q.eq("finished", false);
    if (status === "finished") q = q.eq("finished", true);

    // التاريخ
    if (fromDate) q = (q as any).gte("created_at", fromDate);
    if (toDate) q = (q as any).lte("created_at", toDate + " 23:59:59");

    const { data, error } = await q;
    if (error) {
      console.error(error);
      setMsg("❌ فشل تحميل البيانات");
      return;
    }

    setRows((data as LotRow[]) || []);
  };

  // إجماليات عامة
  const grand = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const pct = (r.expected_yield_pct ?? 64) / 100;
        const expected = (r.qty_kg || 0) * pct;
        const actual =
          (r.lot_process_logs || []).reduce(
            (s, x) => s + Number(x.output_net_kg || 0),
            0
          ) || 0;
        const shortage = Math.max(0, expected - actual);
        acc.expected += expected;
        acc.actual += actual;
        acc.shortage += shortage;
        return acc;
      },
      { expected: 0, actual: 0, shortage: 0 }
    );
  }, [rows]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>
        📊 تقارير اللوطات
      </h1>

      {/* فلاتر + تصدير */}
<div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
  <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
    {/* ... نفس الحقول السابقة من/إلى/الحالة ... */}
    <div style={{ alignSelf: "end" }}>
      <button onClick={loadData} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200">تطبيق الفلاتر</button>
    </div>
    <div style={{ alignSelf: "end" }}>
      <button
        onClick={() => {
          const headers = ["التاريخ","شركة الذبح","البروتو","متوقع 64%","الصافي","العجز","الحالة"];
          const lines = rows.map(r => {
            const expected = (r.qty_kg || 0) * ((r.expected_yield_pct ?? 64) / 100);
            const actual = (r.lot_process_logs || []).reduce((s, x) => s + Number(x.output_net_kg || 0), 0);
            const shortage = Math.max(0, expected - actual);
            return [
              new Date(r.created_at).toLocaleString(),
              (r.slaughter_company || "-"),
              (r.qty_kg ?? 0),
              expected.toFixed(2),
              actual.toFixed(2),
              shortage.toFixed(2),
              (r.finished ? "منتهٍ" : "مفتوح")
            ].join(",");
          });
          const csv = [headers.join(","), ...lines].join("\n");
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `reports_${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="border px-4 py-2 bg-gray-100 hover:bg-gray-200"
      >
        ⬇️ تصدير CSV
      </button>
    </div>
    <div style={{ alignSelf: "end", color: "#c00" }}>{msg}</div>
  </div>
</div>

      {/* إجماليات */}
      <div
        className="rounded-2xl border bg-white p-4 shadow-sm"
        style={{ marginBottom: 16 }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: 8 }}>إجماليات</h3>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
        >
          <div>
            المتوقّع (64%):{" "}
            <b>{grand.expected.toFixed(2)} كغ</b>
          </div>
          <div>
            الصافي الفعلي:{" "}
            <b>{grand.actual.toFixed(2)} كغ</b>
          </div>
          <div>
            العجز:{" "}
            <b
              style={{ color: grand.shortage > 0 ? "crimson" : "green" }}
            >
              {grand.shortage.toFixed(2)} كغ
            </b>
          </div>
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
                <tr>
                  <td className="border p-2" colSpan={7}>
                    لا توجد بيانات
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const expected =
                  (r.qty_kg || 0) * ((r.expected_yield_pct ?? 64) / 100);
                const actual =
                  (r.lot_process_logs || []).reduce(
                    (s, x) => s + Number(x.output_net_kg || 0),
                    0
                  ) || 0;
                const shortage = Math.max(0, expected - actual);

                return (
                  <tr key={r.id}>
                    <td className="border p-2">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="border p-2">
                      {r.slaughter_company || "-"}
                    </td>
                    <td className="border p-2">{r.qty_kg}</td>
                    <td className="border p-2">{expected.toFixed(2)}</td>
                    <td className="border p-2">{actual.toFixed(2)}</td>
                    <td
                      className="border p-2"
                      style={{ color: shortage > 0 ? "crimson" : "green" }}
                    >
                      {shortage.toFixed(2)}
                    </td>
                    <td className="border p-2">
                      {r.finished ? "منتهٍ" : "مفتوح"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        ملاحظة: هذه الصفحة تعتمد على وجود سياسات SELECT على
        <code> raw_receipt_lines </code> و
        <code> lot_process_logs </code>.
      </div>
    </div>
  );
}