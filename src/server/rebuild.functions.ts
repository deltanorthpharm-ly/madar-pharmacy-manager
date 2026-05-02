import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RebuildType = "inventory" | "financials" | "product_integrity" | "anomalies";

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

async function setProgress(id: string, progress: number, partial?: Record<string, unknown>) {
  const update: Record<string, unknown> = { progress };
  if (partial) update.report = partial;
  await supabaseAdmin.from("system_rebuilds").update(update).eq("id", id);
}

// ---- Inventory rebuild: recompute products.current_stock from stock_movements ----
async function runInventoryRebuild(id: string) {
  const report: Record<string, unknown> = {
    type: "inventory",
    fixed: [] as Array<{ product_id: string; name: string; old: number; new: number }>,
    warnings: [] as string[],
  };
  await setProgress(id, 10, report);

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, current_stock");
  const total = products?.length ?? 0;
  let i = 0;
  for (const p of products ?? []) {
    const { data: moves } = await supabaseAdmin
      .from("stock_movements")
      .select("type, quantity")
      .eq("product_id", p.id);
    let computed = 0;
    for (const m of moves ?? []) {
      const q = Number(m.quantity);
      if (m.type === "sale") computed -= q;
      else computed += q; // purchase/return/adjustment/rebuild
    }
    const old = Number(p.current_stock);
    if (Math.abs(old - computed) > 0.001) {
      await supabaseAdmin
        .from("products")
        .update({ current_stock: computed })
        .eq("id", p.id);
      (report.fixed as unknown[]).push({
        product_id: p.id,
        name: p.name,
        old,
        new: computed,
      });
    }
    if (computed < 0) {
      (report.warnings as string[]).push(`مخزون سالب: ${p.name} (${computed})`);
    }
    i++;
    if (i % 5 === 0) await setProgress(id, 10 + Math.floor((i / Math.max(total, 1)) * 80), report);
  }
  await setProgress(id, 100, report);
  return report;
}

// ---- Financials rebuild: recompute sales.total_cost & profit from sale_items ----
async function runFinancialsRebuild(id: string) {
  const report: Record<string, unknown> = {
    type: "financials",
    fixed: [] as Array<{ sale_id: string; old_profit: number; new_profit: number }>,
    warnings: [] as string[],
  };
  await setProgress(id, 10, report);

  const { data: sales } = await supabaseAdmin
    .from("sales")
    .select("id, total_amount, total_cost, profit, discount, is_voided")
    .eq("is_voided", false);
  const total = sales?.length ?? 0;
  let i = 0;
  for (const s of sales ?? []) {
    const { data: items } = await supabaseAdmin
      .from("sale_items")
      .select("selling_price, cost_price, quantity")
      .eq("sale_id", s.id);
    const subtotal = (items ?? []).reduce(
      (a, it) => a + Number(it.selling_price) * Number(it.quantity),
      0
    );
    const cost = (items ?? []).reduce(
      (a, it) => a + Number(it.cost_price) * Number(it.quantity),
      0
    );
    const newTotal = Math.max(0, subtotal - Number(s.discount));
    const newProfit = newTotal - cost;
    if (
      Math.abs(Number(s.total_cost) - cost) > 0.001 ||
      Math.abs(Number(s.profit) - newProfit) > 0.001 ||
      Math.abs(Number(s.total_amount) - newTotal) > 0.001
    ) {
      await supabaseAdmin
        .from("sales")
        .update({ total_cost: cost, profit: newProfit, total_amount: newTotal })
        .eq("id", s.id);
      (report.fixed as unknown[]).push({
        sale_id: s.id,
        old_profit: Number(s.profit),
        new_profit: newProfit,
      });
    }
    i++;
    if (i % 10 === 0)
      await setProgress(id, 10 + Math.floor((i / Math.max(total, 1)) * 80), report);
  }
  await setProgress(id, 100, report);
  return report;
}

