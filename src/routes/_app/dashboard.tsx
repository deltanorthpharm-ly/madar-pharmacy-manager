import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Receipt, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const { fullName } = useAuth();

  const stats = [
    { label: t("dashboard.todayRevenue"), value: "0", icon: Coins, color: "text-success" },
    { label: t("dashboard.todaySales"), value: "0", icon: Receipt, color: "text-primary" },
    { label: t("dashboard.lowStock"), value: "0", icon: AlertTriangle, color: "text-warning" },
    { label: t("dashboard.nearExpiry"), value: "0", icon: Clock, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.welcome")} {fullName ? `، ${fullName}` : ""} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("dashboard.title")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الجولات القادمة</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>✅ <b>الجولة 1 (هذه)</b>: البنية التحتية، تسجيل الدخول، الواجهة العامة.</p>
          <p>⏳ <b>الجولة 2</b>: المنتجات والمخزون والباركود.</p>
          <p>⏳ <b>الجولة 3</b>: نظام POS الكامل بالاختصارات.</p>
          <p>⏳ <b>الجولة 4</b>: المشتريات والمصاريف والموردين.</p>
          <p>⏳ <b>الجولة 5</b>: الخزائن والموظفين.</p>
          <p>⏳ <b>الجولة 6</b>: نظام التعديل وسجل التغييرات.</p>
          <p>⏳ <b>الجولة 7</b>: Rebuild Engine بالخلفية.</p>
          <p>⏳ <b>الجولة 8</b>: التقارير والملخص المالي.</p>
        </CardContent>
      </Card>
    </div>
  );
}
