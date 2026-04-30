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
import { Plus, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { createCashier, listCashiers } from "@/server/auth.functions";
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.user_id}>
                    <TableCell className="font-medium">{c.profiles.full_name}</TableCell>
                    <TableCell>
                      <span className={c.profiles.is_active ? "text-success" : "text-muted-foreground"}>
                        {c.profiles.is_active ? "نشط" : "متوقف"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
