import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileJson, FileSpreadsheet, Database } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/data")({
  component: DataPage,
});

const TABLES = [
  "products", "categories", "customers", "suppliers",
  "sales", "sale_items", "purchases", "purchase_items",
  "expenses", "stock_movements", "product_batches",
  "cash_drawers", "cash_transactions", "partner_withdrawals",
] as const;

function DataPage() {
  const { role } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (role !== "admin") {
    return <div className="p-6 text-center text-muted-foreground">صلاحية الأدمن مطلوبة</div>;
  }

  async function fetchAll() {
    const result: Record<string, any[]> = {};
    for (const t of TABLES) {
      const { data, error } = await supabase.from(t).select("*").limit(10000);
      if (error) throw new Error(`${t}: ${error.message}`);
      result[t] = data || [];
    }
    return result;
  }

  async function exportExcel() {
    setBusy("excel");
    try {
      const data = await fetchAll();
      const wb = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(data)) {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      }
      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `byan-pharma-backup-${date}.xlsx`);
      toast.success("تم تصدير الملف");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function exportJSON() {
    setBusy("json");
    try {
      const data = await fetchAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url; a.download = `byan-pharma-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير الملف");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function exportTable(table: string) {
    setBusy(table);
    try {
      const { data, error } = await supabase.from(table as any).select("*").limit(10000);
      if (error) throw error;
      const ws = XLSX.utils.json_to_sheet((data || []) as any[]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
      XLSX.writeFile(wb, `${table}-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success(`تم تصدير ${table}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">البيانات والنسخ الاحتياطية</h1>
        <p className="text-sm text-muted-foreground mt-1">تصدير قاعدة البيانات بصيغ مختلفة للحفظ خارجياً.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> نسخة Excel كاملة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">جميع الجداول في ملف Excel واحد (ورقة لكل جدول).</p>
            <Button onClick={exportExcel} disabled={busy !== null} className="w-full">
              <Download className="ms-2 h-4 w-4" /> {busy === "excel" ? "جارٍ التحضير..." : "تنزيل Excel"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" /> نسخة JSON كاملة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">نسخة احتياطية بصيغة JSON يمكن استرجاعها برمجياً.</p>
            <Button onClick={exportJSON} disabled={busy !== null} className="w-full" variant="secondary">
              <Download className="ms-2 h-4 w-4" /> {busy === "json" ? "جارٍ التحضير..." : "تنزيل JSON"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> تصدير جدول مفرد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {TABLES.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                onClick={() => exportTable(t)}
                disabled={busy !== null}
                className="justify-between"
              >
                <span className="font-mono text-xs">{t}</span>
                <Download className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