// ---- Product integrity: missing prices, missing categories, duplicate barcodes ----
async function runProductIntegrity(id: string) {
  const report: Record<string, unknown> = {
    type: "product_integrity",
    missing_price: [] as Array<{ id: string; name: string }>,
    missing_cost: [] as Array<{ id: string; name: string }>,
    duplicate_barcodes: [] as Array<{ barcode: string; count: number }>,
    inactive_with_stock: [] as Array<{ id: string; name: string; stock: number }>,
  };
  await setProgress(id, 20, report);

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, selling_price, purchase_price, barcode, is_active, current_stock");
  const seen = new Map<string, number>();
  for (const p of products ?? []) {
    if (!Number(p.selling_price))
      (report.missing_price as unknown[]).push({ id: p.id, name: p.name });
    if (!Number(p.purchase_price))
      (report.missing_cost as unknown[]).push({ id: p.id, name: p.name });
    if (p.barcode) seen.set(p.barcode, (seen.get(p.barcode) ?? 0) + 1);
    if (!p.is_active && Number(p.current_stock) > 0)
      (report.inactive_with_stock as unknown[]).push({
        id: p.id,
        name: p.name,
        stock: Number(p.current_stock),
      });
  }
  for (const [barcode, count] of seen.entries()) {
    if (count > 1) (report.duplicate_barcodes as unknown[]).push({ barcode, count });
  }
  await setProgress(id, 100, report);
  return report;
}

// ---- Anomalies: negative stock, expired batches still in stock, sales with no payments ----
async function runAnomalies(id: string) {
  const report: Record<string, unknown> = {
    type: "anomalies",
    negative_stock: [] as Array<{ id: string; name: string; stock: number }>,
    expired_with_stock: [] as Array<{ batch_id: string; product: string; expiry: string; quantity: number }>,
    sales_no_payment: [] as Array<{ sale_id: string; invoice_number: string; total: number }>,
    near_expiry: [] as Array<{ batch_id: string; product: string; expiry: string; quantity: number }>,
  };
  await setProgress(id, 15, report);

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, current_stock");
  for (const p of products ?? []) {
    if (Number(p.current_stock) < 0)
      (report.negative_stock as unknown[]).push({
        id: p.id,
        name: p.name,
        stock: Number(p.current_stock),
      });
  }
  await setProgress(id, 40, report);

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { data: batches } = await supabaseAdmin
    .from("product_batches")
    .select("id, expiry_date, quantity, product_id, products(name)")
    .gt("quantity", 0);
  for (const b of batches ?? []) {
    if (!b.expiry_date) continue;
    const productName = (b as { products?: { name?: string } }).products?.name ?? "—";
    if (b.expiry_date < today)
      (report.expired_with_stock as unknown[]).push({
        batch_id: b.id,
        product: productName,
        expiry: b.expiry_date,
        quantity: Number(b.quantity),
      });
    else if (b.expiry_date <= in30)
      (report.near_expiry as unknown[]).push({
        batch_id: b.id,
        product: productName,
        expiry: b.expiry_date,
        quantity: Number(b.quantity),
      });
  }
  await setProgress(id, 75, report);

  const { data: sales } = await supabaseAdmin
    .from("sales")
    .select("id, invoice_number, total_amount, is_voided")
    .eq("is_voided", false)
    .gt("total_amount", 0);
  for (const s of sales ?? []) {
    const { count } = await supabaseAdmin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", s.id);
    if (!count)
      (report.sales_no_payment as unknown[]).push({
        sale_id: s.id,
        invoice_number: s.invoice_number,
        total: Number(s.total_amount),
      });
  }
  await setProgress(id, 100, report);
  return report;
}

// ---- Start rebuild (fire-and-forget) ----
const StartSchema = z.object({
  token: z.string().min(10),
  type: z.enum(["inventory", "financials", "product_integrity", "anomalies"]),
});

export const startRebuild = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StartSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await assertAdmin(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("system_rebuilds")
      .insert({
        type: data.type,
        status: "running",
        triggered_by: userId,
        progress: 0,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to start");

    // Fire-and-forget background execution
    void (async () => {
      try {
        let report: unknown;
        const t = data.type as RebuildType;
        if (t === "inventory") report = await runInventoryRebuild(row.id);
        else if (t === "financials") report = await runFinancialsRebuild(row.id);
        else if (t === "product_integrity") report = await runProductIntegrity(row.id);
        else report = await runAnomalies(row.id);

        await supabaseAdmin
          .from("system_rebuilds")
          .update({
            status: "completed",
            progress: 100,
            finished_at: new Date().toISOString(),
            report: report as object,
          })
          .eq("id", row.id);
      } catch (e) {
        await supabaseAdmin
          .from("system_rebuilds")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            report: { error: e instanceof Error ? e.message : String(e) },
          })
          .eq("id", row.id);
      }
    })();

    return { id: row.id };
  });
