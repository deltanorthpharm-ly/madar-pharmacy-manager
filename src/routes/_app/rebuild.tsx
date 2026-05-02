import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startRebuild } from "@/server/rebuild.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, Coins, ShieldCheck, AlertTriangle, Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/rebuild")({
  component: RebuildPage,
});

type RebuildType = "inventory" | "financials" | "product_integrity" | "anomalies";

interface RebuildRow {
  id: string;
  type: RebuildType;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  report: Record<string, unknown> | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

const TYPES: { key: RebuildType; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "inventory", label: "إعادة بناء المخزون", desc: "إعادة حساب كميات المنتجات من حركات المخزون", icon: Boxes },
  { key: "financials", label: "إعادة بناء المالية", desc: "إعادة حساب التكلفة والربح لكل فاتورة بيع", icon: Coins },
  { key: "product_integrity", label: "سلامة المنتجات", desc: "كشف الأسعار/التكاليف الناقصة والباركود المكرر", icon: ShieldCheck },
  { key: "anomalies", label: "كشف الشذوذ", desc: "مخزون سالب، أصناف منتهية، فواتير بدون دفع", icon: AlertTriangle },
];

function RebuildPage() {
  const qc = useQueryClient();
  const startFn = useServerFn(startRebuild);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ["rebuilds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_rebuilds")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as RebuildRow[];
    },
    refetchInterval: 2000,
  });

  const active = useMemo(
    () => history?.find((r) => r.id === activeId) ?? history?.find((r) => r.status === "running") ?? null,
    [history, activeId]
  );

  useEffect(() => {
    if (active && (active.status === "completed" || active.status === "failed") && active.id === activeId) {
      if (active.status === "completed") toast.success("اكتمل الإصلاح بنجاح");
      else toast.error("فشل الإصلاح");
      setActiveId(null);
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
    }
  }, [active, activeId, qc]);

  const startMut = useMutation({
    mutationFn: async (type: RebuildType) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      return startFn({ data: { token: session.access_token, type } });
    },
    onSuccess: ({ id }) => {
      setActiveId(id);
      toast.info("بدأ الإصلاح...");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">محرك إصلاح النظام</h1>
        <p className="text-sm text-muted-foreground">
          أدوات إعادة بناء وفحص لضمان سلامة بيانات النظام
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TYPES.map((t) => {
          const running = active?.type === t.key && active?.status === "running";
          const Icon = t.icon;
          return (
            <Card key={t.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{t.label}</CardTitle>
                </div>
                <CardDescription className="text-xs mt-2">{t.desc}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  className="w-full"
                  size="sm"
                  disabled={running || startMut.isPending}
                  onClick={() => startMut.mutate(t.key)}
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {running ? "جاري التنفيذ..." : "تشغيل"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {active && active.status === "running" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التنفيذ: {TYPES.find((x) => x.key === active.type)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={active.progress} />
            <p className="text-xs text-muted-foreground mt-2">{active.progress}%</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل عمليات الإصلاح</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد سجل بعد</p>
          ) : (
            <div className="space-y-2">
              {history.map((r) => (
                <RebuildItem key={r.id} row={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RebuildItem({ row }: { row: RebuildRow }) {
  const [open, setOpen] = useState(false);
  const label = TYPES.find((x) => x.key === row.type)?.label ?? row.type;
  const statusBadge = {
    queued: <Badge variant="secondary">في الانتظار</Badge>,
    running: <Badge><Loader2 className="h-3 w-3 animate-spin mr-1" />جاري</Badge>,
    completed: <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />مكتمل</Badge>,
    failed: <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />فشل</Badge>,
  }[row.status];

  return (
    <div className="border rounded-md">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3 text-sm text-start">
          {statusBadge}
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(row.created_at), "yyyy-MM-dd HH:mm")}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{row.progress}%</span>
      </button>
      {open && row.report && (
        <div className="border-t p-3 bg-muted/30">
          <ReportView type={row.type} report={row.report} />
        </div>
      )}
    </div>
  );
}

function ReportView({ type, report }: { type: RebuildType; report: Record<string, unknown> }) {
  if ("error" in report) {
    return <p className="text-sm text-destructive">{String(report.error)}</p>;
  }

  const sections = ((): { key: string; label: string; data: unknown[] }[] => {
    if (type === "inventory") return [
      { key: "fixed", label: "منتجات تم تصحيحها", data: (report.fixed as unknown[]) ?? [] },
      { key: "warnings", label: "تحذيرات", data: (report.warnings as unknown[]) ?? [] },
    ];
    if (type === "financials") return [
      { key: "fixed", label: "فواتير تم تصحيحها", data: (report.fixed as unknown[]) ?? [] },
      { key: "warnings", label: "تحذيرات", data: (report.warnings as unknown[]) ?? [] },
    ];
    if (type === "product_integrity") return [
      { key: "missing_price", label: "بدون سعر بيع", data: (report.missing_price as unknown[]) ?? [] },
      { key: "missing_cost", label: "بدون سعر تكلفة", data: (report.missing_cost as unknown[]) ?? [] },
      { key: "duplicate_barcodes", label: "باركود مكرر", data: (report.duplicate_barcodes as unknown[]) ?? [] },
      { key: "inactive_with_stock", label: "غير نشط لكن به مخزون", data: (report.inactive_with_stock as unknown[]) ?? [] },
    ];
    return [
      { key: "negative_stock", label: "مخزون سالب", data: (report.negative_stock as unknown[]) ?? [] },
      { key: "expired_with_stock", label: "أصناف منتهية بمخزون", data: (report.expired_with_stock as unknown[]) ?? [] },
      { key: "near_expiry", label: "قاربت على الانتهاء (30 يوم)", data: (report.near_expiry as unknown[]) ?? [] },
      { key: "sales_no_payment", label: "فواتير بدون دفعات", data: (report.sales_no_payment as unknown[]) ?? [] },
    ];
  })();

  return (
    <Tabs defaultValue={sections[0]?.key}>
      <TabsList className="w-full justify-start flex-wrap h-auto">
        {sections.map((s) => (
          <TabsTrigger key={s.key} value={s.key} className="text-xs">
            {s.label} ({s.data.length})
          </TabsTrigger>
        ))}
      </TabsList>
      {sections.map((s) => (
        <TabsContent key={s.key} value={s.key} className="mt-3">
          {s.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد عناصر</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded border bg-background">
              <pre className="text-xs p-3 whitespace-pre-wrap" dir="ltr">
                {JSON.stringify(s.data, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
