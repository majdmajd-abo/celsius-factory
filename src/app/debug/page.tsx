/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SupaUser = {
  id: string;
  email?: string;
};

export default function DebugPage() {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? undefined,
        });
      } else {
        setUser(null);
      }

      const { data: r } = await supabase.rpc("get_my_role");
      setRole((r as string) ?? null);
    })();
  }, []);

  return (
    <pre style={{ padding: 16, background: "#f7f7f7" }}>
      {JSON.stringify(
        {
          session_email: user?.email || null,
          session_user_id: user?.id || null,
          rpc_get_my_role: role,
        },
        null,
        2
      )}
    </pre>
  );
}