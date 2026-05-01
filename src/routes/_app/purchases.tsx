import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createPurchase } from "@/server/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_app/purchases")({
  component: PurchasesPage,
});

type PurchaseRow = {
  id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_id: string | null;
  total_amount: number;
  paid_amount: number;
  created_at: string;
};

type LineItem = {
  product_id: string;
  product_name: string;
  has_expiry: boolean;
  quantity: number;
  cost_price: number;
  selling_price: number;
  update_selling: boolean;
  batch_number: string;
  expiry_date: string;
};

function PurchasesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [supplierName, setSupplierName] = useState("");
  const [paid, setPaid] = useState("0");
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PurchaseRow[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-purchase"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, barcode, sku, has_expiry, purchase_price, selling_price")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 8);
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode || "").includes(q) ||
          (p.sku || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, productSearch]);

  const total = items.reduce((s, i) => s + i.quantity * i.cost_price, 0);

  function addItem(p: any) {
    if (items.find((i) => i.product_id === p.id)) {
      toast.error("المنتج مضاف بالفعل");
      return;
    }
    setItems([
      ...items,
      {
        product_id: p.id,
        product_name: p.name,
        has_expiry: p.has_expiry,
        quantity: 1,
        cost_price: Number(p.purchase_price) || 0,
        selling_price: Number(p.selling_price) || 0,
        update_selling: false,
        batch_number: "",
        expiry_date: "",
      },
    ]);
    setProductSearch("");
  }

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems(items.map((i, x) => (x === idx ? { ...i, ...patch } : i)));
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, x) => x !== idx));
  }

  function reset() {
    setItems([]);
    setSupplierId("none");
    setSupplierName("");
    setPaid("0");
    setProductSearch("");
  }

  const submitMut = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("أضف منتج واحد على الأقل");
      for (const it of items) {
        if (it.quantity <= 0) throw new Error(`الكمية غير صالحة: ${it.product_name}`);
        if (it.has_expiry && !it.expiry_date) throw new Error(`تاريخ الانتهاء مطلوب: ${it.product_name}`);
      }
      const update_selling_prices = items
        .filter((i) => i.update_selling && i.selling_price > 0)
        .map((i) => ({ product_id: i.product_id, selling_price: i.selling_price }));

      return await createPurchase({
        data: {
          supplier_id: supplierId !== "none" ? supplierId : null,
          supplier_name: supplierId === "none" ? supplierName || null : null,
          paid_amount: parseFloat(paid) || 0,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            cost_price: i.cost_price,
            batch_number: i.has_expiry ? i.batch_number || null : null,
            expiry_date: i.has_expiry ? i.expiry_date || null : null,
          })),
          update_selling_prices,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`تم حفظ الفاتورة ${r.invoice_number}`);
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المشتريات</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" /> فاتورة شراء جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>فاتورة شراء جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Supplier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>المورد</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— يدوي —</SelectItem>
                      {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {supplierId === "none" && (
                  <div>
                    <Label>اسم المورد (يدوي)</Label>
                    <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="اختياري" />
                  </div>
                )}
              </div>

              {/* Add product */}
              <div>
                <Label>إضافة منتج</Label>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الباركود..."
                />
                {productSearch && filteredProducts.length > 0 && (
                  <div className="mt-1 border rounded-md max-h-48 overflow-y-auto">
                    {filteredProducts.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-right px-3 py-2 hover:bg-accent text-sm"
                        onClick={() => addItem(p)}
                      >
                        {p.name} {p.barcode && <span className="text-xs text-muted-foreground">({p.barcode})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead className="w-20">الكمية</TableHead>
                        <TableHead className="w-24">سعر الشراء</TableHead>
                        <TableHead className="w-24">سعر البيع</TableHead>
                        <TableHead className="w-32">الدفعة/الانتهاء</TableHead>
                        <TableHead className="w-20">الإجمالي</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={it.product_id}>
                          <TableCell className="font-medium text-xs">{it.product_name}</TableCell>
                          <TableCell>
                            <Input type="number" step="1" value={it.quantity}
                              onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                              className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={it.cost_price}
                              onChange={(e) => updateItem(idx, { cost_price: parseFloat(e.target.value) || 0 })}
                              className="h-8" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input type="number" step="0.01" value={it.selling_price}
                                onChange={(e) => updateItem(idx, { selling_price: parseFloat(e.target.value) || 0, update_selling: true })}
                                className="h-8" />
                            </div>
                            <label className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                              <input type="checkbox" checked={it.update_selling}
                                onChange={(e) => updateItem(idx, { update_selling: e.target.checked })} />
                              تحديث
                            </label>
                          </TableCell>
                          <TableCell>
                            {it.has_expiry ? (
                              <div className="space-y-1">
                                <Input placeholder="رقم الدفعة" value={it.batch_number}
                                  onChange={(e) => updateItem(idx, { batch_number: e.target.value })}
                                  className="h-7 text-xs" />
                                <Input type="date" value={it.expiry_date}
                                  onChange={(e) => updateItem(idx, { expiry_date: e.target.value })}
                                  className="h-7 text-xs" />
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="font-bold text-xs">{(it.quantity * it.cost_price).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <Card><CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground">الإجمالي</div>
                  <div className="text-xl font-bold">{total.toFixed(2)}</div>
                </CardContent></Card>
                <div>
                  <Label>المدفوع</Label>
                  <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </div>
                <Card><CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground">الباقي (دين)</div>
                  <div className={`text-xl font-bold ${total - parseFloat(paid || "0") > 0 ? "text-destructive" : ""}`}>
                    {(total - (parseFloat(paid) || 0)).toFixed(2)}
                  </div>
                </CardContent></Card>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>إلغاء</Button>
              <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || items.length === 0}>
                <ShoppingCart className="ms-2 h-4 w-4" /> حفظ الفاتورة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>المدفوع</TableHead>
              <TableHead>الباقي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center">جارٍ التحميل...</TableCell></TableRow>
            ) : purchases.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
            ) : (
              purchases.map((p) => {
                const supName = suppliers.find((s: any) => s.id === p.supplier_id)?.name || p.supplier_name || "-";
                const remaining = Number(p.total_amount) - Number(p.paid_amount);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("ar")}</TableCell>
                    <TableCell className="font-mono">{p.invoice_number || "-"}</TableCell>
                    <TableCell>{supName}</TableCell>
                    <TableCell className="font-bold">{Number(p.total_amount).toFixed(2)}</TableCell>
                    <TableCell>{Number(p.paid_amount).toFixed(2)}</TableCell>
                    <TableCell className={remaining > 0 ? "text-destructive font-bold" : ""}>{remaining.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
