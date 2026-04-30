import { useTranslation } from "react-i18next";
import { Moon, Sun, Languages, LogOut, Search, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useThemeLang } from "@/lib/theme-provider";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { t } = useTranslation();
  const { theme, lang, toggleTheme, setLang } = useThemeLang();
  const { fullName, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur">
      <SidebarTrigger />
      <Button
        variant="outline"
        size="sm"
        className="ms-2 gap-2 text-muted-foreground"
        onClick={onOpenSearch}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{t("common.smartSearch")}</span>
      </Button>

      <div className="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setLang(lang === "ar" ? "en" : "ar")} title={t("common.language")}>
          <Languages className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={t("common.theme")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{fullName ?? "..."}</span>
              {role && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {role === "admin" ? "مدير" : "كاشير"}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs">{fullName}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="me-2 h-4 w-4" />
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
