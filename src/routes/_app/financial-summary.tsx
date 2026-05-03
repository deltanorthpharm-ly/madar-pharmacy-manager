import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, Package,
  Receipt, Users, Truck, ShieldAlert, Download,
} from "lucide-react";

export const Route = createFileRoute("/_app/financial-summary")({
  component: FinancialSummaryPage,
});

function FinancialSummaryPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["financial-summary", from, to],
    enabled: isAdmin,
    queryFn: async () => {
      const fromTs = from + "T00:00:00";
      const toTs = to + "T23:59:59";

      const [salesRes, expensesRes, purchasesRes, withdrawalsRes, suppliersRes, customersRes, productsRes, paymentsRes] = await Promise.all([
        supabase.from("sales").select("total_amount,total_cost,profit,discount,is_voided,created_at").gte("created_at", fromTs).lte("created_at", toTs),
        supabase.from("expenses").select("amount,category,created_at").gte("created_at", fromTs).lte("created_at", toTs),
        supabase.from("purchases").select("total_amount,paid_amount,created_at").gte("created_at", fromTs).lte("created_at", toTs),
        supabase.from("partner_withdrawals").select("amount,partner_name,created_at").gte("created_at", fromTs).lte("created_at", toTs),
        supabase.from("suppliers").select("name,balance"),
        supabase.from("customers").select("name,balance"),
        supabase.from("products").select("current_stock,purchase_price,selling_price,is_active"),
        supabase.from("payments").select("method,amount,created_at,sale_id").gte("created_at", fromTs).lte("created_at", toTs),
      ]);

      if (salesRes.error) throw salesRes.error;

      const sales = (salesRes.data ?? []).filter((s) => !s.is_voided);
      const revenue = sales.reduce((a, s) => a + Number(s.total_amount), 0);
      const cogs = sales.reduce((a, s) => a + Number(s.total_cost), 0);
      const grossProfit = sales.reduce((a, s) => a + Number(s.profit), 0);
      const totalDiscount = sales.reduce((a, s) => a + Number(s.discount), 0);

      const expenses = expensesRes.data ?? [];
      const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
      const expensesByCategory: Record<string, number> = {};
      for (const e of expenses) {
        const k = e.category || "بدون تصنيف";
        expensesByCategory[k] = (expensesByCategory[k] || 0) + Number(e.amount);
      }

      const netProfit = grossProfit - totalExpenses;

      const purchases = purchasesRes.data ?? [];
      const totalPurchases = purchases.reduce((a, p) => a + Number(p.total_amount), 0);
      const purchasesPaid = purchases.reduce((a, p) => a + Number(p.paid_amount), 0);
      const purchasesUnpaid = totalPurchases - purchasesPaid;

      const withdrawals = withdrawalsRes.data ?? [];
      const totalWithdrawals = withdrawals.reduce((a, w) => a + Number(w.amount), 0);

      const suppliers = suppliersRes.data ?? [];
      const supplierDebt = suppliers.reduce((a, s) => a + Number(s.balance), 0);
      const customers = customersRes.data ?? [];
      const customerDebt = customers.reduce((a, c) => a + Number(c.balance), 0);

      const products = productsRes.data ?? [];
      const inventoryValue = products.reduce((a, p) => a + Number(p.current_stock) * Number(p.purchase_price), 0);
      const inventoryRetail = products.reduce((a, p) => a + Number(p.current_stock) * Number(p.selling_price), 0);

      const payments = paymentsRes.data ?? [];
      const paymentsByMethod: Record<string, number> = {};
      for (const p of payments) {
        const k = String(p.method);
        paymentsByMethod[k] = (paymentsByMethod[k] || 0) + Number(p.amount);
      }

      return {
        revenue, cogs, grossProfit, netProfit, totalDiscount,
        totalExpenses, expensesByCategory,
        totalPurchases, purchasesPaid, purchasesUnpaid,
        totalWithdrawals, withdrawals,
        supplierDebt, customerDebt, suppliers, customers,
        inventoryValue, inventoryRetail,
        salesCount: sales.length, paymentsByMethod,
        expensesCount: expenses.length,
      };
    },
  });

  if (!isAdmin) {
    return (
      <Card className="m-6">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <p className="font-semibold">للمدير فقط</p>
        </CardContent>
      </Card>
    );
  }

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["البند", "القيمة"],
      ["إجمالي الإيرادات", data.revenue.toFixed(2)],
      ["تكلفة البضاعة المباعة", data.cogs.toFixed(2)],
      ["إجمالي الخصومات", data.totalDiscount.toFixed(2)],
      ["مجمل الربح", data.grossProfit.toFixed(2)],
      ["إجمالي المصاريف", data.totalExpenses.toFixed(2)],
      ["صافي الربح", data.netProfit.toFixed(2)],
      ["إجمالي المشتريات", data.totalPurchases.toFixed(2)],
      ["مدفوع للموردين", data.purchasesPaid.toFixed(2)],
      ["مستحق للموردين", data.purchasesUnpaid.toFixed(2)],
      ["سحوبات الشركاء", data.totalWithdrawals.toFixed(2)],
      ["ديون الموردين الإجمالية", data.supplierDebt.toFixed(2)],
      ["ديون العملاء الإجمالية", data.customerDebt.toFixed(2)],
      ["قيمة المخزون (تكلفة)", data.inventoryValue.toFixed(2)],
      ["قيمة المخزون (بيع)", data.inventoryRetail.toFixed(2)],
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-summary-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">الملخص المالي الشامل</h1>
        <Button variant="outline" onClick={exportCsv} disabled={!data}>
          <Download className="h-4 w-4 ms-2" /> تصدير CSV
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div>
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date();
              setFrom(d.toISOString().slice(0, 10));
              setTo(d.toISOString().slice(0, 10));
            }}>اليوم</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date();
              d.setDate(1);
              setFrom(d.toISOString().slice(0, 10));
              setTo(new Date().toISOString().slice(0, 10));
            }}>هذا الشهر</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date();
              d.setMonth(0, 1);
              setFrom(d.toISOString().slice(0, 10));
              setTo(new Date().toISOString().slice(0, 10));
            }}>هذه السنة</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">جارٍ تحميل البيانات...</CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="الإيرادات" value={data.revenue} icon={DollarSign} color="text-primary" />
            <KpiCard label="مجمل الربح" value={data.grossProfit} icon={TrendingUp} color="text-success" />
            <KpiCard label="المصاريف" value={data.totalExpenses} icon={Receipt} color="text-warning" />
            <KpiCard label="صافي الربح" value={data.netProfit} icon={data.netProfit >= 0 ? TrendingUp : TrendingDown} color={data.netProfit >= 0 ? "text-success" : "text-destructive"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Sales breakdown */}
            <Card>
              <CardHeader><CardTitle>تحليل المبيعات</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="عدد الفواتير" value={data.salesCount.toString()} />
                <Row label="إجمالي الإيرادات" value={data.revenue.toFixed(2)} />
                <Row label="تكلفة البضاعة المباعة" value={data.cogs.toFixed(2)} />
                <Row label="إجمالي الخصومات" value={data.totalDiscount.toFixed(2)} />
                <Row label="مجمل الربح" value={data.grossProfit.toFixed(2)} highlight="text-success" />
                <Row label="هامش الربح" value={data.revenue > 0 ? ((data.grossProfit / data.revenue) * 100).toFixed(1) + "%" : "0%"} />
              </CardContent>
            </Card>

            {/* Payment methods */}
            <Card>
              <CardHeader><CardTitle>طرق الدفع</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.keys(data.paymentsByMethod).length === 0 ? (
                  <p className="text-muted-foreground">لا توجد بيانات</p>
                ) : (
                  Object.entries(data.paymentsByMethod).map(([k, v]) => (
                    <Row key={k} label={methodLabel(k)} value={v.toFixed(2)} />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader><CardTitle>المصاريف ({data.expensesCount})</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.keys(data.expensesByCategory).length === 0 ? (
                  <p className="text-muted-foreground">لا توجد مصاريف</p>
                ) : (
                  Object.entries(data.expensesByCategory).map(([k, v]) => (
                    <Row key={k} label={k} value={v.toFixed(2)} />
                  ))
                )}
                <div className="border-t pt-2">
                  <Row label="الإجمالي" value={data.totalExpenses.toFixed(2)} highlight="text-warning" />
                </div>
              </CardContent>
            </Card>

            {/* Purchases */}
            <Card>
              <CardHeader><CardTitle><Truck className="inline h-4 w-4 ms-2" />المشتريات والموردين</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="إجمالي المشتريات (الفترة)" value={data.totalPurchases.toFixed(2)} />
                <Row label="مدفوع" value={data.purchasesPaid.toFixed(2)} />
                <Row label="مستحق (الفترة)" value={data.purchasesUnpaid.toFixed(2)} />
                <div className="border-t pt-2">
                  <Row label="إجمالي ديون الموردين الحالية" value={data.supplierDebt.toFixed(2)} highlight="text-destructive" />
                </div>
              </CardContent>
            </Card>

            {/* Customers */}
            <Card>
              <CardHeader><CardTitle><Users className="inline h-4 w-4 ms-2" />ديون العملاء</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="إجمالي ديون العملاء" value={data.customerDebt.toFixed(2)} highlight="text-warning" />
                <p className="text-muted-foreground text-xs pt-2">عدد العملاء: {data.customers.length}</p>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader><CardTitle><Package className="inline h-4 w-4 ms-2" />قيمة المخزون</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="بسعر التكلفة" value={data.inventoryValue.toFixed(2)} />
                <Row label="بسعر البيع" value={data.inventoryRetail.toFixed(2)} highlight="text-primary" />
                <Row label="الربح المحتمل" value={(data.inventoryRetail - data.inventoryValue).toFixed(2)} highlight="text-success" />
              </CardContent>
            </Card>

            {/* Withdrawals */}
            <Card>
              <CardHeader><CardTitle><Wallet className="inline h-4 w-4 ms-2" />سحوبات الشركاء</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="إجمالي السحوبات (الفترة)" value={data.totalWithdrawals.toFixed(2)} highlight="text-destructive" />
                <p className="text-muted-foreground text-xs pt-2">عدد السحوبات: {data.withdrawals.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Final P&L */}
          <Card className="border-primary">
            <CardHeader><CardTitle>قائمة الدخل المختصرة</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>البند</TableHead><TableHead className="text-end">القيمة</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>إجمالي الإيرادات</TableCell><TableCell className="text-end font-mono">{data.revenue.toFixed(2)}</TableCell></TableRow>
                  <TableRow><TableCell>(-) تكلفة البضاعة المباعة</TableCell><TableCell className="text-end font-mono">({data.cogs.toFixed(2)})</TableCell></TableRow>
                  <TableRow className="bg-muted/50"><TableCell className="font-bold">مجمل الربح</TableCell><TableCell className="text-end font-mono font-bold text-success">{data.grossProfit.toFixed(2)}</TableCell></TableRow>
                  <TableRow><TableCell>(-) المصاريف التشغيلية</TableCell><TableCell className="text-end font-mono">({data.totalExpenses.toFixed(2)})</TableCell></TableRow>
                  <TableRow className="bg-muted"><TableCell className="font-bold text-base">صافي الربح</TableCell><TableCell className={`text-end font-mono font-bold text-base ${data.netProfit >= 0 ? "text-success" : "text-destructive"}`}>{data.netProfit.toFixed(2)}</TableCell></TableRow>
                  <TableRow><TableCell>(-) سحوبات الشركاء</TableCell><TableCell className="text-end font-mono">({data.totalWithdrawals.toFixed(2)})</TableCell></TableRow>
                  <TableRow className="bg-primary/10"><TableCell className="font-bold">المتبقي بعد السحوبات</TableCell><TableCell className="text-end font-mono font-bold">{(data.netProfit - data.totalWithdrawals).toFixed(2)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${highlight ?? ""}`}>{value}</span>
    </div>
  );
}

function methodLabel(m: string): string {
  const map: Record<string, string> = {
    cash: "نقدي", card: "بطاقة", credit: "آجل", transfer: "تحويل",
  };
  return map[m] || m;
}
