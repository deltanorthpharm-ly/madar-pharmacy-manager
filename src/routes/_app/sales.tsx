import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Printer, RotateCcw, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/sales")({
  component: SalesPage,
});

type Sale = {
  id: string;
  invoice_number: string;
  total_amount: number;
  total_cost: number;
  profit: number;
  discount: number;
  is_voided: boolean;
  created_at: string;
  customer_id: string | null;
};

function SalesPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [showVoided, setShowVoided] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-list", showVoided],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!showVoided) q = q.eq("is_voided", false);
      const { data, error } = await q;
      if (error) throw error;
      return data as Sale[];
    },
  });

  const filtered = sales.filter((s) =>
    !search ? true : s.invoice_number.toLowerCase().includes(search.toLowerCase()),
  );

  const totalSales = filtered.filter((s) => !s.is_voided).reduce((a, s) => a + Number(s.total_amount), 0);
  const totalProfit = filtered.filter((s) => !s.is_voided).reduce((a, s) => a + Number(s.profit), 0);
  const voidedCount = filtered.filter((s) => s.is_voided).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المبيعات والمرتجعات</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">إجمالي المبيعات</div>
          <div className="text-2xl font-bold text-primary">{totalSales.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">إجمالي الربح</div>
          <div className="text-2xl font-bold text-success">{totalProfit.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">فواتير ملغاة / مرتجعة</div>
          <div className="text-2xl font-bold text-destructive">{voidedCount}</div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الفاتورة..."
            className="ps-3 pe-9"
          />
        </div>
        <Button
          variant={showVoided ? "default" : "outline"}
          onClick={() => setShowVoided(!showVoided)}
          size="sm"
        >
          {showVoided ? "إخفاء الملغاة" : "إظهار الملغاة"}
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>الخصم</TableHead>
              <TableHead>الربح</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">جارٍ التحميل...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id} className={s.is_voided ? "opacity-60" : ""}>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("ar")}</TableCell>
                  <TableCell className="font-mono">{s.invoice_number}</TableCell>
                  <TableCell className="font-bold">{Number(s.total_amount).toFixed(2)}</TableCell>
                  <TableCell>{Number(s.discount).toFixed(2)}</TableCell>
                  <TableCell className="text-success">{Number(s.profit).toFixed(2)}</TableCell>
                  <TableCell>
                    {s.is_voided ? (
                      <Badge variant="destructive">ملغاة / مرتجعة</Badge>
                    ) : (
                      <Badge variant="secondary">مكتملة</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button asChild size="icon" variant="ghost" title="عرض">
                        <Link to="/invoice/$saleId" params={{ saleId: s.id }} target="_blank">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild size="icon" variant="ghost" title="طباعة">
                        <Link to="/invoice/$saleId" params={{ saleId: s.id }} target="_blank">
                          <Printer className="h-4 w-4" />
                        </Link>
                      </Button>
                      {role === "admin" && !s.is_voided && (
                        <Button size="icon" variant="ghost" title="إرتجاع" disabled>
                          <RotateCcw className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 لإلغاء فاتورة وإرجاع المخزون، استخدم صفحة <b>سجل التعديلات</b> (للأدمن).
      </p>
    </div>
  );
}
