import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Admin-only helper to verify caller is admin
async function assertAdmin(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Forbidden: admin only");
  return data.user.id;
}

const CreateCashierSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(1).max(100),
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_]+$/, "اسم المستخدم: حروف إنجليزية وأرقام فقط"),
  pin: z.string().regex(/^\d{4,6}$/, "PIN يجب أن يكون 4-6 أرقام"),
});

export const createCashier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateCashierSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);

    const email = `${data.username.toLowerCase()}@cashier.madar.local`;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.pin,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, username: data.username },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || "تعذر إنشاء الكاشير");
    }

    const userId = created.user.id;

    await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
    }).eq("id", userId);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "cashier" });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId, email };
  });

const ListCashiersSchema = z.object({ token: z.string().min(10) });

export const listCashiers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ListCashiersSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "cashier");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { cashiers: [] };
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, is_active")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    const cashiers = (profs ?? []).map((p) => ({
      user_id: p.id,
      profiles: { id: p.id, full_name: p.full_name, is_active: p.is_active },
    }));
    return { cashiers };
  });

export const listCashiersPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "cashier");
  if (error) throw new Error(error.message);
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return { cashiers: [] };
  const { data: profs, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, is_active")
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);
  return {
    cashiers: (profs ?? [])
      .filter((p) => p.is_active)
      .map((p) => ({ id: p.id, name: p.full_name })),
  };
});

const GetCashierEmailSchema = z.object({ cashierId: z.string().uuid() });
export const getCashierEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GetCashierEmailSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.cashierId);
    if (error || !u.user) throw new Error("Cashier not found");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.cashierId)
      .eq("role", "cashier")
      .maybeSingle();
    if (!roleRow) throw new Error("Not a cashier");
    return { email: u.user.email! };
  });

const SignupAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(100),
});

export const signupFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupAdminSchema.parse(input))
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      throw new Error("يوجد مدير مسجل بالفعل. سجّل الدخول من شاشة المدير.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message || "تعذر إنشاء حساب المدير");

    await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });

    return { ok: true };
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

// Toggle cashier active status
const ToggleCashierSchema = z.object({
  token: z.string().min(10),
  cashierId: z.string().uuid(),
  isActive: z.boolean(),
});
export const toggleCashierActive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ToggleCashierSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.cashierId);
    if (error) throw new Error(error.message);
    // also ban/unban auth user
    if (!data.isActive) {
      await supabaseAdmin.auth.admin.updateUserById(data.cashierId, { ban_duration: "876000h" });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(data.cashierId, { ban_duration: "none" });
    }
    return { ok: true };
  });

// Reset cashier PIN
const ResetPinSchema = z.object({
  token: z.string().min(10),
  cashierId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN يجب أن يكون 4-6 أرقام"),
});
export const resetCashierPin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResetPinSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.cashierId, {
      password: data.pin,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
