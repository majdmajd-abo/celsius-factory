"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function signIn() {
    try {
      setLoading(true);
      setMsg("מתחבר...");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg("❌ " + error.message);
        return;
      }
      setMsg("✅ התחברת בהצלחה");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    try {
      setLoading(true);
      setMsg("יוצר משתמש...");
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg("❌ " + error.message);
        return;
      }
      // ברירת מחדל: role=employee יוגדר ב-trigger/שרת אם יש
      setMsg("✅ החשבון נוצר. אפשר ללחוץ 'Login'.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("✅ נותקת מהמערכת");
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", direction: "rtl" }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>התחברות / הרשמה</h1>

      <input
        className="border p-2 w-full mb-2"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <input
        className="border p-2 w-full mb-2"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      <div className="flex gap-2 mb-2">
        <button onClick={signIn} className="border px-4 py-2" disabled={loading}>
          Login
        </button>
        <button onClick={signUp} className="border px-4 py-2" disabled={loading}>
          Sign Up
        </button>
        <button onClick={signOut} className="border px-4 py-2" disabled={loading}>
          Sign Out
        </button>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: msg.startsWith("✅") ? "#eaffea" : msg.startsWith("❌") ? "#ffecec" : "#f7f7f7",
            border: "1px solid",
            borderColor: msg.startsWith("✅") ? "#9bd59b" : msg.startsWith("❌") ? "#ffb3b3" : "#e0e0e0",
            fontSize: 14,
          }}
        >
          {msg}
        </div>
      )}

      <p className="text-sm mt-2">
        במהלך פיתוח: ודא שב־Supabase Authentication סוג <b>Email/Password</b> פעיל, וש־
        <b>Confirm email</b> מבוטל (או בדוק מייל לאימות).
      </p>
    </div>
  );
}