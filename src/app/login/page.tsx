"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** עוטפים את התוכן ש*משתמש* ב-useSearchParams בתוך Suspense */
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, direction: "rtl" }}>טוען…</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const nextUrl = search.get("next") || "/dashboard"; // יעד אחרי התחברות

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // אם כבר מחובר—דלג ליעד
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(nextUrl);
    });
  }, [router, nextUrl]);

  async function signIn(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMsg("❌ " + error.message);
        return;
      }
      setMsg("✅ התחברת בהצלחה");
      router.replace(nextUrl);
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setMsg("❌ " + error.message);
        return;
      }
      setMsg("✅ החשבון נוצר. בדוק מייל אם נדרש אימות, ואז התחבר.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("✅ נותקת מהמערכת");
  }

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f7f7f8", direction: "rtl" }}>
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ width: 380 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12, textAlign: "center" }}>
          התחברות / הרשמה
        </h1>

        <form onSubmit={signIn} className="grid gap-3">
          <div>
            <label>אימייל</label>
            <input
              className="border p-2 w-full"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </div>
          <div>
            <label>סיסמה</label>
            <input
              className="border p-2 w-full"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="border px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
            {loading ? "מתחבר…" : "התחבר"}
          </button>

          <button type="button" onClick={signUp} className="border px-4 py-2 bg-white hover:bg-gray-50">
            הרשמה
          </button>

          <button type="button" onClick={signOut} className="border px-4 py-2 bg-white hover:bg-gray-50">
            ניתוק
          </button>

          {msg && <div style={{ color: msg.startsWith("❌") ? "crimson" : "#0a7" }}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}