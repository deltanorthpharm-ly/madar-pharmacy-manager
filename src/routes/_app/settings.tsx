import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useThemeLang } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Languages } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, lang, toggleTheme, setLang } = useThemeLang();
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <Card>
        <CardHeader><CardTitle>المظهر واللغة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">السمة</p>
              <p className="text-xs text-muted-foreground">{theme === "dark" ? "الوضع الليلي" : "الوضع النهاري"}</p>
            </div>
            <Button variant="outline" onClick={toggleTheme} className="gap-2">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              تبديل
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">اللغة</p>
              <p className="text-xs text-muted-foreground">{lang === "ar" ? "العربية" : "English"}</p>
            </div>
            <Button variant="outline" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="gap-2">
              <Languages className="h-4 w-4" />
              {lang === "ar" ? "English" : "العربية"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
