"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** ===== Types ===== */
type Role = "factory_manager" | "production_manager" | "driver" | "secretary" | "employee" | null;

type Customer = { id: string; name: string };
type Sheet = { id: string; load_date: string; driver_name: string; note: string | null };

type LotAvail = {
  id: string;
  slaughter_company: string | null;   // שם משחיטה (supplier)
  shipment_number: string | null;     // מס’ תעודת משלוח ללוט
  processed_net_kg: number | null;    // סה"כ נטו שעובד
  loaded_kg: number | null;           // סה"כ שכבר הועמס
  remaining_kg: number | null;        // יתרה = processed - loaded
  created_at?: string;                // לשמירה על אפשרות order ב־view
};

type SheetRow = {
  id: string;
  sheet_id: string;
  customer_id: string;
  delivery_note_number: string;       // מס’ תעודת משלוח ללקוח
  lot_id: string;
  qty_kg: number;
  temp_at_loading: number | null;
  gender: "male" | "female" | null;
  customer?: { id: string; name: string } | null;
  lot?: { id: string; supplier: string | null; shipment_number: string | null } | null;
};

/** helper: to extract an error message from unknown */
function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: string }).message;
    if (typeof m === "string") return m;
  }
  try { return JSON.stringify(e); } catch { return String(e); }
}

