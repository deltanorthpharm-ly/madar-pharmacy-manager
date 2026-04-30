import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, Search, Barcode, Tag, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  scientific_name: string | null;
  category_id: string | null;
  barcode: string | null;
  sku: string | null;
  purchase_price: number;
  selling_price: number;
  pack_size: number;
  has_expiry: boolean;
  min_stock: number;
  current_stock: number;
  is_active: boolean;
};

function ProductsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [batchesProduct, setBatchesProduct] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (categoryFilter !== "all") list = list.filter((p) => p.category_id === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.scientific_name?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, search, categoryFilter]);

  const catName = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? "—";

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم تعطيل المنتج");
      qc.invalidateQueries({ queryKey: ["products"] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> المنتجات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة كتالوج الأدوية والأصناف</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={catOpen} onOpenChange={setCatOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Tag className="h-4 w-4" /> التصنيفات</Button>
              </DialogTrigger>
              <CategoriesDialog onClose={() => setCatOpen(false)} />
            </Dialog>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> إضافة منتج</Button>
              </DialogTrigger>
              <ProductDialog
                key={editing?.id ?? "new"}
                product={editing}
                categories={categories ?? []}
                onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["products"] }); }}
              />
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم، الباركود، أو الـ SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="كل التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد منتجات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>الباركود</TableHead>
                    <TableHead className="text-end">سعر البيع</TableHead>
                    <TableHead className="text-end">المخزون</TableHead>
                    <TableHead>الحالة</TableHead>
                    {isAdmin && <TableHead className="text-end">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const low = p.current_stock <= p.min_stock;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          {p.scientific_name && (
                            <div className="text-xs text-muted-foreground">{p.scientific_name}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{catName(p.category_id)}</TableCell>
                        <TableCell>
                          {p.barcode ? (
                            <span className="font-mono text-xs flex items-center gap-1">
                              <Barcode className="h-3 w-3" /> {p.barcode}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-end font-mono">{p.selling_price.toFixed(2)}</TableCell>
                        <TableCell className="text-end">
                          <span className={low ? "text-destructive font-bold" : ""}>
                            {p.current_stock}
                          </span>
                        </TableCell>
                        <TableCell>
                          {!p.is_active ? (
                            <Badge variant="secondary">معطّل</Badge>
                          ) : low ? (
                            <Badge variant="destructive">منخفض</Badge>
                          ) : (
                            <Badge variant="outline">نشط</Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-end">
                            <div className="flex justify-end gap-1">
                              {p.has_expiry && (
                                <Button size="icon" variant="ghost" title="الباتشات" onClick={() => setBatchesProduct(p)}>
                                  <Layers className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تعطيل المنتج</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      سيتم إخفاء "{p.name}" من نقطة البيع. يمكنك إعادة تفعيله لاحقاً.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(p.id)}>تعطيل</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!batchesProduct} onOpenChange={(v) => !v && setBatchesProduct(null)}>
        {batchesProduct && <BatchesDialog product={batchesProduct} onClose={() => setBatchesProduct(null)} />}
      </Dialog>
    </div>
  );
}

function ProductDialog({
  product,
  categories,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [scientific, setScientific] = useState(product?.scientific_name ?? "");
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "none");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [purchase, setPurchase] = useState(String(product?.purchase_price ?? 0));
  const [selling, setSelling] = useState(String(product?.selling_price ?? 0));
  const [pack, setPack] = useState(String(product?.pack_size ?? 1));
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? 0));
  const [hasExpiry, setHasExpiry] = useState(product?.has_expiry ?? false);
  const [active, setActive] = useState(product?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: name.trim(),
      scientific_name: scientific.trim() || null,
      category_id: categoryId === "none" ? null : categoryId,
      barcode: barcode.trim() || null,
      sku: sku.trim() || null,
      purchase_price: Number(purchase) || 0,
      selling_price: Number(selling) || 0,
      pack_size: Number(pack) || 1,
      min_stock: Number(minStock) || 0,
      has_expiry: hasExpiry,
      is_active: active,
    };
    if (payload.selling_price <= 0) {
      toast.error("سعر البيع يجب أن يكون أكبر من صفر");
      setBusy(false);
      return;
    }
    const res = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success(product ? "تم تحديث المنتج" : "تم إضافة المنتج");
      onSaved();
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{product ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
        <DialogDescription>أدخل بيانات المنتج. الحقول المعلَّمة (*) مطلوبة.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label>الاسم *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>الاسم العلمي</Label>
          <Input value={scientific} onChange={(e) => setScientific(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>التصنيف</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون تصنيف</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الباركود</Label>
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>SKU</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>حجم العبوة</Label>
          <Input type="number" min="1" value={pack} onChange={(e) => setPack(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>سعر الشراء *</Label>
          <Input type="number" min="0" step="0.01" required value={purchase} onChange={(e) => setPurchase(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>سعر البيع *</Label>
          <Input type="number" min="0" step="0.01" required value={selling} onChange={(e) => setSelling(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>الحد الأدنى للمخزون</Label>
          <Input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="cursor-pointer">له تاريخ صلاحية</Label>
            <p className="text-xs text-muted-foreground">تفعيل تتبّع الباتش والصلاحية</p>
          </div>
          <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="cursor-pointer">نشط</Label>
            <p className="text-xs text-muted-foreground">يظهر في نقطة البيع</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {product ? "حفظ التعديلات" : "إضافة المنتج"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function CategoriesDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim() });
    if (error) toast.error(error.message);
    else { setName(""); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("تمت الإضافة"); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("تم الحذف"); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>إدارة التصنيفات</DialogTitle>
      </DialogHeader>
      <form onSubmit={add} className="flex gap-2">
        <Input placeholder="اسم التصنيف" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit"><Plus className="h-4 w-4" /></Button>
      </form>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {isLoading ? <Skeleton className="h-20 w-full" /> :
          categories?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد تصنيفات</p>
          ) : categories?.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
              <span>{c.name}</span>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </DialogFooter>
    </DialogContent>
  );
}

type Batch = {
  id: string; product_id: string; batch_number: string | null;
  expiry_date: string | null; quantity: number; cost_price: number;
};

function BatchesDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [batchNumber, setBatchNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(product.purchase_price ?? 0));
  const [busy, setBusy] = useState(false);

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches").select("*").eq("product_id", product.id)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Batch[];
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const quantity = Number(qty) || 0;
    const { data: batch, error } = await supabase.from("product_batches").insert({
      product_id: product.id,
      batch_number: batchNumber.trim() || null,
      expiry_date: expiry || null,
      quantity: 0,
      cost_price: Number(cost) || 0,
    }).select().single();
    if (error || !batch) { setBusy(false); toast.error(error?.message ?? "خطأ"); return; }
    if (quantity > 0) {
      const { error: smErr } = await supabase.from("stock_movements").insert({
        product_id: product.id,
        batch_id: batch.id,
        type: "purchase",
        quantity,
        notes: `إضافة باتش يدوي${batchNumber ? " #" + batchNumber : ""}`,
      });
      if (smErr) { setBusy(false); toast.error(smErr.message); return; }
    }
    setBusy(false);
    setBatchNumber(""); setExpiry(""); setQty("");
    qc.invalidateQueries({ queryKey: ["batches", product.id] });
    qc.invalidateQueries({ queryKey: ["products"] });
    toast.success("تم إضافة الباتش");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("product_batches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["batches", product.id] }); toast.success("تم الحذف"); }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>باتشات: {product.name}</DialogTitle>
        <DialogDescription>إدارة الباتشات وتواريخ الصلاحية. الكميات تتحدّث تلقائياً عبر حركات المخزون.</DialogDescription>
      </DialogHeader>

      <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end p-3 rounded-lg border bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">رقم الباتش</Label>
          <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ الصلاحية</Label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">الكمية</Label>
          <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">سعر الشراء</Label>
          <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="h-9" />
        </div>
        <Button type="submit" disabled={busy} className="h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : batches && batches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد باتشات</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>الصلاحية</TableHead>
              <TableHead className="text-end">الكمية</TableHead>
              <TableHead className="text-end">السعر</TableHead>
              <TableHead className="text-end">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches?.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.batch_number ?? "—"}</TableCell>
                <TableCell className="text-xs">{b.expiry_date ?? "—"}</TableCell>
                <TableCell className="text-end">{b.quantity}</TableCell>
                <TableCell className="text-end font-mono">{b.cost_price.toFixed(2)}</TableCell>
                <TableCell className="text-end">
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>إغلاق</Button>
      </DialogFooter>
    </DialogContent>
  );
}
