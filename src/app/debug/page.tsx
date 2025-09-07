"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DebugPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user || null);
      const { data: r } = await supabase.rpc("get_my_role");
      setRole(r ?? null);
    })();
  }, []);

  return (
    <pre style={{ padding: 16, background: "#f7f7f7" }}>
      {JSON.stringify({
        session_email: user?.email || null,
        session_user_id: user?.id || null,
        rpc_get_my_role: role
      }, null, 2)}
    </pre>
  );
}