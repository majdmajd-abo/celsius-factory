"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppRole, RolePermissions } from "@/lib/roles";
import Link from "next/link";


<div style={{ marginBottom: 15 }}>
  <Link href="/orders/new" className="border px-3 py-2 bg-gray-100 hover:bg-gray-200">
    ➕ הזמנה חדשה
  </Link>
</div>
type OrderRow = {
  id: number;
  customer_name: string;
  product_type: string;
  qty_kg: number;
  price_per_kg: number;
  note: string | null;
  created_at: string;
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "loaded"
    | "delivered"
    | "returned"
    | "cancelled";
};

const STATUSES: OrderRow["status"][] = [
  "pending",
  "preparing",
  "ready",
  "loaded",
  "delivered",
  "returned",
  "cancelled",
];

export default function OrdersPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<OrderRow["status"] | "all">("all");
  const [msg, setMsg] = useState("");

  const can = useMemo(() => (role ? RolePermissions[role] : null), [role]);

  const load = async () => {
    setMsg("");
    const q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) { setMsg("❌ שגיאה בטעינה"); return; }
    setRows((data as OrderRow[]) || []);
  };

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.rpc("get_my_role");
      setRole((r as AppRole) || null);
      await load();
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter(r => r.status === filter);
  }, [rows, filter]);

  const total = (o: OrderRow) => (o.qty_kg ?? 0) * (o.price_per_kg ?? 0);

  const setStatus = async (id: number, status: OrderRow["status"]) => {
    if (!can?.editOrders) { setMsg("❌ אין לך הרשאה"); return; }
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { setMsg("❌ עדכון סטטוס נכשל"); return; }
    setMsg("✅ עודכן");
    load();
  };

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 12 }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>🧾 הזמנות</h1>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <span>פילטר סטטוס:</span>
        <select
          className="border p-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
        >
          <option value="all">all</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* קיצור לזמן העמסה */}
        <Link href="/loading" className="border px-3 py-2 bg-gray-100 hover:bg-gray-200">
          🚚 לעמוד זמן העמסה
        </Link>
      </div>

      {msg && (
        <div style={{ marginBottom: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>
          {msg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div>אין הזמנות להצגה.</div>
      ) : (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-right">#</th>
                <th className="border p-2 text-right">לקוח</th>
                <th className="border p-2 text-right">סוג</th>
                <th className="border p-2 text-right">כמות (ק״ג)</th>
                <th className="border p-2 text-right">מחיר/ק״ג</th>
                <th className="border p-2 text-right">סה״כ</th>
                <th className="border p-2 text-right">הערה</th>
                <th className="border p-2 text-right">סטטוס</th>
                {can?.editOrders && <th className="border p-2 text-right">שינוי</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className={o.status === "ready" ? "bg-green-50" : undefined}>
                  <td className="border p-2">{o.id}</td>
                  <td className="border p-2">{o.customer_name}</td>
                  <td className="border p-2">{o.product_type}</td>
                  <td className="border p-2">{o.qty_kg}</td>
                  <td className="border p-2">{o.price_per_kg}</td>
                  <td className="border p-2">{total(o).toFixed(2)}</td>
                  <td className="border p-2">{o.note || "-"}</td>
                  <td className="border p-2">
                    <span style={{ padding: "2px 6px", borderRadius: 6, background: "#f5f5f5" }}>
                      {o.status}
                    </span>
                  </td>
                  {can?.editOrders && (
                    <td className="border p-2">
                      <select
                        defaultValue={o.status}
                        onChange={(e) => setStatus(o.id, e.target.value as OrderRow["status"])}
                        className="border p-1"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}