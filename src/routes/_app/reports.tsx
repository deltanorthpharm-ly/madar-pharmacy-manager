import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Ban, Printer, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { editSale } from "@/server/edits.functions";
import { voidSale } from "@/server/pos.functions";

export const Route = createFileRoute("/_app/reports")({
  component: SalesManagementPage,
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
  user_id: string;
};

function SalesManagementPage() {
  const { role, session } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<Sale | null>(null);
  const [discount, setDiscount] = useState("0");
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-list", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Sale[];
    },
  });

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing || !session?.access_token) throw new Error("غير مسجل");
      const d = parseFloat(discount);
      if (isNaN(d) || d < 0) throw new Error("خصم غير صالح");
      await editSale({
        data: { token: session.access_token, sale_id: editing.id, discount: d },
      });
    },
    onSuccess: () => {
      toast.success("تم تعديل الفاتورة");
      qc.invalidateQueries({ queryKey: ["sales-list"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidMut = useMutation({
    mutationFn: async () => {
      if (!voiding || !session?.access_token) throw new Error("غير مسجل");
      if (!voidReason.trim()) throw new Error("السبب مطلوب");
      await voidSale({
        data: { token: session.access_token, sale_id: voiding.id, reason: voidReason },
      });
    },
    onSuccess: () => {
      toast.success("تم إلغاء الفاتورة");
      qc.invalidateQueries({ queryKey: ["sales-list"] });
      setVoiding(null);
      setVoidReason("");
    },
    onError: (e: Error) => toast.error(e.message),
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

  const totalRevenue = sales.filter((s) => !s.is_voided).reduce((a, s) => a + Number(s.total_amount), 0);
  const totalProfit = sales.filter((s) => !s.is_voided).reduce((a, s) => a + Number(s.profit), 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">إدارة الفواتير</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div>
            <Label>من</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>إلى</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">عدد الفواتير</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{sales.filter((s) => !s.is_voided).length}</p></CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي المبيعات</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalRevenue.toFixed(2)}</p></CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي الأرباح</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{totalProfit.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفاتورة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>الخصم</TableHead>
              <TableHead>الربح</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">جارٍ التحميل...</TableCell></TableRow>
            ) : sales.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
            ) : (
              sales.map((s) => (
                <TableRow key={s.id} className={s.is_voided ? "opacity-50" : ""}>
                  <TableCell className="font-mono">{s.invoice_number}</TableCell>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("ar")}</TableCell>
                  <TableCell className="font-bold">{Number(s.total_amount).toFixed(2)}</TableCell>
                  <TableCell>{Number(s.discount).toFixed(2)}</TableCell>
                  <TableCell className="text-green-600">{Number(s.profit).toFixed(2)}</TableCell>
                  <TableCell>
                    {s.is_voided ? (
                      <Badge variant="destructive">ملغاة</Badge>
                    ) : (
                      <Badge variant="default">نشطة</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link to="/invoice/$saleId" params={{ saleId: s.id }} target="_blank">
                        <Button size="icon" variant="ghost"><Printer className="h-4 w-4" /></Button>
                      </Link>
                      {!s.is_voided && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => {
                            setEditing(s);
                            setDiscount(String(s.discount));
                          }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setVoiding(s)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل الفاتورة {editing?.invoice_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الخصم الجديد</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">سيُعاد حساب الإجمالي والربح تلقائياً.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => editMut.mutate()} disabled={editMut.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>إلغاء الفاتورة {voiding?.invoice_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">سيتم إعادة الكميات للمخزون تلقائياً.</p>
            <div>
              <Label>سبب الإلغاء</Label>
              <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => voidMut.mutate()} disabled={voidMut.isPending}>
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
