import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CalendarClock, PackageX, Boxes, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
});

type Product = {
  id: string; name: string; current_stock: number; min_stock: number; selling_price: number;
};
type BatchRow = {
  id: string; product_id: string; batch_number: string | null;
  expiry_date: string | null; quantity: number;
  product: { name: string } | null;
};

function daysBetween(d: string) {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function InventoryPage() {
  const { data: products, isLoading: pLoading } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,current_stock,min_stock,selling_price")
        .eq("is_active", true)
        .limit(1000);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: batches, isLoading: bLoading } = useQuery({
    queryKey: ["inventory-batches"],
    queryFn: async () => {
      const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("product_batches")
        .select("id,product_id,batch_number,expiry_date,quantity, product:products(name)")
        .gt("quantity", 0)
        .not("expiry_date", "is", null)
        .lte("expiry_date", in90)
        .order("expiry_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as unknown as BatchRow[];
    },
  });

  const totalProducts = products?.length ?? 0;
  const lowStock = products?.filter((p) => p.current_stock <= p.min_stock) ?? [];
  const outOfStock = products?.filter((p) => p.current_stock <= 0) ?? [];
  const stockValue = products?.reduce((s, p) => s + p.current_stock * p.selling_price, 0) ?? 0;
  const nearExpiry = batches ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" /> المخزون
          </h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة عامة على المخزون والتنبيهات</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/stock-movements" className="gap-2">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> حركات المخزون
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="إجمالي الأصناف" value={totalProducts} icon={<Boxes className="h-5 w-5" />} loading={pLoading} />
        <StatCard label="منخفض المخزون" value={lowStock.length} icon={<AlertTriangle className="h-5 w-5 text-warning" />} loading={pLoading} variant="warning" />
        <StatCard label="نافذ" value={outOfStock.length} icon={<PackageX className="h-5 w-5 text-destructive" />} loading={pLoading} variant="destructive" />
        <StatCard label="قيمة المخزون" value={stockValue.toFixed(2)} icon={<Boxes className="h-5 w-5" />} loading={pLoading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" /> أصناف منخفضة المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد تنبيهات</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead className="text-end">المتوفر</TableHead>
                    <TableHead className="text-end">الحد الأدنى</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.slice(0, 30).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-end">
                        <Badge variant={p.current_stock <= 0 ? "destructive" : "secondary"}>
                          {p.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">{p.min_stock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-primary" /> قارب على الانتهاء (90 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : nearExpiry.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد باتشات قريبة الانتهاء</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الباتش</TableHead>
                    <TableHead className="text-end">الكمية</TableHead>
                    <TableHead className="text-end">المتبقي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearExpiry.slice(0, 30).map((b) => {
                    const days = b.expiry_date ? daysBetween(b.expiry_date) : 0;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.product?.name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{b.batch_number ?? "—"}</TableCell>
                        <TableCell className="text-end">{b.quantity}</TableCell>
                        <TableCell className="text-end">
                          <Badge variant={days <= 0 ? "destructive" : days <= 30 ? "secondary" : "outline"}>
                            {days <= 0 ? "منتهي" : `${days} يوم`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, loading, variant }: {
  label: string; value: number | string; icon: React.ReactNode; loading?: boolean;
  variant?: "warning" | "destructive";
}) {
  const accent = variant === "destructive" ? "border-destructive/30" : variant === "warning" ? "border-warning/30" : "";
  return (
    <Card className={accent}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-2" />
        ) : (
          <p className="text-2xl font-bold mt-1">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
