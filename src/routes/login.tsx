import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pill, Mail, Lock, KeyRound, Loader2, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useThemeLang } from "@/lib/theme-provider";
import { adminExists, listCashiersPublic, getCashierEmail, signupFirstAdmin } from "@/server/auth.functions";
import { Languages, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { theme, lang, toggleTheme, setLang } = useThemeLang();

  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [cashiers, setCashiers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    void adminExists().then((r) => setHasAdmin(r.exists));
    void listCashiersPublic().then((r) => setCashiers(r.cashiers));
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 flex items-center justify-center p-4">
      <div className="absolute top-4 end-4 flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          <Languages className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Pill className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{t("app.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>

        <Card className="p-6">
          {hasAdmin === false ? (
            <FirstAdminSignup onCreated={() => setHasAdmin(true)} />
          ) : (
            <Tabs defaultValue="admin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="admin" className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t("auth.adminLogin")}
                </TabsTrigger>
                <TabsTrigger value="cashier" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  {t("auth.cashierLogin")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="admin" className="mt-4">
                <AdminLogin />
              </TabsContent>
              <TabsContent value="cashier" className="mt-4">
                <CashierLogin cashiers={cashiers} />
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>
    </div>
  );
}

function AdminLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(t("auth.invalidCredentials"));
    else toast.success(t("auth.welcomeBack"));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <div className="relative">
          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10" placeholder="admin@example.com" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <div className="relative">
          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
        {busy ? t("auth.loggingIn") : t("auth.login")}
      </Button>
    </form>
  );
}

function CashierLogin({ cashiers }: { cashiers: { id: string; name: string }[] }) {
  const { t } = useTranslation();
  const [cashierId, setCashierId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierId || pin.length < 4) return;
    setBusy(true);
    try {
      const { email } = await getCashierEmail({ data: { cashierId } });
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (error) toast.error(t("auth.invalidCredentials"));
      else toast.success(t("auth.welcomeBack"));
    } catch {
      toast.error(t("auth.invalidCredentials"));
    } finally {
      setBusy(false);
    }
  };

  if (cashiers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        لا يوجد كاشيرز مسجلين بعد. يقوم المدير بإضافتهم من شاشة الموظفين.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("auth.loginAs")}</Label>
        <Select value={cashierId} onValueChange={setCashierId}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الكاشير" />
          </SelectTrigger>
          <SelectContent>
            {cashiers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">{t("auth.enterPin")}</Label>
        <div className="relative">
          <KeyRound className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="pin"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="ps-10 text-center text-2xl tracking-widest"
            placeholder="••••"
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy || !cashierId || pin.length < 4}>
        {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
        {t("auth.confirm")}
      </Button>
    </form>
  );
}

function FirstAdminSignup({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signupFirstAdmin({ data: { email, password, fullName } });
      toast.success("تم إنشاء حساب المدير. سجّل الدخول الآن.");
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
        <p className="font-medium">مرحباً بك في مدار 👋</p>
        <p className="text-muted-foreground mt-1 text-xs">أنشئ حساب المدير لبدء استخدام النظام.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>الاسم الكامل</Label>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>كلمة المرور (8 أحرف على الأقل)</Label>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          إنشاء حساب المدير
        </Button>
      </form>
    </div>
  );
}
