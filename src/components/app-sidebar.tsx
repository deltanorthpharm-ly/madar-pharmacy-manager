import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  Users,
  Truck,
  Receipt,
  Wallet,
  UserCog,
  BarChart3,
  Coins,
  History,
  Wrench,
  Settings,
  Pill,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  const main = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/pos", icon: ScanBarcode, label: t("nav.pos") },
  ];

  const inventory = [
    { to: "/products", icon: Package, label: t("nav.products") },
    { to: "/inventory", icon: Boxes, label: t("nav.inventory") },
    { to: "/stock-movements", icon: ArrowLeftRight, label: t("nav.stockMovements") },
  ];

  const ops = [
    { to: "/purchases", icon: ShoppingCart, label: t("nav.purchases"), adminOnly: true },
    { to: "/suppliers", icon: Truck, label: t("nav.suppliers"), adminOnly: true },
    { to: "/customers", icon: Users, label: t("nav.customers") },
    { to: "/expenses", icon: Receipt, label: t("nav.expenses") },
    { to: "/cash-drawer", icon: Wallet, label: t("nav.cashDrawer") },
  ];

  const admin = [
    { to: "/employees", icon: UserCog, label: t("nav.employees") },
    { to: "/withdrawals", icon: Coins, label: t("nav.withdrawals") },
    { to: "/reports", icon: BarChart3, label: t("nav.reports") },
    { to: "/financial-summary", icon: Coins, label: t("nav.financialSummary") },
    { to: "/edit-log", icon: History, label: t("nav.editLog") },
    { to: "/rebuild", icon: Wrench, label: t("nav.rebuild") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  const renderItems = (items: Array<{ to: string; icon: React.ComponentType<{ className?: string }>; label: string; adminOnly?: boolean }>) =>
    items
      .filter((i) => !i.adminOnly || role === "admin")
      .map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
            <Link to={item.to} className="flex items-center gap-3">
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ));

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Pill className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-none">{t("app.name")}</span>
              <span className="text-xs text-muted-foreground leading-none mt-1">{t("app.tagline")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t("nav.dashboard")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(main)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t("nav.inventory")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(inventory)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t("nav.purchases")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(ops)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>{t("nav.settings")}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(admin)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
