"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const signIn = async () => {
    setMsg("...");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg("❌ " + error.message);
    setMsg("✅ Logged in");
    window.location.href = "/dashboard";       // تحويل تلقائي
  };

  const signUp = async () => {
    setMsg("...");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setMsg("❌ " + error.message);
    setMsg("✅ Account created (default role = employee). Now press Login.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMsg("✅ Logged out");
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Login / Sign Up</h1>
      <input className="border p-2 w-full mb-2" placeholder="Email"
             value={email} onChange={(e)=>setEmail(e.target.value)} />
      <input type="password" className="border p-2 w-full mb-2" placeholder="Password"
             value={password} onChange={(e)=>setPassword(e.target.value)} />
      <div className="flex gap-2 mb-2">
        <button onClick={signIn} className="border px-4 py-2">Login</button>
        <button onClick={signUp} className="border px-4 py-2">Sign Up</button>
        <button onClick={signOut} className="border px-4 py-2">Sign Out</button>
      </div>
      <div>{msg}</div>
      <p className="text-sm mt-2">تأكد أن Email/Password مفعّل وأن Confirm email معطّل أثناء التطوير.</p>
    </div>
  );
}
