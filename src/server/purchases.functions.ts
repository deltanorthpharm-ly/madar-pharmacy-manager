import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PurchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  cost_price: z.number().nonnegative(),
  batch_number: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
});

const CreatePurchaseSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  supplier_name: z.string().optional().nullable(),
  paid_amount: z.number().nonnegative().default(0),
  items: z.array(PurchaseItemSchema).min(1),
  update_selling_prices: z.array(
    z.object({ product_id: z.string().uuid(), selling_price: z.number().nonnegative() }),
  ).optional().default([]),
});

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreatePurchaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const total_amount = data.items.reduce(
      (s, i) => s + i.quantity * i.cost_price,
      0,
    );

    // 1. Create purchase header
    const { data: purchase, error: pErr } = await supabase
      .from("purchases")
      .insert({
        supplier_id: data.supplier_id || null,
        supplier_name: data.supplier_name || null,
        total_amount,
        paid_amount: data.paid_amount,
        user_id: userId,
      })
      .select()
      .single();
    if (pErr) throw new Error(pErr.message);

    // 2. For each item: create batch (if has_expiry) then purchase_item then stock_movement
    for (const item of data.items) {
      const { data: prod } = await supabase
        .from("products")
        .select("has_expiry")
        .eq("id", item.product_id)
        .single();

      let batch_id: string | null = null;
      if (prod?.has_expiry) {
        const { data: batch, error: bErr } = await supabase
          .from("product_batches")
          .insert({
            product_id: item.product_id,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
            quantity: 0, // trigger will add via stock_movement
            cost_price: item.cost_price,
          })
          .select()
          .single();
        if (bErr) throw new Error(bErr.message);
        batch_id = batch.id;
      }

      const { error: piErr } = await supabase.from("purchase_items").insert({
        purchase_id: purchase.id,
        product_id: item.product_id,
        batch_id,
        quantity: item.quantity,
        cost_price: item.cost_price,
        total: item.quantity * item.cost_price,
      });
      if (piErr) throw new Error(piErr.message);

      const { error: smErr } = await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        batch_id,
        type: "purchase",
        quantity: item.quantity,
        reference_id: purchase.id,
        created_by: userId,
        notes: `Purchase ${purchase.invoice_number || ""}`,
      });
      if (smErr) throw new Error(smErr.message);

      // Update purchase_price on product
      await supabase
        .from("products")
        .update({ purchase_price: item.cost_price })
        .eq("id", item.product_id);
    }

    // 3. Update selling prices if provided
    for (const sp of data.update_selling_prices) {
      await supabase
        .from("products")
        .update({ selling_price: sp.selling_price })
        .eq("id", sp.product_id);
    }

    // 4. Update supplier balance (debt = total - paid)
    if (data.supplier_id) {
      const debt = total_amount - data.paid_amount;
      if (debt !== 0) {
        const { data: sup } = await supabase
          .from("suppliers")
          .select("balance")
          .eq("id", data.supplier_id)
          .single();
        await supabase
          .from("suppliers")
          .update({ balance: Number(sup?.balance || 0) + debt })
          .eq("id", data.supplier_id);
      }
    }

    return { id: purchase.id, invoice_number: purchase.invoice_number };
  });
