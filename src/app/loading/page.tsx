"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppRole, RolePermissions } from "@/lib/roles";

type OrderLite = { id: number; customer_name: string; status: string };
type Item = { id: string; product_name: string; qty_kg: number };
type Lot  = { id: string; slaughter_company: string | null; qty_kg: number };

type SourceRow = {
  id: string;
  order_item_id: string;
  qty_kg: number;
  temp_at_loading: number | null;
  lot?: { id: string; slaughter_company: string | null } | null;
};

export default function LoadingPage(){
  const [role, setRole] = useState<AppRole | null>(null);

  // נתונים גלובליים
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [lots, setLots]     = useState<Lot[]>([]);

  // בחירה
  const [selOrder, setSelOrder] = useState<number | "">("");
  const [items, setItems] = useState<Item[]>([]);

  // מקורות/קישורים פר פריט
  const [sources, setSources] = useState<Record<string, SourceRow[]>>({}); // itemId -> rows

  // טופס הוספה פר-פריט
  const [lotPick, setLotPick]   = useState<Record<string,string>>({});
  const [qtyPick, setQtyPick]   = useState<Record<string,string>>({});
  const [tempPick, setTempPick] = useState<Record<string,string>>({});

  const [msg, setMsg] = useState("");

  const canEdit = useMemo(() => {
    if (!role) return false;
    const perms = RolePermissions[role];
    return perms.editLoadingPlan === true;
  }, [role]);

  // חישובי סה"כ להזמנה הנבחרת
  const totals = useMemo(() => {
    if (!selOrder) return { required: 0, linked: 0, missing: 0 };
    const required = items.reduce((sum, it) => sum + (Number(it.qty_kg) || 0), 0);
    const linked = items.reduce((sum, it) => {
      const arr = sources[it.id] || [];
      const s = arr.reduce((a, r) => a + (Number(r.qty_kg) || 0), 0);
      return sum + s;
    }, 0);
    return { required, linked, missing: Math.max(0, required - linked) };
  }, [selOrder, items, sources]);

  // טען תפקיד + הזמנות + לוטים פתוחים
  useEffect(()=>{ (async ()=>{
    const { data: r } = await supabase.rpc("get_my_role");
    setRole((r as AppRole) ?? null);

    const { data: os } = await supabase
      .from("orders")
      .select("id, customer_name, status")
      .order("created_at", { ascending:false });
    setOrders((os as any[])?.map(o => ({ id:o.id, customer_name:o.customer_name, status:o.status })) || []);

    const { data: ls } = await supabase
      .from("raw_receipt_lines")
      .select("id, slaughter_company, qty_kg")
      .eq("finished", false)
      .order("created_at", { ascending:false });
    setLots((ls as any[] || []).map(l => ({ id:l.id, slaughter_company:l.slaughter_company, qty_kg:l.qty_kg })));
  })(); },[]);

  // כשבוחרים הזמנה – טען פריטים + המקורות שלהם
  useEffect(()=>{ (async ()=>{
    setItems([]); setSources({});
    if (!selOrder) return;

    const { data: its } = await supabase
      .from("order_items")
      .select("id, product_name, qty_kg")
      .eq("order_id", selOrder);

    const itemsList: Item[] = (its as any[] || []).map(i => ({
      id: i.id, product_name: i.product_name, qty_kg: Number(i.qty_kg)
    }));
    setItems(itemsList);

    // טען source rows לכל הפריטים שנבחרו
    if (itemsList.length) {
      const ids = itemsList.map(i => i.id);
      const { data: srows } = await supabase
        .from("order_item_sources")
        .select("id, order_item_id, qty_kg, temp_at_loading, lot:receipt_line_id (id, slaughter_company)")
        .in("order_item_id", ids);

      const byItem: Record<string, SourceRow[]> = {};
      itemsList.forEach(i => byItem[i.id] = []);
      (srows as any[] || []).forEach(r => {
        const row: SourceRow = {
          id: r.id,
          order_item_id: r.order_item_id,
          qty_kg: Number(r.qty_kg),
          temp_at_loading: r.temp_at_loading ?? null,
          lot: r.lot ? { id: r.lot.id, slaughter_company: r.lot.slaughter_company } : null
        };
        byItem[row.order_item_id] = [...(byItem[row.order_item_id] || []), row];
      });
      setSources(byItem);

      // אפס טפסים
      const lp: Record<string,string> = {}, qp:Record<string,string> = {}, tp:Record<string,string> = {};
      itemsList.forEach(i => { lp[i.id]=""; qp[i.id]=""; tp[i.id]=""; });
      setLotPick(lp); setQtyPick(qp); setTempPick(tp);
    }
  })(); },[selOrder]);

  const addLink = async (itemId: string) => {
    setMsg("");
    if (!canEdit) return setMsg("❌ אין הרשאה");

    const lotId = lotPick[itemId];
    const qty   = qtyPick[itemId];
    const temp  = tempPick[itemId];

    if (!lotId || !qty) return setMsg("⚠️ בחר לוט וכמות");

    const { data, error } = await supabase
      .from("order_item_sources")
      .insert({
        order_item_id: itemId,
        receipt_line_id: lotId,
        qty_kg: Number(qty),
        temp_at_loading: temp ? Number(temp) : null
      })
      .select("id, order_item_id, qty_kg, temp_at_loading, lot:receipt_line_id (id, slaughter_company)")
      .single();

    if (error) return setMsg("❌ שמירה נכשלה");
    setSources(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), {
        id: data!.id,
        order_item_id: itemId,
        qty_kg: Number(data!.qty_kg),
        temp_at_loading: data!.temp_at_loading,
        lot: data!.lot
      }]
    }));
    // אפס שדות הטופס לאותו פריט
    setLotPick(p => ({...p, [itemId]:""}));
    setQtyPick(p => ({...p, [itemId]:""}));
    setTempPick(p => ({...p, [itemId]:""}));
    setMsg("✅ נשמר");
  };

  const removeLink = async (itemId: string, sourceId: string) => {
    setMsg("");
    if (!canEdit) return setMsg("❌ אין הרשאה");
    const { error } = await supabase.from("order_item_sources").delete().eq("id", sourceId);
    if (error) return setMsg("❌ מחיקה נכשלה");
    setSources(prev => ({ ...prev, [itemId]: (prev[itemId] || []).filter(s => s.id !== sourceId)}));
    setMsg("✅ נמחק");
  };

  // סיים העמסה: עדכון סטטוס ההזמנה ל-'loaded' עם אזהרה אם חסר
  const finishLoading = async () => {
    if (!selOrder) return;
    if (!canEdit) { setMsg("❌ אין הרשאה"); return; }

    if (totals.missing > 0) {
      const ok = confirm(`⚠️ חסר ${totals.missing.toFixed(2)} ק״ג לעומת הכמות הנדרשת. לסמן בכל זאת כ-Loaded?`);
      if (!ok) return;
    }

    const { error } = await supabase.from("orders").update({ status: "loaded" }).eq("id", selOrder);
    if (error) { setMsg("❌ עדכון סטטוס נכשל"); return; }

    // עדכן תצוגה מקומית
    setOrders(prev => prev.map(o => o.id === selOrder ? { ...o, status: "loaded" } : o));
    setMsg("✅ ההזמנה סומנה כ-Loaded");
  };

  return (
    <div style={{maxWidth:1100, margin:"20px auto", padding:12}}>
      <h1 style={{fontWeight:700, fontSize:22, marginBottom:12}}>🚚 זמן העמסה — שיוך לוטים לפי שורת הזמנה</h1>

      {msg && <div style={{marginBottom:10, color: msg.startsWith("✅") ? "green" : "crimson"}}>{msg}</div>}

      <div className="grid gap-3" style={{gridTemplateColumns:"1fr 1fr"}}>
        <div>
          <label>בחר הזמנה</label>
          <select className="border p-2 w-full" value={selOrder as any} onChange={(e)=>setSelOrder(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— בחר —</option>
            {orders.map(o => <option key={o.id} value={o.id}>#{o.id} — {o.customer_name} — {o.status}</option>)}
          </select>
        </div>
        <div>
          <label>לוטים פתוחים</label>
          <div className="border p-2 rounded text-sm" style={{maxHeight:100, overflow:"auto"}}>
            {lots.map(l => <div key={l.id}>• {l.slaughter_company || l.id}</div>)}
          </div>
        </div>
      </div>

      {/* פס סטטוס + כפתור סיום העמסה */}
      {selOrder && (
        <div className="mt-3 flex items-center gap-3" style={{display:"flex", alignItems:"center", gap:12}}>
          <div>
            נדרש: <b>{totals.required.toFixed(2)}</b> ק״ג • שוייך:{" "}
            <b style={{color: totals.missing > 0 ? "crimson" : "green"}}>{totals.linked.toFixed(2)}</b> ק״ג{" "}
            {totals.missing > 0 ? (
              <span style={{color:"crimson"}}> (חסר {totals.missing.toFixed(2)} ק״ג)</span>
            ) : (
              <span style={{color:"green"}}> ✅ מכוסה</span>
            )}
          </div>
          <button
            className="border px-3 py-2 bg-gray-100 hover:bg-gray-200"
            onClick={finishLoading}
            disabled={!canEdit}
          >
            ✅ סיים העמסה (סמן Loaded)
          </button>
        </div>
      )}

      {!selOrder ? (
        <div className="mt-6">בחר הזמנה לצפייה בפריטים.</div>
      ) : (
        <div className="mt-6">
          {items.length === 0 ? (
            <div>אין פריטים להזמנה זו.</div>
          ) : (
            items.map(it => (
              <div key={it.id} className="border rounded p-3 mb-4 bg-white">
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div><b>{it.product_name}</b> — {it.qty_kg} ק״ג</div>
                </div>

                {/* מקורות קיימים */}
                <div className="mt-2">
                  <table className="min-w-full border">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-2">לוט</th>
                        <th className="border p-2">כמות (ק״ג)</th>
                        <th className="border p-2">טמפ’ העמסה</th>
                        {canEdit && <th className="border p-2">מחיקה</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(sources[it.id] || []).length === 0 ? (
                        <tr><td className="border p-2" colSpan={4}>אין שיוכים כרגע.</td></tr>
                      ) : (
                        (sources[it.id] || []).map(s => (
                          <tr key={s.id}>
                            <td className="border p-2">{s.lot?.slaughter_company || s.lot?.id || "-"}</td>
                            <td className="border p-2">{s.qty_kg}</td>
                            <td className="border p-2">{s.temp_at_loading ?? "-"}</td>
                            {canEdit && (
                              <td className="border p-2">
                                <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200"
                                        onClick={()=>removeLink(it.id, s.id)}>מחק</button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* הוספת מקור חדש לפריט */}
                {canEdit && (
                  <div className="mt-3 grid gap-3" style={{gridTemplateColumns:"2fr 1fr 1fr 1fr"}}>
                    <select className="border p-2"
                            value={lotPick[it.id] ?? ""}
                            onChange={(e)=>setLotPick(p=>({...p, [it.id]: e.target.value}))}>
                      <option value="">— בחר לוט —</option>
                      {lots.map(l => <option key={l.id} value={l.id}>
                        {l.slaughter_company || l.id}
                      </option>)}
                    </select>
                    <input className="border p-2" type="number" placeholder="כמות (ק״ג)"
                           value={qtyPick[it.id] ?? ""}
                           onChange={(e)=>setQtyPick(p=>({...p, [it.id]: e.target.value}))}/>
                    <input className="border p-2" type="number" placeholder="טמפ’"
                           value={tempPick[it.id] ?? ""}
                           onChange={(e)=>setTempPick(p=>({...p, [it.id]: e.target.value}))}/>
                    <button className="border px-3 py-2 bg-gray-100 hover:bg-gray-200"
                            onClick={()=>addLink(it.id)}>הוסף</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}