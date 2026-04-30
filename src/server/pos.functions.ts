import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Verify authenticated user (any role)
async function getAuthUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user;
}

const PaymentSchema = z.object({
  method: z.enum(["cash", "card", "transfer", "edfaali", "mobicash", "mobinab", "yusrpay"]),
  amount: z.number().positive(),
});

const CartItemSchema = z.object({
  product_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable().optional(),
  quantity: z.number().positive(),
  selling_price: z.number().nonnegative(),
  cost_price: z.number().nonnegative(),
});

const CheckoutSchema = z.object({
  token: z.string().min(10),
  items: z.array(CartItemSchema).min(1),
  payments: z.array(PaymentSchema).min(1),
  discount: z.number().nonnegative().default(0),
  customer_id: z.string().uuid().nullable().optional(),
  drawer_id: z.string().uuid().nullable().optional(),
});

export const checkout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CheckoutSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await getAuthUser(data.token);

    // Validate prices and stock
    const productIds = [...new Set(data.items.map((i) => i.product_id))];
    const { data: prods, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, name, selling_price, current_stock, is_active")
      .in("id", productIds);
    if (pErr) throw new Error(pErr.message);
    const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));

    for (const item of data.items) {
      const p = prodMap.get(item.product_id);
      if (!p) throw new Error(`منتج غير موجود`);
      if (!p.is_active) throw new Error(`المنتج "${p.name}" غير مفعّل`);
      if (Number(p.selling_price) <= 0) throw new Error(`المنتج "${p.name}" بدون سعر بيع`);
      if (item.cost_price < 0) throw new Error(`سعر تكلفة غير صالح للمنتج "${p.name}"`);
      if (Number(p.current_stock) < item.quantity) {
        throw new Error(`مخزون غير كافٍ للمنتج "${p.name}" (المتاح: ${p.current_stock})`);
      }
    }

    // Compute totals
    const total_cost = data.items.reduce((s, i) => s + i.cost_price * i.quantity, 0);
    const subtotal = data.items.reduce((s, i) => s + i.selling_price * i.quantity, 0);
    const total_amount = Math.max(0, subtotal - data.discount);
    const profit = total_amount - total_cost;

    const paid = data.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paid - total_amount) > 0.01) {
      throw new Error(`مجموع المدفوعات (${paid.toFixed(2)}) لا يطابق الإجمالي (${total_amount.toFixed(2)})`);
    }

    // Create sale (invoice_number auto via trigger)
    const { data: sale, error: sErr } = await supabaseAdmin
      .from("sales")
      .insert({
        user_id: user.id,
        customer_id: data.customer_id ?? null,
        drawer_id: data.drawer_id ?? null,
        total_amount,
        total_cost,
        profit,
        discount: data.discount,
        invoice_number: "",
      })
      .select("id, invoice_number, created_at")
      .single();
    if (sErr || !sale) throw new Error(sErr?.message || "فشل إنشاء الفاتورة");

    // Insert sale items
    const itemsRows = data.items.map((i) => ({
      sale_id: sale.id,
      product_id: i.product_id,
      batch_id: i.batch_id ?? null,
      quantity: i.quantity,
      selling_price: i.selling_price,
      cost_price: i.cost_price,
      total: i.selling_price * i.quantity,
    }));
    const { error: siErr } = await supabaseAdmin.from("sale_items").insert(itemsRows);
    if (siErr) {
      await supabaseAdmin.from("sales").delete().eq("id", sale.id);
      throw new Error(siErr.message);
    }

    // Insert payments
    const payRows = data.payments.map((p) => ({
      sale_id: sale.id,
      method: p.method,
      amount: p.amount,
    }));
    const { error: payErr } = await supabaseAdmin.from("payments").insert(payRows);
    if (payErr) {
      await supabaseAdmin.from("sale_items").delete().eq("sale_id", sale.id);
      await supabaseAdmin.from("sales").delete().eq("id", sale.id);
      throw new Error(payErr.message);
    }

    // Insert stock movements (triggers auto-decrement product/batch stock)
    const movRows = data.items.map((i) => ({
      product_id: i.product_id,
      batch_id: i.batch_id ?? null,
      type: "sale" as const,
      quantity: i.quantity,
      reference_id: sale.id,
      created_by: user.id,
    }));
    const { error: mvErr } = await supabaseAdmin.from("stock_movements").insert(movRows);
    if (mvErr) throw new Error(mvErr.message);

    return {
      ok: true,
      sale_id: sale.id,
      invoice_number: sale.invoice_number,
      created_at: sale.created_at,
      total_amount,
      total_cost,
      profit,
    };
  });

const VoidSaleSchema = z.object({
  token: z.string().min(10),
  sale_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const voidSale = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VoidSaleSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await getAuthUser(data.token);
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("للمدير فقط");

    const { data: sale } = await supabaseAdmin
      .from("sales")
      .select("id, is_voided")
      .eq("id", data.sale_id)
      .maybeSingle();
    if (!sale) throw new Error("الفاتورة غير موجودة");
    if (sale.is_voided) throw new Error("الفاتورة ملغاة بالفعل");

    const { data: items } = await supabaseAdmin
      .from("sale_items")
      .select("product_id, batch_id, quantity")
      .eq("sale_id", data.sale_id);

    // Reverse stock via "return" movements
    if (items && items.length > 0) {
      await supabaseAdmin.from("stock_movements").insert(
        items.map((i) => ({
          product_id: i.product_id,
          batch_id: i.batch_id,
          type: "return" as const,
          quantity: i.quantity,
          reference_id: data.sale_id,
          created_by: user.id,
          notes: `إلغاء فاتورة: ${data.reason}`,
        }))
      );
    }

    await supabaseAdmin
      .from("sales")
      .update({ is_voided: true })
      .eq("id", data.sale_id);

    return { ok: true };
  });
