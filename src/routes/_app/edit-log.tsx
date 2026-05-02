import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Search, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/edit-log")({
  component: EditLogPage,
});

const TABLES = [
  "sales", "sale_items", "payments",
  "purchases", "purchase_items",
  "expenses", "products", "product_batches",
  "cash_drawers", "cash_transactions",
  "customers", "suppliers", "partner_withdrawals",
  "stock_movements",
];

const TABLE_LABELS: Record<string, string> = {
  sales: "المبيعات",
  sale_items: "بنود المبيعات",
  payments: "المدفوعات",
  purchases: "المشتريات",
  purchase_items: "بنود المشتريات",
  expenses: "المصاريف",
  products: "المنتجات",
  product_batches: "دفعات المنتج",
  cash_drawers: "الخزائن",
  cash_transactions: "حركات الخزينة",
  customers: "العملاء",
  suppliers: "الموردين",
  partner_withdrawals: "سحوبات الشركاء",
  stock_movements: "حركات المخزون",
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INSERT: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
};

interface LogRow {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  edited_by: string | null;
  edited_at: string;
}

function EditLogPage() {
  const { role } = useAuth();
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchId, setSearchId] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["edit-log", tableFilter, actionFilter, searchId],
    queryFn: async () => {
      let q = supabase
        .from("edit_log")
        .select("*")
        .order("edited_at", { ascending: false })
        .limit(200);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (searchId.trim()) q = q.eq("record_id", searchId.trim());
      const { data, error } = await q;
      if (error) throw error;
      return data as LogRow[];
    },
    enabled: role === "admin",
  });

  // Fetch editor names
  const editorIds = [...new Set((data ?? []).map((r) => r.edited_by).filter(Boolean) as string[])];
  const { data: editors } = useQuery({
    queryKey: ["edit-log-editors", editorIds.join(",")],
    queryFn: async () => {
      if (editorIds.length === 0) return new Map<string, string>();
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", editorIds);
      return new Map((data ?? []).map((p) => [p.id, p.full_name]));
    },
    enabled: editorIds.length > 0,
  });

  if (role !== "admin") {
    return (
      <Card className="m-6">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <p className="font-semibold">للمدير فقط</p>
          <p className="text-sm text-muted-foreground">سجل التعديلات متاح للمدير فقط</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>سجل التعديلات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger><SelectValue placeholder="كل الجداول" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الجداول</SelectItem>
                {TABLES.map((t) => (
                  <SelectItem key={t} value={t}>{TABLE_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="كل الإجراءات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإجراءات</SelectItem>
                <SelectItem value="INSERT">إضافة</SelectItem>
                <SelectItem value="UPDATE">تعديل</SelectItem>
                <SelectItem value="DELETE">حذف</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث برقم السجل (UUID)"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="pe-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (data ?? []).length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">لا توجد تعديلات</p>
          ) : (
            <div className="space-y-2">
              {(data ?? []).map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ACTION_VARIANT[row.action] ?? "outline"}>
                      {ACTION_LABEL[row.action] ?? row.action}
                    </Badge>
                    <span className="font-medium">{TABLE_LABELS[row.table_name] ?? row.table_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.edited_at).toLocaleString("ar-EG")}
                    </span>
                    {row.edited_by && editors?.get(row.edited_by) && (
                      <span className="text-xs text-muted-foreground">
                        — {editors.get(row.edited_by)}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                    <Eye className="me-1 h-4 w-4" />
                    عرض
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DiffDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function DiffDialog({ row, onClose }: { row: LogRow | null; onClose: () => void }) {
  if (!row) return null;
  const before = row.before_data ?? {};
  const after = row.after_data ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ACTION_LABEL[row.action]} — {TABLE_LABELS[row.table_name] ?? row.table_name}
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          ID: {row.record_id} • {new Date(row.edited_at).toLocaleString("ar-EG")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="p-2 text-start">الحقل</th>
                <th className="p-2 text-start">قبل</th>
                <th className="p-2 text-start">بعد</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const b = (before as Record<string, unknown>)[k];
                const a = (after as Record<string, unknown>)[k];
                const changed = JSON.stringify(b) !== JSON.stringify(a);
                return (
                  <tr key={k} className={changed ? "bg-warning/10" : ""}>
                    <td className="p-2 font-mono text-xs">{k}</td>
                    <td className="p-2 font-mono text-xs text-destructive">{formatVal(b)}</td>
                    <td className="p-2 font-mono text-xs text-green-600 dark:text-green-400">{formatVal(a)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