export default function LoadingPage() {
  /** ===== Role / Permissions ===== */
  const [role, setRole] = useState<Role>(null);
  const canEdit = role === "factory_manager" || role === "production_manager" || role === "driver";

  /** ===== Header (Sheet) ===== */
  const [loadDate, setLoadDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [driverName, setDriverName] = useState<string>("");
  const [sheetNote, setSheetNote] = useState<string>("");
  const [activeSheet, setActiveSheet] = useState<Sheet | null>(null);

  /** ===== Master data ===== */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lots, setLots] = useState<LotAvail[]>([]); // מגיע מה־view: v_lots_available_for_loading

  /** ===== Row form ===== */
  const [rowCustomerId, setRowCustomerId] = useState<string>("");
  const [rowDelvNo, setRowDelvNo] = useState<string>("");
  const [rowLotId, setRowLotId] = useState<string>("");
  const [rowQty, setRowQty] = useState<string>("");
  const [rowTemp, setRowTemp] = useState<string>("");
  const [rowGender, setRowGender] = useState<"" | "male" | "female">("");

  /** ===== Data for current sheet ===== */
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [recentSheets, setRecentSheets] = useState<Sheet[]>([]);

  /** ===== UI msg ===== */
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      // תפקיד
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.id) {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .single();
        setRole((profErr ? "employee" : ((prof?.role as Role) || "employee")));
      } else {
        setRole("employee");
      }

      // לקוחות
      const { data: cust, error: custErr } = await supabase
        .from("customers")
        .select("id,name")
        .order("name", { ascending: true });
      if (!custErr) setCustomers((cust as Customer[]) || []);

      // לוטים זמינים (עם יתרה > 0)
      await loadAvailableLots();

      // גליונות אחרונים
      await loadRecentSheets();
    };

    init().catch((e) => {
      console.error(e);
      setRole("employee");
      setMsg("⚠️ שגיאת טעינה ראשונית");
    });
  }, []);

  async function loadAvailableLots() {
    const { data, error } = await supabase
      .from("v_lots_available_for_loading")
      .select("id, slaughter_company, shipment_number, processed_net_kg, loaded_kg, remaining_kg, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setMsg("❌ שגיאה בטעינת לוטים: " + error.message);
      return;
    }
    setLots((data as LotAvail[]) || []);
  }

  async function loadRecentSheets() {
    const { data, error } = await supabase
      .from("loading_sheets")
      .select("id,load_date,driver_name,note")
      .order("load_date", { ascending: false })
      .limit(30);
    if (!error) setRecentSheets((data as Sheet[]) || []);
  }

  async function loadSheetRows(sheetId: string) {
    const { data, error } = await supabase
      .from("loading_sheet_rows")
      .select(`
        id,sheet_id,customer_id,delivery_note_number,lot_id,qty_kg,temp_at_loading,gender,
        customer:customer_id (id,name),
        lot:lot_id (id,supplier,shipment_number)
      `)
      .eq("sheet_id", sheetId)
      .order("id", { ascending: true });
    if (!error) setSheetRows((data as SheetRow[]) || []);
  }

  // Create or load a sheet by (date + driver)
  async function createOrLoadSheet() {
    setMsg("");
    if (!canEdit) { setMsg("❌ אין הרשאה"); return; }
    if (!loadDate || !driverName.trim()) { setMsg("⚠️ מלא תאריך ושם נהג"); return; }

    const { data: found } = await supabase
      .from("loading_sheets")
      .select("id,load_date,driver_name,note")
      .eq("load_date", loadDate)
      .eq("driver_name", driverName.trim())
      .maybeSingle();

    if (found) {
      const f = found as Sheet;
      setActiveSheet(f);
      setSheetNote(f.note || "");
      await loadSheetRows(f.id);
      setMsg("ℹ️ נטען גיליון קיים ליום/נהג");
      return;
    }

    const { data, error } = await supabase
      .from("loading_sheets")
      .insert({ load_date: loadDate, driver_name: driverName.trim(), note: sheetNote || null })
      .select("id,load_date,driver_name,note")
      .single();
    if (error) { setMsg("❌ יצירת גיליון נכשלה: " + error.message); return; }

    const created = data as Sheet;
    setActiveSheet(created);
    await loadSheetRows(created.id);
    await loadRecentSheets();
    setMsg("✅ נוצר גיליון חדש");
  }

  async function saveSheetNote() {
    if (!activeSheet) return;
    const { error } = await supabase
      .from("loading_sheets")
      .update({ note: sheetNote || null })
      .eq("id", activeSheet.id);
    if (error) setMsg("❌ עדכון הערה נכשל"); else setMsg("✅ נשמרה הערה");
  }

  // Add row (with automatic remaining check on client)
  async function addRow() {
    setMsg("");
    if (!canEdit) { setMsg("❌ אין הרשאה"); return; }
    if (!activeSheet) { setMsg("❌ אין גיליון פעיל"); return; }
    if (!rowCustomerId || !rowDelvNo.trim() || !rowLotId || !rowQty) {
      setMsg("⚠️ חובה: לקוח, מס' תעודת משלוח, שם משחיטה, כמות");
      return;
    }
    if (!rowGender) {
      setMsg("⚠️ בחר מגדר (זכר/נקבה)");
      return;
    }

    const qtyNum = Number(rowQty);
    if (!isFinite(qtyNum) || qtyNum <= 0) {
      setMsg("⚠️ הכנס כמות חוקית (> 0)");
      return;
    }

    // 🔒 Client-side: prevent exceeding remaining
    const lot = lots.find(l => l.id === rowLotId);
    const remaining = Number(lot?.remaining_kg || 0);
    if (!lot || remaining <= 0) {
      setMsg("❌ אין יתרה בלוט שנבחר");
      return;
    }
    if (qtyNum > remaining + 1e-6) {
      setMsg(`❌ הכמות (${qtyNum} ק״ג) חורגת מהיתרה (${remaining.toFixed(2)} ק״ג)`);
      return;
    }

    const payload = {
      sheet_id: activeSheet.id,
      customer_id: rowCustomerId,
      order_id: null as string | null, // אין הזמנה
      delivery_note_number: rowDelvNo.trim(),
      lot_id: rowLotId,
      qty_kg: qtyNum,
      temp_at_loading: rowTemp ? Number(rowTemp) : null,
      gender: rowGender as "male" | "female",
    };

    const { data, error } = await supabase
      .from("loading_sheet_rows")
      .insert(payload)
      .select(`
        id,sheet_id,customer_id,delivery_note_number,lot_id,qty_kg,temp_at_loading,gender,
        customer:customer_id (id,name),
        lot:lot_id (id,supplier,shipment_number)
      `)
      .single();

    if (error) { setMsg("❌ שמירה נכשלה: " + error.message); return; }

    setSheetRows(prev => [...prev, (data as SheetRow)]);

    // Reset form
    setRowDelvNo("");
    setRowLotId("");
    setRowQty("");
    setRowTemp("");
    setRowGender("");

    // Refresh available lots (remaining changed)
    await loadAvailableLots();

    setMsg("✅ שורה נוספה");
  }

  async function removeRow(rowId: string) {
    setMsg("");
    if (!canEdit) { setMsg("❌ אין הרשאה"); return; }
    const { error } = await supabase.from("loading_sheet_rows").delete().eq("id", rowId);
    if (error) { setMsg("❌ מחיקה נכשלה: " + error.message); return; }
    setSheetRows(prev => prev.filter(r => r.id !== rowId));
    await loadAvailableLots();
    setMsg("✅ נמחק");
  }

  async function openSheet(sid: string) {
    const { data, error } = await supabase
      .from("loading_sheets")
      .select("id,load_date,driver_name,note")
      .eq("id", sid)
      .single();
    if (error || !data) return;
    const s = data as Sheet;
    setActiveSheet(s);
    setLoadDate(s.load_date);
    setDriverName(s.driver_name);
    setSheetNote(s.note || "");
    await loadSheetRows(sid);
    setMsg("");
  }

  async function deleteSheet(sid: string) {
    if (!canEdit) { setMsg("❌ אין הרשאה"); return; }
    const ok = window.confirm("למחוק את הגיליון וכל שורותיו?");
    if (!ok) return;
    const { error } = await supabase.from("loading_sheets").delete().eq("id", sid);
    if (error) { setMsg("❌ מחיקה נכשלה: " + error.message); return; }
    if (activeSheet?.id === sid) {
      setActiveSheet(null);
      setSheetRows([]);
    }
    await loadRecentSheets();
    await loadAvailableLots();
    setMsg("✅ גיליון נמחק");
  }

  /** Totals for current sheet (info only) */
  const totals = useMemo(() => {
    const linked = sheetRows.reduce((s, r) => s + Number(r.qty_kg || 0), 0);
    return { linked };
  }, [sheetRows]);

  /** For input max hint */
  const selectedLot = lots.find(l => l.id === rowLotId);
  const remainingForSelected = Number(selectedLot?.remaining_kg || 0);

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 12, direction: "rtl" }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>🚚 זמן העמסה</h1>

      {msg && (
        <div style={{ marginBottom: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>
          {msg}
        </div>
      )}

      {/* Header: Create/Load sheet */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 12 }}>
          <div>
            <label>תאריך *</label>
            <input type="date" className="border p-2 w-full" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} />
          </div>
          <div>
            <label>שם נהג *</label>
            <input className="border p-2 w-full" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div>
            <label>הערה (אופציונלי)</label>
            <input className="border p-2 w-full" placeholder="מס׳ משאית / משמרת..." value={sheetNote} onChange={(e) => setSheetNote(e.target.value)} />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button className="border px-4 py-2 bg-gray-100 hover:bg-gray-200" onClick={createOrLoadSheet} disabled={!canEdit}>
              📄 צור/טען גיליון
            </button>
          </div>
        </div>
        {activeSheet && (
          <div style={{ marginTop: 10 }}>
            <button className="border px-3 py-1 bg-gray-100 hover:bg-gray-200" onClick={saveSheetNote} disabled={!canEdit}>
              💾 שמור הערה
            </button>
          </div>
        )}
      </div>

      {/* Lots available for loading (remaining > 0) */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>שם משחיטה זמינים להעמסה (יתרה &gt; 0)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-50">
                <Th>שם משחיטה</Th>
                <Th>מס’ תעודת משלוח (לוט)</Th>
                <Th>נטו שעובד</Th>
                <Th>כבר הועמס</Th>
                <Th>יתרה</Th>
              </tr>
            </thead>
            <tbody>
              {lots.length === 0 ? (
                <tr><td className="p-2" colSpan={5}>אין לוטים זמינים.</td></tr>
              ) : (
                lots.map(l => (
                  <tr key={l.id}>
                    <Td>{l.slaughter_company || "-"}</Td>
                    <Td>{l.shipment_number || "-"}</Td>
                    <Td>{Number(l.processed_net_kg || 0).toFixed(2)}</Td>
                    <Td>{Number(l.loaded_kg || 0).toFixed(2)}</Td>
                    <Td><b style={{ color: "#0a7" }}>{Number(l.remaining_kg || 0).toFixed(2)}</b></Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add row */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>הוספת שורה</h3>
        {!activeSheet && <div style={{ color: "crimson", marginBottom: 8 }}>צור/טען גיליון קודם.</div>}
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label>לקוח *</label>
            <select className="border p-2 w-full" value={rowCustomerId} onChange={(e) => setRowCustomerId(e.target.value)}>
              <option value="">— בחר —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>מס׳ תעודת משלוח *</label>
            <input className="border p-2 w-full" value={rowDelvNo} onChange={(e) => setRowDelvNo(e.target.value)} />
          </div>
          <div>
            <label>שם משחיטה *</label>
            <select className="border p-2 w-full" value={rowLotId} onChange={(e) => setRowLotId(e.target.value)}>
              <option value="">— בחר —</option>
              {lots.map(l => (
                <option key={l.id} value={l.id}>
                  {(l.slaughter_company || "—") + " • משלוח " + (l.shipment_number || "—") + " • יתרה " + Number(l.remaining_kg || 0).toFixed(2) + " ק״ג"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>כמות (ק״ג) *</label>
            <input
              type="number"
              className="border p-2 w-full"
              value={rowQty}
              onChange={(e) => setRowQty(e.target.value)}
              min={0}
              max={remainingForSelected > 0 ? remainingForSelected : undefined}
              placeholder={remainingForSelected > 0 ? `מקס׳ ${remainingForSelected.toFixed(2)} ק״ג` : "אין יתרה"}
            />
          </div>
          <div>
            <label>טמפ’</label>
            <input type="number" className="border p-2 w-full" value={rowTemp} onChange={(e) => setRowTemp(e.target.value)} />
          </div>
          <div>
            <label>מגדר *</label>
            <select
              className="border p-2 w-full"
              value={rowGender}
              onChange={(e)=>setRowGender(e.target.value as "male" | "female" | "")}
            >
              <option value="">— בחר —</option>
              <option value="male">זכר</option>
              <option value="female">נקבה</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="border px-4 py-2 bg-gray-100 hover:bg-gray-200" onClick={addRow} disabled={!canEdit || !activeSheet}>
            ➕ הוסף שורה
          </button>
        </div>
      </div>

      {/* Sheet rows (no "created at" column) */}
      {activeSheet && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>
            שורות לגיליון {activeSheet.load_date} — נהג: {activeSheet.driver_name} {activeSheet.note ? `— (${activeSheet.note})` : ""}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-50">
                  <Th>לקוח</Th>
                  <Th>מס׳ תעודת משלוח</Th>
                  <Th>שם משחיטה</Th>
                  <Th>מס’ משלוח לוט</Th>
                  <Th>כמות (ק״ג)</Th>
                  <Th>טמפ’</Th>
                  <Th>מגדר</Th>
                  <Th>פעולות</Th>
                </tr>
              </thead>
              <tbody>
                {sheetRows.length === 0 && <tr><td className="p-2" colSpan={8}>אין שורות עדיין.</td></tr>}
                {sheetRows.map(r => (
                  <tr key={r.id}>
                    <Td>{r.customer?.name ?? "-"}</Td>
                    <Td>{r.delivery_note_number}</Td>
                    <Td>{r.lot?.supplier || "-"}</Td>
                    <Td>{r.lot?.shipment_number || "-"}</Td>
                    <Td>{r.qty_kg}</Td>
                    <Td>{r.temp_at_loading ?? "-"}</Td>
                    <Td>{r.gender === "male" ? "זכר" : r.gender === "female" ? "נקבה" : "-"}</Td>
                    <Td>
                      <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200" onClick={() => removeRow(r.id)} disabled={!canEdit}>
                        מחק
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: "#444" }}>
            סה״כ שוייך בגיליון זה: <b>{totals.linked.toFixed(2)} ק״ג</b>
          </div>

          <div style={{ marginTop: 10 }}>
            <button className="border px-3 py-1 bg-gray-100 hover:bg-gray-200" onClick={() => window.print()}>
              🖨️ הדפס (שמירה כ-PDF)
            </button>
          </div>
        </div>
      )}

      {/* Recent sheets list */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 style={{ marginBottom: 8 }}>גליונות אחרונים</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <Th>תאריך</Th>
                <Th>נהג</Th>
                <Th>הערה</Th>
                <Th>פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {recentSheets.length === 0 && <tr><td className="p-2" colSpan={4}>אין גליונות להצגה.</td></tr>}
              {recentSheets.map(s => (
                <tr key={s.id}>
                  <Td>{s.load_date}</Td>
                  <Td>{s.driver_name}</Td>
                  <Td>{s.note ?? "-"}</Td>
                  <Td>
                    <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200" onClick={() => openSheet(s.id)}>פתח</button>{" "}
                    <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200" onClick={() => deleteSheet(s.id)} disabled={!canEdit}>מחק</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

/** ===== Small table helpers ===== */
function Th({ children }: { children: React.ReactNode }) {
  return <th className="border p-2 text-right whitespace-nowrap">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border p-2 text-right">{children}</td>;
}