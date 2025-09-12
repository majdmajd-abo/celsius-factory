"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/** טיפוסים תואמים ל-raw_receipt_lines ול-logים */
type Lot = {
  id: string;
  supplier: string | null;                // שם ספק/משחיטה
  qty_kg: number | null;
  slaughter_date: string | null;          // YYYY-MM-DD
  expiry_date: string | null;
  expected_yield_pct: number | null;      // אם לא מולא → null
  finished: boolean | null;
};

type LogRow = {
  id: string;
  proc_date: string;          // YYYY-MM-DD
  output_net_kg: number;
  note: string | null;
  gender: "male" | "female" | null; // ← חדש
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
  const [formGender, setFormGender] = useState<"" | "male" | "female">(""); // ← חדש
  const [formNote, setFormNote] = useState<string>("");

  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [finishing, setFinishing] = useState<boolean>(false);

  const canEdit = role === "production_manager" || role === "factory_manager";

  /** נטו צפוי = ברוטו × (אחוז/100) ; אם אחוז לא מולא נשתמש ב-64% */
  const expectedNet = useMemo(() => {
    if (!currentLot) return 0;
    const pct = ((currentLot.expected_yield_pct ?? 64) / 100);
    return Number(((currentLot.qty_kg ?? 0) * pct).toFixed(2));
  }, [currentLot]);

  const actualNetSum = useMemo(
    () => Number(logs.reduce((s, r) => s + Number(r.output_net_kg || 0), 0).toFixed(2)),
    [logs]
  );

  const shortage = useMemo(
    () => Math.max(0, Number((expectedNet - actualNetSum).toFixed(2))),
    [expectedNet, actualNetSum]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);

      // תפקיד
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      // role
      const { data: myRole, error: roleErr } = await supabase.rpc("get_my_role");
      setRole(roleErr ? "employee" : (myRole || "employee"));

      // לוטים פתוחים
      const { data: openLots, error } = await supabase
        .from("raw_receipt_lines")
        .select("id,supplier,qty_kg,slaughter_date,expiry_date,expected_yield_pct,finished")
        .eq("finished", false)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("❌ שגיאה בטעינת הלוטים: " + error.message);
        setLots([]);
      } else {
        setLots((openLots as Lot[]) || []);
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedLotId) { setCurrentLot(null); setLogs([]); return; }
    (async () => {
      setMsg("");

      // פרטי הלוט
      const { data: lot, error: lotErr } = await supabase
        .from("raw_receipt_lines")
        .select("id,supplier,qty_kg,slaughter_date,expiry_date,expected_yield_pct,finished")
        .eq("id", selectedLotId)
        .single();

      if (lotErr) {
        setMsg("❌ שגיאה בטעינת הלוט: " + lotErr.message);
        setCurrentLot(null);
        setLogs([]);
        return;
      }

      setCurrentLot(lot as Lot);
      setLotSlaughter((lot as any)?.slaughter_date ?? "");
      setLotExpiry((lot as any)?.expiry_date ?? "");

      // לוגים ללוט זה (כולל gender)
      const { data: lgs, error: logErr } = await supabase
        .from("lot_process_logs")
        .select("id,proc_date,output_net_kg,note,gender")
        .eq("receipt_line_id", selectedLotId)
        .order("proc_date", { ascending: true });

      if (logErr) {
        setMsg("ℹ️ טבלת היומנים אינה זמינה כרגע.");
        setLogs([]);
      } else {
        setLogs((lgs as LogRow[]) || []);
      }
    })();
  }, [selectedLotId]);

  const saveLotDates = async () => {
    if (!canEdit || !currentLot) return;
    const { error } = await supabase
      .from("raw_receipt_lines")
      .update({
        slaughter_date: lotSlaughter || null,
        expiry_date: lotExpiry || null
      })
      .eq("id", currentLot.id);

    if (error) setMsg("❌ שמירת התאריכים נכשלה: " + error.message);
    else setMsg("✅ התאריכים נשמרו");
  };

  const addDailyLog = async () => {
    setMsg("");
    if (!canEdit) return setMsg("❌ אין לך הרשאה להוסיף");
    if (!currentLot) return setMsg("❌ בחר לוט תחילה");

    const d = formDate || new Date().toISOString().slice(0, 10);
    const net = Number(formNet);
    if (!net) return setMsg("⚠️ הכנס כמות נטו (ק״ג)");
    if (!formGender) return setMsg("⚠️ בחר מגדר (זכר/נקבה)");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setMsg("❌ ההתחברות פגה");

      const { error } = await supabase.from("lot_process_logs").insert({
        receipt_line_id: currentLot.id,
        proc_date: d,
        output_net_kg: net,
        gender: formGender,        // ← לשמור מגדר
        note: formNote || null,
        created_by: user.id
      });
      if (error) { console.error(error); return setMsg("❌ שגיאה: " + error.message); }

      // רענון טבלה
      const { data: lgs } = await supabase
        .from("lot_process_logs")
        .select("id,proc_date,output_net_kg,note,gender")
        .eq("receipt_line_id", currentLot.id)
        .order("proc_date", { ascending: true });
      setLogs((lgs as LogRow[]) || []);
      setMsg("✅ נוסף בהצלחה");
      setFormDate(""); setFormNet(""); setFormNote(""); setFormGender(""); // אפס טופס
    } finally {
      setSaving(false);
    }
  };

  const finishLot = async () => {
    if (!canEdit || !currentLot) return;
    setFinishing(true);
    try {
      const { error } = await supabase
        .from("raw_receipt_lines")
        .update({ finished: true })
        .eq("id", currentLot.id);

      if (error) {
        console.error(error);
        setMsg("❌ סגירת הלוט נכשלה: " + error.message);
        return;
      }

      setMsg("✅ הלוט נסגר");
      setLots(prev => prev.filter(l => l.id !== currentLot.id));
      setSelectedLotId(null);
      setCurrentLot(null);
      setLogs([]);
    } finally {
      setFinishing(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 980, margin: "20px auto", padding: 12, direction:"rtl" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>🏭 יומן ייצור</h1>

      {/* בחירת לוט */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
        <label>בחר לוט פתוח</label>
        <select
          value={selectedLotId ?? ""}
          onChange={(e)=>setSelectedLotId(e.target.value || null)}
          className="border p-2 w-full mt-1"
        >
          <option value="">— בחר —</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>
              {(l.supplier || "ללא שם")} — ברוטו: {l.qty_kg ?? 0} ק״ג
            </option>
          ))}
        </select>
        {!lots.length && <div style={{ marginTop: 8, color: "#666" }}>אין לוטים פתוחים.</div>}
      </div>

      {currentLot && (
        <>
          {/* פרטי לוט */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>פרטי לוט</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <div><div>ספק:</div><b>{currentLot.supplier || "-"}</b></div>
              <div><div>ברוטו (ק״ג):</div><b>{currentLot.qty_kg ?? 0}</b></div>
              <div><div>אחוז צפוי:</div><b>{currentLot.expected_yield_pct ?? 64}%</b></div>
              <div><div>סטטוס:</div><b>{currentLot.finished ? "סגור" : "פתוח"}</b></div>
            </div>

            <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <div>
                <label>תאריך שחיטה</label>
                <input
                  type="date"
                  className="border p-2 w-full"
                  value={lotSlaughter || ""}
                  onChange={(e)=>setLotSlaughter(e.target.value)}
                />
              </div>
              <div>
                <label>תאריך פג תוקף</label>
                <input
                  type="date"
                  className="border p-2 w-full"
                  value={lotExpiry || ""}
                  onChange={(e)=>setLotExpiry(e.target.value)}
                />
              </div>
              <div style={{ alignSelf: "end" }}>
                <button
                  onClick={saveLotDates}
                  disabled={!canEdit}
                  className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  שמור תאריכים
                </button>
              </div>
              <div style={{ alignSelf: "end" }}>
                <button
                  onClick={finishLot}
                  disabled={!canEdit || finishing}
                  className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  {finishing ? "סוגר…" : "סגור לוט"}
                </button>
              </div>
            </div>
          </div>

          {/* כרטיס חישוב 64% */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>חישוב 64% (להנהלה)</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div>צפוי: <b>{expectedNet.toFixed(2)} ק״ג</b></div>
              <div>נטו בפועל: <b>{actualNetSum.toFixed(2)} ק״ג</b></div>
              <div>חוסר: <b style={{ color: shortage > 0 ? "crimson" : "green" }}>{shortage.toFixed(2)} ק״ג</b></div>
            </div>
          </div>

          {/* הוספת יומן יומי: תאריך + נטו + מגדר + הערה */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>הוסף רישום יומי</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 2fr" }}>
              <div>
                <label>תאריך</label>
                <input
                  type="date"
                  className="border p-2 w-full"
                  value={formDate}
                  onChange={(e)=>setFormDate(e.target.value)}
                />
              </div>
              <div>
                <label>נטו (ק״ג) *</label>
                <input
                  type="number"
                  className="border p-2 w-full"
                  value={formNet}
                  onChange={(e)=>setFormNet(e.target.value)}
                />
              </div>
              <div>
                <label>מגדר *</label>
                <select
                  className="border p-2 w-full"
                  value={formGender}
                  onChange={(e)=>setFormGender(e.target.value as "male" | "female" | "")}
                >
                  <option value="">— בחר —</option>
                  <option value="male">זכר</option>
                  <option value="female">נקבה</option>
                </select>
              </div>
              <div>
                <label>הערה</label>
                <input
                  className="border p-2 w-full"
                  value={formNote}
                  onChange={(e)=>setFormNote(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                onClick={addDailyLog}
                disabled={!canEdit || saving}
                className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                {saving ? "שומר…" : "הוסף"}
              </button>
            </div>
            <div style={{ marginTop: 10, color: msg.startsWith("✅") ? "green" : "crimson" }}>{msg}</div>
          </div>

          {/* טבלת יומנים */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>רישומי הימים ללוט זה</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-right">תאריך</th>
                    <th className="border p-2 text-right">נטו (ק״ג)</th>
                    <th className="border p-2 text-right">מגדר</th>
                    <th className="border p-2 text-right">הערה</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr><td className="border p-2" colSpan={4}>אין רישומים ללוט זה.</td></tr>
                  )}
                  {logs.map(r => (
                    <tr key={r.id}>
                      <td className="border p-2">{r.proc_date}</td>
                      <td className="border p-2">{r.output_net_kg}</td>
                      <td className="border p-2">
                        {r.gender === "male" ? "זכר" : r.gender === "female" ? "נקבה" : "-"}
                      </td>
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