import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, ScanBarcode, Package, Wrench, BarChart3, Wallet } from "lucide-react";

export function SmartSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to });
  };

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/pos", icon: ScanBarcode, label: t("nav.pos") },
    { to: "/products", icon: Package, label: t("nav.products") },
    { to: "/cash-drawer", icon: Wallet, label: t("nav.cashDrawer") },
    { to: "/reports", icon: BarChart3, label: t("nav.reports") },
    { to: "/rebuild", icon: Wrench, label: t("nav.rebuild") },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("common.smartSearch")} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{t("common.noData")}</CommandEmpty>
        <CommandGroup heading={t("nav.dashboard")}>
          {items.map((it) => (
            <CommandItem key={it.to} onSelect={() => go(it.to)}>
              <it.icon className="me-2 h-4 w-4" />
              {it.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
