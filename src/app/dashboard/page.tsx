"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RolePermissions, AppRole } from "@/lib/roles";
import Link from "next/link";

<li><Link href="/customers">👥 לקוחות</Link></li>
export default function DashboardPage() {
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      const { data: r } = await supabase.rpc("get_my_role");
      if (r) setRole(r as AppRole);
    };
    loadRole();
  }, []);

  if (!role) return <div>⏳ טוען...</div>;

  const perms = RolePermissions[role];

  return (
    <div style={{ padding: "20px" }}>
      <h1>📊 לוח בקרה</h1>
      <p>
        התפקיד שלך: <b>{role}</b>
      </p>

      <ul style={{ lineHeight: "2" }}>
        {perms.viewReceipts && (
          <li>
            <Link href="/receipts">📥 קבלת סחורה</Link>
          </li>
        )}
        {perms.viewProduction && (
          <li>
            <Link href="/production">🏭 יומן יצור</Link>
          </li>
        )}
        {perms.viewOrders && (
          <li>
            <Link href="/orders">🧾 הזמנות</Link>
          </li>
        )}
        {perms.viewLoadingPlan && (
          <li>
            <Link href="/loading">🚚 זמן העמסה</Link>
          </li>
        )}
        {perms.viewReports && (
          <li>
            <Link href="/reports">📈 דוחות</Link>
          </li>
        )}
        {perms.editUsers && (
          <li>
            <Link href="/users">👥 ניהול משתמשים</Link>
          </li>
        )}
      </ul>
    </div>
  );
}