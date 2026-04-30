import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invoice/$saleId")({
  component: InvoicePage,
});

interface SaleData {
  id: string;
  invoice_number: string;
  created_at: string;
  total_amount: number;
  total_cost: number;
  profit: number;
  discount: number;
  is_voided: boolean;
}
interface SaleItemData {
  id: string;
  product_id: string;
  quantity: number;
  selling_price: number;
  total: number;
  product_name?: string;
}
interface PaymentData {
  id: string;
  method: string;
  amount: number;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "نقدي", card: "بطاقة", transfer: "تحويل",
  edfaali: "إدفعلي", mobicash: "موبي كاش", mobinab: "موبي ناب", yusrpay: "يسر باي",
};

function InvoicePage() {
  const { saleId } = useParams({ from: "/invoice/$saleId" });
  const [sale, setSale] = useState<SaleData | null>(null);
  const [items, setItems] = useState<SaleItemData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: it }, { data: pay }] = await Promise.all([
        supabase.from("sales").select("*").eq("id", saleId).maybeSingle(),
        supabase.from("sale_items").select("*").eq("sale_id", saleId),
        supabase.from("payments").select("*").eq("sale_id", saleId),
      ]);
      setSale(s as SaleData | null);
      setPayments((pay ?? []) as PaymentData[]);

      const itemsData = (it ?? []) as SaleItemData[];
      if (itemsData.length > 0) {
        const ids = itemsData.map((i) => i.product_id);
        const { data: prods } = await supabase
          .from("products").select("id,name").in("id", ids);
        const nameMap = new Map((prods ?? []).map((p) => [p.id, p.name]));
        setItems(itemsData.map((i) => ({ ...i, product_name: nameMap.get(i.product_id) })));
      }
      setLoading(false);
      // Auto-print after data loads
      setTimeout(() => window.print(), 400);
    })();
  }, [saleId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!sale) {
    return <div className="p-8 text-center">الفاتورة غير موجودة</div>;
  }

  const subtotal = items.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="min-h-screen bg-background p-4 print:p-0">
      <div className="max-w-md mx-auto bg-card text-card-foreground p-6 print:p-2 print:shadow-none print:border-0 border rounded-md print:max-w-full">
        <div className="text-center mb-4 border-b pb-3">
          <h1 className="text-2xl font-bold">مدار</h1>
          <p className="text-xs text-muted-foreground">فاتورة بيع</p>
        </div>
        <div className="text-sm space-y-1 mb-3">
          <div className="flex justify-between"><span>رقم الفاتورة</span><span className="font-mono font-bold">{sale.invoice_number}</span></div>
          <div className="flex justify-between"><span>التاريخ</span><span>{new Date(sale.created_at).toLocaleString("ar-EG")}</span></div>
          {sale.is_voided && <div className="text-destructive font-bold text-center py-1 border border-destructive">ملغاة</div>}
        </div>
        <table className="w-full text-sm border-t border-b py-2">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-right py-1">الصنف</th>
              <th className="text-center">كمية</th>
              <th className="text-center">سعر</th>
              <th className="text-left">إجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-dashed">
                <td className="py-1">{i.product_name ?? "—"}</td>
                <td className="text-center font-mono">{Number(i.quantity)}</td>
                <td className="text-center font-mono">{Number(i.selling_price).toFixed(2)}</td>
                <td className="text-left font-mono">{Number(i.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 text-sm mt-3 font-mono">
          <div className="flex justify-between"><span>المجموع الفرعي</span><span>{subtotal.toFixed(2)}</span></div>
          {Number(sale.discount) > 0 && (
            <div className="flex justify-between text-destructive"><span>خصم</span><span>-{Number(sale.discount).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-lg font-bold border-t pt-1">
            <span>الإجمالي</span><span>{Number(sale.total_amount).toFixed(2)}</span>
          </div>
        </div>
        <div className="border-t mt-3 pt-2 text-sm space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{METHOD_LABELS[p.method] ?? p.method}</span>
              <span className="font-mono">{Number(p.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-muted-foreground mt-4 pt-3 border-t">
          شكراً لتعاملكم معنا
        </div>
      </div>
      <div className="max-w-md mx-auto mt-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()} className="flex-1">
          <Printer className="h-4 w-4 me-1" /> طباعة
        </Button>
        <Button variant="outline" onClick={() => window.close()} className="flex-1">
          إغلاق
        </Button>
      </div>
    </div>
  );
}
