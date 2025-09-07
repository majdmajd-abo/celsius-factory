"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string;
  role: string;
};

export default function UsersPage() {
  const [role, setRole] = useState<string>("employee"); // دوري أنا
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string>("");

  // تحميل دوري الحقيقي عبر الـ RPC
  const loadMyRole = async () => {
    const { data: myRole, error: roleErr } = await supabase.rpc("get_my_role");
    if (roleErr) {
      console.error(roleErr);
      setRole("employee");
    } else {
      setRole(myRole || "employee");
    }
  };

  // تحميل قائمة المستخدمين (للـ manager فقط)
  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role")
      .order("email", { ascending: true });

    if (error) {
      console.error(error);
      setMsg("❌ لم أستطع تحميل المستخدمين");
    } else {
      setUsers(data as Profile[]);
      setMsg("");
    }
    setLoading(false);
  };

  // تحديث دور مستخدم
  const updateRole = async (id: string, newRole: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMsg("❌ فشل تحديث الدور");
    } else {
      setMsg("✅ تم تحديث الدور");
      loadUsers();
    }
  };

  useEffect(() => {
    loadMyRole();
    loadUsers();
  }, []);

  if (loading) return <p>⏳ جاري التحميل...</p>;

  // لو مش factory_manager نمنع الوصول
  if (role !== "factory_manager") {
    return <p>🚫 هذه الصفحة للمدير فقط</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 className="text-xl font-bold mb-4">إدارة المستخدمين</h1>
      {msg && <p>{msg}</p>}
      <table className="border-collapse border border-gray-300 w-full">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">البريد الإلكتروني</th>
            <th className="border p-2">الدور</th>
            <th className="border p-2">تغيير الدور</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.role}</td>
              <td className="border p-2">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u.id, e.target.value)}
                  className="border p-1"
                >
                  <option value="employee">موظف</option>
                  <option value="production_manager">مدير إنتاج</option>
                  <option value="factory_manager">مدير مصنع</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}