import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, UserCog, KeyRound, Power, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  createCashier, listCashiers, toggleCashierActive, resetCashierPin,
} from "@/server/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

type Cashier = { user_id: string; profiles: { id: string; full_name: string; is_active: boolean } };

function EmployeesPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Cashier[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pinDialog, setPinDialog] = useState<Cashier | null>(null);
  const [statsDialog, setStatsDialog] = useState<Cashier | null>(null);

  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/dashboard" });
  }, [role, navigate]);

  const reload = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const r = await listCashiers({ data: { token: session.access_token } });
      setItems(r.cashiers as unknown as Cashier[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  };

  useEffect(() => { void reload(); }, []);

  const handleToggle = async (c: Cashier) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await toggleCashierActive({
        data: { token: session.access_token, cashierId: c.user_id, isActive: !c.profiles.is_active },
      });
      toast.success(c.profiles.is_active ? "تم إيقاف الكاشير" : "تم تفعيل الكاشير");
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  };

  if (role !== "admin") return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الموظفين</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة الكاشيرز وأرقامهم السرية</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> إضافة كاشير</Button>
          </DialogTrigger>
          <AddCashierDialog onCreated={() => { setOpen(false); void reload(); }} />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> الكاشيرز</CardTitle>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا يوجد كاشيرز بعد. أضف أول كاشير.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.user_id}>
                    <TableCell className="font-medium">{c.profiles.full_name}</TableCell>
                    <TableCell>
                      {c.profiles.is_active
                        ? <Badge>نشط</Badge>
                        : <Badge variant="secondary">متوقف</Badge>}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setStatsDialog(c)}>
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPinDialog(c)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant={c.profiles.is_active ? "destructive" : "default"} onClick={() => handleToggle(c)}>
                        <Power className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pinDialog && (
        <ResetPinDialog cashier={pinDialog} onClose={() => setPinDialog(null)} />
      )}
      {statsDialog && (
        <CashierStatsDialog cashier={statsDialog} onClose={() => setStatsDialog(null)} />
      )}
    </div>
  );
}

function AddCashierDialog({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await createCashier({ data: { token: session.access_token, fullName, username, pin } });
      toast.success("تم إنشاء الكاشير");
      setFullName(""); setUsername(""); setPin("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally { setBusy(false); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>إضافة كاشير جديد</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>الاسم الكامل</Label>
          <Input required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>اسم المستخدم (إنجليزي، فريد)</Label>
          <Input required pattern="[a-zA-Z0-9_]+" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed_01" />
        </div>
        <div className="space-y-2">
          <Label>PIN (4-6 أرقام)</Label>
          <Input required inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="text-center text-xl tracking-widest" placeholder="••••" />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            إنشاء
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ResetPinDialog({ cashier, onClose }: { cashier: Cashier; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await resetCashierPin({ data: { token: session.access_token, cashierId: cashier.user_id, pin } });
      toast.success("تم تعيين PIN جديد");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>إعادة تعيين PIN — {cashier.profiles.full_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>PIN جديد (4-6 أرقام)</Label>
            <Input required inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-widest" placeholder="••••" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CashierStatsDialog({ cashier, onClose }: { cashier: Cashier; onClose: () => void }) {
  const [stats, setStats] = useState<{ sales: number; revenue: number; profit: number; drawers: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const since = today.toISOString();
      const { data: sales } = await supabase
        .from("sales")
        .select("total_amount, profit")
        .eq("user_id", cashier.user_id)
        .eq("is_voided", false)
        .gte("created_at", since);
      const revenue = (sales ?? []).reduce((s, x) => s + Number(x.total_amount), 0);
      const profit = (sales ?? []).reduce((s, x) => s + Number(x.profit), 0);
      const { count: drawers } = await supabase
        .from("cash_drawers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", cashier.user_id);
      setStats({ sales: sales?.length ?? 0, revenue, profit, drawers: drawers ?? 0 });
    })();
  }, [cashier.user_id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>أداء {cashier.profiles.full_name} — اليوم</DialogTitle></DialogHeader>
        {!stats ? <Skeleton className="h-32 w-full" /> : (
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">عدد الفواتير</p><p className="text-2xl font-bold">{stats.sales}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">الإيراد</p><p className="text-2xl font-bold">{stats.revenue.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">الربح</p><p className="text-2xl font-bold text-success">{stats.profit.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">إجمالي الخزائن</p><p className="text-2xl font-bold">{stats.drawers}</p></CardContent></Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
