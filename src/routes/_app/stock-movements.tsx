import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, Loader2, ArrowDown, ArrowUp, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/stock-movements")({
  component: StockMovementsPage,
});

type Movement = {
  id: string;
  product_id: string;
  batch_id: string | null;
  quantity: number;
  type: "sale" | "purchase" | "return" | "adjustment" | "rebuild";
  notes: string | null;
  created_at: string;
  product: { name: string } | null;
};

const TYPE_LABEL: Record<Movement["type"], string> = {
  sale: "بيع",
  purchase: "شراء",
  return: "مرتجع",
  adjustment: "تسوية",
  rebuild: "إعادة بناء",
};

function StockMovementsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: movements, isLoading } = useQuery({
    queryKey: ["stock-movements", typeFilter],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("id,product_id,batch_id,quantity,type,notes,created_at, product:products(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (typeFilter !== "all") q = q.eq("type", typeFilter as Movement["type"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Movement[];
    },
  });

  const filtered = useMemo(() => {
    let list = movements ?? [];
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((m) => m.product?.name.toLowerCase().includes(s));
    }
    return list;
  }, [movements, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> حركات المخزون
          </h1>
          <p className="text-sm text-muted-foreground mt-1">سجل كل حركات الدخول والخروج</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> تسوية يدوية</Button>
            </DialogTrigger>
            <AdjustmentDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["stock-movements"] }); }} />
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث باسم المنتج..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="sale">بيع</SelectItem>
                <SelectItem value="purchase">شراء</SelectItem>
                <SelectItem value="return">مرتجع</SelectItem>
                <SelectItem value="adjustment">تسوية</SelectItem>
                <SelectItem value="rebuild">إعادة بناء</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">لا توجد حركات</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المنتج</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-end">الكمية</TableHead>
                    <TableHead>ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => {
                    const isOut = m.type === "sale";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString("ar-EG")}
                        </TableCell>
                        <TableCell className="font-medium">{m.product?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{TYPE_LABEL[m.type]}</Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <span className={`inline-flex items-center gap-1 font-mono ${isOut ? "text-destructive" : "text-success"}`}>
                            {isOut ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                            {m.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{m.notes ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdjustmentDialog({ onSaved }: { onSaved: () => void }) {
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id,name").eq("is_active", true).order("name").limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !qty) return;
    setBusy(true);
    const q = Number(qty);
    const signed = direction === "in" ? Math.abs(q) : -Math.abs(q);
    const { error } = await supabase.from("stock_movements").insert({
      product_id: productId,
      type: "adjustment",
      quantity: signed,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("تم تسجيل التسوية"); setProductId(""); setQty(""); setNotes(""); onSaved(); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>تسوية مخزون يدوية</DialogTitle>
        <DialogDescription>
          استخدم هذا لتصحيح المخزون بسبب تالف، فقد، أو جرد. سيتم تسجيلها في سجل التعديلات.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>المنتج *</Label>
          <Select value={productId} onValueChange={setProductId} required>
            <SelectTrigger><SelectValue placeholder="اختر منتجاً" /></SelectTrigger>
            <SelectContent>
              {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الاتجاه *</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">إضافة (+)</SelectItem>
                <SelectItem value="out">خصم (−)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الكمية *</Label>
            <Input type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>السبب / ملاحظات</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: جرد شهري، تالف، فقد..." />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy || !productId || !qty}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            تسجيل التسوية
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
