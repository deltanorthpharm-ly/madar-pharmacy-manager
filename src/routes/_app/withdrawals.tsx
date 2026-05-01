import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Plus, Trash2, Coins } from "lucide-react";

export const Route = createFileRoute("/_app/withdrawals")({
  component: WithdrawalsPage,
});

type W = {
  id: string;
  partner_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

function WithdrawalsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ partner_name: "", amount: "", notes: "" });

  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/dashboard" });
  }, [role, navigate]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as W[];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount);
      if (!form.partner_name.trim()) throw new Error("اسم الشريك مطلوب");
      if (!amt || amt <= 0) throw new Error("المبلغ غير صالح");
      const { error } = await supabase.from("partner_withdrawals").insert({
        partner_name: form.partner_name,
        amount: amt,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل السحب");
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      setOpen(false);
      setForm({ partner_name: "", amount: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_withdrawals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = items.reduce((s, x) => s + Number(x.amount), 0);
  if (role !== "admin") return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Coins className="h-6 w-6" /> سحوبات الشركاء</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل سحوبات الشركاء/المالك من الأرباح</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> سحب جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>تسجيل سحب شريك</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>اسم الشريك</Label>
                <Input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} />
              </div>
              <div>
                <Label>المبلغ</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي السحوبات (آخر 200)</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold text-destructive">{total.toFixed(2)}</p></CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>الشريك</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>ملاحظات</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center">جارٍ التحميل...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا توجد سحوبات</TableCell></TableRow>
            ) : items.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="text-xs">{new Date(w.created_at).toLocaleString("ar")}</TableCell>
                <TableCell className="font-medium">{w.partner_name}</TableCell>
                <TableCell className="font-bold text-destructive">{Number(w.amount).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{w.notes || "-"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => {
                    if (confirm("حذف هذا السحب؟")) delMut.mutate(w.id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
