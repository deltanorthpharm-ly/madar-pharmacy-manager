import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("للمدير فقط");
  return data.user.id;
}

// ---------- Edit Sale (discount/customer) ----------
const EditSaleSchema = z.object({
  token: z.string().min(10),
  sale_id: z.string().uuid(),
  discount: z.number().nonnegative(),
  customer_id: z.string().uuid().nullable().optional(),
});

export const editSale = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EditSaleSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);

    const { data: sale } = await supabaseAdmin
      .from("sales")
      .select("id, total_cost, total_amount, discount")
      .eq("id", data.sale_id)
      .maybeSingle();
    if (!sale) throw new Error("الفاتورة غير موجودة");

    const { data: items } = await supabaseAdmin
      .from("sale_items")
      .select("selling_price, quantity")
      .eq("sale_id", data.sale_id);
    const subtotal = (items ?? []).reduce(
      (s, i) => s + Number(i.selling_price) * Number(i.quantity),
      0
    );
    const newTotal = Math.max(0, subtotal - data.discount);
    const newProfit = newTotal - Number(sale.total_cost);

    const { error } = await supabaseAdmin
      .from("sales")
      .update({
        discount: data.discount,
        total_amount: newTotal,
        profit: newProfit,
        customer_id: data.customer_id ?? null,
      })
      .eq("id", data.sale_id);
    if (error) throw new Error(error.message);
    return { ok: true, total_amount: newTotal, profit: newProfit };
  });

// ---------- Edit Expense ----------
const EditExpenseSchema = z.object({
  token: z.string().min(10),
  expense_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const editExpense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EditExpenseSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);
    const { data: exp } = await supabaseAdmin
      .from("expenses")
      .select("id, drawer_id, amount")
      .eq("id", data.expense_id)
      .maybeSingle();
    if (!exp) throw new Error("المصروف غير موجود");

    const { error } = await supabaseAdmin
      .from("expenses")
      .update({
        title: data.title,
        amount: data.amount,
        category: data.category ?? null,
        notes: data.notes ?? null,
      })
      .eq("id", data.expense_id);
    if (error) throw new Error(error.message);

    // Sync linked cash_transactions amount if exists
    if (exp.drawer_id) {
      await supabaseAdmin
        .from("cash_transactions")
        .update({ amount: -Math.abs(data.amount) })
        .eq("reference_id", data.expense_id)
        .eq("type", "expense");
    }
    return { ok: true };
  });

// ---------- Delete Expense ----------
const DeleteExpenseSchema = z.object({
  token: z.string().min(10),
  expense_id: z.string().uuid(),
});

export const deleteExpense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteExpenseSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);
    await supabaseAdmin
      .from("cash_transactions")
      .delete()
      .eq("reference_id", data.expense_id)
      .eq("type", "expense");
    const { error } = await supabaseAdmin.from("expenses").delete().eq("id", data.expense_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Edit Purchase header (paid amount, supplier) ----------
const EditPurchaseSchema = z.object({
  token: z.string().min(10),
  purchase_id: z.string().uuid(),
  paid_amount: z.number().nonnegative(),
  supplier_name: z.string().nullable().optional(),
});

export const editPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EditPurchaseSchema.parse(input))
  .handler(async ({ data }) => {
    await assertAdmin(data.token);
    const { data: pur } = await supabaseAdmin
      .from("purchases")
      .select("id, supplier_id, total_amount, paid_amount")
      .eq("id", data.purchase_id)
      .maybeSingle();
    if (!pur) throw new Error("الفاتورة غير موجودة");

    const oldDebt = Number(pur.total_amount) - Number(pur.paid_amount);
    const newDebt = Number(pur.total_amount) - data.paid_amount;
    const debtDiff = newDebt - oldDebt;

    const { error } = await supabaseAdmin
      .from("purchases")
      .update({
        paid_amount: data.paid_amount,
        supplier_name: data.supplier_name ?? null,
      })
      .eq("id", data.purchase_id);
    if (error) throw new Error(error.message);

    if (pur.supplier_id && Math.abs(debtDiff) > 0.001) {
      const { data: sup } = await supabaseAdmin
        .from("suppliers")
        .select("balance")
        .eq("id", pur.supplier_id)
        .maybeSingle();
      if (sup) {
        await supabaseAdmin
          .from("suppliers")
          .update({ balance: Number(sup.balance) + debtDiff })
          .eq("id", pur.supplier_id);
      }
    }
    return { ok: true };
  });
