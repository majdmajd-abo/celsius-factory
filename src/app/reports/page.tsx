"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/** סוגי נתונים כפי שמוחזרים מה־VIEW v_receipts_enriched */
type Row = {
  line_id: string;
  supplier: string | null;
  slaughter_company: string | null;
  shipment_number: string | null;

  // כמויות
  gross_qty_kg: number | null;
  net_processed_kg: number | null;

  // ברוטו לפי מגדר
  male_gross_kg: number | null;
  female_gross_kg: number | null;

  // נטו מוערך לפי מגדר
  male_net_kg: number | null;
  female_net_kg: number | null;

  // תשואות (נטו/ברוטו) לפי מגדר
  male_yield_ratio: number | null;
  female_yield_ratio: number | null;

  // מחיר ק״ג עלות לפי מגדר
  male_cost_per_kg: number | null;
  female_cost_per_kg: number | null;

  created_at: string;
};

type Cust      = { id: string; name: string };
type OrderLite = { id: string; customer_id: string; qty_kg: number | null; created_at: string };
type ProfitRow = { ym: string; revenue: number; cost: number; profit: number };

export default function ReportsPage() {
  const [role, setRole] = useState<string | null>(null);

  const [rows, setRows]             = useState<Row[]>([]);
  const [customers, setCustomers]   = useState<Cust[]>([]);
  const [orders, setOrders]         = useState<OrderLite[]>([]);
  const [profit, setProfit]         = useState<ProfitRow[]>([]);
  const [q, setQ]                   = useState("");
  const [from, setFrom]             = useState("");
  const [to, setTo]                 = useState("");
  const [msg, setMsg]               = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
          setRole((prof?.role as string) || "employee");
        } else {
          setRole("employee");
        }
        await loadAll();
      } catch (e: any) {
        console.error("reports load error:", e?.message || e);
        setRole("employee");
        setMsg("❌ שגיאה בטעינת הדוחות: " + (e?.message || "Load failed"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function loadAll() {
    setMsg("");
    const gte = from ? new Date(from + "T00:00:00").toISOString() : null;
    const lte = to   ? new Date(to   + "T23:59:59.999").toISOString() : null;

    // קבלות מועשרות
    let rq = supabase
      .from("v_receipts_enriched")
      .select([
        "line_id","supplier","slaughter_company","shipment_number",
        "gross_qty_kg","net_processed_kg",
        "male_gross_kg","female_gross_kg",
        "male_net_kg","female_net_kg",
        "male_yield_ratio","female_yield_ratio",
        "male_cost_per_kg","female_cost_per_kg",
        "created_at"
      ].join(","))
      .order("created_at", { ascending: false });
    if (gte) rq = rq.gte("created_at", gte);
    if (lte) rq = rq.lte("created_at", lte);
    const { data: rdata, error: rerr } = await rq;
    if (rerr) throw rerr;
    setRows((rdata as Row[]) || []);

    // לקוחות (לגרפים)
    const { data: cdata, error: cerr } = await supabase.from("customers").select("id,name").order("name");
    if (cerr) throw cerr;
    setCustomers((cdata as Cust[]) || []);

    // הזמנות (לגרפים)
    let oq = supabase.from("orders").select("id,customer_id,qty_kg,created_at").order("created_at", { ascending: false });
    if (gte) oq = oq.gte("created_at", gte);
    if (lte) oq = oq.lte("created_at", lte);
    const { data: odata, error: oerr } = await oq;
    if (oerr) throw oerr;
    setOrders((odata as OrderLite[]) || []);

    // רווח חודשי
    const { data: pdata, error: perr } = await supabase.from("v_monthly_profit").select("*").order("ym", { ascending: true });
    if (perr) throw perr;
    setProfit((pdata as ProfitRow[]) || []);
  }

  // סינון טבלה
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      (r.supplier ?? "").toLowerCase().includes(term) ||
      (r.slaughter_company ?? "").toLowerCase().includes(term) ||
      (r.shipment_number ?? "").toLowerCase().includes(term)
    );
  }, [rows, q]);

  // סכומי עליון
  const summary = useMemo(() => {
    const gross = filtered.reduce((s, x) => s + Number(x.gross_qty_kg || 0), 0);
    const net   = filtered.reduce((s, x) => s + Number(x.net_processed_kg || 0), 0);
    return { gross: +gross.toFixed(2), net: +net.toFixed(2) };
  }, [filtered]);

  // גרף לקוחות: סה״כ ק״ג לפי לקוח
  const perCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const v = Number(o.qty_kg || 0);
      if (!v) continue;
      map.set(o.customer_id, (map.get(o.customer_id) || 0) + v);
    }
    return Array.from(map.entries())
      .map(([cid, v]) => ({ label: customers.find(c => c.id === cid)?.name || "—", value: v }))
      .sort((a, b) => b.value - a.value);
  }, [orders, customers]);

  // גרף חודשי: ק״ג לפי חודש (YYYY-MM)
  const perMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const dt = new Date(o.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
      map.set(key, (map.get(key) || 0) + Number(o.qty_kg || 0));
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  const showProfit = role === "factory_manager";

  // ===== Helpers =====
  const num = (v: number | null | undefined) => {
    const n = Number(v || 0);
    return n ? n.toLocaleString() : "-";
  };
  const pct = (v: number | null | undefined) => {
    const n = Number(v || 0);
    return n ? (n * 100).toFixed(1) + "%" : "-";
  };
  const money = (v: number | null | undefined) => {
    const n = Number(v || 0);
    return n ? n.toFixed(2) : "-";
  };
  const dateOnly = (iso: string) => new Date(iso).toLocaleDateString("he-IL");

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    tableLayout: "fixed",
    direction: "rtl",
    minWidth: 1200,
  };

  return (
    <div style={{ maxWidth: 1250, margin: "28px auto", padding: 12, direction: "rtl" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>📊 דוחות</h2>

      {/* סרגל סינון */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm" style={{ marginBottom: 12 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 8, alignItems: "end" }}>
          <div>
            <label>מ־תאריך</label>
            <input type="date" className="border p-2 w-full" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label>עד־תאריך</label>
            <input type="date" className="border p-2 w-full" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label>חיפוש ספק / משחיטה / מס׳ משלוח</label>
            <input className="border p-2 w-full" value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש..." />
          </div>
          <div style={{ fontSize: 13 }}>
            <div style={{ fontSize: 12, color: "#555" }}>סיכומים</div>
            ברוטו: <b>{summary.gross.toLocaleString()}</b> • נטו: <b>{summary.net.toLocaleString()}</b>
          </div>
        </div>
      </div>

      {msg && <div style={{ color: "crimson", marginBottom: 8 }}>{msg}</div>}

      {/* טבלת קבלות */}
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>תאריך</Th>
              <Th>ספק</Th>
              <Th>משחיטה</Th>
              <Th>ברוטו (ק״ג)</Th>
              <Th>מס׳ משלוח</Th>
              <Th>זכר (ק״ג)</Th>
              <Th>נקבה (ק״ג)</Th>
              <Th>זכר %</Th>
              <Th>נקבה %</Th>
              <Th>נטו</Th>
              <Th>ק״ג זכר (עלות)</Th>
              <Th>ק״ג נקבה (עלות)</Th>
              <Th>עלות זכר (₪)</Th>
              <Th>עלות נקבה (₪)</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><Td colSpan={14} align="center">אין נתונים.</Td></tr>
            ) : filtered.map(r => {
              const maleCostTotal   = (Number(r.male_net_kg    || 0) || 0) * (Number(r.male_cost_per_kg   || 0) || 0);
              const femaleCostTotal = (Number(r.female_net_kg  || 0) || 0) * (Number(r.female_cost_per_kg || 0) || 0);

              return (
                <tr key={r.line_id}>
                  <Td>{dateOnly(r.created_at)}</Td>
                  <Td>{r.supplier ?? "-"}</Td>
                  <Td>{r.slaughter_company ?? "-"}</Td>
                  <Td>{num(r.gross_qty_kg)}</Td>
                  <Td>{r.shipment_number ?? "-"}</Td>
                  <Td>{num(r.male_gross_kg)}</Td>
                  <Td>{num(r.female_gross_kg)}</Td>
                  <Td>{pct(r.male_yield_ratio)}</Td>
                  <Td>{pct(r.female_yield_ratio)}</Td>
                  <Td>{num(r.net_processed_kg)}</Td>
                  <Td>{money(r.male_cost_per_kg)}</Td>
                  <Td>{money(r.female_cost_per_kg)}</Td>
                  <Td>{maleCostTotal   ? maleCostTotal.toFixed(2)   : "-"}</Td>
                  <Td>{femaleCostTotal ? femaleCostTotal.toFixed(2) : "-"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* רווח חודשי */}
      {showProfit && (
        <div className="rounded-2xl border bg-white p-3 shadow-sm" style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>רווח חודשי</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>חודש</Th>
                  <Th>מחזור (₪)</Th>
                  <Th>עלות (₪)</Th>
                  <Th>רווח (₪)</Th>
                </tr>
              </thead>
              <tbody>
                {profit.length === 0 ? (
                  <tr><Td colSpan={4}>אין נתונים.</Td></tr>
                ) : profit.map(p => (
                  <tr key={p.ym}>
                    <Td>{p.ym}</Td>
                    <Td>{p.revenue.toLocaleString()}</Td>
                    <Td>{p.cost.toLocaleString()}</Td>
                    <Td style={{ color: p.profit >= 0 ? "green" : "crimson" }}>
                      {p.profit.toLocaleString()}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* גרפים */}
      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16, marginTop: 18 }}>
        <ChartCard title="ק״ג לפי לקוחות (מהגבוה לנמוך)">
          <VBarChartDark data={perCustomer} unit="ק״ג" />
        </ChartCard>

        <ChartCard title="סיכום לפי חודשים (ק״ג)">
          <VBarChart data={perMonth} unit="ק״ג" />
        </ChartCard>
      </div>
    </div>
  );
}

/** ===== תא כותרת/תא טבלה ===== */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        border: "1px solid #e9e9e9",
        padding: "6px 8px",
        whiteSpace: "nowrap",
        textAlign: "center",
        fontWeight: 600,
        background: "#f7f7f7",
      }}
    >
      {children}
    </th>
  );
}
function Td({ children, colSpan, align }: { children: React.ReactNode; colSpan?: number; align?: any }) {
  return (
    <td className="border p-2 text-right" colSpan={colSpan} align={align}>
      {children}
    </td>
  );
}

/** ===== מעטפת גרף ===== */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

/** ===== גרף לקוחות – עמודות אנכיות כהות ===== */
function VBarChartDark({
  data,
  unit = "",
  height = 280,
  bottom = 60,
  left = 56,
  maxBars = 12,
}: {
  data: { label: string; value: number }[];
  unit?: string;
  height?: number;
  bottom?: number;
  left?: number;
  maxBars?: number;
}) {
  const sorted = [...(data || [])]
    .map(d => ({ label: d.label, value: Number(d.value) || 0 }))
    .sort((a,b) => b.value - a.value)
    .slice(0, maxBars);

  const width   = Math.max(420, sorted.length * 56 + left + 16);
  const innerH  = height - bottom;
  const innerW  = width - left;
  const maxVal  = Math.max(1, ...sorted.map(d => d.value));
  const barW    = Math.max(18, Math.min(36, innerW / Math.max(1, sorted.length) - 12));
  const y       = (v:number) => innerH - (v / maxVal) * (innerH - 12);
  const ticks   = [0, .25, .5, .75, 1].map(t => Math.round(t*maxVal));

  return (
    <div style={{ overflowX: "auto", direction: "rtl" }}>
      <svg width={width} height={height} style={{ background:"#fff", border:"1px solid #eee", borderRadius:8 }}>
        <line x1={left} y1={10} x2={left} y2={innerH} stroke="#bbb" />
        <line x1={left} y1={innerH} x2={width-8} y2={innerH} stroke="#bbb" />
        {ticks.map((t,i)=>(
          <g key={i}>
            <line x1={left} y1={y(t)} x2={width-8} y2={y(t)} stroke="#f0f0f0" />
            <text x={left-6} y={y(t)+4} textAnchor="end" fontSize="11" fill="#666">
              {t.toLocaleString()} {unit}
            </text>
          </g>
        ))}

        {sorted.map((d,i)=>{
          const x = left + 8 + i*(barW+12);
          const h = innerH - y(d.value);
          const topY = y(d.value);
          const canFitInside = h > 24;
          const labelShort = d.label.length > 8 ? d.label.slice(0,8) + "…" : d.label;

          return (
            <g key={d.label}>
              <rect x={x} y={topY} width={barW} height={Math.max(0,h)} rx={4} fill="#111" />
              <text x={x + barW/2} y={topY - 6} textAnchor="middle" fontSize="11" fill="#222">
                {Number(d.value).toFixed(0)}
              </text>
              {canFitInside ? (
                <text x={x + barW/2} y={topY + h/2 + 4} textAnchor="middle" fontSize="11" fill="#fff">
                  {labelShort}
                </text>
              ) : (
                <text x={x + barW/2} y={innerH + 14} textAnchor="middle" fontSize="11" fill="#444">
                  {labelShort}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** ===== גרף חודשי – עמודות אנכיות ירוקות ===== */
function VBarChart({
  data,
  unit = "",
  height = 300,
  bottom = 48,
  left = 56,
  gap = 10,
}: {
  data: { label: string; value: number }[];
  unit?: string;
  height?: number;
  bottom?: number;
  left?: number;
  gap?: number;
}) {
  const clean = (data || []).map(d => ({ label: d.label, value: Number(d.value) || 0 }));
  const width  = Math.max(420, clean.length * 54 + left + 16);
  const innerH = height - bottom;
  const innerW = width - left;
  const maxVal = Math.max(1, ...clean.map(d => d.value));
  const barW   = Math.max(20, Math.min(40, innerW / Math.max(1, clean.length) - gap));
  const y      = (v: number) => innerH - (v / maxVal) * (innerH - 12);

  const barColor = "#16a34a";

  return (
    <svg width={width} height={height} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, display: "block" }}>
      <line x1={left} y1={10} x2={left} y2={innerH} stroke="#bbb" />
      <line x1={left} y1={innerH} x2={width - 8} y2={innerH} stroke="#bbb" />

      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const yy = y(t * maxVal);
        return (
          <g key={i}>
            <line x1={left} y1={yy} x2={width - 8} y2={yy} stroke="#f0f0f0" />
            <text x={left - 6} y={yy + 4} textAnchor="end" fontSize="11" fill="#555">
              {Math.round(t * maxVal).toLocaleString()} {unit}
            </text>
          </g>
        );
      })}

      {clean.map((d, i) => {
        const x  = left + 8 + i * (barW + gap);
        const h  = innerH - y(d.value);
        const yy = y(d.value);

        return (
          <g key={d.label}>
            <rect x={x} y={yy} width={barW} height={Math.max(0, h)} rx={5} fill={barColor} />
            <text
              x={x + barW / 2}
              y={h > 20 ? yy + 14 : yy - 6}
              textAnchor="middle"
              fontSize="12"
              fill={h > 20 ? "#fff" : "#111"}
              dominantBaseline={h > 20 ? "middle" : "auto"}
            >
              {Math.round(d.value).toLocaleString()}
            </text>
            <text x={x + barW / 2} y={innerH + 16} textAnchor="middle" fontSize="11" fill="#444">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}