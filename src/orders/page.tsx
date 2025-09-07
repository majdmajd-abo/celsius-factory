"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppRole, RolePermissions } from "@/lib/roles";

type Order = {
  id: number;
  customer_name: string;
  product_type: string; // זכר / נקבה / חתוך / שלם
  qty_kg: number;
  price_per_kg: number;
  note: string | null;
  created_at: string;
};

export default function OrdersPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customer, setCustomer] = useState("");
  const [type, setType] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const load = async () => {
      // משיכת התפקיד
      const { data: r } = await supabase.rpc("get_my_role");
      if (r) setRole(r as AppRole);

      // משיכת ההזמנות
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setOrders(data);
    };
    load();
  }, []);

  if (!role) return <div>טוען...</div>;
  const perms = RolePermissions[role];

  const addOrder = async () => {
    if (!perms.editOrders) {
      alert("אין לך הרשאה להוסיף הזמנה");
      return;
    }

    const { error } = await supabase.from("orders").insert([
      {
        customer_name: customer,
        product_type: type,
        qty_kg: Number(qty),
        price_per_kg: Number(price),
        note,
      },
    ]);

    if (error) {
      alert("שגיאה: " + error.message);
    } else {
      alert("הוזמן בהצלחה");
      setCustomer("");
      setType("");
      setQty("");
      setPrice("");
      setNote("");
      // טען מחדש
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setOrders(data);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>🧾 הזמנות</h1>

      {perms.editOrders && (
        <div style={{ marginBottom: "20px" }}>
          <h2>➕ הוסף הזמנה חדשה</h2>
          <input
            placeholder="שם לקוח"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
          <input
            placeholder="סוג סחורה (זכר / נקבה / חתוך / שלם)"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <input
            type="number"
            placeholder="כמות (ק״ג)"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            type="number"
            placeholder="מחיר לק״ג"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            placeholder="הערה"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={addOrder}>שמור</button>
        </div>
      )}

      <h2>📋 רשימת הזמנות</h2>
      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <th>לקוח</th>
            <th>סוג</th>
            <th>כמות (ק״ג)</th>
            <th>מחיר לק״ג</th>
            <th>סה״כ</th>
            <th>הערה</th>
            <th>תאריך</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.customer_name}</td>
              <td>{o.product_type}</td>
              <td>{o.qty_kg}</td>
              <td>{o.price_per_kg}</td>
              <td>{o.qty_kg * o.price_per_kg}</td>
              <td>{o.note}</td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}