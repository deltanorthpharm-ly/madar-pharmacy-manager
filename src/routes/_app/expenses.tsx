import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { editExpense, deleteExpense } from "@/server/edits.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
});

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  notes: string | null;
  drawer_id: string | null;
  created_at: string;
};

const CATEGORIES = ["كهرباء", "ماء", "إيجار", "رواتب", "صيانة", "مواصلات", "أخرى"];

function ExpensesPage() {
  const qc = useQueryClient();
  const { role, session } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", category: "أخرى", notes: "" });
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ title: "", amount: "", category: "أخرى", notes: "" });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Expense[];
    },
  });

  const { data: openDrawer } = useQuery({
    queryKey: ["open-drawer"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("cash_drawers")
        .select("*")
        .eq("user_id", u.user.id)
        .eq("is_open", true)
        .maybeSingle();
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount);
      if (!form.title.trim()) throw new Error("العنوان مطلوب");
      if (!amt || amt <= 0) throw new Error("المبلغ غير صالح");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");

      const { data: exp, error } = await supabase
        .from("expenses")
        .insert({
          title: form.title,
          amount: amt,
          category: form.category,
          notes: form.notes || null,
          user_id: u.user.id,
          drawer_id: openDrawer?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Record cash transaction if drawer open
      if (openDrawer?.id) {
        await supabase.from("cash_transactions").insert({
          drawer_id: openDrawer.id,
          type: "expense",
          amount: -amt,
          reference_id: exp.id,
          notes: form.title,
        });
      }
    },
    onSuccess: () => {
      toast.success("تم تسجيل المصروف");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["open-drawer"] });
      setOpen(false);
      setForm({ title: "", amount: "", category: "أخرى", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      if (!session?.access_token) throw new Error("غير مسجل");
      await deleteExpense({ data: { token: session.access_token, expense_id: id } });
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editing || !session?.access_token) throw new Error("غير مسجل");
      const amt = parseFloat(editForm.amount);
      if (!editForm.title.trim()) throw new Error("العنوان مطلوب");
      if (!amt || amt <= 0) throw new Error("المبلغ غير صالح");
      await editExpense({
        data: {
          token: session.access_token,
          expense_id: editing.id,
          title: editForm.title,
          amount: amt,
          category: editForm.category || null,
          notes: editForm.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم التعديل");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(e: Expense) {
    setEditing(e);
    setEditForm({
      title: e.title,
      amount: String(e.amount),
      category: e.category || "أخرى",
      notes: e.notes || "",
    });
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const today = new Date().toDateString();
  const todayTotal = expenses
    .filter((e) => new Date(e.created_at).toDateString() === today)
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المصاريف</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" /> مصروف جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تسجيل مصروف</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>العنوان</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>المبلغ</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {!openDrawer && (
                <p className="text-xs text-muted-foreground">⚠️ لا توجد خزنة مفتوحة، لن يتم خصم المبلغ من الخزنة.</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي اليوم</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{todayTotal.toFixed(2)}</p></CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">إجمالي عام (آخر 200)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{total.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>ملاحظات</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center">جارٍ التحميل...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">لا توجد مصاريف</TableCell></TableRow>
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("ar")}</TableCell>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell>{e.category || "-"}</TableCell>
                  <TableCell className="font-bold text-destructive">{Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.notes || "-"}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => {
                          if (confirm("حذف هذا المصروف؟")) delMut.mutate(e.id);
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
