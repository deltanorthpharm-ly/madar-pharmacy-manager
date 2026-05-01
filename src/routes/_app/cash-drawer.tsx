import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, LockOpen, Lock, History } from "lucide-react";

export const Route = createFileRoute("/_app/cash-drawer")({
  component: CashDrawerPage,
});

type Drawer = {
  id: string;
  user_id: string;
  opening_balance: number;
  expected_balance: number;
  closing_balance: number | null;
  is_open: boolean;
  opened_at: string;
  closed_at: string | null;
};

type CashTx = {
  id: string;
  drawer_id: string;
  type: string;
  amount: number;
  notes: string | null;
  reference_id: string | null;
  created_at: string;
};

function CashDrawerPage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [opening, setOpening] = useState("0");
  const [actualCash, setActualCash] = useState("0");
  const [closeNotes, setCloseNotes] = useState("");

  const { data: openDrawer, isLoading: ld1 } = useQuery({
    queryKey: ["my-open-drawer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_drawers")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_open", true)
        .maybeSingle();
      if (error) throw error;
      return data as Drawer | null;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-drawers", user?.id, role],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("cash_drawers").select("*").order("opened_at", { ascending: false }).limit(50);
      if (role !== "admin") q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Drawer[];
    },
  });

  const { data: drawerTx = [] } = useQuery({
    queryKey: ["drawer-tx", openDrawer?.id],
    enabled: !!openDrawer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("*")
        .eq("drawer_id", openDrawer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CashTx[];
    },
  });

  // Compute live expected from opening + sum cash transactions + sum cash payments for sales in this drawer
  const { data: liveExpected = 0 } = useQuery({
    queryKey: ["drawer-expected", openDrawer?.id],
    enabled: !!openDrawer?.id,
    queryFn: async () => {
      const opening = Number(openDrawer!.opening_balance);
      // Sum cash payments for sales in this drawer
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("drawer_id", openDrawer!.id)
        .eq("is_voided", false);
      const ids = (sales ?? []).map((s) => s.id);
      let cashIn = 0;
      if (ids.length > 0) {
        const { data: pays } = await supabase
          .from("payments")
          .select("amount, method, sale_id")
          .in("sale_id", ids)
          .eq("method", "cash");
        cashIn = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
      }
      const txSum = drawerTx.reduce((s, t) => s + Number(t.amount), 0);
      return opening + cashIn + txSum;
    },
  });

  const openMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(opening) || 0;
      if (!user) throw new Error("غير مسجل");
      if (openDrawer) throw new Error("لديك خزنة مفتوحة بالفعل");
      const { error } = await supabase.from("cash_drawers").insert({
        user_id: user.id,
        opening_balance: amt,
        expected_balance: amt,
        is_open: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم فتح الخزنة");
      qc.invalidateQueries({ queryKey: ["my-open-drawer"] });
      qc.invalidateQueries({ queryKey: ["my-drawers"] });
      qc.invalidateQueries({ queryKey: ["open-drawer"] });
      setOpenDialog(false);
      setOpening("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      if (!openDrawer) throw new Error("لا توجد خزنة مفتوحة");
      const actual = parseFloat(actualCash) || 0;
      const expected = liveExpected;
      const diff = actual - expected;
      const { error } = await supabase
        .from("cash_drawers")
        .update({
          is_open: false,
          closed_at: new Date().toISOString(),
          closing_balance: actual,
          expected_balance: expected,
        })
        .eq("id", openDrawer.id);
      if (error) throw error;
      // Log closing record (always) — type=closing, amount=actual
      await supabase.from("cash_transactions").insert({
        drawer_id: openDrawer.id,
        type: "closing",
        amount: actual,
        notes: `إقفال — متوقع: ${expected.toFixed(2)} | فرق: ${diff.toFixed(2)} | ${closeNotes || ""}`,
      });
    },
    onSuccess: () => {
      toast.success("تم قفل الخزنة");
      qc.invalidateQueries({ queryKey: ["my-open-drawer"] });
      qc.invalidateQueries({ queryKey: ["my-drawers"] });
      qc.invalidateQueries({ queryKey: ["open-drawer"] });
      setCloseDialog(false);
      setActualCash("0");
      setCloseNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const diff = (parseFloat(actualCash) || 0) - liveExpected;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> الخزنة</h1>
          <p className="text-sm text-muted-foreground mt-1">فتح وقفل خزنتك مع تسوية النقدية</p>
        </div>
        {!openDrawer && !ld1 && (
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2"><LockOpen className="h-4 w-4" /> فتح خزنة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>فتح خزنة جديدة</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>رصيد الافتتاح (نقدي)</Label>
                  <Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => openMut.mutate()} disabled={openMut.isPending}>تأكيد الفتح</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {openDrawer && (
          <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2"><Lock className="h-4 w-4" /> قفل الخزنة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>قفل الخزنة</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md border p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>رصيد الافتتاح:</span><span>{Number(openDrawer.opening_balance).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold"><span>المتوقع في الخزنة:</span><span>{liveExpected.toFixed(2)}</span></div>
                </div>
                <div>
                  <Label>النقدية الفعلية في الخزنة</Label>
                  <Input type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} />
                </div>
                <div className={`rounded-md border p-2 text-sm font-bold ${Math.abs(diff) < 0.01 ? "text-success" : diff > 0 ? "text-warning" : "text-destructive"}`}>
                  الفرق: {diff.toFixed(2)} {diff > 0 ? "(زيادة)" : diff < 0 ? "(عجز)" : "(مطابق)"}
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>تأكيد القفل</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {openDrawer ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">رصيد الافتتاح</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{Number(openDrawer.opening_balance).toFixed(2)}</p></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">المتوقع الآن</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-primary">{liveExpected.toFixed(2)}</p></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">فُتحت في</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{new Date(openDrawer.opened_at).toLocaleString("ar")}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">حركات الخزنة (مصاريف/تسويات)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوقت</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawerTx.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا توجد حركات</TableCell></TableRow>
                  ) : drawerTx.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("ar")}</TableCell>
                      <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                      <TableCell className={Number(t.amount) < 0 ? "text-destructive font-bold" : "text-success font-bold"}>
                        {Number(t.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            لا توجد خزنة مفتوحة لك حالياً. اضغط "فتح خزنة" للبدء.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> سجل الخزائن السابقة</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الفتح</TableHead>
                <TableHead>القفل</TableHead>
                <TableHead>افتتاح</TableHead>
                <TableHead>متوقع</TableHead>
                <TableHead>فعلي</TableHead>
                <TableHead>الفرق</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا يوجد</TableCell></TableRow>
              ) : history.map((d) => {
                const dd = d.closing_balance != null ? Number(d.closing_balance) - Number(d.expected_balance) : null;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{new Date(d.opened_at).toLocaleString("ar")}</TableCell>
                    <TableCell className="text-xs">{d.closed_at ? new Date(d.closed_at).toLocaleString("ar") : "-"}</TableCell>
                    <TableCell>{Number(d.opening_balance).toFixed(2)}</TableCell>
                    <TableCell>{Number(d.expected_balance).toFixed(2)}</TableCell>
                    <TableCell>{d.closing_balance != null ? Number(d.closing_balance).toFixed(2) : "-"}</TableCell>
                    <TableCell className={dd == null ? "" : Math.abs(dd) < 0.01 ? "text-success" : dd > 0 ? "text-warning" : "text-destructive"}>
                      {dd != null ? dd.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell>
                      {d.is_open ? <Badge>مفتوحة</Badge> : <Badge variant="secondary">مقفلة</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
