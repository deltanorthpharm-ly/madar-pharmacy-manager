import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { SmartSearch } from "@/components/smart-search";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  // Client-side guard (TanStack Start router context isn't wired to auth yet)
  useEffect(() => {
    if (!loading && !user) {
      // Double-check session in case context is mid-init
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) navigate({ to: "/login" });
      });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onOpenSearch={() => setSearchOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <SmartSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </SidebarProvider>
  );
}
