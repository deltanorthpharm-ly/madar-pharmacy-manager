import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { checkout } from "@/server/pos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  ScanBarcode, Plus, Minus, Trash2, Printer, Search, X, Banknote,
  CreditCard, Smartphone, MoreHorizontal, Loader2, ShoppingCart, Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pos")({
  component: POSPage,
});

type PaymentMethod = "cash" | "card" | "transfer" | "edfaali" | "mobicash" | "mobinab" | "yusrpay";

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  selling_price: number;
  purchase_price: number;
  current_stock: number;
  has_expiry: boolean;
}

interface CartItem {
  product_id: string;
  name: string;
  batch_id: string | null;
  selling_price: number;
  cost_price: number;
  quantity: number;
  max_stock: number;
}

const PRIMARY_METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: "cash", label: "نقدي", icon: Banknote },
  { key: "card", label: "بطاقة", icon: CreditCard },
];

const SECONDARY_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "transfer", label: "تحويل" },
  { key: "edfaali", label: "إدفعلي" },
  { key: "mobicash", label: "موبي كاش" },
  { key: "mobinab", label: "موبي ناب" },
  { key: "yusrpay", label: "يسر باي" },
];

function POSPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ id: string; number: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode on mount
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); barcodeRef.current?.focus(); }
      else if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "F4") { e.preventDefault(); if (cart.length) setPayOpen(true); }
      else if (e.key === "Escape") { setPayOpen(false); barcodeRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length]);

  // Search products (live)
  const { data: searchResults } = useQuery({
    queryKey: ["pos-search", searchQuery],
    queryFn: async (): Promise<Product[]> => {
      if (searchQuery.length < 2) return [];
      const { data } = await supabase
        .from("products")
        .select("id,name,barcode,sku,selling_price,purchase_price,current_stock,has_expiry")
        .eq("is_active", true)
        .or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`)
        .limit(20);
      return (data ?? []) as Product[];
    },
    enabled: searchQuery.length >= 2,
  });

  async function findByBarcode(code: string): Promise<Product | null> {
    const { data } = await supabase
      .from("products")
      .select("id,name,barcode,sku,selling_price,purchase_price,current_stock,has_expiry")
      .eq("barcode", code)
      .eq("is_active", true)
      .maybeSingle();
    return (data as Product) ?? null;
  }

  async function fetchEarliestBatch(productId: string): Promise<{ id: string; cost_price: number } | null> {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("product_batches")
      .select("id,cost_price,quantity,expiry_date")
      .eq("product_id", productId)
      .gt("quantity", 0)
      .or(`expiry_date.is.null,expiry_date.gte.${today}`)
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    return data ? { id: data.id, cost_price: Number(data.cost_price) } : null;
  }

  async function addProduct(p: Product, qty = 1) {
    if (Number(p.selling_price) <= 0) {
      toast.error(`المنتج "${p.name}" بدون سعر بيع`);
      return;
    }
    if (Number(p.current_stock) < qty) {
      toast.error(`مخزون غير كافٍ (المتاح: ${p.current_stock})`);
      return;
    }
    let batch_id: string | null = null;
    let cost = Number(p.purchase_price);
    if (p.has_expiry) {
      const b = await fetchEarliestBatch(p.id);
      if (b) { batch_id = b.id; cost = b.cost_price; }
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product_id === p.id && c.batch_id === batch_id);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].quantity + qty;
        if (newQty > Number(p.current_stock)) {
          toast.error(`الحد الأقصى ${p.current_stock}`);
          return prev;
        }
        next[idx] = { ...next[idx], quantity: newQty };
        return next;
      }
      return [...prev, {
        product_id: p.id,
        name: p.name,
        batch_id,
        selling_price: Number(p.selling_price),
        cost_price: cost,
        quantity: qty,
        max_stock: Number(p.current_stock),
      }];
    });
  }

  async function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const p = await findByBarcode(code);
    if (!p) {
      toast.error("لم يُعثر على المنتج");
    } else {
      await addProduct(p);
      toast.success(p.name, { duration: 1200 });
    }
    setBarcodeInput("");
    barcodeRef.current?.focus();
  }

  function updateQty(idx: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      const item = next[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      if (newQty > item.max_stock) {
        toast.error(`الحد الأقصى ${item.max_stock}`);
        return prev;
      }
      next[idx] = { ...item, quantity: newQty };
      return next;
    });
  }
  function removeItem(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const checkoutMutation = useMutation({
    mutationFn: async (payments: { method: PaymentMethod; amount: number }[]) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("الجلسة منتهية");
      return await checkout({
        data: {
          token,
          items: cart.map((c) => ({
            product_id: c.product_id,
            batch_id: c.batch_id,
            quantity: c.quantity,
            selling_price: c.selling_price,
            cost_price: c.cost_price,
          })),
          payments,
          discount,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`تمت الفاتورة: ${res.invoice_number}`);
      setLastInvoice({ id: res.sale_id, number: res.invoice_number });
      setCart([]);
      setDiscount(0);
      setPayOpen(false);
      barcodeRef.current?.focus();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px] h-[calc(100vh-7rem)]">
      {/* Left: Cart + Search */}
      <div className="flex flex-col gap-3 min-h-0">
        <Card>
          <CardContent className="p-3 space-y-2">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={barcodeRef}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="امسح الباركود... (F1)"
                  className="pr-9 text-base h-11"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" size="lg" className="gap-1">
                <Plus className="h-4 w-4" />
                إضافة
              </Button>
            </form>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو SKU... (F2)"
                className="pr-9"
                autoComplete="off"
              />
              {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-72 overflow-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { void addProduct(p); setSearchQuery(""); barcodeRef.current?.focus(); }}
                      className="w-full text-right px-3 py-2 hover:bg-accent flex items-center justify-between gap-2 border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku && <span>SKU: {p.sku} · </span>}
                          مخزون: {p.current_stock}
                        </div>
                      </div>
                      <div className="font-mono font-semibold">{Number(p.selling_price).toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              السلة ({cart.length})
            </CardTitle>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])}>
                <X className="h-4 w-4 me-1" /> مسح الكل
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
                <ShoppingCart className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-sm">ابدأ بمسح الباركود أو البحث</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item, idx) => (
                  <div key={`${item.product_id}-${item.batch_id}-${idx}`} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {item.selling_price.toFixed(2)} × {item.quantity} = {(item.selling_price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(idx, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          const delta = v - item.quantity;
                          if (delta !== 0) updateQty(idx, delta);
                        }}
                        className="h-8 w-14 text-center font-mono"
                      />
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(idx, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Totals + Pay */}
      <div className="flex flex-col gap-3">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ملخص الفاتورة</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="font-mono">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm flex items-center gap-1 shrink-0">
                <Percent className="h-3 w-3" /> خصم
              </Label>
              <Input
                type="number"
                min={0}
                max={subtotal}
                value={discount || ""}
                onChange={(e) => setDiscount(Math.min(subtotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="h-9 font-mono"
                placeholder="0.00"
              />
            </div>
            <div className="border-t pt-3 mt-auto">
              <div className="flex justify-between items-baseline">
                <span className="text-lg font-semibold">الإجمالي</span>
                <span className="text-3xl font-bold font-mono text-primary">
                  {total.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="h-14 text-lg font-bold"
              disabled={cart.length === 0 || total <= 0}
              onClick={() => setPayOpen(true)}
            >
              دفع (F4)
            </Button>

            {lastInvoice && (
              <div className="border rounded-md p-2 flex items-center justify-between text-sm">
                <span>آخر فاتورة: <Badge variant="secondary">{lastInvoice.number}</Badge></span>
                <Button size="sm" variant="outline" onClick={() => window.open(`/invoice/${lastInvoice.id}`, "_blank")}>
                  <Printer className="h-3 w-3 me-1" /> طباعة
                </Button>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>F1: باركود · F2: بحث · F4: دفع</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        loading={checkoutMutation.isPending}
        onConfirm={(payments) => checkoutMutation.mutate(payments)}
      />
    </div>
  );
}

function PaymentDialog({
  open, onOpenChange, total, loading, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  loading: boolean;
  onConfirm: (payments: { method: PaymentMethod; amount: number }[]) => void;
}) {
  const [splits, setSplits] = useState<{ method: PaymentMethod; amount: number }[]>([
    { method: "cash", amount: 0 },
  ]);

  useEffect(() => {
    if (open) {
      setSplits([{ method: "cash", amount: total }]);
    }
  }, [open, total]);

  const paid = splits.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = total - paid;
  const change = paid > total ? paid - total : 0;

  function setMethod(idx: number, method: PaymentMethod) {
    setSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, method } : p)));
  }
  function setAmount(idx: number, amount: number) {
    setSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, amount } : p)));
  }
  function addSplit() {
    setSplits((prev) => [...prev, { method: "cash", amount: Math.max(0, total - paid) }]);
  }
  function removeSplit(idx: number) {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    const valid = splits.filter((p) => p.amount > 0);
    if (valid.length === 0) {
      toast.error("أدخل مبلغًا");
      return;
    }
    // Cap cash split at total to avoid overpayment validation error (change is implicit)
    const adjusted = valid.map((p, i) => {
      if (i === valid.length - 1 && paid > total && p.method === "cash") {
        return { ...p, amount: p.amount - change };
      }
      return p;
    }).filter((p) => p.amount > 0);
    const finalPaid = adjusted.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(finalPaid - total) > 0.01) {
      toast.error(`المتبقي: ${(total - finalPaid).toFixed(2)}`);
      return;
    }
    onConfirm(adjusted);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>الدفع — {total.toFixed(2)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {splits.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">طريقة الدفع</Label>
                <MethodSelect value={s.method} onChange={(m) => setMethod(idx, m)} />
              </div>
              <div className="flex-1">
                <Label className="text-xs">المبلغ</Label>
                <Input
                  type="number"
                  value={s.amount || ""}
                  onChange={(e) => setAmount(idx, parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
              {splits.length > 1 && (
                <Button size="icon" variant="ghost" onClick={() => removeSplit(idx)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSplit} className="w-full">
            <Plus className="h-3 w-3 me-1" /> تقسيم الدفع
          </Button>

          <div className="border-t pt-3 space-y-1 font-mono text-sm">
            <div className="flex justify-between">
              <span>المدفوع</span><span>{paid.toFixed(2)}</span>
            </div>
            {remaining > 0.01 && (
              <div className="flex justify-between text-destructive">
                <span>المتبقي</span><span>{remaining.toFixed(2)}</span>
              </div>
            )}
            {change > 0.01 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>الباقي للعميل</span><span>{change.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>إلغاء</Button>
          <Button onClick={submit} disabled={loading || Math.abs(remaining) > 0.01 && change <= 0}>
            {loading && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
            تأكيد الدفع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodSelect({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const [popOpen, setPopOpen] = useState(false);
  const isPrimary = PRIMARY_METHODS.some((m) => m.key === value);
  const currentLabel = isPrimary
    ? PRIMARY_METHODS.find((m) => m.key === value)!.label
    : SECONDARY_METHODS.find((m) => m.key === value)?.label ?? "أخرى";

  return (
    <div className="flex gap-1">
      {PRIMARY_METHODS.map((m) => {
        const Icon = m.icon;
        return (
          <Button
            key={m.key}
            type="button"
            variant={value === m.key ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => onChange(m.key)}
          >
            <Icon className="h-3 w-3" />
            {m.label}
          </Button>
        );
      })}
      <Popover open={popOpen} onOpenChange={setPopOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={!isPrimary ? "default" : "outline"}
            size="sm"
          >
            <MoreHorizontal className="h-3 w-3" />
            {!isPrimary && <span className="ms-1">{currentLabel}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          <div className="space-y-0.5">
            {SECONDARY_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { onChange(m.key); setPopOpen(false); }}
                className={cn(
                  "w-full text-right px-2 py-1.5 rounded hover:bg-accent text-sm flex items-center gap-2",
                  value === m.key && "bg-accent font-medium"
                )}
              >
                <Smartphone className="h-3 w-3" />
                {m.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
