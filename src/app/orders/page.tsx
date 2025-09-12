"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* Types */
type Customer = { id: string; name: string; phone: string | null };
type Order = {
  id: string;
  customer_id: string;
  delivery_date: string | null;
  qty_kg: number | null;
  price_per_kg: number | null;
  gender: "male" | "female" | null;
  note: string | null;
  status: string;
  created_at: string;
};

/* עזר: גבולות חודש נוכחי */
function monthBounds(d = new Date()) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
  const last  = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    firstISO: first.toISOString(),
    lastISO:  last.toISOString(),
    label: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`,
  };
}

export default function OrdersPage() {
  const [role, setRole] = useState<string | null>(null);

  // לקוחות
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");

  // הזמנות
  const [orders, setOrders] = useState<Order[]>([]);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const { firstISO, lastISO, label } = useMemo(() => monthBounds(monthCursor), [monthCursor]);

  // הודעות
  const [msg, setMsg] = useState("");

  // טופס הזמנה
  const [customerId, setCustomerId]   = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [qty, setQty]                 = useState("");
  const [price, setPrice]             = useState("");
  const [gender, setGender]           = useState<"" | "male" | "female">("");
  const [note, setNote]               = useState("");

  // טופס לקוח חדש
  const [newCustName, setNewCustName]   = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  const canEditOrders    = role === "factory_manager" || role === "secretary";
  const canEditCustomers = canEditOrders;

  /* טעינה ראשונית */
  useEffect(() => {
    (async () => {
      setMsg("");

      // 1) קבל משתמש מחובר
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole("employee");
      } else {
        // 2) הבא תפקיד ישירות מ-profiles (בלי RPC)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profErr) {
          console.warn("profiles role error:", profErr.message);
          setRole("employee");
        } else {
          setRole(prof?.role || "employee");
        }
      }

      await loadCustomers();
      await loadOrdersInMonth();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* בכל שינוי חודש—רענון */
  useEffect(() => {
    loadOrdersInMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstISO, lastISO]);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone")
      .order("name", { ascending: true });
    if (error) setMsg("❌ שגיאה בטעינת לקוחות: " + error.message);
    setCustomers((data as Customer[]) || []);
  }

  async function loadOrdersInMonth() {
    const { data, error } = await supabase
      .from("orders")
      .select("id,customer_id,delivery_date,qty_kg,price_per_kg,gender,note,status,created_at")
      .gte("created_at", firstISO)
      .lte("created_at", lastISO)
      .order("created_at", { ascending: false }); // כל החודש
    if (error) setMsg("❌ שגיאה בטעינת הזמנות: " + error.message);
    setOrders((data as Order[]) || []);
  }

  async function saveOrder() {
    setMsg("");
    if (!canEditOrders) return setMsg("❌ אין לך הרשאה להוסיף הזמנות");
    if (!customerId)   return setMsg("⚠️ בחר לקוח");
    if (!qty)          return setMsg("⚠️ הכנס כמות (ק\"ג)");
    if (!gender)       return setMsg("⚠️ בחר מגדר (זכר/נקבה)");

    const payload = {
      customer_id:   customerId,
      delivery_date: deliveryDate || null,
      qty_kg:        qty ? Number(qty)   : null,
      price_per_kg:  price ? Number(price) : null,
      gender:        gender as "male" | "female",
      note:          note || null,
      status:        "pending",
    };

    const { error } = await supabase.from("orders").insert(payload);
    if (error) setMsg("❌ שגיאה בשמירה: " + error.message);
    else {
      setMsg("✅ ההזמנה נשמרה");
      setQty(""); setPrice(""); setNote(""); setGender("");
      await loadOrdersInMonth();
    }
  }

  async function updateStatus(id: string, status: string) {
    setMsg("");
    if (!canEditOrders) return setMsg("❌ אין הרשאה לעדכן סטטוס");
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) setMsg("❌ עדכון נכשל: " + error.message);
    else await loadOrdersInMonth();
  }

  async function addCustomer() {
    setMsg("");
    if (!canEditCustomers) return setMsg("❌ אין לך הרשאה להוסיף לקוחות");
    if (!newCustName.trim()) return setMsg("⚠️ שם לקוח חובה");

    const { data, error } = await supabase
      .from("customers")
      .insert({ name: newCustName.trim(), phone: newCustPhone || null })
      .select("id,name")
      .single();

    if (error) {
      setMsg("❌ לא ניתן להוסיף לקוח: " + error.message);
      return;
    }

    await loadCustomers();
    setCustomerId(data!.id);
    setNewCustName(""); setNewCustPhone("");
    setMsg("✅ לקוח נוסף בהצלחה");
  }

  /* סינון לקוחות */
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  /* UI */
  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 12, direction: "rtl" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        הזמנות — חודש {label}
      </h2>

      {msg && (
        <div style={{
          margin: "10px 0 16px", padding: "10px 12px", borderRadius: 8,
          background: msg.startsWith("✅") ? "#eaffea" : "#ffecec",
          border: "1px solid", borderColor: msg.startsWith("✅") ? "#9bd59b" : "#ffb3b3"
        }}>{msg}</div>
      )}

      {/* ניווט חודשי */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 15))}
                className="border px-3 py-1 bg-gray-100 hover:bg-gray-200">◀ החודש הקודם</button>
        <button onClick={() => setMonthCursor(new Date())}
                className="border px-3 py-1 bg-gray-100 hover:bg-gray-200">היום</button>
        <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 15))}
                className="border px-3 py-1 bg-gray-100 hover:bg-gray-200">החודש הבא ▶</button>
      </div>

      {/* טופס לקוח חדש */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>לקוח חדש</h3>
        {!canEditCustomers && <div style={{ color: "crimson", marginBottom: 8 }}>אין לך הרשאה להוסיף לקוחות.</div>}
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <div>
            <label>שם לקוח *</label>
            <input className="border p-2 w-full" value={newCustName} onChange={(e)=>setNewCustName(e.target.value)} />
          </div>
          <div>
            <label>טלפון</label>
            <input className="border p-2 w-full" value={newCustPhone} onChange={(e)=>setNewCustPhone(e.target.value)} />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button onClick={addCustomer} disabled={!canEditCustomers} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
              ➕ הוסף לקוח
            </button>
          </div>
        </div>
      </div>

      {/* טופס יצירת הזמנה */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>יצירת הזמנה</h3>
        {!canEditOrders && <div style={{ color: "crimson", marginBottom: 8 }}>אין לך הרשאה ליצור הזמנות.</div>}
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 2fr", gap: 12 }}>
          <div>
            <label>חפש/בחר לקוח *</label>
            <input
              placeholder="חיפוש לפי שם…"
              className="border p-2 w-full"
              value={customerSearch}
              onChange={(e)=>setCustomerSearch(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <select className="border p-2 w-full" value={customerId} onChange={(e)=>setCustomerId(e.target.value)}>
              <option value="">— בחר —</option>
              {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>תאריך אספקה</label>
            <input type="date" className="border p-2 w-full" value={deliveryDate} onChange={(e)=>setDeliveryDate(e.target.value)} />
          </div>
          <div>
            <label>כמות (ק״ג) *</label>
            <input type="number" className="border p-2 w-full" value={qty} onChange={(e)=>setQty(e.target.value)} />
          </div>
          <div>
            <label>מחיר לק״ג</label>
            <input type="number" className="border p-2 w-full" value={price} onChange={(e)=>setPrice(e.target.value)} />
          </div>
          <div>
            <label>מגדר *</label>
            <select className="border p-2 w-full" value={gender} onChange={(e)=>setGender(e.target.value as "male"|"female"|"")}>
              <option value="">— בחר —</option>
              <option value="male">זכר</option>
              <option value="female">נקבה</option>
            </select>
          </div>
          <div>
            <label>הערה</label>
            <input className="border p-2 w-full" value={note} onChange={(e)=>setNote(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={saveOrder}
            disabled={!canEditOrders}
            className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            💾 שמור הזמנה
          </button>
        </div>
      </div>

      {/* רשימת הזמנות לכל החודש */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 style={{ marginBottom: 8 }}>הזמנות החודש ({label})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <Th>סטטוס</Th>
                <Th>תאריך אספקה</Th>
                <Th>כמות</Th>
                <Th>מחיר לק״ג</Th>
                <Th>מגדר</Th>
                <Th>לקוח</Th>
                <Th>פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <Td>{o.status}</Td>
                  <Td>{fmtDate(o.delivery_date)}</Td>
                  <Td>{o.qty_kg ?? "-"}</Td>
                  <Td>{o.price_per_kg ?? "-"}</Td>
                  <Td>{o.gender === "male" ? "זכר" : o.gender === "female" ? "נקבה" : "-"}</Td>
                  <Td>{customerName(customers, o.customer_id)}</Td>
                  <Td>
                    {canEditOrders && (
                      <select
                        className="border p-1"
                        value={o.status}
                        onChange={(e)=>updateStatus(o.id, e.target.value)}
                      >
                        <option value="pending">pending</option>
                        <option value="packed">packed</option>
                        <option value="loaded">loaded</option>
                        <option value="delivered">delivered</option>
                        <option value="returned">returned</option>
                      </select>
                    )}
                  </Td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td className="p-2" colSpan={7}>אין הזמנות בחודש זה.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* helpers */
function customerName(list: Customer[], id: string) {
  return list.find(c => c.id === id)?.name ?? "-";
}
function fmtDate(d?: string | null) {
  if (!d) return "-";
  return (d.length > 10 ? d.slice(0, 10) : d).replaceAll("-", "/");
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="border p-2 text-right whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border p-2 text-right">{children}</td>;
}